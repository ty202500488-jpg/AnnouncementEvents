const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// =====================================================
// AUTHENTICATION HELPER
// =====================================================
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

// =====================================================
// CREATE NEW PAGE
// POST /api/create-page
// =====================================================
router.post('/create-page', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { pageName, pageDescription, pageCategory, departmentId, organizationId } = req.body;

        if (!pageName || !pageName.trim() || !pageCategory || !pageCategory.trim()) {
            return res.status(400).json({ message: 'Page name and category are required.' });
        }

        const queryText = `
            INSERT INTO pages (page_name, page_description, description, department_id, organization_id, created_by, status)
            VALUES ($1, $2, $2, $3, $4, $5, 'Pending')
            RETURNING *;
        `;

        const values = [
            pageName.trim(),
            pageDescription || '',
            departmentId ? Number(departmentId) : null,
            organizationId ? Number(organizationId) : null,
            userId
        ];

        const result = await pool.query(queryText, values);
        return res.status(201).json({
            message: 'Page submitted successfully! Awaiting admin approval.',
            page: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating page:', error);
        return res.status(500).json({ message: 'Failed to create page: ' + error.message });
    }
});

// =====================================================
// CHECK USER'S PAGE STATUS
// GET /api/my-page-status
// =====================================================
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

// =====================================================
// UPDATE PAGE INFORMATION
// PUT /api/mypage/update
// =====================================================
router.put('/mypage/update', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { pageName, category, description } = req.body;
        if (!pageName || !pageName.trim()) {
            return res.status(400).json({ message: 'Page name is required.' });
        }

        const pageCheck = await pool.query(
            `SELECT page_id FROM pages WHERE created_by = $1 ORDER BY page_id DESC LIMIT 1`,
            [userId]
        );

        if (pageCheck.rows.length === 0) {
            return res.status(404).json({ message: 'No page found for this user.' });
        }

        const pageId = pageCheck.rows[0].page_id;
        const desc = description || '';

        const updateRes = await pool.query(
            `UPDATE pages 
             SET page_name = $1, page_description = $2, description = $2, updated_at = NOW()
             WHERE page_id = $3 
             RETURNING *`,
            [pageName.trim(), desc, pageId]
        );

        return res.status(200).json({
            message: 'Page updated successfully',
            page: updateRes.rows[0]
        });
    } catch (error) {
        console.error('Error updating page:', error);
        return res.status(500).json({ message: 'Failed to update page: ' + error.message });
    }
});

// =====================================================
// GET PAGE POSTS
// GET /api/mypage/posts?pageId=...
// =====================================================
router.get('/mypage/posts', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const pageId = req.query.pageId;
        if (!pageId) {
            return res.status(400).json({ message: 'Page ID is required.' });
        }

        const announcements = await pool.query(
            `SELECT announcement_id AS id, title, description, created_at, 'Announcement' AS type, 'Published' AS status 
             FROM announcements WHERE page_id = $1`,
            [pageId]
        ).catch(() => ({ rows: [] }));

        const events = await pool.query(
            `SELECT event_id AS id, title, description, event_date AS date, venue, created_at, 'Event' AS type, 'Published' AS status 
             FROM events WHERE page_id = $1`,
            [pageId]
        ).catch(() => ({ rows: [] }));

        const combined = [...announcements.rows, ...events.rows];
        combined.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

        return res.status(200).json({ posts: combined });
    } catch (error) {
        console.error('Error fetching page posts:', error);
        return res.status(500).json({ message: 'Failed to fetch page posts.' });
    }
});

// =====================================================
// CREATE ANNOUNCEMENT / EVENT
// =====================================================
router.post('/announcements', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        const { title, description, pageId } = req.body;
        const result = await pool.query(
            `INSERT INTO announcements (title, description, page_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [title, description, pageId]
        );
        res.status(201).json({ announcement: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/events', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;
        const { title, description, pageId, eventDate, venue } = req.body;
        const result = await pool.query(
            `INSERT INTO events (title, description, page_id, event_date, venue, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
            [title, description, pageId, eventDate, venue]
        );
        res.status(201).json({ event: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/approved-pages', async (req, res) => {
    try {
        const result = await pool.query(`SELECT page_id AS id, page_name AS name, page_description AS description, status FROM pages WHERE status = 'Approved'`);
        res.status(200).json({ pages: result.rows });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;