const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin, logAudit } = require('../middleware/auth');

const DEFAULT_SETTINGS = {
    system_name: 'WMSU Campus Announcements & Events System',
    system_description: 'Official announcements and event management portal for Western Mindanao State University.',
    default_timezone: 'Asia/Manila',
    date_format: 'YYYY-MM-DD',
    maintenance_mode: false,
    default_announcement_category: 'General',
    default_expiration_days: 14,
    require_approval_campus_wide: true,
    max_pinned_announcements: 5,
    allow_urgent_announcements: true,
    default_event_visibility: 'campus-only',
    enable_event_registration_default: true,
    default_registration_capacity: 100,
    registration_closing_lead_hours: 2,
    enable_in_app_notifications: true,
    enable_email_notifications: false,
    notify_pending_approval: true,
    notify_student_verification: true,
    permitted_email_domain: 'wmsu.edu.ph',
    registration_open: true,
    require_student_id_cor_verification: true,
    pending_verification_expire_days: 7,
    session_timeout_minutes: 30,
    max_login_attempts: 5,
    enable_rate_limiting: true
};

// Apply Admin Auth Middleware to all /api/admin routes
router.use(requireAdmin);

// Helper: Ensure admin has a default Campus Administration page for direct admin posts
async function getOrCreateAdminPageId(adminUserId) {
    const existing = await pool.query(`SELECT page_id FROM pages ORDER BY page_id ASC LIMIT 1`);
    if (existing.rows.length > 0) return existing.rows[0].page_id;

    const ins = await pool.query(
        `INSERT INTO pages (page_name, page_code, page_description, page_type, created_by, status)
         VALUES ('Office of the Administration', 'ADMIN', 'Official WMSU Administration Portal', 'office', $1, 'Approved')
         RETURNING page_id`,
        [adminUserId]
    );
    return ins.rows[0].page_id;
}

