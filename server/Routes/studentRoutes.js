const express = require('express');
const router = express.Router();
const pool = require('../db');

// -------- VIEW ANNOUNCEMENTS & EVENTS -------- //
router.get('/announcements', async (req, res) => {
    try {
        const announcements = await pool.query(
            `SELECT * FROM announcements ORDER BY created_at DESC`
        );
        res.status(200).json(announcements.rows);
    } catch (error) {
        console.error('Error fetching announcements:', error.message);
        res.status(500).json({ message: 'Server error fetching announcements.' });
    }
});

// -------- REGISTER TO AN EVENT -------- //
router.post('/events/register', async (req, res) => {
    try {
        const { userId, eventId } = req.body;

        if (!userId || !eventId) {
            return res.status(400).json({ message: 'User ID and Event ID are required.' });
        }

        // Check if already registered using registrant_user_id (matches schema)
        const existingRegistration = await pool.query(
            `SELECT * FROM event_registrations WHERE registrant_user_id = $1 AND event_id = $2`,
            [userId, eventId]
        );

        if (existingRegistration.rows.length > 0) {
            return res.status(400).json({ message: 'Already registered for this event.' });
        }

        // Register user
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

// -------- GET STUDENT NOTIFICATIONS -------- //
router.get('/notifications/:userId', async (req, res) => {
    try {
        // Return empty array safely if notifications table is not yet implemented
        res.status(200).json([]);
    } catch (error) {
        console.error('Error fetching notifications:', error.message);
        res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

module.exports = router;