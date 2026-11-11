const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

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
                    p.image_url,
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
                    p.image_url,
                    p.image_url AS poster_url,
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
                    p.image_url,
                    p.image_url AS poster_url,
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
router.get('/notifications', async (req, res) => {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return res.status(200).json({ notifications: [] });
        }

        const notifications = await pool.query(
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
            [userId]
        );

        return res.status(200).json({ notifications: notifications.rows });
    } catch (error) {
        console.error('Error fetching student notifications:', error.message);
        return res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

const markNotifRead = async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE notification_id = $1`,
            [Number(req.params.id)]
        );
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
        const userId = await resolveUserId(req);
        if (userId) {
            await pool.query(
                `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE recipient_user_id = $1`,
                [userId]
            );
        }
        return res.status(200).json({ message: 'All notifications marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error marking notifications as read.' });
    }
};
router.post('/notifications/read-all', markAllRead);
router.put('/notifications/read-all', markAllRead);
router.patch('/notifications/read-all', markAllRead);

module.exports = router;
