const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { authenticateUser, logAudit } = require('../middleware/auth');

async function resolveUserId(req) {
    if (req.query?.student_id) return Number(req.query.student_id);
    if (req.query?.staff_id) return Number(req.query.staff_id);
    if (req.query?.user_id) return Number(req.query.user_id);
    if (req.body?.student_id) return Number(req.body.student_id);
    if (req.body?.staff_id) return Number(req.body.staff_id);
    if (req.body?.user_id) return Number(req.body.user_id);

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

// Helper: Fetch a staff user's primary managed page (by page_members or created_by)
async function getUserPageDetails(userId) {
    try {
        const pageRes = await pool.query(
            `SELECT p.page_id, p.page_name, p.page_code, p.page_description, p.status,
                    p.department_id, p.organization_id, p.avatar_url, p.cover_url,
                    p.contact_email, p.allow_event_registration
             FROM pages p
             LEFT JOIN page_members pm ON p.page_id = pm.page_id AND pm.user_id = $1 AND LOWER(pm.status) = 'active'
             WHERE p.created_by = $1 OR pm.user_id = $1
             ORDER BY (CASE WHEN LOWER(p.status) IN ('approved', 'active') THEN 0 ELSE 1 END), p.page_id DESC
             LIMIT 1`,
            [userId]
        );
        if (pageRes.rows.length > 0) {
            return pageRes.rows[0];
        }

        const fallbackRes = await pool.query(
            `SELECT page_id, page_name, page_code, page_description, status FROM pages ORDER BY page_id ASC LIMIT 1`
        );
        if (fallbackRes.rows.length > 0) {
            return fallbackRes.rows[0];
        }

        return { page_id: null, page_name: 'Student Affairs Office', page_code: 'SAO' };
    } catch (err) {
        console.error('Error in getUserPageDetails:', err.message);
        return { page_id: null, page_name: 'Student Affairs Office', page_code: 'SAO' };
    }
}

async function getDefaultCategoryId() {
    try {
        const catRes = await pool.query(`SELECT category_id FROM post_categories ORDER BY category_id ASC LIMIT 1`);
        return catRes.rows[0]?.category_id || 1;
    } catch (_) {
        return 1;
    }
}

// -------- CHECK USER'S PAGE STATUS -------- //
router.get('/my-page-status', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const pageQuery = await pool.query(
            `SELECT p.page_id, p.page_name, p.page_code, p.page_description, p.status,
                    p.department_id, p.organization_id, p.avatar_url
             FROM pages p
             LEFT JOIN page_members pm ON p.page_id = pm.page_id AND pm.user_id = $1 AND LOWER(pm.status) = 'active'
             WHERE p.created_by = $1 OR pm.user_id = $1
             ORDER BY p.page_id DESC
             LIMIT 1`,
            [user.user_id]
        );

        if (pageQuery.rows.length === 0) {
            return res.status(200).json({ exists: false, status: 'none' });
        }

        const page = pageQuery.rows[0];
        return res.status(200).json({
            exists: true,
            id: page.page_id,
            pageId: page.page_id,
            pageName: page.page_name,
            pageCode: page.page_code || 'SAO',
            description: page.page_description || '',
            profileImage: page.avatar_url || null,
            status: String(page.status || 'Pending').toLowerCase(),
            category: page.department_id ? 'Academic College' : 'Student Organization'
        });
    } catch (error) {
        console.error('Error fetching page status:', error);
        return res.status(500).json({ message: 'Failed to fetch page status: ' + error.message });
    }
});

