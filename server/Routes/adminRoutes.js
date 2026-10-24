const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// =====================================================
// ADMIN AUTH MIDDLEWARE
// =====================================================
async function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = authHeader.slice(7).trim();
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const userId = Number(decoded.userId ?? decoded.id ?? decoded.user_id);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(401).json({ message: 'Invalid token.' });
        }

        // Verify user exists and is an Administrator (role_id = 1)
        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email, u.status, r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'User not found.' });
        }

        const user = result.rows[0];
        if (user.status?.toLowerCase() !== 'active') {
            return res.status(403).json({ message: 'Your account is not active.' });
        }

        const roleName = user.role_name?.toLowerCase();
        if (!['administrator', 'admin', 'system administrator'].includes(roleName)) {
            return res.status(403).json({ message: 'Administrator access required.' });
        }

        req.adminUser = user;
        req.adminUserId = userId;
        next();
    } catch (err) {
        console.error('Admin auth error:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

// Apply admin auth to all routes
router.use(requireAdmin);

// =====================================================
// GET /api/admin/overview
// =====================================================
router.get('/overview', async (req, res) => {
    try {
        // Counts
        const [activeUsersRes, announcementsRes, eventsRes, pendingRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM users WHERE LOWER(status) = 'active'`),
            pool.query(`SELECT COUNT(*) FROM announcements WHERE LOWER(status) = 'published'`),
            pool.query(`SELECT COUNT(*) FROM events WHERE LOWER(status) = 'upcoming' AND event_date >= NOW()`),
            pool.query(`SELECT COUNT(*) FROM pages WHERE LOWER(status) = 'pending'`),
        ]);

        // Monthly activity: count of announcements + events published per month, last 12 months
        const monthlyRes = await pool.query(`
            SELECT TO_CHAR(month_date, 'Mon YYYY') AS month, COALESCE(cnt, 0) AS count
            FROM (
                SELECT DATE_TRUNC('month', gs) AS month_date
                FROM GENERATE_SERIES(
                    DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                    DATE_TRUNC('month', NOW()),
                    '1 month'
                ) gs
            ) months
            LEFT JOIN (
                SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*) AS cnt
                FROM (
                    SELECT created_at FROM announcements
                    UNION ALL
                    SELECT created_at FROM events
                ) combined
                WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
                GROUP BY m
            ) counts ON months.month_date = counts.m
            ORDER BY month_date ASC
        `);

        // Recent content: last 20 announcements + events combined
        const recentAnnouncementsRes = await pool.query(`
            SELECT a.announcement_id AS id, a.title, 'Announcement' AS type,
                   a.status, a.created_at AS date, p.page_name AS page
            FROM announcements a
            LEFT JOIN pages p ON a.page_id = p.page_id
            ORDER BY a.created_at DESC
            LIMIT 10
        `);
        const recentEventsRes = await pool.query(`
            SELECT e.event_id AS id, e.event_title AS title, 'Event' AS type,
                   e.status, e.created_at AS date, p.page_name AS page
            FROM events e
            LEFT JOIN pages p ON e.page_id = p.page_id
            ORDER BY e.created_at DESC
            LIMIT 10
        `);

        const recentContent = [
            ...recentAnnouncementsRes.rows,
            ...recentEventsRes.rows,
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

        return res.status(200).json({
            counts: {
                activeUsers: Number(activeUsersRes.rows[0].count),
                publishedAnnouncements: Number(announcementsRes.rows[0].count),
                upcomingEvents: Number(eventsRes.rows[0].count),
                pendingRequests: Number(pendingRes.rows[0].count),
            },
            monthlyActivity: monthlyRes.rows.map(row => ({
                month: row.month,
                count: Number(row.count),
            })),
            recentContent,
        });
    } catch (err) {
        console.error('Admin overview error:', err);
        return res.status(500).json({ message: 'Failed to load overview: ' + err.message });
    }
});

// =====================================================
// GET /api/admin/users
// =====================================================
router.get('/users', async (req, res) => {
    try {
        const usersRes = await pool.query(`
            SELECT u.user_id, u.first_name, u.last_name, u.email,
                   u.status, r.role_name
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            ORDER BY r.role_id ASC, u.last_name ASC, u.first_name ASC
        `);

        // Get managed pages for staff
        const pageStaffRes = await pool.query(`
            SELECT ps.user_id, p.page_name
            FROM page_staff ps
            JOIN pages p ON ps.page_id = p.page_id
            WHERE LOWER(ps.status) = 'active'
        `);

        const managedPagesMap = {};
        for (const row of pageStaffRes.rows) {
            if (!managedPagesMap[row.user_id]) managedPagesMap[row.user_id] = [];
            managedPagesMap[row.user_id].push(row.page_name);
        }

        const users = usersRes.rows.map(u => {
            const fullName = `${u.first_name} ${u.last_name}`;
            const initials = [u.first_name[0], u.last_name[0]].join('').toUpperCase();
            return {
                id: u.user_id,
                name: fullName,
                email: u.email,
                role: u.role_name,
                active: u.status?.toLowerCase() === 'active',
                initials,
                managedPages: managedPagesMap[u.user_id] || [],
            };
        });

        return res.status(200).json({ users });
    } catch (err) {
        console.error('Admin users error:', err);
        return res.status(500).json({ message: 'Failed to load users: ' + err.message });
    }
});

// =====================================================
// PATCH /api/admin/users/:id/role
// =====================================================
router.patch('/users/:id/role', async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const { role } = req.body;

        if (!role) return res.status(400).json({ message: 'Role is required.' });

        const roleRes = await pool.query(
            `SELECT role_id FROM roles WHERE LOWER(role_name) = $1 LIMIT 1`,
            [role.toLowerCase()]
        );
        if (roleRes.rowCount === 0) {
            return res.status(400).json({ message: `Role "${role}" does not exist.` });
        }

        const roleId = roleRes.rows[0].role_id;
        await pool.query(`UPDATE users SET role_id = $1, updated_at = NOW() WHERE user_id = $2`, [roleId, targetId]);

        return res.status(200).json({ message: 'User role updated successfully.' });
    } catch (err) {
        console.error('Update role error:', err);
        return res.status(500).json({ message: 'Failed to update role: ' + err.message });
    }
});

// =====================================================
// PATCH /api/admin/users/:id/status
// =====================================================
router.patch('/users/:id/status', async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const { active } = req.body;

        if (typeof active !== 'boolean') {
            return res.status(400).json({ message: 'active must be a boolean.' });
        }

        const newStatus = active ? 'Active' : 'Inactive';
        await pool.query(`UPDATE users SET status = $1, updated_at = NOW() WHERE user_id = $2`, [newStatus, targetId]);

        return res.status(200).json({ message: 'User status updated successfully.' });
    } catch (err) {
        console.error('Update status error:', err);
        return res.status(500).json({ message: 'Failed to update status: ' + err.message });
    }
});

// =====================================================
// GET /api/admin/pages
// =====================================================
router.get('/pages', async (req, res) => {
    try {
        const pagesRes = await pool.query(`
            SELECT p.page_id, p.page_name, p.status,
                   d.department_name, d.department_code,
                   o.organization_name,
                   COUNT(DISTINCT pf.follow_id) AS follower_count
            FROM pages p
            LEFT JOIN departments d ON p.department_id = d.department_id
            LEFT JOIN organizations o ON p.organization_id = o.organization_id
            LEFT JOIN page_follows pf ON pf.page_id = p.page_id
            WHERE LOWER(p.status) = 'approved'
            GROUP BY p.page_id, d.department_name, d.department_code, o.organization_name
            ORDER BY p.page_name ASC
        `);

        // Get managers for each page
        const managersRes = await pool.query(`
            SELECT ps.page_id, u.first_name || ' ' || u.last_name AS manager_name
            FROM page_staff ps
            JOIN users u ON ps.user_id = u.user_id
            WHERE LOWER(ps.status) = 'active'
        `);

        const managersMap = {};
        for (const row of managersRes.rows) {
            if (!managersMap[row.page_id]) managersMap[row.page_id] = [];
            managersMap[row.page_id].push(row.manager_name);
        }

        const pages = pagesRes.rows.map(p => ({
            id: p.page_id,
            name: p.page_name,
            code: p.department_code || p.organization_name?.substring(0, 4)?.toUpperCase() || 'ORG',
            dept: p.department_name || p.organization_name || 'Unknown',
            followers: Number(p.follower_count),
            managers: managersMap[p.page_id] || [],
            active: p.status?.toLowerCase() === 'approved',
        }));

        return res.status(200).json({ pages });
    } catch (err) {
        console.error('Admin pages error:', err);
        return res.status(500).json({ message: 'Failed to load pages: ' + err.message });
    }
});

// =====================================================
// POST /api/admin/pages  (admin creates a page directly)
// =====================================================
router.post('/pages', async (req, res) => {
    try {
        const { pageName, ownerType, ownerId } = req.body;

        if (!pageName?.trim() || !ownerType || !ownerId) {
            return res.status(400).json({ message: 'pageName, ownerType, and ownerId are required.' });
        }

        const deptId = ownerType === 'department' ? Number(ownerId) : null;
        const orgId = ownerType === 'organization' ? Number(ownerId) : null;

        const result = await pool.query(`
            INSERT INTO pages (page_name, department_id, organization_id, created_by, status)
            VALUES ($1, $2, $3, $4, 'Approved')
            RETURNING *
        `, [pageName.trim(), deptId, orgId, req.adminUserId]);

        return res.status(201).json({ message: 'Page created successfully.', page: result.rows[0] });
    } catch (err) {
        console.error('Create page error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'A page for this department or organization already exists.' });
        }
        return res.status(500).json({ message: 'Failed to create page: ' + err.message });
    }
});

// =====================================================
// DELETE /api/admin/pages/:id
// =====================================================
router.delete('/pages/:id', async (req, res) => {
    try {
        const pageId = Number(req.params.id);
        await pool.query(`DELETE FROM pages WHERE page_id = $1`, [pageId]);
        return res.status(200).json({ message: 'Page removed successfully.' });
    } catch (err) {
        console.error('Delete page error:', err);
        return res.status(500).json({ message: 'Failed to remove page: ' + err.message });
    }
});

// =====================================================
// PATCH /api/admin/pages/:id/status
// =====================================================
router.patch('/pages/:id/status', async (req, res) => {
    try {
        const pageId = Number(req.params.id);
        const { active } = req.body;

        if (typeof active !== 'boolean') {
            return res.status(400).json({ message: 'active must be a boolean.' });
        }

        // Toggle between Approved (active) and Inactive
        const newStatus = active ? 'Approved' : 'Inactive';
        await pool.query(`UPDATE pages SET status = $1, updated_at = NOW() WHERE page_id = $2`, [newStatus, pageId]);

        return res.status(200).json({ message: 'Page status updated.' });
    } catch (err) {
        console.error('Toggle page status error:', err);
        return res.status(500).json({ message: 'Failed to update page status: ' + err.message });
    }
});

// =====================================================
// GET /api/admin/requests  (pending page requests)
// =====================================================
router.get('/requests', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.page_id, p.page_name, p.created_at,
                   d.department_name, d.department_code,
                   o.organization_name,
                   u.user_id AS requester_id,
                   u.first_name || ' ' || u.last_name AS requester_name,
                   u.email AS requester_email
            FROM pages p
            LEFT JOIN departments d ON p.department_id = d.department_id
            LEFT JOIN organizations o ON p.organization_id = o.organization_id
            JOIN users u ON p.created_by = u.user_id
            WHERE LOWER(p.status) = 'pending'
            ORDER BY p.created_at ASC
        `);

        const requests = result.rows.map(row => ({
            id: row.page_id,
            name: row.page_name,
            office: row.department_name || row.organization_name || 'Unknown',
            unit: row.department_code || 'Organization',
            requester: {
                name: row.requester_name,
                email: row.requester_email,
            },
            requestedOn: new Date(row.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
        }));

        return res.status(200).json({ requests });
    } catch (err) {
        console.error('Admin requests error:', err);
        return res.status(500).json({ message: 'Failed to load requests: ' + err.message });
    }
});

// =====================================================
// POST /api/admin/requests/:id/review
// =====================================================
router.post('/requests/:id/review', async (req, res) => {
    const client = await pool.connect();
    try {
        const pageId = Number(req.params.id);
        const { decision } = req.body;

        if (!['approved', 'rejected'].includes(decision?.toLowerCase())) {
            return res.status(400).json({ message: 'decision must be "approved" or "rejected".' });
        }

        await client.query('BEGIN');

        const newStatus = decision.toLowerCase() === 'approved' ? 'Approved' : 'Rejected';
        const pageRes = await client.query(
            `UPDATE pages SET status = $1, updated_at = NOW() WHERE page_id = $2 RETURNING *`,
            [newStatus, pageId]
        );

        if (pageRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Page request not found.' });
        }

        // Log the review in page_reviews
        await client.query(
            `INSERT INTO page_reviews (page_id, reviewed_by, decision) VALUES ($1, $2, $3)`,
            [pageId, req.adminUserId, newStatus]
        );

        // If approved: add the page creator as a staff manager of the page
        if (newStatus === 'Approved') {
            const creatorId = pageRes.rows[0].created_by;
            // Also give them the Staff role if they're a Student
            await client.query(
                `UPDATE users SET role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1), updated_at = NOW()
                 WHERE user_id = $1 AND role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1)`,
                [creatorId]
            );

            // Add them to page_staff
            await client.query(
                `INSERT INTO page_staff (page_id, user_id, role_on_page, assigned_by)
                 VALUES ($1, $2, 'Manager', $3)
                 ON CONFLICT (page_id, user_id) DO NOTHING`,
                [pageId, creatorId, req.adminUserId]
            );
        }

        await client.query('COMMIT');
        return res.status(200).json({ message: `Page ${newStatus.toLowerCase()} successfully.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Review request error:', err);
        return res.status(500).json({ message: 'Failed to review request: ' + err.message });
    } finally {
        client.release();
    }
});

// =====================================================
// GET /api/admin/archives
// =====================================================
router.get('/archives', async (req, res) => {
    try {
        // Combine announcements and events as archive records
        const announcementsRes = await pool.query(`
            SELECT a.announcement_id AS id, a.title, 'Announcement' AS type,
                   a.created_at,
                   TO_CHAR(a.created_at, 'YYYY-MM-DD') AS date,
                   p.page_name AS college,
                   d.department_name AS dept,
                   TO_CHAR(a.created_at, 'YYYY') || '-' || TO_CHAR(a.created_at + INTERVAL '1 year', 'YYYY') AS year
            FROM announcements a
            LEFT JOIN pages p ON a.page_id = p.page_id
            LEFT JOIN departments d ON p.department_id = d.department_id
            ORDER BY a.created_at DESC
        `);

        const eventsRes = await pool.query(`
            SELECT e.event_id AS id, e.event_title AS title, 'Event' AS type,
                   e.created_at,
                   TO_CHAR(e.event_date, 'YYYY-MM-DD') AS date,
                   p.page_name AS college,
                   d.department_name AS dept,
                   TO_CHAR(e.event_date, 'YYYY') || '-' || TO_CHAR(e.event_date + INTERVAL '1 year', 'YYYY') AS year
            FROM events e
            LEFT JOIN pages p ON e.page_id = p.page_id
            LEFT JOIN departments d ON p.department_id = d.department_id
            ORDER BY e.event_date DESC
        `);

        const records = [
            ...announcementsRes.rows.map(r => ({ ...r, id: `a-${r.id}` })),
            ...eventsRes.rows.map(r => ({ ...r, id: `e-${r.id}` })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.status(200).json({ records });
    } catch (err) {
        console.error('Archives error:', err);
        return res.status(500).json({ message: 'Failed to load archives: ' + err.message });
    }
});

// =====================================================
// GET /api/admin/reports
// =====================================================
router.get('/reports', async (req, res) => {
    try {
        const [activeUsersRes, announcementsRes, eventsRes, registrationsRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM users WHERE LOWER(status) = 'active'`),
            pool.query(`SELECT COUNT(*) FROM announcements WHERE LOWER(status) = 'published'`),
            pool.query(`SELECT COUNT(*) FROM events WHERE LOWER(status) = 'upcoming' AND event_date >= NOW()`),
            pool.query(`SELECT COUNT(*) FROM event_registrations`),
        ]);

        // Monthly activity (last 12 months), format as YYYY-MM for the Reports bar chart
        const monthlyRes = await pool.query(`
            SELECT TO_CHAR(month_date, 'YYYY-MM') AS month, COALESCE(cnt, 0) AS count
            FROM (
                SELECT DATE_TRUNC('month', gs) AS month_date
                FROM GENERATE_SERIES(
                    DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                    DATE_TRUNC('month', NOW()),
                    '1 month'
                ) gs
            ) months
            LEFT JOIN (
                SELECT DATE_TRUNC('month', created_at) AS m, COUNT(*) AS cnt
                FROM (
                    SELECT created_at FROM announcements
                    UNION ALL
                    SELECT created_at FROM events
                ) combined
                WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
                GROUP BY m
            ) counts ON months.month_date = counts.m
            ORDER BY month_date ASC
        `);

        // Top pages by content volume
        const topPagesRes = await pool.query(`
            SELECT p.page_id AS id, p.page_name AS name,
                   (COUNT(DISTINCT a.announcement_id) + COUNT(DISTINCT e.event_id)) AS content_items
            FROM pages p
            LEFT JOIN announcements a ON a.page_id = p.page_id
            LEFT JOIN events e ON e.page_id = p.page_id
            WHERE LOWER(p.status) = 'approved'
            GROUP BY p.page_id, p.page_name
            ORDER BY content_items DESC
            LIMIT 5
        `);

        return res.status(200).json({
            metrics: {
                activeUsers: Number(activeUsersRes.rows[0].count),
                publishedAnnouncements: Number(announcementsRes.rows[0].count),
                upcomingEvents: Number(eventsRes.rows[0].count),
                eventRegistrations: Number(registrationsRes.rows[0].count),
            },
            monthlyActivity: monthlyRes.rows.map(row => ({
                month: row.month,
                count: Number(row.count),
            })),
            topPages: topPagesRes.rows.map(row => ({
                id: row.id,
                name: row.name,
                content_items: Number(row.content_items),
            })),
        });
    } catch (err) {
        console.error('Reports error:', err);
        return res.status(500).json({ message: 'Failed to load reports: ' + err.message });
    }
});

// =====================================================
// GET /api/admin/page-options
// =====================================================
router.get('/page-options', async (req, res) => {
    try {
        // Only show departments/organizations that don't already have an approved page
        const deptsRes = await pool.query(`
            SELECT d.department_id AS id, d.department_name AS name, d.department_code AS code
            FROM departments d
            WHERE LOWER(d.status) = 'active'
              AND NOT EXISTS (
                  SELECT 1 FROM pages p
                  WHERE p.department_id = d.department_id
                  AND LOWER(p.status) IN ('approved', 'pending')
              )
            ORDER BY d.department_name ASC
        `);

        const orgsRes = await pool.query(`
            SELECT o.organization_id AS id, o.organization_name AS name
            FROM organizations o
            WHERE LOWER(o.status) = 'active'
              AND NOT EXISTS (
                  SELECT 1 FROM pages p
                  WHERE p.organization_id = o.organization_id
                  AND LOWER(p.status) IN ('approved', 'pending')
              )
            ORDER BY o.organization_name ASC
        `);

        return res.status(200).json({
            departments: deptsRes.rows,
            organizations: orgsRes.rows,
        });
    } catch (err) {
        console.error('Page options error:', err);
        return res.status(500).json({ message: 'Failed to load page options: ' + err.message });
    }
});

// =====================================================
// GET /api/admin/profile
// =====================================================
router.get('/profile', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.user_id AS id, u.first_name, u.last_name, u.email,
                    u.student_id, u.status, r.role_name AS role
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
            [req.adminUserId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Profile not found.' });
        }

        return res.status(200).json({ profile: result.rows[0] });
    } catch (err) {
        console.error('Profile error:', err);
        return res.status(500).json({ message: 'Failed to load profile: ' + err.message });
    }
});

// =====================================================
// PATCH /api/admin/profile
// =====================================================
router.patch('/profile', async (req, res) => {
    try {
        const { first_name, last_name } = req.body;

        if (!first_name?.trim() || !last_name?.trim()) {
            return res.status(400).json({ message: 'First name and last name are required.' });
        }

        await pool.query(
            `UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW() WHERE user_id = $3`,
            [first_name.trim(), last_name.trim(), req.adminUserId]
        );

        return res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({ message: 'Failed to update profile: ' + err.message });
    }
});

module.exports = router;
