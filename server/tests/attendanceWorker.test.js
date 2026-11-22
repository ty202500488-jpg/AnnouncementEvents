const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db');
const attendanceRouter = require('../Routes/mypageAttendance');
const { processAttendanceSessions } = require('../Routes/attendanceWorker');

function findPostHandler(routePath) {
    const layer = attendanceRouter.stack.find(
        (entry) => entry.route && entry.route.path === routePath && entry.route.methods.post
    );
    assert.ok(layer, `Expected POST route ${routePath} to exist on mypageAttendance router`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

function createWorkerMockPool({
    now = new Date('2026-11-22T10:00:00.000Z'),
    sessions = [],
    posts = [],
    registrations = [],
    records = [],
} = {}) {
    const state = {
        nowMs: now.getTime(),
        sessions: sessions.map((s) => ({ ...s })),
        posts: posts.map((p) => ({ ...p })),
        registrations: registrations.map((r) => ({ ...r })),
        records: records.map((r) => ({ ...r })),
        deletedExpiredQrTokens: false,
        queries: [],
    };
    let nextAttendanceId = state.records.reduce((max, r) => Math.max(max, r.attendance_id || 0), 0) + 1;

    const toMs = (v) => (v ? new Date(v).getTime() : null);

    const mockPool = {
        state,
        async query(sql, params = []) {
            const text = String(sql).replace(/\s+/g, ' ').trim();
            state.queries.push({ text, params });

            if (/^ALTER TABLE event_attendance_sessions/i.test(text)) {
                return { rows: [], rowCount: 0 };
            }

            // Step A select: due scheduled sessions to auto-open
            if (
                /FROM event_attendance_sessions/i.test(text) &&
                /status = 'CLOSED'/i.test(text) &&
                /scheduled_open_time <= NOW\(\)/i.test(text)
            ) {
                const matched = state.sessions.filter((s) => {
                    const openMs = toMs(s.scheduled_open_time);
                    const closeMs = toMs(s.scheduled_close_time);
                    const manualCloseMs = toMs(s.closed_manually_at);
                    return (
                        s.status === 'CLOSED' &&
                        openMs !== null &&
                        openMs <= state.nowMs &&
                        (closeMs === null || closeMs > state.nowMs) &&
                        (manualCloseMs === null || manualCloseMs < openMs)
                    );
                });
                return { rows: matched.map((s) => ({ ...s })), rowCount: matched.length };
            }

            // Step B select: expired unfinalized scheduled sessions to auto-close
            if (
                /FROM event_attendance_sessions/i.test(text) &&
                /scheduled_close_time <= NOW\(\)/i.test(text)
            ) {
                const matched = state.sessions.filter((s) => {
                    const openMs = toMs(s.scheduled_open_time);
                    const schedCloseMs = toMs(s.scheduled_close_time);
                    const actualCloseMs = toMs(s.close_time);
                    const manualCloseMs = toMs(s.closed_manually_at);
                    if (schedCloseMs === null || schedCloseMs > state.nowMs) return false;
                    if (s.status === 'OPEN') return true;
                    if (s.status !== 'CLOSED') return false;
                    const unfinalizedClose = actualCloseMs === null || actualCloseMs < schedCloseMs;
                    const notManuallyClosedThisWindow =
                        manualCloseMs === null || manualCloseMs < (openMs ?? schedCloseMs);
                    return unfinalizedClose && notManuallyClosedThisWindow;
                });
                return { rows: matched.map((s) => ({ ...s })), rowCount: matched.length };
            }

            // Step A update session to OPEN
            if (/^UPDATE event_attendance_sessions SET status = 'OPEN'/i.test(text)) {
                const [eventId] = params;
                const s = state.sessions.find((row) => Number(row.event_post_id) === Number(eventId));
                if (s) {
                    s.status = 'OPEN';
                    s.open_time = s.scheduled_open_time;
                }
                return { rows: [], rowCount: s ? 1 : 0 };
            }

            // Step B update session to CLOSED
            if (/^UPDATE event_attendance_sessions SET status = 'CLOSED'/i.test(text)) {
                const [eventId] = params;
                const s = state.sessions.find((row) => Number(row.event_post_id) === Number(eventId));
                if (s) {
                    s.status = 'CLOSED';
                    s.close_time = s.scheduled_close_time;
                }
                return { rows: [], rowCount: s ? 1 : 0 };
            }

            // Ensure NOT_MARKED records for confirmed registrations
            if (/^INSERT INTO event_attendance_records/i.test(text) && /'NOT_MARKED'/i.test(text)) {
                const [eventId] = params;
                let inserted = 0;
                for (const reg of state.registrations) {
                    if (
                        Number(reg.event_post_id) === Number(eventId) &&
                        ['registered', 'attended'].includes(String(reg.status || '').toLowerCase())
                    ) {
                        const exists = state.records.some(
                            (r) => Number(r.registration_id) === Number(reg.registration_id)
                        );
                        if (!exists) {
                            state.records.push({
                                attendance_id: nextAttendanceId++,
                                registration_id: reg.registration_id,
                                status: 'NOT_MARKED',
                                check_in_method: 'qr_scan',
                            });
                            inserted += 1;
                        }
                    }
                }
                return { rows: [], rowCount: inserted };
            }

            // Step A reset non-manual ABSENT -> NOT_MARKED
            if (/^UPDATE event_attendance_records ar SET status = 'NOT_MARKED'/i.test(text)) {
                const [eventId] = params;
                let updated = 0;
                for (const rec of state.records) {
                    const reg = state.registrations.find(
                        (r) => Number(r.registration_id) === Number(rec.registration_id)
                    );
                    if (
                        reg &&
                        Number(reg.event_post_id) === Number(eventId) &&
                        rec.status === 'ABSENT' &&
                        rec.check_in_method !== 'manual_staff'
                    ) {
                        rec.status = 'NOT_MARKED';
                        updated += 1;
                    }
                }
                return { rows: [], rowCount: updated };
            }

            // Step B mark non-manual NOT_MARKED -> ABSENT
            if (/^UPDATE event_attendance_records ar SET status = 'ABSENT'/i.test(text)) {
                const [eventId] = params;
                const respectsManualStaffGuard = /ar\.check_in_method IS DISTINCT FROM 'manual_staff'/i.test(text);
                let updated = 0;
                for (const rec of state.records) {
                    const reg = state.registrations.find(
                        (r) => Number(r.registration_id) === Number(rec.registration_id)
                    );
                    if (
                        reg &&
                        Number(reg.event_post_id) === Number(eventId) &&
                        rec.status === 'NOT_MARKED' &&
                        (!respectsManualStaffGuard || rec.check_in_method !== 'manual_staff')
                    ) {
                        rec.status = 'ABSENT';
                        rec.check_in_method = 'qr_scan';
                        updated += 1;
                    }
                }
                return { rows: [], rowCount: updated };
            }

            // Event summary query for notification
            if (/FROM posts p/i.test(text) && /WHERE p\.post_id = \$1/i.test(text)) {
                const [eventId] = params;
                const post = state.posts.find((p) => Number(p.post_id) === Number(eventId));
                if (!post) return { rows: [], rowCount: 0 };

                const confirmedRegIds = new Set(
                    state.registrations
                        .filter(
                            (r) =>
                                Number(r.event_post_id) === Number(eventId) &&
                                ['registered', 'attended'].includes(String(r.status || '').toLowerCase())
                        )
                        .map((r) => r.registration_id)
                );
                const eventRecords = state.records.filter((r) => confirmedRegIds.has(r.registration_id));
                return {
                    rows: [
                        {
                            title: post.title,
                            page_id: post.page_id,
                            present: eventRecords.filter((r) => r.status === 'PRESENT').length,
                            absent: eventRecords.filter((r) => r.status === 'ABSENT').length,
                            total_eligible: eventRecords.length,
                        },
                    ],
                    rowCount: 1,
                };
            }

            // Step C cleanup
            if (/^DELETE FROM event_qr_tokens/i.test(text)) {
                state.deletedExpiredQrTokens = true;
                return { rows: [], rowCount: 0 };
            }

            throw new Error(`Unhandled SQL in worker mock: ${text}`);
        },
    };

    return mockPool;
}

test.after(async () => {
    await pool.end().catch(() => {});
});

test('1. Worker auto-activates due scheduled sessions, resets auto-ABSENT, preserves manual_staff, and notifies OPEN', async () => {
    const notifications = [];
    const mockDb = createWorkerMockPool({
        now: new Date('2026-11-22T10:00:00.000Z'),
        posts: [{ post_id: 10, title: 'General Assembly', page_id: 3 }],
        sessions: [
            {
                session_id: 1,
                event_post_id: 10,
                status: 'CLOSED',
                open_time: null,
                close_time: '2026-11-22T12:00:00.000Z',
                scheduled_open_time: '2026-11-22T09:55:00.000Z',
                scheduled_close_time: '2026-11-22T12:00:00.000Z',
                closed_manually_at: null,
                opened_by: 2,
            },
        ],
        registrations: [
            { registration_id: 101, event_post_id: 10, registrant_user_id: 21, status: 'Registered' },
            { registration_id: 102, event_post_id: 10, registrant_user_id: 22, status: 'Registered' },
            { registration_id: 103, event_post_id: 10, registrant_user_id: 23, status: 'Registered' },
            { registration_id: 104, event_post_id: 10, registrant_user_id: 24, status: 'Cancelled' },
        ],
        records: [
            { attendance_id: 1, registration_id: 102, status: 'ABSENT', check_in_method: 'qr_scan' },
            { attendance_id: 2, registration_id: 103, status: 'ABSENT', check_in_method: 'manual_staff' },
        ],
    });

    await processAttendanceSessions(mockDb, async (_db, payload) => {
        notifications.push(payload);
    });

    assert.equal(mockDb.state.sessions[0].status, 'OPEN');
    assert.equal(mockDb.state.sessions[0].open_time, '2026-11-22T09:55:00.000Z');

    const byReg = new Map(mockDb.state.records.map((r) => [r.registration_id, r]));
    assert.equal(byReg.get(101)?.status, 'NOT_MARKED');
    assert.equal(byReg.get(102)?.status, 'NOT_MARKED');
    assert.equal(byReg.get(103)?.status, 'ABSENT'); // manual_staff preserved
    assert.equal(byReg.has(104), false); // Cancelled excluded

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].action, 'OPEN');
    assert.equal(notifications[0].eventId, 10);
    assert.equal(notifications[0].title, 'General Assembly');
});

