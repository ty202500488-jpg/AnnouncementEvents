const jwt = require('jsonwebtoken');
const pool = require('../db');

// Must match the secret used by jwt.sign() in Routes/userRoutes.js
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

if (!process.env.JWT_SECRET) {
    console.warn('[auth] WARNING: JWT_SECRET is not set. Using an insecure fallback secret.');
}

// =====================================================
// authenticateToken
// Verifies the login token and loads the user.
// On success sets req.user = { id, roleId, role, studentId }.
//
// The token is read from the "Authorization: Bearer <token>" header.
// A "?token=" query parameter is also accepted so that plain links
// (e.g. window.open() for CSV downloads) can be authenticated.
// =====================================================
const authenticateToken = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } else if (typeof req.query?.token === 'string') {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.', expired: true });
        }
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const userId = Number(decoded.userId ?? decoded.id ?? decoded.user_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({ message: 'Invalid token.' });
    }

    try {
        const result = await pool.query(
            `SELECT u.user_id, u.student_id, u.role_id, u.status, r.role_name
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id = $1`,
            [userId]
        );

        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }
        if (user.status?.toLowerCase() !== 'active') {
            return res.status(403).json({ message: 'Your account is not active.' });
        }

        req.user = {
            id: user.user_id,
            roleId: user.role_id,
            role: user.role_name,
            studentId: user.student_id
        };
        return next();
    } catch (err) {
        console.error('[auth] Failed to load user:', err);
        return res.status(500).json({ message: 'Internal server error during authentication.' });
    }
};

// =====================================================
// Page ownership helpers
// A user "owns" a Page if they created it and it is approved.
// =====================================================
async function getOwnedPageIds(userId) {
    const result = await pool.query(
        `SELECT page_id FROM pages WHERE created_by = $1 AND LOWER(status) = 'approved'`,
        [userId]
    );
    return result.rows.map((r) => r.page_id);
}

// Returns true if the user owns the Page that the event belongs to.
async function ownsEvent(userId, eventId) {
    const result = await pool.query(
        `SELECT 1
         FROM events e
         JOIN pages p ON e.page_id = p.page_id
         WHERE e.event_id = $1 AND p.created_by = $2 AND LOWER(p.status) = 'approved'`,
        [eventId, userId]
    );
    return result.rows.length > 0;
}

// =====================================================
// requireEventOwner
// Use after authenticateToken on routes with an :eventId param.
// Only lets the request through if the user owns the event's Page.
// Sets req.eventId (as a number).
// =====================================================
const requireEventOwner = async (req, res, next) => {
    const eventId = Number(req.params.eventId);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ message: 'Invalid event ID.' });
    }

    try {
        if (!(await ownsEvent(req.user.id, eventId))) {
            return res.status(403).json({ message: 'Access denied: you do not manage this event.' });
        }
        req.eventId = eventId;
        return next();
    } catch (err) {
        console.error('[auth] Event ownership check failed:', err);
        return res.status(500).json({ message: 'Internal server error during authorization.' });
    }
};

module.exports = {
    authenticateToken,
    requireEventOwner,
    getOwnedPageIds,
    ownsEvent
};
