const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// AUTHENTICATION HELPER
async function authenticateUser(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authentication required. Please log in.' });
        return null;
    }

    const token = authHeader.slice(7).trim();
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
        console.error('Authentication error:', error.message);
        res.status(401).json({ message: 'Invalid or expired token.' });
        return null;
    }
}

// HELPER: Fetch user's managed page details (owner or active page_staff)
async function getUserPageDetails(userId) {
    try {
        const pageRes = await pool.query(
            `SELECT p.page_id,
                    COALESCE(p.page_name, d.department_name, o.organization_name) AS page_name,
                    COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
             FROM pages p
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE p.created_by = $1
                OR EXISTS (
                    SELECT 1 FROM page_staff ps
                    WHERE ps.page_id = p.page_id AND ps.user_id = $1 AND LOWER(ps.status) = 'active'
                )
             ORDER BY p.page_id DESC
             LIMIT 1`,
            [userId]
        );
        if (pageRes.rows.length > 0) {
            return pageRes.rows[0];
        }

        return { page_id: null, page_name: null, department_code: 'WMSU' };
    } catch (err) {
        console.error('Error in getUserPageDetails:', err.message);
        return { page_id: null, page_name: null, department_code: 'WMSU' };
    }
}

// HELPER: Fetch default category_id if null to satisfy NOT-NULL constraint
async function getDefaultCategoryId() {
    try {
        const catRes = await pool.query(`SELECT category_id FROM announcement_categories ORDER BY category_id ASC LIMIT 1`);
        if (catRes.rows.length > 0) {
            return catRes.rows[0].category_id;
        }
        return 1;
    } catch (err) {
        return 1;
    }
}

// CHECK USER'S PAGE STATUS
router.get('/my-page-status', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const pageQuery = await pool.query(
            `SELECT p.page_id, p.page_name, p.page_description, p.status, p.department_id, p.organization_id,
                    d.department_name, d.department_code, o.organization_name
             FROM pages p
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE p.created_by = $1
                OR EXISTS (
                    SELECT 1 FROM page_staff ps
                    WHERE ps.page_id = p.page_id AND ps.user_id = $1 AND LOWER(ps.status) = 'active'
                )
             ORDER BY p.page_id DESC
             LIMIT 1`,
            [userId]
        );

        if (pageQuery.rows.length === 0) {
            return res.status(200).json({ exists: false, status: 'none' });
        }

        const page = pageQuery.rows[0];
        const resolvedName = page.page_name || page.department_name || page.organization_name || '';
        const resolvedCode = page.department_code || (page.organization_name ? page.organization_name.substring(0, 4).toUpperCase() : resolvedName.substring(0, 3).toUpperCase()) || 'WMSU';

        return res.status(200).json({
            exists: true,
            pageId: page.page_id,
            pageName: resolvedName,
            pageCode: resolvedCode,
            departmentName: page.department_name || page.organization_name || resolvedName,
            description: page.page_description || '',
            status: String(page.status || 'Pending').toLowerCase(),
            category: page.department_id ? 'Academic College' : 'Student Organization'
        });
    } catch (error) {
        console.error('Error fetching page status:', error);
        return res.status(500).json({ message: 'Failed to fetch page status: ' + error.message });
    }
});

