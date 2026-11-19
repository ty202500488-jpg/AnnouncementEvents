const { notifyAdminsPendingContent } = require('./notificationService');

/**
 * Parse and validate University-Wide Spotlight request options from a post payload.
 */
function parseSpotlightOptions(body = {}, now = new Date()) {
  const rawFlag = body.is_university_wide ?? body.isUniversityWide ?? false;
  const isUniversityWide = rawFlag === true || rawFlag === 'true' || rawFlag === 1 || rawFlag === '1';

  const rawExpires = body.expires_at ?? body.expiresAt ?? null;
  const hasExpires = rawExpires !== undefined && rawExpires !== null && String(rawExpires).trim() !== '';

  if (!isUniversityWide) {
    if (!hasExpires) {
      return { valid: true, isUniversityWide: false, expiresAt: null };
    }
    const parsedOptional = new Date(rawExpires);
    if (Number.isNaN(parsedOptional.getTime())) {
      return { valid: false, error: 'Invalid expiration date provided.' };
    }
    return {
      valid: true,
      isUniversityWide: false,
      expiresAt: parsedOptional.toISOString(),
    };
  }

  if (!hasExpires) {
    return {
      valid: false,
      error: 'Please select an expiration date/time ("Active Until") for University-Wide Spotlight requests.',
    };
  }

  const parsed = new Date(rawExpires);
  if (Number.isNaN(parsed.getTime())) {
    return {
      valid: false,
      error: 'Invalid expiration date provided for University-Wide Spotlight.',
    };
  }

  if (parsed.getTime() <= now.getTime()) {
    return {
      valid: false,
      error: 'University-Wide Spotlight expiration date must be in the future.',
    };
  }

  return {
    valid: true,
    isUniversityWide: true,
    expiresAt: parsed.toISOString(),
  };
}

/**
 * Validate and compare an admin-initiated spotlight expiration date change.
 * Compares timestamps at minute precision so UI pickers without seconds do not trigger false changes.
 */
function evaluateSpotlightExpirationChange({
  isUniversityWide = false,
  currentExpiresAt = null,
  incomingExpiresAt = undefined,
  reason = '',
  now = new Date(),
} = {}) {
  const prevDate = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const previousExpiresAt = prevDate && !Number.isNaN(prevDate.getTime()) ? prevDate.toISOString() : null;

  if (!isUniversityWide || incomingExpiresAt === undefined) {
    return {
      valid: true,
      changed: false,
      previousExpiresAt,
      nextExpiresAt: previousExpiresAt,
      reason: '',
    };
  }

  const hasIncoming = incomingExpiresAt !== null && String(incomingExpiresAt).trim() !== '';
  if (!hasIncoming) {
    return {
      valid: false,
      changed: false,
      error: 'University-Wide Spotlight posts must have a valid future expiration date.',
      previousExpiresAt,
      nextExpiresAt: null,
      reason: '',
    };
  }

  const parsedNext = new Date(incomingExpiresAt);
  if (Number.isNaN(parsedNext.getTime())) {
    return {
      valid: false,
      changed: false,
      error: 'Invalid expiration date provided for University-Wide Spotlight.',
      previousExpiresAt,
      nextExpiresAt: null,
      reason: '',
    };
  }

  const prevMinute = prevDate && !Number.isNaN(prevDate.getTime()) ? Math.floor(prevDate.getTime() / 60000) : null;
  const nextMinute = Math.floor(parsedNext.getTime() / 60000);
  const changed = prevMinute === null || prevMinute !== nextMinute;

  if (!changed) {
    return {
      valid: true,
      changed: false,
      previousExpiresAt,
      nextExpiresAt: previousExpiresAt,
      reason: '',
    };
  }

  if (parsedNext.getTime() <= now.getTime()) {
    return {
      valid: false,
      changed: true,
      error: 'Adjusted University-Wide Spotlight expiration date must be in the future.',
      previousExpiresAt,
      nextExpiresAt: parsedNext.toISOString(),
      reason: '',
    };
  }

  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    return {
      valid: false,
      changed: true,
      error: 'Please provide a message explaining why the spotlight expiration date was changed.',
      previousExpiresAt,
      nextExpiresAt: parsedNext.toISOString(),
      reason: '',
    };
  }

  return {
    valid: true,
    changed: true,
    previousExpiresAt,
    nextExpiresAt: parsedNext.toISOString(),
    reason: trimmedReason,
  };
}

/**
 * Determine whether a database post row should currently appear in the Spotlight carousel.
 */
function isSpotlightItemActive(row, now = new Date()) {
  if (!row || !row.is_university_wide) return false;
  if (row.is_archived) return false;
  if (String(row.moderation_status || '').toLowerCase() !== 'approved') return false;
  if (!row.expires_at) return true;

  const expiresMs = new Date(row.expires_at).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > now.getTime();
}

let columnEnsuredPromise = null;

/**
 * Idempotently ensure posts.is_university_wide and its spotlight index exist in PostgreSQL.
 */
function ensureUniversityWideColumn(pool) {
  if (!columnEnsuredPromise) {
    columnEnsuredPromise = (async () => {
      await pool.query(
        `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_university_wide BOOLEAN DEFAULT FALSE NOT NULL;`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_posts_university_spotlight
         ON posts (is_university_wide, moderation_status, is_archived, expires_at DESC);`
      );
    })().catch((err) => {
      columnEnsuredPromise = null;
      throw err;
    });
  }
  return columnEnsuredPromise;
}

/**
 * Notify all active Admin users when staff requests University-Wide Spotlight placement.
 */
async function notifyAdminsOfSpotlightRequest(db, { actorUserId, pageId, postId, postType, title, expiresAt }) {
  return notifyAdminsPendingContent(db, {
    actorUserId,
    pageId,
    postId,
    targetType: postType,
    title,
    expiresAt: expiresAt || new Date(),
  });
}

module.exports = {
  parseSpotlightOptions,
  evaluateSpotlightExpirationChange,
  isSpotlightItemActive,
  ensureUniversityWideColumn,
  notifyAdminsOfSpotlightRequest,
};
