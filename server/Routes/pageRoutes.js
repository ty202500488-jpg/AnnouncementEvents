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

// HELPER: Fetch user's managed page details
async function getUserPageDetails(userId) {
    try {
        const pageRes = await pool.query(
            `SELECT page_id, page_name FROM pages WHERE created_by = $1 ORDER BY page_id DESC LIMIT 1`,
            [userId]
        );
        return pageRes.rows.length > 0 ? pageRes.rows[0] : { page_id: null, page_name: 'Student Affairs Office' };
    } catch (err) {
        console.error('Error in getUserPageDetails:', err.message);
        return { page_id: null, page_name: 'Student Affairs Office' };
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

// FETCH DASHBOARD FEED DATA
router.get('/dashboard-data', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const annRes = await pool.query(
            `SELECT a.announcement_id, a.title, COALESCE(a.content, a.description) as content, 
                    a.created_at, a.image_url, a.page_id, p.page_name 
             FROM announcements a 
             LEFT JOIN pages p ON a.page_id = p.page_id 
             ORDER BY a.created_at DESC`
        ).catch((err) => {
            console.error('Error fetching announcements:', err.message);
            return { rows: [] };
        });

        const evRes = await pool.query(
            `SELECT e.event_id, COALESCE(e.event_title, e.title) as event_title, 
                    COALESCE(e.event_description, e.description) as event_description, 
                    e.event_date, COALESCE(e.location, e.venue) as location, e.capacity, 
                    e.created_at, e.image_url, e.page_id, p.page_name 
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
});

// CREATE ANNOUNCEMENT (Fixed to match table schema)
router.post('/announcements', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { title, content, description, pageId, image_url } = req.body;
        if (!title || (!content && !description)) {
            return res.status(400).json({ message: 'Title and content are required.' });
        }

        const userPage = await getUserPageDetails(userId);
        const targetPageId = pageId || userPage.page_id;
        const bodyText = content || description || '';

        if (!targetPageId) {
            return res.status(400).json({ message: 'You do not have an active/approved page to post announcements.' });
        }

        const result = await pool.query(
            `INSERT INTO announcements (page_id, creator_user_id, title, content, description, image_url, status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, 'Published', NOW(), NOW()) 
             RETURNING announcement_id, title, content, description, page_id, image_url, created_at`,
            [targetPageId, userId, title, bodyText, bodyText, image_url || null]
        );

        const newAnnouncement = {
            ...result.rows[0],
            page_name: userPage.page_name || 'Student Affairs Office'
        };

        return res.status(201).json({ announcement: newAnnouncement });
    } catch (err) {
        console.error('CRITICAL ERROR publishing announcement:', err.message);
        return res.status(500).json({ message: 'Database Insert Error: ' + err.message });
    }
});

// CREATE EVENT (Fixed to match table schema)
router.post('/events', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { event_title, title, event_description, description, pageId, event_date, location, venue, capacity, image_url, poster_url } = req.body;
        const eTitle = event_title || title;
        const eDesc = event_description || description || '';

        if (!eTitle || !eDesc) {
            return res.status(400).json({ message: 'Event title and description are required.' });
        }

        const userPage = await getUserPageDetails(userId);
        const targetPageId = pageId || userPage.page_id;

        if (!targetPageId) {
            return res.status(400).json({ message: 'You do not have an active/approved page to post events.' });
        }

        const eDate = event_date || new Date().toISOString().split('T')[0];
        const eVenue = location || venue || 'TBD';
        const imgUrl = image_url || poster_url || null;

        const result = await pool.query(
            `INSERT INTO events (page_id, creator_user_id, event_title, title, event_description, description, event_date, venue, location, capacity, image_url, poster_url, status, created_at) 
             VALUES ($1, $2, $3, $3, $4, $4, $5, $6, $6, $7, $8, $8, 'Published', NOW()) 
             RETURNING event_id, event_title, event_description, page_id, event_date, venue, location, capacity, image_url, created_at`,
            [targetPageId, userId, eTitle, eDesc, eDate, eVenue, capacity ? Number(capacity) : null, imgUrl]
        );

        const newEvent = {
            ...result.rows[0],
            page_name: userPage.page_name || 'Student Affairs Office'
        };

        return res.status(201).json({ event: newEvent });
    } catch (err) {
        console.error('CRITICAL ERROR publishing event:', err.message);
        return res.status(500).json({ message: 'Database Insert Error: ' + err.message });
    }
});

// EDIT ANNOUNCEMENT
router.put('/announcements/:id', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        const { id } = req.params;
        const { title, content, description } = req.body;
        const bodyText = content || description || '';

        const result = await pool.query(
            `UPDATE announcements SET title = $1, content = $2, description = $2, updated_at = NOW() WHERE announcement_id = $3 RETURNING *`,
            [title, bodyText, id]
        );
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