const express = require('express');
const router = express.Router();
const pool = require('../db');

// -------- VIEW ANNOUNCEMENTS / DASHBOARD FEED -------- //
router.post('/dashboard-data', async (req, res) => {
    try {
        const annRes = await pool.query(
            `SELECT a.*, a.announcement_id AS id,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Notice') AS page_name,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Notice') AS department_name,
                    COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
             FROM announcements a
             LEFT JOIN pages p ON a.page_id = p.page_id
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE p.page_id IS NULL OR LOWER(p.status) = 'approved'
             ORDER BY a.created_at DESC`
        );

        const evRes = await pool.query(
            `SELECT e.event_id, e.event_id AS id,
                    e.event_title AS title, e.event_title,
                    COALESCE(e.event_description, '') AS content,
                    COALESCE(e.event_description, '') AS description,
                    e.event_date, e.event_date AS date,
                    e.location, e.capacity, e.created_at,
                    e.poster_url, e.page_id,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS page_name,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS department_name,
                    COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
             FROM events e
             LEFT JOIN pages p ON e.page_id = p.page_id
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE e.page_id IS NULL OR LOWER(p.status) = 'approved'
             ORDER BY e.created_at DESC`
        );

        res.status(200).json({
            announcements: annRes.rows,
            events: evRes.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error.message);
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

// -------- VIEW ALL EVENTS -------- //
router.get('/events-data', async (req, res) => {
    try {
        const events = await pool.query(
            `SELECT e.*, e.event_id AS id, e.event_title AS title, e.event_description AS description, e.event_date AS date,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS page_name,
                    COALESCE(p.page_name, d.department_name, o.organization_name, 'University Office') AS department_name,
                    COALESCE(d.department_code, UPPER(LEFT(o.organization_name, 4)), UPPER(LEFT(p.page_name, 4)), 'WMSU') AS department_code
             FROM events e
             LEFT JOIN pages p ON e.page_id = p.page_id
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE p.page_id IS NULL OR LOWER(p.status) = 'approved'
             ORDER BY e.event_date ASC`
        );
        res.status(200).json({ events: events.rows });
    } catch (error) {
        console.error('Error fetching events:', error.message);
        res.status(500).json({ message: 'Server error fetching events.' });
    }
});

// -------- GET USER'S REGISTERED EVENTS (MY EVENTS) -------- //
router.get('/my-events', async (req, res) => {
    try {
        const userId = req.query.student_id || req.query.staff_id;
        
        const events = await pool.query(
            `SELECT e.*, p.page_name AS department_name, er.status AS registration_status 
             FROM event_registrations er
             JOIN events e ON er.event_id = e.event_id
             LEFT JOIN pages p ON e.page_id = p.page_id
             WHERE er.registrant_user_id = $1`,
            [userId]
        );
        res.status(200).json({ events: events.rows });
    } catch (error) {
        console.error('Error fetching user events:', error.message);
        res.status(500).json({ message: 'Server error fetching user events.' });
    }
});

// -------- REGISTER TO AN EVENT -------- //
router.post('/events/:id/register', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { student_id, staff_id } = req.body;
        const userId = student_id || staff_id;

        if (!userId || !eventId) {
            return res.status(400).json({ message: 'User ID and Event ID are required.' });
        }

        const existingRegistration = await pool.query(
            `SELECT * FROM event_registrations WHERE registrant_user_id = $1 AND event_id = $2`,
            [userId, eventId]
        );

        if (existingRegistration.rows.length > 0) {
            return res.status(400).json({ message: 'Already registered for this event.' });
        }

        const newRegistration = await pool.query(
            `INSERT INTO event_registrations (registrant_user_id, event_id, status) VALUES ($1, $2, 'Registered') RETURNING *`,
            [userId, eventId]
        );

        res.status(201).json({
            message: 'Successfully registered for the event!',
            registration: newRegistration.rows[0]
        });
    } catch (error) {
        console.error('Error registering for event:', error.message);
        res.status(500).json({ message: 'Server error registering for event.' });
    }
});

// -------- CANCEL EVENT REGISTRATION -------- //
router.post('/events/:id/cancel', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { student_id, staff_id } = req.body;
        const userId = student_id || staff_id;

        await pool.query(
            `DELETE FROM event_registrations WHERE registrant_user_id = $1 AND event_id = $2`,
            [userId, eventId]
        );

        res.status(200).json({ message: 'Registration cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling event registration:', error.message);
        res.status(500).json({ message: 'Server error cancelling registration.' });
    }
});

// -------- GET NOTIFICATIONS -------- //
router.get('/notifications', async (req, res) => {
    try {
        const userId = req.query.student_id || req.query.staff_id;
        
        const notifications = await pool.query(
            `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        ).catch(() => ({ rows: [] }));

        res.status(200).json({ notifications: notifications.rows });
    } catch (error) {
        console.error('Error fetching notifications:', error.message);
        res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

// -------- MARK NOTIFICATION AS READ -------- //
router.post('/notifications/:id/read', async (req, res) => {
    try {
        const notifId = req.params.id;
        await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE id = $1`,
            [notifId]
        ).catch(() => {});

        res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        console.error('Error updating notification:', error.message);
        res.status(500).json({ message: 'Server error updating notification.' });
    }
});

module.exports = router;