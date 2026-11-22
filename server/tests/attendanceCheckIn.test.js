const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db');
const attendanceRouter = require('../Routes/mypageAttendance');
const { processQrCheckIn } = attendanceRouter;

function createCheckInMockPool({
    sessions = [],
    registrations = [],
    records = [],
} = {}) {
    const state = {
        sessions: sessions.map((s) => ({ ...s })),
        registrations: registrations.map((r) => ({ ...r })),
        records: records.map((r) => ({ ...r })),
        audits: [],
        queries: [],
    };
    let nextAttendanceId = state.records.reduce((max, r) => Math.max(max, r.attendance_id || 0), 0) + 1;

    const mockPool = {
        state,
        async query(sql, params = []) {
            const text = String(sql).replace(/\s+/g, ' ').trim();
            state.queries.push({ text, params });

            if (/^ALTER TABLE event_attendance_sessions/i.test(text)) {
                return { rows: [], rowCount: 0 };
            }

            if (/FROM event_attendance_sessions/i.test(text) && /WHERE qr_token = \$1/i.test(text)) {
                const token = params[0];
                const match = state.sessions.find((s) => s.qr_token === token);
                return { rows: match ? [{ ...match }] : [], rowCount: match ? 1 : 0 };
            }

            if (/FROM event_registrations/i.test(text) && /registrant_user_id = \$2/i.test(text)) {
                const [eventId, userId] = params;
                const match = state.registrations.find(
                    (r) =>
                        Number(r.event_post_id) === Number(eventId) &&
                        Number(r.registrant_user_id) === Number(userId) &&
                        ['registered', 'attended'].includes(String(r.status || '').toLowerCase())
                );
                return {
                    rows: match ? [{ registration_id: match.registration_id, status: match.status }] : [],
                    rowCount: match ? 1 : 0,
                };
            }

            if (/FROM event_attendance_records/i.test(text) && /WHERE registration_id = \$1/i.test(text)) {
                const [regId] = params;
                const match = state.records.find((r) => Number(r.registration_id) === Number(regId));
                return { rows: match ? [{ ...match }] : [], rowCount: match ? 1 : 0 };
            }

            if (/^INSERT INTO event_attendance_records/i.test(text)) {
                const [regId] = params;
                const nowIso = new Date().toISOString();
                let existing = state.records.find((r) => Number(r.registration_id) === Number(regId));
                if (existing) {
                    const hasConditionalWhere = /WHERE event_attendance_records\.status <> 'PRESENT'/i.test(text);
                    if (
                        hasConditionalWhere &&
                        (existing.status === 'PRESENT' ||
                            (existing.check_in_method === 'manual_staff' &&
                                ['ABSENT', 'EXCUSED'].includes(String(existing.status || '').toUpperCase())))
                    ) {
                        return { rows: [], rowCount: 0 };
                    }
                    existing.status = 'PRESENT';
                    existing.checkin_time = nowIso;
                    existing.check_in_method = 'qr_scan';
                } else {
                    existing = {
                        attendance_id: nextAttendanceId++,
                        registration_id: regId,
                        status: 'PRESENT',
                        checkin_time: nowIso,
                        check_in_method: 'qr_scan',
                    };
                    state.records.push(existing);
                }
                return {
                    rows: [{ id: existing.attendance_id, status: existing.status, checkin_time: existing.checkin_time }],
                    rowCount: 1,
                };
            }

            if (/^UPDATE event_registrations SET status = 'Attended'/i.test(text)) {
                const [regId] = params;
                const reg = state.registrations.find((r) => Number(r.registration_id) === Number(regId));
                if (reg) {
                    reg.status = 'Attended';
                }
                return { rows: [], rowCount: reg ? 1 : 0 };
            }

            if (/^INSERT INTO event_attendance_audits/i.test(text)) {
                const [attendanceId, actorUserId, previousStatus] = params;
                state.audits.push({
                    attendance_id: attendanceId,
                    actor_user_id: actorUserId,
                    previous_status: previousStatus,
                    new_status: 'PRESENT',
                    source: 'student',
                    reason: 'QR Check-in',
                });
                return { rows: [], rowCount: 1 };
            }

            throw new Error(`Unhandled SQL in check-in mock: ${text}`);
        },
    };

    return mockPool;
}

const VALID_TOKEN = 'a'.repeat(64);
const WMSU_INSIDE = { latitude: 6.9145, longitude: 122.0618 }; // ~116m from WMSU Main Campus
const WMSU_OUTSIDE = { latitude: 6.9300, longitude: 122.0800 }; // >2km away
const WMSU_CONFIG = {
    enabled: true,
    campusName: 'WMSU Main Campus',
    lat: 6.9135,
    lng: 122.0615,
    radiusMeters: 450,
};

test.after(async () => {
    await pool.end().catch(() => {});
});

