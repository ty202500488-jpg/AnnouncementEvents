const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const jwt = require('jsonwebtoken');

// =====================================================
// INLINE JWT AUTHENTICATION MIDDLEWARE
// =====================================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    
    req.user = {
      id: Number(decoded.userId ?? decoded.id ?? decoded.user_id),
      ...decoded
    };

    next();
  });
};

// Middleware: Verify logged-in user is staff for the target event's page
const authorizeStaffForEvent = async (req, res, next) => {
  const userId = req.user.id;
  const eventId = req.params.eventId || req.body.eventId;

  try {
    const query = `
      SELECT e.event_id FROM events e
      JOIN page_staff ps ON e.page_id = ps.page_id
      WHERE e.event_id = $1 AND ps.user_id = $2
    `;
    const result = await pool.query(query, [eventId, userId]);
    if (result.rows.length === 0) {
      return res.status(403).json({ message: 'Unauthorized: You are not staff for this page event.' });
    }
    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(500).json({ message: 'Internal server error during authorization.' });
  }
};

// Get Authorized Events for Staff
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT e.event_id AS id, COALESCE(e.event_title, e.title) AS title, e.event_date, e.venue
      FROM events e
      JOIN page_staff ps ON e.page_id = ps.page_id
      WHERE ps.user_id = $1
      ORDER BY e.event_date DESC
    `;
    const { rows } = await pool.query(query, [req.user.id]);
    res.json({ events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching staff events' });
  }
});

// Get Event Overview, Session Status & Attendance Roster
router.get('/events/:eventId', authenticateToken, authorizeStaffForEvent, async (req, res) => {
  const { eventId } = req.params;
  try {
    const eventRes = await pool.query('SELECT * FROM events WHERE event_id = $1', [eventId]);
    const sessionRes = await pool.query('SELECT * FROM event_attendance_sessions WHERE event_id = $1', [eventId]);

    const recordsRes = await pool.query(`
      SELECT ar.id, ar.status, ar.checkin_time, u.first_name || ' ' || u.last_name as student_name, u.user_id as student_id
      FROM event_attendance_records ar
      JOIN event_registrations er ON ar.registration_id = er.registration_id
      JOIN users u ON er.registrant_user_id = u.user_id
      WHERE ar.event_id = $1
    `, [eventId]).catch(() => ({ rows: [] }));

    const records = recordsRes.rows;
    const totalEligible = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const unmarked = records.filter(r => r.status === 'NOT_MARKED').length;

    res.json({
      event: eventRes.rows[0],
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
    res.status(500).json({ message: 'Error fetching attendance details' });
  }
});

// Control Attendance Window (OPEN / CLOSE)
router.post('/events/:eventId/window', authenticateToken, authorizeStaffForEvent, async (req, res) => {
  const { eventId } = req.params;
  const { action } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let sessionRes = await client.query('SELECT * FROM event_attendance_sessions WHERE event_id = $1', [eventId]);
    let session = sessionRes.rows[0];

    if (action === 'OPEN') {
      if (!session) {
        const ins = await client.query(
          `INSERT INTO event_attendance_sessions (event_id, status, open_time) VALUES ($1, 'OPEN', NOW()) RETURNING *`,
          [eventId]
        );
        session = ins.rows[0];
      } else {
        const upd = await client.query(
          `UPDATE event_attendance_sessions SET status = 'OPEN', open_time = NOW(), close_time = NULL WHERE event_id = $1 RETURNING *`,
          [eventId]
        );
        session = upd.rows[0];
      }

      await client.query(`
        INSERT INTO event_attendance_records (event_id, registration_id, status)
        SELECT $1, registration_id, 'NOT_MARKED'
        FROM event_registrations
        WHERE event_id = $1
        ON CONFLICT (event_id, registration_id) DO NOTHING
      `, [eventId]);

    } else if (action === 'CLOSE') {
      await client.query(
        `UPDATE event_attendance_sessions SET status = 'CLOSED', close_time = NOW() WHERE event_id = $1`,
        [eventId]
      );

      await client.query(
        `UPDATE event_attendance_records SET status = 'ABSENT' WHERE event_id = $1 AND status = 'NOT_MARKED'`,
        [eventId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Attendance window ${action.toLowerCase()}ed successfully.`, session });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error managing attendance window' });
  } finally {
    client.release();
  }
});