test('2. Worker auto-closes expired scheduled sessions, marks NOT_MARKED as ABSENT, and notifies CLOSE', async () => {
    const notifications = [];
    const mockDb = createWorkerMockPool({
        now: new Date('2026-11-22T12:05:00.000Z'),
        posts: [{ post_id: 10, title: 'Leadership Talk', page_id: 4 }],
        sessions: [
            {
                session_id: 1,
                event_post_id: 10,
                status: 'OPEN',
                open_time: '2026-11-22T10:00:00.000Z',
                close_time: '2026-11-22T12:00:00.000Z',
                scheduled_open_time: '2026-11-22T10:00:00.000Z',
                scheduled_close_time: '2026-11-22T12:00:00.000Z',
                closed_manually_at: null,
                opened_by: 2,
            },
        ],
        registrations: [
            { registration_id: 201, event_post_id: 10, registrant_user_id: 31, status: 'Attended' },
            { registration_id: 202, event_post_id: 10, registrant_user_id: 32, status: 'Registered' },
            { registration_id: 203, event_post_id: 10, registrant_user_id: 33, status: 'Registered' },
        ],
        records: [
            { attendance_id: 10, registration_id: 201, status: 'PRESENT', check_in_method: 'qr_scan' },
            { attendance_id: 11, registration_id: 202, status: 'NOT_MARKED', check_in_method: 'qr_scan' },
        ],
    });

    await processAttendanceSessions(mockDb, async (_db, payload) => {
        notifications.push(payload);
    });

    assert.equal(mockDb.state.sessions[0].status, 'CLOSED');
    assert.equal(mockDb.state.sessions[0].close_time, '2026-11-22T12:00:00.000Z');

    const byReg = new Map(mockDb.state.records.map((r) => [r.registration_id, r]));
    assert.equal(byReg.get(201)?.status, 'PRESENT');
    assert.equal(byReg.get(202)?.status, 'ABSENT');
    assert.equal(byReg.get(202)?.check_in_method, 'qr_scan');
    assert.equal(byReg.get(203)?.status, 'ABSENT');
    assert.equal(byReg.get(203)?.check_in_method, 'qr_scan');

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].action, 'CLOSE');
    assert.deepEqual(notifications[0].summary, {
        present: 1,
        absent: 2,
        totalEligible: 3,
    });
});

