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

// HELPER: Fetch user's managed page details or return fallback page
async function getUserPageDetails(userId) {
    try {
        const pageRes = await pool.query(
            `SELECT page_id, page_name FROM pages WHERE created_by = $1 ORDER BY page_id DESC LIMIT 1`,
            [userId]
        );
        if (pageRes.rows.length > 0) {
            return pageRes.rows[0];
        }

        const fallbackRes = await pool.query(`SELECT page_id, page_name FROM pages LIMIT 1`);
        if (fallbackRes.rows.length > 0) {
            return fallbackRes.rows[0];
        }

        return { page_id: null, page_name: 'Student Affairs Office' };
    } catch (err) {
        console.error('Error in getUserPageDetails:', err.message);
        return { page_id: null, page_name: 'Student Affairs Office' };
    }
}

// HELPER: Fetch default category_id if null to satisfy NOT-NULL constraint
async function getDefaultCategoryId() {
    try {
        const catRes = await pool.query(`SELECT category_id FROM categories ORDER BY category_id ASC LIMIT 1`);
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
            `SELECT page_id, page_name, page_description, description, status, department_id, organization_id
             FROM pages
             WHERE created_by = $1
             ORDER BY page_id DESC
             LIMIT 1`,
            [userId]
        );

        if (pageQuery.rows.length === 0) {
            return res.status(200).json({ exists: false, status: 'none' });
        }

        const page = pageQuery.rows[0];

        return res.status(200).json({
            exists: true,
            pageId: page.page_id,
            pageName: page.page_name,
            description: page.page_description || page.description || '',
            status: String(page.status || 'Pending').toLowerCase(),
            category: page.department_id ? 'Academic College' : 'Student Organization'
        });
    } catch (error) {
        console.error('Error fetching page status:', error);
        return res.status(500).json({ message: 'Failed to fetch page status: ' + error.message });
    }
});

// FETCH DASHBOARD FEED DATA (Includes category_id and category_name)
const handleDashboardFetch = async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const annRes = await pool.query(
            `SELECT a.announcement_id, a.title, COALESCE(a.content, a.description, '') as content, 
                    a.created_at, a.image_url, a.page_id, a.category_id,
                    COALESCE(c.category_name, 'General') as category_name,
                    COALESCE(p.page_name, 'Student Affairs Office') as page_name 
             FROM announcements a 
             LEFT JOIN pages p ON a.page_id = p.page_id 
             LEFT JOIN categories c ON a.category_id = c.category_id
             ORDER BY a.created_at DESC`
        ).catch((err) => {
            console.error('Error fetching announcements:', err.message);
            return { rows: [] };
        });

        const evRes = await pool.query(
            `SELECT e.event_id, COALESCE(e.event_title, e.title) as event_title, 
                    COALESCE(e.event_description, e.description, '') as event_description, 
                    e.event_date, COALESCE(e.location, e.venue) as location, e.capacity, 
                    e.created_at, e.image_url, e.page_id, COALESCE(p.page_name, 'Student Affairs Office') as page_name 
             FROM events e 
             LEFT JOIN pages p ON e.page_id = p.page_id 
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

// GET /api/mypage/posts (Includes categories)
router.get('/mypage/posts', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { pageId } = req.query;

        let annQuery = `SELECT a.*, a.category_id, COALESCE(c.category_name, 'General') as category_name, COALESCE(p.page_name, 'Student Affairs Office') as page_name FROM announcements a LEFT JOIN pages p ON a.page_id = p.page_id LEFT JOIN categories c ON a.category_id = c.category_id`;
        let evQuery = `SELECT e.*, COALESCE(p.page_name, 'Student Affairs Office') as page_name FROM events e LEFT JOIN pages p ON e.page_id = p.page_id`;
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
        const result = await pool.query(`SELECT category_id, category_name FROM categories ORDER BY category_name ASC`);
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

        const { title, content, description, pageId, image_url, category_id, is_pinned } = req.body;
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
            (page_id, creator_user_id, category_id, title, content, description, is_pinned, status, created_at, updated_at, image_url) 
            VALUES ($1, $2, $3, $4, $5, $5, $6, 'Published', NOW(), NOW(), $7) 
            RETURNING *;
        `;

        const values = [
            targetPageId,
            userId,
            finalCategoryId,
            title,
            bodyText,
            Boolean(is_pinned),
            image_url || null
        ];

        const result = await pool.query(query, values);

        const newAnnouncement = {
            ...result.rows[0],
            page_name: userPage.page_name || 'Student Affairs Office'
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
        const imgUrl = image_url || poster_url || null;

        const query = `
            INSERT INTO events 
            (page_id, creator_user_id, event_title, title, event_description, description, event_date, venue, location, capacity, image_url, poster_url, organizer_info, status, created_at) 
            VALUES ($1, $2, $3, $3, $4, $4, $5, $6, $6, $7, $8, $8, $9, 'Published', NOW()) 
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

        const newEvent = {
            ...result.rows[0],
            page_name: userPage.page_name || 'Student Affairs Office'
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

        let query = `UPDATE announcements SET title = $1, content = $2, description = $2, updated_at = NOW()`;
        const params = [title, bodyText];

        if (category_id) {
            params.push(Number(category_id));
            query += `, category_id = $${params.length}`;
        }

        params.push(id);
        query += ` WHERE announcement_id = $${params.length} RETURNING *`;

        const result = await pool.query(query, params);
        return res.status(200).json({ announcement: result.rows[0] });
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
            `UPDATE events SET title = $1, event_title = $1, description = $2, event_description = $2, event_date = $3, location = $4, venue = $4, capacity = $5 WHERE event_id = $6 RETURNING *`,
            [eTitle, eDesc, event_date, location || venue || 'TBD', capacity ? Number(capacity) : null, id]
        );
        return res.status(200).json({ event: result.rows[0] });
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
        const result = await pool.query(`SELECT page_id AS id, page_name AS name, page_description AS description, status FROM pages WHERE status = 'Approved'`);
        return res.status(200).json({ pages: result.rows });
    } catch (err) {
        console.error('Error fetching approved pages:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;