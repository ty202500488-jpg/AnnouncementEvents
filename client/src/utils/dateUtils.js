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

/**
 * Format a post timestamp: show time (e.g. "1:38 AM") if posted on the same local day
 * as `now`, otherwise show the date (e.g. "Nov 13, 2026").
 */
export function formatPostTimestamp(dateValue, { fallback = 'Recent', now = new Date() } = {}) {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return fallback;

  if (isSameLocalDay(parsed, now)) {
    return parsed.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
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
