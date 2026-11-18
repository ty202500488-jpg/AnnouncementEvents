const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const pool = require('../db');
const app = require('../index');
const {
    authenticateUser,
    requireAdmin,
    assertStaffOrAdmin,
    revokeToken,
    isTokenRevoked,
    sanitizeAuditDetails
} = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * In-memory stateful PostgreSQL simulator for security matrix testing.
 * Allows testing full Express HTTP endpoints (login, OTP, RBAC, IDOR, logout,
 * account suspension, token_version invalidation, SQL injection parameterization)
 * without touching or mutating any production database records.
 */
function createSecurityMockDb() {
    const passwordHash = bcrypt.hashSync('CorrectPass123!', 10);

    const state = {
        users: new Map([
            [1, {
                user_id: 1,
                email: 'admin@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'System',
                last_name: 'Admin',
                role_id: 3,
                role_name: 'admin',
                is_email_verified: true,
                account_status: 'Active',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                verification_status: null,
                verification_remarks: null
            }],
            [2, {
                user_id: 2,
                email: 'staff1@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'Staff',
                last_name: 'One',
                role_id: 2,
                role_name: 'staff',
                is_email_verified: true,
                account_status: 'Active',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                verification_status: null,
                verification_remarks: null
            }],
            [3, {
                user_id: 3,
                email: 'staff2@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'Staff',
                last_name: 'Two',
                role_id: 2,
                role_name: 'staff',
                is_email_verified: true,
                account_status: 'Active',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                verification_status: null,
                verification_remarks: null
            }],
            [4, {
                user_id: 4,
                email: 'student1@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'Student',
                last_name: 'One',
                role_id: 1,
                role_name: 'student',
                is_email_verified: true,
                account_status: 'Active',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                student_number: '2024-00001',
                verification_status: 'Verified',
                verification_remarks: null,
                department_name: 'College of Computing Studies',
                program_name: 'BS Computer Science'
            }],
            [5, {
                user_id: 5,
                email: 'student2@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'Student',
                last_name: 'Two',
                role_id: 1,
                role_name: 'student',
                is_email_verified: true,
                account_status: 'Active',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                student_number: '2024-00002',
                verification_status: 'Verified',
                verification_remarks: null,
                department_name: 'College of Computing Studies',
                program_name: 'BS Information Technology'
            }],
            [6, {
                user_id: 6,
                email: 'suspended@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'Suspended',
                last_name: 'User',
                role_id: 1,
                role_name: 'student',
                is_email_verified: true,
                account_status: 'Suspended',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                student_number: '2024-00006',
                verification_status: 'Verified',
                verification_remarks: null
            }],
            [7, {
                user_id: 7,
                email: 'unverified@wmsu.edu.ph',
                password_hash: passwordHash,
                first_name: 'Unverified',
                last_name: 'Student',
                role_id: 1,
                role_name: 'student',
                is_email_verified: false,
                account_status: 'Pending',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                student_number: '2024-00007',
                verification_status: 'Pending',
                verification_remarks: null
            }]
        ]),
        pendingRegistrations: new Map(),
        authTokens: [],
        pages: new Map([
            [10, {
                page_id: 10,
                page_name: 'CCS Official Page',
                page_code: 'CCS',
                created_by: 2,
                status: 'Approved'
            }],
            [20, {
                page_id: 20,
                page_name: 'CN Official Page',
                page_code: 'CN',
                created_by: 3,
                status: 'Approved'
            }]
        ]),
        pageMembers: [
            { page_member_id: 1, page_id: 10, user_id: 2, role_on_page: 'Admin', status: 'Active' },
            { page_member_id: 2, page_id: 20, user_id: 3, role_on_page: 'Admin', status: 'Active' }
        ],
        posts: new Map([
            [100, {
                post_id: 100,
                page_id: 10,
                creator_user_id: 2,
                post_type: 'event',
                title: 'CCS Hackathon 2026',
                content: 'Annual coding event',
                is_archived: false,
                moderation_status: 'Approved',
                status: 'Upcoming'
            }],
            [200, {
                post_id: 200,
                page_id: 20,
                creator_user_id: 3,
                post_type: 'event',
                title: 'Nursing Symposium',
                content: 'Health sciences symposium',
                is_archived: false,
                moderation_status: 'Approved',
                status: 'Upcoming'
            }]
        ]),
        auditLogs: [],
        capturedQueries: []
    };

    const findUserByEmail = (email) => {
        const norm = String(email || '').trim().toLowerCase();
        for (const u of state.users.values()) {
            if (u.email.toLowerCase() === norm) return u;
        }
        return null;
    };

    const handleQuery = async (sql, params = []) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        state.capturedQueries.push({ text, params });

        // Schema / DDL / Transaction queries
        if (
            text.startsWith('BEGIN') ||
            text.startsWith('COMMIT') ||
            text.startsWith('ROLLBACK') ||
            text.startsWith('ALTER TABLE') ||
            text.startsWith('CREATE TABLE') ||
            text.startsWith('CREATE INDEX')
        ) {
            return { rows: [], rowCount: 0 };
        }

        // Audit logs insertion
        if (text.includes('INSERT INTO audit_logs')) {
            state.auditLogs.push({
                actor_user_id: params[0],
                actor_role: params[1],
                action: params[2],
                module: params[3],
                target_type: params[4],
                target_id: params[5],
                outcome: params[6],
                is_security_event: params[7],
                ip_address: params[8],
                user_agent: params[9],
                details: params[10]
            });
            return { rows: [], rowCount: 1 };
        }

        // Revoked token lookup in auth_tokens
        if (text.includes('FROM auth_tokens') && text.includes("token_type = 'revoked_jwt'")) {
            const hash = params[0];
            const found = state.authTokens.find(
                (t) => t.token_type === 'revoked_jwt' && t.token_hash === hash && new Date(t.expires_at) > new Date()
            );
            return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
        }

        if (text.includes('INSERT INTO auth_tokens') && text.includes("'revoked_jwt'")) {
            state.authTokens.push({
                token_id: state.authTokens.length + 1,
                user_id: params[0],
                token_hash: params[1],
                token_type: 'revoked_jwt',
                expires_at: params[2],
                used_at: new Date()
            });
            return { rows: [], rowCount: 1 };
        }

        // authenticateUser lookup by user_id
        if (text.includes('FROM users u') && text.includes('JOIN roles r ON u.role_id = r.role_id') && text.includes('WHERE u.user_id = $1')) {
            const u = state.users.get(Number(params[0]));
            if (!u) return { rows: [], rowCount: 0 };
            return { rows: [{ ...u }], rowCount: 1 };
        }

        // Login lookup by LOWER(u.email) = LOWER($1)
        if (text.includes('FROM users u') && text.includes('WHERE LOWER(u.email) = LOWER($1)')) {
            const u = findUserByEmail(params[0]);
            if (!u) return { rows: [], rowCount: 0 };
            return { rows: [{ ...u }], rowCount: 1 };
        }

        // Update failed_login_attempts on failure
        if (text.includes('UPDATE users') && text.includes('SET failed_login_attempts = $1')) {
            const u = state.users.get(Number(params[2]));
            if (u) {
                u.failed_login_attempts = Number(params[0]);
                if (params[1]) {
                    u.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                }
            }
            return { rows: [], rowCount: u ? 1 : 0 };
        }

        // Reset failed_login_attempts on login success
        if (text.includes('UPDATE users') && text.includes('SET failed_login_attempts = 0, locked_until = NULL') && !text.includes('password_hash')) {
            const u = state.users.get(Number(params[0]));
            if (u) {
                u.failed_login_attempts = 0;
                u.locked_until = null;
            }
            return { rows: [], rowCount: u ? 1 : 0 };
        }

        // system_settings query for require_student_verification
        if (text.includes('FROM system_settings')) {
            return { rows: [{ setting_value: true }], rowCount: 1 };
        }

        // Pending registration lookup by LOWER(email)
        if (text.includes('FROM pending_registrations') && text.includes('WHERE LOWER(email) =')) {
            const norm = String(params[0] || '').trim().toLowerCase();
            const pending = state.pendingRegistrations.get(norm);
            return { rows: pending ? [{ ...pending }] : [], rowCount: pending ? 1 : 0 };
        }

        // Update otp_attempts on pending_registrations
        if (text.includes('UPDATE pending_registrations') && text.includes('SET otp_attempts = $1')) {
            const nextAttempts = Number(params[0]);
            const pendingId = Number(params[1]);
            for (const p of state.pendingRegistrations.values()) {
                if (p.pending_id === pendingId) {
                    p.otp_attempts = nextAttempts;
                }
            }
            return { rows: [], rowCount: 1 };
        }

        // Update OTP hash on resend in pending_registrations
        if (text.includes('UPDATE pending_registrations') && text.includes('SET token_hash = $1')) {
            const [newHash, newExp, pendingId] = params;
            for (const p of state.pendingRegistrations.values()) {
                if (p.pending_id === Number(pendingId)) {
                    p.token_hash = newHash;
                    p.expires_at = newExp;
                    p.otp_attempts = 0;
                    p.last_sent_at = new Date();
                }
            }
            return { rows: [], rowCount: 1 };
        }

        // Delete from pending_registrations after verification
        if (text.includes('DELETE FROM pending_registrations')) {
            const pendingId = Number(params[0]);
            for (const [k, p] of state.pendingRegistrations.entries()) {
                if (p.pending_id === pendingId) {
                    state.pendingRegistrations.delete(k);
                }
            }
            return { rows: [], rowCount: 1 };
        }

        // Roles lookup
        if (text.includes("SELECT role_id FROM roles WHERE LOWER(role_name) = 'student'")) {
            return { rows: [{ role_id: 1 }], rowCount: 1 };
        }

        // Duplicate check during verify-otp
        if (text.includes('SELECT u.user_id') && text.includes('FROM users u') && text.includes('sp.student_number = $2')) {
            const u = findUserByEmail(params[0]);
            return { rows: u ? [{ user_id: u.user_id }] : [], rowCount: u ? 1 : 0 };
        }

        // Insert new user during verify-otp
        if (text.includes('INSERT INTO users') && text.includes('is_email_verified, account_status')) {
            const newId = state.users.size + 10;
            const newUser = {
                user_id: newId,
                role_id: params[0],
                first_name: params[1],
                middle_initial: params[2],
                last_name: params[3],
                email: params[4],
                password_hash: params[5],
                role_name: 'student',
                is_email_verified: true,
                account_status: params[6] || 'Pending',
                status: params[6] || 'Pending',
                token_version: 1,
                failed_login_attempts: 0,
                locked_until: null,
                verification_status: 'Pending'
            };
            state.users.set(newId, newUser);
            return { rows: [newUser], rowCount: 1 };
        }

        if (text.includes('INSERT INTO student_profiles')) {
            return { rows: [], rowCount: 1 };
        }

        // auth_tokens lookup for unverified user OTP
        if (text.includes('FROM auth_tokens') && text.includes("token_type = 'email_verification'") && text.includes('used_at IS NULL')) {
            const userId = Number(params[0]);
            const tokens = state.authTokens.filter(
                (t) => t.user_id === userId && t.token_type === 'email_verification' && !t.used_at
            );
            const latest = tokens[tokens.length - 1];
            return { rows: latest ? [latest] : [], rowCount: latest ? 1 : 0 };
        }

        // canManagePage check
        if (text.includes('FROM pages p') && text.includes('WHERE p.page_id = $1') && text.includes('p.created_by = $2 OR pm.user_id = $2')) {
            const pageId = Number(params[0]);
            const userId = Number(params[1]);
            const pg = state.pages.get(pageId);
            if (!pg) return { rows: [], rowCount: 0 };
            const isCreator = Number(pg.created_by) === userId;
            const isMember = state.pageMembers.some(
                (pm) => pm.page_id === pageId && pm.user_id === userId && pm.status.toLowerCase() === 'active'
            );
            return (isCreator || isMember) ? { rows: [{ page_id: pageId }], rowCount: 1 } : { rows: [], rowCount: 0 };
        }

        // getUserPageDetails check
        if (text.includes('FROM pages p') && text.includes('WHERE p.created_by = $1 OR pm.user_id = $1')) {
            const userId = Number(params[0]);
            for (const pg of state.pages.values()) {
                const isMember = state.pageMembers.some(
                    (pm) => pm.page_id === pg.page_id && pm.user_id === userId && pm.status.toLowerCase() === 'active'
                );
                if (pg.created_by === userId || isMember) {
                    return { rows: [{ ...pg }], rowCount: 1 };
                }
            }
            return { rows: [], rowCount: 0 };
        }

        // getUserManagedPages in mypageRegistrations
        if (text.includes('SELECT DISTINCT p.page_id') && text.includes('FROM pages p')) {
            const userId = Number(params[0]);
            const ids = [];
            for (const pg of state.pages.values()) {
                const isMember = state.pageMembers.some(
                    (pm) => pm.page_id === pg.page_id && pm.user_id === userId && pm.status.toLowerCase() === 'active'
                );
                if (pg.created_by === userId || isMember) {
                    ids.push({ page_id: pg.page_id });
                }
            }
            return { rows: ids, rowCount: ids.length };
        }

        // Event ownership check in mypageRegistrations: SELECT post_id FROM posts WHERE post_id = $1 AND page_id = ANY($2::int[])
        if (text.includes('SELECT post_id FROM posts WHERE post_id = $1 AND page_id = ANY($2::int[])')) {
            const eventId = Number(params[0]);
            const pageIds = Array.isArray(params[1]) ? params[1].map(Number) : [];
            const post = state.posts.get(eventId);
            if (post && pageIds.includes(Number(post.page_id))) {
                return { rows: [{ post_id: eventId }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }

        // fetchUserRegistrationPrefill
        if (text.includes('FROM users u') && text.includes('LEFT JOIN student_profiles sp') && text.includes('WHERE u.user_id = $1')) {
            const u = state.users.get(Number(params[0]));
            if (!u) return { rows: [], rowCount: 0 };
            return {
                rows: [{
                    user_id: u.user_id,
                    first_name: u.first_name,
                    last_name: u.last_name,
                    email: u.email,
                    student_number: u.student_number || '2024-00001',
                    department_name: u.department_name || 'CCS',
                    program_name: u.program_name || 'BSCS',
                    year_level: '1st Year'
                }],
                rowCount: 1
            };
        }

        // Admin account status update (suspension / role change)
        if (text.includes('UPDATE users') && text.includes('SET account_status = $1') && text.includes('token_version = COALESCE(token_version, 1) + 1')) {
            const nextStatus = params[0];
            const targetId = Number(params[1]);
            const u = state.users.get(targetId);
            if (u) {
                u.account_status = nextStatus;
                u.token_version = (u.token_version || 1) + 1;
            }
            return { rows: [], rowCount: u ? 1 : 0 };
        }

        // Update user profile (PUT /api/users/me/profile)
        if (text.includes('UPDATE users') && text.includes('SET first_name = $1') && text.includes('last_name = $2')) {
            const u = state.users.get(Number(params[2]));
            if (u) {
                u.first_name = params[0];
                u.last_name = params[1];
            }
            return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
        }

        // Change password (POST /api/users/change-password)
        if (text.includes('SELECT user_id, password_hash, token_version FROM users WHERE user_id = $1')) {
            const u = state.users.get(Number(params[0]));
            return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
        }

        if (text.includes('UPDATE users') && text.includes('SET password_hash = $1') && text.includes('RETURNING token_version')) {
            const u = state.users.get(Number(params[1]));
            if (u) {
                u.password_hash = params[0];
                u.token_version = (u.token_version || 1) + 1;
                return { rows: [{ token_version: u.token_version }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }

        // Default fallback for notifications or empty selects
        return { rows: [], rowCount: 0 };
    };

    return {
        state,
        query: handleQuery,
        connect: async () => ({
            query: handleQuery,
            release: () => {}
        })
    };
}

let mockDb;
let origQuery;
let origConnect;
let origEmailUser;
let origEmailPass;

test.before(async () => {
    origEmailUser = process.env.EMAIL_USER;
    origEmailPass = process.env.EMAIL_PASS;
    process.env.EMAIL_USER = '';
    process.env.EMAIL_PASS = '';
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_EMAIL_FALLBACK = 'true';

    mockDb = createSecurityMockDb();
    origQuery = pool.query.bind(pool);
    origConnect = pool.connect.bind(pool);
    pool.query = mockDb.query;
    pool.connect = mockDb.connect;
});

test.after(async () => {
    process.env.EMAIL_USER = origEmailUser;
    process.env.EMAIL_PASS = origEmailPass;
    pool.query = origQuery;
    pool.connect = origConnect;
});

async function apiRequest(path, { method = 'GET', token = null, body = null, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const reqHeaders = {
            host: 'localhost:5000',
            'content-type': 'application/json',
            ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
        };
        if (token) {
            reqHeaders.authorization = `Bearer ${token}`;
        }

        const mockSocket = {
            remoteAddress: '127.0.0.1',
            destroy: () => {},
            on: () => {},
            removeListener: () => {},
            setTimeout: () => {}
        };

        const req = new Readable({
            read() {
                this.push(null);
            }
        });
        req._destroy = (err, cb) => cb(err);

        req.url = path;
        req.originalUrl = path;
        req.method = method.toUpperCase();
        req.headers = reqHeaders;
        req.body = body !== null && body !== undefined ? body : {};
        req._body = true; // Tells body-parser that req.body is already parsed
        req.connection = mockSocket;
        req.socket = mockSocket;
        req.ip = '127.0.0.1';
        req.get = (name) => reqHeaders[String(name || '').toLowerCase()];
        req.header = req.get;

        const resHeaders = new Map();
        const res = {
            statusCode: 200,
            headersSent: false,
            locals: {},
            setHeader(name, val) {
                resHeaders.set(String(name).toLowerCase(), val);
            },
            getHeader(name) {
                return resHeaders.get(String(name).toLowerCase());
            },
            removeHeader(name) {
                resHeaders.delete(String(name).toLowerCase());
            },
            set(name, val) {
                if (typeof name === 'object' && name !== null) {
                    for (const [k, v] of Object.entries(name)) {
                        this.setHeader(k, v);
                    }
                } else {
                    this.setHeader(name, val);
                }
                return this;
            },
            header(name, val) {
                return this.set(name, val);
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(obj) {
                this.headersSent = true;
                resolve({
                    status: this.statusCode,
                    headers: resHeaders,
                    data: obj
                });
                return this;
            },
            send(chunk) {
                this.headersSent = true;
                let parsed = {};
                if (typeof chunk === 'object' && chunk !== null && !Buffer.isBuffer(chunk)) {
                    parsed = chunk;
                } else if (typeof chunk === 'string') {
                    try { parsed = JSON.parse(chunk); } catch (_) { parsed = { raw: chunk }; }
                }
                resolve({
                    status: this.statusCode,
                    headers: resHeaders,
                    data: parsed
                });
                return this;
            },
            end(chunk) {
                if (!this.headersSent) {
                    this.send(chunk || '');
                }
                return this;
            }
        };

        app.handle(req, res, (err) => {
            if (err) return reject(err);
            if (!res.headersSent) {
                resolve({ status: res.statusCode || 404, headers: resHeaders, data: {} });
            }
        });
    });
}

function issueTokenForUser(user, overrides = {}) {
    return jwt.sign(
        {
            userId: user.user_id,
            role: user.role_name,
            tokenVersion: user.token_version || 1,
            ...overrides
        },
        JWT_SECRET,
        { expiresIn: '2h' }
    );
}

// ============================================================================
// 1. VALID & INVALID LOGIN + ACCOUNT ENUMERATION + BRUTE-FORCE LOCKOUT
// ============================================================================
test('1.1 Valid login succeeds for Verified Student, Staff, and Admin with authoritative role', async () => {
    for (const [email, expectedRole] of [
        ['student1@wmsu.edu.ph', 'student'],
        ['staff1@wmsu.edu.ph', 'staff'],
        ['admin@wmsu.edu.ph', 'admin']
    ]) {
        const res = await apiRequest('/api/users/login', {
            method: 'POST',
            body: { email, password: 'CorrectPass123!' }
        });
        assert.equal(res.status, 200);
        assert.ok(res.data.token);
        assert.equal(res.data.user.role_name, expectedRole);
    }
});

test('1.2 Invalid login returns generic 401 and does not leak account status when password is wrong', async () => {
    // Wrong password for Suspended account must NOT reveal that the account is Suspended
    const suspendedWrongPass = await apiRequest('/api/users/login', {
        method: 'POST',
        body: { email: 'suspended@wmsu.edu.ph', password: 'WrongPassword!' }
    });
    assert.equal(suspendedWrongPass.status, 401);
    assert.equal(suspendedWrongPass.data.message, 'Invalid email or password.');

    // Wrong password for non-existent user returns identical 401 message
    const unknownUser = await apiRequest('/api/users/login', {
        method: 'POST',
        body: { email: 'nonexistent@wmsu.edu.ph', password: 'WrongPassword!' }
    });
    assert.equal(unknownUser.status, 401);
    assert.equal(unknownUser.data.message, 'Invalid email or password.');
});

test('1.3 Repeated failed logins lock the account for 15 minutes after 5 failed attempts', async () => {
    const targetUser = mockDb.state.users.get(5); // student2@wmsu.edu.ph
    targetUser.failed_login_attempts = 0;
    targetUser.locked_until = null;

    for (let i = 1; i <= 5; i++) {
        const res = await apiRequest('/api/users/login', {
            method: 'POST',
            body: { email: 'student2@wmsu.edu.ph', password: 'WrongPassword123!' }
        });
        if (i < 5) {
            assert.equal(res.status, 401);
        } else {
            assert.equal(res.status, 429);
        }
    }

    // Even with the CORRECT password, login must be blocked while locked_until is active
    const lockedRes = await apiRequest('/api/users/login', {
        method: 'POST',
        body: { email: 'student2@wmsu.edu.ph', password: 'CorrectPass123!' }
    });
    assert.equal(lockedRes.status, 429);
    assert.ok(lockedRes.data.message.includes('temporarily locked'));

    // Reset lock for subsequent tests
    targetUser.failed_login_attempts = 0;
    targetUser.locked_until = null;
});

// ============================================================================
// 2. OTP VERIFICATION SECURITY (CORRECT, INCORRECT, EXPIRED, REUSED, BRUTE-FORCE, COOLDOWN)
// ============================================================================
test('2.1 Expired OTP is rejected with 400 OTP_EXPIRED', async () => {
    const email = 'expiredotp@wmsu.edu.ph';
    const otp = '123456';
    const hash = crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');

    mockDb.state.pendingRegistrations.set(email, {
        pending_id: 101,
        email,
        password_hash: 'hash',
        first_name: 'Exp',
        last_name: 'Student',
        student_number: '2024-99101',
        token_hash: hash,
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // expired 1m ago
        otp_attempts: 0,
        last_sent_at: new Date(Date.now() - 120 * 1000).toISOString()
    });

    const res = await apiRequest('/api/users/verify-otp', {
        method: 'POST',
        body: { email, otp }
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.code, 'OTP_EXPIRED');
});

test('2.2 Resending OTP enforces 60-second cooldown and invalidates previous OTP', async () => {
    const email = 'cooldownotp@wmsu.edu.ph';
    const oldOtp = '111111';
    const oldHash = crypto.createHash('sha256').update(`${email}:${oldOtp}`).digest('hex');

    mockDb.state.pendingRegistrations.set(email, {
        pending_id: 102,
        email,
        password_hash: 'hash',
        first_name: 'Cool',
        last_name: 'Down',
        student_number: '2024-99102',
        token_hash: oldHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        otp_attempts: 0,
        last_sent_at: new Date().toISOString() // just sent now
    });

    // Immediate resend within 60s cooldown must be blocked with 429
    const cooldownRes = await apiRequest('/api/users/resend-confirmation', {
        method: 'POST',
        body: { email }
    });
    assert.equal(cooldownRes.status, 429);
    assert.equal(cooldownRes.data.code, 'OTP_COOLDOWN');

    // Move last_sent_at back 65 seconds and resend -> succeeds and replaces token_hash
    mockDb.state.pendingRegistrations.get(email).last_sent_at = new Date(Date.now() - 65 * 1000).toISOString();
    const resendOk = await apiRequest('/api/users/resend-confirmation', {
        method: 'POST',
        body: { email }
    });
    assert.equal(resendOk.status, 200);

    // Attempting to verify the OLD OTP must now fail
    const verifyOld = await apiRequest('/api/users/verify-otp', {
        method: 'POST',
        body: { email, otp: oldOtp }
    });
    assert.equal(verifyOld.status, 400);
});

test('2.3 OTP brute-force protection locks out after 5 incorrect attempts', async () => {
    const email = 'bruteforceotp@wmsu.edu.ph';
    const realOtp = '654321';
    const realHash = crypto.createHash('sha256').update(`${email}:${realOtp}`).digest('hex');

    mockDb.state.pendingRegistrations.set(email, {
        pending_id: 103,
        email,
        password_hash: 'hash',
        first_name: 'Brute',
        last_name: 'Force',
        student_number: '2024-99103',
        token_hash: realHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        otp_attempts: 0,
        last_sent_at: new Date(Date.now() - 120 * 1000).toISOString()
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await apiRequest('/api/users/verify-otp', {
            method: 'POST',
            body: { email, otp: '000000' }
        });
        if (attempt < 5) {
            assert.equal(res.status, 400);
        } else {
            assert.equal(res.status, 429);
            assert.equal(res.data.code, 'OTP_MAX_ATTEMPTS');
        }
    }

    // Even supplying the CORRECT OTP after 5 failed attempts must be rejected
    const afterLockout = await apiRequest('/api/users/verify-otp', {
        method: 'POST',
        body: { email, otp: realOtp }
    });
    assert.equal(afterLockout.status, 429);
    assert.equal(afterLockout.data.code, 'OTP_MAX_ATTEMPTS');
});

test('2.4 Correct OTP succeeds once and cannot be reused (single-use enforcement)', async () => {
    const email = 'validotp@wmsu.edu.ph';
    const validOtp = '778899';
    const validHash = crypto.createHash('sha256').update(`${email}:${validOtp}`).digest('hex');

    mockDb.state.pendingRegistrations.set(email, {
        pending_id: 104,
        email,
        password_hash: 'hash',
        first_name: 'Valid',
        last_name: 'OtpUser',
        student_number: '2024-99104',
        department_id: 7,
        program_id: 17,
        year_level: '1st Year',
        cor_image: Buffer.from('cor'),
        cor_mime_type: 'image/jpeg',
        student_id_image: Buffer.from('id'),
        student_id_mime_type: 'image/jpeg',
        token_hash: validHash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        otp_attempts: 0,
        last_sent_at: new Date(Date.now() - 120 * 1000).toISOString()
    });

    const firstVerify = await apiRequest('/api/users/verify-otp', {
        method: 'POST',
        body: { email, otp: validOtp }
    });
    assert.equal(firstVerify.status, 200);

    // Reusing the same OTP must fail because the pending registration was consumed
    const secondVerify = await apiRequest('/api/users/verify-otp', {
        method: 'POST',
        body: { email, otp: validOtp }
    });
    assert.equal(secondVerify.status, 400);
});

// ============================================================================
// 3. STRICT ROLE-BASED ACCESS CONTROL (ADMIN vs STAFF vs STUDENT)
// ============================================================================
test('3.1 Student cannot access Administrator APIs or Staff MyPage APIs', async () => {
    const studentToken = issueTokenForUser(mockDb.state.users.get(4));

    // Student calling Admin endpoints
    const adminUsersRes = await apiRequest('/api/admin/users', { token: studentToken });
    assert.equal(adminUsersRes.status, 403);

    // Student calling Staff MyPage endpoints
    const myPageStatusRes = await apiRequest('/api/my-page-status', { token: studentToken });
    assert.equal(myPageStatusRes.status, 403);

    const createPageRes = await apiRequest('/api/create-page', {
        method: 'POST',
        token: studentToken,
        body: { pageName: 'Unauthorized Student Page' }
    });
    assert.equal(createPageRes.status, 403);

    const createAnnRes = await apiRequest('/api/announcements', {
        method: 'POST',
        token: studentToken,
        body: { title: 'Fake Announcement', content: 'Hacked by student', pageId: 10 }
    });
    assert.equal(createAnnRes.status, 403);

    const staffRegSummary = await apiRequest('/api/mypage/registrations/summary', { token: studentToken });
    assert.equal(staffRegSummary.status, 403);

    const staffAttendanceEvents = await apiRequest('/api/mypage/attendance/events', { token: studentToken });
    assert.equal(staffAttendanceEvents.status, 403);
});

test('3.2 Staff cannot access Administrator APIs or manage another Staff member\'s page/events', async () => {
    const staff1Token = issueTokenForUser(mockDb.state.users.get(2)); // Manages page 10 (event 100), NOT page 20 (event 200)

    // Staff calling Admin endpoints
    const adminSettingsRes = await apiRequest('/api/admin/users', { token: staff1Token });
    assert.equal(adminSettingsRes.status, 403);

    // Staff1 attempting to publish an announcement to Staff2's page (pageId: 20)
    const crossPageAnn = await apiRequest('/api/announcements', {
        method: 'POST',
        token: staff1Token,
        body: { title: 'Cross Page Post', content: 'Unauthorized', pageId: 20 }
    });
    assert.equal(crossPageAnn.status, 403);

    // Staff1 attempting to publish an event to Staff2's page (pageId: 20)
    const crossPageEvent = await apiRequest('/api/events', {
        method: 'POST',
        token: staff1Token,
        body: { title: 'Cross Page Event', description: 'Unauthorized', pageId: 20 }
    });
    assert.equal(crossPageEvent.status, 403);

    // Staff1 attempting to view Staff2's MyPage management posts (pageId: 20)
    const crossPagePosts = await apiRequest('/api/mypage/posts?pageId=20', { token: staff1Token });
    assert.equal(crossPagePosts.status, 403);

    // Staff1 attempting to view registrants or export CSV for Staff2's event (eventId: 200)
    const crossEventRegistrants = await apiRequest('/api/mypage/registrations/events/200/students/1', { token: staff1Token });
    assert.equal(crossEventRegistrants.status, 403);

    const crossEventExport = await apiRequest('/api/mypage/registrations/events/200/export', { token: staff1Token });
    assert.equal(crossEventExport.status, 403);
});

test('3.3 Role manipulation in JWT payload or profile update request is rejected by backend', async () => {
    const studentUser = mockDb.state.users.get(4);
    // Forged JWT payload claiming role: 'admin', signed with valid secret, but user 4 in DB is 'student'
    const forgedRoleToken = jwt.sign(
        { userId: studentUser.user_id, role: 'admin', role_name: 'admin', tokenVersion: 1 },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Backend queries authoritative role from DB, so Admin endpoint rejects with 403
    const adminAttempt = await apiRequest('/api/admin/users', { token: forgedRoleToken });
    assert.equal(adminAttempt.status, 403);

    // GET /api/users/me returns authoritative 'student' role from DB
    const meRes = await apiRequest('/api/users/me', { token: forgedRoleToken });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.role_name, 'student');

    // Attempting mass-assignment privilege escalation on PUT /api/users/me/profile is rejected with 403
    const escalationRes = await apiRequest('/api/users/me/profile', {
        method: 'PUT',
        token: forgedRoleToken,
        body: { firstName: 'Student', lastName: 'One', role: 'admin', account_status: 'Active' }
    });
    assert.equal(escalationRes.status, 403);
});

// ============================================================================
// 4. BROKEN OBJECT-LEVEL AUTHORIZATION (IDOR) PROTECTION
// ============================================================================
test('4.1 Student1 cannot access Student2 records by passing student_id/user_id in query or body', async () => {
    const student1Token = issueTokenForUser(mockDb.state.users.get(4)); // user_id = 4

    // Attempt to steal Student 2 (user_id = 5) registration prefill (COR/Student ID photos)
    const prefillIdor = await apiRequest('/api/users/events/100/registration-prefill?student_id=5', {
        token: student1Token
    });
    assert.equal(prefillIdor.status, 403);

    // Attempt to view Student 2's registered events
    const myEventsIdor = await apiRequest('/api/users/my-events?student_id=5', {
        token: student1Token
    });
    assert.equal(myEventsIdor.status, 403);

    // Attempt to view Student 2's notifications
    const notifIdor = await apiRequest('/api/users/notifications?user_id=5', {
        token: student1Token
    });
    assert.equal(notifIdor.status, 403);

    // Attempt to cancel Student 2's event registration
    const cancelIdor = await apiRequest('/api/users/events/100/cancel', {
        method: 'POST',
        token: student1Token,
        body: { student_id: 5 }
    });
    assert.equal(cancelIdor.status, 403);

    // Attempt to view Student 2's followed pages list
    const followedIdor = await apiRequest('/api/pages/followed/list?student_id=5', {
        token: student1Token
    });
    assert.equal(followedIdor.status, 403);
});

// ============================================================================
// 5. SUSPENDED / UNVERIFIED ACCOUNTS, SESSION EXPIRATION & LOGOUT INVALIDATION
// ============================================================================
test('5.1 Suspended or unverified accounts with an existing JWT are rejected by authenticateUser', async () => {
    const suspendedToken = issueTokenForUser(mockDb.state.users.get(6));
    const suspendedRes = await apiRequest('/api/users/me', { token: suspendedToken });
    assert.equal(suspendedRes.status, 403);
    assert.equal(suspendedRes.data.code, 'ACCOUNT_INACTIVE');

    const unverifiedToken = issueTokenForUser(mockDb.state.users.get(7));
    const unverifiedRes = await apiRequest('/api/users/me', { token: unverifiedToken });
    assert.equal(unverifiedRes.status, 403);
    assert.equal(unverifiedRes.data.code, 'EMAIL_UNVERIFIED');
});

test('5.2 Admin suspending an active user immediately invalidates their existing JWT via token_version & status check', async () => {
    const adminToken = issueTokenForUser(mockDb.state.users.get(1));
    const student2 = mockDb.state.users.get(5);
    const student2OldToken = issueTokenForUser(student2);

    // Before suspension, token works
    const beforeRes = await apiRequest('/api/users/me', { token: student2OldToken });
    assert.equal(beforeRes.status, 200);

    // Admin suspends student 2
    const suspendRes = await apiRequest('/api/admin/users/5/status', {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'Suspended', reason: 'Security policy test' }
    });
    assert.equal(suspendRes.status, 200);

    // Existing token is immediately rejected
    const afterRes = await apiRequest('/api/users/me', { token: student2OldToken });
    assert.ok(afterRes.status === 401 || afterRes.status === 403);

    // Restore student 2 for remaining tests
    student2.account_status = 'Active';
});

test('5.3 Expired or malformed JWTs and query-string tokens are rejected with 401', async () => {
    const expiredToken = jwt.sign(
        { userId: 4, role: 'student', tokenVersion: 1 },
        JWT_SECRET,
        { expiresIn: '-10s' }
    );
    const expRes = await apiRequest('/api/users/me', { token: expiredToken });
    assert.equal(expRes.status, 401);

    const missingRes = await apiRequest('/api/users/me');
    assert.equal(missingRes.status, 401);

    // Query-string token must not be accepted on standard endpoints
    const validToken = issueTokenForUser(mockDb.state.users.get(4));
    const queryTokenRes = await apiRequest(`/api/users/me?token=${encodeURIComponent(validToken)}`);
    assert.equal(queryTokenRes.status, 401);
});

test('5.4 Logout revokes the active JWT so it cannot be reused after logout', async () => {
    const student1 = mockDb.state.users.get(4);
    const sessionToken = issueTokenForUser(student1, { jti: crypto.randomBytes(8).toString('hex') });

    // Token works prior to logout
    const preLogout = await apiRequest('/api/users/me', { token: sessionToken });
    assert.equal(preLogout.status, 200);

    // Call POST /api/users/logout
    const logoutRes = await apiRequest('/api/users/logout', {
        method: 'POST',
        token: sessionToken
    });
    assert.equal(logoutRes.status, 200);

    // Replaying the logged-out token must fail with 401
    const postLogout = await apiRequest('/api/users/me', { token: sessionToken });
    assert.equal(postLogout.status, 401);
    assert.equal(postLogout.data.code, 'TOKEN_REVOKED');
});

// ============================================================================
// 6. SQL INJECTION & AUDIT LOG SANITIZATION
// ============================================================================
test('6.1 SQL injection payloads in login and search are safely parameterized and never interpolated', async () => {
    const sqliEmail = "' OR 1=1 --";
    const loginRes = await apiRequest('/api/users/login', {
        method: 'POST',
        body: { email: sqliEmail, password: "' OR '1'='1" }
    });
    assert.equal(loginRes.status, 401);

    // Verify the SQL query text did not interpolate the payload
    const leakedInSql = mockDb.state.capturedQueries.some((q) => q.text.includes('OR 1=1'));
    assert.equal(leakedInSql, false);
});

test('6.2 Security audit logger strips sensitive fields (passwords, OTPs, tokens) before writing', () => {
    const sanitized = sanitizeAuditDetails({
        email: 'user@wmsu.edu.ph',
        password: 'SecretPassword123!',
        otp: '123456',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_hash: 'abcdef',
        nested: {
            currentPassword: 'OldPassword!',
            safeField: 'allowed'
        }
    });

    assert.equal(sanitized.email, 'user@wmsu.edu.ph');
    assert.equal(sanitized.password, undefined);
    assert.equal(sanitized.otp, undefined);
    assert.equal(sanitized.token, undefined);
    assert.equal(sanitized.token_hash, undefined);
    assert.equal(sanitized.nested.currentPassword, undefined);
    assert.equal(sanitized.nested.safeField, 'allowed');
});
