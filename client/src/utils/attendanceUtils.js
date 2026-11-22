const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_CAMPUS_GEOFENCE = Object.freeze({
  enabled: true,
  campusName: 'WMSU Main Campus',
  lat: 6.9135,
  lng: 122.0615,
  radiusMeters: 450,
});

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function parseStrictCoordinate(rawValue, min, max) {
  if (typeof rawValue !== 'number' && typeof rawValue !== 'string') return null;
  if (typeof rawValue === 'string' && rawValue.trim() === '') return null;
  const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue.trim());
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function stripCrimsonPrefix(value) {
  const match = value.match(/^CRIMSON-ATT:(.*)$/i);
  return match ? match[1].trim() : value;
}

/**
 * Extract an attendance QR token from CRIMSON-ATT:<token>, legacy check-in URLs,
 * query-parameter URLs (?token= / ?data=), or raw token strings.
 */
export function extractAttendanceToken(rawValue) {
  if (typeof rawValue !== 'string') return '';
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  if (/^CRIMSON-ATT:/i.test(trimmed)) {
    return stripCrimsonPrefix(trimmed);
  }

  const legacyUrlMatch = trimmed.match(/\/attendance\/check-in\/([^/?#]+)/i);
  if (legacyUrlMatch) {
    let decoded = legacyUrlMatch[1];
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Keep raw segment if percent-encoding is malformed
    }
    return stripCrimsonPrefix(decoded.trim());
  }

  if (/[?&](?:token|data)=/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed, 'https://crimson.local');
      const paramValue = parsed.searchParams.get('token') ?? parsed.searchParams.get('data');
      if (paramValue && paramValue.trim()) {
        return stripCrimsonPrefix(paramValue.trim());
      }
    } catch {
      const queryMatch = trimmed.match(/[?&](?:token|data)=([^&#]+)/i);
      if (queryMatch) {
        let decoded = queryMatch[1];
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          // Keep raw param if percent-encoding is malformed
        }
        return stripCrimsonPrefix(decoded.trim());
      }
    }
  }

  return trimmed;
}

/**
 * Compute great-circle distance in rounded meters between two coordinates using Haversine.
 */
export function calculateClientDistanceMeters(lat1, lng1, lat2, lng2) {
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
 * Evaluate client coordinates against the campus geofence configuration.
 */
export function evaluateClientGeofence(coords, config = DEFAULT_CAMPUS_GEOFENCE) {
  const resolved = {
    enabled: config?.enabled ?? DEFAULT_CAMPUS_GEOFENCE.enabled,
    campusName:
      typeof config?.campusName === 'string' && config.campusName.trim()
        ? config.campusName.trim()
        : DEFAULT_CAMPUS_GEOFENCE.campusName,
    lat: parseStrictCoordinate(config?.lat, -90, 90) ?? DEFAULT_CAMPUS_GEOFENCE.lat,
    lng: parseStrictCoordinate(config?.lng, -180, 180) ?? DEFAULT_CAMPUS_GEOFENCE.lng,
    radiusMeters:
      typeof config?.radiusMeters === 'number' && Number.isFinite(config.radiusMeters) && config.radiusMeters > 0
        ? config.radiusMeters
        : DEFAULT_CAMPUS_GEOFENCE.radiusMeters,
  };

  if (!resolved.enabled) {
    return {
      allowed: true,
      distanceMeters: null,
      radiusMeters: resolved.radiusMeters,
      campusName: resolved.campusName,
      reason: 'DISABLED',
    };
  }

  const input = coords && typeof coords === 'object' ? coords : {};
  const latitude = parseStrictCoordinate(input.latitude, -90, 90);
  const longitude = parseStrictCoordinate(input.longitude, -180, 180);

  if (latitude === null || longitude === null) {
    return {
      allowed: false,
      distanceMeters: null,
      radiusMeters: resolved.radiusMeters,
      campusName: resolved.campusName,
      reason: 'INVALID_COORDINATES',
    };
  }

  const distanceMeters = calculateClientDistanceMeters(latitude, longitude, resolved.lat, resolved.lng);
  const inside = distanceMeters <= resolved.radiusMeters;

  return {
    allowed: inside,
    distanceMeters,
    radiusMeters: resolved.radiusMeters,
    campusName: resolved.campusName,
    reason: inside ? 'INSIDE' : 'OUTSIDE',
  };
}

/**
 * Derive student-facing attendance action button visibility, mode, label, and tooltip.
 */
export function getAttendanceButtonState({
  attendanceStatus,
  attendanceOpenTime,
  userAttendanceStatus,
  registrationStatus,
} = {}) {
  const normReg = String(registrationStatus || '').trim().toLowerCase();
  if (normReg !== 'registered' && normReg !== 'attended') {
    return {
      visible: false,
      mode: 'CLOSED',
      clickable: false,
      label: '',
      tooltip: '',
    };
  }

  const normUserStatus = String(userAttendanceStatus || '').trim().toUpperCase();
  if (normUserStatus === 'PRESENT' || normReg === 'attended') {
    return {
      visible: true,
      mode: 'PRESENT',
      clickable: false,
      label: 'Present',
      tooltip: 'Attendance recorded',
    };
  }

  const normSessionStatus = String(attendanceStatus || '').trim().toUpperCase();
  if (normSessionStatus === 'ACTIVE') {
    return {
      visible: true,
      mode: 'ACTIVE',
      clickable: true,
      label: 'Attendance',
      tooltip: 'Open campus QR scanner to record attendance',
    };
  }

  if (normSessionStatus === 'SCHEDULED') {
    const openDate = attendanceOpenTime ? new Date(attendanceOpenTime) : null;
    const formattedTime =
      openDate && !Number.isNaN(openDate.getTime())
        ? openDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';

    return {
      visible: true,
      mode: 'SCHEDULED',
      clickable: false,
      label: formattedTime ? `Attendance · Opens ${formattedTime}` : 'Attendance · Scheduled',
      tooltip: 'Attendance has not started yet',
    };
  }

  return {
    visible: true,
    mode: 'CLOSED',
    clickable: false,
    label: 'Attendance Closed',
    tooltip: 'Attendance has not been started or is closed',
  };
}

/**
 * Format a Date or ISO timestamp into local YYYY-MM-DDTHH:mm for <input type="datetime-local">.
 */
export function toLocalDateTimeInputValue(isoString) {
  if (!isoString || typeof isoString === 'boolean') return '';
  const date = isoString instanceof Date ? isoString : new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
