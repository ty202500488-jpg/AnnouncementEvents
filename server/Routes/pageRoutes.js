const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// =====================================================
// AUTHENTICATION HELPER (Hardened)
// =====================================================
async function authenticateUser(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            message: 'Authentication required. Please log in.'
        });
        return null;
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        res.status(401).json({
            message: 'Authentication token is missing.'
        });
        return null;
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    let decoded;
    try {
        decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
        res.status(401).json({
            message: 'Invalid or expired authentication token.'
        });
        return null;
    }

    // Extract user ID from common JWT payload keys
    const tokenUserId = decoded.userId ?? decoded.id ?? decoded.user_id;
    const userId = Number(tokenUserId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        res.status(401).json({
            message: 'Token does not contain a valid user ID.'
        });
        return null;
    }

    try {
        const result = await pool.query(
            'SELECT user_id FROM users WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            res.status(401).json({
                message: 'Authenticated user was not found in the database.'
            });
            return null;
        }

        return userId;
    } catch (error) {
        console.error('Authentication database error:', error);
        res.status(500).json({
            message: 'Failed to verify authenticated user.'
        });
        return null;
    }
}

// =====================================================
// CREATE NEW DEPARTMENT / ORGANIZATION PAGE
// POST /create-page
// =====================================================
router.post('/create-page', async (req, res) => {
    try {
        console.log('=== CREATE PAGE REQUEST RECEIVED ===');

        // 1. Authenticate the actual page creator.
        const userId = await authenticateUser(req, res);

        // Explicitly halt execution if authentication failed
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            return;
        }

        // 2. Read request fields.
        const {
            pageName,
            pageDescription,
            pageCategory,
            departmentId,
            organizationId
        } = req.body;

        if (
            typeof pageName !== 'string' ||
            !pageName.trim() ||
            typeof pageCategory !== 'string' ||
            !pageCategory.trim()
        ) {
            return res.status(400).json({
                message: 'Page name and category are required.'
            });
        }

        // 3. Validate IDs.
        const parseId = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const id = Number(value);
            if (!Number.isSafeInteger(id) || id <= 0) {
                return NaN;
            }
            return id;
        };

        let assignedDeptId = null;
        let assignedOrgId = null;

        // 4. Determine the page owner type.
        if (
            pageCategory === 'Academic College' ||
            pageCategory === 'Administrative Office'
        ) {
            assignedDeptId = parseId(departmentId);

            if (assignedDeptId === null || !Number.isSafeInteger(assignedDeptId)) {
                return res.status(400).json({
                    message: 'A valid department ID is required.'
                });
            }

            if (organizationId) {
                return res.status(400).json({
                    message: 'Department pages cannot have an organization ID.'
                });
            }
        } else if (
            pageCategory === 'Student Organization' ||
            pageCategory === 'Campus Council'
        ) {
            assignedOrgId = parseId(organizationId);

            if (assignedOrgId === null || !Number.isSafeInteger(assignedOrgId)) {
                return res.status(400).json({
                    message: 'A valid organization ID is required.'
                });
            }

            if (departmentId) {
                return res.status(400).json({
                    message: 'Organization pages cannot have a department ID.'
                });
            }
        } else {
            return res.status(400).json({
                message: 'Invalid page category.'
            });
        }

        // 5. Validate optional description.
        if (
            pageDescription !== undefined &&
            pageDescription !== null &&
            typeof pageDescription !== 'string'
        ) {
            return res.status(400).json({
                message: 'Page description must be text.'
            });
        }

        // 6. Create page with verified userId.
        const queryText = `
            INSERT INTO pages (
                page_name,
                page_description,
                department_id,
                organization_id,
                created_by,
                status
            )
            VALUES ($1, $2, $3, $4, $5, 'Pending')
            RETURNING *;
        `;

        const values = [
            pageName.trim(),
            pageDescription || '',
            assignedDeptId,
            assignedOrgId,
            userId
        ];

        const result = await pool.query(queryText, values);
        const newPage = result.rows[0];

        console.log('Page created successfully:', {
            pageId: newPage.page_id,
            createdBy: newPage.created_by,
            status: newPage.status
        });

        return res.status(201).json({
            message: 'Page submitted successfully! Awaiting admin approval.',
            page: newPage
        });

    } catch (error) {
        console.error('Error creating page:', error);

        return res.status(500).json({
            message: 'Failed to create page.'
        });
    }
});

// =====================================================
// CHECK USER'S PAGE STATUS
// GET /my-page-status
// =====================================================
router.get('/my-page-status', async (req, res) => {
    try {
        const userId = await authenticateUser(req, res);

        if (!userId) {
            return;
        }

        const pageQuery = await pool.query(
            `SELECT
                p.page_id,
                p.page_name,
                p.page_description,
                p.status,
                p.department_id,
                p.organization_id
             FROM pages p
             LEFT JOIN page_staff ps
                ON p.page_id = ps.page_id
                AND ps.user_id = $1
                AND ps.status = 'Active'
             WHERE p.created_by = $1
                OR ps.user_id = $1
             ORDER BY p.page_id DESC
             LIMIT 1`,
            [userId]
        );

        if (pageQuery.rows.length === 0) {
            return res.status(200).json({
                exists: false,
                status: 'none'
            });
        }

        const page = pageQuery.rows[0];

        return res.status(200).json({
            exists: true,
            pageId: page.page_id,
            pageName: page.page_name,
            description: page.page_description,
            status: String(page.status || '').toLowerCase(),
            category: page.department_id
                ? 'Academic College'
                : 'Student Organization'
        });

    } catch (error) {
        console.error('Error fetching page status:', error);

        return res.status(500).json({
            message: 'Failed to fetch page status.'
        });
    }
});

// =====================================================
// GET APPROVED PAGES
// GET /approved-pages
// =====================================================
router.get('/approved-pages', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                page_id AS id,
                page_name AS name,
                page_description AS description,
                status
             FROM pages
             WHERE status = 'Approved'
             ORDER BY page_name ASC`
        );

        return res.status(200).json({
            pages: result.rows
        });

    } catch (error) {
        console.error('Error fetching approved pages:', error);

        return res.status(500).json({
            message: 'Failed to fetch approved pages.'
        });
    }
});

module.exports = router;