// ============================================================================
// 1. OVERVIEW DASHBOARD (GET /api/admin/overview)
// ============================================================================
router.get('/overview', async (req, res) => {
    try {
        const [verifCount, approvalCount, pageCount, verifiedCount, pendingPosts, pendingPages, recentLogs] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS cnt FROM student_profiles WHERE LOWER(verification_status) = 'pending'`),
            pool.query(`SELECT COUNT(*)::int AS cnt FROM posts WHERE LOWER(moderation_status) = 'pending' AND is_archived = FALSE`),
            pool.query(`SELECT COUNT(*)::int AS cnt FROM pages WHERE LOWER(status) = 'pending'`),
            pool.query(`SELECT COUNT(*)::int AS cnt FROM student_profiles WHERE LOWER(verification_status) = 'verified'`),
            pool.query(
                `SELECT p.post_id AS id, p.title, p.post_type AS type, pg.page_name AS source, p.created_at
                 FROM posts p
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 WHERE LOWER(p.moderation_status) = 'pending' AND p.is_archived = FALSE
                 ORDER BY p.created_at DESC LIMIT 5`
            ),
            pool.query(
                `SELECT page_id AS id, page_name AS title, 'page' AS type, page_code AS source, created_at
                 FROM pages
                 WHERE LOWER(status) = 'pending'
                 ORDER BY created_at DESC LIMIT 5`
            ),
            pool.query(
                `SELECT l.log_id AS id, l.action, l.module, l.outcome, l.created_at,
                        COALESCE(u.first_name || ' ' || u.last_name, 'System') AS actor_name
                 FROM audit_logs l
                 LEFT JOIN users u ON l.actor_user_id = u.user_id
                 ORDER BY l.created_at DESC LIMIT 8`
            )
        ]);

        const pendingTasks = [
            ...pendingPosts.rows.map(r => ({
                id: `post-${r.id}`,
                title: r.title,
                category: r.type === 'event' ? 'Event Approval' : 'Announcement Approval',
                source: r.source || 'Campus Page',
                created_at: r.created_at,
                link: '/admin/post-approval'
            })),
            ...pendingPages.rows.map(r => ({
                id: `page-${r.id}`,
                title: r.title,
                category: 'Page Request',
                source: r.source || 'Organization',
                created_at: r.created_at,
                link: '/admin/pages'
            }))
        ].slice(0, 8);

        return res.json({
            counts: {
                pendingVerifications: verifCount.rows[0].cnt,
                pendingApprovals: approvalCount.rows[0].cnt,
                pendingPages: pageCount.rows[0].cnt,
                verifiedStudents: verifiedCount.rows[0].cnt
            },
            pendingTasks,
            recentActivities: recentLogs.rows
        });
    } catch (error) {
        console.error('Admin overview error:', error);
        return res.status(500).json({ message: 'Failed to load dashboard overview.' });
    }
});

// ============================================================================
// 2. CONTENT FEED (GET / POST / PUT / PATCH /api/admin/content-feed)
// ============================================================================
router.get('/content-feed', async (req, res) => {
    try {
        const { tab = 'all', search = '', category = 'all', sort = 'newest', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = ['p.is_archived = FALSE'];

        if (tab === 'announcements' || tab === 'announcement') {
            clauses.push(`p.post_type = 'announcement'`);
        } else if (tab === 'events' || tab === 'event') {
            clauses.push(`p.post_type = 'event'`);
        }

        if (category && category !== 'all') {
            params.push(category);
            clauses.push(`LOWER(pc.category_name) = LOWER($${params.length})`);
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR p.content ILIKE $${params.length} OR pg.page_name ILIKE $${params.length})`);
        }

        const whereSql = clauses.join(' AND ');
        const orderSql = sort === 'oldest' ? 'p.created_at ASC' : 'p.created_at DESC';

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             WHERE ${whereSql}`,
            params
        );
        const total = countRes.rows[0].total;

        params.push(limitNum, offset);
        const dataRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_type AS type,
                    p.title,
                    p.content AS description,
                    p.content AS body,
                    COALESCE(pc.category_name, 'General') AS category,
                    p.audience,
                    p.status,
                    p.moderation_status,
                    p.is_pinned,
                    p.image_url,
                    p.published_at AS scheduled_at,
                    p.expires_at,
                    p.created_at,
                    pg.page_id,
                    COALESCE(pg.page_name, 'University Administration') AS page_name,
                    COALESCE(pg.page_name, 'University Administration') AS source_page,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS author_name,
                    ed.event_date AS event_start,
                    ed.end_date AS event_end,
                    ed.location AS venue,
                    ed.location,
                    ed.organizer_info AS organizer,
                    ed.registration_deadline AS reg_deadline,
                    ed.capacity
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN users u ON p.creator_user_id = u.user_id
             WHERE ${whereSql}
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            items: dataRes.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Content feed error:', error);
        return res.status(500).json({ message: 'Failed to load content feed.' });
    }
});

router.post('/content-feed', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            type = 'announcement',
            title,
            description,
            body,
            category = 'General',
            audience = 'All Campus',
            expires_at,
            event_start,
            event_end,
            venue,
            organizer,
            reg_deadline,
            capacity
        } = req.body;

        const postType = String(type).toLowerCase() === 'event' ? 'event' : 'announcement';
        const contentText = description || body || '';

        if (!title || !contentText) {
            return res.status(400).json({ message: 'Title and description are required.' });
        }

        await client.query('BEGIN');

        const pageId = await getOrCreateAdminPageId(req.user.user_id);
        const catRes = await client.query(
            `SELECT category_id FROM post_categories WHERE LOWER(category_name) = LOWER($1) LIMIT 1`,
            [category]
        );
        const categoryId = catRes.rows[0]?.category_id || 1;

        const postIns = await client.query(
            `INSERT INTO posts (
                page_id, creator_user_id, category_id, post_type,
                title, content, audience, expires_at,
                moderation_status, status, published_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Approved', $9, NOW())
             RETURNING *`,
            [
                pageId,
                req.user.user_id,
                categoryId,
                postType,
                title.trim(),
                contentText.trim(),
                audience,
                expires_at || null,
                postType === 'event' ? 'Upcoming' : 'Published'
            ]
        );
        const postRow = postIns.rows[0];

        if (postType === 'event') {
            await client.query(
                `INSERT INTO event_details (
                    post_id, event_date, end_date, location, organizer_info, capacity, registration_deadline
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    postRow.post_id,
                    event_start || new Date().toISOString(),
                    event_end || null,
                    venue || 'University Campus',
                    organizer || null,
                    capacity ? Number(capacity) : null,
                    reg_deadline || null
                ]
            );
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Admin Created ${postType}`,
            module: 'posts',
            targetType: postType,
            targetId: postRow.post_id,
            details: { title }
        });

        return res.status(201).json({ message: 'Post created successfully.', item: postRow });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Admin create content error:', error);
        return res.status(500).json({ message: 'Failed to create content.' });
    } finally {
        client.release();
    }
});

router.put('/content-feed/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const postId = Number(req.params.id);
        const {
            title,
            description,
            body,
            category,
            audience,
            expires_at,
            event_start,
            event_end,
            venue,
            organizer,
            reg_deadline,
            capacity
        } = req.body;

        await client.query('BEGIN');

        let categoryId = null;
        if (category) {
            const catRes = await client.query(
                `SELECT category_id FROM post_categories WHERE LOWER(category_name) = LOWER($1) LIMIT 1`,
                [category]
            );
            categoryId = catRes.rows[0]?.category_id || null;
        }

        const postUpd = await client.query(
            `UPDATE posts
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 category_id = COALESCE($3, category_id),
                 audience = COALESCE($4, audience),
                 expires_at = COALESCE($5, expires_at)
             WHERE post_id = $6
             RETURNING *`,
            [title || null, description || body || null, categoryId, audience || null, expires_at || null, postId]
        );

        if (postUpd.rows[0]?.post_type === 'event') {
            await client.query(
                `UPDATE event_details
                 SET event_date = COALESCE($1, event_date),
                     end_date = COALESCE($2, end_date),
                     location = COALESCE($3, location),
                     organizer_info = COALESCE($4, organizer_info),
                     capacity = COALESCE($5, capacity),
                     registration_deadline = COALESCE($6, registration_deadline)
                 WHERE post_id = $7`,
                [
                    event_start || null,
                    event_end || null,
                    venue || null,
                    organizer || null,
                    capacity ? Number(capacity) : null,
                    reg_deadline || null,
                    postId
                ]
            );
        }

        await client.query('COMMIT');
        return res.json({ message: 'Content updated successfully.', item: postUpd.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Admin update content error:', error);
        return res.status(500).json({ message: 'Failed to update content.' });
    } finally {
        client.release();
    }
});

const handleContentStatus = async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const { status, action, reason } = req.body;
        const targetAction = String(status || action || '').toLowerCase();

        if (targetAction === 'archive' || targetAction === 'archived') {
            await pool.query(
                `UPDATE posts
                 SET is_archived = TRUE, status = 'Archived', archived_at = NOW(), archived_by = $1, archive_reason = $2
                 WHERE post_id = $3`,
                [req.user.user_id, reason || 'Administrative Archive', postId]
            );
        } else {
            const newStatus = status || 'Published';
            await pool.query(
                `UPDATE posts SET status = $1, is_archived = FALSE WHERE post_id = $2`,
                [newStatus, postId]
            );
        }

        await logAudit(req, {
            action: `Updated Post Status (${targetAction || status})`,
            module: 'posts',
            targetType: 'post',
            targetId: postId
        });

        return res.json({ message: 'Content status updated successfully.' });
    } catch (error) {
        console.error('Content status error:', error);
        return res.status(500).json({ message: 'Failed to update content status.' });
    }
};
router.patch('/content-feed/:id/status', handleContentStatus);
router.put('/content-feed/:id/status', handleContentStatus);
router.post('/content-feed/:id/status', handleContentStatus);

// ============================================================================
// 3. USER MANAGEMENT, STUDENT VERIFICATION & STAFF ACCESS
// ============================================================================
router.get('/users', async (req, res) => {
    try {
        const { tab = 'all', search = '', role = 'all', status = 'all', sort = 'newest', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        if (tab === 'verification') {
            const params = [];
            const clauses = [];

            if (status && status !== 'all') {
                params.push(status);
                clauses.push(`LOWER(sp.verification_status) = LOWER($${params.length})`);
            }
            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                clauses.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR sp.student_number ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const countRes = await pool.query(
                `SELECT COUNT(*)::int AS total FROM student_profiles sp JOIN users u ON sp.user_id = u.user_id ${whereSql}`,
                params
            );
            const total = countRes.rows[0].total;

            params.push(limitNum, offset);
            const rowsRes = await pool.query(
                `SELECT u.user_id AS id,
                        u.first_name,
                        u.last_name,
                        u.first_name || ' ' || u.last_name AS full_name,
                        u.email,
                        sp.student_number AS student_id,
                        d.department_name AS college,
                        pr.program_name AS program,
                        sp.year_level,
                        sp.cor_url,
                        sp.student_id_url,
                        sp.verification_status AS status,
                        sp.verification_remarks,
                        sp.verified_at,
                        u.created_at
                 FROM student_profiles sp
                 JOIN users u ON sp.user_id = u.user_id
                 LEFT JOIN departments d ON sp.department_id = d.department_id
                 LEFT JOIN programs pr ON sp.program_id = pr.program_id
                 ${whereSql}
                 ORDER BY u.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            return res.json({
                verifications: rowsRes.rows,
                pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) }
            });
        }

        if (tab === 'staff') {
            const [staffRes, eligibleRes, pagesRes] = await Promise.all([
                pool.query(
                    `SELECT pm.page_member_id AS id,
                            pm.user_id,
                            pm.page_id,
                            pm.role_on_page AS role_scope,
                            pm.status,
                            pm.assigned_at,
                            u.first_name,
                            u.last_name,
                            u.first_name || ' ' || u.last_name AS full_name,
                            u.email,
                            pg.page_name
                     FROM page_members pm
                     JOIN users u ON pm.user_id = u.user_id
                     JOIN pages pg ON pm.page_id = pg.page_id
                     WHERE LOWER(pm.status) = 'active'
                     ORDER BY pm.assigned_at DESC`
                ),
                pool.query(
                    `SELECT u.user_id AS id, u.first_name, u.last_name, u.email, r.role_name
                     FROM users u
                     JOIN roles r ON u.role_id = r.role_id
                     WHERE LOWER(u.account_status) = 'active'
                     ORDER BY u.first_name ASC`
                ),
                pool.query(
                    `SELECT page_id AS id, page_name AS name FROM pages ORDER BY page_name ASC`
                )
            ]);

            return res.json({
                staff: staffRes.rows,
                eligibleUsers: eligibleRes.rows,
                availablePages: pagesRes.rows,
                pagination: { page: 1, limit: 50, total: staffRes.rowCount, totalPages: 1 }
            });
        }

        // Default: tab === 'all'
        const params = [];
        const clauses = [];

        if (role && role !== 'all') {
            params.push(role);
            clauses.push(`LOWER(r.role_name) = LOWER($${params.length})`);
        }
        if (status && status !== 'all') {
            params.push(status);
            clauses.push(`LOWER(u.account_status) = LOWER($${params.length})`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR sp.student_number ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const orderSql = sort === 'oldest' ? 'u.created_at ASC' : 'u.created_at DESC';

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             ${whereSql}`,
            params
        );
        const total = countRes.rows[0].total;

        params.push(limitNum, offset);
        const usersRes = await pool.query(
            `SELECT u.user_id AS id,
                    u.user_id,
                    u.first_name,
                    u.last_name,
                    u.first_name || ' ' || u.last_name AS full_name,
                    u.email,
                    u.account_status AS status,
                    u.is_email_verified,
                    u.created_at,
                    r.role_id,
                    r.role_name AS role,
                    sp.student_number AS student_id,
                    sp.year_level,
                    sp.verification_status,
                    sp.cor_url,
                    sp.student_id_url,
                    d.department_name AS college,
                    pr.program_name AS program
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             LEFT JOIN programs pr ON sp.program_id = pr.program_id
             ${whereSql}
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            users: usersRes.rows,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) }
        });
    } catch (error) {
        console.error('Admin users error:', error);
        return res.status(500).json({ message: 'Failed to fetch user management records.' });
    }
});

