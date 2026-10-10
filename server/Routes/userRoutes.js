const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

// -------- TEST ROUTE -------- //
router.get('/test', (req, res) => {
    res.send('User routes are working!');
});

// -------- CREATE STUDENT ACCOUNT -------- //
router.post('/', async (req, res) => {
    try {
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

        // 4. Validate password
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

        // 5. Validate year level
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

        // 6. Find the STUDENT role
        const roleResult = await pool.query(
            `SELECT role_id
             FROM roles
             WHERE LOWER(role_name) = 'student'
             LIMIT 1`
        );

        if (roleResult.rowCount === 0) {
            return res.status(500).json({
                message: 'Student role is not configured in the database.'
            });
        }

        const studentRoleId = roleResult.rows[0].role_id;

        // 7. Verify department exists and is active
        const departmentResult = await pool.query(
            `SELECT department_id
             FROM departments
             WHERE department_id = $1
               AND LOWER(status) = 'active'`,
            [department_id]
        );

        if (departmentResult.rowCount === 0) {
            return res.status(400).json({
                message: 'Invalid or inactive department.'
            });
        }

        // 8. Verify program belongs to the selected department
        if (program_id) {
            const programResult = await pool.query(
                `SELECT program_id
                 FROM programs
                 WHERE program_id = $1
                   AND department_id = $2`,
                [program_id, department_id]
            );

            if (programResult.rowCount === 0) {
                return res.status(400).json({
                    message: 'The selected program does not belong to this department.'
                });
            }
        }

        // 9. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 10. Create student account (using password_hash to match table definition)
        const newUser = await pool.query(
            `INSERT INTO users (
                student_id,
                role_id,
                first_name,
                middle_initial,
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
                $7, $8, $9, $10, 'Active'
            )
            RETURNING
                user_id,
                student_id,
                role_id,
                first_name,
                middle_initial,
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
                middle_initial?.trim() || null,
                last_name.trim(),
                normalizedEmail,
                hashedPassword,
                year_level,
                department_id,
                program_id || null
            ]
        );

        return res.status(201).json({
            message: 'Student account created successfully!',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('Create user error:', error);

        if (error.code === '23505') {
            if (error.constraint?.includes('student_id')) {
                return res.status(409).json({
                    message: 'Student ID already exists.'
                });
            }

            if (error.constraint?.includes('email')) {
                return res.status(409).json({
                    message: 'Email already exists.'
                });
            }

            return res.status(409).json({
                message: 'An account with these details already exists.'
            });
        }

        if (error.code === '23503') {
            return res.status(400).json({
                message: 'Invalid department, program, or role reference.'
            });
        }

        return res.status(500).json({
            message: 'Server error while creating account.'
        });
    }
});


// -------- LOGIN USER -------- //
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required.'
            });
        }

        // Find user by email (alias password_hash as password for comparison consistency)
        const result = await pool.query(
            `SELECT user_id, first_name, last_name, email,
                    password_hash AS password, role_id, status
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [email]
        );

        // Check if user exists
        if (result.rows.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = result.rows[0];

        // Check account status case-insensitively
        if (!user.status || user.status.toLowerCase() !== 'active') {
            return res.status(403).json({
                message: 'Your account is not active.'
            });
        }

        // Compare password with stored hash
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // Never return the password or its hash
        delete user.password;

        res.status(200).json({
            message: 'Login successful!',
            user: user
        });

    } catch (error) {
        console.error('Login error:', error.message);

        res.status(500).json({
            message: 'Server error during login.'
        });
    }
});

module.exports = router;