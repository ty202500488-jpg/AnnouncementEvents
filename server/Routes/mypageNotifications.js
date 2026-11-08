const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateUser } = require('../middleware/auth');

const handleGetNotifications = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const result = await pool.query(
            `SELECT notification_id AS id,
                    notification_id,
                    recipient_user_id,
                    page_id,
                    post_id,
                    type,
                    title,
                    message,
                    is_read,
                    is_archived,
                    created_at
             FROM notifications
             WHERE recipient_user_id = $1 AND is_archived = FALSE
             ORDER BY created_at DESC`,
            [user.user_id]
        );

        return res.status(200).json({ notifications: result.rows });
    } catch (error) {
        console.error('Error fetching mypage notifications:', error);
        return res.status(500).json({ message: 'Failed to retrieve notifications.' });
    }
};

router.get('/mypage/notifications', handleGetNotifications);
router.get('/staff/notifications', handleGetNotifications);

const handleMarkRead = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        await pool.query(
            `UPDATE notifications SET is_read = TRUE, read_at = NOW()
             WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), user.user_id]
        );

        return res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to mark notification as read.' });
    }
};

router.put('/mypage/notifications/:id/read', handleMarkRead);
router.post('/mypage/notifications/:id/read', handleMarkRead);
router.patch('/mypage/notifications/:id/read', handleMarkRead);

const handleMarkAllRead = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        await pool.query(
            `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE recipient_user_id = $1`,
            [user.user_id]
        );

        return res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to mark all notifications as read.' });
    }
};

router.put('/mypage/notifications/read-all', handleMarkAllRead);
router.post('/mypage/notifications/read-all', handleMarkAllRead);
router.patch('/mypage/notifications/read-all', handleMarkAllRead);

const handleArchive = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        await pool.query(
            `UPDATE notifications SET is_archived = TRUE
             WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), user.user_id]
        );

        return res.status(200).json({ message: 'Notification archived.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to archive notification.' });
    }
};

router.put('/mypage/notifications/:id/archive', handleArchive);
router.post('/mypage/notifications/:id/archive', handleArchive);
router.patch('/mypage/notifications/:id/archive', handleArchive);

router.delete('/mypage/notifications/:id', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        await pool.query(
            `DELETE FROM notifications WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), user.user_id]
        );

        return res.status(200).json({ message: 'Notification deleted.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete notification.' });
    }
});

module.exports = router;
