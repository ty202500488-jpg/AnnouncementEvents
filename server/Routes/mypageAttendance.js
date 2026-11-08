const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { authenticateToken, authenticateUser } = require('../middleware/auth');

const authorizeStaffForEvent = async (req, res, next) => {
    const userId = req.user.id;
    const eventId = Number(req.params.eventId || req.body.eventId);

    try {
        const result = await pool.query(
            `SELECT p.post_id
             FROM posts p
             JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN page_members pm ON pg.page_id = pm.page_id AND pm.user_id = $2 AND LOWER(pm.status) = 'active'
             WHERE p.post_id = $1 AND p.post_type = 'event'
               AND (pg.created_by = $2 OR pm.user_id = $2 OR $3 = 'admin')`,
            [eventId, userId, String(req.user.role_name || '').toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ message: 'Unauthorized: You are not staff for this page event.' });
        }
        next();
    } catch (err) {
        console.error('Authorization error:', err);
        return res.status(500).json({ message: 'Internal server error during authorization.' });
    }
};

// Get Authorized Events for Staff
router.get('/events', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT DISTINCT p.post_id AS id,
                    p.title,
                    ed.event_date,
                    ed.location AS venue,
                    ed.location
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN page_members pm ON pg.page_id = pm.page_id AND pm.user_id = $1 AND LOWER(pm.status) = 'active'
             WHERE p.post_type = 'event'
               AND p.is_archived = FALSE
               AND (pg.created_by = $1 OR pm.user_id = $1)
             ORDER BY ed.event_date DESC`,
            [req.user.id]
        );
        return res.json({ events: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching staff events' });
    }
});

// Get Event Overview, Session Status & Attendance Roster
router.get('/events/:eventId', authenticateToken, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    try {
        const eventRes = await pool.query(
            `SELECT p.post_id AS event_id, p.post_id AS id, p.title, p.title AS event_title,
                    p.content AS event_description, ed.event_date, ed.end_date,
                    ed.location, ed.location AS venue, ed.capacity
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             WHERE p.post_id = $1`,
            [eventId]
        );

        const sessionRes = await pool.query(
            `SELECT session_id AS id, event_post_id AS event_id, status, open_time, close_time
             FROM event_attendance_sessions
             WHERE event_post_id = $1`,
            [eventId]
        );

        const recordsRes = await pool.query(
            `SELECT ar.attendance_id AS id,
                    ar.status,
                    ar.checkin_time,
                    u.first_name || ' ' || u.last_name AS student_name,
                    COALESCE(sp.student_number, u.user_id::text) AS student_id
             FROM event_attendance_records ar
             JOIN event_registrations er ON ar.registration_id = er.registration_id
             JOIN users u ON er.registrant_user_id = u.user_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE er.event_post_id = $1
             ORDER BY u.last_name ASC, u.first_name ASC`,
            [eventId]
        );

        const records = recordsRes.rows;
        const totalEligible = records.length;
        const present = records.filter(r => r.status === 'PRESENT').length;
        const absent = records.filter(r => r.status === 'ABSENT').length;
        const unmarked = records.filter(r => r.status === 'NOT_MARKED').length;

        return res.json({
            event: eventRes.rows[0] || null,
            session: sessionRes.rows[0] || { status: 'CLOSED' },
            records,
            summary: {
                totalEligible,
                present,
                absent,
                unmarked,
                presentPct: totalEligible ? Math.round((present / totalEligible) * 100) : 0,
                absentPct: totalEligible ? Math.round((absent / totalEligible) * 100) : 0,
                unmarkedPct: totalEligible ? Math.round((unmarked / totalEligible) * 100) : 0
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching attendance details' });
    }
});

// Control Attendance Window (OPEN / CLOSE)
router.post('/events/:eventId/window', authenticateToken, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const { action } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let session;
        if (action === 'OPEN') {
            const upsertRes = await client.query(
                `INSERT INTO event_attendance_sessions (event_post_id, status, open_time, close_time, opened_by)
                 VALUES ($1, 'OPEN', NOW(), NULL, $2)
                 ON CONFLICT (event_post_id)
                 DO UPDATE SET status = 'OPEN', open_time = NOW(), close_time = NULL, opened_by = $2
                 RETURNING session_id AS id, event_post_id AS event_id, status, open_time, close_time`,
                [eventId, req.user.id]
            );
            session = upsertRes.rows[0];

            // Ensure every registered student has a 1:1 attendance record
            await client.query(
                `INSERT INTO event_attendance_records (registration_id, status)
                 SELECT registration_id, 'NOT_MARKED'
                 FROM event_registrations
                 WHERE event_post_id = $1 AND LOWER(status) != 'cancelled'
                 ON CONFLICT (registration_id) DO NOTHING`,
                [eventId]
            );
        } else if (action === 'CLOSE') {
            const closeRes = await client.query(
                `UPDATE event_attendance_sessions
                 SET status = 'CLOSED', close_time = NOW()
                 WHERE event_post_id = $1
                 RETURNING session_id AS id, event_post_id AS event_id, status, open_time, close_time`,
                [eventId]
            );
            session = closeRes.rows[0] || { status: 'CLOSED' };

            await client.query(
                `UPDATE event_attendance_records ar
                 SET status = 'ABSENT'
                 FROM event_registrations er
                 WHERE ar.registration_id = er.registration_id
                   AND er.event_post_id = $1
                   AND ar.status = 'NOT_MARKED'`,
                [eventId]
            );
        }

        await client.query('COMMIT');
        return res.json({ message: `Attendance window ${String(action).toLowerCase()}ed successfully.`, session });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        return res.status(500).json({ message: 'Error managing attendance window' });
    } finally {
        client.release();
    }
});

// Rotate QR Credential (30s Expiry)
router.get('/events/:eventId/qr-credential', authenticateToken, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    try {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 1000);

        await pool.query(
            `INSERT INTO event_qr_tokens (event_post_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
            [eventId, tokenHash, expiresAt]
        );

        const checkInUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/student/attendance/check-in/${rawToken}`;
        return res.json({ qrCredentialUrl: checkInUrl, expiresAt });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error generating QR token' });
    }
});

// Student / Staff QR Check-In
router.post('/check-in', authenticateToken, async (req, res) => {
    const { token } = req.body;
    const userId = req.user.id;

    try {
        if (!token) {
            return res.status(400).json({ message: 'QR token is required.' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const tokenRes = await pool.query(
            `SELECT * FROM event_qr_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
            [tokenHash]
        );

        if (tokenRes.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired QR code.' });
        }

        const eventId = tokenRes.rows[0].event_post_id;

        const sessionRes = await pool.query(
            `SELECT status FROM event_attendance_sessions WHERE event_post_id = $1`,
            [eventId]
        );
        if (sessionRes.rows.length === 0 || sessionRes.rows[0].status !== 'OPEN') {
            return res.status(400).json({ message: 'Attendance window is closed for this event.' });
        }

        const regRes = await pool.query(
            `SELECT registration_id FROM event_registrations
             WHERE event_post_id = $1 AND registrant_user_id = $2 AND LOWER(status) != 'cancelled'`,
            [eventId, userId]
        );
        if (regRes.rows.length === 0) {
            return res.status(403).json({ message: 'You are not registered for this event.' });
        }

        const regId = regRes.rows[0].registration_id;

        const recordRes = await pool.query(
            `INSERT INTO event_attendance_records (registration_id, status, checkin_time, check_in_method)
             VALUES ($1, 'PRESENT', NOW(), 'qr_scan')
             ON CONFLICT (registration_id)
             DO UPDATE SET status = 'PRESENT', checkin_time = NOW(), check_in_method = 'qr_scan'
             RETURNING attendance_id AS id, status, checkin_time`,
            [regId]
        );

        await pool.query(
            `UPDATE event_registrations SET status = 'Attended' WHERE registration_id = $1`,
            [regId]
        );

        if (recordRes.rows.length > 0) {
            await pool.query(
                `INSERT INTO event_attendance_audits (attendance_id, actor_user_id, previous_status, new_status, source, reason)
                 VALUES ($1, $2, 'NOT_MARKED', 'PRESENT', 'student', 'QR Check-in')`,
                [recordRes.rows[0].id, userId]
            );
        }

        return res.json({ message: 'Attendance recorded successfully!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error checking in.' });
    }
});