// FETCH DASHBOARD FEED DATA (Includes category_id, category_name, page_name, department_name, department_code)
const handleDashboardFetch = async (req, res) => {
    try {
        const annRes = await pool.query(
            `SELECT a.announcement_id, a.announcement_id AS id, a.title, a.content, a.content AS description,
                    a.created_at, a.page_id, a.category_id,
                    COALESCE(c.category_name, 'General') AS category_name,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Notice') AS page_name,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Notice') AS department_name,
                    COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
             FROM announcements a
             LEFT JOIN pages p ON a.page_id = p.page_id
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             LEFT JOIN announcement_categories c ON a.category_id = c.category_id
             WHERE a.page_id IS NULL OR LOWER(p.status) = 'approved'
             ORDER BY a.created_at DESC`
        ).catch((err) => {
            console.error('Error fetching announcements:', err.message);
            return { rows: [] };
        });

        const evRes = await pool.query(
            `SELECT e.event_id, e.event_id AS id,
                    e.event_title, e.event_title AS title,
                    COALESCE(e.event_description, '') AS event_description,
                    COALESCE(e.event_description, '') AS description,
                    e.event_date, e.event_date AS date,
                    e.location, e.location AS venue, e.capacity,
                    e.created_at, e.poster_url, e.poster_url AS image_url,
                    e.page_id,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS page_name,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS department_name,
                    COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
             FROM events e
             LEFT JOIN pages p ON e.page_id = p.page_id
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE e.page_id IS NULL OR LOWER(p.status) = 'approved'
             ORDER BY e.created_at DESC`
        ).catch((err) => {
            console.error('Error fetching events:', err.message);
            return { rows: [] };
        });

        return res.status(200).json({
            announcements: annRes.rows,
            events: evRes.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({ message: 'Failed to fetch dashboard posts.' });
    }
};

router.get('/dashboard-data', handleDashboardFetch);
router.post('/dashboard-data', handleDashboardFetch);

// GET /api/mypage/posts (Includes categories, department_name, department_code)
router.get('/mypage/posts', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { pageId } = req.query;

        let annQuery = `
            SELECT a.*, a.announcement_id AS id, a.content AS description, a.category_id,
                   COALESCE(c.category_name, 'General') AS category_name,
                   COALESCE(p.page_name, d.department_name, o.organization_name, 'University Notice') AS page_name,
                   COALESCE(p.page_name, d.department_name, o.organization_name, 'University Notice') AS department_name,
                   COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
            FROM announcements a
            LEFT JOIN pages p ON a.page_id = p.page_id
            LEFT JOIN departments d ON p.department_id = d.department_id
            LEFT JOIN organizations o ON p.organization_id = o.organization_id
            LEFT JOIN announcement_categories c ON a.category_id = c.category_id`;
        let evQuery = `
            SELECT e.*, e.event_id AS id, e.event_title AS title, e.event_description AS description, e.event_date AS date,
                   COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS page_name,
                   COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS department_name,
                   COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
            FROM events e
            LEFT JOIN pages p ON e.page_id = p.page_id
            LEFT JOIN departments d ON p.department_id = d.department_id
            LEFT JOIN organizations o ON p.organization_id = o.organization_id`;
        const params = [];

        if (pageId) {
            annQuery += ` WHERE a.page_id = $1`;
            evQuery += ` WHERE e.page_id = $1`;
            params.push(pageId);
        }

        annQuery += ` ORDER BY a.created_at DESC`;
        evQuery += ` ORDER BY e.created_at DESC`;

        const annRes = await pool.query(annQuery, params).catch(() => ({ rows: [] }));
        const evRes = await pool.query(evQuery, params).catch(() => ({ rows: [] }));

        return res.status(200).json({
            announcements: annRes.rows,
            events: evRes.rows,
            posts: [...annRes.rows, ...evRes.rows]
        });
    } catch (err) {
        console.error('Error fetching mypage posts:', err);
        return res.status(500).json({ message: 'Failed to fetch page posts.' });
    }
});

// GET /api/categories (Fetches all announcement categories for dropdowns)
router.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(`SELECT category_id, category_name FROM announcement_categories ORDER BY category_name ASC`);
        return res.status(200).json({ categories: result.rows });
    } catch (err) {
        console.error('Error fetching categories:', err.message);
        return res.status(200).json({ categories: [{ category_id: 1, category_name: 'General' }] });
    }
});

