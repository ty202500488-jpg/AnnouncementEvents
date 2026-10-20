const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

router.use(async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(
            authorization.slice(7).trim(),
            process.env.JWT_SECRET || 'fallback_secret'
        );
    } catch {
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }

    const userId = Number(decoded.userId ?? decoded.id ?? decoded.user_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({ message: 'Token does not contain a valid user ID.' });
    }

    try {
        const result = await pool.query(
            `SELECT u.user_id, u.role_id
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id = $1
               AND LOWER(u.status) = 'active'
               AND LOWER(r.role_name) IN ('admin', 'administrator', 'system administrator')`,
            [userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ message: 'Administrator access is required.' });
        }

        req.adminUser = result.rows[0];
        return next();
    } catch (error) {
        console.error('Admin authentication error:', error);
        return res.status(500).json({ message: 'Unable to verify administrator access.' });
    }
});

const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

router.get('/profile', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id AS id, first_name AS "firstName",
                    last_name AS "lastName", email
             FROM users WHERE user_id = $1`,
            [req.adminUser.user_id]
        );
        return res.json({ profile: result.rows[0] });
    } catch (error) {
        console.error('Admin profile query failed:', error);
        return res.status(500).json({ message: 'Unable to load administrator profile.' });
    }
});

router.patch('/profile', async (req, res) => {
    const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : '';
    if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50) {
        return res.status(400).json({ message: 'First and last names of 1 to 50 characters are required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE users SET first_name = $2, last_name = $3
             WHERE user_id = $1
             RETURNING user_id AS id, first_name AS "firstName",
                       last_name AS "lastName", email`,
            [req.adminUser.user_id, firstName, lastName]
        );
        return res.json({ profile: result.rows[0] });
    } catch (error) {
        console.error('Admin profile update failed:', error);
        return res.status(500).json({ message: 'Unable to update administrator profile.' });
    }
});

router.get('/overview', async (_req, res) => {
    try {
        const [users, announcements, events, requests, recent, activity] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE LOWER(status) = 'active'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM announcements WHERE LOWER(status) = 'published'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM events WHERE event_date >= CURRENT_TIMESTAMP AND LOWER(status) <> 'cancelled'`),
            pool.query(`SELECT COUNT(*)::int AS count FROM pages WHERE LOWER(status) = 'pending'`),
            pool.query(
                `SELECT * FROM (
                    SELECT 'Announcement' AS type, announcement_id AS id, title,
                           status, COALESCE(published_at, created_at) AS date,
                           p.page_name AS page
                    FROM announcements a
                    LEFT JOIN pages p ON p.page_id = a.page_id
                    UNION ALL
                    SELECT 'Event' AS type, event_id AS id, event_title AS title,
                           status, event_date AS date, p.page_name AS page
                    FROM events e
                    LEFT JOIN pages p ON p.page_id = e.page_id
                ) content
                ORDER BY date DESC NULLS LAST
                LIMIT 8`
            ),
            pool.query(
                `SELECT TO_CHAR(months.month, 'YYYY-MM') AS month,
                        COUNT(content.created_at)::int AS count
                 FROM generate_series(
                    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
                    DATE_TRUNC('month', CURRENT_DATE),
                    INTERVAL '1 month'
                 ) AS months(month)
                 LEFT JOIN (
                    SELECT created_at FROM announcements
                    UNION ALL
                    SELECT created_at FROM events
                 ) content ON DATE_TRUNC('month', content.created_at) = months.month
                 GROUP BY months.month
                 ORDER BY months.month`
            ),
        ]);

        return res.json({
            counts: {
                activeUsers: users.rows[0].count,
                publishedAnnouncements: announcements.rows[0].count,
                upcomingEvents: events.rows[0].count,
                pendingRequests: requests.rows[0].count,
            },
            recentContent: recent.rows,
            monthlyActivity: activity.rows,
        });
    } catch (error) {
        console.error('Admin overview query failed:', error);
        return res.status(500).json({ message: 'Unable to load dashboard data.' });
    }
});

router.get('/users', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.user_id AS id,
                    CONCAT_WS(' ', u.first_name, u.last_name) AS name,
                    u.email,
                    r.role_name AS role,
                    u.status,
                    COALESCE(
                        ARRAY_AGG(DISTINCT p.page_name)
                            FILTER (WHERE p.page_name IS NOT NULL AND LOWER(ps.status) = 'active'),
                        ARRAY[]::text[]
                    ) AS managed_pages
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             LEFT JOIN page_staff ps ON ps.user_id = u.user_id
             LEFT JOIN pages p ON p.page_id = ps.page_id
             GROUP BY u.user_id, r.role_name
             ORDER BY r.role_name, u.last_name, u.first_name`
        );

        return res.json({
            users: result.rows.map((user) => ({
                id: user.id,
                initials: user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join(''),
                name: user.name,
                email: user.email,
                role: ['admin', 'administrator', 'system administrator'].includes(user.role.toLowerCase())
                    ? 'Administrator'
                    : user.role.toLowerCase() === 'staff'
                        ? 'Staff'
                        : user.role.toLowerCase() === 'student'
                            ? 'Student'
                            : user.role,
                active: user.status.toLowerCase() === 'active',
                managedPages: user.managed_pages,
            })),
        });
    } catch (error) {
        console.error('Admin user query failed:', error);
        return res.status(500).json({ message: 'Unable to load users.' });
    }
});