// -------- CREATE PAGE -------- //
router.post('/create-page', async (req, res) => {
    const client = await pool.connect();
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const {
            pageName,
            pageCode,
            pageCategory,
            pageDescription,
            profileImage,
            departmentId,
            organizationId
        } = req.body;

        if (!pageName) {
            return res.status(400).json({ message: 'Page name is required.' });
        }

        await client.query('BEGIN');

        let deptId = departmentId ? Number(departmentId) : null;
        let orgId = organizationId ? Number(organizationId) : null;
        if (deptId && orgId) orgId = null;

        const pageType = deptId ? 'department' : (pageCategory === 'Campus Office' ? 'office' : 'organization');
        const derivedCode = pageCode || pageName.split(' ').map(w => w[0]).join('').slice(0, 6).toUpperCase();

        const insRes = await client.query(
            `INSERT INTO pages (
                page_name, page_code, page_description, page_type,
                department_id, organization_id, avatar_url, created_by, status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
             RETURNING *`,
            [
                pageName.trim(),
                derivedCode,
                pageDescription || '',
                pageType,
                deptId,
                orgId,
                profileImage || null,
                user.user_id
            ]
        );

        const newPage = insRes.rows[0];

        await client.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, 'Admin', $2, 'Active')
             ON CONFLICT (page_id, user_id) DO NOTHING`,
            [newPage.page_id, user.user_id]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: 'Created Campus Page Request',
            module: 'pages',
            targetType: 'page',
            targetId: newPage.page_id,
            details: { page_name: newPage.page_name }
        });

        return res.status(201).json({
            message: 'Page request submitted for admin approval.',
            page: newPage
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error creating page:', error);
        return res.status(500).json({ message: 'Failed to create page: ' + error.message });
    } finally {
        client.release();
    }
});

// -------- UPDATE MYPAGE PROFILE -------- //
const handleUpdateMyPage = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const { pageName, description, pageDescription, profileImage } = req.body;
        const userPage = await getUserPageDetails(user.user_id);

        if (!userPage.page_id) {
            return res.status(404).json({ message: 'No managed page found for this account.' });
        }

        const updRes = await pool.query(
            `UPDATE pages
             SET page_name = COALESCE($1, page_name),
                 page_description = COALESCE($2, page_description),
                 avatar_url = COALESCE($3, avatar_url)
             WHERE page_id = $4
             RETURNING *`,
            [
                pageName || null,
                description ?? pageDescription ?? null,
                profileImage || null,
                userPage.page_id
            ]
        );

        return res.status(200).json({
            message: 'Page updated successfully.',
            page: updRes.rows[0]
        });
    } catch (error) {
        console.error('Error updating page:', error);
        return res.status(500).json({ message: 'Failed to update page.' });
    }
};
router.put('/mypage/update', handleUpdateMyPage);
router.post('/mypage/update', handleUpdateMyPage);

// -------- MYPAGE SETTINGS & STAFF SETTINGS -------- //
router.get('/my-page/settings', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const page = await getUserPageDetails(user.user_id);
        return res.status(200).json({
            pageName: page.page_name || 'Student Affairs Office',
            pageCode: page.page_code || 'SAO',
            description: page.page_description || '',
            contactEmail: page.contact_email || user.email,
            allowEventRegistration: page.allow_event_registration ?? true
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch page settings.' });
    }
});

const saveMyPageSettings = async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const page = await getUserPageDetails(user.user_id);
        if (page.page_id) {
            const { pageName, description, contactEmail, allowEventRegistration } = req.body;
            await pool.query(
                `UPDATE pages
                 SET page_name = COALESCE($1, page_name),
                     page_description = COALESCE($2, page_description),
                     contact_email = COALESCE($3, contact_email),
                     allow_event_registration = COALESCE($4, allow_event_registration)
                 WHERE page_id = $5`,
                [pageName || null, description ?? null, contactEmail || null, allowEventRegistration ?? null, page.page_id]
            );
        }
        return res.status(200).json({ message: 'Page settings saved successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to save page settings.' });
    }
};
router.put('/my-page/settings', saveMyPageSettings);
router.post('/my-page/settings', saveMyPageSettings);

router.put('/settings', async (req, res) => {
    return res.status(200).json({ message: 'Settings updated successfully.' });
});
router.post('/settings', async (req, res) => {
    return res.status(200).json({ message: 'Settings updated successfully.' });
});

// -------- DASHBOARD FEED (/api/dashboard-data) -------- //
const handleDashboardFetch = async (req, res) => {
    try {
        const annRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS announcement_id,
                    p.title,
                    p.content,
                    p.content AS description,
                    p.created_at,
                    p.image_url,
                    p.page_id,
                    p.category_id,
                    p.audience,
                    p.is_pinned,
                    p.status,
                    COALESCE(pc.category_name, 'General') AS category_name,
                    COALESCE(pg.page_name, 'Student Affairs Office') AS page_name,
                    COALESCE(pg.page_name, 'Student Affairs Office') AS department_name
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             WHERE p.post_type = 'announcement'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             ORDER BY p.is_pinned DESC, p.created_at DESC`
        );

        const evRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS event_id,
                    p.title,
                    p.title AS event_title,
                    p.content,
                    p.content AS description,
                    p.content AS event_description,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.location AS venue,
                    ed.capacity,
                    ed.capacity AS max_capacity,
                    p.created_at,
                    p.image_url,
                    p.image_url AS poster_url,
                    p.page_id,
                    p.category_id,
                    p.audience,
                    p.status,
                    COALESCE(pc.category_name, 'General') AS category_name,
                    COALESCE(pg.page_name, 'Student Affairs Office') AS page_name,
                    COALESCE(pg.page_name, 'Student Affairs Office') AS department_name,
                    COUNT(er.registration_id) FILTER (WHERE LOWER(er.status) != 'cancelled')::int AS registered_count
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             WHERE p.post_type = 'event'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             GROUP BY p.post_id, ed.post_id, pg.page_id, pc.category_id
             ORDER BY p.created_at DESC`
        );

        return res.status(200).json({
            announcements: annRes.rows,
            events: evRes.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({ message: 'Failed to fetch dashboard posts.' });
    }
};

router.get('/dashboard-data', handleDashboardFetch);
router.post('/dashboard-data', handleDashboardFetch);

// -------- GET /api/mypage/posts -------- //
router.get('/mypage/posts', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const { pageId } = req.query;
        const params = [];
        let pageFilter = '';

        if (pageId) {
            params.push(Number(pageId));
            pageFilter = `AND p.page_id = $1`;
        }

        const annRes = await pool.query(
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
                    p.moderation_status,
                    p.status,
                    p.created_at,
                    COALESCE(pg.page_name, 'Student Affairs Office') AS page_name
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             WHERE p.post_type = 'announcement' AND p.is_archived = FALSE ${pageFilter}
             ORDER BY p.created_at DESC`,
            params
        );

        const evRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS event_id,
                    p.page_id,
                    p.creator_user_id,
                    p.category_id,
                    COALESCE(pc.category_name, 'General') AS category_name,
                    p.title,
                    p.title AS event_title,
                    p.content,
                    p.content AS description,
                    p.content AS event_description,
                    p.image_url,
                    p.image_url AS poster_url,
                    p.audience,
                    p.moderation_status,
                    p.status,
                    p.created_at,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.location AS venue,
                    ed.capacity,
                    COALESCE(pg.page_name, 'Student Affairs Office') AS page_name
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             WHERE p.post_type = 'event' AND p.is_archived = FALSE ${pageFilter}
             ORDER BY p.created_at DESC`,
            params
        );

        return res.status(200).json({
            announcements: annRes.rows,
            events: evRes.rows,
            posts: [...annRes.rows, ...evRes.rows]
        });
    } catch (err) {
        console.error('Error fetching mypage posts:', err);
        return res.status(500).json({ message: 'Failed to fetch page posts.' });
    }
});

// -------- GET /api/categories -------- //
router.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(`SELECT category_id, category_name, description FROM post_categories ORDER BY category_name ASC`);
        return res.status(200).json({ categories: result.rows });
    } catch (err) {
        return res.status(200).json({ categories: [{ category_id: 1, category_name: 'General' }] });
    }
});

// -------- CREATE ANNOUNCEMENT (UNIFIED POSTS TABLE) -------- //
router.post('/announcements', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const { title, content, description, pageId, image_url, category_id, is_pinned, audience } = req.body;
        const bodyText = content || description || '';

        if (!title || !bodyText) {
            return res.status(400).json({ message: 'Title and content/description are required.' });
        }

        const userPage = await getUserPageDetails(user.user_id);
        const targetPageId = pageId ? Number(pageId) : userPage.page_id;

        if (!targetPageId) {
            return res.status(400).json({ message: 'No valid page found. Please create or join an organization page first.' });
        }

        const finalCategoryId = category_id ? Number(category_id) : await getDefaultCategoryId();

        const result = await pool.query(
            `INSERT INTO posts (
                page_id, creator_user_id, category_id, post_type,
                title, content, image_url, audience, is_pinned,
                moderation_status, status, published_at
             ) VALUES ($1, $2, $3, 'announcement', $4, $5, $6, $7, $8, 'Approved', 'Published', NOW())
             RETURNING *, post_id AS id, post_id AS announcement_id, content AS description`,
            [
                targetPageId,
                user.user_id,
                finalCategoryId,
                title.trim(),
                bodyText.trim(),
                image_url || null,
                audience || 'All Campus',
                Boolean(is_pinned)
            ]
        );

        const newAnnouncement = {
            ...result.rows[0],
            page_name: userPage.page_name || 'Student Affairs Office'
        };

        await logAudit(req, {
            action: 'Published Announcement',
            module: 'posts',
            targetType: 'post',
            targetId: newAnnouncement.post_id,
            details: { title: newAnnouncement.title }
        });

        return res.status(201).json({
            message: 'Announcement published successfully!',
            announcement: newAnnouncement
        });
    } catch (err) {
        console.error('Error publishing announcement:', err);
        return res.status(500).json({ message: 'Database Insert Error: ' + err.message });
    }
});

// -------- CREATE EVENT (UNIFIED POSTS + 1:1 EVENT_DETAILS) -------- //
router.post('/events', async (req, res) => {
    const client = await pool.connect();
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const {
            event_title,
            title,
            event_description,
            description,
            content,
            pageId,
            category_id,
            event_date,
            end_date,
            location,
            venue,
            capacity,
            image_url,
            poster_url,
            organizer_info,
            audience
        } = req.body;

        const eTitle = (event_title || title || '').trim();
        const eDesc = (event_description || description || content || '').trim();

        if (!eTitle || !eDesc) {
            return res.status(400).json({ message: 'Event title and description are required.' });
        }

        const userPage = await getUserPageDetails(user.user_id);
        const targetPageId = pageId ? Number(pageId) : userPage.page_id;

        if (!targetPageId) {
            return res.status(400).json({ message: 'No valid page found. Please create or join an organization page first.' });
        }

        const finalCategoryId = category_id ? Number(category_id) : await getDefaultCategoryId();
        const eDate = event_date || new Date().toISOString();
        const eLocation = (location || venue || 'University Campus').trim();
        const imgUrl = image_url || poster_url || null;
        const capNum = capacity ? Number(capacity) : null;

        await client.query('BEGIN');

        // 1. Insert into supertype posts table
        const postRes = await client.query(
            `INSERT INTO posts (
                page_id, creator_user_id, category_id, post_type,
                title, content, image_url, audience,
                moderation_status, status, published_at
             ) VALUES ($1, $2, $3, 'event', $4, $5, $6, $7, 'Approved', 'Upcoming', NOW())
             RETURNING *`,
            [
                targetPageId,
                user.user_id,
                finalCategoryId,
                eTitle,
                eDesc,
                imgUrl,
                audience || 'All Campus'
            ]
        );
        const postRow = postRes.rows[0];

        // 2. Insert into 1:1 subtype event_details table
        const detailRes = await client.query(
            `INSERT INTO event_details (
                post_id, event_date, end_date, location, organizer_info, capacity
             ) VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                postRow.post_id,
                eDate,
                end_date || null,
                eLocation,
                organizer_info || null,
                capNum
            ]
        );
        const detailRow = detailRes.rows[0];

        await client.query('COMMIT');

        const newEvent = {
            ...postRow,
            ...detailRow,
            id: postRow.post_id,
            event_id: postRow.post_id,
            event_title: postRow.title,
            event_description: postRow.content,
            description: postRow.content,
            venue: detailRow.location,
            poster_url: postRow.image_url,
            page_name: userPage.page_name || 'Student Affairs Office'
        };

        await logAudit(req, {
            action: 'Created Campus Event',
            module: 'events',
            targetType: 'event',
            targetId: postRow.post_id,
            details: { title: eTitle, event_date: eDate }
        });

        return res.status(201).json({
            message: 'Event published successfully!',
            event: newEvent
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error publishing event:', err);
        return res.status(500).json({ message: 'Database Insert Error: ' + err.message });
    } finally {
        client.release();
    }
});

