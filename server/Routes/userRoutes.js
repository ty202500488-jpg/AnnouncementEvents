const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { authenticateUser, logAudit } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/emailService');
const {
    getRequireStudentVerification,
    evaluatePrePasswordGate,
    evaluatePostPasswordGate
} = require('../utils/verificationPolicy');
const { ensureUniversityWideColumn } = require('../utils/universityWideHelper');
const {
    ensureNotificationSchema,
    getUserNotificationPreferences,
    updateUserNotificationPreferences,
    formatNotificationRow,
    notifyAdminsStudentVerification,
    notifyEventRegistrationChange,
    ensureUpcomingEventReminders
} = require('../utils/notificationService');

ensureNotificationSchema(pool).catch((err) => {
    console.warn('Warning: failed to ensure notification schema:', err.message);
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const RESUBMIT_TOKEN_SECRET = `${JWT_SECRET}:cor_resubmit`;

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
            const decoded = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
            if (decoded.purpose) return null;
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
            const requireAdminVerification = await getRequireStudentVerification(client);
            const initialAccountStatus = requireAdminVerification ? 'Pending' : 'Active';
            const initialVerifStatus = requireAdminVerification ? 'Pending' : 'Verified';

            const userIns = await client.query(
                `INSERT INTO users (
                    role_id, first_name, middle_initial, last_name, email, password_hash,
                    is_email_verified, account_status
                 ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
                 RETURNING user_id, first_name, last_name, email, account_status AS status`,
                [
                    studentRoleId,
                    pending.first_name,
                    pending.middle_initial,
                    pending.last_name,
                    pending.email,
                    pending.password_hash,
                    initialAccountStatus
                ]
            );
            const newUserId = userIns.rows[0].user_id;

            await client.query(
                `INSERT INTO student_profiles (
                    user_id, student_number, department_id, program_id, year_level,
                    cor_image, cor_mime_type, student_id_image, student_id_mime_type,
                    verification_status
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    newUserId,
                    pending.student_number,
                    pending.department_id,
                    pending.program_id,
                    pending.year_level,
                    pending.cor_image,
                    pending.cor_mime_type,
                    pending.student_id_image,
                    pending.student_id_mime_type,
                    initialVerifStatus
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

            if (requireAdminVerification && userIns.rows[0]) {
                const uRow = userIns.rows[0];
                await notifyAdminsStudentVerification(pool, {
                    studentUserId: newUserId,
                    studentName: `${uRow.first_name || ''} ${uRow.last_name || ''}`.trim() || uRow.email,
                    studentNumber: pending.student_number || '',
                    isResubmission: false
                });
            }

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
                message: requireAdminVerification
                    ? 'Email confirmed! Your account is now awaiting Administrator verification of your COR and Student ID before you can sign in.'
                    : 'Email confirmed successfully! Your account is now active.',
                requiresAdminVerification: requireAdminVerification,
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
            const verifCheck = await client.query(
                `SELECT r.role_name, sp.verification_status
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 WHERE u.user_id = $1
                 LIMIT 1`,
                [tok.user_id]
            );
            const requireAdminVerification = await getRequireStudentVerification(client);
            const row = verifCheck.rows[0];
            const needsAdminVerif =
                requireAdminVerification &&
                String(row?.role_name || '').toLowerCase() === 'student' &&
                String(row?.verification_status || '').toLowerCase() !== 'verified';

            await client.query('ROLLBACK');
            tx = false;
            return res.status(200).json({
                message: needsAdminVerif
                    ? 'Email is already confirmed! Your COR and Student ID are awaiting Administrator verification before you can sign in.'
                    : 'Email is already confirmed! You can now sign in.',
                alreadyConfirmed: true,
                requiresAdminVerification: needsAdminVerif
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

        const legacyCheck = await client.query(
            `SELECT r.role_name, sp.verification_status
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE u.user_id = $1
             LIMIT 1`,
            [tok.user_id]
        );
        const requireAdminVerification = await getRequireStudentVerification(client);
        const legacyRow = legacyCheck.rows[0];
        const needsAdminVerif =
            requireAdminVerification &&
            String(legacyRow?.role_name || '').toLowerCase() === 'student' &&
            String(legacyRow?.verification_status || '').toLowerCase() !== 'verified';
        const nextStatus = needsAdminVerif ? 'Pending' : 'Active';

        const userUpd = await client.query(
            `UPDATE users
             SET is_email_verified = TRUE, account_status = $2
             WHERE user_id = $1
             RETURNING user_id, first_name, last_name, email, account_status AS status`,
            [tok.user_id, nextStatus]
        );

        await client.query(
            `UPDATE auth_tokens SET used_at = NOW() WHERE token_id = $1`,
            [tok.token_id]
        );

        await client.query('COMMIT');
        tx = false;

        if (needsAdminVerif && userUpd.rows[0]) {
            const uRow = userUpd.rows[0];
            await notifyAdminsStudentVerification(pool, {
                studentUserId: uRow.user_id,
                studentName: `${uRow.first_name || ''} ${uRow.last_name || ''}`.trim() || uRow.email,
                isResubmission: false
            });
        }

        return res.status(200).json({
            message: needsAdminVerificationMessage(needsAdminVerif),
            requiresAdminVerification: needsAdminVerif,
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

function needsAdminVerificationMessage(needsAdminVerif) {
    return needsAdminVerif
        ? 'Email confirmed! Your account is now awaiting Administrator verification of your COR and Student ID before you can sign in.'
        : 'Email confirmed successfully! Your account is now active.';
}

// -------- CHECK EMAIL VERIFICATION STATUS -------- //
router.get('/verification-status', async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }
        const requireAdminVerification = await getRequireStudentVerification(pool);
        const result = await pool.query(
            `SELECT u.is_email_verified, u.account_status, sp.verification_status
             FROM users u
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE LOWER(u.email) = $1
             LIMIT 1`,
            [email]
        );
        if (result.rowCount > 0) {
            return res.json({
                is_email_verified: result.rows[0].is_email_verified,
                account_status: result.rows[0].account_status,
                verification_status: result.rows[0].verification_status || null,
                require_admin_verification: requireAdminVerification
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
                    sp.year_level, sp.verification_status, sp.verification_remarks,
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

        const preGate = evaluatePrePasswordGate({
            isEmailVerified: user.is_email_verified,
            accountStatus: user.status,
            email: user.email
        });
        if (!preGate.allowed) {
            return res.status(preGate.httpStatus).json(preGate.payload);
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

        const requireStudentVerification = await getRequireStudentVerification(pool);
        const postGate = evaluatePostPasswordGate({
            roleName: user.role_name,
            verificationStatus: user.verification_status,
            verificationRemarks: user.verification_remarks,
            requireStudentVerification
        });
        if (!postGate.allowed) {
            const responsePayload = { ...postGate.payload };
            if (postGate.code === 'ADMIN_CORRECTION') {
                responsePayload.resubmitToken = jwt.sign(
                    { userId: user.user_id, purpose: 'cor_id_resubmit' },
                    RESUBMIT_TOKEN_SECRET,
                    { expiresIn: '30m' }
                );
            }
            return res.status(postGate.httpStatus).json(responsePayload);
        }

        const token = jwt.sign(
            { userId: user.user_id, roleId: user.role_id, role: user.role_name },
            JWT_SECRET,
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

// -------- RESUBMIT STUDENT VERIFICATION DOCUMENTS (PRE-LOGIN CORRECTION FLOW) -------- //
router.post('/resubmit-verification', registerLimiter, async (req, res) => {
    try {
        const { resubmitToken, corPhoto, studentIdPhoto } = req.body || {};
        if (!resubmitToken) {
            return res.status(401).json({ message: 'Resubmission token is missing. Please sign in again.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(String(resubmitToken).trim(), RESUBMIT_TOKEN_SECRET);
        } catch (_) {
            return res.status(401).json({ message: 'Your resubmission session has expired. Please sign in again.' });
        }

        if (decoded?.purpose !== 'cor_id_resubmit' || !Number.isSafeInteger(Number(decoded.userId))) {
            return res.status(401).json({ message: 'Invalid resubmission token.' });
        }

        const parsedCor = parseBase64Image(corPhoto);
        const parsedStudentId = parseBase64Image(studentIdPhoto);
        if (!parsedCor || !parsedStudentId) {
            return res.status(400).json({
                message: 'Valid live camera photos of both your COR and WMSU Student ID (max 5MB each) are required.'
            });
        }

        const userRes = await pool.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email, u.is_email_verified, u.account_status, r.role_name,
                    sp.student_number, sp.verification_status, sp.verification_remarks
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE u.user_id = $1
             LIMIT 1`,
            [Number(decoded.userId)]
        );

        if (userRes.rowCount === 0) {
            return res.status(404).json({ message: 'Student profile not found.' });
        }

        const target = userRes.rows[0];
        if (!target.is_email_verified || String(target.account_status).toLowerCase() === 'suspended' || String(target.account_status).toLowerCase() === 'archived') {
            return res.status(403).json({ message: 'Account is not eligible for document resubmission.' });
        }

        if (String(target.verification_status).toLowerCase() !== 'pending' || !String(target.verification_remarks || '').trim()) {
            return res.status(403).json({
                message: 'Document resubmission is only permitted when an Administrator requests corrections.'
            });
        }

        await pool.query(
            `UPDATE student_profiles
             SET cor_image = $1,
                 cor_mime_type = $2,
                 student_id_image = $3,
                 student_id_mime_type = $4,
                 verification_status = 'Pending',
                 verification_remarks = NULL,
                 updated_at = NOW()
             WHERE user_id = $5`,
            [parsedCor.buffer, parsedCor.mimeType, parsedStudentId.buffer, parsedStudentId.mimeType, target.user_id]
        );

        await logAudit(req, {
            action: 'Student Resubmitted Verification Documents',
            module: 'users',
            actorUserId: target.user_id,
            actorRole: target.role_name,
            targetType: 'user',
            targetId: target.user_id,
            outcome: 'SUCCESS'
        });

        await notifyAdminsStudentVerification(pool, {
            studentUserId: target.user_id,
            studentName: `${target.first_name || ''} ${target.last_name || ''}`.trim() || target.email,
            studentNumber: target.student_number || '',
            isResubmission: true
        });

        return res.status(200).json({
            message: 'Updated COR and Student ID photos submitted! An Administrator will re-review your documents shortly.'
        });
    } catch (error) {
        console.error('Resubmit verification error:', error);
        return res.status(500).json({ message: 'Server error while resubmitting verification documents.' });
    }
});

