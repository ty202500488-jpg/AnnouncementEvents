const pool = require('../db');

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

      console.log(`[Worker] Closed overdue attendance session for Event ID: ${session.event_id}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Worker] Error processing overdue attendance sessions:', err);
  } finally {
    client.release();
  }
};

const startAttendanceWorker = () => {
  setInterval(processOverdueSessions, 60 * 1000);
  console.log('[Worker] Attendance automated closing worker started.');
};

module.exports = startAttendanceWorker;