// -------- EDIT ANNOUNCEMENT -------- //
router.put('/announcements/:id', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const postId = Number(req.params.id);
        const { title, content, description, category_id, image_url, is_pinned } = req.body;
        const bodyText = content || description || '';

        const result = await pool.query(
            `UPDATE posts
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 category_id = COALESCE($3, category_id),
                 image_url = COALESCE($4, image_url),
                 is_pinned = COALESCE($5, is_pinned)
             WHERE post_id = $6 AND post_type = 'announcement'
             RETURNING *, post_id AS id, post_id AS announcement_id, content AS description`,
            [
                title || null,
                bodyText || null,
                category_id ? Number(category_id) : null,
                image_url !== undefined ? image_url : null,
                is_pinned !== undefined ? Boolean(is_pinned) : null,
                postId
            ]
        );

        return res.status(200).json({ announcement: result.rows[0] });
    } catch (err) {
        console.error('Error updating announcement:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// -------- EDIT EVENT -------- //
router.put('/events/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const postId = Number(req.params.id);
        const { event_title, title, event_description, description, content, event_date, location, venue, capacity, image_url, poster_url } = req.body;
        const eTitle = event_title || title || null;
        const eDesc = event_description || description || content || null;
        const eLoc = location || venue || null;
        const imgUrl = image_url ?? poster_url ?? null;

        await client.query('BEGIN');

        const postRes = await client.query(
            `UPDATE posts
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 image_url = COALESCE($3, image_url)
             WHERE post_id = $4 AND post_type = 'event'
             RETURNING *`,
            [eTitle, eDesc, imgUrl, postId]
        );

        const detailRes = await client.query(
            `UPDATE event_details
             SET event_date = COALESCE($1, event_date),
                 location = COALESCE($2, location),
                 capacity = $3
             WHERE post_id = $4
             RETURNING *`,
            [
                event_date || null,
                eLoc,
                capacity ? Number(capacity) : null,
                postId
            ]
        );

        await client.query('COMMIT');

        const updatedEvent = {
            ...(postRes.rows[0] || {}),
            ...(detailRes.rows[0] || {}),
            id: postId,
            event_id: postId,
            event_title: postRes.rows[0]?.title,
            event_description: postRes.rows[0]?.content
        };

        return res.status(200).json({ event: updatedEvent });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error updating event:', err.message);
        return res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

// -------- DELETE ANNOUNCEMENT / EVENT -------- //
router.delete('/announcements/:id', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;
        await pool.query(`DELETE FROM posts WHERE post_id = $1 AND post_type = 'announcement'`, [Number(req.params.id)]);
        return res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

router.delete('/events/:id', async (req, res) => {
    try {
        const user = await authenticateUser(req, res);
        if (!user) return;
        await pool.query(`DELETE FROM posts WHERE post_id = $1 AND post_type = 'event'`, [Number(req.params.id)]);
        return res.status(200).json({ message: 'Event deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// -------- GET APPROVED PAGES -------- //
router.get('/approved-pages', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT page_id AS id,
                    page_name AS name,
                    page_code AS code,
                    page_description AS description,
                    status
             FROM pages
             WHERE LOWER(status) IN ('approved', 'active')
             ORDER BY page_name ASC`
        );
        return res.status(200).json({ pages: result.rows });
    } catch (err) {
        console.error('Error fetching approved pages:', err.message);
        return res.status(500).json({ message: err.message });
    }
});

// ============================================================================
// PUBLIC & STUDENT PAGE VIEW + FOLLOW ENDPOINTS
// ============================================================================

// Helper: Handle Page Details Fetch
async function handleGetPageDetails(req, res) {
    try {
        const pageId = Number(req.params.pageId);
        if (!pageId || isNaN(pageId)) {
            return res.status(400).json({ message: 'Invalid page ID' });
        }

        const userId = await resolveUserId(req);

        const pageRes = await pool.query(
            `SELECT p.page_id, p.page_name, p.page_code, p.page_description, p.status,
                    p.page_type, p.department_id, p.organization_id, p.avatar_url, p.cover_url,
                    p.contact_email, p.allow_event_registration, p.created_at,
                    d.department_name, d.department_code,
                    o.organization_name AS org_name, o.org_code,
                    COALESCE((SELECT COUNT(*)::int FROM page_follows pf WHERE pf.page_id = p.page_id), 0) AS followers_count,
                    COALESCE((SELECT COUNT(*)::int FROM posts po WHERE po.page_id = p.page_id AND po.is_archived = FALSE AND LOWER(po.moderation_status) = 'approved'), 0) AS posts_count,
                    COALESCE((SELECT COUNT(*)::int FROM posts po WHERE po.page_id = p.page_id AND po.post_type = 'event' AND po.is_archived = FALSE AND LOWER(po.moderation_status) = 'approved'), 0) AS events_count,
                    COALESCE((SELECT COUNT(*)::int FROM posts po WHERE po.page_id = p.page_id AND po.post_type = 'announcement' AND po.is_archived = FALSE AND LOWER(po.moderation_status) = 'approved'), 0) AS announcements_count,
                    CASE WHEN $2::int IS NOT NULL AND EXISTS(
                        SELECT 1 FROM page_follows WHERE page_id = p.page_id AND follower_user_id = $2
                    ) THEN TRUE ELSE FALSE END AS is_followed
             FROM pages p
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             WHERE p.page_id = $1
               AND (LOWER(p.status) IN ('approved', 'active') OR ($2::int IS NOT NULL AND p.created_by = $2))`,
            [pageId, userId]
        );

        if (pageRes.rows.length === 0) {
            return res.status(404).json({ message: 'Page not found' });
        }

        return res.status(200).json({ page: pageRes.rows[0] });
    } catch (err) {
        console.error('Error fetching page details:', err);
        return res.status(500).json({ message: err.message });
    }
}

// Helper: Handle Page Posts Fetch (Announcements & Events published by this page)
async function handleGetPagePosts(req, res) {
    try {
        const pageId = Number(req.params.pageId);
        if (!pageId || isNaN(pageId)) {
            return res.status(400).json({ message: 'Invalid page ID' });
        }

        const userId = await resolveUserId(req);

        const postsRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id,
                    p.page_id,
                    p.post_type,
                    p.title,
                    p.content,
                    p.content AS description,
                    p.image_url,
                    p.audience,
                    p.is_pinned,
                    p.status,
                    p.moderation_status,
                    p.created_at,
                    pg.page_name,
                    pg.page_code,
                    pg.avatar_url AS page_avatar_url,
                    COALESCE(pc.category_name, 'General') AS category_name,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.location AS venue,
                    ed.capacity,
                    ed.capacity AS max_capacity,
                    ed.organizer_info,
                    ed.registration_deadline,
                    COUNT(er.registration_id) FILTER (WHERE LOWER(er.status) != 'cancelled')::int AS registered_count,
                    CASE WHEN $2::int IS NOT NULL AND EXISTS(
                        SELECT 1 FROM event_registrations er2
                        WHERE er2.event_post_id = p.post_id AND er2.registrant_user_id = $2 AND LOWER(er2.status) != 'cancelled'
                    ) THEN TRUE ELSE FALSE END AS is_registered
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             WHERE p.page_id = $1
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             GROUP BY p.post_id, pg.page_id, pc.category_id, ed.post_id
             ORDER BY p.is_pinned DESC, p.created_at DESC`,
            [pageId, userId]
        );

        return res.status(200).json({ posts: postsRes.rows });
    } catch (err) {
        console.error('Error fetching page posts:', err);
        return res.status(500).json({ message: err.message });
    }
}

// Helper: Handle Follow
async function handleFollowPage(req, res) {
    try {
        const pageId = Number(req.params.pageId);
        if (!pageId || isNaN(pageId)) {
            return res.status(400).json({ message: 'Invalid page ID' });
        }

        const user = await authenticateUser(req, res);
        if (!user) return;
        const userId = user.user_id;

        // Verify page exists
        const pageCheck = await pool.query(`SELECT page_id, page_name FROM pages WHERE page_id = $1`, [pageId]);
        if (pageCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Page not found.' });
        }

        await pool.query(
            `INSERT INTO page_follows (page_id, follower_user_id)
             VALUES ($1, $2)
             ON CONFLICT (page_id, follower_user_id) DO NOTHING`,
            [pageId, userId]
        );

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS count FROM page_follows WHERE page_id = $1`,
            [pageId]
        );

        return res.status(200).json({
            success: true,
            is_followed: true,
            followers_count: countRes.rows[0].count,
            message: `You are now following ${pageCheck.rows[0].page_name}.`
        });
    } catch (err) {
        console.error('Error following page:', err);
        return res.status(500).json({ message: err.message });
    }
}

// Helper: Handle Unfollow
async function handleUnfollowPage(req, res) {
    try {
        const pageId = Number(req.params.pageId);
        if (!pageId || isNaN(pageId)) {
            return res.status(400).json({ message: 'Invalid page ID' });
        }

        const user = await authenticateUser(req, res);
        if (!user) return;
        const userId = user.user_id;

        await pool.query(
            `DELETE FROM page_follows WHERE page_id = $1 AND follower_user_id = $2`,
            [pageId, userId]
        );

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS count FROM page_follows WHERE page_id = $1`,
            [pageId]
        );

        return res.status(200).json({
            success: true,
            is_followed: false,
            followers_count: countRes.rows[0].count,
            message: 'You have unfollowed this page.'
        });
    } catch (err) {
        console.error('Error unfollowing page:', err);
        return res.status(500).json({ message: err.message });
    }
}

// Helper: List followed page IDs for the user
async function handleGetFollowedPages(req, res) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return res.status(200).json({ followed_page_ids: [] });
        }
        const r = await pool.query(
            `SELECT page_id FROM page_follows WHERE follower_user_id = $1`,
            [userId]
        );
        return res.status(200).json({ followed_page_ids: r.rows.map(x => x.page_id) });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Bind routes with /pages prefix
router.get('/pages/followed/list', handleGetFollowedPages);
router.get('/pages/:pageId', handleGetPageDetails);
router.get('/pages/:pageId/posts', handleGetPagePosts);
router.post('/pages/:pageId/follow', handleFollowPage);
router.delete('/pages/:pageId/follow', handleUnfollowPage);
router.delete('/pages/:pageId/unfollow', handleUnfollowPage);
router.post('/pages/:pageId/unfollow', handleUnfollowPage);

module.exports = router;
