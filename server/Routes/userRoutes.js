const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { authenticateUser, logAudit } = require('../middleware/auth');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development',
    message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development',
    message: { message: 'Too many registration attempts. Please wait a few minutes.' }
});

// Helper: extract user ID optionally from token or query/body
async function resolveUserId(req) {
    if (req.query?.student_id) return Number(req.query.student_id);
    if (req.query?.staff_id) return Number(req.query.staff_id);
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

// -------- HEALTH / TEST -------- //
router.get('/test', (req, res) => {
    res.json({ message: 'User routes active on normalized 3NF PostgreSQL schema.' });
});

// -------- STUDENT REGISTRATION -------- //
router.post('/', registerLimiter, async (req, res) => {
    let client;
    let tx = false;
    try {
        client = await pool.connect();
        const {
            student_id,
            first_name,
            middle_initial,
            last_name,
            department_id,
            program_id,
            year_level,
            email,
            password,
            confirm_password,
            terms_accepted
        } = req.body;

        if (!student_id || !first_name || !last_name || !department_id || !year_level || !email || !password) {
            return res.status(400).json({ message: 'Please complete all required fields.' });
        }

        if (terms_accepted !== true) {
            return res.status(400).json({ message: 'You must accept the Terms and Conditions.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@wmsu\.edu\.ph$/.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Use a valid @wmsu.edu.ph email address.' });
        }

        if (password !== confirm_password) {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        await client.query('BEGIN');
        tx = true;

        // Purge expired unverified accounts so student can re-register if token expired
        await client.query(
            `DELETE FROM users u
             USING auth_tokens at
             WHERE u.user_id = at.user_id
               AND u.is_email_verified = FALSE
               AND u.account_status = 'Pending'
               AND at.token_type = 'email_verification'
               AND at.expires_at < NOW()
               AND (LOWER(u.email) = $1 OR EXISTS (
                   SELECT 1 FROM student_profiles sp WHERE sp.user_id = u.user_id AND sp.student_number = $2
               ))`,
            [normalizedEmail, student_id.trim()]
        );

        // Check duplicate email or student_number
        const dupRes = await client.query(
            `SELECT u.user_id
             FROM users u
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE LOWER(u.email) = $1 OR sp.student_number = $2`,
            [normalizedEmail, student_id.trim()]
        );

        if (dupRes.rowCount > 0) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(409).json({
                message: 'An account with this email or Student ID already exists.'
            });
        }

        // Student Role ID
        const roleRes = await client.query(`SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1`);
        const studentRoleId = roleRes.rows[0]?.role_id || 3;

        // Validate Department & Program
        const deptRes = await client.query(
            `SELECT department_id FROM departments WHERE department_id = $1 AND LOWER(status) = 'active'`,
            [Number(department_id)]
        );
        if (deptRes.rowCount === 0) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(400).json({ message: 'Selected college/department is invalid or inactive.' });
        }

        if (program_id) {
            const progRes = await client.query(
                `SELECT program_id FROM programs WHERE program_id = $1 AND department_id = $2`,
                [Number(program_id), Number(department_id)]
            );
            if (progRes.rowCount === 0) {
                await client.query('ROLLBACK');
                tx = false;
                return res.status(400).json({ message: 'Selected course does not belong to this department.' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const autoConfirmInDev = process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_EMAIL_FALLBACK === 'true';

        // 1. Insert into users (Normalized Core Identity)
        const userIns = await client.query(
            `INSERT INTO users (
                role_id, first_name, middle_initial, last_name, email, password_hash,
                is_email_verified, account_status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING user_id, first_name, last_name, email`,
            [
                studentRoleId,
                first_name.trim(),
                middle_initial ? middle_initial.trim() : null,
                last_name.trim(),
                normalizedEmail,
                hashedPassword,
                autoConfirmInDev,
                autoConfirmInDev ? 'Active' : 'Pending'
            ]
        );
        const newUserId = userIns.rows[0].user_id;

        // 2. Insert into student_profiles (Normalized 1:1 Student Subtype)
        await client.query(
            `INSERT INTO student_profiles (
                user_id, student_number, department_id, program_id, year_level, verification_status
             ) VALUES ($1, $2, $3, $4, $5, 'Pending')`,
            [
                newUserId,
                student_id.trim(),
                Number(department_id),
                program_id ? Number(program_id) : null,
                year_level
            ]
        );

        // 3. Insert into auth_tokens
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query(
            `INSERT INTO auth_tokens (user_id, token_type, token_hash, expires_at)
             VALUES ($1, 'email_verification', $2, $3)`,
            [newUserId, tokenHash, expiresAt]
        );

        const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${rawToken}`;

        try {
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                await transporter.sendMail({
                    from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
                    to: normalizedEmail,
                    subject: 'CRIMSON - Confirm Your Email Address',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                            <h2 style="color: #800000;">Welcome to CRIMSON, ${first_name}!</h2>
                            <p>Please confirm your institutional email address by clicking the button below:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${confirmUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm Email Address</a>
                            </div>
                        </div>
                    `
                });
            } else if (autoConfirmInDev) {
                console.log('🔗 [DEV FALLBACK] CONFIRMATION LINK:', confirmUrl);
            }
        } catch (emailErr) {
            if (autoConfirmInDev) {
                console.log('🔗 [DEV FALLBACK] CONFIRMATION LINK:', confirmUrl);
            } else {
                await client.query('ROLLBACK');
                tx = false;
                return res.status(502).json({ message: 'Failed to send verification email.' });
            }
        }

        await client.query('COMMIT');
        tx = false;

        await logAudit(req, {
            action: 'Student Registration',
            module: 'auth',
            targetType: 'user',
            targetId: newUserId,
            actorUserId: newUserId,
            actorRole: 'student',
            details: { email: normalizedEmail, student_id: student_id.trim() }
        });

        return res.status(201).json({
            message: 'Registration submitted successfully! You can now sign in.'
        });
    } catch (error) {
        if (client && tx) {
            try { await client.query('ROLLBACK'); } catch (_) {}
        }
        console.error('Registration error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'An account with this Student ID or email already exists.' });
        }
        return res.status(500).json({ message: 'Server error during registration.' });
    } finally {
        client?.release();
    }
});

