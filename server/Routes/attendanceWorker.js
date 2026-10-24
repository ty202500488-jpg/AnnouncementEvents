const pool = require('../db');

// Closes attendance windows whose auto-close time (close_time) has passed and
// marks everyone still NOT_MARKED as ABSENT. Runs every minute.
// Staff set the auto-close time when opening a window
// (POST /api/mypage/attendance/events/:eventId/window with { closeTime }).

const INTERVAL_MS = 60 * 1000;

const processOverdueSessions = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const overdueRes = await client.query(`
      SELECT id, event_id FROM event_attendance_sessions
      WHERE status = 'OPEN' AND close_time IS NOT NULL AND close_time <= NOW()
      FOR UPDATE SKIP LOCKED
    `);

    for (const session of overdueRes.rows) {
      await client.query(
        `UPDATE event_attendance_sessions SET status = 'CLOSED' WHERE id = $1`,
        [session.id]
      );

      await client.query(
        `UPDATE event_attendance_records SET status = 'ABSENT' WHERE event_id = $1 AND status = 'NOT_MARKED'`,
        [session.event_id]
      );

      console.log(`[Worker] Auto-closed attendance window for event ${session.event_id}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Worker] Error processing overdue attendance sessions:', err.message);
  } finally {
    client.release();
  }
};

const startAttendanceWorker = () => {
  processOverdueSessions();
  setInterval(processOverdueSessions, INTERVAL_MS);
  console.log('[Worker] Attendance auto-close worker started.');
};

module.exports = startAttendanceWorker;