// Rotate QR Credential (30s Expiry)
router.get('/events/:eventId/qr-credential', authenticateToken, authorizeStaffForEvent, async (req, res) => {
  const { eventId } = req.params;
  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 1000);

    await pool.query(
      `INSERT INTO event_attendance_qr_tokens (event_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [eventId, tokenHash, expiresAt]
    );

    const checkInUrl = `http://localhost:5173/student/attendance/check-in/${rawToken}`;
    res.json({ qrCredentialUrl: checkInUrl, expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating QR token' });
  }
});

// Student Check-In
router.post('/check-in', authenticateToken, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRes = await pool.query(
      `SELECT * FROM event_attendance_qr_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired QR code.' });
    }

    const eventId = tokenRes.rows[0].event_id;

    const sessionRes = await pool.query(`SELECT status FROM event_attendance_sessions WHERE event_id = $1`, [eventId]);
    if (sessionRes.rows.length === 0 || sessionRes.rows[0].status !== 'OPEN') {
      return res.status(400).json({ message: 'Attendance window is closed for this event.' });
    }

    const regRes = await pool.query(`SELECT registration_id FROM event_registrations WHERE event_id = $1 AND registrant_user_id = $2`, [eventId, userId]);
    if (regRes.rows.length === 0) {
      return res.status(403).json({ message: 'You are not registered for this event.' });
    }

    const regId = regRes.rows[0].registration_id;

    const recordRes = await pool.query(
      `UPDATE event_attendance_records 
       SET status = 'PRESENT', checkin_time = NOW() 
       WHERE event_id = $1 AND registration_id = $2 
       RETURNING *`,
      [eventId, regId]
    );

    if (recordRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO event_attendance_audit_logs (record_id, previous_status, new_status, actor_id, source, reason)
         VALUES ($1, 'NOT_MARKED', 'PRESENT', $2, 'student', 'QR Check-in')`,
        [recordRes.rows[0].id, userId]
      );
    }

    res.json({ message: 'Attendance recorded successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error checking in.' });
  }
});

// Manual Staff Correction
router.put('/records/:recordId/correct', authenticateToken, async (req, res) => {
  const { recordId } = req.params;
  const { status, reason } = req.body;
  const userId = req.user.id;

  try {
    const existingRes = await pool.query('SELECT * FROM event_attendance_records WHERE id = $1', [recordId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found.' });
    }

    const oldRecord = existingRes.rows[0];

    const updatedRes = await pool.query(
      `UPDATE event_attendance_records SET status = $1 WHERE id = $2 RETURNING *`,
      [status, recordId]
    );

    await pool.query(
      `INSERT INTO event_attendance_audit_logs (record_id, previous_status, new_status, actor_id, source, reason)
       VALUES ($1, $2, $3, $4, 'staff', $5)`,
      [recordId, oldRecord.status, status, userId, reason]
    );

    res.json({ message: 'Record updated successfully', record: updatedRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Correction failed.' });
  }
});

// Export Attendance CSV
router.get('/events/:eventId/export', async (req, res) => {
  const { eventId } = req.params;
  try {
    const query = `
      SELECT u.user_id as student_id, u.first_name || ' ' || u.last_name as name, ar.status, ar.checkin_time
      FROM event_attendance_records ar
      JOIN event_registrations er ON ar.registration_id = er.registration_id
      JOIN users u ON er.registrant_user_id = u.user_id
      WHERE ar.event_id = $1
    `;
    const { rows } = await pool.query(query, [eventId]);

    let csvContent = 'Student ID,Student Name,Status,Check-in Time\n';
    rows.forEach((r) => {
      const sanitize = (val) => {
        if (!val) return '';
        let str = String(val).replace(/"/g, '""');
        if (['=', '+', '-', '@'].includes(str.charAt(0))) {
          str = `'` + str;
        }
        return `"${str}"`;
      };

      csvContent += `${sanitize(r.student_id)},${sanitize(r.name)},${sanitize(r.status)},${sanitize(r.checkin_time)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_event_${eventId}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error(err);
    res.status(500).send('CSV generation error');
  }
});

module.exports = router;