test('1. processQrCheckIn rejects empty, unknown, mismatched event, SCHEDULED, and CLOSED tokens', async () => {
    assert.equal(typeof processQrCheckIn, 'function');

    const now = new Date('2026-11-22T10:00:00.000Z');
    const mockDb = createCheckInMockPool({
        sessions: [
            {
                session_id: 1,
                event_post_id: 10,
                status: 'OPEN',
                qr_token: VALID_TOKEN,
            },
            {
                session_id: 2,
                event_post_id: 20,
                status: 'CLOSED',
                qr_token: 'b'.repeat(64),
                scheduled_open_time: '2026-11-22T11:00:00.000Z',
                scheduled_close_time: '2026-11-22T13:00:00.000Z',
            },
            {
                session_id: 3,
                event_post_id: 30,
                status: 'CLOSED',
                qr_token: 'c'.repeat(64),
            },
        ],
    });

    const emptyRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: '   ',
        ...WMSU_INSIDE,
        now,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(emptyRes.httpStatus, 400);
    assert.equal(emptyRes.body.message, 'QR token is required.');

    const unknownRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: 'CRIMSON-ATT:nonexistent-token',
        ...WMSU_INSIDE,
        now,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(unknownRes.httpStatus, 400);
    assert.equal(unknownRes.body.message, 'Invalid or expired QR code.');

    const mismatchRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        eventId: 99,
        ...WMSU_INSIDE,
        now,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(mismatchRes.httpStatus, 400);
    assert.equal(mismatchRes.body.message, 'This QR code belongs to a different event.');

    const scheduledRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: `CRIMSON-ATT:${'b'.repeat(64)}`,
        ...WMSU_INSIDE,
        now,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(scheduledRes.httpStatus, 400);
    assert.equal(scheduledRes.body.message, 'Attendance has not started yet.');

    const closedRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: `CRIMSON-ATT:${'c'.repeat(64)}`,
        ...WMSU_INSIDE,
        now,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(closedRes.httpStatus, 400);
    assert.equal(closedRes.body.message, 'Attendance window is closed for this event.');
});

test('2. processQrCheckIn returns 400 LOCATION_REQUIRED when coordinates are missing or invalid', async () => {
    const mockDb = createCheckInMockPool({
        sessions: [{ session_id: 1, event_post_id: 10, status: 'OPEN', qr_token: VALID_TOKEN }],
        registrations: [{ registration_id: 100, event_post_id: 10, registrant_user_id: 5, status: 'Registered' }],
    });

    for (const badCoords of [
        { latitude: null, longitude: null },
        { latitude: '', longitude: 122.0615 },
        { latitude: 999, longitude: 122.0615 },
    ]) {
        const res = await processQrCheckIn(mockDb, {
            userId: 5,
            token: `CRIMSON-ATT:${VALID_TOKEN}`,
            ...badCoords,
            geofenceConfig: WMSU_CONFIG,
        });
        assert.equal(res.httpStatus, 400);
        assert.equal(res.body.code, 'LOCATION_REQUIRED');
        assert.equal(res.body.message, 'Location access is required to record attendance.');
    }
});