// -------- DASHBOARD FEED (USED BY STUDENT & STAFF VIEWS) -------- //
const handleDashboardData = async (req, res) => {
    try {
        await ensureUniversityWideColumn(pool);
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
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    p.audience,
                    p.is_university_wide,
                    p.is_university_wide AS is_university,
                    p.expires_at,
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
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS poster_url,
                    p.audience,
                    p.is_university_wide,
                    p.is_university_wide AS is_university,
                    p.expires_at,
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
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS poster_url,
                    p.is_university_wide,
                    p.is_university_wide AS is_university,
                    p.expires_at,
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
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS image_url,
                    CASE
                        WHEN p.post_image IS NOT NULL AND p.post_image_mime IS NOT NULL
                            THEN 'data:' || p.post_image_mime || ';base64,' || ENCODE(p.post_image, 'base64')
                        ELSE p.image_url
                    END AS poster_url,
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

        const [evInfo, regUser] = await Promise.all([
            pool.query(`SELECT post_id, page_id, title FROM posts WHERE post_id = $1 LIMIT 1`, [eventId]),
            pool.query(`SELECT first_name, last_name FROM users WHERE user_id = $1 LIMIT 1`, [userId])
        ]);

        if (evInfo.rows[0]) {
            const uRow = regUser.rows[0];
            const regName = uRow ? `${uRow.first_name || ''} ${uRow.last_name || ''}`.trim() : 'A student';
            await notifyEventRegistrationChange(pool, {
                postId: eventId,
                eventTitle: evInfo.rows[0].title,
                pageId: evInfo.rows[0].page_id,
                registrantUserId: userId,
                registrantName: regName || 'A student',
                action: 'registered'
            });
        }

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

        const delRes = await pool.query(
            `DELETE FROM event_registrations WHERE event_post_id = $1 AND registrant_user_id = $2 RETURNING registration_id`,
            [eventId, userId]
        );

        if (delRes.rowCount > 0) {
            const [evInfo, regUser] = await Promise.all([
                pool.query(`SELECT post_id, page_id, title FROM posts WHERE post_id = $1 LIMIT 1`, [eventId]),
                pool.query(`SELECT first_name, last_name FROM users WHERE user_id = $1 LIMIT 1`, [userId])
            ]);
            if (evInfo.rows[0]) {
                const uRow = regUser.rows[0];
                const regName = uRow ? `${uRow.first_name || ''} ${uRow.last_name || ''}`.trim() : 'A student';
                await notifyEventRegistrationChange(pool, {
                    postId: eventId,
                    eventTitle: evInfo.rows[0].title,
                    pageId: evInfo.rows[0].page_id,
                    registrantUserId: userId,
                    registrantName: regName || 'A student',
                    action: 'cancelled'
                });
            }
        }

        return res.status(200).json({ message: 'Registration cancelled successfully.' });
    } catch (error) {
        console.error('Error cancelling registration:', error);
        return res.status(500).json({ message: 'Server error cancelling registration.' });
    }
};

