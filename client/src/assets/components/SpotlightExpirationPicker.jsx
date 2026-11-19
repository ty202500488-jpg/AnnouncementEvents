import React, { useMemo, useState } from 'react';
import {
  formatSpotlightDateTime,
  hasSpotlightExpirationChanged,
  computePresetExpirationIso,
} from '../../utils/spotlightExpirationUtils';
import './SpotlightExpirationPicker.css';

const PRESETS = [
  { label: '24h', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
  { label: '14 Days', hours: 336 },
];

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const BASE_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const pad2 = (n) => String(n).padStart(2, '0');

function getDateStringFromMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function decomposeLocalDate(isoValue, fallbackMs) {
  const fallback = new Date(fallbackMs + 72 * 60 * 60 * 1000);
  const d = isoValue ? new Date(isoValue) : fallback;
  const safe = Number.isNaN(d.getTime()) ? fallback : d;

  const dateStr = `${safe.getFullYear()}-${pad2(safe.getMonth() + 1)}-${pad2(safe.getDate())}`;
  const hours24 = safe.getHours();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minute = safe.getMinutes();

  return { dateStr, hour12, minute, period };
}

function buildIsoFromParts(dateStr, hour12, minute, period) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  let hours24 = Number(hour12) % 12;
  if (period === 'PM') hours24 += 12;
  const constructed = new Date(y, m - 1, d, hours24, Number(minute) || 0, 0, 0);
  if (Number.isNaN(constructed.getTime())) return null;
  return constructed.toISOString();
}

