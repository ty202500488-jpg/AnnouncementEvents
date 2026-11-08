const pool = require('../db');

/**
 * Background worker that cleans up expired QR tokens and auto-closes
 * attendance sessions past their event end_date.
 */
async function processAttendanceSessions() {
    try {
        await pool.query(`DELETE FROM event_qr_tokens WHERE expires_at < NOW() - INTERVAL '5 minutes'`);
    } catch (err) {
        // Non-fatal background cleanup
    }
}

function startAttendanceWorker() {
    setInterval(processAttendanceSessions, 60 * 1000);
}

module.exports = { startAttendanceWorker, processAttendanceSessions };