test('3. Worker respects manual-close override and cleans up legacy event_qr_tokens', async () => {
    const notifications = [];
    const mockDb = createWorkerMockPool({
        now: new Date('2026-11-22T10:30:00.000Z'),
        posts: [{ post_id: 10, title: 'Department Orientation', page_id: 5 }],
        sessions: [
            {
                session_id: 1,
                event_post_id: 10,
                status: 'CLOSED',
                open_time: '2026-11-22T10:00:00.000Z',
                close_time: '2026-11-22T10:15:00.000Z',
                scheduled_open_time: '2026-11-22T10:00:00.000Z',
                scheduled_close_time: '2026-11-22T12:00:00.000Z',
                closed_manually_at: '2026-11-22T10:15:00.000Z',
                opened_by: 2,
            },
        ],
    });

    await processAttendanceSessions(mockDb, async (_db, payload) => {
        notifications.push(payload);
    });

    assert.equal(mockDb.state.sessions[0].status, 'CLOSED');
    assert.equal(notifications.length, 0);
    assert.equal(mockDb.state.deletedExpiredQrTokens, true);
});

test('4. Step B guards manual_staff NOT_MARKED overrides and finalizes expired schedules at most once', async () => {
    const notifications = [];
    const mockDb = createWorkerMockPool({
        now: new Date('2026-11-22T12:05:00.000Z'),
        posts: [{ post_id: 10, title: 'Orientation', page_id: 6 }],
        sessions: [
            {
                session_id: 1,
                event_post_id: 10,
                status: 'CLOSED',
                open_time: null,
                close_time: null,
                scheduled_open_time: '2026-11-22T10:00:00.000Z',
                scheduled_close_time: '2026-11-22T12:00:00.000Z',
                closed_manually_at: null,
                opened_by: 2,
            },
        ],
        registrations: [
            { registration_id: 301, event_post_id: 10, registrant_user_id: 41, status: 'Registered' },
            { registration_id: 302, event_post_id: 10, registrant_user_id: 42, status: 'Registered' },
        ],
        records: [
            { attendance_id: 21, registration_id: 301, status: 'NOT_MARKED', check_in_method: 'manual_staff' },
            { attendance_id: 22, registration_id: 302, status: 'NOT_MARKED', check_in_method: 'qr_scan' },
        ],
    });

    await processAttendanceSessions(mockDb, async (_db, payload) => {
        notifications.push(payload);
    });

    const stepBSelect = mockDb.state.queries.find(
        (q) => /FROM event_attendance_sessions/i.test(q.text) && /scheduled_close_time <= NOW\(\)/i.test(q.text)
    );
    assert.ok(stepBSelect);
    assert.match(stepBSelect.text, /close_time IS NULL OR close_time < scheduled_close_time/i);
    assert.doesNotMatch(stepBSelect.text, /EXISTS\s*\(/i);
    assert.doesNotMatch(stepBSelect.text, /NOT_MARKED/i);

    const stepBMarkAbsent = mockDb.state.queries.find((q) =>
        /^UPDATE event_attendance_records ar SET status = 'ABSENT'/i.test(q.text)
    );
    assert.ok(stepBMarkAbsent);
    assert.match(stepBMarkAbsent.text, /ar\.check_in_method IS DISTINCT FROM 'manual_staff'/i);

    const byReg = new Map(mockDb.state.records.map((r) => [r.registration_id, r]));
    assert.equal(byReg.get(301)?.status, 'NOT_MARKED'); // manual_staff NOT_MARKED preserved
    assert.equal(byReg.get(302)?.status, 'ABSENT');
    assert.equal(mockDb.state.sessions[0].close_time, '2026-11-22T12:00:00.000Z');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].action, 'CLOSE');

    // Simulate staff manually correcting reg 302 back to NOT_MARKED after schedule ended, then running worker again
    byReg.get(302).status = 'NOT_MARKED';
    byReg.get(302).check_in_method = 'manual_staff';

    await processAttendanceSessions(mockDb, async (_db, payload) => {
        notifications.push(payload);
    });

    assert.equal(byReg.get(302)?.status, 'NOT_MARKED');
    assert.equal(notifications.length, 1); // No duplicate CLOSE notification or re-finalization
});