export default function SpotlightExpirationPicker({
  originalExpiresAt,
  value,
  onChange,
  reason = '',
  onReasonChange,
  readOnly = false,
  disabled = false,
  error = '',
  idPrefix = 'spotlight-exp',
}) {
  const [referenceNowMs] = useState(() => Date.now());
  const effectiveValue = value || originalExpiresAt || '';
  const isChanged = useMemo(
    () => hasSpotlightExpirationChanged(originalExpiresAt, effectiveValue),
    [originalExpiresAt, effectiveValue]
  );

  const isOriginalExpired = useMemo(() => {
    if (!originalExpiresAt) return false;
    const ms = new Date(originalExpiresAt).getTime();
    return !Number.isNaN(ms) && ms <= referenceNowMs;
  }, [originalExpiresAt, referenceNowMs]);

  const isCurrentExpired = useMemo(() => {
    if (!effectiveValue) return false;
    const ms = new Date(effectiveValue).getTime();
    return !Number.isNaN(ms) && ms <= referenceNowMs;
  }, [effectiveValue, referenceNowMs]);

  const parts = useMemo(
    () => decomposeLocalDate(effectiveValue, referenceNowMs),
    [effectiveValue, referenceNowMs]
  );

  const todayDateStr = useMemo(() => getDateStringFromMs(referenceNowMs), [referenceNowMs]);

  const minuteOptions = useMemo(() => {
    if (BASE_MINUTES.includes(parts.minute)) return BASE_MINUTES;
    return [...BASE_MINUTES, parts.minute].sort((a, b) => a - b);
  }, [parts.minute]);

  const handleDateChange = (nextDateStr) => {
    const nextIso = buildIsoFromParts(nextDateStr, parts.hour12, parts.minute, parts.period);
    if (nextIso) onChange?.(nextIso);
  };

  const handleTimeChange = (nextHour12, nextMinute, nextPeriod) => {
    const nextIso = buildIsoFromParts(parts.dateStr, nextHour12, nextMinute, nextPeriod);
    if (nextIso) onChange?.(nextIso);
  };

  const handlePresetClick = (hours) => {
    onChange?.(computePresetExpirationIso(hours));
  };

  const handleReset = () => {
    if (originalExpiresAt) {
      const orig = new Date(originalExpiresAt);
      if (!Number.isNaN(orig.getTime())) {
        onChange?.(orig.toISOString());
      }
    }
    onReasonChange?.('');
  };

  if (readOnly) {
    return (
      <div className="sep-card sep-readonly">
        <div className="sep-header">
          <div className="sep-title-wrap">
            <i className="fa-solid fa-clock" aria-hidden="true"></i>
            <span className="sep-title">Spotlight Active Until</span>
          </div>
          <span className={`sep-status-pill ${isCurrentExpired ? 'is-expired' : 'is-active'}`}>
            {isCurrentExpired ? 'Expired' : 'Scheduled'}
          </span>
        </div>
        <div className="sep-readonly-value">{formatSpotlightDateTime(effectiveValue)}</div>
      </div>
    );
  }

  return (
    <div className={`sep-card ${isChanged ? 'is-changed' : ''} ${error ? 'has-error' : ''}`}>
      <div className="sep-header">
        <div className="sep-title-wrap">
          <i className="fa-solid fa-clock" aria-hidden="true"></i>
          <span className="sep-title">Spotlight Active Until</span>
        </div>
        <div className="sep-header-right">
          {isChanged ? (
            <span className="sep-status-pill is-adjusted">Adjusted</span>
          ) : isOriginalExpired ? (
            <span className="sep-status-pill is-expired">Expired</span>
          ) : (
            <span className="sep-status-pill is-unchanged">Staff Requested</span>
          )}
        </div>
      </div>

      {/* Quick duration presets */}
      <div className="sep-presets" role="group" aria-label="Quick expiration presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="sep-preset-btn"
            onClick={() => handlePresetClick(preset.hours)}
            disabled={disabled}
          >
            +{preset.label}
          </button>
        ))}
        {isChanged && originalExpiresAt && (
          <button
            type="button"
            className="sep-preset-btn sep-reset-btn"
            onClick={handleReset}
            disabled={disabled}
            title="Restore staff's requested expiration date"
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Separate Date & Time controls */}
      <div className="sep-inputs-grid">
        <div className="sep-field">
          <label htmlFor={`${idPrefix}-date`} className="sep-field-label">
            End Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            className="sep-date-input"
            value={parts.dateStr}
            min={todayDateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="sep-field">
          <span className="sep-field-label">End Time</span>
          <div className="sep-time-group">
            <select
              id={`${idPrefix}-hour`}
              aria-label="Expiration hour"
              className="sep-time-select"
              value={parts.hour12}
              onChange={(e) => handleTimeChange(Number(e.target.value), parts.minute, parts.period)}
              disabled={disabled}
            >
              {HOURS_12.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="sep-time-colon" aria-hidden="true">:</span>
            <select
              id={`${idPrefix}-minute`}
              aria-label="Expiration minute"
              className="sep-time-select"
              value={parts.minute}
              onChange={(e) => handleTimeChange(parts.hour12, Number(e.target.value), parts.period)}
              disabled={disabled}
            >
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {pad2(m)}
                </option>
              ))}
            </select>
            <div className="sep-period-toggle" role="group" aria-label="AM or PM">
              {['AM', 'PM'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`sep-period-btn ${parts.period === p ? 'is-active' : ''}`}
                  onClick={() => handleTimeChange(parts.hour12, parts.minute, p)}
                  disabled={disabled}
                  aria-pressed={parts.period === p}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Original expired warning */}
      {!isChanged && isOriginalExpired && (
        <div className="sep-warning-callout" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>
            Requested expiration ({formatSpotlightDateTime(originalExpiresAt)}) has already passed. Choose a future date and add a note for staff.
          </span>
        </div>
      )}

      {/* Diff banner + mandatory Message to Staff when adjusted */}
      {isChanged && (
        <div className="sep-change-block">
          <div className="sep-diff-callout">
            <span className="sep-diff-old">{formatSpotlightDateTime(originalExpiresAt)}</span>
            <i className="fa-solid fa-arrow-right sep-diff-arrow" aria-hidden="true"></i>
            <span className="sep-diff-new">{formatSpotlightDateTime(effectiveValue)}</span>
          </div>

          <div className="sep-reason-wrap">
            <label htmlFor={`${idPrefix}-reason`} className="sep-reason-label">
              Message to Staff <span className="sep-required">*</span>
            </label>
            <textarea
              id={`${idPrefix}-reason`}
              className="sep-reason-textarea"
              rows={2}
              value={reason}
              onChange={(e) => onReasonChange?.(e.target.value)}
              placeholder="Explain why the spotlight expiration date was adjusted (sent to staff)..."
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="sep-error-text" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
