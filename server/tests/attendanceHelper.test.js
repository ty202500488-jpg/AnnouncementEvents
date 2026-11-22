const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ensureAttendanceSchema,
    getCampusGeofenceConfig,
    calculateDistanceMeters,
    evaluateCampusGeofence,
    evaluateAttendanceSession,
    validateAttendanceSchedule,
    generateStaticQrToken,
    buildAttendanceQrPayload,
    extractAttendanceQrToken,
} = require('../utils/attendanceHelper');

test('getCampusGeofenceConfig returns WMSU defaults and respects env overrides', () => {
    const defaults = getCampusGeofenceConfig({});
    assert.deepEqual(defaults, {
        enabled: true,
        campusName: 'WMSU Main Campus',
        lat: 6.9135,
        lng: 122.0615,
        radiusMeters: 450,
    });

    const overridden = getCampusGeofenceConfig({
        CAMPUS_GEOFENCE_ENABLED: 'false',
        CAMPUS_GEOFENCE_NAME: 'WMSU Test Campus',
        CAMPUS_GEOFENCE_LAT: '6.9200',
        CAMPUS_GEOFENCE_LNG: '122.0700',
        CAMPUS_GEOFENCE_RADIUS_METERS: '300',
    });
    assert.deepEqual(overridden, {
        enabled: false,
        campusName: 'WMSU Test Campus',
        lat: 6.92,
        lng: 122.07,
        radiusMeters: 300,
    });
});

test('calculateDistanceMeters returns 0 for identical coordinates, handles antipodal clamping, and computes accurate Haversine meters', () => {
    assert.equal(calculateDistanceMeters(6.9135, 122.0615, 6.9135, 122.0615), 0);

    // ~116m from WMSU Main Campus center
    const distance = calculateDistanceMeters(6.9135, 122.0615, 6.9145, 122.0618);
    assert.equal(distance, 116);

    // Antipodal coordinates should not produce NaN (clamps `a` into [0, 1])
    const antipodal = calculateDistanceMeters(0, 0, 0, 180);
    assert.equal(Number.isFinite(antipodal), true);
    assert.ok(antipodal > 20000000);
});

test('evaluateCampusGeofence allows inside, blocks outside/invalid, and respects disabled mode', () => {
    const config = getCampusGeofenceConfig({});

    const inside = evaluateCampusGeofence({ latitude: 6.9145, longitude: 122.0618 }, config);
    assert.equal(inside.allowed, true);
    assert.equal(inside.reason, 'INSIDE');
    assert.equal(inside.distanceMeters, 116);
    assert.equal(inside.radiusMeters, 450);
    assert.equal(inside.campusName, 'WMSU Main Campus');

    const outside = evaluateCampusGeofence({ latitude: 6.9300, longitude: 122.0800 }, config);
    assert.equal(outside.allowed, false);
    assert.equal(outside.reason, 'OUTSIDE');
    assert.ok(outside.distanceMeters > 450);

    const invalidCases = [
        { latitude: null, longitude: 122.0615 },
        { latitude: '', longitude: 122.0615 },
        { latitude: 6.9135, longitude: '' },
        { latitude: [], longitude: 122.0615 },
        { latitude: 6.9135, longitude: {} },
        { latitude: NaN, longitude: 122.0615 },
        { latitude: 95, longitude: 122.0615 },
        { latitude: 6.9135, longitude: -200 },
        null,
    ];
    for (const coords of invalidCases) {
        const result = evaluateCampusGeofence(coords, config);
        assert.equal(result.allowed, false);
        assert.equal(result.reason, 'INVALID_COORDINATES');
        assert.equal(result.distanceMeters, null);
    }

    const disabledConfig = getCampusGeofenceConfig({ CAMPUS_GEOFENCE_ENABLED: 'false' });
    const disabledResult = evaluateCampusGeofence({ latitude: 6.9300, longitude: 122.0800 }, disabledConfig);
    assert.equal(disabledResult.allowed, true);
    assert.equal(disabledResult.reason, 'DISABLED');
    assert.equal(disabledResult.distanceMeters, null);
});

