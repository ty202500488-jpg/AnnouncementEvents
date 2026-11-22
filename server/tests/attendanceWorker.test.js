const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db');
const { processAttendanceSessions } = require('../Routes/attendanceWorker');

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
    };
    let nextAttendanceId = state.records.reduce((max, r) => Math.max(max, r.attendance_id || 0), 0) + 1;

    const toMs = (v) => (v ? new Date(v).getTime() : null);

    const mockPool = {
        state,
        async query(sql, params = []) {
            const text = String(sql).replace(/\s+/g, ' ').trim();

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

            // Step B select: expired scheduled sessions to auto-close
            if (
                /FROM event_attendance_sessions/i.test(text) &&
                /scheduled_close_time <= NOW\(\)/i.test(text)
            ) {
                const matched = state.sessions.filter((s) => {
                    const openMs = toMs(s.scheduled_open_time);
                    const closeMs = toMs(s.scheduled_close_time);
                    const manualCloseMs = toMs(s.closed_manually_at);
                    if (closeMs === null || closeMs > state.nowMs) return false;
                    if (s.status === 'OPEN') return true;
                    const notManuallyClosedAfterOpen =
                        manualCloseMs === null || (openMs !== null && manualCloseMs < openMs);
                    if (!notManuallyClosedAfterOpen) return false;
                    const hasUnmarked = state.registrations.some((reg) => {
                        if (Number(reg.event_post_id) !== Number(s.event_post_id)) return false;
                        if (!['registered', 'attended'].includes(String(reg.status || '').toLowerCase())) {
                            return false;
                        }
                        const rec = state.records.find((r) => Number(r.registration_id) === Number(reg.registration_id));
                        return !rec || rec.status === 'NOT_MARKED';
                    });
                    return hasUnmarked;
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

            // Step B mark NOT_MARKED -> ABSENT
            if (/^UPDATE event_attendance_records ar SET status = 'ABSENT'/i.test(text)) {
                const [eventId] = params;
                let updated = 0;
                for (const rec of state.records) {
                    const reg = state.registrations.find(
                        (r) => Number(r.registration_id) === Number(rec.registration_id)
                    );
                    if (reg && Number(reg.event_post_id) === Number(eventId) && rec.status === 'NOT_MARKED') {
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