// Manual Staff Correction
router.put('/records/:recordId/correct', authenticateToken, async (req, res) => {
    const recordId = Number(req.params.recordId);
    const { status, reason } = req.body;
    const userId = req.user.id;

    try {
        const existingRes = await pool.query(
            `SELECT attendance_id AS id, status, checkin_time FROM event_attendance_records WHERE attendance_id = $1`,
            [recordId]
        );
        if (existingRes.rows.length === 0) {
            return res.status(404).json({ message: 'Record not found.' });
        }

        const oldRecord = existingRes.rows[0];

        const updatedRes = await pool.query(
            `UPDATE event_attendance_records
             SET status = $1,
                 check_in_method = 'manual_staff',
                 checkin_time = CASE WHEN $1 = 'PRESENT' AND checkin_time IS NULL THEN NOW() ELSE checkin_time END
             WHERE attendance_id = $2
             RETURNING attendance_id AS id, status, checkin_time`,
            [status, recordId]
        );

        await pool.query(
            `INSERT INTO event_attendance_audits (attendance_id, actor_user_id, previous_status, new_status, source, reason)
             VALUES ($1, $2, $3, $4, 'staff', $5)`,
            [recordId, userId, oldRecord.status, status, reason || 'Manual correction']
        );

        return res.json({ message: 'Record updated successfully', record: updatedRes.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Correction failed.' });
    }
});

// Export Attendance CSV
router.get('/events/:eventId/export', async (req, res) => {
    const user = await authenticateUser(req, res);
    if (!user) return;

    const eventId = Number(req.params.eventId);
    try {
        const { rows } = await pool.query(
            `SELECT COALESCE(sp.student_number, u.user_id::text) AS student_id,
                    u.first_name || ' ' || u.last_name AS name,
                    ar.status,
                    ar.checkin_time
             FROM event_attendance_records ar
             JOIN event_registrations er ON ar.registration_id = er.registration_id
             JOIN users u ON er.registrant_user_id = u.user_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE er.event_post_id = $1
             ORDER BY u.last_name ASC`,
            [eventId]
        );

        let csvContent = 'Student ID,Student Name,Status,Check-in Time\n';
        rows.forEach((r) => {
            const sanitize = (val) => {
                if (!val) return '""';
                let str = String(val).replace(/"/g, '""');
                if (['=', '+', '-', '@'].includes(str.charAt(0))) str = `'${str}`;
                return `"${str}"`;
            };
            csvContent += `${sanitize(r.student_id)},${sanitize(r.name)},${sanitize(r.status)},${sanitize(r.checkin_time)}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_event_${eventId}.csv`);
        return res.status(200).send(csvContent);
    } catch (err) {
        console.error(err);
        return res.status(500).send('CSV generation error');
    }
});

module.exports = router;
