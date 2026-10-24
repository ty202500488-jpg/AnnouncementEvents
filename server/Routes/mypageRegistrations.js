const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// =====================================================
// AUTHENTICATION & AUTHORIZATION HELPER
// =====================================================
async function authenticateUser(req, res) {
    let token = null;

    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } 
    // Fallback to URL Query Parameter (useful for window.open CSV exports)
    else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        res.status(401).json({ message: 'Authentication required. Please log in.' });
        return null;
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    try {
        const decoded = jwt.verify(token, jwtSecret);
        const userId = Number(decoded.userId ?? decoded.id ?? decoded.user_id);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            res.status(401).json({ message: 'Invalid token user ID.' });
            return null;
        }

        const result = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            res.status(401).json({ message: 'User not found in database.' });
            return null;
        }

        return userId;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            console.error('Authentication error: Token expired at', error.expiredAt);
            res.status(401).json({ message: 'Session expired. Please log in again.', expired: true });
        } else {
            console.error('Authentication error:', error.message);
            res.status(401).json({ message: 'Invalid or expired token.' });
        }
        return null;
    }
}

// Helper to check if user owns/manages a page
async function getUserManagedPages(userId) {
    const pageRes = await pool.query(
        `SELECT page_id FROM pages WHERE created_by = $1 AND LOWER(status) = 'approved'`,
        [userId]
    );
    return pageRes.rows.map(r => r.page_id);
}