test('evaluateAttendanceSession evaluates null, manual OPEN, SCHEDULED, auto-open, manual-close override, and auto-close', () => {
    const now = new Date('2026-11-22T10:00:00.000Z');

    const empty = evaluateAttendanceSession(null, now);
    assert.deepEqual(empty, {
        effectiveStatus: 'CLOSED',
        isActive: false,
        openTime: null,
        closeTime: null,
        scheduledOpenTime: null,
        scheduledCloseTime: null,
        shouldAutoClose: false,
        shouldAutoOpen: false,
    });

    const manualOpen = evaluateAttendanceSession(
        {
            status: 'OPEN',
            open_time: '2026-11-22T09:00:00.000Z',
            close_time: null,
            scheduled_open_time: null,
            scheduled_close_time: null,
        },
        now
    );
    assert.equal(manualOpen.effectiveStatus, 'ACTIVE');
    assert.equal(manualOpen.isActive, true);
    assert.equal(manualOpen.shouldAutoClose, false);
    assert.equal(manualOpen.shouldAutoOpen, false);

    const scheduledFuture = evaluateAttendanceSession(
        {
            status: 'CLOSED',
            scheduled_open_time: '2026-11-22T11:00:00.000Z',
            scheduled_close_time: '2026-11-22T12:00:00.000Z',
        },
        now
    );
    assert.equal(scheduledFuture.effectiveStatus, 'SCHEDULED');
    assert.equal(scheduledFuture.isActive, false);
    assert.equal(scheduledFuture.shouldAutoOpen, false);
    assert.equal(scheduledFuture.shouldAutoClose, false);

    const insideWindowAutoOpen = evaluateAttendanceSession(
        {
            status: 'CLOSED',
            scheduled_open_time: '2026-11-22T09:30:00.000Z',
            scheduled_close_time: '2026-11-22T11:30:00.000Z',
            closed_manually_at: null,
        },
        now
    );
    assert.equal(insideWindowAutoOpen.effectiveStatus, 'ACTIVE');
    assert.equal(insideWindowAutoOpen.isActive, true);
    assert.equal(insideWindowAutoOpen.shouldAutoOpen, true);
    assert.equal(insideWindowAutoOpen.shouldAutoClose, false);

    const insideWindowManualClose = evaluateAttendanceSession(
        {
            status: 'CLOSED',
            scheduled_open_time: '2026-11-22T09:30:00.000Z',
            scheduled_close_time: '2026-11-22T11:30:00.000Z',
            closed_manually_at: '2026-11-22T09:45:00.000Z',
        },
        now
    );
    assert.equal(insideWindowManualClose.effectiveStatus, 'CLOSED');
    assert.equal(insideWindowManualClose.isActive, false);
    assert.equal(insideWindowManualClose.shouldAutoOpen, false);
    assert.equal(insideWindowManualClose.shouldAutoClose, false);

    const openPastClose = evaluateAttendanceSession(
        {
            status: 'OPEN',
            open_time: '2026-11-22T08:00:00.000Z',
            scheduled_open_time: '2026-11-22T08:00:00.000Z',
            scheduled_close_time: '2026-11-22T10:00:00.000Z',
        },
        now
    );
    assert.equal(openPastClose.effectiveStatus, 'CLOSED');
    assert.equal(openPastClose.isActive, false);
    assert.equal(openPastClose.shouldAutoClose, true);
    assert.equal(openPastClose.shouldAutoOpen, false);
});

test('validateAttendanceSchedule accepts valid ISO range and rejects invalid ranges', () => {
    const valid = validateAttendanceSchedule({
        scheduledOpenTime: '2026-11-22T08:00:00.000Z',
        scheduledCloseTime: '2026-11-22T10:00:00.000Z',
    });
    assert.equal(valid.valid, true);
    assert.ok(valid.openDate instanceof Date);
    assert.ok(valid.closeDate instanceof Date);

    assert.equal(validateAttendanceSchedule({}).valid, false);
    assert.equal(
        validateAttendanceSchedule({
            scheduledOpenTime: 'not-a-date',
            scheduledCloseTime: '2026-11-22T10:00:00.000Z',
        }).valid,
        false
    );
    assert.equal(
        validateAttendanceSchedule({
            scheduledOpenTime: '2026-11-22T10:00:00.000Z',
            scheduledCloseTime: '2026-11-22T10:00:00.000Z',
        }).valid,
        false
    );
    assert.equal(
        validateAttendanceSchedule({
            scheduledOpenTime: '2026-11-22T12:00:00.000Z',
            scheduledCloseTime: '2026-11-22T10:00:00.000Z',
        }).valid,
        false
    );
});

test('QR token generation, payload encoding, and extraction work across formats', () => {
    const tok = generateStaticQrToken();
    assert.match(tok, /^[0-9a-f]{64}$/);

    const payload = buildAttendanceQrPayload(tok);
    assert.equal(payload, `CRIMSON-ATT:${tok}`);

    assert.equal(extractAttendanceQrToken(payload), tok);
    assert.equal(extractAttendanceQrToken(`  CRIMSON-ATT:${tok}  `), tok);
    assert.equal(
        extractAttendanceQrToken(`https://portal.wmsu.edu.ph/attendance/check-in/${tok}?src=qr`),
        tok
    );
    assert.equal(extractAttendanceQrToken(`/attendance/check-in/${tok}`), tok);
    assert.equal(extractAttendanceQrToken(`  ${tok}  `), tok);
    assert.equal(extractAttendanceQrToken('CRIMSON-ATT:'), '');
    assert.equal(extractAttendanceQrToken('CRIMSON-ATT:   '), '');
    assert.equal(extractAttendanceQrToken(''), '');
    assert.equal(extractAttendanceQrToken(null), '');
});

test('ensureAttendanceSchema executes idempotent migration SQL and caches promise', async () => {
    const queries = [];
    const fakePool = {
        query: async (sql) => {
            queries.push(sql);
            return { rows: [] };
        },
    };

    await ensureAttendanceSchema(fakePool);
    await ensureAttendanceSchema(fakePool);

    assert.equal(queries.length, 1);
    assert.match(queries[0], /ALTER TABLE event_attendance_sessions/i);
    assert.match(queries[0], /ADD COLUMN IF NOT EXISTS qr_token VARCHAR\(128\)/i);
    assert.match(queries[0], /ADD COLUMN IF NOT EXISTS qr_token_created_at TIMESTAMPTZ/i);
    assert.match(queries[0], /ADD COLUMN IF NOT EXISTS scheduled_open_time TIMESTAMPTZ/i);
    assert.match(queries[0], /ADD COLUMN IF NOT EXISTS scheduled_close_time TIMESTAMPTZ/i);
    assert.match(queries[0], /ADD COLUMN IF NOT EXISTS closed_manually_at TIMESTAMPTZ/i);
    assert.match(queries[0], /CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendance_sessions_qr_token/i);
});