// CREATE ANNOUNCEMENT (Include category_id)
router.post('/announcements', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { title, content, description, pageId, category_id, is_pinned } = req.body;
        const bodyText = content || description || '';

        if (!title || !bodyText) {
            return res.status(400).json({ message: 'Title and content/description are required.' });
        }

        const userPage = await getUserPageDetails(userId);
        const targetPageId = pageId || userPage.page_id;

        if (!targetPageId) {
            return res.status(400).json({ message: 'No valid page found. Please create or join an organization page first.' });
        }

        let finalCategoryId = category_id ? Number(category_id) : null;
        if (!finalCategoryId) {
            finalCategoryId = await getDefaultCategoryId();
        }

        const query = `
            INSERT INTO announcements 
            (page_id, creator_user_id, category_id, title, content, is_pinned, status, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, 'Published', NOW(), NOW()) 
            RETURNING *;
        `;

        const values = [
            targetPageId,
            userId,
            finalCategoryId,
            title,
            bodyText,
            Boolean(is_pinned)
        ];

        const result = await pool.query(query, values);
        const row = result.rows[0];
        const pageName = userPage.page_name || 'Student Affairs Office';

        const newAnnouncement = {
            ...row,
            id: row.announcement_id,
            description: row.content,
            page_name: pageName,
            department_name: pageName,
            department_code: userPage.department_code || 'WMSU'
        };

        return res.status(201).json({ 
            message: 'Announcement published successfully!',
            announcement: newAnnouncement 
        });
    } catch (err) {
        console.error('CRITICAL ERROR publishing announcement:', err.stack || err.message);
        return res.status(500).json({ message: 'Database Insert Error: ' + err.message });
    }
});

// CREATE EVENT
router.post('/events', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { event_title, title, event_description, description, pageId, event_date, location, venue, capacity, image_url, poster_url, organizer_info } = req.body;
        const eTitle = event_title || title;
        const eDesc = event_description || description || '';

        if (!eTitle || !eDesc) {
            return res.status(400).json({ message: 'Event title and description are required.' });
        }

        const userPage = await getUserPageDetails(userId);
        const targetPageId = pageId || userPage.page_id;

        if (!targetPageId) {
            return res.status(400).json({ message: 'No valid page found. Please create or join an organization page first.' });
        }

        const eDate = event_date || new Date().toISOString().split('T')[0];
        const eVenue = location || venue || 'TBD';
        const imgUrl = poster_url || image_url || null;

        const query = `
            INSERT INTO events 
            (page_id, creator_user_id, event_title, event_description, event_date, location, capacity, poster_url, organizer_info, status, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Upcoming', NOW()) 
            RETURNING *;
        `;

        const values = [
            targetPageId,
            userId,
            eTitle,
            eDesc,
            eDate,
            eVenue,
            capacity ? Number(capacity) : null,
            imgUrl,
            organizer_info || null
        ];

        const result = await pool.query(query, values);
        const row = result.rows[0];
        const pageName = userPage.page_name || 'Student Affairs Office';

        const newEvent = {
            ...row,
            id: row.event_id,
            title: row.event_title,
            description: row.event_description,
            date: row.event_date,
            venue: row.location,
            image_url: row.poster_url,
            page_name: pageName,
            department_name: pageName,
            department_code: userPage.department_code || 'WMSU'
        };

        return res.status(201).json({ 
            message: 'Event published successfully!',
            event: newEvent 
        });
    } catch (err) {
        console.error('CRITICAL ERROR publishing event:', err.stack || err.message);
        return res.status(500).json({ message: 'Database Insert Error: ' + err.message });
    }
});

