const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireStaffOrAdmin, logAudit } = require('../middleware/auth');
const { notifyAttendanceWindowChange } = require('../utils/notificationService');
const {
    ensureAttendanceSchema,
    getCampusGeofenceConfig,
    evaluateCampusGeofence,
    evaluateAttendanceSession,
    validateAttendanceSchedule,
    generateStaticQrToken,
    buildAttendanceQrPayload,
    extractAttendanceQrToken
} = require('../utils/attendanceHelper');

const SESSION_PUBLIC_COLUMNS = `
    session_id AS id,
    event_post_id AS event_id,
    status,
    open_time,
    close_time,
    scheduled_open_time,
    scheduled_close_time,
    closed_manually_at,
    qr_token_created_at,
    (qr_token IS NOT NULL) AS has_qr_token
`;

function formatSessionResponse(sessionRow, eventId, now = new Date()) {
    const evalResult = evaluateAttendanceSession(sessionRow || null, now);
    if (!sessionRow) {
        return {
            id: null,
            event_id: eventId,
            status: 'CLOSED',
            effective_status: evalResult.effectiveStatus,
            open_time: null,
            close_time: null,
            scheduled_open_time: null,
            scheduled_close_time: null,
            closed_manually_at: null,
            qr_token_created_at: null,
            has_qr_token: false
        };
    }

    return {
        id: sessionRow.id ?? null,
        event_id: sessionRow.event_id ?? eventId,
        status: sessionRow.status,
        effective_status: evalResult.effectiveStatus,
        open_time: sessionRow.open_time ?? null,
        close_time: sessionRow.close_time ?? null,
        scheduled_open_time: sessionRow.scheduled_open_time ?? null,
        scheduled_close_time: sessionRow.scheduled_close_time ?? null,
        closed_manually_at: sessionRow.closed_manually_at ?? null,
        qr_token_created_at: sessionRow.qr_token_created_at ?? null,
        has_qr_token: Boolean(sessionRow.has_qr_token)
    };
}

async function ensureConfirmedRegistrationRecords(db, eventId) {
    await db.query(
        `INSERT INTO event_attendance_records (registration_id, status)
         SELECT registration_id, 'NOT_MARKED'
         FROM event_registrations
         WHERE event_post_id = $1 AND LOWER(status) IN ('registered', 'attended')
         ON CONFLICT (registration_id) DO NOTHING`,
        [eventId]
    );
}

async function resetAutoAbsentRecords(db, eventId) {
    await db.query(
        `UPDATE event_attendance_records ar
         SET status = 'NOT_MARKED',
             updated_at = NOW()
         FROM event_registrations er
         WHERE ar.registration_id = er.registration_id
           AND er.event_post_id = $1
           AND ar.status = 'ABSENT'
           AND ar.check_in_method IS DISTINCT FROM 'manual_staff'`,
        [eventId]
    );
}

async function markUnmarkedAsAbsent(db, eventId) {
    await db.query(
        `UPDATE event_attendance_records ar
         SET status = 'ABSENT',
             check_in_method = 'qr_scan',
             updated_at = NOW()
         FROM event_registrations er
         WHERE ar.registration_id = er.registration_id
           AND er.event_post_id = $1
           AND ar.status = 'NOT_MARKED'`,
        [eventId]
    );
}

async function notifyWindowTransition(db, { eventId, actorUserId, action }) {
    try {
        const evRes = await db.query(
            `SELECT p.title, p.page_id,
                    COUNT(ar.attendance_id) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
                    COUNT(ar.attendance_id) FILTER (WHERE ar.status = 'ABSENT')::int AS absent,
                    COUNT(ar.attendance_id)::int AS total_eligible
             FROM posts p
             LEFT JOIN event_registrations er ON p.post_id = er.event_post_id AND LOWER(er.status) IN ('registered', 'attended')
             LEFT JOIN event_attendance_records ar ON er.registration_id = ar.registration_id
             WHERE p.post_id = $1
             GROUP BY p.post_id`,
            [eventId]
        );
        const evRow = evRes.rows[0];
        if (evRow) {
            await notifyAttendanceWindowChange(db, {
                eventId,
                title: evRow.title,
                pageId: evRow.page_id,
                actorUserId,
                action,
                summary: {
                    present: evRow.present || 0,
                    absent: evRow.absent || 0,
                    totalEligible: evRow.total_eligible || 0
                }
            });
        }
    } catch (notifyErr) {
        console.warn('Attendance notification warning:', notifyErr.message);
    }
}

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
            await logAudit(req, {
                action: 'Unauthorized Event Attendance Access Attempt',
                module: 'attendance',
                actorUserId: userId,
                actorRole: req.user.role_name,
                targetType: 'event',
                targetId: eventId,
                outcome: 'DENIED',
                isSecurityEvent: true
            });
            return res.status(403).json({ message: 'Unauthorized: You are not staff for this page event.' });
        }
        next();
    } catch (err) {
        console.error('Authorization error:', err);
        return res.status(500).json({ message: 'Internal server error during authorization.' });
    }
};

