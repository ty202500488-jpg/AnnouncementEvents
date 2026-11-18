const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// In-memory cache of revoked token hashes (hash -> expiresAtMs) backed by PostgreSQL auth_tokens
const revokedTokenCache = new Map();

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function pruneRevokedCache() {
    const now = Date.now();
    for (const [hash, exp] of revokedTokenCache.entries()) {
        if (exp <= now) {
            revokedTokenCache.delete(hash);
        }
    }
}

/**
 * Revoke a JWT token on logout so it cannot be reused before its natural expiration.
 */
async function revokeToken(rawToken, userId = null, db = pool) {
    if (!rawToken || typeof rawToken !== 'string') return false;
    pruneRevokedCache();

    const tokenHash = hashToken(rawToken);
    let expiresAtMs = Date.now() + 8 * 60 * 60 * 1000;
    let resolvedUserId = userId;

    try {
        const decoded = jwt.decode(rawToken);
        if (decoded && decoded.exp) {
            expiresAtMs = decoded.exp * 1000;
        }
        if (!resolvedUserId && decoded) {
            resolvedUserId = Number(decoded.userId ?? decoded.id ?? decoded.user_id) || null;
        }
    } catch (_) {
        // Ignore decode errors
    }

    revokedTokenCache.set(tokenHash, expiresAtMs);

    if (resolvedUserId && db && typeof db.query === 'function') {
        try {
            await db.query(
                `INSERT INTO auth_tokens (user_id, token_type, token_hash, expires_at, used_at)
                 VALUES ($1, 'revoked_jwt', $2, $3, NOW())
                 ON CONFLICT (token_hash) DO NOTHING`,
                [resolvedUserId, tokenHash, new Date(expiresAtMs)]
            );
        } catch (_) {
            // Non-fatal if constraint migration has not run yet; in-memory revocation still active
        }
    }

    return true;
}

/**
 * Check if a JWT token has been revoked.
 */
async function isTokenRevoked(rawToken, db = pool) {
    if (!rawToken || typeof rawToken !== 'string') return true;
    pruneRevokedCache();

    const tokenHash = hashToken(rawToken);
    const cachedExpiry = revokedTokenCache.get(tokenHash);
    if (cachedExpiry && cachedExpiry > Date.now()) {
        return true;
    }

    if (db && typeof db.query === 'function') {
        try {
            const res = await db.query(
                `SELECT 1 FROM auth_tokens
                 WHERE token_hash = $1 AND token_type = 'revoked_jwt' AND expires_at > NOW()
                 LIMIT 1`,
                [tokenHash]
            );
            if (res && res.rows && res.rows.length > 0) {
                revokedTokenCache.set(tokenHash, Date.now() + 60 * 60 * 1000);
                return true;
            }
        } catch (_) {
            // Fallback to in-memory cache if DB table/query is mocked in unit tests
        }
    }

    return false;
}

const SENSITIVE_AUDIT_KEYS = new Set([
    'password',
    'password_hash',
    'confirm_password',
    'currentpassword',
    'newpassword',
    'confirmpassword',
    'otp',
    'otpcode',
    'token',
    'token_hash',
    'resubmittoken'
]);

function sanitizeAuditDetails(details) {
    if (!details || typeof details !== 'object') return details;
    if (Array.isArray(details)) return details.map(sanitizeAuditDetails);
    const cleaned = {};
    for (const [k, v] of Object.entries(details)) {
        if (SENSITIVE_AUDIT_KEYS.has(String(k).toLowerCase())) continue;
        cleaned[k] = typeof v === 'object' && v !== null ? sanitizeAuditDetails(v) : v;
    }
    return cleaned;
}

/**
 * Extract Bearer token strictly from Authorization header (never trusting query/body IDs).
 */
function extractBearerToken(req, allowQueryToken = false) {
    const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    if (allowQueryToken && req?.query?.token && typeof req.query.token === 'string') {
        return req.query.token.trim();
    }
    return null;
}

/**
 * Verify JWT token from Authorization header.
 * Enforces:
 * - Signature & expiration validity
 * - Token scope isolation (rejects single-purpose tokens like cor_id_resubmit)
 * - Logout revocation check
 * - Authoritative database user lookup
 * - Active account_status ('Active') & email verification check
 * - Token version check (invalidates tokens on suspension, role change, or password reset)
 */
