const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSpotlightOptions,
  isSpotlightItemActive,
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
