const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateUser } = require('../middleware/auth');

async function getUserManagedPages(userId) {
    const pageRes = await pool.query(
        `SELECT DISTINCT p.page_id
         FROM pages p
         LEFT JOIN page_members pm ON p.page_id = pm.page_id AND pm.user_id = $1 AND LOWER(pm.status) = 'active'
         WHERE p.created_by = $1 OR pm.user_id = $1`,
        [userId]
    );
    return pageRes.rows.map(r => r.page_id);
}

// GET /api/mypage/registrations/summary
router.get('/registrations/summary', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const managedPageIds = await getUserManagedPages(user.user_id);
        if (managedPageIds.length === 0) {
            return res.status(200).json({
                total_registrations: 0,
                total_events_with_registrations: 0
            });
        }

        const result = await pool.query(
            `SELECT COUNT(er.registration_id)::int AS total_registrations,
                    COUNT(DISTINCT p.post_id)::int AS total_events_with_registrations
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             WHERE p.page_id = ANY($1::int[]) AND p.is_archived = FALSE`,
            [managedPageIds]
        );

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching registration summary:', error);
        return res.status(500).json({ message: 'Failed to retrieve registration summary.' });
    }
});

// GET /api/mypage/registrations/events
router.get('/registrations/events', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const managedPageIds = await getUserManagedPages(user.user_id);
        if (managedPageIds.length === 0) {
            return res.status(200).json({ events: [] });
        }

        const result = await pool.query(
            `SELECT p.post_id AS id,
                    p.title,
                    ed.event_date AS date,
                    ed.location,
                    ed.capacity,
                    COUNT(er.registration_id)::int AS registration_count
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             WHERE p.page_id = ANY($1::int[]) AND p.is_archived = FALSE
             GROUP BY p.post_id, p.title, ed.event_date, ed.location, ed.capacity
             ORDER BY ed.event_date DESC`,
            [managedPageIds]
        );

        return res.status(200).json({ events: result.rows });
    } catch (error) {
        console.error('Error fetching accessible events:', error);
        return res.status(500).json({ message: 'Failed to retrieve accessible events.' });
    }
});

