const test = require('node:test');
const assert = require('node:assert/strict');

const { mapMyEventRowWithAttendance } = require('../utils/attendanceHelper');

test('mapMyEventRowWithAttendance preserves is_registered for Attended, exposes ACTIVE status & checkin, and strips session_* keys', () => {
    const now = new Date('2026-11-22T10:30:00.000Z');
    const checkinTime = new Date('2026-11-22T10:05:00.000Z');
    const eventDate = new Date('2026-11-22T09:00:00.000Z');

    const row = {
        id: 42,
        event_id: 42,
        title: 'WMSU Tech Summit',
        event_date: eventDate,
        registration_id: 101,
        registration_status: 'Attended',
        is_registered: true,
        session_status: 'OPEN',
        session_open_time: new Date('2026-11-22T09:55:00.000Z'),
        session_close_time: null,
        session_scheduled_open_time: new Date('2026-11-22T10:00:00.000Z'),
        session_scheduled_close_time: new Date('2026-11-22T12:00:00.000Z'),
        session_closed_manually_at: null,
        user_attendance_status: 'PRESENT',
        user_checkin_time: checkinTime,
    };

    const mapped = mapMyEventRowWithAttendance(row, now);

    assert.equal(mapped.is_registered, true);
    assert.equal(mapped.date, eventDate);
    assert.equal(mapped.attendance_status, 'ACTIVE');
    assert.equal(mapped.attendance_open_time, '2026-11-22T10:00:00.000Z');
    assert.equal(mapped.attendance_close_time, '2026-11-22T12:00:00.000Z');
    assert.equal(mapped.user_attendance_status, 'PRESENT');
    assert.equal(mapped.user_checkin_time, checkinTime);

    assert.equal('session_status' in mapped, false);
    assert.equal('session_open_time' in mapped, false);
    assert.equal('session_close_time' in mapped, false);
    assert.equal('session_scheduled_open_time' in mapped, false);
    assert.equal('session_scheduled_close_time' in mapped, false);
    assert.equal('session_closed_manually_at' in mapped, false);
});

test('mapMyEventRowWithAttendance sets is_registered false for Pending/Rejected and exposes SCHEDULED window', () => {
    const now = new Date('2026-11-22T08:00:00.000Z');

    for (const registrationStatus of ['Pending', 'Rejected']) {
        const mapped = mapMyEventRowWithAttendance(
            {
                id: 77,
                date: '2026-11-22T09:00:00.000Z',
                event_date: '2026-11-22T09:00:00.000Z',
                registration_status: registrationStatus,
                session_status: 'CLOSED',
                session_open_time: null,
                session_close_time: null,
                session_scheduled_open_time: '2026-11-22T09:00:00.000Z',
                session_scheduled_close_time: '2026-11-22T11:00:00.000Z',
                session_closed_manually_at: null,
                user_attendance_status: null,
                user_checkin_time: null,
            },
            now
        );

        assert.equal(mapped.is_registered, false);
        assert.equal(mapped.date, '2026-11-22T09:00:00.000Z');
        assert.equal(mapped.attendance_status, 'SCHEDULED');
        assert.equal(mapped.attendance_open_time, '2026-11-22T09:00:00.000Z');
        assert.equal(mapped.attendance_close_time, '2026-11-22T11:00:00.000Z');
        assert.equal(mapped.user_attendance_status, null);
        assert.equal(mapped.user_checkin_time, null);
    }
});

test('mapMyEventRowWithAttendance returns CLOSED and null attendance metadata when session row is missing', () => {
    const now = new Date('2026-11-22T10:00:00.000Z');

    const mapped = mapMyEventRowWithAttendance(
        {
            id: 88,
            event_date: '2026-11-22T09:00:00.000Z',
            registration_status: 'Registered',
            session_status: null,
            session_open_time: null,
            session_close_time: null,
            session_scheduled_open_time: null,
            session_scheduled_close_time: null,
            session_closed_manually_at: null,
            user_attendance_status: null,
            user_checkin_time: null,
        },
        now
    );

    assert.equal(mapped.is_registered, true);
    assert.equal(mapped.date, '2026-11-22T09:00:00.000Z');
    assert.equal(mapped.attendance_status, 'CLOSED');
    assert.equal(mapped.attendance_open_time, null);
    assert.equal(mapped.attendance_close_time, null);
    assert.equal(mapped.user_attendance_status, null);
    assert.equal(mapped.user_checkin_time, null);
});

test('mapMyEventRowWithAttendance keeps manually closed mid-schedule session CLOSED and falls back to open_time/close_time', () => {
    const now = new Date('2026-11-22T10:30:00.000Z');

    const manuallyClosed = mapMyEventRowWithAttendance(
        {
            id: 99,
            event_date: '2026-11-22T09:00:00.000Z',
            registration_status: 'Registered',
            session_status: 'CLOSED',
            session_open_time: '2026-11-22T10:00:00.000Z',
            session_close_time: '2026-11-22T10:15:00.000Z',
            session_scheduled_open_time: '2026-11-22T10:00:00.000Z',
            session_scheduled_close_time: '2026-11-22T12:00:00.000Z',
            session_closed_manually_at: '2026-11-22T10:15:00.000Z',
            user_attendance_status: 'NOT_MARKED',
            user_checkin_time: null,
        },
        now
    );

    assert.equal(manuallyClosed.attendance_status, 'CLOSED');
    assert.equal(manuallyClosed.user_attendance_status, 'NOT_MARKED');

    const unscheduledManualOpen = mapMyEventRowWithAttendance(
        {
            id: 100,
            event_date: '2026-11-22T09:00:00.000Z',
            registration_status: 'Registered',
            session_status: 'OPEN',
            session_open_time: '2026-11-22T10:00:00.000Z',
            session_close_time: '2026-11-22T11:30:00.000Z',
            session_scheduled_open_time: null,
            session_scheduled_close_time: null,
            session_closed_manually_at: null,
            user_attendance_status: 'ABSENT',
            user_checkin_time: null,
        },
        now
    );

    assert.equal(unscheduledManualOpen.attendance_status, 'ACTIVE');
    assert.equal(unscheduledManualOpen.attendance_open_time, '2026-11-22T10:00:00.000Z');
    assert.equal(unscheduledManualOpen.attendance_close_time, '2026-11-22T11:30:00.000Z');
    assert.equal(unscheduledManualOpen.user_attendance_status, 'ABSENT');
});