const handleVerifyStudent = async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const { decision, status, reason, remarks } = req.body;
        const normalizedDecision = String(decision || status || 'Verified').toLowerCase();
        const finalVerifStatus = normalizedDecision.startsWith('reject') ? 'Rejected' : 'Verified';

        await pool.query(
            `UPDATE student_profiles
             SET verification_status = $1,
                 verified_by = $2,
                 verified_at = NOW(),
                 verification_remarks = $3
             WHERE user_id = $4`,
            [finalVerifStatus, req.user.user_id, reason || remarks || null, targetUserId]
        );

        if (finalVerifStatus === 'Verified') {
            await pool.query(
                `UPDATE users SET account_status = 'Active', is_email_verified = TRUE WHERE user_id = $1`,
                [targetUserId]
            );
        }

        await pool.query(
            `INSERT INTO notifications (recipient_user_id, actor_user_id, notification_scope, type, title, message)
             VALUES ($1, $2, 'student', 'verification', $3, $4)`,
            [
                targetUserId,
                req.user.user_id,
                `Student Verification ${finalVerifStatus}`,
                finalVerifStatus === 'Verified'
                    ? 'Your student profile has been verified by the administration.'
                    : `Your student verification was rejected: ${reason || remarks || 'Please re-check your documents.'}`
            ]
        );

        await logAudit(req, {
            action: `Student Verification ${finalVerifStatus}`,
            module: 'users',
            targetType: 'user',
            targetId: targetUserId,
            details: { status: finalVerifStatus, reason: reason || remarks }
        });

        return res.json({ message: `Student verification marked as ${finalVerifStatus}.` });
    } catch (error) {
        console.error('Verify student error:', error);
        return res.status(500).json({ message: 'Failed to verify student.' });
    }
};
router.post('/users/:id/verify', handleVerifyStudent);
router.put('/users/:id/verify', handleVerifyStudent);
router.patch('/users/:id/verify', handleVerifyStudent);