// EDIT ANNOUNCEMENT
router.put('/announcements/:id', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        const { id } = req.params;
        const { title, content, description, category_id } = req.body;
        const bodyText = content || description || '';

        let query = `UPDATE announcements SET title = $1, content = $2, updated_at = NOW()`;
        const params = [title, bodyText];

        if (category_id) {
            params.push(Number(category_id));
            query += `, category_id = ${params.length}`;
        }

        params.push(id);
        query += ` WHERE announcement_id = ${params.length} RETURNING *`;

        const result = await pool.query(query, params);
        const row = result.rows[0];
        return res.status(200).json({
            announcement: row ? { ...row, id: row.announcement_id, description: row.content } : null
        });
    } catch (err) {
        console.error('Error updating announcement:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// EDIT EVENT
router.put('/events/:id', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        const { id } = req.params;
        const { event_title, title, event_description, description, event_date, location, venue, capacity } = req.body;
        const eTitle = event_title || title;
        const eDesc = event_description || description || '';

        const result = await pool.query(
            `UPDATE events SET event_title = $1, event_description = $2, event_date = $3, location = $4, capacity = $5 WHERE event_id = $6 RETURNING *`,
            [eTitle, eDesc, event_date, location || venue || 'TBD', capacity ? Number(capacity) : null, id]
        );
        const row = result.rows[0];
        return res.status(200).json({
            event: row ? {
                ...row,
                id: row.event_id,
                title: row.event_title,
                description: row.event_description,
                date: row.event_date,
                venue: row.location,
                image_url: row.poster_url
            } : null
        });
    } catch (err) {
        console.error('Error updating event:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// DELETE ANNOUNCEMENT
router.delete('/announcements/:id', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        await pool.query(`DELETE FROM announcements WHERE announcement_id = $1`, [req.params.id]);
        return res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        console.error('Error deleting announcement:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// DELETE EVENT
router.delete('/events/:id', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        await pool.query(`DELETE FROM events WHERE event_id = $1`, [req.params.id]);
        return res.status(200).json({ message: 'Event deleted successfully' });
    } catch (err) {
        console.error('Error deleting event:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// GET APPROVED PAGES
router.get('/approved-pages', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT page_id AS id, page_name AS name, page_description AS description, status,
                    CASE WHEN department_id IS NOT NULL THEN 'Academic College' ELSE 'Student Organization' END AS category
             FROM pages WHERE LOWER(status) = 'approved' ORDER BY page_name ASC`
        );
        return res.status(200).json({ pages: result.rows });
    } catch (err) {
        console.error('Error fetching approved pages:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// CREATE PAGE (submitted as 'Pending' for admin approval)
router.post('/create-page', async (req, res) => {
    const userId = await authenticateUser(req, res);
    if (!userId) return;

    const { pageName, pageCategory, pageDescription, organizationId, departmentId } = req.body || {};
    const name = String(pageName || '').trim();

    if (!name) {
        return res.status(400).json({ message: 'Page name is required.' });
    }

    const isOrgCategory = pageCategory === 'Student Organization' || pageCategory === 'Campus Council';
    const orgId = isOrgCategory ? Number(organizationId) : null;
    const deptId = isOrgCategory ? null : Number(departmentId);
    const ownerId = isOrgCategory ? orgId : deptId;

    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
        return res.status(400).json({
            message: isOrgCategory ? 'Please select a valid organization.' : 'Please select a valid department.'
        });
    }

    const client = await pool.connect();
    try {
        const existing = await client.query(
            `SELECT page_id FROM pages WHERE created_by = $1 AND LOWER(status) IN ('pending', 'approved') LIMIT 1`,
            [userId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'You already have a pending or approved page.' });
        }

        await client.query('BEGIN');
        const insert = await client.query(
            `INSERT INTO pages (page_name, page_description, department_id, organization_id, created_by, status)
             VALUES ($1, $2, $3, $4, $5, 'Pending')
             RETURNING page_id, page_name, page_description, status`,
            [name, pageDescription || null, deptId, orgId, userId]
        );
        const page = insert.rows[0];

        await client.query(
            `INSERT INTO page_staff (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, 'Admin', $2, 'Active')`,
            [page.page_id, userId]
        );
        await client.query('COMMIT');

        return res.status(201).json({
            message: 'Page submitted for approval.',
            page: { pageId: page.page_id, pageName: page.page_name, description: page.page_description, status: page.status }
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error creating page:', err.stack || err.message);
        if (err.code === '23505') {
            return res.status(409).json({ message: 'A page already exists for that department/organization.' });
        }
        if (err.code === '23503') {
            return res.status(400).json({ message: 'The selected department/organization does not exist.' });
        }
        return res.status(500).json({ message: 'Failed to create page: ' + err.message });
    } finally {
        client.release();
    }
});

// UPDATE OWN PAGE (name and description only; owner department/organization is fixed)
router.put('/mypage/update', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { pageName, description } = req.body || {};
        const name = String(pageName || '').trim();
        if (!name) {
            return res.status(400).json({ message: 'Page name is required.' });
        }

        const result = await pool.query(
            `UPDATE pages SET page_name = $1, page_description = $2
             WHERE page_id = (SELECT page_id FROM pages WHERE created_by = $3 ORDER BY page_id DESC LIMIT 1)
             RETURNING page_id, page_name, page_description, status`,
            [name, description || null, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'You do not have a page to update.' });
        }
        return res.status(200).json({ message: 'Page updated successfully.', page: result.rows[0] });
    } catch (err) {
        console.error('Error updating page:', err.message);
        return res.status(500).json({ message: 'Failed to update page: ' + err.message });
    }
});

module.exports = router;