const express = require('express');
const router = express.Router();
const pool = require('../db');

// -------- VIEW ANNOUNCEMENTS / DASHBOARD FEED -------- //
router.post('/dashboard-data', async (req, res) => {
    try {
        const announcements = await pool.query(
            `SELECT a.*, p.page_name AS department_name, 
                    CASE WHEN p.department_id IS NOT NULL THEN 'Academic College' ELSE 'Student Organization' END AS department_code 
             FROM announcements a 
             LEFT JOIN pages p ON a.page_id = p.page_id 
             ORDER BY a.created_at DESC`
        );
        res.status(200).json({ announcements: announcements.rows });
    } catch (error) {
        console.error('Error fetching dashboard data:', error.message);
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

// -------- VIEW ALL EVENTS -------- //
router.get('/events-data', async (req, res) => {
    try {
        const events = await pool.query(
            `SELECT e.*, p.page_name AS department_name 
             FROM events e 
             LEFT JOIN pages p ON e.page_id = p.page_id 
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