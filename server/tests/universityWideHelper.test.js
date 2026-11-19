const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSpotlightOptions,
  isSpotlightItemActive,
  evaluateSpotlightExpirationChange,
} = require('../utils/universityWideHelper');

const NOW = new Date('2026-11-14T10:00:00.000Z');

test('parseSpotlightOptions handles non-university-wide posts', () => {
  const result = parseSpotlightOptions({ is_university_wide: false }, NOW);
  assert.deepEqual(result, {
    valid: true,
    isUniversityWide: false,
    expiresAt: null,
  });
});

test('parseSpotlightOptions rejects university-wide post without expires_at', () => {
  const result = parseSpotlightOptions({ is_university_wide: true }, NOW);
  assert.equal(result.valid, false);
  assert.match(result.error, /expiration/i);
});

test('parseSpotlightOptions rejects invalid or past expires_at for university-wide post', () => {
  const invalidDate = parseSpotlightOptions(
    { is_university_wide: true, expires_at: 'not-a-date' },
    NOW
  );
  assert.equal(invalidDate.valid, false);

  const pastDate = parseSpotlightOptions(
    { is_university_wide: true, expires_at: '2026-11-14T09:59:59.000Z' },
    NOW
  );
  assert.equal(pastDate.valid, false);
});

test('parseSpotlightOptions accepts valid future expires_at and normalizes ISO string', () => {
  const result = parseSpotlightOptions(
    { is_university_wide: true, expires_at: '2026-11-17T10:00:00.000Z' },
    NOW
  );
  assert.equal(result.valid, true);
  assert.equal(result.isUniversityWide, true);
  assert.equal(result.expiresAt, '2026-11-17T10:00:00.000Z');
});

test('isSpotlightItemActive returns true only for approved non-archived active university-wide items', () => {
  assert.equal(
    isSpotlightItemActive(
      {
        is_university_wide: true,
        is_archived: false,
        moderation_status: 'Approved',
        expires_at: '2026-11-15T10:00:00.000Z',
      },
      NOW
    ),
    true
  );

  // Null expires_at legacy fallback remains active if approved
  assert.equal(
    isSpotlightItemActive(
      {
        is_university_wide: true,
        is_archived: false,
        moderation_status: 'Approved',
        expires_at: null,
      },
      NOW
    ),
    true
  );

  // Expired drops out
  assert.equal(
    isSpotlightItemActive(
      {
        is_university_wide: true,
        is_archived: false,
        moderation_status: 'Approved',
        expires_at: '2026-11-14T10:00:00.000Z',
      },
      NOW
    ),
    false
  );

  // Pending / Rejected / Archived / Regular post drop out
  for (const row of [
    { is_university_wide: false, is_archived: false, moderation_status: 'Approved' },
    { is_university_wide: true, is_archived: true, moderation_status: 'Approved' },
    { is_university_wide: true, is_archived: false, moderation_status: 'Pending' },
    { is_university_wide: true, is_archived: false, moderation_status: 'Rejected' },
  ]) {
    assert.equal(isSpotlightItemActive(row, NOW), false);
  }
});

test('evaluateSpotlightExpirationChange treats omitted or same-minute timestamps as unchanged', () => {
  const omitted = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:45.000Z',
    incomingExpiresAt: undefined,
    reason: '',
    now: NOW,
  });
  assert.equal(omitted.valid, true);
  assert.equal(omitted.changed, false);

  const sameMinute = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:45.000Z',
    incomingExpiresAt: '2026-11-20T08:30:00.000Z',
    reason: '',
    now: NOW,
  });
  assert.equal(sameMinute.valid, true);
  assert.equal(sameMinute.changed, false);
});

test('evaluateSpotlightExpirationChange rejects missing reason, cleared date, invalid date, or past date when changed', () => {
  const missingReason = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:00.000Z',
    incomingExpiresAt: '2026-11-22T09:00:00.000Z',
    reason: '   ',
    now: NOW,
  });
  assert.equal(missingReason.valid, false);
  assert.match(missingReason.error, /message|reason/i);

  const cleared = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:00.000Z',
    incomingExpiresAt: null,
    reason: 'Removing expiry',
    now: NOW,
  });
  assert.equal(cleared.valid, false);

  const past = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:00.000Z',
    incomingExpiresAt: '2026-11-14T09:00:00.000Z',
    reason: 'Shortened',
    now: NOW,
  });
  assert.equal(past.valid, false);
  assert.match(past.error, /future/i);

  const invalid = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:00.000Z',
    incomingExpiresAt: 'not-a-date',
    reason: 'Shortened',
    now: NOW,
  });
  assert.equal(invalid.valid, false);
});

test('evaluateSpotlightExpirationChange accepts valid future change with reason and skips non-spotlight posts', () => {
  const valid = evaluateSpotlightExpirationChange({
    isUniversityWide: true,
    currentExpiresAt: '2026-11-20T08:30:00.000Z',
    incomingExpiresAt: '2026-11-22T09:00:00.000Z',
    reason: '  Extended to cover enrollment week  ',
    now: NOW,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.changed, true);
  assert.equal(valid.previousExpiresAt, '2026-11-20T08:30:00.000Z');
  assert.equal(valid.nextExpiresAt, '2026-11-22T09:00:00.000Z');
  assert.equal(valid.reason, 'Extended to cover enrollment week');

  const nonSpotlight = evaluateSpotlightExpirationChange({
    isUniversityWide: false,
    currentExpiresAt: null,
    incomingExpiresAt: '2026-11-22T09:00:00.000Z',
    reason: '',
    now: NOW,
  });
  assert.equal(nonSpotlight.valid, true);
  assert.equal(nonSpotlight.changed, false);
});
