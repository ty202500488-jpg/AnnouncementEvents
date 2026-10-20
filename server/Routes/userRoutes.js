const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Configure Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// -------- TEST ROUTE -------- //
router.get('/test', (req, res) => {
    res.send('User routes are working securely!');
});

// -------- CREATE STUDENT ACCOUNT & SEND VERIFICATION EMAIL -------- //
router.post('/', async (req, res) => {
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

        // 1. Validate required fields
        if (
            !student_id ||
            !first_name ||
            !last_name ||
            !department_id ||
            !year_level ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                message: 'Please complete all required fields.'
            });
        }

        // 2. Validate terms
        if (terms_accepted !== true) {
            return res.status(400).json({
                message: 'You must accept the Terms and Conditions.'
            });
        }

        // 3. Normalize email
        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@wmsu\.edu\.ph$/.test(normalizedEmail)) {
            return res.status(400).json({
                message: 'Use a valid @wmsu.edu.ph email address.'
            });
        }

        // 4. Validate password[cite: 1]
        if (password !== confirm_password) {
            return res.status(400).json({
                message: 'Passwords do not match.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters.'
            });
        }

        // 5. Validate year level[cite: 1]
        const allowedYearLevels = [
            '1st Year',
            '2nd Year',
            '3rd Year',
            '4th Year',
            '5th Year'
        ];

        if (!allowedYearLevels.includes(year_level)) {
            return res.status(400).json({
                message: 'Invalid year level.'
            });
        }

        // Start transaction[cite: 1]
        await client.query('BEGIN');
        transactionStarted = true;

        // 6. Find the STUDENT role securely from database[cite: 1]
        const roleResult = await client.query(
            `SELECT role_id
             FROM roles
             WHERE LOWER(role_name) = 'student'
             LIMIT 1`
        );

        if (roleResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(500).json({
                message: 'Student role is not configured in the database.'
            });
        }

        const studentRoleId = roleResult.rows[0].role_id;

        // 7. Verify department exists and is active[cite: 1]
        const departmentResult = await client.query(
            `SELECT department_id
             FROM departments
             WHERE department_id = $1
               AND LOWER(status) = 'active'`,
            [department_id]
        );

        if (departmentResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Invalid or inactive department.'
            });
        }

        // 8. Verify program belongs to selected department[cite: 1]
        if (program_id) {
            const programResult = await client.query(
                `SELECT program_id
                 FROM programs
                 WHERE program_id = $1
                   AND department_id = $2`,
                [program_id, department_id]
            );

            if (programResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: 'The selected program does not belong to this department.'
                });
            }
        }

        // 9. Hash password securely[cite: 1]
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate email verification token (expires in 24 hours)[cite: 1]
        const verificationToken = jwt.sign(
            { email: normalizedEmail },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1d' }
        );

        // 10. Create student account with 'Pending' status[cite: 1]
        const newUser = await client.query(
            `INSERT INTO users (
                student_id,
                role_id,
                first_name,
                last_name,
                email,
                password_hash,
                year_level,
                department_id,
                program_id,
                status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, 'Pending'
            )
            RETURNING
                user_id,
                student_id,
                role_id,
                first_name,
                last_name,
                email,
                year_level,
                department_id,
                program_id,
                status,
                created_at`,
            [
                student_id.trim(),
                studentRoleId,
                first_name.trim(),
                last_name.trim(),
                normalizedEmail,
                hashedPassword,
                year_level,
                department_id,
                program_id || null
            ]
        );

        // Attempt to send confirmation email message[cite: 1]
        const confirmUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/confirm-email?token=${verificationToken}`;

        try {
            await transporter.sendMail({
                from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
                to: normalizedEmail,
                subject: 'WMSU CampusHub - Confirm Your Email Address',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #800000;">Welcome to CRIMSON, ${first_name}!</h2>
                        <p>Thank you for registering. Please confirm your institutional email address by clicking or tapping the button below on your device:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm Email Address</a>
                        </div>
                        <p>Or you can copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #555;"><a href="${confirmUrl}">${confirmUrl}</a></p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 0.85rem; color: #777;">This verification link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(500).json({ 
                message: 'Failed to send verification email. Please check your email settings or app password.' 
            });
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(201).json({
            message: 'Student account created successfully! Please check your email inbox to verify your account before logging in.',
            user: newUser.rows[0]
        });

    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Create user rollback failed:', rollbackError.message);
            }
        }
        console.error('Create user error:', error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                message: 'The database is unavailable. Start PostgreSQL and check DB_HOST and DB_PORT in the server environment.'
            });
        }

        if (error.code === '28P01' || error.code === '3D000') {
            return res.status(503).json({
                message: 'The database login or database name is incorrect. Check DB_USER, DB_PASSWORD, and DB_NAME in the server environment.'
            });
        }

        if (error.code === '23505') {
            if (error.constraint?.includes('student_id')) {
                return res.status(409).json({ message: 'Student ID already exists.' });
            }
            if (error.constraint?.includes('email')) {
                return res.status(409).json({ message: 'Email already exists.' });
            }
            return res.status(409).json({ message: 'An account with these details already exists.' });
        }

        if (error.code === '23503') {
            return res.status(400).json({ message: 'Invalid department, program, or role reference.' });
        }

        return res.status(500).json({ message: 'Server error while creating account.' });
    } finally {
        client?.release();
    }
});

// -------- CONFIRM EMAIL ROUTE -------- //
router.get('/confirm-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Verification token is required.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        const userCheck = await pool.query(
            `UPDATE users SET status = 'Active' WHERE LOWER(email) = LOWER($1) RETURNING user_id, status`,
            [decoded.email]
        );

        if (userCheck.rowCount === 0) {
            return res.status(404).json({ message: 'Account not found.' });
        }

        res.status(200).json({ message: 'Email confirmed successfully! You can now log in.' });

    } catch (error) {
        return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }
});

// -------- SECURE LOGIN USER -------- //
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.password_hash AS password, u.role_id, u.status, r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE LOWER(u.email) = LOWER($1)`,
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        if (user.status?.toLowerCase() === 'pending') {
            return res.status(403).json({ message: 'Please check your email and confirm your account before logging in.' });
        }

        if (!user.status || user.status.toLowerCase() !== 'active') {
            return res.status(403).json({ message: 'Your account is not active.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { userId: user.user_id, roleId: user.role_id },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '8h' }
        );

        delete user.password;

        res.status(200).json({
            message: 'Login successful!',
            token: token,
            user: user
        });

    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = router;