router.patch('/users/:id/status', async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId || typeof req.body.active !== 'boolean') {
        return res.status(400).json({ message: 'A valid user ID and active state are required.' });
    }
    if (userId === req.adminUser.user_id) {
        return res.status(403).json({ message: 'You cannot change your own administrator status.' });
    }

    try {
        const result = await pool.query(
            `UPDATE users u
             SET status = CASE WHEN $2 THEN 'Active' ELSE 'Inactive' END
             FROM roles r
             WHERE u.user_id = $1
               AND u.role_id = r.role_id
               AND LOWER(r.role_name) NOT IN ('admin', 'administrator', 'system administrator')
             RETURNING u.user_id`,
            [userId, req.body.active]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User was not found or is not editable.' });
        }
        return res.json({ message: 'User status updated.' });
    } catch (error) {
        console.error('Admin user status update failed:', error);
        return res.status(500).json({ message: 'Unable to update user status.' });
    }
});

router.patch('/users/:id/role', async (req, res) => {
    const userId = parseId(req.params.id);
    const desiredRole = typeof req.body.role === 'string' ? req.body.role.trim().toLowerCase() : '';
    if (!userId || !['student', 'staff'].includes(desiredRole)) {
        return res.status(400).json({ message: 'Choose a valid student or staff role.' });
    }
    if (userId === req.adminUser.user_id) {
        return res.status(403).json({ message: 'You cannot change your own administrator role.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            `UPDATE users u
             SET role_id = r.role_id
             FROM roles r
             WHERE u.user_id = $1
               AND LOWER(r.role_name) = $2
               AND NOT EXISTS (
                    SELECT 1 FROM roles current_role
                    WHERE current_role.role_id = u.role_id
                      AND LOWER(current_role.role_name) IN ('admin', 'administrator', 'system administrator')
               )
             RETURNING u.user_id`,
            [userId, desiredRole]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User or requested role was not found, or the user is not editable.' });
        }

        if (desiredRole === 'student') {
            await client.query(
                `UPDATE page_staff SET status = 'Inactive' WHERE user_id = $1 AND LOWER(status) = 'active'`,
                [userId]
            );
        }

        await client.query('COMMIT');
        return res.json({ message: 'User role updated.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin user role update failed:', error);
        return res.status(500).json({ message: 'Unable to update user role.' });
    } finally {
        client.release();
    }
});

router.get('/page-options', async (_req, res) => {
    try {
        const [departments, organizations] = await Promise.all([
            pool.query(
                `SELECT department_id AS id, department_name AS name, department_code AS code
                 FROM departments WHERE LOWER(status) = 'active' ORDER BY department_name`
            ),
            pool.query(
                `SELECT organization_id AS id, organization_name AS name
                 FROM organizations WHERE LOWER(status) = 'active' ORDER BY organization_name`
            ),
        ]);
        return res.json({ departments: departments.rows, organizations: organizations.rows });
    } catch (error) {
        console.error('Admin page options query failed:', error);
        return res.status(500).json({ message: 'Unable to load department and organization options.' });
    }
});

router.get('/pages', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.page_id AS id,
                    p.page_name AS name,
                    COALESCE(d.department_name, o.organization_name, 'Official page') AS dept,
                    p.status,
                    COUNT(DISTINCT pf.follow_id)::int AS followers,
                    COALESCE(
                        ARRAY_AGG(DISTINCT CONCAT_WS(' ', u.first_name, u.last_name))
                            FILTER (WHERE u.user_id IS NOT NULL AND LOWER(ps.status) = 'active'),
                        ARRAY[]::text[]
                    ) AS managers
             FROM pages p
             LEFT JOIN departments d ON d.department_id = p.department_id
             LEFT JOIN organizations o ON o.organization_id = p.organization_id
             LEFT JOIN page_follows pf ON pf.page_id = p.page_id
             LEFT JOIN page_staff ps ON ps.page_id = p.page_id
             LEFT JOIN users u ON u.user_id = ps.user_id
             WHERE LOWER(p.status) IN ('approved', 'inactive')
             GROUP BY p.page_id, d.department_name, o.organization_name
             ORDER BY p.page_name`
        );
        return res.json({
            pages: result.rows.map((page) => ({
                id: page.id,
                code: page.name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0].toUpperCase()).join(''),
                name: page.name,
                dept: page.dept,
                followers: page.followers,
                active: page.status.toLowerCase() === 'approved',
                managers: page.managers,
            })),
        });
    } catch (error) {
        console.error('Admin page query failed:', error);
        return res.status(500).json({ message: 'Unable to load pages.' });
    }
});

