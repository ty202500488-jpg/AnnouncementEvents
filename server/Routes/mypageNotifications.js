const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Mounted at /api/mypage/notifications
// Every route acts only on the logged-in user's own notifications.

router.use(authenticateToken);

// Validates :id and stores it as a number on req.notificationId.
router.param('id', (req, res, next, value) => {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid notification ID.' });
    }
    req.notificationId = id;
    next();
});

// GET /api/mypage/notifications
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, message, type, url, is_read, is_archived, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.status(200).json({ notifications: result.rows });
    } catch (err) {
        console.error('[notifications] Fetch failed:', err);
        res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
});

// PUT /api/mypage/notifications/read-all
// (Declared before /:id routes so "read-all" is never treated as an ID.)
router.put('/read-all', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
            [req.user.id]
        );
        res.status(200).json({ message: 'All notifications marked as read.', updated: result.rowCount });
    } catch (err) {
        console.error('[notifications] Mark all read failed:', err);
        res.status(500).json({ message: 'Failed to update notifications.' });
    }
});

// PUT /api/mypage/notifications/:id/read
router.put('/:id/read', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
            [req.notificationId, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        res.status(200).json({ message: 'Notification marked as read.' });
    } catch (err) {
        console.error('[notifications] Mark read failed:', err);
        res.status(500).json({ message: 'Failed to update notification.' });
    }
});

// PUT /api/mypage/notifications/:id/archive
// Body: { is_archived: true | false }
router.put('/:id/archive', async (req, res) => {
    const isArchived = req.body?.is_archived;
    if (typeof isArchived !== 'boolean') {
        return res.status(400).json({ message: 'is_archived must be true or false.' });
    }

    try {
        const result = await pool.query(
            `UPDATE notifications SET is_archived = $1 WHERE id = $2 AND user_id = $3`,
            [isArchived, req.notificationId, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        res.status(200).json({ message: isArchived ? 'Notification archived.' : 'Notification restored.' });
    } catch (err) {
        console.error('[notifications] Archive failed:', err);
        res.status(500).json({ message: 'Failed to archive notification.' });
    }
});

// DELETE /api/mypage/notifications/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
            [req.notificationId, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        res.status(200).json({ message: 'Notification deleted.' });
    } catch (err) {
        console.error('[notifications] Delete failed:', err);
        res.status(500).json({ message: 'Failed to delete notification.' });
    }
});

module.exports = router;