router.post('/staff-access', async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId, pageId, roleScope = 'Editor' } = req.body;
        if (!userId || !pageId) {
            return res.status(400).json({ message: 'userId and pageId are required.' });
        }

        await client.query('BEGIN');

        await client.query(
            `UPDATE users
             SET role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1)
             WHERE user_id = $1 AND role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1)`,
            [Number(userId)]
        );

        const ins = await client.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'Active')
             ON CONFLICT (page_id, user_id)
             DO UPDATE SET role_on_page = EXCLUDED.role_on_page, status = 'Active', assigned_at = NOW()
             RETURNING *`,
            [Number(pageId), Number(userId), roleScope, req.user.user_id]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: 'Granted Page Staff Access',
            module: 'users',
            targetType: 'page_member',
            targetId: ins.rows[0].page_member_id,
            details: { userId, pageId, roleScope }
        });

        return res.status(201).json({ message: 'Staff access granted successfully.', assignment: ins.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Grant staff access error:', error);
        return res.status(500).json({ message: 'Failed to grant staff access.' });
    } finally {
        client.release();
    }
});

router.delete('/staff-access/:id', async (req, res) => {
    try {
        const memberId = Number(req.params.id);
        await pool.query(`DELETE FROM page_members WHERE page_member_id = $1`, [memberId]);
        return res.json({ message: 'Staff access revoked successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to revoke staff access.' });
    }
});

router.get('/documents/view', (req, res) => {
    const docPath = req.query.path;
    if (!docPath) return res.status(400).send('Document path missing.');
    if (docPath.startsWith('http://') || docPath.startsWith('https://')) {
        return res.redirect(docPath);
    }
    return res.status(200).send(`Document preview placeholder for: ${docPath}`);
});

// ============================================================================
// 4. PAGE MANAGEMENT (/api/admin/pages)
// ============================================================================
router.get('/pages', async (req, res) => {
    try {
        const { tab = 'all', search = '', category = 'all', sort = 'newest', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = [];

        if (tab && tab !== 'all') {
            params.push(tab);
            clauses.push(`LOWER(p.status) = LOWER($${params.length})`);
        }
        if (category && category !== 'all') {
            params.push(category);
            clauses.push(`LOWER(p.page_type) = LOWER($${params.length})`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.page_name ILIKE $${params.length} OR p.page_code ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const orderSql = sort === 'oldest' ? 'p.created_at ASC' : 'p.created_at DESC';

        const [countRes, summaryRes] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total FROM pages p ${whereSql}`, params),
            pool.query(
                `SELECT COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE LOWER(status) = 'pending')::int AS pending,
                        COUNT(*) FILTER (WHERE LOWER(status) IN ('approved', 'active'))::int AS approved,
                        COUNT(*) FILTER (WHERE LOWER(status) = 'suspended')::int AS suspended
                 FROM pages`
            )
        ]);

        const total = countRes.rows[0].total;
        params.push(limitNum, offset);

        const pagesRes = await pool.query(
            `SELECT p.page_id AS id,
                    p.page_id,
                    p.page_name AS name,
                    p.page_name,
                    p.page_code AS code,
                    p.page_description AS description,
                    p.page_type AS category,
                    p.status,
                    p.created_at,
                    COALESCE(d.department_name, o.organization_name, 'University Unit') AS unit_name,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS creator_name,
                    COUNT(DISTINCT pm.page_member_id) FILTER (WHERE LOWER(pm.status) = 'active')::int AS staff_count,
                    COUNT(DISTINCT pf.follow_id)::int AS followers_count
             FROM pages p
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             LEFT JOIN users u ON p.created_by = u.user_id
             LEFT JOIN page_members pm ON p.page_id = pm.page_id
             LEFT JOIN page_follows pf ON p.page_id = pf.page_id
             ${whereSql}
             GROUP BY p.page_id, d.department_id, o.organization_id, u.user_id
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            pages: pagesRes.rows,
            counts: summaryRes.rows[0],
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) }
        });
    } catch (error) {
        console.error('Admin pages error:', error);
        return res.status(500).json({ message: 'Failed to fetch campus pages.' });
    }
});

router.post('/pages', async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, page_name, code, page_code, description, category, department_id, organization_id } = req.body;
        const pName = (name || page_name || '').trim();
        if (!pName) return res.status(400).json({ message: 'Page name is required.' });

        const pCode = (code || page_code || pName.split(' ').map(w => w[0]).join('')).slice(0, 12).toUpperCase();
        const pType = department_id ? 'department' : (category === 'office' ? 'office' : 'organization');

        await client.query('BEGIN');

        const ins = await client.query(
            `INSERT INTO pages (page_name, page_code, page_description, page_type, department_id, organization_id, created_by, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Approved')
             RETURNING *, page_id AS id`,
            [
                pName,
                pCode,
                description || '',
                pType,
                department_id ? Number(department_id) : null,
                organization_id ? Number(organization_id) : null,
                req.user.user_id
            ]
        );

        await client.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, 'Admin', $2, 'Active')
             ON CONFLICT DO NOTHING`,
            [ins.rows[0].page_id, req.user.user_id]
        );

        await client.query('COMMIT');
        return res.status(201).json({ message: 'Page created successfully.', page: ins.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Admin create page error:', error);
        return res.status(500).json({ message: 'Failed to create page: ' + error.message });
    } finally {
        client.release();
    }
});

const handlePageStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const pageId = Number(req.params.id);
        const { status, decision, remarks, reason } = req.body;
        const newStatus = status || decision || 'Approved';

        await client.query('BEGIN');

        const upd = await client.query(
            `UPDATE pages SET status = $1 WHERE page_id = $2 RETURNING *`,
            [newStatus, pageId]
        );

        if (['Approved', 'Rejected', 'Suspended'].includes(newStatus)) {
            await client.query(
                `INSERT INTO page_reviews (page_id, reviewed_by, decision, remarks)
                 VALUES ($1, $2, $3, $4)`,
                [pageId, req.user.user_id, newStatus, remarks || reason || null]
            );
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Page Status Updated to ${newStatus}`,
            module: 'pages',
            targetType: 'page',
            targetId: pageId,
            details: { status: newStatus, remarks: remarks || reason }
        });

        return res.json({ message: `Page status updated to ${newStatus}.`, page: upd.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        return res.status(500).json({ message: 'Failed to update page status.' });
    } finally {
        client.release();
    }
};
router.patch('/pages/:id/status', handlePageStatus);
router.put('/pages/:id/status', handlePageStatus);
router.post('/pages/:id/status', handlePageStatus);

router.get('/pages/:pageId/staff', async (req, res) => {
    try {
        const pageId = Number(req.params.pageId);
        const [staffRes, eligibleRes] = await Promise.all([
            pool.query(
                `SELECT pm.page_member_id AS id,
                        pm.user_id,
                        pm.role_on_page AS role,
                        pm.status,
                        pm.assigned_at,
                        u.first_name,
                        u.last_name,
                        u.first_name || ' ' || u.last_name AS full_name,
                        u.email
                 FROM page_members pm
                 JOIN users u ON pm.user_id = u.user_id
                 WHERE pm.page_id = $1 AND LOWER(pm.status) = 'active'
                 ORDER BY pm.assigned_at DESC`,
                [pageId]
            ),
            pool.query(
                `SELECT u.user_id AS id, u.first_name, u.last_name, u.email
                 FROM users u
                 WHERE LOWER(u.account_status) = 'active'
                 ORDER BY u.first_name ASC`
            )
        ]);

        return res.json({ staff: staffRes.rows, eligibleUsers: eligibleRes.rows });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch page staff.' });
    }
});

router.post('/pages/:pageId/staff', async (req, res) => {
    try {
        const pageId = Number(req.params.pageId);
        const { userId, user_id, role = 'Editor' } = req.body;
        const targetUserId = Number(userId || user_id);

        await pool.query(
            `UPDATE users
             SET role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1)
             WHERE user_id = $1 AND role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1)`,
            [targetUserId]
        );

        const ins = await pool.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'Active')
             ON CONFLICT (page_id, user_id)
             DO UPDATE SET role_on_page = EXCLUDED.role_on_page, status = 'Active'
             RETURNING *`,
            [pageId, targetUserId, role, req.user.user_id]
        );

        return res.status(201).json({ message: 'Staff assigned to page.', staff: ins.rows[0] });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to assign staff to page.' });
    }
});

router.delete('/pages/staff/:staffId', async (req, res) => {
    try {
        await pool.query(`DELETE FROM page_members WHERE page_member_id = $1`, [Number(req.params.staffId)]);
        return res.json({ message: 'Staff member removed from page.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove staff member.' });
    }
});

// ============================================================================
// 5. POST APPROVAL (/api/admin/post-approval)
// ============================================================================
router.get('/post-approval', async (req, res) => {
    try {
        const { tab = 'pending', type = 'all', search = '', sort = 'oldest', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = ['p.is_archived = FALSE'];

        if (tab && tab !== 'all') {
            params.push(tab);
            clauses.push(`LOWER(p.moderation_status) = LOWER($${params.length})`);
        }
        if (type && type !== 'all') {
            params.push(type);
            clauses.push(`LOWER(p.post_type) = LOWER($${params.length})`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR pg.page_name ILIKE $${params.length})`);
        }

        const whereSql = clauses.join(' AND ');
        const orderSql = sort === 'newest' ? 'p.created_at DESC' : 'p.created_at ASC';

        const [countRes, summaryRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total FROM posts p LEFT JOIN pages pg ON p.page_id = pg.page_id WHERE ${whereSql}`,
                params
            ),
            pool.query(
                `SELECT COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND post_type = 'announcement' AND is_archived = FALSE)::int AS "pendingAnnouncements",
                        COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND post_type = 'event' AND is_archived = FALSE)::int AS "pendingEvents",
                        COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND is_archived = FALSE)::int AS "totalPending"
                 FROM posts`
            )
        ]);

        const total = countRes.rows[0].total;
        params.push(limitNum, offset);

        const itemsRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_type AS type,
                    p.title,
                    p.content AS description,
                    p.content AS body,
                    p.image_url,
                    p.audience,
                    p.moderation_status AS status,
                    p.created_at,
                    COALESCE(pc.category_name, 'General') AS category,
                    COALESCE(pg.page_name, 'Campus Page') AS page_name,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Staff') AS author_name,
                    ed.event_date,
                    ed.location
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN users u ON p.creator_user_id = u.user_id
             WHERE ${whereSql}
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            items: itemsRes.rows,
            counts: summaryRes.rows[0],
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) }
        });
    } catch (error) {
        console.error('Post approval fetch error:', error);
        return res.status(500).json({ message: 'Failed to fetch post approval queue.' });
    }
});