// Public/Authenticated Campus Geofence Configuration for Student & Staff UI
router.get('/geofence-config', authenticateToken, (req, res) => {
    const config = getCampusGeofenceConfig();
    return res.json({
        enabled: config.enabled,
        campusName: config.campusName,
        lat: config.lat,
        lng: config.lng,
        radiusMeters: config.radiusMeters
    });
});

// Get Authorized Events for Staff
router.get('/events', requireStaffOrAdmin, async (req, res) => {
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
router.get('/events/:eventId', requireStaffOrAdmin, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    try {
        await ensureAttendanceSchema(pool);

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
            `SELECT ${SESSION_PUBLIC_COLUMNS}
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
        const present = records.filter((r) => r.status === 'PRESENT').length;
        const absent = records.filter((r) => r.status === 'ABSENT').length;
        const unmarked = records.filter((r) => r.status === 'NOT_MARKED').length;

        return res.json({
            event: eventRes.rows[0] || null,
            session: formatSessionResponse(sessionRes.rows[0], eventId),
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
router.post('/events/:eventId/window', requireStaffOrAdmin, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const action = String(req.body?.action || '').trim().toUpperCase();
    const rawCloseTime = req.body?.closeTime;

    if (action !== 'OPEN' && action !== 'CLOSE') {
        return res.status(400).json({ message: "Action must be 'OPEN' or 'CLOSE'." });
    }

    let parsedCloseTime = null;
    if (action === 'OPEN' && rawCloseTime !== undefined && rawCloseTime !== null && String(rawCloseTime).trim() !== '') {
        parsedCloseTime = new Date(rawCloseTime);
        if (Number.isNaN(parsedCloseTime.getTime()) || parsedCloseTime.getTime() <= Date.now()) {
            return res.status(400).json({ message: 'Close time must be a valid future date and time.' });
        }
    }

    let client;
    try {
        await ensureAttendanceSchema(pool);
        client = await pool.connect();
        await client.query('BEGIN');

        let sessionRow;
        if (action === 'OPEN') {
            const candidateToken = generateStaticQrToken();
            const upsertRes = await client.query(
                `INSERT INTO event_attendance_sessions (
                     event_post_id, status, open_time, close_time,
                     scheduled_open_time, scheduled_close_time, closed_manually_at,
                     qr_token, qr_token_created_at, opened_by, updated_at
                 )
                 VALUES ($1, 'OPEN', NOW(), $2, NULL, $2, NULL, $3, NOW(), $4, NOW())
                 ON CONFLICT (event_post_id)
                 DO UPDATE SET
                     status = 'OPEN',
                     open_time = NOW(),
                     close_time = $2,
                     scheduled_open_time = NULL,
                     scheduled_close_time = $2,
                     closed_manually_at = NULL,
                     qr_token = COALESCE(event_attendance_sessions.qr_token, $3),
                     qr_token_created_at = COALESCE(event_attendance_sessions.qr_token_created_at, NOW()),
                     opened_by = $4,
                     updated_at = NOW()
                 RETURNING ${SESSION_PUBLIC_COLUMNS}`,
                [eventId, parsedCloseTime, candidateToken, req.user.id]
            );
            sessionRow = upsertRes.rows[0];

            await ensureConfirmedRegistrationRecords(client, eventId);
            await resetAutoAbsentRecords(client, eventId);
        } else {
            const closeRes = await client.query(
                `INSERT INTO event_attendance_sessions (
                     event_post_id, status, close_time, closed_manually_at, updated_at
                 )
                 VALUES ($1, 'CLOSED', NOW(), NOW(), NOW())
                 ON CONFLICT (event_post_id)
                 DO UPDATE SET
                     status = 'CLOSED',
                     close_time = NOW(),
                     closed_manually_at = NOW(),
                     updated_at = NOW()
                 RETURNING ${SESSION_PUBLIC_COLUMNS}`,
                [eventId]
            );
            sessionRow = closeRes.rows[0];

            await ensureConfirmedRegistrationRecords(client, eventId);
            await markUnmarkedAsAbsent(client, eventId);
        }

        await client.query('COMMIT');
        await notifyWindowTransition(pool, { eventId, actorUserId: req.user.id, action });

        return res.json({
            message: `Attendance window ${action.toLowerCase()}ed successfully.`,
            session: formatSessionResponse(sessionRow, eventId)
        });
    } catch (err) {
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
        }
        console.error(err);
        return res.status(500).json({ message: 'Error managing attendance window' });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Configure or Clear Scheduled Attendance Window
router.post('/events/:eventId/schedule', requireStaffOrAdmin, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);

    try {
        await ensureAttendanceSchema(pool);

        if (req.body && req.body.clear === true) {
            const clearRes = await pool.query(
                `UPDATE event_attendance_sessions
                 SET scheduled_open_time = NULL,
                     scheduled_close_time = NULL,
                     open_time = CASE WHEN status = 'CLOSED' THEN NULL ELSE open_time END,
                     close_time = CASE WHEN status = 'CLOSED' THEN NULL ELSE close_time END,
                     updated_at = NOW()
                 WHERE event_post_id = $1
                 RETURNING ${SESSION_PUBLIC_COLUMNS}`,
                [eventId]
            );

            return res.json({
                message: 'Attendance schedule cleared.',
                session: formatSessionResponse(clearRes.rows[0], eventId)
            });
        }

        const validation = validateAttendanceSchedule({
            scheduledOpenTime: req.body?.scheduledOpenTime,
            scheduledCloseTime: req.body?.scheduledCloseTime
        });
        if (!validation.valid) {
            return res.status(400).json({ message: validation.error, error: validation.error });
        }

        const { openDate, closeDate } = validation;
        const now = new Date();
        if (closeDate.getTime() <= now.getTime()) {
            const msg = 'Schedule end time must be in the future.';
            return res.status(400).json({ message: msg, error: msg });
        }

        const isNowInWindow = now >= openDate && now < closeDate;
        const nextStatus = isNowInWindow ? 'OPEN' : 'CLOSED';
        const actualOpenTime = isNowInWindow ? openDate : null;
        const candidateToken = generateStaticQrToken();

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const upsertRes = await client.query(
                `INSERT INTO event_attendance_sessions (
                     event_post_id, status, open_time, close_time,
                     scheduled_open_time, scheduled_close_time, closed_manually_at,
                     qr_token, qr_token_created_at, opened_by, updated_at
                 )
                 VALUES ($1, $2, $3, NULL, $4, $5, NULL, $6, NOW(), $7, NOW())
                 ON CONFLICT (event_post_id)
                 DO UPDATE SET
                     status = $2,
                     open_time = $3,
                     close_time = NULL,
                     scheduled_open_time = $4,
                     scheduled_close_time = $5,
                     closed_manually_at = NULL,
                     opened_by = $7,
                     qr_token = COALESCE(event_attendance_sessions.qr_token, $6),
                     qr_token_created_at = COALESCE(event_attendance_sessions.qr_token_created_at, NOW()),
                     updated_at = NOW()
                 RETURNING ${SESSION_PUBLIC_COLUMNS}`,
                [eventId, nextStatus, actualOpenTime, openDate, closeDate, candidateToken, req.user.id]
            );

            if (isNowInWindow) {
                await ensureConfirmedRegistrationRecords(client, eventId);
                await resetAutoAbsentRecords(client, eventId);
            }

            await client.query('COMMIT');

            if (isNowInWindow) {
                await notifyWindowTransition(pool, { eventId, actorUserId: req.user.id, action: 'OPEN' });
            }

            return res.json({
                message: isNowInWindow
                    ? 'Attendance window scheduled and opened.'
                    : 'Attendance window scheduled successfully.',
                session: formatSessionResponse(upsertRes.rows[0], eventId, now)
            });
        } catch (txErr) {
            await client.query('ROLLBACK').catch(() => {});
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error scheduling attendance window' });
    }
});

// Get or Provision Static Shareable QR Credential (Works Regardless of CLOSED / SCHEDULED / ACTIVE)
router.get('/events/:eventId/qr-credential', requireStaffOrAdmin, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    try {
        await ensureAttendanceSchema(pool);
        const candidateToken = generateStaticQrToken();

        const { rows } = await pool.query(
            `INSERT INTO event_attendance_sessions (
                 event_post_id, status, qr_token, qr_token_created_at, updated_at
             )
             VALUES ($1, 'CLOSED', $2, NOW(), NOW())
             ON CONFLICT (event_post_id)
             DO UPDATE SET
                 qr_token = COALESCE(event_attendance_sessions.qr_token, $2),
                 qr_token_created_at = CASE
                     WHEN event_attendance_sessions.qr_token IS NULL THEN NOW()
                     ELSE COALESCE(event_attendance_sessions.qr_token_created_at, NOW())
                 END,
                 updated_at = CASE
                     WHEN event_attendance_sessions.qr_token IS NULL THEN NOW()
                     ELSE event_attendance_sessions.updated_at
                 END
             RETURNING session_id AS id, event_post_id AS event_id, status, open_time, close_time,
                       scheduled_open_time, scheduled_close_time, closed_manually_at,
                       qr_token, qr_token_created_at`,
            [eventId, candidateToken]
        );

        const row = rows[0];
        const evalResult = evaluateAttendanceSession(row);

        return res.json({
            qrToken: row.qr_token,
            qrPayload: buildAttendanceQrPayload(row.qr_token),
            qrCreatedAt: row.qr_token_created_at,
            effectiveStatus: evalResult.effectiveStatus,
            scheduledOpenTime: evalResult.scheduledOpenTime,
            scheduledCloseTime: evalResult.scheduledCloseTime
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error generating QR credential' });
    }
});

// Regenerate Static Shareable QR Credential (Invalidates Prior Screenshots)
router.post('/events/:eventId/qr-credential/regenerate', requireStaffOrAdmin, authorizeStaffForEvent, async (req, res) => {
    const eventId = Number(req.params.eventId);
    try {
        await ensureAttendanceSchema(pool);
        const newToken = generateStaticQrToken();

        const { rows } = await pool.query(
            `INSERT INTO event_attendance_sessions (
                 event_post_id, status, qr_token, qr_token_created_at, updated_at
             )
             VALUES ($1, 'CLOSED', $2, NOW(), NOW())
             ON CONFLICT (event_post_id)
             DO UPDATE SET
                 qr_token = $2,
                 qr_token_created_at = NOW(),
                 updated_at = NOW()
             RETURNING qr_token, qr_token_created_at`,
            [eventId, newToken]
        );

        const row = rows[0];
        return res.json({
            message: 'Attendance QR code regenerated. Previous screenshots are now invalid.',
            qrToken: row.qr_token,
            qrPayload: buildAttendanceQrPayload(row.qr_token),
            qrCreatedAt: row.qr_token_created_at
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error regenerating QR credential' });
    }
});

/**
 * Process a student/staff static QR check-in with session-window, geofence, registration,
 * duplicate, and manual-staff override guards.
 */
async function processQrCheckIn(
    db,
    { userId, token, eventId, latitude, longitude, now = new Date(), geofenceConfig } = {}
) {
    await ensureAttendanceSchema(db);

    const cleanToken = extractAttendanceQrToken(token);
    if (!cleanToken) {
        return { httpStatus: 400, body: { message: 'QR token is required.' } };
    }

    const sessionRes = await db.query(
        `SELECT session_id, event_post_id, status, open_time, close_time,
                scheduled_open_time, scheduled_close_time, closed_manually_at
         FROM event_attendance_sessions
         WHERE qr_token = $1
         LIMIT 1`,
        [cleanToken]
    );
    if (sessionRes.rows.length === 0) {
        return { httpStatus: 400, body: { message: 'Invalid or expired QR code.' } };
    }

    const sessionRow = sessionRes.rows[0];
    if (
        eventId !== undefined &&
        eventId !== null &&
        String(eventId).trim() !== '' &&
        Number(eventId) !== Number(sessionRow.event_post_id)
    ) {
        return { httpStatus: 400, body: { message: 'This QR code belongs to a different event.' } };
    }

    const sessionState = evaluateAttendanceSession(sessionRow, now);
    if (sessionState.effectiveStatus === 'SCHEDULED') {
        return { httpStatus: 400, body: { message: 'Attendance has not started yet.' } };
    }
    if (sessionState.effectiveStatus !== 'ACTIVE') {
        return { httpStatus: 400, body: { message: 'Attendance window is closed for this event.' } };
    }

    const geo = evaluateCampusGeofence(
        { latitude, longitude },
        geofenceConfig || getCampusGeofenceConfig()
    );
    if (!geo.allowed) {
        if (geo.reason === 'INVALID_COORDINATES') {
            return {
                httpStatus: 400,
                body: {
                    message: 'Location access is required to record attendance.',
                    code: 'LOCATION_REQUIRED'
                }
            };
        }
        return {
            httpStatus: 403,
            body: {
                message: `You must be within ${geo.campusName} to record attendance.`,
                code: 'OUTSIDE_GEOFENCE',
                distanceMeters: geo.distanceMeters,
                radiusMeters: geo.radiusMeters
            }
        };
    }

    const regRes = await db.query(
        `SELECT registration_id, status
         FROM event_registrations
         WHERE event_post_id = $1
           AND registrant_user_id = $2
           AND LOWER(status) IN ('registered', 'attended')
         LIMIT 1`,
        [sessionRow.event_post_id, userId]
    );
    if (regRes.rows.length === 0) {
        return {
            httpStatus: 403,
            body: { message: 'You do not have a confirmed registration for this event.' }
        };
    }

    const regId = regRes.rows[0].registration_id;
    const existingRes = await db.query(
        `SELECT attendance_id, status, checkin_time, check_in_method
         FROM event_attendance_records
         WHERE registration_id = $1
         LIMIT 1`,
        [regId]
    );
    const existing = existingRes.rows[0] || null;

    if (existing?.status === 'PRESENT') {
        return {
            httpStatus: 200,
            body: {
                message: 'You have already checked in for this event.',
                eventId: sessionRow.event_post_id,
                status: 'PRESENT',
                checkinTime: existing.checkin_time,
                alreadyCheckedIn: true
            }
        };
    }

    if (
        existing?.check_in_method === 'manual_staff' &&
        ['ABSENT', 'EXCUSED'].includes(String(existing.status || '').toUpperCase())
    ) {
        return {
            httpStatus: 409,
            body: {
                message: 'Your attendance status was manually set by staff and cannot be overwritten by QR scan.'
            }
        };
    }

    const previousStatus = existing?.status || 'NOT_MARKED';

    const recordRes = await db.query(
        `INSERT INTO event_attendance_records (registration_id, status, checkin_time, check_in_method, updated_at)
         VALUES ($1, 'PRESENT', NOW(), 'qr_scan', NOW())
         ON CONFLICT (registration_id)
         DO UPDATE SET status = 'PRESENT', checkin_time = NOW(), check_in_method = 'qr_scan', updated_at = NOW()
         WHERE event_attendance_records.status <> 'PRESENT'
           AND NOT (
               event_attendance_records.check_in_method = 'manual_staff'
               AND event_attendance_records.status IN ('ABSENT', 'EXCUSED')
           )
         RETURNING attendance_id AS id, status, checkin_time`,
        [regId]
    );
    const record = recordRes.rows[0];

    if (!record) {
        const latestRes = await db.query(
            `SELECT attendance_id AS id, status, checkin_time, check_in_method
             FROM event_attendance_records
             WHERE registration_id = $1
             LIMIT 1`,
            [regId]
        );
        const latest = latestRes.rows[0];
        if (latest?.status === 'PRESENT') {
            return {
                httpStatus: 200,
                body: {
                    message: 'You have already checked in for this event.',
                    eventId: sessionRow.event_post_id,
                    status: 'PRESENT',
                    checkinTime: latest.checkin_time,
                    alreadyCheckedIn: true
                }
            };
        }
        return {
            httpStatus: 409,
            body: {
                message: 'Your attendance status was manually set by staff and cannot be overwritten by QR scan.'
            }
        };
    }

    await db.query(
        `UPDATE event_registrations SET status = 'Attended' WHERE registration_id = $1`,
        [regId]
    );

    await db.query(
        `INSERT INTO event_attendance_audits (attendance_id, actor_user_id, previous_status, new_status, source, reason)
         VALUES ($1, $2, $3, 'PRESENT', 'student', 'QR Check-in')`,
        [record.id, userId, previousStatus]
    );

    return {
        httpStatus: 200,
        body: {
            message: 'Attendance recorded successfully!',
            eventId: sessionRow.event_post_id,
            status: 'PRESENT',
            checkinTime: record.checkin_time || null
        }
    };
}

// Student / Staff QR Check-In
router.post('/check-in', authenticateToken, async (req, res) => {
    try {
        const { token, eventId, latitude, longitude } = req.body || {};
        const result = await processQrCheckIn(pool, {
            userId: req.user.id,
            token,
            eventId,
            latitude,
            longitude
        });
        return res.status(result.httpStatus).json(result.body);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error checking in.' });
    }
});

// Manual Staff Correction
router.put('/records/:recordId/correct', requireStaffOrAdmin, async (req, res) => {
    const recordId = Number(req.params.recordId);
    const { status, reason } = req.body;
    const userId = req.user.id;

    try {
        if (!Number.isInteger(recordId) || recordId <= 0) {
            return res.status(400).json({ message: 'Invalid attendance record ID.' });
        }

        if (!['PRESENT', 'ABSENT', 'NOT_MARKED'].includes(String(status || '').toUpperCase())) {
            return res.status(400).json({ message: 'Invalid attendance status.' });
        }

        const existingRes = await pool.query(
            `SELECT ar.attendance_id AS id,
                    ar.status,
                    ar.checkin_time,
                    er.event_post_id,
                    p.page_id,
                    pg.created_by AS page_created_by,
                    EXISTS(
                        SELECT 1 FROM page_members pm
                        WHERE pm.page_id = p.page_id AND pm.user_id = $2 AND LOWER(pm.status) = 'active'
                    ) AS is_page_member
             FROM event_attendance_records ar
             JOIN event_registrations er ON ar.registration_id = er.registration_id
             JOIN posts p ON er.event_post_id = p.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             WHERE ar.attendance_id = $1`,
            [recordId, userId]
        );
        if (existingRes.rows.length === 0) {
            return res.status(404).json({ message: 'Record not found.' });
        }

        const oldRecord = existingRes.rows[0];
        const isAdmin = String(req.user.role_name || '').toLowerCase() === 'admin';
        const isEventStaff = isAdmin || Number(oldRecord.page_created_by) === Number(userId) || Boolean(oldRecord.is_page_member);

        if (!isEventStaff) {
            await logAudit(req, {
                action: 'Unauthorized Attendance Correction Attempt',
                module: 'attendance',
                actorUserId: userId,
                actorRole: req.user.role_name,
                targetType: 'attendance_record',
                targetId: recordId,
                outcome: 'DENIED',
                isSecurityEvent: true
            });
            return res.status(403).json({ message: 'Unauthorized: You do not manage the page for this attendance record.' });
        }

        const normalizedStatus = String(status).toUpperCase();

        const updatedRes = await pool.query(
            `UPDATE event_attendance_records
             SET status = $1,
                 check_in_method = 'manual_staff',
                 checkin_time = CASE WHEN $1 = 'PRESENT' AND checkin_time IS NULL THEN NOW() ELSE checkin_time END
             WHERE attendance_id = $2
             RETURNING attendance_id AS id, status, checkin_time`,
            [normalizedStatus, recordId]
        );

        await pool.query(
            `INSERT INTO event_attendance_audits (attendance_id, actor_user_id, previous_status, new_status, source, reason)
             VALUES ($1, $2, $3, $4, 'staff', $5)`,
            [recordId, userId, oldRecord.status, normalizedStatus, reason || 'Manual correction']
        );

        return res.json({ message: 'Record updated successfully', record: updatedRes.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Correction failed.' });
    }
});

// Export Attendance CSV
router.get('/events/:eventId/export', requireStaffOrAdmin, authorizeStaffForEvent, async (req, res) => {
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

router.processQrCheckIn = processQrCheckIn;

module.exports = router;
