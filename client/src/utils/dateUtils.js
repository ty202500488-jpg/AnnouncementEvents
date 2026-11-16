/**
 * Check whether two Date instances fall on the same local calendar day.
 */
export function isSameLocalDay(dateA, dateB = new Date()) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/**
 * Format a post timestamp: show how recently it was posted (e.g. "Just now", "5m ago", "2h ago")
 * if within 1 day of `now`; once it exceeds 1 day, show only the date (e.g. "Nov 13, 2026").
 */
export function formatPostTimestamp(dateValue, { fallback = 'Recent', now = new Date() } = {}) {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return fallback;

  const diffMs = now.getTime() - parsed.getTime();
  if (diffMs >= 0 && diffMs < ONE_DAY_MS) {
    if (diffMs < ONE_MINUTE_MS) return 'Just now';
    if (diffMs < ONE_HOUR_MS) return `${Math.floor(diffMs / ONE_MINUTE_MS)}m ago`;
    return `${Math.floor(diffMs / ONE_HOUR_MS)}h ago`;
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format a scheduled calendar date (e.g. an upcoming event date).
 */
export function formatScheduledDate(dateValue, fallback = 'TBA') {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
