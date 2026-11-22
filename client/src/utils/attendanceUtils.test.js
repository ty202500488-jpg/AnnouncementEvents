import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAttendanceToken,
  calculateClientDistanceMeters,
  evaluateClientGeofence,
  getAttendanceButtonState,
  toLocalDateTimeInputValue,
} from './attendanceUtils.js';

test('extractAttendanceToken handles CRIMSON-ATT payload, legacy URLs, query params, and raw tokens', () => {
  assert.equal(extractAttendanceToken('CRIMSON-ATT:abc123def'), 'abc123def');
  assert.equal(extractAttendanceToken('  crimson-att:  xyz789  '), 'xyz789');
  assert.equal(
    extractAttendanceToken('https://campus.wmsu.edu.ph/attendance/check-in/tok%20123?foo=bar'),
    'tok 123'
  );
  assert.equal(
    extractAttendanceToken('https://campus.wmsu.edu.ph/attendance?token=querytok456'),
    'querytok456'
  );
  assert.equal(
    extractAttendanceToken('https://campus.wmsu.edu.ph/attendance?data=CRIMSON-ATT:wrappedtok'),
    'wrappedtok'
  );
  assert.equal(extractAttendanceToken('  rawtoken999  '), 'rawtoken999');
  assert.equal(extractAttendanceToken('CRIMSON-ATT:'), '');
  assert.equal(extractAttendanceToken('CRIMSON-ATT:   '), '');
  assert.equal(extractAttendanceToken('https://campus.wmsu.edu.ph/attendance?data=CRIMSON-ATT:'), '');
  assert.equal(extractAttendanceToken('   '), '');
  assert.equal(extractAttendanceToken(null), '');
  assert.equal(extractAttendanceToken(12345), '');
});

test('calculateClientDistanceMeters computes Haversine distance in rounded meters with clamped a', () => {
  assert.equal(calculateClientDistanceMeters(6.9135, 122.0615, 6.9135, 122.0615), 0);

  // Roughly ~111m north of WMSU Main Campus
  const distNorth = calculateClientDistanceMeters(6.9145, 122.0615, 6.9135, 122.0615);
  assert.ok(distNorth >= 105 && distNorth <= 118, `expected ~111m, got ${distNorth}`);

  // Antipodal coordinates should not produce NaN (clamps `a` into [0, 1])
  const antipodal = calculateClientDistanceMeters(0, 0, 0, 180);
  assert.equal(Number.isFinite(antipodal), true);
  assert.ok(antipodal > 20000000);
});

test('evaluateClientGeofence validates coordinates, inside/outside bounds, and disabled config', () => {
  const defaultConfig = {
    enabled: true,
    campusName: 'WMSU Main Campus',
    lat: 6.9135,
    lng: 122.0615,
    radiusMeters: 450,
  };

  const inside = evaluateClientGeofence({ latitude: 6.9138, longitude: 122.0618 }, defaultConfig);
  assert.equal(inside.allowed, true);
  assert.equal(inside.reason, 'INSIDE');
  assert.equal(inside.campusName, 'WMSU Main Campus');
  assert.equal(inside.radiusMeters, 450);
  assert.ok(typeof inside.distanceMeters === 'number' && inside.distanceMeters <= 450);

  const outside = evaluateClientGeofence({ latitude: 6.925, longitude: 122.08 }, defaultConfig);
  assert.equal(outside.allowed, false);
  assert.equal(outside.reason, 'OUTSIDE');
  assert.ok(outside.distanceMeters > 450);

  const disabled = evaluateClientGeofence(
    { latitude: null, longitude: null },
    { ...defaultConfig, enabled: false }
  );
  assert.deepEqual(disabled, {
    allowed: true,
    distanceMeters: null,
    radiusMeters: 450,
    campusName: 'WMSU Main Campus',
    reason: 'DISABLED',
  });

  const invalidCases = [
    null,
    {},
    { latitude: null, longitude: 122.0615 },
    { latitude: '', longitude: 122.0615 },
    { latitude: NaN, longitude: 122.0615 },
    { latitude: true, longitude: 122.0615 },
    { latitude: 6.9135, longitude: false },
    { latitude: [], longitude: 122.0615 },
    { latitude: 6.9135, longitude: {} },
    { latitude: 91, longitude: 122.0615 },
    { latitude: -90.1, longitude: 122.0615 },
    { latitude: 6.9135, longitude: 181 },
    { latitude: 6.9135, longitude: -180.5 },
  ];

  for (const coords of invalidCases) {
    const res = evaluateClientGeofence(coords, defaultConfig);
    assert.equal(res.allowed, false);
    assert.equal(res.distanceMeters, null);
    assert.equal(res.reason, 'INVALID_COORDINATES');
  }
});

