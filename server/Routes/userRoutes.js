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

function parseBase64Image(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return null;
    const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null; // max 5MB per photo
    return { mimeType, buffer };
}

async function sendVerificationEmail(toEmail, firstName, confirmUrl) {
    const autoConfirmInDev = process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_EMAIL_FALLBACK === 'true';
    try {
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
                to: toEmail,
                subject: 'CRIMSON - Confirm Your Email Address',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #800000;">Welcome to CRIMSON, ${firstName}!</h2>
                        <p>Please confirm your institutional email address by clicking the button below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm Email Address</a>
                        </div>
                    </div>
                `
            });
            return { sent: true };
        } else if (autoConfirmInDev) {
            console.log('🔗 [DEV FALLBACK] CONFIRMATION LINK:', confirmUrl);
            return { sent: true, fallback: true };
        }
        return { sent: false };
    } catch (emailErr) {
        if (autoConfirmInDev) {
            console.log('🔗 [DEV FALLBACK] CONFIRMATION LINK:', confirmUrl);
            return { sent: true, fallback: true };
        }
        throw emailErr;
    }
}

// -------- HEALTH / TEST -------- //
router.get('/test', (req, res) => {
    res.json({ message: 'User routes active on normalized 3NF PostgreSQL schema.' });
});

// -------- CHECK REGISTRATION AVAILABILITY (Verified Accounts Only) -------- //
router.get('/check-availability', async (req, res) => {
    try {
        const studentId = String(req.query.student_id || '').trim();
        const email = String(req.query.email || '').trim().toLowerCase();

        if (!studentId && !email) {
            return res.status(400).json({ message: 'student_id or email query parameter is required.' });
        }

        if (studentId) {
            const idRes = await pool.query(
                `SELECT 1
                 FROM student_profiles sp
                 JOIN users u ON sp.user_id = u.user_id
                 WHERE sp.student_number = $1
                   AND (u.is_email_verified = TRUE OR u.account_status <> 'Pending')
                 LIMIT 1`,
                [studentId]
            );
            if (idRes.rowCount > 0) {
                return res.status(409).json({
                    available: false,
                    field: 'student_id',
                    message: 'This Student ID is already registered to an existing verified account.'
                });
            }
        }

        if (email) {
            const emailRes = await pool.query(
                `SELECT 1
                 FROM users u
                 WHERE LOWER(u.email) = $1
                   AND (u.is_email_verified = TRUE OR u.account_status <> 'Pending')
                 LIMIT 1`,
                [email]
            );
            if (emailRes.rowCount > 0) {
                return res.status(409).json({
                    available: false,
                    field: 'email',
                    message: 'An account with this email address already exists.'
                });
            }
        }

        return res.json({ available: true });
    } catch (error) {
        console.error('Availability check error:', error);
        return res.status(500).json({ message: 'Failed to check registration availability.' });
    }
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
            terms_accepted,
            cor_photo,
            student_id_photo
        } = req.body;

        if (!student_id || !first_name || !last_name || !department_id || !year_level || !email || !password) {
            return res.status(400).json({ message: 'Please complete all required fields.' });
        }

        const parsedCor = parseBase64Image(cor_photo);
        const parsedId = parseBase64Image(student_id_photo);
        if (!parsedCor || !parsedId) {
            return res.status(400).json({
                message: 'Valid live camera photos of both your Certificate of Registration (COR) and Student ID are required.'
            });
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

        // Purge expired staging rows & any legacy unverified Pending user rows
        await client.query(`DELETE FROM pending_registrations WHERE expires_at < NOW()`);
        await client.query(`DELETE FROM users WHERE is_email_verified = FALSE AND account_status = 'Pending'`);

        // Check duplicate email or student_number against verified/active accounts only
        const dupRes = await client.query(
            `SELECT u.user_id
             FROM users u
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE (LOWER(u.email) = $1 OR sp.student_number = $2)
               AND (u.is_email_verified = TRUE OR u.account_status <> 'Pending')`,
            [normalizedEmail, student_id.trim()]
        );

        if (dupRes.rowCount > 0) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(409).json({
                message: 'An account with this email or Student ID already exists.'
            });
        }

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

        // Overwrite any prior unverified staging entry for the same email or student_number
        await client.query(
            `DELETE FROM pending_registrations
             WHERE LOWER(email) = $1 OR student_number = $2`,
            [normalizedEmail, student_id.trim()]
        );

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Stage registration in pending_registrations (do NOT insert into users until Gmail confirmation)
        const pendingIns = await client.query(
            `INSERT INTO pending_registrations (
                first_name, middle_initial, last_name, email, password_hash,
                student_number, department_id, program_id, year_level,
                cor_image, cor_mime_type, student_id_image, student_id_mime_type,
                token_hash, expires_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING pending_id`,
            [
                first_name.trim(),
                middle_initial ? middle_initial.trim() : null,
                last_name.trim(),
                normalizedEmail,
                hashedPassword,
                student_id.trim(),
                Number(department_id),
                program_id ? Number(program_id) : null,
                year_level,
                parsedCor.buffer,
                parsedCor.mimeType,
                parsedId.buffer,
                parsedId.mimeType,
                tokenHash,
                expiresAt
            ]
        );
        const pendingId = pendingIns.rows[0].pending_id;

        const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${rawToken}`;

        try {
            await sendVerificationEmail(normalizedEmail, first_name.trim(), confirmUrl);
        } catch (emailErr) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(502).json({ message: 'Failed to send verification email.' });
        }

        await client.query('COMMIT');
        tx = false;

        await logAudit(req, {
            action: 'Student Registration Staged',
            module: 'auth',
            targetType: 'pending_registration',
            targetId: pendingId,
            actorRole: 'student',
            details: { email: normalizedEmail, student_id: student_id.trim() }
        });

        return res.status(201).json({
            message: 'Registration submitted! Please check your Gmail to confirm your email address.',
            email: normalizedEmail,
            requiresEmailConfirmation: true
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

        // 1. Primary path: Check staged registration in pending_registrations
        const pendingRes = await client.query(
            `SELECT *
             FROM pending_registrations
             WHERE token_hash = $1
             FOR UPDATE`,
            [tokenHash]
        );

        if (pendingRes.rowCount > 0) {
            const pending = pendingRes.rows[0];

            if (new Date() > new Date(pending.expires_at)) {
                await client.query('ROLLBACK');
                tx = false;
                return res.status(400).json({
                    code: 'TOKEN_EXPIRED',
                    message: 'Verification link has expired. Please register again to receive a new confirmation link.'
                });
            }

            // Ensure no verified account claimed this email or student_number concurrently
            const conflictRes = await client.query(
                `SELECT u.user_id
                 FROM users u
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 WHERE LOWER(u.email) = LOWER($1) OR sp.student_number = $2
                 LIMIT 1`,
                [pending.email, pending.student_number]
            );
            if (conflictRes.rowCount > 0) {
                await client.query(`DELETE FROM pending_registrations WHERE pending_id = $1`, [pending.pending_id]);
                await client.query('COMMIT');
                tx = false;
                return res.status(409).json({
                    message: 'An account with this email or Student ID has already been verified.'
                });
            }

            const roleRes = await client.query(`SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1`);
            const studentRoleId = roleRes.rows[0]?.role_id || 3;

            const userIns = await client.query(
                `INSERT INTO users (
                    role_id, first_name, middle_initial, last_name, email, password_hash,
                    is_email_verified, account_status
                 ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'Active')
                 RETURNING user_id, first_name, last_name, email, account_status AS status`,
                [
                    studentRoleId,
                    pending.first_name,
                    pending.middle_initial,
                    pending.last_name,
                    pending.email,
                    pending.password_hash
                ]
            );
            const newUserId = userIns.rows[0].user_id;

            await client.query(
                `INSERT INTO student_profiles (
                    user_id, student_number, department_id, program_id, year_level,
                    cor_image, cor_mime_type, student_id_image, student_id_mime_type,
                    verification_status
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')`,
                [
                    newUserId,
                    pending.student_number,
                    pending.department_id,
                    pending.program_id,
                    pending.year_level,
                    pending.cor_image,
                    pending.cor_mime_type,
                    pending.student_id_image,
                    pending.student_id_mime_type
                ]
            );

            // Record used verification token for idempotent repeat requests (e.g. StrictMode or double-click)
            await client.query(
                `INSERT INTO auth_tokens (user_id, token_type, token_hash, expires_at, used_at)
                 VALUES ($1, 'email_verification', $2, $3, NOW())`,
                [newUserId, tokenHash, pending.expires_at]
            );

            await client.query(
                `DELETE FROM pending_registrations
                 WHERE pending_id = $1 OR LOWER(email) = LOWER($2) OR student_number = $3`,
                [pending.pending_id, pending.email, pending.student_number]
            );

            await client.query('COMMIT');
            tx = false;

            await logAudit(req, {
                action: 'Student Email Confirmed & Account Created',
                module: 'auth',
                targetType: 'user',
                targetId: newUserId,
                actorUserId: newUserId,
                actorRole: 'student',
                details: { email: pending.email, student_id: pending.student_number }
            });

            return res.status(200).json({
                message: 'Email confirmed successfully! Your account is now active.',
                user: userIns.rows[0]
            });
        }

        // 2. Secondary path: Check auth_tokens for idempotent double-confirm or legacy tokens
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
            return res.status(400).json({
                code: 'TOKEN_INVALID',
                message: 'Invalid verification link.'
            });
        }

        const tok = tokRes.rows[0];
        if (tok.used_at) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(200).json({
                message: 'Email is already confirmed! You can now sign in.',
                alreadyConfirmed: true
            });
        }

        if (new Date() > new Date(tok.expires_at)) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(400).json({
                code: 'TOKEN_EXPIRED',
                message: 'Verification link has expired. Please register again.'
            });
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

// -------- CHECK EMAIL VERIFICATION STATUS -------- //
router.get('/verification-status', async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }
        const result = await pool.query(
            `SELECT is_email_verified, account_status FROM users WHERE LOWER(email) = $1 LIMIT 1`,
            [email]
        );
        if (result.rowCount > 0) {
            return res.json({
                is_email_verified: result.rows[0].is_email_verified,
                account_status: result.rows[0].account_status
            });
        }

        const pendingRes = await pool.query(
            `SELECT expires_at FROM pending_registrations WHERE LOWER(email) = $1 LIMIT 1`,
            [email]
        );
        if (pendingRes.rowCount > 0) {
            return res.json({
                is_email_verified: false,
                account_status: 'Pending',
                expired: new Date() > new Date(pendingRes.rows[0].expires_at)
            });
        }

        return res.status(404).json({ message: 'Account not found.' });
    } catch (error) {
        console.error('Verification status error:', error);
        return res.status(500).json({ message: 'Failed to check verification status.' });
    }
});

