const express = require('express');
const router = express.Router();
const pool = require('../db');

// -------- CREATE NEW DEPARTMENT/ORG PAGE (PENDING APPROVAL) -------- //
router.post('/create-page', async (req, res) => {
    try {
        const { pageName, pageCategory, pageBio } = req.body;

        // Status is set to 'Pending' so it awaits admin approval
        const newPage = await pool.query(
            `INSERT INTO pages (page_name, page_type, description, status) 
             VALUES ($1, $2, $3, 'Pending') RETURNING *`,
            [pageName, pageCategory, pageBio]
        );

        res.status(201).json({
            message: 'Page submitted successfully! Awaiting admin approval.',
            page: newPage.rows[0]
        });
    } catch (error) {
        console.error('Error creating page:', error.message);
        res.status(500).json({ message: 'Server error creating page.' });
    }
});

module.exports = router;