test('getAttendanceButtonState handles visibility and PRESENT/ACTIVE/SCHEDULED/CLOSED states', () => {
  const hiddenPending = getAttendanceButtonState({
    attendanceStatus: 'ACTIVE',
    registrationStatus: 'Pending',
  });
  assert.deepEqual(hiddenPending, {
    visible: false,
    mode: 'CLOSED',
    clickable: false,
    label: '',
    tooltip: '',
  });

  const hiddenCancelled = getAttendanceButtonState({
    attendanceStatus: 'ACTIVE',
    registrationStatus: 'Cancelled',
  });
  assert.equal(hiddenCancelled.visible, false);

  const presentByRecord = getAttendanceButtonState({
    attendanceStatus: 'CLOSED',
    userAttendanceStatus: 'PRESENT',
    registrationStatus: 'Registered',
  });
  assert.deepEqual(presentByRecord, {
    visible: true,
    mode: 'PRESENT',
    clickable: false,
    label: 'Present',
    tooltip: 'Attendance recorded',
  });

  const presentByAttended = getAttendanceButtonState({
    attendanceStatus: 'ACTIVE',
    userAttendanceStatus: null,
    registrationStatus: 'Attended',
  });
  assert.equal(presentByAttended.mode, 'PRESENT');
  assert.equal(presentByAttended.clickable, false);
  assert.equal(presentByAttended.label, 'Present');

  const active = getAttendanceButtonState({
    attendanceStatus: 'ACTIVE',
    userAttendanceStatus: 'NOT_MARKED',
    registrationStatus: 'Registered',
  });
  assert.deepEqual(active, {
    visible: true,
    mode: 'ACTIVE',
    clickable: true,
    label: 'Attendance',
    tooltip: 'Open campus QR scanner to record attendance',
  });

  const openDate = new Date(2026, 10, 22, 8, 30, 0);
  const scheduled = getAttendanceButtonState({
    attendanceStatus: 'SCHEDULED',
    attendanceOpenTime: openDate.toISOString(),
    attendanceCloseTime: new Date(2026, 10, 22, 10, 30, 0).toISOString(),
    userAttendanceStatus: null,
    registrationStatus: 'registered',
  });
  assert.equal(scheduled.visible, true);
  assert.equal(scheduled.mode, 'SCHEDULED');
  assert.equal(scheduled.clickable, false);
  assert.ok(scheduled.label.startsWith('Attendance · Opens '));
  assert.ok(!scheduled.label.includes('Invalid'));
  assert.equal(scheduled.tooltip, 'Attendance has not started yet');

  const closed = getAttendanceButtonState({
    attendanceStatus: 'CLOSED',
    userAttendanceStatus: 'ABSENT',
    registrationStatus: 'Registered',
  });
  assert.deepEqual(closed, {
    visible: true,
    mode: 'CLOSED',
    clickable: false,
    label: 'Attendance Closed',
    tooltip: 'Attendance has not been started or is closed',
  });
});

test('toLocalDateTimeInputValue formats local YYYY-MM-DDTHH:mm and handles invalid inputs', () => {
  const localSample = new Date(2026, 10, 5, 9, 7, 0); // Nov 5, 2026 09:07 local
  assert.equal(toLocalDateTimeInputValue(localSample.toISOString()), '2026-11-05T09:07');
  assert.equal(toLocalDateTimeInputValue(localSample), '2026-11-05T09:07');
  assert.equal(toLocalDateTimeInputValue(null), '');
  assert.equal(toLocalDateTimeInputValue(undefined), '');
  assert.equal(toLocalDateTimeInputValue(''), '');
  assert.equal(toLocalDateTimeInputValue('not-a-date'), '');
});
