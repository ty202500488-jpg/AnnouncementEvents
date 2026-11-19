export function formatSpotlightDateTime(value) {
  if (!value) return 'No expiration set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function hasSpotlightExpirationChanged(originalExpiresAt, nextExpiresAt) {
  const origDate = originalExpiresAt ? new Date(originalExpiresAt) : null;
  const nextDate = nextExpiresAt ? new Date(nextExpiresAt) : null;
  const origValid = Boolean(origDate && !Number.isNaN(origDate.getTime()));
  const nextValid = Boolean(nextDate && !Number.isNaN(nextDate.getTime()));

  if (!origValid && !nextValid) return false;
  if (!origValid || !nextValid) return true;
  return Math.floor(origDate.getTime() / 60000) !== Math.floor(nextDate.getTime() / 60000);
}

export function validateSpotlightExpirationAdjustment({
  originalExpiresAt,
  nextExpiresAt,
  reason = '',
  isPendingApproval = false,
  nowMs = Date.now(),
}) {
  const changed = hasSpotlightExpirationChanged(originalExpiresAt, nextExpiresAt);
  const nextDate = nextExpiresAt ? new Date(nextExpiresAt) : null;
  const nextValid = Boolean(nextDate && !Number.isNaN(nextDate.getTime()));

  if (!changed) {
    if (isPendingApproval && originalExpiresAt) {
      const origMs = new Date(originalExpiresAt).getTime();
      if (!Number.isNaN(origMs) && origMs <= nowMs) {
        return {
          valid: false,
          changed: false,
          error: 'This spotlight submission has already expired. Pick a future expiration date and explain the adjustment before approving.',
        };
      }
    }
    return { valid: true, changed: false, error: '' };
  }

  if (!nextValid) {
    return {
      valid: false,
      changed: true,
      error: 'Please select a valid future expiration date and time.',
    };
  }

  if (nextDate.getTime() <= nowMs) {
    return {
      valid: false,
      changed: true,
      error: 'Adjusted expiration date and time must be in the future.',
    };
  }

  if (!String(reason || '').trim()) {
    return {
      valid: false,
      changed: true,
      error: 'Please enter a message explaining to staff why the expiration date was changed.',
    };
  }

  return { valid: true, changed: true, error: '' };
}

export function computePresetExpirationIso(hours) {
  const target = new Date(Date.now() + hours * 60 * 60 * 1000);
  const mins = target.getMinutes();
  const snappedMins = Math.ceil(mins / 5) * 5;
  target.setMinutes(snappedMins, 0, 0);
  return target.toISOString();
}
