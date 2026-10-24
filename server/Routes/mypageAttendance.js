const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { authenticateToken, requireEventOwner, ownsEvent } = require('../middleware/auth');

// Mounted at /api/mypage/attendance
//
// Who can do what:
//   - Page owner (pages.created_by, Page approved): view events, open/close the
//     attendance window, show the QR code, correct records, export CSV.
//   - Registered student: check in by scanning the QR code.

const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

// The QR on screen refreshes every 30s; tokens stay valid a little longer
// so a student who scans right before a refresh is not rejected.
const QR_TOKEN_TTL_MS = 45 * 1000;

const RECORD_STATUSES = ['PRESENT', 'ABSENT', 'NOT_MARKED'];

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Escapes a value for CSV and blocks spreadsheet formula injection.
const csvCell = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str}"`;
};

// Shared roster query: one row per attendance record for an event.
const ROSTER_SQL = `
  SELECT
    ar.id,
    ar.status,
    ar.checkin_time,
    u.user_id,
    u.student_id,
    COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name
  FROM event_attendance_records ar
  JOIN event_registrations er ON ar.registration_id = er.registration_id
  JOIN users u ON er.registrant_user_id = u.user_id
  WHERE ar.event_id = $1
  ORDER BY u.last_name, u.first_name
`;