router.post('/pages', async (req, res) => {
    const { pageName, pageDescription, ownerType } = req.body;
    const ownerId = parseId(req.body.ownerId);
    if (typeof pageName !== 'string' || !pageName.trim() || pageName.trim().length > 150) {
        return res.status(400).json({ message: 'A page name of 1 to 150 characters is required.' });
    }
    if (!ownerId || !['department', 'organization'].includes(ownerType)) {
        return res.status(400).json({ message: 'Choose an active department or organization.' });
    }
    if (pageDescription !== undefined && typeof pageDescription !== 'string') {
        return res.status(400).json({ message: 'Page description must be text.' });
    }

    try {
        const ownerTable = ownerType === 'department' ? 'departments' : 'organizations';
        const ownerColumn = ownerType === 'department' ? 'department_id' : 'organization_id';
        const ownerExists = await pool.query(
            `SELECT ${ownerColumn} FROM ${ownerTable} WHERE ${ownerColumn} = $1 AND LOWER(status) = 'active'`,
            [ownerId]
        );
        if (ownerExists.rowCount === 0) {
            return res.status(400).json({ message: 'The selected owner is not active.' });
        }

        const result = await pool.query(
            `INSERT INTO pages (
                page_name, page_description, department_id, organization_id, created_by, status
             )
             VALUES ($1, $2, $3, $4, $5, 'Approved')
             RETURNING page_id AS id, page_name AS name, status`,
            [
                pageName.trim(),
                pageDescription?.trim() || '',
                ownerType === 'department' ? ownerId : null,
                ownerType === 'organization' ? ownerId : null,
                req.adminUser.user_id,
            ]
        );
        return res.status(201).json({ page: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A page already exists for that department or organization.' });
        }
        console.error('Admin page creation failed:', error);
        return res.status(500).json({ message: 'Unable to create page.' });
    }
});

router.patch('/pages/:id/status', async (req, res) => {
    const pageId = parseId(req.params.id);
    if (!pageId || typeof req.body.active !== 'boolean') {
        return res.status(400).json({ message: 'A valid page ID and active state are required.' });
    }
    try {
        const result = await pool.query(
            `UPDATE pages
             SET status = CASE WHEN $2 THEN 'Approved' ELSE 'Inactive' END
             WHERE page_id = $1 AND LOWER(status) IN ('approved', 'inactive')
             RETURNING page_id`,
            [pageId, req.body.active]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Page was not found.' });
        }
        return res.json({ message: 'Page status updated.' });
    } catch (error) {
        console.error('Admin page status update failed:', error);
        return res.status(500).json({ message: 'Unable to update page status.' });
    }
});

router.delete('/pages/:id', async (req, res) => {
    const pageId = parseId(req.params.id);
    if (!pageId) {
        return res.status(400).json({ message: 'A valid page ID is required.' });
    }
    try {
        const result = await pool.query(
            `UPDATE pages SET status = 'Inactive'
             WHERE page_id = $1 AND LOWER(status) IN ('approved', 'inactive')
             RETURNING page_id`,
            [pageId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Page was not found.' });
        }
        return res.json({ message: 'Page deactivated.' });
    } catch (error) {
        console.error('Admin page deactivation failed:', error);
        return res.status(500).json({ message: 'Unable to deactivate page.' });
    }
});

router.get('/requests', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.page_id AS id,
                    p.page_name AS name,
                    p.created_at AS requested_at,
                    COALESCE(d.department_name, o.organization_name, 'Office') AS office,
                    COALESCE(d.department_code, o.organization_name, 'Page request') AS unit,
                    u.user_id AS requester_id,
                    CONCAT_WS(' ', u.first_name, u.last_name) AS requester_name,
                    u.email AS requester_email
             FROM pages p
             JOIN users u ON u.user_id = p.created_by
             LEFT JOIN departments d ON d.department_id = p.department_id
             LEFT JOIN organizations o ON o.organization_id = p.organization_id
             WHERE LOWER(p.status) = 'pending'
             ORDER BY p.created_at DESC`
        );
        return res.json({
            requests: result.rows.map((request) => ({
                id: request.id,
                name: request.name,
                office: request.office,
                unit: request.unit,
                requestedOn: new Date(request.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                requester: {
                    id: request.requester_id,
                    name: request.requester_name,
                    email: request.requester_email,
                },
            })),
        });
    } catch (error) {
        console.error('Admin page requests query failed:', error);
        return res.status(500).json({ message: 'Unable to load page requests.' });
    }
});

router.post('/requests/:id/review', async (req, res) => {
    const pageId = parseId(req.params.id);
    const decision = typeof req.body.decision === 'string' ? req.body.decision.toLowerCase() : '';
    if (!pageId || !['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ message: 'A valid request ID and review decision are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pending = await client.query(
            `SELECT page_id, created_by FROM pages WHERE page_id = $1 AND LOWER(status) = 'pending' FOR UPDATE`,
            [pageId]
        );
        if (pending.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Pending page request was not found.' });
        }

        await client.query(
            `UPDATE pages SET status = $2 WHERE page_id = $1`,
            [pageId, decision === 'approved' ? 'Approved' : 'Rejected']
        );
        await client.query(
            `INSERT INTO page_reviews (page_id, reviewed_by, decision)
             VALUES ($1, $2, $3)`,
            [pageId, req.adminUser.user_id, decision === 'approved' ? 'Approved' : 'Rejected']
        );

        if (decision === 'approved') {
            const staffRole = await client.query(
                `SELECT role_id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1`
            );
            if (staffRole.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(500).json({ message: 'Staff role is not configured in the database.' });
            }
            await client.query(
                `UPDATE users SET role_id = $2
                 WHERE user_id = $1
                   AND role_id <> (SELECT role_id FROM roles WHERE LOWER(role_name) IN ('admin', 'administrator', 'system administrator') LIMIT 1)`,
                [pending.rows[0].created_by, staffRole.rows[0].role_id]
            );
            await client.query(
                `INSERT INTO page_staff (page_id, user_id, role_on_page, assigned_by, status)
                 VALUES ($1, $2, 'Admin', $3, 'Active')
                 ON CONFLICT (page_id, user_id)
                 DO UPDATE SET status = 'Active', role_on_page = 'Admin', assigned_by = EXCLUDED.assigned_by`,
                [pageId, pending.rows[0].created_by, req.adminUser.user_id]
            );
        }

        await client.query('COMMIT');
        return res.json({ message: `Page request ${decision}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin page request review failed:', error);
        return res.status(500).json({ message: 'Unable to review page request.' });
    } finally {
        client.release();
    }
});

