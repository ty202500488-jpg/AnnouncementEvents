const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireEventOwner, getOwnedPageIds } = require('../middleware/auth');

// Mounted at /api/mypage
// Lets a Page owner (pages.created_by, Page approved) see who registered
// for their events.
//
// Field names in the responses (title, college, program, registered_at, ...)
// match what client/src/pages/Staff/MyPageDashboard/MyPageRegistration.jsx expects.

// Escapes a value for CSV and blocks spreadsheet formula injection.
const csvCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return `"${str}"`;
};

// Columns and joins shared by the list, detail and export queries.
const REGISTRANT_COLUMNS = `
    er.registration_id AS id,
    er.status,
    er.registered_at,
    u.user_id AS student_user_id,
    COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
    u.student_id,
    u.email,
    d.department_name AS college,
    pr.program_name AS program,
    u.year_level
`;

const REGISTRANT_JOINS = `
    FROM event_registrations er
    JOIN users u ON er.registrant_user_id = u.user_id
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN programs pr ON u.program_id = pr.program_id
`;

// =====================================================
// GET /api/mypage/registrations/summary
// Registration totals across all of the user's Pages.
// =====================================================
router.get('/registrations/summary', authenticateToken, async (req, res) => {
    try {
        const pageIds = await getOwnedPageIds(req.user.id);
        if (pageIds.length === 0) {
            return res.status(200).json({ total_registrations: 0, total_events_with_registrations: 0 });
        }

        const result = await pool.query(
            `SELECT
                 COUNT(er.registration_id)::int AS total_registrations,
                 COUNT(DISTINCT er.event_id)::int AS total_events_with_registrations
             FROM events e
             JOIN event_registrations er ON e.event_id = er.event_id
             WHERE e.page_id = ANY($1::int[]) AND LOWER(er.status) <> 'cancelled'`,
            [pageIds]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[registrations] Summary failed:', err);
        res.status(500).json({ message: 'Failed to retrieve registration summary.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events
// The user's events with their (non-cancelled) registration counts.
// =====================================================
router.get('/registrations/events', authenticateToken, async (req, res) => {
    try {
        const pageIds = await getOwnedPageIds(req.user.id);
        if (pageIds.length === 0) {
            return res.status(200).json({ events: [] });
        }

        const result = await pool.query(
            `SELECT
                 e.event_id AS id,
                 e.event_title AS title,
                 e.event_date AS date,
                 COUNT(er.registration_id) FILTER (WHERE LOWER(er.status) <> 'cancelled')::int AS registration_count
             FROM events e
             LEFT JOIN event_registrations er ON e.event_id = er.event_id
             WHERE e.page_id = ANY($1::int[])
             GROUP BY e.event_id, e.event_title, e.event_date
             ORDER BY e.event_date DESC`,
            [pageIds]
        );
        res.status(200).json({ events: result.rows });
    } catch (err) {
        console.error('[registrations] Event list failed:', err);
        res.status(500).json({ message: 'Failed to retrieve your events.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events/:eventId/students
// Query: search, status ('all' | 'registered' | 'cancelled' | ...), page, limit
// =====================================================
router.get('/registrations/events/:eventId/students', authenticateToken, requireEventOwner, async (req, res) => {
    try {
        const { search = '', status = 'all', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const offset = (pageNum - 1) * limitNum;

        const params = [req.eventId];
        const where = ['er.event_id = $1'];

        if (typeof status === 'string' && status.toLowerCase() !== 'all') {
            params.push(status.toLowerCase());
            where.push(`LOWER(er.status) = $${params.length}`);
        }

        if (typeof search === 'string' && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            const i = params.length;
            where.push(`(
                u.first_name ILIKE $${i} OR
                u.last_name ILIKE $${i} OR
                (u.first_name || ' ' || u.last_name) ILIKE $${i} OR
                u.student_id ILIKE $${i} OR
                u.email ILIKE $${i}
            )`);
        }

        const whereSql = where.join(' AND ');

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total ${REGISTRANT_JOINS} WHERE ${whereSql}`,
            params
        );
        const totalRecords = countRes.rows[0].total;

        const dataRes = await pool.query(
            `SELECT ${REGISTRANT_COLUMNS}
             ${REGISTRANT_JOINS}
             WHERE ${whereSql}
             ORDER BY er.registered_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limitNum, offset]
        );

        res.status(200).json({
            registrations: dataRes.rows,
            pagination: {
                totalRecords,
                currentPage: pageNum,
                totalPages: Math.max(1, Math.ceil(totalRecords / limitNum)),
                limit: limitNum
            }
        });
    } catch (err) {
        console.error('[registrations] Registrant list failed:', err);
        res.status(500).json({ message: 'Failed to retrieve registrants.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events/:eventId/students/:registrationId
// Details for one registration.
// =====================================================
router.get('/registrations/events/:eventId/students/:registrationId', authenticateToken, requireEventOwner, async (req, res) => {
    const registrationId = Number(req.params.registrationId);
    if (!Number.isSafeInteger(registrationId) || registrationId <= 0) {
        return res.status(400).json({ message: 'Invalid registration ID.' });
    }

    try {
        const result = await pool.query(
            `SELECT ${REGISTRANT_COLUMNS},
                    e.event_title,
                    e.event_date
             ${REGISTRANT_JOINS}
             JOIN events e ON er.event_id = e.event_id
             WHERE er.registration_id = $1 AND er.event_id = $2`,
            [registrationId, req.eventId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Registration not found.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[registrations] Registration detail failed:', err);
        res.status(500).json({ message: 'Failed to fetch registration details.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events/:eventId/export
// CSV of every registration for the event.
// =====================================================
router.get('/registrations/events/:eventId/export', authenticateToken, requireEventOwner, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${REGISTRANT_COLUMNS},
                    e.event_title
             ${REGISTRANT_JOINS}
             JOIN events e ON er.event_id = e.event_id
             WHERE er.event_id = $1
             ORDER BY er.registered_at DESC`,
            [req.eventId]
        );

        const headers = ['Student ID', 'Student Name', 'Email', 'College', 'Program', 'Year Level', 'Event Title', 'Registered Date', 'Status'];
        const lines = result.rows.map((r) => [
            csvCell(r.student_id),
            csvCell(r.student_name),
            csvCell(r.email),
            csvCell(r.college),
            csvCell(r.program),
            csvCell(r.year_level),
            csvCell(r.event_title),
            csvCell(r.registered_at ? new Date(r.registered_at).toISOString() : ''),
            csvCell(r.status)
        ].join(','));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=event_${req.eventId}_registrations.csv`);
        res.status(200).send([headers.join(','), ...lines].join('\n'));
    } catch (err) {
        console.error('[registrations] CSV export failed:', err);
        res.status(500).json({ message: 'Failed to generate the registrations CSV.' });
    }
});

module.exports = router;