// =====================================================
// GET /events
// Events on Pages the current user owns.
// =====================================================
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.event_id AS id, e.event_title AS title, e.event_date, e.location AS venue
       FROM events e
       JOIN pages p ON e.page_id = p.page_id
       WHERE p.created_by = $1 AND LOWER(p.status) = 'approved'
       ORDER BY e.event_date DESC`,
      [req.user.id]
    );
    res.json({ events: rows });
  } catch (err) {
    console.error('[attendance] Failed to fetch events:', err);
    res.status(500).json({ message: 'Failed to fetch your events.' });
  }
});

// =====================================================
// GET /events/:eventId
// Event details, attendance window status, roster and summary.
// =====================================================
router.get('/events/:eventId', authenticateToken, requireEventOwner, async (req, res) => {
  const { eventId } = req;
  try {
    const [eventRes, sessionRes, recordsRes] = await Promise.all([
      pool.query(
        `SELECT e.*, e.event_title AS title, e.location AS venue
         FROM events e WHERE e.event_id = $1`,
        [eventId]
      ),
      pool.query('SELECT * FROM event_attendance_sessions WHERE event_id = $1', [eventId]),
      pool.query(ROSTER_SQL, [eventId])
    ]);

    const records = recordsRes.rows;
    const total = records.length;
    const count = (status) => records.filter((r) => r.status === status).length;
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    const present = count('PRESENT');
    const absent = count('ABSENT');
    const unmarked = count('NOT_MARKED');

    res.json({
      event: eventRes.rows[0],
      session: sessionRes.rows[0] || { status: 'CLOSED' },
      records,
      summary: {
        totalEligible: total,
        present,
        absent,
        unmarked,
        presentPct: pct(present),
        absentPct: pct(absent),
        unmarkedPct: pct(unmarked)
      }
    });
  } catch (err) {
    console.error('[attendance] Failed to fetch event details:', err);
    res.status(500).json({ message: 'Failed to fetch attendance details.' });
  }
});

// =====================================================
// POST /events/:eventId/window
// Body: { action: 'OPEN' | 'CLOSE', closeTime?: ISO date string }
//
// OPEN  - opens the window and creates a NOT_MARKED record for every active
//         registration. If closeTime is given, the background worker
//         (attendanceWorker.js) closes the window automatically at that time.
// CLOSE - closes the window now and marks everyone still NOT_MARKED as ABSENT.
// =====================================================
router.post('/events/:eventId/window', authenticateToken, requireEventOwner, async (req, res) => {
  const { eventId } = req;
  const action = String(req.body?.action || '').toUpperCase();

  if (action !== 'OPEN' && action !== 'CLOSE') {
    return res.status(400).json({ message: "Action must be 'OPEN' or 'CLOSE'." });
  }

  let closeTime = null;
  if (action === 'OPEN' && req.body?.closeTime) {
    closeTime = new Date(req.body.closeTime);
    if (Number.isNaN(closeTime.getTime())) {
      return res.status(400).json({ message: 'Invalid auto-close time.' });
    }
    if (closeTime <= new Date()) {
      return res.status(400).json({ message: 'Auto-close time must be in the future.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let session;

    if (action === 'OPEN') {
      const upsert = await client.query(
        `INSERT INTO event_attendance_sessions (event_id, status, open_time, close_time)
         VALUES ($1, 'OPEN', NOW(), $2)
         ON CONFLICT (event_id)
         DO UPDATE SET status = 'OPEN', open_time = NOW(), close_time = EXCLUDED.close_time
         RETURNING *`,
        [eventId, closeTime]
      );
      session = upsert.rows[0];

      await client.query(
        `INSERT INTO event_attendance_records (event_id, registration_id, status)
         SELECT $1, registration_id, 'NOT_MARKED'
         FROM event_registrations
         WHERE event_id = $1 AND LOWER(status) <> 'cancelled'
         ON CONFLICT (event_id, registration_id) DO NOTHING`,
        [eventId]
      );
    } else {
      const upd = await client.query(
        `UPDATE event_attendance_sessions
         SET status = 'CLOSED', close_time = NOW()
         WHERE event_id = $1
         RETURNING *`,
        [eventId]
      );
      session = upd.rows[0] || { status: 'CLOSED' };

      await client.query(
        `UPDATE event_attendance_records SET status = 'ABSENT'
         WHERE event_id = $1 AND status = 'NOT_MARKED'`,
        [eventId]
      );
    }

    await client.query('COMMIT');
    res.json({
      message: action === 'OPEN' ? 'Attendance window opened.' : 'Attendance window closed.',
      session
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[attendance] Failed to change attendance window:', err);
    res.status(500).json({ message: 'Failed to update the attendance window.' });
  } finally {
    client.release();
  }
});

// =====================================================
// GET /events/:eventId/qr-credential
// Issues a short-lived check-in link to display as a QR code.
// Only works while the attendance window is open.
// =====================================================
router.get('/events/:eventId/qr-credential', authenticateToken, requireEventOwner, async (req, res) => {
  const { eventId } = req;
  try {
    const sessionRes = await pool.query(
      'SELECT status FROM event_attendance_sessions WHERE event_id = $1',
      [eventId]
    );
    if (sessionRes.rows[0]?.status !== 'OPEN') {
      return res.status(409).json({ message: 'Open the attendance window first.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS);

    await pool.query(
      `INSERT INTO event_attendance_qr_tokens (event_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [eventId, hashToken(rawToken), expiresAt]
    );

    // Housekeeping: drop tokens that expired more than a day ago.
    pool.query(`DELETE FROM event_attendance_qr_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`)
      .catch((err) => console.error('[attendance] Failed to clean up old QR tokens:', err));

    res.json({
      qrCredentialUrl: `${CLIENT_URL}/student/attendance/check-in/${rawToken}`,
      expiresAt
    });
  } catch (err) {
    console.error('[attendance] Failed to generate QR token:', err);
    res.status(500).json({ message: 'Failed to generate QR code.' });
  }
});

