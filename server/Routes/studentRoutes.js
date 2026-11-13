const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../middleware/auth');
const {
    ensureNotificationSchema,
    getUserNotificationPreferences,
    updateUserNotificationPreferences,
    formatNotificationRow,
    ensureUpcomingEventReminders
} = require('../utils/notificationService');

ensureNotificationSchema(pool).catch((err) => {
    console.warn('Warning: failed to ensure notification schema:', err.message);
});

async function resolveUserId(req) {
    if (req.query?.student_id) return Number(req.query.student_id);
    if (req.query?.staff_id) return Number(req.query.staff_id);
    if (req.body?.student_id) return Number(req.body.student_id);

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET || 'fallback_secret');
            return Number(decoded.userId ?? decoded.id ?? decoded.user_id);
        } catch (_) {
            return null;
        }
    }
    return null;
}

// -------- DASHBOARD FEED -------- //
const handleStudentDashboard = async (req, res) => {
    try {
        const userId = await resolveUserId(req);

        const announcements = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS announcement_id,
                    p.page_id,
                    p.creator_user_id,
                    p.category_id,
                    COALESCE(pc.category_name, 'General') AS category_name,
                    p.title,
                    p.content,
                    p.content AS description,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    p.audience,
                    p.is_pinned,
                    p.status,
                    p.created_at,
                    pg.page_name,
                    pg.page_name AS department_name,
                    pg.avatar_url AS page_avatar_url,
                    COALESCE(pg.page_code, 'WMSU') AS code,
                    CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_followed
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN page_follows pf ON p.page_id = pf.page_id AND pf.follower_user_id = $1
             WHERE p.post_type = 'announcement'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             ORDER BY p.is_pinned DESC,
                      (CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                      p.created_at DESC`,
            [userId]
        );

        const events = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS event_id,
                    p.page_id,
                    p.title,
                    p.title AS event_title,
                    p.content AS description,
                    p.content AS event_description,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS poster_url,
                    p.status,
                    p.created_at,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.location AS venue,
                    ed.capacity,
                    ed.capacity AS max_capacity,
                    pg.page_name,
                    pg.page_name AS department_name,
                    pg.avatar_url AS page_avatar_url,
                    COALESCE(pg.page_code, 'WMSU') AS code,
                    COUNT(er.registration_id) FILTER (WHERE LOWER(er.status) != 'cancelled')::int AS registered_count,
                    CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_followed,
                    CASE WHEN $1::int IS NOT NULL AND EXISTS(
                        SELECT 1 FROM event_registrations er2
                        WHERE er2.event_post_id = p.post_id AND er2.registrant_user_id = $1 AND LOWER(er2.status) != 'cancelled'
                    ) THEN TRUE ELSE FALSE END AS is_registered
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             LEFT JOIN page_follows pf ON p.page_id = pf.page_id AND pf.follower_user_id = $1
             WHERE p.post_type = 'event'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             GROUP BY p.post_id, ed.post_id, pg.page_id, pf.follow_id
             ORDER BY p.is_pinned DESC,
                      (CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                      p.created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            announcements: announcements.rows,
            events: events.rows
        });
    } catch (error) {
        console.error('Error fetching student dashboard data:', error.message);
        return res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
};

router.get('/dashboard-data', handleStudentDashboard);
router.post('/dashboard-data', handleStudentDashboard);

// -------- VIEW ALL EVENTS -------- //
router.get('/events-data', async (req, res) => {
    try {
        const events = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS event_id,
                    p.page_id,
                    p.title,
                    p.title AS event_title,
                    p.content AS description,
                    p.content AS event_description,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS poster_url,
                    p.status,
                    p.created_at,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.location AS venue,
                    ed.capacity,
                    ed.capacity AS max_capacity,
                    pg.page_name,
                    pg.page_name AS department_name,
                    COUNT(er.registration_id) FILTER (WHERE LOWER(er.status) != 'cancelled')::int AS registered_count
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             WHERE p.post_type = 'event'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             GROUP BY p.post_id, ed.post_id, pg.page_id
             ORDER BY ed.event_date ASC`
        );
        return res.status(200).json({ events: events.rows });
    } catch (error) {
        console.error('Error fetching student events:', error.message);
        return res.status(500).json({ message: 'Server error fetching events.' });
    }
});