// -------- RESEND EMAIL CONFIRMATION -------- //
router.post('/resend-confirmation', registerLimiter, async (req, res) => {
    let client;
    let tx = false;
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }
        client = await pool.connect();
        await client.query('BEGIN');
        tx = true;

        const userRes = await client.query(
            `SELECT user_id, first_name, email, is_email_verified
             FROM users WHERE LOWER(email) = $1 LIMIT 1`,
            [email]
        );
        if (userRes.rowCount > 0) {
            const user = userRes.rows[0];
            if (user.is_email_verified) {
                await client.query('ROLLBACK');
                tx = false;
                return res.status(200).json({
                    message: 'Email is already confirmed. You can sign in now.',
                    alreadyVerified: true
                });
            }

            await client.query(
                `DELETE FROM auth_tokens WHERE user_id = $1 AND token_type = 'email_verification'`,
                [user.user_id]
            );

            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await client.query(
                `INSERT INTO auth_tokens (user_id, token_type, token_hash, expires_at)
                 VALUES ($1, 'email_verification', $2, $3)`,
                [user.user_id, tokenHash, expiresAt]
            );

            const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${rawToken}`;

            try {
                await sendVerificationEmail(user.email, user.first_name, confirmUrl);
            } catch (emailErr) {
                await client.query('ROLLBACK');
                tx = false;
                return res.status(502).json({ message: 'Failed to resend verification email.' });
            }

            await client.query('COMMIT');
            tx = false;

            return res.status(200).json({
                message: 'Confirmation email resent! Please check your Gmail inbox.'
            });
        }

        const pendingRes = await client.query(
            `SELECT pending_id, first_name, email
             FROM pending_registrations
             WHERE LOWER(email) = $1
             FOR UPDATE`,
            [email]
        );

        if (pendingRes.rowCount === 0) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(404).json({
                message: 'No pending registration found for this email. Please register again.'
            });
        }

        const pending = pendingRes.rows[0];
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query(
            `UPDATE pending_registrations
             SET token_hash = $1, expires_at = $2
             WHERE pending_id = $3`,
            [tokenHash, expiresAt, pending.pending_id]
        );

        const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${rawToken}`;

        try {
            await sendVerificationEmail(pending.email, pending.first_name, confirmUrl);
        } catch (emailErr) {
            await client.query('ROLLBACK');
            tx = false;
            return res.status(502).json({ message: 'Failed to resend verification email.' });
        }

        await client.query('COMMIT');
        tx = false;

        return res.status(200).json({
            message: 'Confirmation email resent! Please check your Gmail inbox.'
        });
    } catch (error) {
        if (client && tx) {
            try { await client.query('ROLLBACK'); } catch (_) {}
        }
        console.error('Resend confirmation error:', error);
        return res.status(500).json({ message: 'Server error while resending confirmation email.' });
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
                    u.password_hash, u.role_id, u.is_email_verified, u.account_status AS status, r.role_name,
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
            const pendingRes = await pool.query(
                `SELECT pending_id, email, expires_at
                 FROM pending_registrations
                 WHERE LOWER(email) = LOWER($1)
                 LIMIT 1`,
                [email.trim()]
            );

            if (pendingRes.rowCount > 0) {
                const pending = pendingRes.rows[0];
                if (new Date() <= new Date(pending.expires_at)) {
                    await logAudit(req, {
                        action: 'Failed Login Attempt',
                        module: 'auth',
                        outcome: 'FAILURE',
                        isSecurityEvent: true,
                        details: { email: email.trim(), reason: 'Pending email verification' }
                    });
                    return res.status(403).json({
                        message: 'Please confirm your email address via the link sent to your Gmail before signing in.',
                        requiresEmailConfirmation: true,
                        email: pending.email
                    });
                }
                await pool.query(`DELETE FROM pending_registrations WHERE pending_id = $1`, [pending.pending_id]);
            }

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

        if (!user.is_email_verified || String(user.status).toLowerCase() === 'pending') {
            return res.status(403).json({
                message: 'Please confirm your email address via the link sent to your Gmail before signing in.',
                requiresEmailConfirmation: true,
                email: user.email
            });
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