// -------- CONFIRM EMAIL -------- //
router.get('/confirm-email', async (req, res) => {
    let client;
    let tx = false;
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required.' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        client = await pool.connect();
        await client.query('BEGIN');
        tx = true;

        const tokRes = await client.query(
            `SELECT token_id, user_id, expires_at, used_at
             FROM auth_tokens
             WHERE token_hash = $1 AND token_type = 'email_verification'
             FOR UPDATE`,
            [tokenHash]
        );

        if (tokRes.rowCount === 0) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(400).json({ message: 'Invalid or already-used verification token.' });
        }

        const tok = tokRes.rows[0];
        if (tok.used_at || new Date() > new Date(tok.expires_at)) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(400).json({ message: 'Verification token has expired or already been used.' });
        }

        const userUpd = await client.query(
            `UPDATE users
             SET is_email_verified = TRUE, account_status = 'Active'
             WHERE user_id = $1
             RETURNING user_id, first_name, last_name, email, account_status AS status`,
            [tok.user_id]
        );

        await client.query(
            `UPDATE auth_tokens SET used_at = NOW() WHERE token_id = $1`,
            [tok.token_id]
        );

        await client.query('COMMIT');
        tx = false;

        return res.status(200).json({
            message: 'Email confirmed successfully! Your account is now active.',
            user: userUpd.rows[0]
        });
    } catch (error) {
        if (client && tx) {
            try { await client.query('ROLLBACK'); } catch (_) {}
        }
        console.error('Confirm email error:', error);
        return res.status(500).json({ message: 'Server error during email confirmation.' });
    } finally {
        client?.release();
    }
});