// GET /api/mypage/registrations/events/:eventId/students
router.get('/registrations/events/:eventId/students', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const eventId = Number(req.params.eventId);
        if (!Number.isInteger(eventId)) {
            return res.status(400).json({ message: 'Invalid Event ID format.' });
        }

        const managedPageIds = await getUserManagedPages(user.user_id);
        const eventCheck = await pool.query(
            `SELECT post_id FROM posts WHERE post_id = $1 AND page_id = ANY($2::int[])`,
            [eventId, managedPageIds]
        );

        if (eventCheck.rows.length === 0 && String(user.role_name).toLowerCase() !== 'admin') {
            return res.status(403).json({ message: 'Access denied to this event.' });
        }

        const { search = '', status = 'all', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const offset = (pageNum - 1) * limitNum;

        const queryParams = [eventId];
        const whereClauses = ['er.event_post_id = $1'];

        if (status && status !== 'all') {
            queryParams.push(status);
            whereClauses.push(`LOWER(er.status) = LOWER($${queryParams.length})`);
        }

        if (search && search.trim() !== '') {
            queryParams.push(`%${search.trim()}%`);
            const idx = queryParams.length;
            whereClauses.push(
                `(u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR (u.first_name || ' ' || u.last_name) ILIKE $${idx} OR sp.student_number ILIKE $${idx} OR u.email ILIKE $${idx})`
            );
        }

        const whereSql = whereClauses.join(' AND ');

        const countRes = await pool.query(
            `SELECT COUNT(er.registration_id)::int AS total
             FROM event_registrations er
             JOIN users u ON er.registrant_user_id = u.user_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE ${whereSql}`,
            queryParams
        );
        const totalRecords = countRes.rows[0].total;

        queryParams.push(limitNum, offset);
        const dataRes = await pool.query(
            `SELECT er.registration_id AS id,
                    er.status,
                    er.registered_at,
                    u.user_id AS student_user_id,
                    COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
                    COALESCE(sp.student_number, 'N/A') AS student_id,
                    u.email,
                    COALESCE(d.department_name, 'Unassigned') AS college,
                    COALESCE(pr.program_name, 'Unassigned') AS program,
                    COALESCE(sp.year_level, 'N/A') AS year_level
             FROM event_registrations er
             JOIN users u ON er.registrant_user_id = u.user_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             LEFT JOIN programs pr ON sp.program_id = pr.program_id
             WHERE ${whereSql}
             ORDER BY er.registered_at DESC
             LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
            queryParams
        );

        return res.status(200).json({
            registrations: dataRes.rows,
            pagination: {
                totalRecords,
                currentPage: pageNum,
                totalPages: Math.max(1, Math.ceil(totalRecords / limitNum)),
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching registrants:', error);
        return res.status(500).json({ message: 'Failed to retrieve registrants list.' });
    }
});

// GET /api/mypage/registrations/events/:eventId/students/:registrationId
router.get('/registrations/events/:eventId/students/:registrationId', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const eventId = Number(req.params.eventId);
        const registrationId = Number(req.params.registrationId);

        const result = await pool.query(
            `SELECT er.registration_id AS id,
                    er.status,
                    er.registered_at,
                    p.title AS event_title,
                    ed.event_date,
                    COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
                    COALESCE(sp.student_number, 'N/A') AS student_id,
                    u.email,
                    COALESCE(d.department_name, 'Unassigned') AS college,
                    COALESCE(pr.program_name, 'Unassigned') AS program,
                    COALESCE(sp.year_level, 'N/A') AS year_level
             FROM event_registrations er
             JOIN event_details ed ON er.event_post_id = ed.post_id
             JOIN posts p ON ed.post_id = p.post_id
             JOIN users u ON er.registrant_user_id = u.user_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             LEFT JOIN programs pr ON sp.program_id = pr.program_id
             WHERE er.registration_id = $1 AND er.event_post_id = $2`,
            [registrationId, eventId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Registration details not found.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching registration detail:', error);
        return res.status(500).json({ message: 'Failed to fetch registration details.' });
    }
});

// GET /api/mypage/registrations/events/:eventId/export
router.get('/registrations/events/:eventId/export', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const eventId = Number(req.params.eventId);

        const result = await pool.query(
            `SELECT COALESCE(sp.student_number, 'N/A') AS student_id,
                    COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
                    u.email,
                    COALESCE(d.department_name, 'Unassigned') AS college,
                    COALESCE(pr.program_name, 'Unassigned') AS program,
                    COALESCE(sp.year_level, 'N/A') AS year_level,
                    p.title AS event_title,
                    er.registered_at,
                    er.status
             FROM event_registrations er
             JOIN event_details ed ON er.event_post_id = ed.post_id
             JOIN posts p ON ed.post_id = p.post_id
             JOIN users u ON er.registrant_user_id = u.user_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             LEFT JOIN programs pr ON sp.program_id = pr.program_id
             WHERE er.event_post_id = $1
             ORDER BY er.registered_at DESC`,
            [eventId]
        );

        const sanitize = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val).replace(/"/g, '""');
            if (['=', '+', '-', '@'].includes(str.charAt(0))) str = `'${str}`;
            return `"${str}"`;
        };

        const headers = ['Student ID', 'Student Name', 'Email', 'College', 'Program', 'Year Level', 'Event Title', 'Registered Date', 'Status'];
        const csvRows = [headers.join(',')];

        for (const r of result.rows) {
            csvRows.push([
                sanitize(r.student_id),
                sanitize(r.student_name),
                sanitize(r.email),
                sanitize(r.college),
                sanitize(r.program),
                sanitize(r.year_level),
                sanitize(r.event_title),
                sanitize(r.registered_at ? new Date(r.registered_at).toISOString() : ''),
                sanitize(r.status)
            ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="event_${eventId}_registrations.csv"`);
        return res.status(200).send(csvRows.join('\n'));
    } catch (error) {
        console.error('Error exporting CSV:', error);
        return res.status(500).json({ message: 'Failed to export registrations.' });
    }
});

module.exports = router;