const handlePostDecision = async (req, res) => {
    const client = await pool.connect();
    try {
        const postId = Number(req.params.id);
        const { decision, reason } = req.body;
        const norm = String(decision || 'approve').toLowerCase();

        let modStatus = 'Approved';
        let postStatus = 'Published';
        let logDecision = 'approve';

        if (norm.startsWith('reject')) {
            modStatus = 'Rejected';
            postStatus = 'Rejected';
            logDecision = 'reject';
        } else if (norm.includes('correction')) {
            modStatus = 'Correction';
            postStatus = 'Pending';
            logDecision = 'correction';
        }

        await client.query('BEGIN');

        const upd = await client.query(
            `UPDATE posts
             SET moderation_status = $1,
                 status = CASE WHEN post_type = 'event' AND $2 = 'Published' THEN 'Upcoming' ELSE $2 END
             WHERE post_id = $3
             RETURNING *`,
            [modStatus, postStatus, postId]
        );

        if (upd.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found.' });
        }

        const post = upd.rows[0];

        await client.query(
            `INSERT INTO post_moderation_logs (post_id, reviewer_user_id, decision, reason)
             VALUES ($1, $2, $3, $4)`,
            [postId, req.user.user_id, logDecision, reason || null]
        );

        await client.query(
            `INSERT INTO notifications (recipient_user_id, actor_user_id, page_id, post_id, notification_scope, type, title, message)
             VALUES ($1, $2, $3, $4, 'mypage', 'moderation', $5, $6)`,
            [
                post.creator_user_id,
                req.user.user_id,
                post.page_id,
                postId,
                `Post ${modStatus}: ${post.title}`,
                reason || `Your ${post.post_type} "${post.title}" was marked as ${modStatus}.`
            ]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Post Moderation Decision (${modStatus})`,
            module: 'posts',
            targetType: 'post',
            targetId: postId,
            details: { decision: modStatus, reason }
        });

        return res.json({ message: `Post marked as ${modStatus}.`, item: post });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Post decision error:', error);
        return res.status(500).json({ message: 'Failed to record post moderation decision.' });
    } finally {
        client.release();
    }
};
router.post('/post-approval/:id/decision', handlePostDecision);
router.put('/post-approval/:id/decision', handlePostDecision);

// ============================================================================
// 6. ARCHIVES (/api/admin/archives)
// ============================================================================
router.get('/archives/summary', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE is_archived = TRUE)::int AS "totalArchived",
                    COUNT(*) FILTER (WHERE is_archived = TRUE AND post_type = 'announcement')::int AS announcements,
                    COUNT(*) FILTER (WHERE is_archived = TRUE AND post_type = 'event')::int AS events,
                    0::int AS other,
                    COUNT(*) FILTER (WHERE is_archived = TRUE AND archived_at >= date_trunc('month', NOW()))::int AS "thisMonth"
             FROM posts`
        );
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch archive summary.' });
    }
});

router.get('/archives', async (req, res) => {
    try {
        const { category = 'ALL', search = '', recordType = 'ALL', page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = ['p.is_archived = TRUE'];

        const typeFilter = recordType !== 'ALL' ? recordType : category;
        if (typeFilter && typeFilter !== 'ALL') {
            if (typeFilter.toLowerCase().includes('announcement')) {
                clauses.push(`p.post_type = 'announcement'`);
            } else if (typeFilter.toLowerCase().includes('event')) {
                clauses.push(`p.post_type = 'event'`);
            }
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR pg.page_name ILIKE $${params.length})`);
        }

        const whereSql = clauses.join(' AND ');

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total FROM posts p LEFT JOIN pages pg ON p.page_id = pg.page_id WHERE ${whereSql}`,
            params
        );
        const totalRecords = countRes.rows[0].total;

        params.push(limitNum, offset);
        const rowsRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.title,
                    p.post_type AS record_type,
                    p.post_type AS category,
                    COALESCE(pg.page_name, 'University Page') AS source_department,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS archived_by_name,
                    COALESCE(p.archive_reason, 'Expired / Administrative') AS reason,
                    COALESCE(p.archived_at, p.updated_at) AS archived_at,
                    p.created_at
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN users u ON p.archived_by = u.user_id
             WHERE ${whereSql}
             ORDER BY COALESCE(p.archived_at, p.updated_at) DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            records: rowsRes.rows,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.max(1, Math.ceil(totalRecords / limitNum)),
                totalRecords,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Archives fetch error:', error);
        return res.status(500).json({ message: 'Failed to fetch archived records.' });
    }
});

const handleRestoreArchive = async (req, res) => {
    try {
        const postId = Number(req.params.id);
        await pool.query(
            `UPDATE posts
             SET is_archived = FALSE,
                 status = CASE WHEN post_type = 'event' THEN 'Upcoming' ELSE 'Published' END,
                 archived_at = NULL
             WHERE post_id = $1`,
            [postId]
        );

        await logAudit(req, {
            action: 'Restored Archived Record',
            module: 'archives',
            targetType: 'post',
            targetId: postId
        });

        return res.json({ message: 'Record restored successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to restore record.' });
    }
};
router.post('/archives/:id/restore', handleRestoreArchive);
router.put('/archives/:id/restore', handleRestoreArchive);

router.get('/archives/export', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.post_id AS id, p.title, p.post_type, pg.page_name, p.archive_reason, p.archived_at
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             WHERE p.is_archived = TRUE
             ORDER BY p.archived_at DESC`
        );

        let csv = 'ID,Title,Type,Source Page,Reason,Archived Date\n';
        for (const r of rows) {
            csv += `"${r.id}","${String(r.title || '').replace(/"/g, '""')}","${r.post_type}","${r.page_name || ''}","${r.archive_reason || ''}","${r.archived_at || ''}"\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="archives_export.csv"');
        return res.send(csv);
    } catch (error) {
        return res.status(500).send('Export failed');
    }
});

// ============================================================================
// 7. REPORTS (/api/admin/reports)
// ============================================================================
router.get('/reports/summary', async (req, res) => {
    try {
        const [students, posts, attendance, pages] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE LOWER(verification_status) = 'verified')::int AS verified FROM student_profiles`),
            pool.query(`SELECT COUNT(*) FILTER (WHERE post_type = 'announcement' AND is_archived = FALSE)::int AS announcements, COUNT(*) FILTER (WHERE post_type = 'event' AND is_archived = FALSE)::int AS events, COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending')::int AS pending_moderation FROM posts`),
            pool.query(`SELECT COUNT(*)::int AS total_registrations, COUNT(*) FILTER (WHERE LOWER(status) = 'attended')::int AS attended FROM event_registrations`),
            pool.query(`SELECT COUNT(*)::int AS total_pages FROM pages WHERE LOWER(status) IN ('approved', 'active')`)
        ]);

        return res.json({
            totalStudents: students.rows[0].total,
            verifiedStudents: students.rows[0].verified,
            totalAnnouncements: posts.rows[0].announcements,
            totalEvents: posts.rows[0].events,
            pendingModeration: posts.rows[0].pending_moderation,
            totalRegistrations: attendance.rows[0].total_registrations,
            totalAttended: attendance.rows[0].attended,
            activePages: pages.rows[0].total_pages
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch reports summary.' });
    }
});