// -------- LOGIN -------- //
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.middle_initial, u.last_name, u.email,
                    u.password_hash, u.role_id, u.account_status AS status, r.role_name,
                    sp.student_number AS student_id, sp.department_id, sp.program_id,
                    sp.year_level, sp.verification_status,
                    d.department_name, pr.program_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             LEFT JOIN programs pr ON sp.program_id = pr.program_id
             WHERE LOWER(u.email) = LOWER($1)`,
            [email.trim()]
        );

        if (result.rowCount === 0) {
            await logAudit(req, {
                action: 'Failed Login Attempt',
                module: 'auth',
                outcome: 'FAILURE',
                isSecurityEvent: true,
                details: { email: email.trim(), reason: 'User not found' }
            });
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        if (String(user.status).toLowerCase() === 'suspended' || String(user.status).toLowerCase() === 'archived') {
            return res.status(403).json({ message: `Your account is currently ${user.status}.` });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            await logAudit(req, {
                action: 'Failed Login Attempt',
                module: 'auth',
                actorUserId: user.user_id,
                actorRole: user.role_name,
                outcome: 'FAILURE',
                isSecurityEvent: true,
                details: { email: email.trim(), reason: 'Incorrect password' }
            });
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { userId: user.user_id, roleId: user.role_id, role: user.role_name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '8h' }
        );

        delete user.password_hash;
        user.id = user.user_id;

        await logAudit(req, {
            action: 'User Login',
            module: 'auth',
            actorUserId: user.user_id,
            actorRole: user.role_name,
            targetType: 'user',
            targetId: user.user_id,
            outcome: 'SUCCESS'
        });

        return res.status(200).json({
            message: 'Login successful!',
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error during login.' });
    }
});

// -------- DASHBOARD FEED (USED BY STUDENT & STAFF VIEWS) -------- //
const handleDashboardData = async (req, res) => {
    try {
        const userId = await resolveUserId(req);

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
                    p.status,
                    p.created_at,
                    pg.page_name,
                    pg.page_name AS department_name,
                    pg.avatar_url AS page_avatar_url,
                    COALESCE(pg.page_code, d.department_code, o.org_code, 'WMSU') AS code,
                    CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_followed
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN organizations o ON pg.organization_id = o.organization_id
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
                    p.status,
                    p.created_at,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.location AS venue,
                    ed.capacity,
                    ed.capacity AS max_capacity,
                    ed.organizer_info,
                    ed.registration_deadline,
                    pg.page_name,
                    pg.page_name AS department_name,
                    pg.avatar_url AS page_avatar_url,
                    COALESCE(pg.page_code, d.department_code, o.org_code, 'WMSU') AS code,
                    COUNT(er.registration_id) FILTER (WHERE LOWER(er.status) != 'cancelled')::int AS registered_count,
                    CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_followed,
                    CASE WHEN $1::int IS NOT NULL AND EXISTS(
                        SELECT 1 FROM event_registrations er2
                        WHERE er2.event_post_id = p.post_id AND er2.registrant_user_id = $1 AND LOWER(er2.status) != 'cancelled'
                    ) THEN TRUE ELSE FALSE END AS is_registered
             FROM posts p
             JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN organizations o ON pg.organization_id = o.organization_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
             LEFT JOIN page_follows pf ON p.page_id = pf.page_id AND pf.follower_user_id = $1
             WHERE p.post_type = 'event'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
             GROUP BY p.post_id, ed.post_id, pg.page_id, d.department_id, o.organization_id, pc.category_id, pf.follow_id
             ORDER BY p.is_pinned DESC,
                      (CASE WHEN $1::int IS NOT NULL AND pf.follow_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                      p.created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            announcements: annRes.rows,
            events: evRes.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
};

router.get('/dashboard-data', handleDashboardData);
router.post('/dashboard-data', handleDashboardData);

// -------- EVENTS DATA -------- //
router.get('/events-data', async (req, res) => {
    try {
        const evRes = await pool.query(
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
        return res.status(200).json({ events: evRes.rows });
    } catch (error) {
        console.error('Error fetching events-data:', error);
        return res.status(500).json({ message: 'Server error fetching events.' });
    }
});

// -------- MY REGISTERED EVENTS -------- //
router.get('/my-events', async (req, res) => {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return res.status(200).json({ events: [] });
        }

        const result = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_id AS event_id,
                    p.title,
                    p.title AS event_title,
                    p.content AS event_description,
                    p.image_url,
                    p.image_url AS poster_url,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    ed.capacity,
                    pg.page_name,
                    pg.page_name AS department_name,
                    er.registration_id,
                    er.status AS registration_status,
                    er.registered_at
             FROM event_registrations er
             JOIN event_details ed ON er.event_post_id = ed.post_id
             JOIN posts p ON ed.post_id = p.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             WHERE er.registrant_user_id = $1
               AND LOWER(er.status) != 'cancelled'
             ORDER BY ed.event_date ASC`,
            [userId]
        );

        return res.status(200).json({ events: result.rows });
    } catch (error) {
        console.error('Error fetching my-events:', error);
        return res.status(500).json({ message: 'Server error fetching registered events.' });
    }
});

