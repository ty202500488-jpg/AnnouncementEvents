const pool = require('../db');
const { ensureAttendanceSchema } = require('../utils/attendanceHelper');
const { notifyAttendanceWindowChange } = require('../utils/notificationService');

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

async function notifySessionTransition(db, { eventId, actorUserId, action, notifyFn }) {
    if (typeof notifyFn !== 'function') return;
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
            await notifyFn(db, {
                eventId,
                title: evRow.title,
                pageId: evRow.page_id,
                actorUserId: actorUserId || null,
                action,
                summary: {
                    present: evRow.present || 0,
                    absent: evRow.absent || 0,
                    totalEligible: evRow.total_eligible || 0
                }
            });
        }
    } catch (notifyErr) {
        console.warn('Attendance worker notification warning:', notifyErr.message);
    }
}

/**
 * Background worker that auto-activates due scheduled attendance sessions,
 * auto-closes expired scheduled sessions (marking unmarked registrants absent),
 * and cleans up legacy expired QR tokens.
 */
async function processAttendanceSessions(poolArg = pool, notifyFn = notifyAttendanceWindowChange) {
    try {
        await ensureAttendanceSchema(poolArg);

        // Step A: Auto-activate due scheduled sessions
        const dueToOpenRes = await poolArg.query(
            `SELECT session_id, event_post_id, scheduled_open_time, scheduled_close_time, opened_by
             FROM event_attendance_sessions
             WHERE status = 'CLOSED'
               AND scheduled_open_time IS NOT NULL
               AND scheduled_open_time <= NOW()
               AND (scheduled_close_time IS NULL OR scheduled_close_time > NOW())
               AND (closed_manually_at IS NULL OR closed_manually_at < scheduled_open_time)`
        );

        for (const session of dueToOpenRes.rows) {
            await poolArg.query(
                `UPDATE event_attendance_sessions
                 SET status = 'OPEN',
                     open_time = scheduled_open_time,
                     updated_at = NOW()
                 WHERE event_post_id = $1`,
                [session.event_post_id]
            );

            await ensureConfirmedRegistrationRecords(poolArg, session.event_post_id);

            await poolArg.query(
                `UPDATE event_attendance_records ar
                 SET status = 'NOT_MARKED',
                     updated_at = NOW()
                 FROM event_registrations er
                 WHERE ar.registration_id = er.registration_id
                   AND er.event_post_id = $1
                   AND ar.status = 'ABSENT'
                   AND ar.check_in_method IS DISTINCT FROM 'manual_staff'`,
                [session.event_post_id]
            );

            await notifySessionTransition(poolArg, {
                eventId: session.event_post_id,
                actorUserId: session.opened_by,
                action: 'OPEN',
                notifyFn
            });
        }

        // Step B: Auto-close expired scheduled sessions
        const dueToCloseRes = await poolArg.query(
            `SELECT session_id, event_post_id, scheduled_open_time, scheduled_close_time, opened_by
             FROM event_attendance_sessions
             WHERE scheduled_close_time IS NOT NULL
               AND scheduled_close_time <= NOW()
               AND (
                   status = 'OPEN'
                   OR (
                       status = 'CLOSED'
                       AND (close_time IS NULL OR close_time < scheduled_close_time)
                       AND (closed_manually_at IS NULL OR closed_manually_at < COALESCE(scheduled_open_time, scheduled_close_time))
                   )
               )`
        );

        for (const session of dueToCloseRes.rows) {
            await poolArg.query(
                `UPDATE event_attendance_sessions
                 SET status = 'CLOSED',
                     close_time = scheduled_close_time,
                     updated_at = NOW()
                 WHERE event_post_id = $1`,
                [session.event_post_id]
            );

            await ensureConfirmedRegistrationRecords(poolArg, session.event_post_id);

            await poolArg.query(
                `UPDATE event_attendance_records ar
                 SET status = 'ABSENT',
                     check_in_method = 'qr_scan',
                     updated_at = NOW()
                 FROM event_registrations er
                 WHERE ar.registration_id = er.registration_id
                   AND er.event_post_id = $1
                   AND ar.status = 'NOT_MARKED'
                   AND ar.check_in_method IS DISTINCT FROM 'manual_staff'`,
                [session.event_post_id]
            );

            await notifySessionTransition(poolArg, {
                eventId: session.event_post_id,
                actorUserId: session.opened_by,
                action: 'CLOSE',
                notifyFn
            });
        }

        // Step C: Clean up legacy 30-second QR tokens
        await poolArg.query(`DELETE FROM event_qr_tokens WHERE expires_at < NOW() - INTERVAL '5 minutes'`);
    } catch (err) {
        // Non-fatal background cleanup
        console.warn('Attendance worker warning:', err.message);
    }
}

function startAttendanceWorker() {
    setInterval(processAttendanceSessions, 30 * 1000);
}

module.exports = { startAttendanceWorker, processAttendanceSessions };
