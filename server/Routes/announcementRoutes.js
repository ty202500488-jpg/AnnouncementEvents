const express = require('express');
const router = express.Router();
const pool = require('../db');

// -------- GET DASHBOARD ANNOUNCEMENTS & EVENTS -------- //
router.post('/dashboard-data', async (req, res) => {
    try {
        // Fetch active announcements/events from your database tables
        const announcements = await pool.query(
            `SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5`
        );
        
        res.status(200).json({
            announcements: announcements.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error.message);
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});