const crypto = require('crypto');

const DEFAULT_CAMPUS_GEOFENCE = Object.freeze({
    enabled: true,
    campusName: 'WMSU Main Campus',
    lat: 6.9135,
    lng: 122.0615,
    radiusMeters: 450,
});

const EARTH_RADIUS_METERS = 6371000;

let schemaPromise = null;

/**
 * Idempotently ensure static QR and scheduled-window columns exist on event_attendance_sessions.
 */
function ensureAttendanceSchema(pool) {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            await pool.query(`
                ALTER TABLE event_attendance_sessions
                    ADD COLUMN IF NOT EXISTS qr_token VARCHAR(128),
                    ADD COLUMN IF NOT EXISTS qr_token_created_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS scheduled_open_time TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS scheduled_close_time TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS closed_manually_at TIMESTAMPTZ;

                CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendance_sessions_qr_token
                    ON event_attendance_sessions (qr_token)
                    WHERE qr_token IS NOT NULL;
            `);
        })().catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    return schemaPromise;
}

function parseBooleanFlag(rawValue, fallback) {
    if (rawValue === undefined || rawValue === null) return fallback;
    const normalized = String(rawValue).trim().toLowerCase();
    if (!normalized) return fallback;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    return fallback;
}

function parseNumericInput(rawValue) {
    if (typeof rawValue !== 'number' && typeof rawValue !== 'string') return null;
    if (typeof rawValue === 'string' && rawValue.trim() === '') return null;
    const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue.trim());
    return Number.isFinite(parsed) ? parsed : null;
}

function parseFiniteNumber(rawValue, fallback, { min = -Infinity, max = Infinity, exclusiveMin = false } = {}) {
    const parsed = parseNumericInput(rawValue);
    if (parsed === null) return fallback;
    if (exclusiveMin ? parsed <= min : parsed < min) return fallback;
    if (parsed > max) return fallback;
    return parsed;
}

function parseStrictCoordinate(rawValue, min, max) {
    const parsed = parseNumericInput(rawValue);
    if (parsed === null || parsed < min || parsed > max) return null;
    return parsed;
}

/**
 * Resolve WMSU campus geofence settings from environment variables with safe defaults.
 */
function getCampusGeofenceConfig(env = process.env) {
    const source = env || {};
    const rawName = typeof source.CAMPUS_GEOFENCE_NAME === 'string' ? source.CAMPUS_GEOFENCE_NAME.trim() : '';

    return {
        enabled: parseBooleanFlag(source.CAMPUS_GEOFENCE_ENABLED, DEFAULT_CAMPUS_GEOFENCE.enabled),
        campusName: rawName || DEFAULT_CAMPUS_GEOFENCE.campusName,
        lat: parseFiniteNumber(source.CAMPUS_GEOFENCE_LAT, DEFAULT_CAMPUS_GEOFENCE.lat, { min: -90, max: 90 }),
        lng: parseFiniteNumber(source.CAMPUS_GEOFENCE_LNG, DEFAULT_CAMPUS_GEOFENCE.lng, { min: -180, max: 180 }),
        radiusMeters: parseFiniteNumber(source.CAMPUS_GEOFENCE_RADIUS_METERS, DEFAULT_CAMPUS_GEOFENCE.radiusMeters, {
            min: 0,
            exclusiveMin: true,
        }),
    };
}

function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

/**
 * Compute rounded great-circle distance in meters using the Haversine formula.
 */
function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    const clampedA = Math.min(1, Math.max(0, a));
    const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
    return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Check whether submitted coordinates fall inside the configured campus geofence.
 */
