import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import '../styles/Overview.css';

const DATE_PRESET_OPTIONS = [
  { value: 'school_year', label: 'School Year' },
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
];

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatShortDate(value) {
  if (!value) return '—';
  const str = String(value).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? new Date(`${str}T00:00:00`)
    : new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function toLocalIsoDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computePresetDates(presetKey) {
  const now = new Date();
  const todayStr = toLocalIsoDate(now);

  switch (presetKey) {
    case 'school_year':
      return { startDate: '', endDate: '' };
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'last_7_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { startDate: toLocalIsoDate(start), endDate: todayStr };
    }
    case 'last_30_days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { startDate: toLocalIsoDate(start), endDate: todayStr };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: toLocalIsoDate(start), endDate: toLocalIsoDate(end) };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toLocalIsoDate(start), endDate: toLocalIsoDate(end) };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { startDate: toLocalIsoDate(start), endDate: toLocalIsoDate(end) };
    }
    default:
      return { startDate: '', endDate: '' };
  }
}

function getGroupingLabel(grouping) {
  switch (grouping) {
    case 'hourly':
      return 'Hourly';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    default:
      return 'Monthly';
  }
}

const OverviewStatCard = ({ label, kpi, subtext, icon, tone = 'maroon', loading, onClick }) => {
  const current = Number(kpi?.current) || 0;
  const previous = Number(kpi?.previous) || 0;
  const pct = kpi?.percentageChange;
  const delta = Number(kpi?.delta) || 0;
  const trend = kpi?.trend || 'neutral';
  const hasPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));

  let badgeText = '0%';
  let trendIcon = 'fa-minus';

  if (hasPct) {
    const numPct = Number(pct);
    badgeText = numPct > 0 ? `+${numPct}%` : `${numPct}%`;
    trendIcon = numPct > 0 ? 'fa-arrow-trend-up' : numPct < 0 ? 'fa-arrow-trend-down' : 'fa-minus';
  } else if (previous === 0 && current > 0) {
    badgeText = `+${delta.toLocaleString()} new`;
    trendIcon = 'fa-arrow-trend-up';
  } else {
    badgeText = 'No prior data';
    trendIcon = 'fa-minus';
  }

  return (
    <div
      className={`ov-kpi-card ov-kpi-${tone}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${current.toLocaleString()}. Click to view details.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="ov-kpi-top">
        <span className="ov-kpi-label">{label}</span>
        <div className={`ov-kpi-icon ov-icon-${tone}`} aria-hidden="true">
          <i className={`fa-solid ${icon}`}></i>
        </div>
      </div>

      <div className="ov-kpi-value">
        {loading ? (
          <div className="ov-skeleton ov-skeleton-val"></div>
        ) : (
          current.toLocaleString()
        )}
      </div>

      <div className="ov-kpi-comparison-row">
        {loading ? (
          <div className="ov-skeleton ov-skeleton-sub"></div>
        ) : (
          <>
            <span className={`ov-trend-pill ov-trend-${trend}`}>
              <i className={`fa-solid ${trendIcon}`} aria-hidden="true"></i>
              <span>{badgeText}</span>
            </span>
            <span className="ov-kpi-compare" title={`${kpi?.comparisonLabel || 'vs prior period'} (${previous.toLocaleString()})`}>
              {kpi?.comparisonLabel || 'vs prior period'} ({previous.toLocaleString()})
            </span>
          </>
        )}
      </div>

      <div className="ov-kpi-subtext">
        {loading ? <div className="ov-skeleton ov-skeleton-meta"></div> : subtext}
      </div>
    </div>
  );
};

const PublishingActivityChart = ({ data, loading, error, onRetry, periodLabel }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const series = Array.isArray(data?.series) ? data.series : [];
  const groupingLabel = getGroupingLabel(data?.grouping);

  const totalAnnouncements = series.reduce((sum, s) => sum + (Number(s.announcements) || 0), 0);
  const totalEvents = series.reduce((sum, s) => sum + (Number(s.events) || 0), 0);
  const hasAnyData = totalAnnouncements + totalEvents > 0;

  const rawMax = Math.max(
    0,
    ...series.map((s) => Math.max(Number(s.announcements) || 0, Number(s.events) || 0))
  );
  const maxVal = Math.max(4, Math.ceil(rawMax / 2) * 2);

  const width = 640;
  const height = 250;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx) => {
    if (series.length <= 1) return padL + plotW / 2;
    return padL + (idx / (series.length - 1)) * plotW;
  };
  const getY = (val) => padT + plotH - ((Number(val) || 0) / maxVal) * plotH;

  const annPoints =
    series.length === 1
      ? `${padL},${getY(series[0].announcements)} ${width - padR},${getY(series[0].announcements)}`
      : series.map((s, idx) => `${getX(idx)},${getY(s.announcements)}`).join(' ');

  const evtPoints =
    series.length === 1
      ? `${padL},${getY(series[0].events)} ${width - padR},${getY(series[0].events)}`
      : series.map((s, idx) => `${getX(idx)},${getY(s.events)}`).join(' ');

  const annAreaPoints =
    series.length > 1
      ? `${getX(0)},${padT + plotH} ${annPoints} ${getX(series.length - 1)},${padT + plotH}`
      : '';

  const maxLabels = 7;
  const labelStep = Math.max(1, Math.ceil(series.length / maxLabels));
  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];
  const uniqueYTicks = [...new Set(yTicks)];
  const hoveredItem = hoveredIdx !== null && series[hoveredIdx] ? series[hoveredIdx] : null;

  return (
    <section className="ov-card ov-chart-card" aria-label="Announcements and Events Activity">
      <div className="ov-card-header">
        <div className="ov-card-heading-group">
          <h2 className="ov-card-title">Announcements &amp; Events Activity</h2>
          <p className="ov-card-desc">
            {groupingLabel} activity ({totalAnnouncements.toLocaleString()} announcements, {totalEvents.toLocaleString()} events)
          </p>
        </div>
        <div className="ov-legend-inline" aria-label="Chart Legend">
          <span className="ov-legend-pill">
            <i className="ov-dot" style={{ background: '#7B0D1E' }}></i>
            Announcements ({totalAnnouncements})
          </span>
          <span className="ov-legend-pill">
            <i className="ov-dot" style={{ background: '#F5B400' }}></i>
            Events ({totalEvents})
          </span>
        </div>
      </div>

      <div className="ov-chart-body">
        {loading ? (
          <div className="ov-chart-skeleton">
            <div className="ov-skeleton ov-skeleton-chart"></div>
          </div>
        ) : error ? (
          <div className="ov-section-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>{error}</span>
            <button type="button" className="ov-btn ov-btn-secondary ov-btn-sm" onClick={onRetry}>
              <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
              <span>Retry</span>
            </button>
          </div>
        ) : series.length === 0 || !hasAnyData ? (
          <div className="ov-empty-box">
            <div className="ov-empty-icon-wrap" aria-hidden="true">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <h3 className="ov-empty-title">No publishing activity in this period</h3>
            <p className="ov-empty-desc">
              No announcements or events were created during {periodLabel || 'the selected date range'}.
            </p>
          </div>
        ) : (
          <div className="ov-line-chart-wrap" onMouseLeave={() => setHoveredIdx(null)}>
            {hoveredItem && (
              <div className="ov-chart-tooltip" role="status">
                <div className="ov-tooltip-title">{hoveredItem.label}</div>
                <div className="ov-tooltip-row">
                  <span className="ov-dot" style={{ background: '#7B0D1E' }}></span>
                  <span>Announcements:</span>
                  <strong>{hoveredItem.announcements}</strong>
                </div>
                <div className="ov-tooltip-row">
                  <span className="ov-dot" style={{ background: '#F5B400' }}></span>
                  <span>Events:</span>
                  <strong>{hoveredItem.events}</strong>
                </div>
              </div>
            )}

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="ov-svg-chart"
              role="img"
              aria-label="Announcements and Events Activity Line Chart"
            >
              <defs>
                <linearGradient id="ovAnnAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7B0D1E" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#7B0D1E" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines & Y-axis labels */}
              {uniqueYTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={width - padR}
                      y2={y}
                      stroke={tick === 0 ? '#cbd5e1' : '#e2e8f0'}
                      strokeDasharray={tick === 0 ? undefined : '4 4'}
                    />
                    <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fontWeight="500" fill="#64748b">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Area fill for Announcements */}
              {annAreaPoints && <polygon points={annAreaPoints} fill="url(#ovAnnAreaGrad)" />}

              {/* Series Lines */}
              <polyline
                fill="none"
                stroke="#7B0D1E"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={annPoints}
              />
              <polyline
                fill="none"
                stroke="#F5B400"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={evtPoints}
              />

              {/* Hover guide line */}
              {hoveredIdx !== null && series[hoveredIdx] && (
                <line
                  x1={getX(hoveredIdx)}
                  y1={padT}
                  x2={getX(hoveredIdx)}
                  y2={padT + plotH}
                  stroke="#94a3b8"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                />
              )}

              {/* Data Points & Hit Targets */}
              {series.map((s, idx) => {
                const cx = getX(idx);
                const cyAnn = getY(s.announcements);
                const cyEvt = getY(s.events);
                const isHovered = hoveredIdx === idx;
                const colW = series.length > 1 ? plotW / series.length : plotW;
                const showLabel = idx % labelStep === 0 || idx === series.length - 1;

                return (
                  <g key={s.key || idx}>
                    <circle
                      cx={cx}
                      cy={cyAnn}
                      r={isHovered ? 5 : 3.5}
                      fill="#7B0D1E"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={cx}
                      cy={cyEvt}
                      r={isHovered ? 5 : 3.5}
                      fill="#F5B400"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />

                    {showLabel && (
                      <text x={cx} y={height - 10} textAnchor="middle" fontSize="11" fontWeight="500" fill="#475569">
                        {s.label}
                      </text>
                    )}

                    <rect
                      x={cx - colW / 2}
                      y={padT}
                      width={Math.max(14, colW)}
                      height={plotH}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
};

const UserAndPageActivityChart = ({ data, loading, error, onRetry, periodLabel }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const series = Array.isArray(data?.series) ? data.series : [];
  const groupingLabel = getGroupingLabel(data?.grouping);

  const totalStudents = series.reduce((sum, s) => sum + (Number(s.students) || 0), 0);
  const totalStaff = series.reduce((sum, s) => sum + (Number(s.staff) || 0), 0);
  const totalPages = series.reduce((sum, s) => sum + (Number(s.pages) || 0), 0);
  const hasAnyData = totalStudents + totalStaff + totalPages > 0;

  const rawMax = Math.max(
    0,
    ...series.map((s) =>
      Math.max(Number(s.students) || 0, Number(s.staff) || 0, Number(s.pages) || 0)
    )
  );
  const maxVal = Math.max(4, Math.ceil(rawMax / 2) * 2);

  const width = 640;
  const height = 250;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx) => {
    if (series.length <= 1) return padL + plotW / 2;
    return padL + (idx / (series.length - 1)) * plotW;
  };
  const getY = (val) => padT + plotH - ((Number(val) || 0) / maxVal) * plotH;

  const studentPoints =
    series.length === 1
      ? `${padL},${getY(series[0].students)} ${width - padR},${getY(series[0].students)}`
      : series.map((s, idx) => `${getX(idx)},${getY(s.students)}`).join(' ');

  const staffPoints =
    series.length === 1
      ? `${padL},${getY(series[0].staff)} ${width - padR},${getY(series[0].staff)}`
      : series.map((s, idx) => `${getX(idx)},${getY(s.staff)}`).join(' ');

  const pagePoints =
    series.length === 1
      ? `${padL},${getY(series[0].pages)} ${width - padR},${getY(series[0].pages)}`
      : series.map((s, idx) => `${getX(idx)},${getY(s.pages)}`).join(' ');

  const maxLabels = 7;
  const labelStep = Math.max(1, Math.ceil(series.length / maxLabels));
  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];
  const uniqueYTicks = [...new Set(yTicks)];
  const hoveredItem = hoveredIdx !== null && series[hoveredIdx] ? series[hoveredIdx] : null;

  return (
    <section className="ov-card ov-chart-card" aria-label="User and Page Activity">
      <div className="ov-card-header">
        <div className="ov-card-heading-group">
          <h2 className="ov-card-title">User &amp; Page Activity</h2>
          <p className="ov-card-desc">
            {groupingLabel} registrations &amp; page growth ({totalStudents} students, {totalStaff} staff, {totalPages} pages)
          </p>
        </div>
        <div className="ov-legend-inline" aria-label="Chart Legend">
          <span className="ov-legend-pill">
            <i className="ov-dot" style={{ background: '#7B0D1E' }}></i>
            Students ({totalStudents})
          </span>
          <span className="ov-legend-pill">
            <i className="ov-dot" style={{ background: '#3D0610' }}></i>
            Staff ({totalStaff})
          </span>
          <span className="ov-legend-pill">
            <i className="ov-dot" style={{ background: '#F5B400' }}></i>
            Pages ({totalPages})
          </span>
        </div>
      </div>

      <div className="ov-chart-body">
        {loading ? (
          <div className="ov-chart-skeleton">
            <div className="ov-skeleton ov-skeleton-chart"></div>
          </div>
        ) : error ? (
          <div className="ov-section-error" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>{error}</span>
            <button type="button" className="ov-btn ov-btn-secondary ov-btn-sm" onClick={onRetry}>
              <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
              <span>Retry</span>
            </button>
          </div>
        ) : series.length === 0 || !hasAnyData ? (
          <div className="ov-empty-box">
            <div className="ov-empty-icon-wrap" aria-hidden="true">
              <i className="fa-solid fa-users"></i>
            </div>
            <h3 className="ov-empty-title">No user or page activity in this period</h3>
            <p className="ov-empty-desc">
              No student registrations, staff assignments, or page creations were recorded during {periodLabel || 'the selected date range'}.
            </p>
          </div>
        ) : (
          <div className="ov-line-chart-wrap" onMouseLeave={() => setHoveredIdx(null)}>
            {hoveredItem && (
              <div className="ov-chart-tooltip" role="status">
                <div className="ov-tooltip-title">{hoveredItem.label}</div>
                <div className="ov-tooltip-row">
                  <span className="ov-dot" style={{ background: '#7B0D1E' }}></span>
                  <span>Students:</span>
                  <strong>{hoveredItem.students}</strong>
                </div>
                <div className="ov-tooltip-row">
                  <span className="ov-dot" style={{ background: '#3D0610' }}></span>
                  <span>Staff Assigned:</span>
                  <strong>{hoveredItem.staff}</strong>
                </div>
                <div className="ov-tooltip-row">
                  <span className="ov-dot" style={{ background: '#F5B400' }}></span>
                  <span>Pages Created:</span>
                  <strong>{hoveredItem.pages}</strong>
                </div>
              </div>
            )}

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="ov-svg-chart"
              role="img"
              aria-label="User and Page Activity Multi-Series Line Chart"
            >
              {uniqueYTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={width - padR}
                      y2={y}
                      stroke={tick === 0 ? '#cbd5e1' : '#e2e8f0'}
                      strokeDasharray={tick === 0 ? undefined : '4 4'}
                    />
                    <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fontWeight="500" fill="#64748b">
                      {tick}
                    </text>
                  </g>
                );
              })}

              <polyline
                fill="none"
                stroke="#7B0D1E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={studentPoints}
              />
              <polyline
                fill="none"
                stroke="#3D0610"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={staffPoints}
              />
              <polyline
                fill="none"
                stroke="#F5B400"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pagePoints}
              />

              {hoveredIdx !== null && series[hoveredIdx] && (
                <line
                  x1={getX(hoveredIdx)}
                  y1={padT}
                  x2={getX(hoveredIdx)}
                  y2={padT + plotH}
                  stroke="#94a3b8"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                />
              )}

              {series.map((s, idx) => {
                const x = getX(idx);
                const yStu = getY(s.students);
                const yStf = getY(s.staff);
                const yPag = getY(s.pages);
                const isHovered = hoveredIdx === idx;
                const showLabel = idx % labelStep === 0 || idx === series.length - 1;
                const colW = series.length > 1 ? plotW / series.length : plotW;

                return (
                  <g key={s.key || idx}>
                    <circle cx={x} cy={yStu} r={isHovered ? 5 : 3.5} fill="#7B0D1E" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx={x} cy={yStf} r={isHovered ? 5 : 3.5} fill="#3D0610" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx={x} cy={yPag} r={isHovered ? 5 : 3.5} fill="#F5B400" stroke="#ffffff" strokeWidth="1.5" />

                    {showLabel && (
                      <text x={x} y={height - 10} textAnchor="middle" fontSize="11" fontWeight="500" fill="#475569">
                        {s.label}
                      </text>
                    )}

                    <rect
                      x={x - colW / 2}
                      y={padT}
                      width={Math.max(14, colW)}
                      height={plotH}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  // School Year & Live Date-Range Filter State
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('active');
  const [activePreset, setActivePreset] = useState('school_year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [filterError, setFilterError] = useState('');

  // Overview Data State
  const [overviewData, setOverviewData] = useState({
    kpis: {
      totalAnnouncements: { current: 0, previous: 0, delta: 0, percentageChange: null, trend: 'neutral', publishedCount: 0 },
      totalEvents: { current: 0, previous: 0, delta: 0, percentageChange: null, trend: 'neutral', upcomingCount: 0 },
      pendingApprovals: { current: 0, previous: 0, delta: 0, percentageChange: null, trend: 'neutral', pendingPosts: 0, pendingPages: 0 },
      approvedPages: { current: 0, previous: 0, delta: 0, percentageChange: null, trend: 'neutral', totalActivePages: 0 }
    },
    publishingActivity: { grouping: 'monthly', series: [] },
    userAndPageActivity: { grouping: 'monthly', series: [] },
    announcementStatusDistribution: [],
    academicYears: [],
    activeAcademicYear: null,
    selectedAcademicYear: null,
    reportingPeriod: null
  });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // Recent Administrative Activity Table State
  const [activityItems, setActivityItems] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit, setActivityLimit] = useState(10);
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });

  // Request cancellation ref to prevent duplicate/stale concurrent requests
  const abortControllerRef = useRef(null);

  // Live Custom Range Validation & Debounced Application
  useEffect(() => {
    if (activePreset !== 'custom') return;

    if (!customStartDate || !customEndDate) {
      setFilterError('');
      return;
    }

    if (customEndDate < customStartDate) {
      setFilterError('End Date cannot be earlier than Start Date.');
      return;
    }

    setFilterError('');
    if (customStartDate === appliedStartDate && customEndDate === appliedEndDate) {
      return;
    }

    const timer = setTimeout(() => {
      setAppliedStartDate(customStartDate);
      setAppliedEndDate(customEndDate);
      setActivityPage(1);
    }, 250);

    return () => clearTimeout(timer);
  }, [activePreset, customStartDate, customEndDate, appliedStartDate, appliedEndDate]);

  // Fetch Overview Data (KPIs, 2 Charts, Activity Table, School Years)
  const fetchOverview = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setOverviewLoading(true);
    setOverviewError(null);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
      const params = new URLSearchParams({
        academicYearId: selectedAcademicYear,
        activityPage: String(activityPage),
        activityLimit: String(activityLimit)
      });
      if (appliedStartDate && appliedEndDate) {
        params.append('startDate', appliedStartDate);
        params.append('endDate', appliedEndDate);
      }

      const response = await fetch(`/api/admin/overview?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load administrator overview.');
      }

      setOverviewData({
        kpis: data.kpis || {},
        publishingActivity: data.publishingActivity || { grouping: 'monthly', series: [] },
        userAndPageActivity: data.userAndPageActivity || { grouping: 'monthly', series: [] },
        announcementStatusDistribution: data.announcementStatusDistribution || [],
        academicYears: data.academicYears || [],
        activeAcademicYear: data.activeAcademicYear || null,
        selectedAcademicYear: data.selectedAcademicYear || null,
        reportingPeriod: data.reportingPeriod || null
      });
      setActivityItems(data.recentActivity?.items || []);
      const nextPag = data.recentActivity?.pagination || {
        page: 1,
        limit: activityLimit,
        total: 0,
        totalPages: 1
      };
      setActivityPagination(nextPag);
      if (nextPag.page && nextPag.page !== activityPage) {
        setActivityPage(nextPag.page);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Overview fetch error:', err);
      setOverviewError(err.message || 'Unable to connect to administrative overview service.');
    } finally {
      if (abortControllerRef.current === controller) {
        setOverviewLoading(false);
      }
    }
  }, [navigate, selectedAcademicYear, appliedStartDate, appliedEndDate, activityPage, activityLimit]);

  useEffect(() => {
    fetchOverview();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOverview]);

  const handlePresetChange = (e) => {
    const nextPreset = e.target.value;
    setFilterError('');
    setActivePreset(nextPreset);

    if (nextPreset === 'custom') {
      const fallbackStart = appliedStartDate || overviewData.reportingPeriod?.startDate || toLocalIsoDate(new Date());
      const fallbackEnd = appliedEndDate || overviewData.reportingPeriod?.endDate || toLocalIsoDate(new Date());
      setCustomStartDate(fallbackStart);
      setCustomEndDate(fallbackEnd);
      return;
    }

    const { startDate, endDate } = computePresetDates(nextPreset);
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setActivityPage(1);
  };

  const handleAcademicYearChange = (e) => {
    const nextYear = e.target.value;
    setSelectedAcademicYear(nextYear);
    setFilterError('');
    if (activePreset !== 'school_year') {
      setActivePreset('school_year');
      setCustomStartDate('');
      setCustomEndDate('');
      setAppliedStartDate('');
      setAppliedEndDate('');
    }
    setActivityPage(1);
  };

  const displayedYear = overviewData.selectedAcademicYear || overviewData.activeAcademicYear;
  const periodStartStr = overviewData.reportingPeriod?.startDate;
  const periodEndStr = overviewData.reportingPeriod?.endDate;
  const formattedPeriodLabel =
    periodStartStr && periodEndStr
      ? periodStartStr === periodEndStr
        ? formatShortDate(periodStartStr)
        : `${formatShortDate(periodStartStr)} – ${formatShortDate(periodEndStr)}`
      : '';

  return (
    <AdminLayout>
      <div className="admin-overview-wrapper">
        {/* ================= 1. COMPACT PAGE HEADER & LIVE FILTER BAR ================= */}
        <header className="ov-header-card">
          <div className="ov-header-top">
            <div className="ov-header-titles">
              <div className="ov-title-row">
                <h1 className="overview-title">Overview</h1>
                {displayedYear && (
                  <button
                    type="button"
                    className={`overview-sy-pill ${displayedYear.is_active ? 'is-active' : 'is-archived'}`}
                    onClick={() => navigate('/admin/settings?tab=academic-year')}
                    title="Manage School Years in System Settings"
                  >
                    <i className="fa-solid fa-graduation-cap" aria-hidden="true"></i>
                    <span>
                      SY {displayedYear.start_year}–{displayedYear.end_year} ({displayedYear.semester})
                    </span>
                    <span className="ov-sy-status-dot" aria-hidden="true"></span>
                    <span>{displayedYear.status || (displayedYear.is_active ? 'Active' : 'Archived')}</span>
                  </button>
                )}
              </div>
              <p className="overview-subtitle">
                Monitor campus announcements, events, and administrative activities.
              </p>
            </div>

            <div className="ov-filter-controls" role="region" aria-label="Dashboard Filters">
              {/* School Year Selector */}
              <div className="ov-control-group">
                <label htmlFor="ov-sy-select" className="ov-control-label">
                  School Year
                </label>
                <div className="ov-select-wrap">
                  <i className="fa-solid fa-calendar-check ov-select-icon" aria-hidden="true"></i>
                  <select
                    id="ov-sy-select"
                    className="ov-select"
                    value={selectedAcademicYear}
                    onChange={handleAcademicYearChange}
                    aria-label="Select School Year"
                  >
                    <option value="active">
                      Active School Year
                      {overviewData.activeAcademicYear
                        ? ` (${overviewData.activeAcademicYear.start_year}–${overviewData.activeAcademicYear.end_year})`
                        : ''}
                    </option>
                    {overviewData.academicYears.map((ay) => (
                      <option key={ay.id} value={String(ay.id)}>
                        SY {ay.start_year}–{ay.end_year} ({ay.semester}) — {ay.status || (ay.is_active ? 'Active' : 'Archived')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Single Date-Range Dropdown */}
              <div className="ov-control-group">
                <label htmlFor="ov-date-preset-select" className="ov-control-label">
                  Date Range
                </label>
                <div className="ov-select-wrap">
                  <i className="fa-regular fa-calendar ov-select-icon" aria-hidden="true"></i>
                  <select
                    id="ov-date-preset-select"
                    className="ov-select"
                    value={activePreset}
                    onChange={handlePresetChange}
                    aria-label="Select Reporting Date Range"
                  >
                    {DATE_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Range Inputs (Only visible when Custom Range is selected) */}
              {activePreset === 'custom' && (
                <div className="ov-custom-dates-group">
                  <div className="ov-control-group">
                    <label htmlFor="ov-custom-start" className="ov-control-label">
                      Start Date
                    </label>
                    <input
                      id="ov-custom-start"
                      type="date"
                      className="ov-date-input"
                      value={customStartDate}
                      max={customEndDate || undefined}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>

                  <div className="ov-control-group">
                    <label htmlFor="ov-custom-end" className="ov-control-label">
                      End Date
                    </label>
                    <input
                      id="ov-custom-end"
                      type="date"
                      className="ov-date-input"
                      value={customEndDate}
                      min={customStartDate || undefined}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Reporting Period Sub-bar / Validation Feedback */}
          <div className="ov-header-meta-bar">
            <div className="ov-period-summary">
              <i className="fa-regular fa-clock" aria-hidden="true"></i>
              <span>Showing data for:</span>
              <strong>{formattedPeriodLabel || 'Active School Year'}</strong>
              {overviewLoading && (
                <span className="ov-live-updating-badge" aria-live="polite">
                  <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
                  Updating…
                </span>
              )}
            </div>

            {filterError && (
              <div className="ov-inline-error" role="alert">
                <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                <span>{filterError}</span>
              </div>
            )}
          </div>
        </header>

        {/* OVERVIEW API ERROR BANNER */}
        {overviewError && (
          <div className="overview-alert-banner" role="alert">
            <div className="alert-content">
              <i className="fa-solid fa-triangle-exclamation alert-icon" aria-hidden="true"></i>
              <span>{overviewError}</span>
            </div>
            <button type="button" className="ov-btn ov-btn-primary ov-btn-sm" onClick={fetchOverview}>
              <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* ================= 2. FOUR KPI STATISTICS CARDS ================= */}
        <section className="ov-kpi-grid" aria-label="Key Performance Indicators">
          <OverviewStatCard
            label="Total Announcements"
            kpi={overviewData.kpis?.totalAnnouncements}
            subtext={`${(overviewData.kpis?.totalAnnouncements?.publishedCount ?? 0).toLocaleString()} currently published`}
            icon="fa-bullhorn"
            tone="maroon"
            loading={overviewLoading}
            onClick={() => navigate('/admin/content-feed?tab=announcements')}
          />

          <OverviewStatCard
            label="Total Events"
            kpi={overviewData.kpis?.totalEvents}
            subtext={`${(overviewData.kpis?.totalEvents?.upcomingCount ?? 0).toLocaleString()} upcoming or active`}
            icon="fa-calendar-days"
            tone="gold"
            loading={overviewLoading}
            onClick={() => navigate('/admin/content-feed?tab=events')}
          />

          <OverviewStatCard
            label="Pending Approvals"
            kpi={overviewData.kpis?.pendingApprovals}
            subtext={`${overviewData.kpis?.pendingApprovals?.pendingPosts ?? 0} post approvals • ${overviewData.kpis?.pendingApprovals?.pendingPages ?? 0} page requests`}
            icon="fa-clock"
            tone="amber"
            loading={overviewLoading}
            onClick={() => navigate('/admin/post-approval?tab=pending')}
          />

          <OverviewStatCard
            label="Approved Pages"
            kpi={overviewData.kpis?.approvedPages}
            subtext={`Approved in period • ${overviewData.kpis?.approvedPages?.totalActivePages ?? 0} active total`}
            icon="fa-building-columns"
            tone="deep"
            loading={overviewLoading}
            onClick={() => navigate('/admin/pages?tab=active')}
          />
        </section>

        {/* ================= 3. TWO ANALYTICS GRAPHS ================= */}
        <div className="ov-charts-grid">
          <PublishingActivityChart
            data={overviewData.publishingActivity}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
            periodLabel={formattedPeriodLabel}
          />

          <UserAndPageActivityChart
            data={overviewData.userAndPageActivity}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
            periodLabel={formattedPeriodLabel}
          />
        </div>

        {/* ================= 4. RECENT ADMINISTRATIVE ACTIVITY TABLE ================= */}
        <section className="ov-card ov-activity-card" aria-label="Recent Administrative Activity">
          <div className="ov-card-header ov-activity-header">
            <div className="ov-card-heading-group">
              <h2 className="ov-card-title">Recent Administrative Activity</h2>
              <p className="ov-card-desc">
                Chronological record of verified system and administrative actions.
              </p>
            </div>

            <div className="ov-activity-actions">
              <button
                type="button"
                className="ov-btn ov-btn-secondary"
                onClick={() => navigate('/admin/audit-logs')}
              >
                <span>View All</span>
                <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {overviewLoading ? (
            <div className="ov-table-skeleton">
              <div className="ov-skeleton ov-skeleton-row"></div>
              <div className="ov-skeleton ov-skeleton-row"></div>
              <div className="ov-skeleton ov-skeleton-row"></div>
              <div className="ov-skeleton ov-skeleton-row"></div>
            </div>
          ) : overviewError ? (
            <div className="ov-section-error" role="alert">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <span>{overviewError}</span>
              <button type="button" className="ov-btn ov-btn-secondary ov-btn-sm" onClick={fetchOverview}>
                <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
                <span>Retry</span>
              </button>
            </div>
          ) : activityItems.length === 0 ? (
            <div className="ov-empty-box compact">
              <div className="ov-empty-icon-wrap" aria-hidden="true">
                <i className="fa-solid fa-clipboard-list"></i>
              </div>
              <h3 className="ov-empty-title">No administrative activity found</h3>
              <p className="ov-empty-desc">
                No verified system or administrative actions were recorded during {formattedPeriodLabel || 'this period'}.
              </p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="ov-activity-table">
                  <thead>
                    <tr>
                      <th className="col-activity">Activity</th>
                      <th className="col-actor">Actor</th>
                      <th className="col-category">Category</th>
                      <th className="col-resource">Affected Resource</th>
                      <th className="col-datetime">Date &amp; Time</th>
                      <th className="col-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityItems.map((act) => {
                      const catSlug = String(act.category || act.recordType || 'system')
                        .toLowerCase()
                        .replace(/\s+/g, '-');
                      const roleLabel = String(act.actorRole || 'system').toUpperCase();
                      const outcomeSlug = String(act.outcome || 'SUCCESS').toLowerCase();

                      return (
                        <tr key={act.id}>
                          <td className="col-activity">
                            <span className="ov-act-name">{act.activity}</span>
                          </td>
                          <td className="col-actor">
                            <div className="ov-actor-cell">
                              <span className="ov-actor-name">{act.actor || act.performedBy}</span>
                              <span className="ov-actor-role">{roleLabel}</span>
                            </div>
                          </td>
                          <td className="col-category">
                            <span className={`ov-category-badge cat-${catSlug}`}>
                              {act.category || act.recordType}
                            </span>
                          </td>
                          <td className="col-resource">
                            <span className="ov-resource-text" title={act.affectedResource}>
                              {act.affectedResource || 'System Portal'}
                            </span>
                          </td>
                          <td className="col-datetime ov-nowrap">
                            {formatDateTime(act.createdAt)}
                          </td>
                          <td className="col-status">
                            <span className={`ov-act-status ov-act-${outcomeSlug}`}>
                              <i
                                className={`fa-solid ${
                                  outcomeSlug === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'
                                }`}
                                aria-hidden="true"
                              ></i>
                              <span>{act.status}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={activityPagination.page}
                totalPages={activityPagination.totalPages}
                totalRecords={activityPagination.total}
                pageSize={activityPagination.limit}
                loading={overviewLoading}
                itemLabel="activities"
                onPageChange={(page) => setActivityPage(page)}
                onPageSizeChange={(limit) => {
                  setActivityLimit(limit);
                  setActivityPage(1);
                }}
              />
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