router.get('/reports/metadata', async (req, res) => {
    try {
        const [depts, progs, pages, cats, ays] = await Promise.all([
            pool.query(`SELECT department_id AS id, department_name AS name, department_code AS code FROM departments ORDER BY department_name ASC`),
            pool.query(`SELECT program_id AS id, program_name AS name, department_id FROM programs ORDER BY program_name ASC`),
            pool.query(`SELECT page_id AS id, page_name AS name FROM pages ORDER BY page_name ASC`),
            pool.query(`SELECT category_id AS id, category_name AS name FROM post_categories ORDER BY category_name ASC`),
            pool.query(`SELECT academic_year_id AS id, start_year || '-' || end_year || ' ' || semester AS label, is_active FROM academic_years ORDER BY start_year DESC`)
        ]);

        return res.json({
            departments: depts.rows,
            programs: progs.rows,
            pages: pages.rows,
            categories: cats.rows,
            academicYears: ays.rows
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load report metadata.' });
    }
});

router.get('/reports/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 15 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 15);
        const offset = (pageNum - 1) * limitNum;

        let rows = [];
        let total = 0;

        if (category === 'students') {
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM student_profiles`);
            total = c.rows[0].cnt;
            const r = await pool.query(
                `SELECT u.user_id AS id, sp.student_number AS student_id, u.first_name || ' ' || u.last_name AS student_name,
                        u.email, d.department_name AS college, pr.program_name AS program, sp.year_level,
                        sp.verification_status AS status, u.created_at
                 FROM student_profiles sp
                 JOIN users u ON sp.user_id = u.user_id
                 LEFT JOIN departments d ON sp.department_id = d.department_id
                 LEFT JOIN programs pr ON sp.program_id = pr.program_id
                 ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
                [limitNum, offset]
            );
            rows = r.rows;
        } else if (category === 'announcements') {
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM posts WHERE post_type = 'announcement'`);
            total = c.rows[0].cnt;
            const r = await pool.query(
                `SELECT p.post_id AS id, p.title, COALESCE(pg.page_name, 'Campus Page') AS page_name,
                        COALESCE(pc.category_name, 'General') AS category, p.audience, p.status, p.created_at
                 FROM posts p
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                 WHERE p.post_type = 'announcement'
                 ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
                [limitNum, offset]
            );
            rows = r.rows;
        } else if (category === 'events') {
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM posts WHERE post_type = 'event'`);
            total = c.rows[0].cnt;
            const r = await pool.query(
                `SELECT p.post_id AS id, p.title, COALESCE(pg.page_name, 'Campus Page') AS page_name,
                        ed.event_date, ed.location, ed.capacity,
                        COUNT(er.registration_id)::int AS registered_count, p.status
                 FROM posts p
                 JOIN event_details ed ON p.post_id = ed.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
                 WHERE p.post_type = 'event'
                 GROUP BY p.post_id, ed.post_id, pg.page_id
                 ORDER BY ed.event_date DESC LIMIT $1 OFFSET $2`,
                [limitNum, offset]
            );
            rows = r.rows;
        } else if (category === 'attendance') {
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM event_attendance_records`);
            total = c.rows[0].cnt;
            const r = await pool.query(
                `SELECT ar.attendance_id AS id, p.title AS event_title,
                        u.first_name || ' ' || u.last_name AS student_name,
                        COALESCE(sp.student_number, 'N/A') AS student_id,
                        ar.status, ar.checkin_time, ar.check_in_method
                 FROM event_attendance_records ar
                 JOIN event_registrations er ON ar.registration_id = er.registration_id
                 JOIN posts p ON er.event_post_id = p.post_id
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 ORDER BY ar.updated_at DESC LIMIT $1 OFFSET $2`,
                [limitNum, offset]
            );
            rows = r.rows;
        } else if (category === 'pages') {
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM pages`);
            total = c.rows[0].cnt;
            const r = await pool.query(
                `SELECT p.page_id AS id, p.page_name, p.page_code, p.page_type, p.status,
                        COUNT(DISTINCT po.post_id)::int AS total_posts,
                        COUNT(DISTINCT pf.follow_id)::int AS followers_count,
                        p.created_at
                 FROM pages p
                 LEFT JOIN posts po ON p.page_id = po.page_id
                 LEFT JOIN page_follows pf ON p.page_id = pf.page_id
                 GROUP BY p.page_id
                 ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
                [limitNum, offset]
            );
            rows = r.rows;
        } else if (category === 'moderation') {
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM post_moderation_logs`);
            total = c.rows[0].cnt;
            const r = await pool.query(
                `SELECT m.moderation_id AS id, p.title, p.post_type, m.decision, m.reason,
                        u.first_name || ' ' || u.last_name AS reviewer_name, m.created_at
                 FROM post_moderation_logs m
                 JOIN posts p ON m.post_id = p.post_id
                 LEFT JOIN users u ON m.reviewer_user_id = u.user_id
                 ORDER BY m.created_at DESC LIMIT $1 OFFSET $2`,
                [limitNum, offset]
            );
            rows = r.rows;
        }

        return res.json({
            rows,
            records: rows,
            data: rows,
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Report category error:', error);
        return res.status(500).json({ message: 'Failed to load report data.' });
    }
});

// ============================================================================
// 8. AUDIT LOGS (/api/admin/audit-logs)
// ============================================================================
router.get('/audit-logs/summary', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*)::int AS "totalActions",
                    COUNT(*) FILTER (WHERE UPPER(outcome) = 'SUCCESS')::int AS "successfulActions",
                    COUNT(*) FILTER (WHERE UPPER(outcome) = 'FAILURE')::int AS "failedActions",
                    COUNT(*) FILTER (WHERE is_security_event = TRUE)::int AS "securityEvents"
             FROM audit_logs`
        );
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch audit log summary.' });
    }
});