// -------- STUDENT NOTIFICATIONS -------- //
router.get('/notifications/preferences', async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const preferences = await getUserNotificationPreferences(pool, authUser.user_id, authUser.role_name);
        return res.status(200).json({ preferences });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load notification preferences.' });
    }
});

const saveStudentPreferences = async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const incoming = req.body?.preferences || req.body?.settings || req.body || {};
        const preferences = await updateUserNotificationPreferences(pool, authUser.user_id, authUser.role_name, incoming);
        return res.status(200).json({ message: 'Notification preferences saved.', preferences });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to save notification preferences.' });
    }
};
router.put('/notifications/preferences', saveStudentPreferences);
router.post('/notifications/preferences', saveStudentPreferences);

router.get('/notifications', async (req, res) => {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return res.status(200).json({ notifications: [], unreadCount: 0 });
        }

        await ensureUpcomingEventReminders(pool, userId, 'student');

        const includeArchived = req.query.includeArchived === 'true';
        const notifications = await pool.query(
            `SELECT n.notification_id, n.recipient_user_id, n.actor_user_id,
                    n.page_id, n.post_id, n.notification_scope, n.type,
                    n.title, n.message, n.is_read, n.read_at, n.is_archived, n.created_at,
                    pg.page_name, po.post_type
             FROM notifications n
             LEFT JOIN pages pg ON n.page_id = pg.page_id
             LEFT JOIN posts po ON n.post_id = po.post_id
             WHERE n.recipient_user_id = $1
               AND LOWER(n.notification_scope) = 'student'
               AND ($2::boolean = TRUE OR n.is_archived = FALSE)
             ORDER BY n.created_at DESC
             LIMIT 100`,
            [userId, includeArchived]
        );

        const formatted = notifications.rows.map(formatNotificationRow);
        const unreadCount = formatted.filter((n) => !n.is_read && !n.is_archived).length;
        return res.status(200).json({ notifications: formatted, unreadCount });
    } catch (error) {
        console.error('Error fetching student notifications:', error.message);
        return res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

const markNotifRead = async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const upd = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
             WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), authUser.user_id]
        );
        if (upd.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error updating notification.' });
    }
};
router.post('/notifications/:id/read', markNotifRead);
router.put('/notifications/:id/read', markNotifRead);
router.patch('/notifications/:id/read', markNotifRead);

const markAllRead = async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
             WHERE recipient_user_id = $1
               AND LOWER(notification_scope) = 'student'
               AND is_read = FALSE`,
            [authUser.user_id]
        );
        return res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error marking notifications as read.' });
    }
};
router.post('/notifications/read-all', markAllRead);
router.put('/notifications/read-all', markAllRead);
router.patch('/notifications/read-all', markAllRead);

const archiveStudentNotif = async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const isArchived = req.body?.is_archived !== undefined ? Boolean(req.body.is_archived) : true;
        const upd = await pool.query(
            `UPDATE notifications
             SET is_archived = $1
             WHERE notification_id = $2 AND recipient_user_id = $3`,
            [isArchived, Number(req.params.id), authUser.user_id]
        );
        if (upd.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.status(200).json({ message: isArchived ? 'Notification archived.' : 'Notification unarchived.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error updating archive state.' });
    }
};
router.post('/notifications/:id/archive', archiveStudentNotif);
router.put('/notifications/:id/archive', archiveStudentNotif);
router.patch('/notifications/:id/archive', archiveStudentNotif);

router.delete('/notifications/:id', async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const del = await pool.query(
            `DELETE FROM notifications WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), authUser.user_id]
        );
        if (del.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.status(200).json({ message: 'Notification deleted.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error deleting notification.' });
    }
});

module.exports = router;