function evaluateCampusGeofence(coords, config = getCampusGeofenceConfig()) {
    const resolvedConfig = config || getCampusGeofenceConfig();

    if (!resolvedConfig.enabled) {
        return {
            allowed: true,
            distanceMeters: null,
            radiusMeters: resolvedConfig.radiusMeters,
            campusName: resolvedConfig.campusName,
            reason: 'DISABLED',
        };
    }

    const input = coords && typeof coords === 'object' ? coords : {};
    const lat = parseStrictCoordinate(input.latitude, -90, 90);
    const lng = parseStrictCoordinate(input.longitude, -180, 180);

    if (lat === null || lng === null) {
        return {
            allowed: false,
            distanceMeters: null,
            radiusMeters: resolvedConfig.radiusMeters,
            campusName: resolvedConfig.campusName,
            reason: 'INVALID_COORDINATES',
        };
    }

    const distanceMeters = calculateDistanceMeters(lat, lng, resolvedConfig.lat, resolvedConfig.lng);
    const inside = distanceMeters <= resolvedConfig.radiusMeters;

    return {
        allowed: inside,
        distanceMeters,
        radiusMeters: resolvedConfig.radiusMeters,
        campusName: resolvedConfig.campusName,
        reason: inside ? 'INSIDE' : 'OUTSIDE',
    };
}