async function authenticateUser(req, res, options = {}) {
    const db = options.db || pool;
    const token = extractBearerToken(req, Boolean(options.allowQueryToken));

    if (!token) {
        res.status(401).json({ message: 'Authentication required. Please log in.' });
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.purpose) {
            res.status(401).json({ message: 'Invalid token scope.' });
            return null;
        }
        const userId = Number(decoded.userId ?? decoded.id ?? decoded.user_id);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            res.status(401).json({ message: 'Invalid token user ID.' });
            return null;
        }

        if (await isTokenRevoked(token, db)) {
            res.status(401).json({ code: 'TOKEN_REVOKED', message: 'Session has been logged out. Please log in again.', expired: true });
            return null;
        }

        const result = await db.query(
            `SELECT u.user_id, u.first_name, u.middle_initial, u.last_name, u.email,
                    u.role_id, u.account_status, u.is_email_verified, u.token_version,
                    r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
            [userId]
        );

        if (!result?.rows || result.rows.length === 0) {
            res.status(401).json({ message: 'User not found in database.' });
            return null;
        }

        const user = result.rows[0];

        // Check token version if present on both token and DB row
        if (
            decoded.tokenVersion !== undefined &&
            user.token_version !== undefined &&
            Number(decoded.tokenVersion) !== Number(user.token_version)
        ) {
            res.status(401).json({ code: 'TOKEN_VERSION_MISMATCH', message: 'Session invalidated due to security update. Please log in again.', expired: true });
            return null;
        }

        // Enforce email verification
        if (user.is_email_verified === false) {
            await logAudit(req, {
                action: 'Blocked API Access (Unverified Email)',
                module: 'auth',
                actorUserId: user.user_id,
                actorRole: user.role_name,
                targetType: 'user',
                targetId: user.user_id,
                outcome: 'FAILURE',
                isSecurityEvent: true,
                details: { path: req?.originalUrl, method: req?.method }
            }, db);
            res.status(403).json({
                code: 'EMAIL_UNVERIFIED',
                message: 'Please verify your email address before accessing protected resources.',
                requiresEmailConfirmation: true
            });
            return null;
        }

        // Enforce active account status (reject Suspended, Archived, Pending)
        const normalizedStatus = String(user.account_status || 'Active').trim().toLowerCase();
        if (normalizedStatus !== 'active') {
            await logAudit(req, {
                action: `Blocked API Access (Account ${user.account_status})`,
                module: 'auth',
                actorUserId: user.user_id,
                actorRole: user.role_name,
                targetType: 'user',
                targetId: user.user_id,
                outcome: 'FAILURE',
                isSecurityEvent: true,
                details: { path: req?.originalUrl, method: req?.method, account_status: user.account_status }
            }, db);
            res.status(403).json({
                code: 'ACCOUNT_INACTIVE',
                message: `Your account is currently ${user.account_status}. Access denied.`,
                accountStatus: user.account_status
            });
            return null;
        }

        req.authToken = token;
        req.user = {
            id: user.user_id,
            user_id: user.user_id,
            userId: user.user_id,
            role_id: user.role_id,
            roleId: user.role_id,
            role: user.role_name,
            role_name: user.role_name,
            first_name: user.first_name,
            middle_initial: user.middle_initial,
            last_name: user.last_name,
            email: user.email,
            account_status: user.account_status,
            is_email_verified: user.is_email_verified ?? true,
            token_version: user.token_version ?? 1
        };

        return req.user;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({ message: 'Session expired. Please log in again.', expired: true });
        } else {
            res.status(401).json({ message: 'Invalid or expired token.' });
        }
        return null;
    }
}

/**
 * Safely resolve authenticated user (or user_id) from Bearer JWT for public/optional-auth endpoints.
 * NEVER trusts student_id, staff_id, or user_id from req.query or req.body.
 */
async function optionalAuthenticateUser(req, options = {}) {
    const db = options.db || pool;
    const token = extractBearerToken(req, false);
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.purpose) return null;

        const userId = Number(decoded.userId ?? decoded.id ?? decoded.user_id);
        if (!Number.isSafeInteger(userId) || userId <= 0) return null;

        if (await isTokenRevoked(token, db)) return null;

        const result = await db.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.role_id, u.account_status, u.is_email_verified, u.token_version,
                    r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
            [userId]
        );
        if (!result?.rows || result.rows.length === 0) return null;

        const user = result.rows[0];
        if (user.is_email_verified === false) return null;
        if (String(user.account_status || 'Active').trim().toLowerCase() !== 'active') return null;
        if (
            decoded.tokenVersion !== undefined &&
            user.token_version !== undefined &&
            Number(decoded.tokenVersion) !== Number(user.token_version)
        ) {
            return null;
        }

        req.user = {
            id: user.user_id,
            user_id: user.user_id,
            userId: user.user_id,
            role_id: user.role_id,
            roleId: user.role_id,
            role: user.role_name,
            role_name: user.role_name,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            account_status: user.account_status
        };
        return req.user;
    } catch (_) {
        return null;
    }
}

/**
 * Express middleware wrapper for authenticateUser
 */
async function authenticateToken(req, res, next) {
    const user = await authenticateUser(req, res);
    if (!user) return;
    next();
}

/**
 * Express middleware requiring Admin role
 */
async function requireAdmin(req, res, next) {
    const user = await authenticateUser(req, res);
    if (!user) return;

    if (String(user.role_name || '').toLowerCase() !== 'admin') {
        await logAudit(req, {
            action: 'Unauthorized Admin API Access Attempt',
            module: 'auth',
            actorUserId: user.user_id,
            actorRole: user.role_name,
            outcome: 'FAILURE',
            isSecurityEvent: true,
            details: { path: req.originalUrl, method: req.method, requiredRole: 'admin' }
        });
        return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    next();
}

/**
 * Helper to authenticate and verify Staff or Admin privileges.
 */
async function assertStaffOrAdmin(req, res, options = {}) {
    const user = await authenticateUser(req, res, options);
    if (!user) return null;

    const roleName = String(user.role_name || '').toLowerCase();
    if (roleName !== 'staff' && roleName !== 'admin') {
        await logAudit(req, {
            action: 'Unauthorized Staff API Access Attempt',
            module: 'auth',
            actorUserId: user.user_id,
            actorRole: user.role_name,
            outcome: 'FAILURE',
            isSecurityEvent: true,
            details: { path: req.originalUrl, method: req.method, requiredRole: 'staff_or_admin' }
        }, options.db || pool);
        res.status(403).json({ message: 'Access denied. Staff or Administrator privileges required.' });
        return null;
    }
    return user;
}

/**
 * Express middleware requiring Staff or Admin role
 */
async function requireStaffOrAdmin(req, res, next) {
    const user = await assertStaffOrAdmin(req, res);
    if (!user) return;
    next();
}

/**
 * Express middleware factory requiring one of the specified roles
 */
function requireRole(...allowedRoles) {
    const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase());
    return async function roleMiddleware(req, res, next) {
        const user = await authenticateUser(req, res);
        if (!user) return;

        const userRole = String(user.role_name || '').toLowerCase();
        if (!normalizedAllowed.includes(userRole)) {
            await logAudit(req, {
                action: 'Unauthorized Role API Access Attempt',
                module: 'auth',
                actorUserId: user.user_id,
                actorRole: user.role_name,
                outcome: 'FAILURE',
                isSecurityEvent: true,
                details: { path: req.originalUrl, method: req.method, allowedRoles: normalizedAllowed }
            });
            return res.status(403).json({ message: 'Access denied. Insufficient role permissions.' });
        }
        next();
    };
}

/**
 * Verify whether an authenticated user (Admin or assigned Staff) has permission to manage a specific pageId.
 */
async function canManagePage(db, user, pageId) {
    if (!user || !pageId || !Number.isInteger(Number(pageId)) || Number(pageId) <= 0) {
        return false;
    }
    const roleName = String(user.role_name || user.role || '').toLowerCase();
    if (roleName === 'admin' || Number(user.role_id) === 1) {
        return true;
    }
    if (roleName !== 'staff' && Number(user.role_id) !== 2) {
        return false;
    }

    const check = await (db || pool).query(
        `SELECT p.page_id
         FROM pages p
         LEFT JOIN page_members pm
           ON p.page_id = pm.page_id
          AND pm.user_id = $2
          AND LOWER(pm.status) = 'active'
         WHERE p.page_id = $1
           AND (p.created_by = $2 OR pm.user_id = $2)
         LIMIT 1`,
        [Number(pageId), Number(user.user_id)]
    );
    return check.rows.length > 0;
}

/**
 * Non-blocking helper to record actions in audit_logs (automatically sanitizes sensitive fields)
 */
async function logAudit(req, {
    action,
    module,
    targetType = null,
    targetId = null,
    outcome = 'SUCCESS',
    isSecurityEvent = false,
    details = null,
    actorUserId = null,
    actorRole = null
}, db = pool) {
    try {
        const uid = actorUserId ?? req?.user?.user_id ?? null;
        const role = actorRole ?? req?.user?.role_name ?? null;
        const ip = req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';
        const safeDetails = details ? sanitizeAuditDetails(details) : null;

        await (db || pool).query(
            `INSERT INTO audit_logs
             (actor_user_id, actor_role, action, module, target_type, target_id, outcome, is_security_event, ip_address, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                uid,
                role,
                action,
                module,
                targetType,
                targetId !== null && targetId !== undefined ? String(targetId) : null,
                String(outcome).toUpperCase() === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
                Boolean(isSecurityEvent),
                ip,
                safeDetails ? JSON.stringify(safeDetails) : null
            ]
        );
    } catch (err) {
        console.error('Audit log insert warning:', err.message);
    }
}

module.exports = {
    JWT_SECRET,
    authenticateUser,
    optionalAuthenticateUser,
    authenticateToken,
    requireAdmin,
    assertStaffOrAdmin,
    requireStaffOrAdmin,
    requireRole,
    canManagePage,
    revokeToken,
    isTokenRevoked,
    sanitizeAuditDetails,
    logAudit
};