test('3. processQrCheckIn returns 403 OUTSIDE_GEOFENCE when outside WMSU campus radius', async () => {
    const mockDb = createCheckInMockPool({
        sessions: [{ session_id: 1, event_post_id: 10, status: 'OPEN', qr_token: VALID_TOKEN }],
        registrations: [{ registration_id: 100, event_post_id: 10, registrant_user_id: 5, status: 'Registered' }],
    });

    const res = await processQrCheckIn(mockDb, {
        userId: 5,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        ...WMSU_OUTSIDE,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(res.httpStatus, 403);
    assert.equal(res.body.code, 'OUTSIDE_GEOFENCE');
    assert.match(res.body.message, /WMSU Main Campus/);
    assert.equal(res.body.radiusMeters, 450);
    assert.ok(res.body.distanceMeters > 450);
});

test('4. processQrCheckIn returns 403 when student lacks a confirmed registration', async () => {
    const mockDb = createCheckInMockPool({
        sessions: [{ session_id: 1, event_post_id: 10, status: 'OPEN', qr_token: VALID_TOKEN }],
        registrations: [{ registration_id: 100, event_post_id: 10, registrant_user_id: 5, status: 'Cancelled' }],
    });

    const cancelledRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        ...WMSU_INSIDE,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(cancelledRes.httpStatus, 403);
    assert.equal(cancelledRes.body.message, 'You do not have a confirmed registration for this event.');

    const unregisteredRes = await processQrCheckIn(mockDb, {
        userId: 99,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        ...WMSU_INSIDE,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(unregisteredRes.httpStatus, 403);
    assert.equal(unregisteredRes.body.message, 'You do not have a confirmed registration for this event.');
});

test('5. processQrCheckIn handles duplicate PRESENT check-in and blocks manual_staff ABSENT/EXCUSED overrides', async () => {
    const mockDb = createCheckInMockPool({
        sessions: [{ session_id: 1, event_post_id: 10, status: 'OPEN', qr_token: VALID_TOKEN }],
        registrations: [
            { registration_id: 101, event_post_id: 10, registrant_user_id: 5, status: 'Attended' },
            { registration_id: 102, event_post_id: 10, registrant_user_id: 6, status: 'Registered' },
            { registration_id: 103, event_post_id: 10, registrant_user_id: 7, status: 'Registered' },
        ],
        records: [
            {
                attendance_id: 501,
                registration_id: 101,
                status: 'PRESENT',
                checkin_time: '2026-11-22T09:30:00.000Z',
                check_in_method: 'qr_scan',
            },
            {
                attendance_id: 502,
                registration_id: 102,
                status: 'ABSENT',
                checkin_time: null,
                check_in_method: 'manual_staff',
            },
            {
                attendance_id: 503,
                registration_id: 103,
                status: 'EXCUSED',
                checkin_time: null,
                check_in_method: 'manual_staff',
            },
        ],
    });

    const dupRes = await processQrCheckIn(mockDb, {
        userId: 5,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        ...WMSU_INSIDE,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(dupRes.httpStatus, 200);
    assert.equal(dupRes.body.alreadyCheckedIn, true);
    assert.equal(dupRes.body.status, 'PRESENT');
    assert.equal(dupRes.body.eventId, 10);
    assert.equal(dupRes.body.checkinTime, '2026-11-22T09:30:00.000Z');
    assert.equal(mockDb.state.audits.length, 0);

    for (const blockedUserId of [6, 7]) {
        const blockedRes = await processQrCheckIn(mockDb, {
            userId: blockedUserId,
            token: `CRIMSON-ATT:${VALID_TOKEN}`,
            ...WMSU_INSIDE,
            geofenceConfig: WMSU_CONFIG,
        });
        assert.equal(blockedRes.httpStatus, 409);
        assert.equal(
            blockedRes.body.message,
            'Your attendance status was manually set by staff and cannot be overwritten by QR scan.'
        );
    }
    assert.equal(mockDb.state.audits.length, 0);
});

test('6. processQrCheckIn records PRESENT inside WMSU geofence, preserves prior audit status, and respects disabled geofence', async () => {
    const mockDb = createCheckInMockPool({
        sessions: [{ session_id: 1, event_post_id: 10, status: 'OPEN', qr_token: VALID_TOKEN }],
        registrations: [
            { registration_id: 201, event_post_id: 10, registrant_user_id: 11, status: 'Registered' },
            { registration_id: 202, event_post_id: 10, registrant_user_id: 12, status: 'Registered' },
            { registration_id: 203, event_post_id: 10, registrant_user_id: 13, status: 'Registered' },
        ],
        records: [
            {
                attendance_id: 602,
                registration_id: 202,
                status: 'ABSENT',
                checkin_time: null,
                check_in_method: 'qr_scan',
            },
        ],
    });

    // Fresh check-in with CRIMSON-ATT:<token> inside geofence
    const okRes = await processQrCheckIn(mockDb, {
        userId: 11,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        eventId: 10,
        ...WMSU_INSIDE,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(okRes.httpStatus, 200);
    assert.equal(okRes.body.status, 'PRESENT');
    assert.equal(okRes.body.eventId, 10);
    assert.ok(okRes.body.checkinTime);
    assert.equal(mockDb.state.registrations[0].status, 'Attended');
    assert.equal(mockDb.state.audits[0].previous_status, 'NOT_MARKED');
    assert.equal(mockDb.state.audits[0].new_status, 'PRESENT');

    // Re-opened event where student was previously auto-marked ABSENT -> audit records real prior status 'ABSENT'
    const reopenRes = await processQrCheckIn(mockDb, {
        userId: 12,
        token: VALID_TOKEN,
        ...WMSU_INSIDE,
        geofenceConfig: WMSU_CONFIG,
    });
    assert.equal(reopenRes.httpStatus, 200);
    assert.equal(mockDb.state.audits[1].previous_status, 'ABSENT');
    assert.equal(mockDb.state.audits[1].new_status, 'PRESENT');

    // Geofence disabled allows check-in even without campus coordinates
    const disabledRes = await processQrCheckIn(mockDb, {
        userId: 13,
        token: `CRIMSON-ATT:${VALID_TOKEN}`,
        latitude: null,
        longitude: null,
        geofenceConfig: { ...WMSU_CONFIG, enabled: false },
    });
    assert.equal(disabledRes.httpStatus, 200);
    assert.equal(disabledRes.body.status, 'PRESENT');

    // SQL ON CONFLICT DO UPDATE includes WHERE guard against manual_staff overrides and duplicate PRESENT
    const upsertQuery = mockDb.state.queries.find((q) => /^INSERT INTO event_attendance_records/i.test(q.text));
    assert.ok(upsertQuery);
    assert.match(upsertQuery.text, /WHERE event_attendance_records\.status <> 'PRESENT'/i);
    assert.match(upsertQuery.text, /event_attendance_records\.check_in_method = 'manual_staff'/i);
});