router.get('/archives', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM (
                SELECT 'announcement-' || a.announcement_id AS id,
                       a.title,
                       'Announcement' AS type,
                       COALESCE(d.department_name, o.organization_name, 'University') AS college,
                       COALESCE(d.department_code, o.organization_name, 'General') AS dept,
                       TO_CHAR(COALESCE(a.expires_at, a.published_at, a.created_at), 'YYYY-MM-DD') AS date
                FROM announcements a
                LEFT JOIN pages p ON p.page_id = a.page_id
                LEFT JOIN departments d ON d.department_id = p.department_id
                LEFT JOIN organizations o ON o.organization_id = p.organization_id
                WHERE LOWER(a.status) = 'archived'
                   OR a.expires_at < CURRENT_TIMESTAMP

                UNION ALL

                SELECT 'event-' || e.event_id AS id,
                       e.event_title AS title,
                       'Event' AS type,
                       COALESCE(d.department_name, o.organization_name, 'University') AS college,
                       COALESCE(d.department_code, o.organization_name, 'General') AS dept,
                       TO_CHAR(e.event_date, 'YYYY-MM-DD') AS date
                FROM events e
                LEFT JOIN pages p ON p.page_id = e.page_id
                LEFT JOIN departments d ON d.department_id = p.department_id
                LEFT JOIN organizations o ON o.organization_id = p.organization_id
                WHERE e.event_date < CURRENT_TIMESTAMP OR LOWER(e.status) = 'archived'
             ) records
             ORDER BY date DESC`
        );
        return res.json({
            records: result.rows.map((record) => {
                const year = Number(record.date.slice(0, 4));
                const month = Number(record.date.slice(5, 7));
                const startYear = month >= 7 ? year : year - 1;
                return { ...record, year: `${startYear}-${startYear + 1}` };
            }),
        });
    } catch (error) {
        console.error('Admin archive query failed:', error);
        return res.status(500).json({ message: 'Unable to load archived records.' });
    }
});

router.get('/reports', async (_req, res) => {
    try {
        const [metrics, activity, topPages] = await Promise.all([
            pool.query(
                `SELECT
                    (SELECT COUNT(*)::int FROM users WHERE LOWER(status) = 'active') AS active_users,
                    (SELECT COUNT(*)::int FROM announcements WHERE LOWER(status) = 'published') AS published_announcements,
                    (SELECT COUNT(*)::int FROM events WHERE event_date >= CURRENT_TIMESTAMP AND LOWER(status) <> 'cancelled') AS upcoming_events,
                    (SELECT COUNT(*)::int FROM event_registrations WHERE LOWER(status) <> 'cancelled') AS event_registrations`
            ),
            pool.query(
                `SELECT TO_CHAR(months.month, 'YYYY-MM') AS month,
                        COUNT(content.created_at)::int AS count
                 FROM generate_series(
                    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
                    DATE_TRUNC('month', CURRENT_DATE),
                    INTERVAL '1 month'
                 ) AS months(month)
                 LEFT JOIN (
                    SELECT created_at FROM announcements
                    UNION ALL
                    SELECT created_at FROM events
                 ) content ON DATE_TRUNC('month', content.created_at) = months.month
                 GROUP BY months.month
                 ORDER BY months.month`
            ),
            pool.query(
                `SELECT p.page_id AS id, p.page_name AS name,
                        COUNT(DISTINCT content.content_id)::int AS content_items
                 FROM pages p
                 LEFT JOIN (
                    SELECT announcement_id AS content_id, page_id FROM announcements
                    UNION ALL
                    SELECT event_id AS content_id, page_id FROM events
                 ) content ON content.page_id = p.page_id
                 WHERE LOWER(p.status) = 'approved'
                 GROUP BY p.page_id
                 ORDER BY content_items DESC, p.page_name
                 LIMIT 5`
            ),
        ]);
        return res.json({
            metrics: {
                activeUsers: metrics.rows[0].active_users,
                publishedAnnouncements: metrics.rows[0].published_announcements,
                upcomingEvents: metrics.rows[0].upcoming_events,
                eventRegistrations: metrics.rows[0].event_registrations,
            },
            monthlyActivity: activity.rows,
            topPages: topPages.rows,
        });
    } catch (error) {
        console.error('Admin reports query failed:', error);
        return res.status(500).json({ message: 'Unable to load reports.' });
    }
});

module.exports = router;