function toDateOrNull(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoOrNull(date) {
    return date ? date.toISOString() : null;
}

/**
 * Derive effective session state and auto-open/auto-close transition flags.
 */
function evaluateAttendanceSession(sessionRow, now = new Date()) {
    if (!sessionRow) {
        return {
            effectiveStatus: 'CLOSED',
            isActive: false,
            openTime: null,
            closeTime: null,
            scheduledOpenTime: null,
            scheduledCloseTime: null,
            shouldAutoClose: false,
            shouldAutoOpen: false,
        };
    }

    const nowDate = toDateOrNull(now) || new Date();
    const nowMs = nowDate.getTime();

    const dbStatus = String(sessionRow.status || 'CLOSED').trim().toUpperCase();
    const openTime = toDateOrNull(sessionRow.open_time ?? sessionRow.openTime);
    const closeTime = toDateOrNull(sessionRow.close_time ?? sessionRow.closeTime);
    const scheduledOpenTime = toDateOrNull(sessionRow.scheduled_open_time ?? sessionRow.scheduledOpenTime);
    const scheduledCloseTime = toDateOrNull(sessionRow.scheduled_close_time ?? sessionRow.scheduledCloseTime);
    const closedManuallyAt = toDateOrNull(sessionRow.closed_manually_at ?? sessionRow.closedManuallyAt);

    let effectiveStatus = 'CLOSED';
    let isActive = false;
    let shouldAutoClose = false;
    let shouldAutoOpen = false;

    if (dbStatus === 'OPEN') {
        if (scheduledCloseTime && scheduledCloseTime.getTime() <= nowMs) {
            effectiveStatus = 'CLOSED';
            isActive = false;
            shouldAutoClose = true;
        } else {
            effectiveStatus = 'ACTIVE';
            isActive = true;
        }
    } else if (
        scheduledOpenTime &&
        scheduledCloseTime &&
        scheduledCloseTime.getTime() > scheduledOpenTime.getTime()
    ) {
        const schedOpenMs = scheduledOpenTime.getTime();
        const schedCloseMs = scheduledCloseTime.getTime();

        if (nowMs < schedOpenMs) {
            effectiveStatus = 'SCHEDULED';
            isActive = false;
        } else if (nowMs < schedCloseMs) {
            const manuallyClosedThisWindow = Boolean(
                closedManuallyAt && closedManuallyAt.getTime() >= schedOpenMs
            );
            if (!manuallyClosedThisWindow) {
                effectiveStatus = 'ACTIVE';
                isActive = true;
                shouldAutoOpen = true;
            }
        }
    }

    return {
        effectiveStatus,
        isActive,
        openTime: toIsoOrNull(openTime),
        closeTime: toIsoOrNull(closeTime),
        scheduledOpenTime: toIsoOrNull(scheduledOpenTime),
        scheduledCloseTime: toIsoOrNull(scheduledCloseTime),
        shouldAutoClose,
        shouldAutoOpen,
    };
}

/**
 * Validate a scheduled attendance window ensuring close is strictly after open.
 */
function validateAttendanceSchedule(params) {
    const { scheduledOpenTime, scheduledCloseTime } = params && typeof params === 'object' ? params : {};

    if (!scheduledOpenTime || !scheduledCloseTime) {
        return {
            valid: false,
            error: 'Both scheduledOpenTime and scheduledCloseTime are required.',
        };
    }

    const openDate = toDateOrNull(scheduledOpenTime);
    const closeDate = toDateOrNull(scheduledCloseTime);

    if (!openDate || !closeDate) {
        return {
            valid: false,
            error: 'Invalid schedule date format.',
        };
    }

    if (closeDate.getTime() <= openDate.getTime()) {
        return {
            valid: false,
            error: 'Scheduled close time must be after scheduled open time.',
        };
    }

    return {
        valid: true,
        openDate,
        closeDate,
    };
}

/**
 * Generate a 64-character hex token for static event attendance QR codes.
 */
function generateStaticQrToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Encode a static QR token in the strict CRIMSON-ATT:<token> in-app format.
 */
function buildAttendanceQrPayload(token) {
    const trimmed = String(token || '').trim();
    if (!trimmed) {
        throw new Error('QR token is required.');
    }
    return `CRIMSON-ATT:${trimmed}`;
}

/**
 * Extract an attendance QR token from CRIMSON-ATT:<tok>, legacy check-in URLs, or raw input.
 */
function extractAttendanceQrToken(rawValue) {
    if (typeof rawValue !== 'string') return '';
    const trimmed = rawValue.trim();
    if (!trimmed) return '';

    const prefixedMatch = trimmed.match(/^CRIMSON-ATT:(.*)$/i);
    if (prefixedMatch) {
        return prefixedMatch[1].trim();
    }

    const legacyUrlMatch = trimmed.match(/\/attendance\/check-in\/([^/?#]+)/i);
    if (legacyUrlMatch) {
        try {
            return decodeURIComponent(legacyUrlMatch[1]).trim();
        } catch {
            return legacyUrlMatch[1].trim();
        }
    }

    return trimmed;
}

/**
 * Map a /users/my-events SQL row to include normalized registration, session window, and user attendance metadata.
 */
function mapMyEventRowWithAttendance(row, now = new Date()) {
    const source = row && typeof row === 'object' ? row : {};
    const {
        session_status,
        session_open_time,
        session_close_time,
        session_scheduled_open_time,
        session_scheduled_close_time,
        session_closed_manually_at,
        ...rest
    } = source;

    const hasSession = Boolean(
        session_status ||
        session_open_time ||
        session_close_time ||
        session_scheduled_open_time ||
        session_scheduled_close_time ||
        session_closed_manually_at
    );

    const evaluated = evaluateAttendanceSession(
        hasSession
            ? {
                  status: session_status,
                  open_time: session_open_time,
                  close_time: session_close_time,
                  scheduled_open_time: session_scheduled_open_time,
                  scheduled_close_time: session_scheduled_close_time,
                  closed_manually_at: session_closed_manually_at,
              }
            : null,
        now
    );

    return {
        ...rest,
        date: rest.date || rest.event_date || null,
        is_registered: ['registered', 'attended'].includes(
            String(rest.registration_status || '').trim().toLowerCase()
        ),
        attendance_status: evaluated.effectiveStatus,
        attendance_open_time: evaluated.scheduledOpenTime || evaluated.openTime || null,
        attendance_close_time: evaluated.scheduledCloseTime || evaluated.closeTime || null,
        user_attendance_status: rest.user_attendance_status || null,
        user_checkin_time: rest.user_checkin_time || null,
    };
}

module.exports = {
    DEFAULT_CAMPUS_GEOFENCE,
    ensureAttendanceSchema,
    getCampusGeofenceConfig,
    calculateDistanceMeters,
    evaluateCampusGeofence,
    evaluateAttendanceSession,
    validateAttendanceSchedule,
    generateStaticQrToken,
    buildAttendanceQrPayload,
    extractAttendanceQrToken,
    mapMyEventRowWithAttendance,
};
