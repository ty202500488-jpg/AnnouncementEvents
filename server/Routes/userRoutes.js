const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Rate limiters for security-sensitive endpoints
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again after 15 minutes.' }
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting during local development for local loopback IPs
    skip: (req) => process.env.NODE_ENV === 'development' && (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1'),
    handler: (req, res) => {
        return res.status(429).json({ 
            message: 'Too many registration attempts. Please wait a few minutes before trying again.' 
        });
    }
});

const resendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many verification email requests. Please wait a few minutes before trying again.' }
});

// -------- TEST ROUTE -------- //
router.get('/test', (req, res) => {
    res.send('User routes are working securely with segregated pending registration!');
});

// -------- REGISTRATION ROUTE -------- //
router.post('/', registerLimiter, async (req, res) => {
    let client;
    let transactionStarted = false;
    try {
        client = await pool.connect();
        const {
            student_id,
            first_name,
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

        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.' });
        }

        await client.query('BEGIN');
        transactionStarted = true;

        // Clean up expired pending records with explicit parentheses for correct SQL operator precedence
        await client.query(
            `DELETE FROM pending_registrations WHERE (email = $1 OR student_id = $2) AND expires_at < NOW()`,
            [normalizedEmail, student_id.trim()]
        );

        // Check for duplicates in users and active pending tables
        const existingUser = await client.query(
            `SELECT email FROM users WHERE LOWER(email) = $1 OR student_id = $2
             UNION
             SELECT email FROM pending_registrations WHERE LOWER(email) = $1 OR student_id = $2 AND expires_at >= NOW()`,
            [normalizedEmail, student_id.trim()]
        );

        if (existingUser.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'An account or active pending registration with this email or Student ID already exists.' });
        }

        // Fetch STUDENT role ID
        const roleResult = await client.query(`SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1`);
        if (roleResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'Student role is not configured in the database.' });
        }
        const studentRoleId = roleResult.rows[0].role_id;

        // Verify department exists
        const deptResult = await client.query(`SELECT department_id FROM departments WHERE department_id = $1 AND LOWER(status) = 'active'`, [department_id]);
        if (deptResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid or inactive department.' });
        }

        if (program_id) {
            const progResult = await client.query(`SELECT program_id FROM programs WHERE program_id = $1 AND department_id = $2`, [program_id, department_id]);
            if (progResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Selected program does not belong to this department.' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query(
            `INSERT INTO pending_registrations (
                student_id, role_id, first_name, last_name, email,
                password_hash, year_level, department_id, program_id,
                token_hash, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (student_id) 
             DO UPDATE SET 
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                token_hash = EXCLUDED.token_hash,
                expires_at = EXCLUDED.expires_at`,
            [
                student_id.trim(), studentRoleId, first_name.trim(), last_name.trim(),
                normalizedEmail, hashedPassword, year_level, department_id,
                program_id || null, tokenHash, expiresAt
            ]
        );

        const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${rawToken}`;

        try {
            await transporter.sendMail({
                from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
                to: normalizedEmail,
                subject: 'CRIMSON - Confirm Your Email Address',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #800000;">Welcome to CRIMSON, ${first_name}!</h2>
                        <p>Please confirm your institutional email address by clicking the button below to activate your account:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm Email Address</a>
                        </div>
                        <p style="font-size: 0.85rem; color: #777;">This verification link expires in 24 hours.</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.warn('\n⚠️ SMTP Email delivery failed.');
            // Strict development-only fallback check: NEVER activate in production
            if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_EMAIL_FALLBACK === 'true') {
                console.log('====================================================');
                console.log('🔗 [DEV FALLBACK] REGISTRATION CONFIRMATION LINK:');
                console.log(confirmUrl);
                console.log('====================================================\n');
            } else {
                console.error('Email transmission failed and development fallback is disabled.');
                await client.query('ROLLBACK');
                return res.status(502).json({ message: 'Failed to send verification email. Please try again later.' });
            }
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(201).json({
            message: 'Registration submitted successfully! Please check your email for the confirmation link.'
        });

    } catch (error) {
        if (client && transactionStarted) {
            try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('Rollback error:', rbErr); }
        }
        console.error('Registration error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'An account or pending registration with this Student ID or email already exists.' });
        }
        return res.status(500).json({ message: 'Server error during registration.' });
    } finally {
        client?.release();
    }
});

// -------- EMAIL CONFIRMATION ROUTE -------- //
router.get('/confirm-email', async (req, res) => {
    let client;
    let transactionStarted = false;
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required.' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        client = await pool.connect();
        await client.query('BEGIN');
        transactionStarted = true;

        const pendingResult = await client.query(
            `SELECT * FROM pending_registrations WHERE token_hash = $1 FOR UPDATE`,
            [tokenHash]
        );

        if (pendingResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid, expired, or already-used verification token.' });
        }

        const pending = pendingResult.rows[0];

        if (new Date() > new Date(pending.expires_at)) {
            await client.query(`DELETE FROM pending_registrations WHERE pending_id = $1`, [pending.pending_id]);
            await client.query('COMMIT');
            return res.status(400).json({ message: 'Verification token has expired. Please register again.' });
        }

        const duplicateCheck = await client.query(
            `SELECT user_id FROM users WHERE LOWER(email) = $1 OR student_id = $2`,
            [pending.email, pending.student_id]
        );

        if (duplicateCheck.rowCount > 0) {
            await client.query(`DELETE FROM pending_registrations WHERE pending_id = $1`, [pending.pending_id]);
            await client.query('COMMIT');
            return res.status(400).json({ message: 'An account with this email or student ID already exists.' });
        }

        const newUserResult = await client.query(
            `INSERT INTO users (
                student_id, role_id, first_name, last_name, email,
                password_hash, year_level, department_id, program_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active')
            RETURNING user_id, student_id, first_name, last_name, email, status`,
            [
                pending.student_id, pending.role_id, pending.first_name,
                pending.last_name, pending.email, pending.password_hash,
                pending.year_level, pending.department_id, pending.program_id
            ]
        );

        await client.query(`DELETE FROM pending_registrations WHERE pending_id = $1`, [pending.pending_id]);

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(200).json({
            message: 'Email confirmed successfully! Your account has been created. You can now log in.',
            user: newUserResult.rows[0]
        });

    } catch (error) {
        if (client && transactionStarted) {
            try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('Rollback error:', rbErr); }
        }
        console.error('Confirm email error:', error);
        return res.status(500).json({ message: 'Server error during email confirmation.' });
    } finally {
        client?.release();
    }
});

// -------- RESEND VERIFICATION EMAIL -------- //
router.post('/resend-verification', resendLimiter, async (req, res) => {
    let client;
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email address is required.' });

        const normalizedEmail = email.trim().toLowerCase();
        client = await pool.connect();

        const pendingResult = await client.query(
            `SELECT * FROM pending_registrations WHERE LOWER(email) = $1 AND expires_at >= NOW()`,
            [normalizedEmail]
        );

        if (pendingResult.rowCount === 0) {
            return res.status(200).json({ message: 'If a pending registration exists for this email, a new verification link has been sent.' });
        }

        const pending = pendingResult.rows[0];

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await client.query(
            `UPDATE pending_registrations SET token_hash = $1, expires_at = $2 WHERE pending_id = $3`,
            [tokenHash, expiresAt, pending.pending_id]
        );

        const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${rawToken}`;

        try {
            await transporter.sendMail({
                from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
                to: normalizedEmail,
                subject: 'WMSU CampusHub - New Verification Link',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #800000;">New Verification Request</h2>
                        <p>Hello ${pending.first_name}, here is your new verification link:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm Email Address</a>
                        </div>
                        <p style="font-size: 0.85rem; color: #777;">This link expires in 24 hours.</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.warn('\n⚠️ Resend email SMTP failed.');
            if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_EMAIL_FALLBACK === 'true') {
                console.log('🔗 [DEV FALLBACK] RESEND CONFIRMATION LINK:');
                console.log(confirmUrl);
            }
        }

        return res.status(200).json({ message: 'If a pending registration exists for this email, a new verification link has been sent.' });

    } catch (error) {
        console.error('Resend verification error:', error);
        return res.status(500).json({ message: 'Server error while resending verification email.' });
    } finally {
        client?.release();
    }
});

// -------- SECURE LOGIN ROUTE -------- //
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.password_hash, u.role_id, u.status, r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE LOWER(u.email) = LOWER($1)`,
            [email.trim()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        if (user.status?.toLowerCase() !== 'active') {
            return res.status(403).json({ message: 'Your account is not active.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { userId: user.user_id, roleId: user.role_id, role: user.role_name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '8h' }
        );

        delete user.password_hash;

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

module.exports = router;