const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Authentication Helper
async function authenticateUser(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authentication required.' });
        return null;
    }

    const token = authHeader.slice(7).trim();
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    try {
        const decoded = jwt.verify(token, jwtSecret);
        return Number(decoded.userId ?? decoded.id ?? decoded.user_id);
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token.' });
        return null;
    }
}

// GET /api/mypage/notifications
router.get('/mypage/notifications', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const result = await pool.query(
            `SELECT id, title, message, type, url, is_read, is_archived, created_at 
             FROM notifications 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        ).catch(() => ({ rows: [] }));

        res.status(200).json({ notifications: result.rows });
    } catch (err) {
        console.error('Fetch notifications error:', err);
        res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
});

// GET /api/staff/notifications (Fixes StaffDashboardLayout.jsx 404 error)
router.get('/staff/notifications', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const result = await pool.query(
            `SELECT id, title, message, type, url, is_read, is_archived, created_at 
             FROM notifications 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        ).catch(() => ({ rows: [] }));

        res.status(200).json({ notifications: result.rows });
    } catch (err) {
        console.error('Fetch staff notifications error:', err);
        res.status(500).json({ message: 'Failed to fetch staff notifications.' });
    }
});

// PUT /api/mypage/notifications/read-all
router.put('/mypage/notifications/read-all', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
            [userId]
        ).catch(() => {});

        res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notifications.' });
    }
});

// PUT /api/mypage/notifications/:id/read
router.put('/mypage/notifications/:id/read', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
            [req.params.id, userId]
        ).catch(() => {});

        res.status(200).json({ message: 'Notification marked as read.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notification.' });
    }
});

// PUT /api/mypage/notifications/:id/archive
router.put('/mypage/notifications/:id/archive', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        const { is_archived } = req.body;
        await pool.query(
            `UPDATE notifications SET is_archived = $1 WHERE id = $2 AND user_id = $3`,
            [is_archived, req.params.id, userId]
        ).catch(() => {});

        res.status(200).json({ message: 'Archive status updated.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to archive notification.' });
    }
});

// DELETE /api/mypage/notifications/:id
router.delete('/mypage/notifications/:id', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);
        if (!userId) return;

        await pool.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
            [req.params.id, userId]
        ).catch(() => {});

        res.status(200).json({ message: 'Notification deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete notification.' });
    }
});

module.exports = router;