test('5. Manual OPEN clears stale scheduled_open_time so manual CLOSE is not resurrected at the old schedule time', async (t) => {
    const windowHandler = findPostHandler('/events/:eventId/window');
    const sessionRow = {
        id: 1,
        event_id: 10,
        status: 'CLOSED',
        open_time: null,
        close_time: null,
        scheduled_open_time: '2026-11-22T14:00:00.000Z',
        scheduled_close_time: '2026-11-22T16:00:00.000Z',
        closed_manually_at: null,
        qr_token_created_at: null,
        has_qr_token: true,
    };
    const recordedSql = [];

    const mockClient = {
        async query(sql) {
            const text = String(sql).replace(/\s+/g, ' ').trim();
            recordedSql.push(text);
            if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(text)) return { rows: [], rowCount: 0 };
            if (/^INSERT INTO event_attendance_sessions/i.test(text) && /status = 'OPEN'/i.test(text)) {
                assert.match(text, /scheduled_open_time = NULL/i);
                sessionRow.status = 'OPEN';
                sessionRow.open_time = '2026-11-22T13:00:00.000Z';
                sessionRow.close_time = null;
                sessionRow.scheduled_open_time = null;
                sessionRow.scheduled_close_time = null;
                sessionRow.closed_manually_at = null;
                return { rows: [{ ...sessionRow }], rowCount: 1 };
            }
            if (/^INSERT INTO event_attendance_sessions/i.test(text) && /status = 'CLOSED'/i.test(text)) {
                sessionRow.status = 'CLOSED';
                sessionRow.close_time = '2026-11-22T13:30:00.000Z';
                sessionRow.closed_manually_at = '2026-11-22T13:30:00.000Z';
                return { rows: [{ ...sessionRow }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        },
        release() {},
    };

    t.mock.method(pool, 'connect', async () => mockClient);
    t.mock.method(pool, 'query', async (sql) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (/^ALTER TABLE event_attendance_sessions/i.test(text)) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 0 };
    });

    const openRes = createMockRes();
    await windowHandler(
        { params: { eventId: '10' }, body: { action: 'OPEN' }, user: { id: 2 } },
        openRes
    );
    assert.equal(openRes.statusCode, 200);
    assert.equal(openRes.body.session.scheduled_open_time, null);

    const closeRes = createMockRes();
    await windowHandler(
        { params: { eventId: '10' }, body: { action: 'CLOSE' }, user: { id: 2 } },
        closeRes
    );
    assert.equal(closeRes.statusCode, 200);
    assert.equal(closeRes.body.session.status, 'CLOSED');
    assert.equal(closeRes.body.session.scheduled_open_time, null);

    // At 14:05 (after the old scheduled_open_time), worker must NOT resurrect the session
    const notifications = [];
    const mockDb = createWorkerMockPool({
        now: new Date('2026-11-22T14:05:00.000Z'),
        sessions: [
            {
                session_id: 1,
                event_post_id: 10,
                status: sessionRow.status,
                open_time: sessionRow.open_time,
                close_time: sessionRow.close_time,
                scheduled_open_time: sessionRow.scheduled_open_time,
                scheduled_close_time: sessionRow.scheduled_close_time,
                closed_manually_at: sessionRow.closed_manually_at,
                opened_by: 2,
            },
        ],
    });

    await processAttendanceSessions(mockDb, async (_db, payload) => {
        notifications.push(payload);
    });

    assert.equal(mockDb.state.sessions[0].status, 'CLOSED');
    assert.equal(notifications.length, 0);
});

