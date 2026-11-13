const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateUser } = require('../middleware/auth');
const {
    ensureNotificationSchema,
    formatNotificationRow,
    ensureUpcomingEventReminders
} = require('../utils/notificationService');

ensureNotificationSchema(pool).catch((err) => {
    console.warn('Warning: failed to ensure notification schema:', err.message);
});

const fetchScopedNotifications = async (req, res, scopes) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        await ensureUpcomingEventReminders(pool, user.user_id, user.role_name);

        const includeArchived = req.query.includeArchived === 'true';
        const result = await pool.query(
            `SELECT n.notification_id,
                    n.recipient_user_id,
                    n.actor_user_id,
                    n.page_id,
                    n.post_id,
                    n.notification_scope,
                    n.type,
                    n.title,
                    n.message,
                    n.is_read,
                    n.read_at,
                    n.is_archived,
                    n.created_at,
                    pg.page_name,
                    po.post_type
             FROM notifications n
             LEFT JOIN pages pg ON n.page_id = pg.page_id
             LEFT JOIN posts po ON n.post_id = po.post_id
             WHERE n.recipient_user_id = $1
               AND LOWER(n.notification_scope) = ANY($2::text[])
               AND ($3::boolean = TRUE OR n.is_archived = FALSE)
             ORDER BY n.created_at DESC
             LIMIT 100`,
            [user.user_id, scopes, includeArchived]
        );

        const notifications = result.rows.map(formatNotificationRow);
        const unreadCount = notifications.filter((n) => !n.is_read && !n.is_archived).length;
        return res.status(200).json({ notifications, unreadCount });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ message: 'Failed to retrieve notifications.' });
    }
};

router.get('/mypage/notifications', (req, res) => fetchScopedNotifications(req, res, ['mypage']));
router.get('/staff/notifications', (req, res) => fetchScopedNotifications(req, res, ['staff', 'mypage']));

const handleMarkRead = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const upd = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
             WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), user.user_id]
        );
        if (upd.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        return res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to mark notification as read.' });
    }
};

router.put('/mypage/notifications/:id/read', handleMarkRead);
router.post('/mypage/notifications/:id/read', handleMarkRead);
router.patch('/mypage/notifications/:id/read', handleMarkRead);
router.put('/staff/notifications/:id/read', handleMarkRead);
router.post('/staff/notifications/:id/read', handleMarkRead);
router.patch('/staff/notifications/:id/read', handleMarkRead);

const handleMarkAllRead = (scopes) => async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
             WHERE recipient_user_id = $1
               AND LOWER(notification_scope) = ANY($2::text[])
               AND is_read = FALSE`,
            [user.user_id, scopes]
        );

        return res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to mark all notifications as read.' });
    }
};

router.put('/mypage/notifications/read-all', handleMarkAllRead(['mypage']));
router.post('/mypage/notifications/read-all', handleMarkAllRead(['mypage']));
router.patch('/mypage/notifications/read-all', handleMarkAllRead(['mypage']));
router.put('/staff/notifications/read-all', handleMarkAllRead(['staff', 'mypage']));
router.post('/staff/notifications/read-all', handleMarkAllRead(['staff', 'mypage']));
router.patch('/staff/notifications/read-all', handleMarkAllRead(['staff', 'mypage']));

const handleArchive = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const isArchived = req.body?.is_archived !== undefined ? Boolean(req.body.is_archived) : true;
        const upd = await pool.query(
            `UPDATE notifications
             SET is_archived = $1
             WHERE notification_id = $2 AND recipient_user_id = $3`,
            [isArchived, Number(req.params.id), user.user_id]
        );
        if (upd.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        return res.status(200).json({ message: isArchived ? 'Notification archived.' : 'Notification unarchived.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to archive notification.' });
    }
};

router.put('/mypage/notifications/:id/archive', handleArchive);
router.post('/mypage/notifications/:id/archive', handleArchive);
router.patch('/mypage/notifications/:id/archive', handleArchive);
router.put('/staff/notifications/:id/archive', handleArchive);
router.post('/staff/notifications/:id/archive', handleArchive);
router.patch('/staff/notifications/:id/archive', handleArchive);

const handleDelete = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const del = await pool.query(
            `DELETE FROM notifications WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), user.user_id]
        );
        if (del.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        return res.status(200).json({ message: 'Notification deleted.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete notification.' });
    }
};

router.delete('/mypage/notifications/:id', handleDelete);
router.delete('/staff/notifications/:id', handleDelete);

module.exports = router;