// -------- REGISTER FOR EVENT -------- //
router.post('/events/:id/register', async (req, res) => {
    try {
        const eventId = Number(req.params.id);
        const userId = await resolveUserId(req);

        if (!userId || !eventId) {
            return res.status(400).json({ message: 'User ID and Event ID are required.' });
        }

        const regRes = await pool.query(
            `INSERT INTO event_registrations (event_post_id, registrant_user_id, status)
             VALUES ($1, $2, 'Registered')
             ON CONFLICT (event_post_id, registrant_user_id)
             DO UPDATE SET status = 'Registered', cancelled_at = NULL, registered_at = NOW()
             RETURNING *`,
            [eventId, userId]
        );

        return res.status(201).json({
            message: 'Successfully registered for the event!',
            registration: regRes.rows[0]
        });
    } catch (error) {
        console.error('Error registering for event:', error);
        return res.status(500).json({ message: 'Server error registering for event.' });
    }
});

// -------- CANCEL EVENT REGISTRATION -------- //
const handleCancelRegistration = async (req, res) => {
    try {
        const eventId = Number(req.params.id);
        const userId = await resolveUserId(req);

        if (!userId || !eventId) {
            return res.status(400).json({ message: 'User ID and Event ID are required.' });
        }

        await pool.query(
            `DELETE FROM event_registrations WHERE event_post_id = $1 AND registrant_user_id = $2`,
            [eventId, userId]
        );

        return res.status(200).json({ message: 'Registration cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling registration:', error);
        return res.status(500).json({ message: 'Server error cancelling registration.' });
    }
};

router.post('/events/:id/cancel', handleCancelRegistration);
router.delete('/events/:id/cancel', handleCancelRegistration);
router.delete('/events/:id/register', handleCancelRegistration);

// -------- USER NOTIFICATIONS -------- //
router.get('/notifications', async (req, res) => {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return res.status(200).json({ notifications: [] });
        }

        const result = await pool.query(
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
             WHERE recipient_user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({ notifications: result.rows });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

const markNotificationRead = async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE notification_id = $1`,
            [Number(req.params.id)]
        );
        return res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating notification.' });
    }
};
router.post('/notifications/:id/read', markNotificationRead);
router.put('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/:id/read', markNotificationRead);

const markAllNotificationsRead = async (req, res) => {
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
        return res.status(500).json({ message: 'Error marking notifications as read.' });
    }
};
router.post('/notifications/read-all', markAllNotificationsRead);
router.put('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/read-all', markAllNotificationsRead);

const archiveNotification = async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications SET is_archived = TRUE WHERE notification_id = $1`,
            [Number(req.params.id)]
        );
        return res.status(200).json({ message: 'Notification archived.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error archiving notification.' });
    }
};
router.post('/notifications/:id/archive', archiveNotification);
router.put('/notifications/:id/archive', archiveNotification);
router.patch('/notifications/:id/archive', archiveNotification);

router.delete('/notifications/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM notifications WHERE notification_id = $1`, [Number(req.params.id)]);
        return res.status(200).json({ message: 'Notification deleted.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error deleting notification.' });
    }
});

module.exports = router;