test('6. POST /schedule rejects past close times, leaves close_time NULL, and notifies when now is in window', async (t) => {
    const scheduleHandler = findPostHandler('/events/:eventId/schedule');

    t.mock.method(pool, 'query', async (sql) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (/^ALTER TABLE event_attendance_sessions/i.test(text)) return { rows: [], rowCount: 0 };
        if (/FROM posts p/i.test(text)) {
            return {
                rows: [{ title: 'Tech Summit', page_id: 9, present: 0, absent: 0, total_eligible: 0 }],
                rowCount: 1,
            };
        }
        if (/FROM users u/i.test(text) || /INSERT INTO notifications/i.test(text)) {
            return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
    });

    // Reject schedule whose end time is in the past
    const pastRes = createMockRes();
    await scheduleHandler(
        {
            params: { eventId: '10' },
            body: {
                scheduledOpenTime: new Date(Date.now() - 7200000).toISOString(),
                scheduledCloseTime: new Date(Date.now() - 3600000).toISOString(),
            },
            user: { id: 2 },
        },
        pastRes
    );
    assert.equal(pastRes.statusCode, 400);
    assert.equal(pastRes.body.message, 'Schedule end time must be in the future.');

    const capturedParams = [];
    const mockClient = {
        async query(sql, params = []) {
            const text = String(sql).replace(/\s+/g, ' ').trim();
            if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(text)) return { rows: [], rowCount: 0 };
            if (/^INSERT INTO event_attendance_sessions/i.test(text)) {
                capturedParams.push({ text, params });
                assert.match(text, /VALUES \(\$1, \$2, \$3, NULL, \$4, \$5, NULL/i);
                assert.match(text, /close_time = NULL/i);
                return {
                    rows: [
                        {
                            id: 1,
                            event_id: 10,
                            status: params[1],
                            open_time: params[2],
                            close_time: null,
                            scheduled_open_time: params[3],
                            scheduled_close_time: params[4],
                            closed_manually_at: null,
                            qr_token_created_at: new Date(),
                            has_qr_token: true,
                        },
                    ],
                    rowCount: 1,
                };
            }
            return { rows: [], rowCount: 0 };
        },
        release() {},
    };
    t.mock.method(pool, 'connect', async () => mockClient);

    // Future schedule: open_time = null, close_time = null
    const futureRes = createMockRes();
    await scheduleHandler(
        {
            params: { eventId: '10' },
            body: {
                scheduledOpenTime: new Date(Date.now() + 3600000).toISOString(),
                scheduledCloseTime: new Date(Date.now() + 7200000).toISOString(),
            },
            user: { id: 2 },
        },
        futureRes
    );
    assert.equal(futureRes.statusCode, 200);
    assert.equal(futureRes.body.session.status, 'CLOSED');
    assert.equal(futureRes.body.session.open_time, null);
    assert.equal(futureRes.body.session.close_time, null);
    assert.equal(capturedParams[0].params[2], null);

    // Active-now schedule: open_time = openDate, close_time = null
    const openNowRes = createMockRes();
    await scheduleHandler(
        {
            params: { eventId: '10' },
            body: {
                scheduledOpenTime: new Date(Date.now() - 600000).toISOString(),
                scheduledCloseTime: new Date(Date.now() + 3600000).toISOString(),
            },
            user: { id: 2 },
        },
        openNowRes
    );
    assert.equal(openNowRes.statusCode, 200);
    assert.equal(openNowRes.body.session.status, 'OPEN');
    assert.ok(openNowRes.body.session.open_time);
    assert.equal(openNowRes.body.session.close_time, null);
});