router.get('/audit-logs', async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', role = '', module = '', outcome = '', securityOnly = 'false' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 15);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = [];

        if (role && role !== 'ALL') {
            params.push(role);
            clauses.push(`LOWER(l.actor_role) = LOWER($${params.length})`);
        }
        if (module && module !== 'ALL') {
            params.push(module);
            clauses.push(`LOWER(l.module) = LOWER($${params.length})`);
        }
        if (outcome && outcome !== 'ALL') {
            params.push(outcome);
            clauses.push(`LOWER(l.outcome) = LOWER($${params.length})`);
        }
        if (String(securityOnly) === 'true') {
            clauses.push(`l.is_security_event = TRUE`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(l.action ILIKE $${params.length} OR l.module ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total FROM audit_logs l LEFT JOIN users u ON l.actor_user_id = u.user_id ${whereSql}`,
            params
        );
        const totalRecords = countRes.rows[0].total;
        const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));

        params.push(limitNum, offset);
        const logsRes = await pool.query(
            `SELECT l.log_id AS id,
                    l.action,
                    l.module,
                    l.target_type,
                    l.target_id,
                    l.outcome,
                    l.is_security_event,
                    l.ip_address,
                    l.details,
                    l.created_at,
                    COALESCE(u.first_name || ' ' || u.last_name, 'System') AS actor_name,
                    COALESCE(u.email, 'system@wmsu.edu.ph') AS actor_email,
                    COALESCE(l.actor_role, 'system') AS actor_role
             FROM audit_logs l
             LEFT JOIN users u ON l.actor_user_id = u.user_id
             ${whereSql}
             ORDER BY l.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            logs: logsRes.rows,
            totalRecords,
            totalPages,
            currentPage: pageNum,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Audit logs error:', error);
        return res.status(500).json({ message: 'Failed to load audit logs.' });
    }
});

router.get('/audit-logs/export', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT l.log_id, l.created_at, COALESCE(u.email, 'System') AS actor, l.actor_role, l.action, l.module, l.outcome, l.ip_address
             FROM audit_logs l
             LEFT JOIN users u ON l.actor_user_id = u.user_id
             ORDER BY l.created_at DESC LIMIT 1000`
        );

        let csv = 'Log ID,Timestamp,Actor,Role,Action,Module,Outcome,IP Address\n';
        for (const r of rows) {
            csv += `"${r.log_id}","${r.created_at}","${r.actor}","${r.actor_role || ''}","${String(r.action || '').replace(/"/g, '""')}","${r.module}","${r.outcome}","${r.ip_address || ''}"\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
        return res.send(csv);
    } catch (error) {
        return res.status(500).send('Export failed');
    }
});

// ============================================================================
// 9. SYSTEM SETTINGS & ACADEMIC YEARS (/api/admin/settings, /academic-years)
// ============================================================================
router.get('/settings', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT s.setting_key, s.setting_value, s.updated_at,
                    u.first_name || ' ' || u.last_name AS updated_by_name
             FROM system_settings s
             LEFT JOIN users u ON s.updated_by = u.user_id`
        );

        const merged = { ...DEFAULT_SETTINGS };
        let latestAt = null;
        let latestBy = null;

        for (const row of rows) {
            merged[row.setting_key] = row.setting_value;
            if (!latestAt || new Date(row.updated_at) > new Date(latestAt)) {
                latestAt = row.updated_at;
                latestBy = row.updated_by_name;
            }
        }

        return res.json({
            settings: merged,
            metadata: { updatedAt: latestAt, updatedBy: latestBy }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load system settings.' });
    }
});

const saveSystemSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        const incoming = req.body.settings || req.body || {};
        await client.query('BEGIN');

        for (const [key, value] of Object.entries(incoming)) {
            if (key in DEFAULT_SETTINGS) {
                await client.query(
                    `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
                     VALUES ($1, $2::jsonb, $3, NOW())
                     ON CONFLICT (setting_key)
                     DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
                    [key, JSON.stringify(value), req.user.user_id]
                );
            }
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: 'Updated System Settings',
            module: 'settings',
            targetType: 'system_settings'
        });

        return res.json({ message: 'System settings saved successfully.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Save settings error:', error);
        return res.status(500).json({ message: 'Failed to save system settings.' });
    } finally {
        client.release();
    }
};
router.put('/settings', saveSystemSettings);
router.post('/settings', saveSystemSettings);

router.get('/academic-years', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT academic_year_id AS id, start_year, end_year, semester, is_active, created_at
             FROM academic_years
             ORDER BY is_active DESC, start_year DESC, academic_year_id DESC`
        );

        const active = rows.find(r => r.is_active) || rows[0] || {
            start_year: 2026,
            end_year: 2027,
            semester: '1st Semester',
            is_active: true
        };

        return res.json({
            current: active,
            history: rows
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load academic years.' });
    }
});

const saveAcademicYear = async (req, res) => {
    const client = await pool.connect();
    try {
        const { start_year, end_year, semester, is_active = true } = req.body;
        const sYear = Number(start_year) || 2026;
        const eYear = Number(end_year) || sYear + 1;

        await client.query('BEGIN');

        if (is_active) {
            await client.query(`UPDATE academic_years SET is_active = FALSE WHERE is_active = TRUE`);
        }

        const ins = await client.query(
            `INSERT INTO academic_years (start_year, end_year, semester, is_active, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING academic_year_id AS id, start_year, end_year, semester, is_active, created_at`,
            [sYear, eYear, semester || '1st Semester', Boolean(is_active), req.user.user_id]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Updated Academic Year (${sYear}-${eYear} ${semester})`,
            module: 'settings',
            targetType: 'academic_year',
            targetId: ins.rows[0].id
        });

        return res.json({ message: 'Academic year updated successfully.', current: ins.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Save academic year error:', error);
        return res.status(500).json({ message: 'Failed to update academic year.' });
    } finally {
        client.release();
    }
};
router.post('/academic-years', saveAcademicYear);
router.put('/academic-years', saveAcademicYear);

module.exports = router;
