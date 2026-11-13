const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Verify JWT token from Authorization header or ?token= query param.
 * Returns user object if valid, or sends HTTP error and returns null.
 */
async function authenticateUser(req, res) {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

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

        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.middle_initial, u.last_name, u.email,
                    u.role_id, u.account_status, r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ message: 'User not found in database.' });
            return null;
        }

        const user = result.rows[0];
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

    if (String(user.role_name).toLowerCase() !== 'admin' && Number(user.role_id) !== 1) {
        return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    next();
}

/**
 * Non-blocking helper to record actions in audit_logs
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
}) {
    try {
        const uid = actorUserId ?? req?.user?.user_id ?? null;
        const role = actorRole ?? req?.user?.role_name ?? null;
        const ip = req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';

        await pool.query(
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
                details ? JSON.stringify(details) : null
            ]
        );
    } catch (err) {
        console.error('Audit log insert warning:', err.message);
    }
}

module.exports = {
    authenticateUser,
    authenticateToken,
    requireAdmin,
    logAudit
};