// =====================================================
// POST /check-in
// Body: { token }
// A registered student checks in by scanning the QR code.
// =====================================================
router.post('/check-in', authenticateToken, async (req, res) => {
  const token = req.body?.token;
  const userId = req.user.id;

  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ message: 'Invalid or expired QR code.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenRes = await client.query(
      `SELECT event_id FROM event_attendance_qr_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
      [hashToken(token)]
    );
    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid or expired QR code. Please scan again.' });
    }
    const eventId = tokenRes.rows[0].event_id;

    const sessionRes = await client.query(
      `SELECT status FROM event_attendance_sessions WHERE event_id = $1`,
      [eventId]
    );
    if (sessionRes.rows[0]?.status !== 'OPEN') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'The attendance window for this event is closed.' });
    }

    const regRes = await client.query(
      `SELECT registration_id, status FROM event_registrations
       WHERE event_id = $1 AND registrant_user_id = $2`,
      [eventId, userId]
    );
    const registration = regRes.rows[0];
    if (!registration || registration.status?.toLowerCase() === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You are not registered for this event.' });
    }

    // Students who registered after the window opened may not have a record yet.
    const recordRes = await client.query(
      `INSERT INTO event_attendance_records (event_id, registration_id, status)
       VALUES ($1, $2, 'NOT_MARKED')
       ON CONFLICT (event_id, registration_id) DO UPDATE SET event_id = EXCLUDED.event_id
       RETURNING id, status`,
      [eventId, registration.registration_id]
    );
    const record = recordRes.rows[0];

    if (record.status === 'PRESENT') {
      await client.query('ROLLBACK');
      return res.status(200).json({ message: 'You are already checked in.', alreadyCheckedIn: true });
    }

    await client.query(
      `UPDATE event_attendance_records SET status = 'PRESENT', checkin_time = NOW() WHERE id = $1`,
      [record.id]
    );
    await client.query(
      `INSERT INTO event_attendance_audit_logs (record_id, previous_status, new_status, actor_id, source, reason)
       VALUES ($1, $2, 'PRESENT', $3, 'student', 'QR check-in')`,
      [record.id, record.status, userId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Attendance recorded successfully!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[attendance] Check-in failed:', err);
    res.status(500).json({ message: 'Check-in failed. Please try again.' });
  } finally {
    client.release();
  }
});

// =====================================================
// PUT /records/:recordId/correct
// Body: { status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED', reason }
// Manual correction by the Page owner. Every change is audit-logged.
// =====================================================
router.put('/records/:recordId/correct', authenticateToken, async (req, res) => {
  const recordId = Number(req.params.recordId);
  const status = String(req.body?.status || '').toUpperCase();
  const reason = String(req.body?.reason || '').trim();

  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ message: 'Invalid record ID.' });
  }
  if (!RECORD_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${RECORD_STATUSES.join(', ')}.` });
  }
  if (!reason) {
    return res.status(400).json({ message: 'A reason is required for manual corrections.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      'SELECT id, event_id, status FROM event_attendance_records WHERE id = $1 FOR UPDATE',
      [recordId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Record not found.' });
    }

    if (!(await ownsEvent(req.user.id, existing.event_id))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access denied: you do not manage this event.' });
    }

    const updatedRes = await client.query(
      `UPDATE event_attendance_records
       SET status = $1::varchar,
           checkin_time = CASE WHEN $1::varchar = 'PRESENT' THEN COALESCE(checkin_time, NOW()) ELSE NULL END
       WHERE id = $2
       RETURNING *`,
      [status, recordId]
    );

    await client.query(
      `INSERT INTO event_attendance_audit_logs (record_id, previous_status, new_status, actor_id, source, reason)
       VALUES ($1, $2, $3, $4, 'staff', $5)`,
      [recordId, existing.status, status, req.user.id, reason]
    );

    await client.query('COMMIT');
    res.json({ message: 'Record updated successfully.', record: updatedRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[attendance] Correction failed:', err);
    res.status(500).json({ message: 'Failed to update the record.' });
  } finally {
    client.release();
  }
});

// =====================================================
// GET /events/:eventId/export
// Attendance CSV download. Accepts ?token= so it works with window.open().
// =====================================================
router.get('/events/:eventId/export', authenticateToken, requireEventOwner, async (req, res) => {
  const { eventId } = req;
  try {
    const { rows } = await pool.query(ROSTER_SQL, [eventId]);

    const header = ['Student ID', 'Student Name', 'Status', 'Check-in Time'].join(',');
    const lines = rows.map((r) => [
      csvCell(r.student_id),
      csvCell(r.student_name),
      csvCell(r.status),
      csvCell(r.checkin_time ? new Date(r.checkin_time).toISOString() : '')
    ].join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_event_${eventId}.csv`);
    res.status(200).send([header, ...lines].join('\n'));
  } catch (err) {
    console.error('[attendance] CSV export failed:', err);
    res.status(500).json({ message: 'Failed to generate the attendance CSV.' });
  }
});

module.exports = router;
