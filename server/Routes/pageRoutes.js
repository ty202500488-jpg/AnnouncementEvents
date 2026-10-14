const express = require('express');
const router = express.Router();
const pool = require('../db');

// -------- CREATE NEW DEPARTMENT/ORG PAGE (PENDING APPROVAL) -------- //
router.post('/create-page', async (req, res) => {
    try {
        const { pageName, pageCategory, pageBio } = req.body;

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

// -------- GET APPROVED PAGES (FOR SIDEBAR / DIRECTORY) -------- //
router.get('/approved-pages', async (req, res) => {
    try {
        const pages = await pool.query(
            `SELECT * FROM pages WHERE status = 'Approved' ORDER BY page_name ASC`
        );
        res.status(200).json({ pages: pages.rows });
    } catch (error) {
        console.error('Error fetching approved pages:', error.message);
        res.status(500).json({ message: 'Server error fetching approved pages.' });
    }
});

// -------- FOLLOW / UNFOLLOW A PAGE -------- //
router.post('/follow-page', async (req, res) => {
    try {
        const { userId, pageId } = req.body;
        
        const existing = await pool.query(
            `SELECT * FROM page_followers WHERE user_id = $1 AND page_id = $2`,
            [userId, pageId]
        );

        if (existing.rows.length > 0) {
            await pool.query(`DELETE FROM page_followers WHERE user_id = $1 AND page_id = $2`, [userId, pageId]);
            return res.status(200).json({ message: 'Unfollowed page successfully.', following: false });
        } else {
            await pool.query(`INSERT INTO page_followers (user_id, page_id) VALUES ($1, $2)`, [userId, pageId]);
            return res.status(200).json({ message: 'Followed page successfully.', following: true });
        }
    } catch (error) {
        console.error('Error toggling follow status:', error.message);
        res.status(500).json({ message: 'Server error toggling follow status.' });
    }
});

module.exports = router;