// =====================================================
// GET /api/mypage/registrations/summary
// Summary registration totals for current staff
// =====================================================
router.get('/registrations/summary', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const managedPageIds = await getUserManagedPages(userId);

        if (managedPageIds.length === 0) {
            return res.status(200).json({
                total_registrations: 0,
                total_events_with_registrations: 0
            });
        }

        const query = `
            SELECT 
                COUNT(er.registration_id)::int AS total_registrations,
                COUNT(DISTINCT e.event_id)::int AS total_events_with_registrations
            FROM events e
            LEFT JOIN event_registrations er ON e.event_id = er.event_id
            WHERE e.page_id = ANY($1::int[]);
        `;

        const result = await pool.query(query, [managedPageIds]);
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching registration summary:', error);
        return res.status(500).json({ message: 'Failed to retrieve registration summary.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events
// Fetch events owned by current staff page with counts
// =====================================================
router.get('/registrations/events', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const managedPageIds = await getUserManagedPages(userId);

        if (managedPageIds.length === 0) {
            return res.status(200).json({ events: [] });
        }

        const query = `
            SELECT 
                e.event_id AS id,
                e.title,
                e.event_date AS date,
                COUNT(er.registration_id)::int AS registration_count
            FROM events e
            LEFT JOIN event_registrations er ON e.event_id = er.event_id
            WHERE e.page_id = ANY($1::int[])
            GROUP BY e.event_id, e.title, e.event_date
            ORDER BY e.event_date DESC;
        `;

        const result = await pool.query(query, [managedPageIds]);
        return res.status(200).json({ events: result.rows });
    } catch (error) {
        console.error('Error fetching accessible events:', error);
        return res.status(500).json({ message: 'Failed to retrieve accessible events.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events/:eventId/students
// Search, Filter & Paginate registrants for an event
// =====================================================
router.get('/registrations/events/:eventId/students', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const eventId = Number(req.params.eventId);
        if (!Number.isInteger(eventId)) {
            return res.status(400).json({ message: 'Invalid Event ID format.' });
        }

        // Authorization check: Does event belong to user's page?
        const managedPageIds = await getUserManagedPages(userId);
        const eventCheck = await pool.query(
            `SELECT event_id FROM events WHERE event_id = $1 AND page_id = ANY($2::int[])`,
            [eventId, managedPageIds]
        );

        if (eventCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this event.' });
        }

        // Filter & Search Params
        const { search = '', status = 'all', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const offset = (pageNum - 1) * limitNum;

        const queryParams = [eventId];
        const whereClauses = ['er.event_id = $1'];

        if (status && status !== 'all') {
            queryParams.push(status);
            whereClauses.push(`er.status = $${queryParams.length}`);
        }

        if (search && search.trim() !== '') {
            queryParams.push(`%${search.trim()}%`);
            const searchIdx = queryParams.length;
            whereClauses.push(
                `(u.first_name ILIKE $${searchIdx} OR u.last_name ILIKE $${searchIdx} OR (u.first_name || ' ' || u.last_name) ILIKE $${searchIdx} OR u.student_id ILIKE $${searchIdx} OR u.email ILIKE $${searchIdx})`
            );
        }

        const whereSql = whereClauses.join(' AND ');

        // Total count
        const countQuery = `
            SELECT COUNT(er.registration_id)::int AS total
            FROM event_registrations er
            JOIN users u ON er.user_id = u.user_id
            WHERE ${whereSql};
        `;
        const countRes = await pool.query(countQuery, queryParams);
        const totalRecords = countRes.rows[0].total;

        // Paginated Data
        queryParams.push(limitNum, offset);
        const dataQuery = `
            SELECT 
                er.registration_id AS id,
                er.status,
                er.created_at AS registered_at,
                u.user_id AS student_user_id,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
                u.student_id,
                u.email,
                u.college,
                u.program,
                u.year_level
            FROM event_registrations er
            JOIN users u ON er.user_id = u.user_id
            WHERE ${whereSql}
            ORDER BY er.created_at DESC
            LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
        `;

        const dataRes = await pool.query(dataQuery, queryParams);

        return res.status(200).json({
            registrations: dataRes.rows,
            pagination: {
                totalRecords,
                currentPage: pageNum,
                totalPages: Math.ceil(totalRecords / limitNum),
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching registrants:', error);
        return res.status(500).json({ message: 'Failed to retrieve registrants list.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events/:eventId/students/:registrationId
// Registration details view
// =====================================================
router.get('/registrations/events/:eventId/students/:registrationId', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const eventId = Number(req.params.eventId);
        const registrationId = Number(req.params.registrationId);

        const managedPageIds = await getUserManagedPages(userId);
        const query = `
            SELECT 
                er.registration_id AS id,
                er.status,
                er.created_at AS registered_at,
                e.title AS event_title,
                e.event_date,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
                u.student_id,
                u.email,
                u.college,
                u.program,
                u.year_level
            FROM event_registrations er
            JOIN events e ON er.event_id = e.event_id
            JOIN users u ON er.user_id = u.user_id
            WHERE er.registration_id = $1 AND er.event_id = $2 AND e.page_id = ANY($3::int[]);
        `;

        const result = await pool.query(query, [registrationId, eventId, managedPageIds]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Registration details not found or access denied.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching registration detail:', error);
        return res.status(500).json({ message: 'Failed to fetch registration details.' });
    }
});

// =====================================================
// GET /api/mypage/registrations/events/:eventId/export
// Export CSV with sanitization
// =====================================================
router.get('/registrations/events/:eventId/export', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const eventId = Number(req.params.eventId);
        const managedPageIds = await getUserManagedPages(userId);

        const query = `
            SELECT 
                u.student_id,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS student_name,
                u.email,
                u.college,
                u.program,
                u.year_level,
                e.title AS event_title,
                er.created_at AS registered_at,
                er.status
            FROM event_registrations er
            JOIN events e ON er.event_id = e.event_id
            JOIN users u ON er.user_id = u.user_id
            WHERE er.event_id = $1 AND e.page_id = ANY($2::int[])
            ORDER BY er.created_at DESC;
        `;

        const result = await pool.query(query, [eventId, managedPageIds]);

        const sanitizeCSVCell = (str) => {
            if (str === null || str === undefined) return '""';
            let cleanStr = String(str).replace(/"/g, '""');
            if (/^[=+\-@\t\r]/.test(cleanStr)) {
                cleanStr = "'" + cleanStr;
            }
            return `"${cleanStr}"`;
        };

        const headers = ['Student ID', 'Student Name', 'Email', 'College', 'Program', 'Year Level', 'Event Title', 'Registered Date', 'Status'];
        const rows = result.rows.map(r => [
            sanitizeCSVCell(r.student_id),
            sanitizeCSVCell(r.student_name),
            sanitizeCSVCell(r.email),
            sanitizeCSVCell(r.college),
            sanitizeCSVCell(r.program),
            sanitizeCSVCell(r.year_level),
            sanitizeCSVCell(r.event_title),
            sanitizeCSVCell(r.registered_at ? new Date(r.registered_at).toISOString() : ''),
            sanitizeCSVCell(r.status)
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=event_${eventId}_registrations.csv`);
        return res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        return res.status(500).json({ message: 'Failed to generate CSV export.' });
    }
});

module.exports = router;