router.post('/events/:id/cancel', handleCancelRegistration);
router.delete('/events/:id/cancel', handleCancelRegistration);
router.delete('/events/:id/register', handleCancelRegistration);

// -------- USER NOTIFICATION PREFERENCES -------- //
router.get('/notifications/preferences', async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const preferences = await getUserNotificationPreferences(pool, authUser.user_id, authUser.role_name);
        return res.status(200).json({ preferences });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        return res.status(500).json({ message: 'Failed to load notification preferences.' });
    }
});

const handleUpdatePreferences = async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const incoming = req.body?.preferences || req.body?.settings || req.body || {};
        const preferences = await updateUserNotificationPreferences(pool, authUser.user_id, authUser.role_name, incoming);
        if (!preferences) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json({
            message: 'Notification preferences saved successfully.',
            preferences
        });
    } catch (error) {
        console.error('Error saving notification preferences:', error);
        return res.status(500).json({ message: 'Failed to save notification preferences.' });
    }
};
router.put('/notifications/preferences', handleUpdatePreferences);
router.post('/notifications/preferences', handleUpdatePreferences);
router.patch('/notifications/preferences', handleUpdatePreferences);

// -------- USER NOTIFICATIONS -------- //
router.get('/notifications', async (req, res) => {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return res.status(200).json({ notifications: [], unreadCount: 0 });
        }

        const roleRes = await pool.query(
            `SELECT r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1
             LIMIT 1`,
            [userId]
        );
        const roleName = roleRes.rows[0]?.role_name || '';
        const roleLower = String(roleName).toLowerCase();

        await ensureUpcomingEventReminders(pool, userId, roleName);

        const includeArchived = req.query.includeArchived === 'true';
        const scopeClause = roleLower === 'student'
            ? `AND LOWER(n.notification_scope) = 'student'`
            : (roleLower === 'staff'
                ? `AND LOWER(n.notification_scope) IN ('staff', 'mypage')`
                : '');

        const result = await pool.query(
            `SELECT n.notification_id, n.recipient_user_id, n.actor_user_id,
                    n.page_id, n.post_id, n.notification_scope, n.type,
                    n.title, n.message, n.is_read, n.read_at, n.is_archived, n.created_at,
                    pg.page_name, po.post_type
             FROM notifications n
             LEFT JOIN pages pg ON n.page_id = pg.page_id
             LEFT JOIN posts po ON n.post_id = po.post_id
             WHERE n.recipient_user_id = $1
               ${scopeClause}
               AND ($2::boolean = TRUE OR n.is_archived = FALSE)
             ORDER BY n.created_at DESC
             LIMIT 100`,
            [userId, includeArchived]
        );

        const notifications = result.rows.map(formatNotificationRow);
        const unreadCount = notifications.filter((n) => !n.is_read && !n.is_archived).length;
        return res.status(200).json({ notifications, unreadCount });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

const markNotificationRead = async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const upd = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
             WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), authUser.user_id]
        );
        if (upd.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
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
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
             WHERE recipient_user_id = $1 AND is_read = FALSE`,
            [authUser.user_id]
        );
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
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const isArchived = req.body?.is_archived !== undefined ? Boolean(req.body.is_archived) : true;
        const upd = await pool.query(
            `UPDATE notifications
             SET is_archived = $1
             WHERE notification_id = $2 AND recipient_user_id = $3`,
            [isArchived, Number(req.params.id), authUser.user_id]
        );
        if (upd.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.status(200).json({ message: isArchived ? 'Notification archived.' : 'Notification unarchived.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error archiving notification.' });
    }
};
router.post('/notifications/:id/archive', archiveNotification);
router.put('/notifications/:id/archive', archiveNotification);
router.patch('/notifications/:id/archive', archiveNotification);

router.delete('/notifications/:id', async (req, res) => {
    try {
        const authUser = await authenticateUser(req, res);
        if (!authUser) return;

        const del = await pool.query(
            `DELETE FROM notifications WHERE notification_id = $1 AND recipient_user_id = $2`,
            [Number(req.params.id), authUser.user_id]
        );
        if (del.rowCount === 0) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        return res.status(200).json({ message: 'Notification deleted.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error deleting notification.' });
    }
});

module.exports = router;
