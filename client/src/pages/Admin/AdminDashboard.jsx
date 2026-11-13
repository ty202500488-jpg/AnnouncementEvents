import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import '../styles/Overview.css';

const STATUS_COLORS = {
  Published: '#7B0D1E',
  Pending: '#f5b400',
  Rejected: '#dc2626',
  Archived: '#64748b'
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

const OverviewStatCard = ({ label, kpi, subtext, icon, tone = 'maroon', loading, onClick }) => {
  const pct = kpi?.percentageChange;
  const trend = kpi?.trend || 'neutral';
  const hasPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));

  return (
    <div
      className={`ov-kpi-card ov-kpi-${tone}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="ov-kpi-top">
        <span className="ov-kpi-label">{label}</span>
        <div className={`ov-kpi-icon ov-icon-${tone}`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
      </div>

      <div className="ov-kpi-value">
        {loading ? <div className="ov-skeleton ov-skeleton-val"></div> : (kpi?.current ?? 0).toLocaleString()}
      </div>

      <div className="ov-kpi-footer">
        {loading ? (
          <div className="ov-skeleton ov-skeleton-sub"></div>
        ) : (
          <>
            <span className={`ov-trend-pill ov-trend-${trend}`}>
              {hasPct ? (
                <>
                  <i className={`fa-solid ${trend === 'up' ? 'fa-arrow-trend-up' : trend === 'down' ? 'fa-arrow-trend-down' : 'fa-minus'}`}></i>
                  {pct > 0 ? `+${pct}%` : `${pct}%`}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-minus"></i>
                  {kpi?.comparisonLabel || 'First period'}
                </>
              )}
            </span>
            <span className="ov-kpi-compare">
              {hasPct
                ? `${kpi?.comparisonLabel || 'vs prior'} (${(kpi?.previous ?? 0).toLocaleString()})`
                : subtext}
            </span>
          </>
        )}
      </div>

      {!loading && hasPct && subtext && (
        <div className="ov-kpi-subtext">{subtext}</div>
      )}
    </div>
  );
};

const PublishingActivityChart = ({ data, loading, error, onRetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const series = Array.isArray(data?.series) ? data.series : [];
  const groupingLabel =
    data?.grouping === 'daily' ? 'Daily' : data?.grouping === 'weekly' ? 'Weekly' : 'Monthly';

  const maxVal = Math.max(
    4,
    ...series.map((s) => Math.max(Number(s.announcements) || 0, Number(s.events) || 0))
  );

  // SVG dimensions
  const width = 640;
  const height = 240;
  const padL = 42;
  const padR = 20;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx) => {
    if (series.length <= 1) return padL + plotW / 2;
    return padL + (idx / (series.length - 1)) * plotW;
  };
  const getY = (val) => padT + plotH - ((Number(val) || 0) / maxVal) * plotH;

  const annPoints = series.map((s, idx) => `${getX(idx)},${getY(s.announcements)}`).join(' ');
  const evtPoints = series.map((s, idx) => `${getX(idx)},${getY(s.events)}`).join(' ');

  // Thin out x-axis labels so they never overlap
  const maxLabels = 7;
  const labelStep = Math.max(1, Math.ceil(series.length / maxLabels));
  const yTicks = [0, Math.ceil(maxVal * 0.5), maxVal];
  const hasAnyData = series.some((s) => (s.announcements || 0) > 0 || (s.events || 0) > 0);
  const hoveredItem = hoveredIdx !== null ? series[hoveredIdx] : null;

  return (
    <section className="ov-card ov-chart-card">
      <div className="ov-card-header">
        <div>
          <h2 className="ov-card-title">Announcements &amp; Events Activity</h2>
          <p className="ov-card-desc">
            {groupingLabel} announcement and event creation &amp; publishing activity
          </p>
        </div>
        <div className="ov-legend-inline">
          <span><i className="ov-dot" style={{ background: '#7B0D1E' }}></i> Announcements</span>
          <span><i className="ov-dot" style={{ background: '#f5b400' }}></i> Events</span>
        </div>
      </div>

      {loading ? (
        <div className="ov-chart-skeleton">
          <div className="ov-skeleton ov-skeleton-chart"></div>
        </div>
      ) : error ? (
        <div className="ov-section-error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{error}</span>
          <button type="button" className="ov-btn-ghost" onClick={onRetry}>Retry</button>
        </div>
      ) : series.length === 0 ? (
        <div className="ov-empty-box">
          <i className="fa-solid fa-chart-line"></i>
          <p>No reporting buckets available for the selected date range.</p>
        </div>
      ) : (
        <div className="ov-line-chart-wrap" onMouseLeave={() => setHoveredIdx(null)}>
          {!hasAnyData && (
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 500 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '0.35rem', color: '#7B0D1E' }}></i>
              0 published announcements or events in this period (baseline shown below).
            </div>
          )}
          {hoveredItem && (
            <div className="ov-chart-tooltip">
              <div className="ov-tooltip-title">{hoveredItem.label}</div>
              <div className="ov-tooltip-row">
                <span className="ov-dot" style={{ background: '#7B0D1E' }}></span>
                <span>Announcements: <strong>{hoveredItem.announcements}</strong></span>
              </div>
              <div className="ov-tooltip-row">
                <span className="ov-dot" style={{ background: '#f5b400' }}></span>
                <span>Events: <strong>{hoveredItem.events}</strong></span>
              </div>
            </div>
          )}

          <svg viewBox={`0 0 ${width} ${height}`} className="ov-svg-chart" role="img" aria-label="Announcement and Event Publishing Activity">
            {/* Horizontal grid lines */}
            {yTicks.map((tick, i) => {
              const y = getY(tick);
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Lines */}
            {series.length > 1 && (
              <>
                <polyline fill="none" stroke="#7B0D1E" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" points={annPoints} />
                <polyline fill="none" stroke="#f5b400" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" points={evtPoints} />
              </>
            )}

            {/* Hover vertical guide */}
            {hoveredIdx !== null && (
              <line
                x1={getX(hoveredIdx)}
                y1={padT}
                x2={getX(hoveredIdx)}
                y2={padT + plotH}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            )}

            {/* Points & invisible hover columns */}
            {series.map((s, idx) => {
              const cx = getX(idx);
              const cyAnn = getY(s.announcements);
              const cyEvt = getY(s.events);
              const isHovered = hoveredIdx === idx;
              const colW = series.length > 1 ? plotW / series.length : plotW;

              return (
                <g key={s.key || idx}>
                  <circle cx={cx} cy={cyAnn} r={isHovered ? 5.5 : 3.5} fill="#7B0D1E" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx={cx} cy={cyEvt} r={isHovered ? 5.5 : 3.5} fill="#f5b400" stroke="#ffffff" strokeWidth="1.5" />

                  {(idx % labelStep === 0 || idx === series.length - 1) && (
                    <text x={cx} y={height - 10} textAnchor="middle" fontSize="10.5" fill="#64748b">
                      {s.label}
                    </text>
                  )}

                  <rect
                    x={cx - colW / 2}
                    y={padT}
                    width={Math.max(12, colW)}
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
    </section>
  );
};

const UserAndPageActivityChart = ({ data, loading, error, onRetry }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const series = Array.isArray(data?.series) ? data.series : [];
  const groupingLabel =
    data?.grouping === 'daily' ? 'Daily' : data?.grouping === 'weekly' ? 'Weekly' : 'Monthly';

  const maxVal = Math.max(
    4,
    ...series.map((s) =>
      Math.max(Number(s.students) || 0, Number(s.staff) || 0, Number(s.pages) || 0)
    )
  );

  const totalStudents = series.reduce((sum, s) => sum + (Number(s.students) || 0), 0);
  const totalStaff = series.reduce((sum, s) => sum + (Number(s.staff) || 0), 0);
  const totalPages = series.reduce((sum, s) => sum + (Number(s.pages) || 0), 0);
  const hasAnyData = totalStudents + totalStaff + totalPages > 0;

  const width = 640;
  const height = 240;
  const padL = 42;
  const padR = 20;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx) => {
    if (series.length <= 1) return padL + plotW / 2;
    return padL + (idx / (series.length - 1)) * plotW;
  };
  const getY = (val) => padT + plotH - ((Number(val) || 0) / maxVal) * plotH;

  const studentPoints = series.map((s, idx) => `${getX(idx)},${getY(s.students)}`).join(' ');
  const staffPoints = series.map((s, idx) => `${getX(idx)},${getY(s.staff)}`).join(' ');
  const pagePoints = series.map((s, idx) => `${getX(idx)},${getY(s.pages)}`).join(' ');

  const maxLabels = 7;
  const labelStep = Math.max(1, Math.ceil(series.length / maxLabels));
  const yTicks = [0, Math.ceil(maxVal * 0.5), maxVal];
  const hoveredItem = hoveredIdx !== null ? series[hoveredIdx] : null;

  return (
    <section className="ov-card ov-chart-card">
      <div className="ov-card-header">
        <div>
          <h2 className="ov-card-title">User &amp; Page Activity</h2>
          <p className="ov-card-desc">
            {groupingLabel} student registrations ({totalStudents}), staff assignments ({totalStaff}), and pages created ({totalPages})
          </p>
        </div>
        <div className="ov-legend-inline">
          <span><i className="ov-dot" style={{ background: '#7B0D1E' }}></i> Students</span>
          <span><i className="ov-dot" style={{ background: '#0284c7' }}></i> Staff</span>
          <span><i className="ov-dot" style={{ background: '#059669' }}></i> Pages</span>
        </div>
      </div>

      {loading ? (
        <div className="ov-chart-skeleton">
          <div className="ov-skeleton ov-skeleton-chart"></div>
        </div>
      ) : error ? (
        <div className="ov-section-error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{error}</span>
          <button type="button" className="ov-btn-ghost" onClick={onRetry}>Retry</button>
        </div>
      ) : series.length === 0 ? (
        <div className="ov-empty-box">
          <i className="fa-solid fa-users"></i>
          <p>No user or page activity buckets available for the selected date range.</p>
        </div>
      ) : (
        <div className="ov-line-chart-wrap" onMouseLeave={() => setHoveredIdx(null)}>
          {!hasAnyData && (
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 500 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '0.35rem', color: '#7B0D1E' }}></i>
              0 new user registrations or page creations recorded in this period (baseline shown below).
            </div>
          )}
          {hoveredItem && (
            <div className="ov-chart-tooltip">
              <div className="ov-tooltip-title">{hoveredItem.label}</div>
              <div className="ov-tooltip-row">
                <span className="ov-dot" style={{ background: '#7B0D1E' }}></span>
                <span>Students: <strong>{hoveredItem.students}</strong></span>
              </div>
              <div className="ov-tooltip-row">
                <span className="ov-dot" style={{ background: '#0284c7' }}></span>
                <span>Staff: <strong>{hoveredItem.staff}</strong></span>
              </div>
              <div className="ov-tooltip-row">
                <span className="ov-dot" style={{ background: '#059669' }}></span>
                <span>Pages: <strong>{hoveredItem.pages}</strong></span>
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="ov-svg-chart"
            role="img"
            aria-label="User and Page Activity Over Time"
          >
            {yTicks.map((tick, i) => {
              const y = getY(tick);
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                    {tick}
                  </text>
                </g>
              );
            })}

            {series.length > 1 && (
              <>
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
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={staffPoints}
                />
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pagePoints}
                />
              </>
            )}

            {series.map((s, idx) => {
              const x = getX(idx);
              const yStu = getY(s.students);
              const yStf = getY(s.staff);
              const yPag = getY(s.pages);
              const showLabel = idx % labelStep === 0 || idx === series.length - 1;
              const colW = series.length > 1 ? plotW / (series.length - 1) : plotW;

              return (
                <g key={s.key || idx}>
                  {hoveredIdx === idx && (
                    <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#cbd5e1" strokeWidth="1.5" />
                  )}
                  <circle cx={x} cy={yStu} r={hoveredIdx === idx ? 5 : 3.5} fill="#7B0D1E" stroke="#fff" strokeWidth="1.5" />
                  <circle cx={x} cy={yStf} r={hoveredIdx === idx ? 5 : 3.5} fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
                  <circle cx={x} cy={yPag} r={hoveredIdx === idx ? 5 : 3.5} fill="#059669" stroke="#fff" strokeWidth="1.5" />

                  {showLabel && (
                    <text x={x} y={height - 10} textAnchor="middle" fontSize="10.5" fill="#475569">
                      {s.label}
                    </text>
                  )}

                  <rect
                    x={x - colW / 2}
                    y={padT}
                    width={Math.max(12, colW)}
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
    </section>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  // School Year & Date Range Filter State
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('active');
  const [activePreset, setActivePreset] = useState('school_year');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [filterError, setFilterError] = useState('');

  // Overview Data State
  const [overviewData, setOverviewData] = useState({
    kpis: {
      totalAnnouncements: { current: 0, previous: 0, percentageChange: null, trend: 'neutral', publishedCount: 0 },
      totalEvents: { current: 0, previous: 0, percentageChange: null, trend: 'neutral', upcomingCount: 0 },
      pendingApprovals: { current: 0, previous: 0, percentageChange: null, trend: 'neutral', pendingPosts: 0, pendingPages: 0 },
      approvedPages: { current: 0, previous: 0, percentageChange: null, trend: 'neutral' }
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

  // Combined Administrative Activity Table State
  const [activityItems, setActivityItems] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit, setActivityLimit] = useState(10);
  const [activityPagination, setActivityPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [activitySearch, setActivitySearch] = useState('');

  // Fetch Overview Data (KPIs, 2 Charts, Activity Table, School Years)
  const fetchOverview = useCallback(async () => {
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
      if (activitySearch.trim()) {
        params.append('activitySearch', activitySearch.trim());
      }

      const response = await fetch(`/api/admin/overview?${params.toString()}`, {
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
      setActivityPagination(
        data.recentActivity?.pagination || { page: 1, limit: activityLimit, total: 0, totalPages: 1 }
      );
    } catch (err) {
      console.error('Overview fetch error:', err);
      setOverviewError(err.message || 'Unable to connect to administrative overview service.');
    } finally {
      setOverviewLoading(false);
    }
  }, [navigate, selectedAcademicYear, appliedStartDate, appliedEndDate, activityPage, activityLimit, activitySearch]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Date Preset Computation Helper (Local YYYY-MM-DD)
  const toIsoDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSelectDatePreset = (presetKey) => {
    setFilterError('');
    setActivePreset(presetKey);
    const now = new Date();
    const todayStr = toIsoDate(now);

    if (presetKey === 'custom') {
      return;
    }

    if (presetKey === 'school_year') {
      setDraftStartDate('');
      setDraftEndDate('');
      setAppliedStartDate('');
      setAppliedEndDate('');
      setActivityPage(1);
      return;
    }

    let startStr = todayStr;
    let endStr = todayStr;

    if (presetKey === 'today') {
      startStr = todayStr;
      endStr = todayStr;
    } else if (presetKey === 'last_7_days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      startStr = toIsoDate(start);
    } else if (presetKey === 'last_30_days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      startStr = toIsoDate(start);
    } else if (presetKey === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startStr = toIsoDate(start);
      endStr = toIsoDate(end);
    } else if (presetKey === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      startStr = toIsoDate(start);
      endStr = toIsoDate(end);
    } else if (presetKey === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      startStr = toIsoDate(start);
      endStr = toIsoDate(end);
    }

    setDraftStartDate(startStr);
    setDraftEndDate(endStr);
    setAppliedStartDate(startStr);
    setAppliedEndDate(endStr);
    setActivityPage(1);
  };

  // Date Range Filter Handlers
  const handleApplyDateFilters = (e) => {
    e.preventDefault();
    setFilterError('');

    if (!draftStartDate && !draftEndDate) {
      setAppliedStartDate('');
      setAppliedEndDate('');
      setActivePreset('school_year');
      setActivityPage(1);
      return;
    }

    if (!draftStartDate || !draftEndDate) {
      setFilterError('Please select both a Start Date and an End Date.');
      return;
    }

    if (draftStartDate > draftEndDate) {
      setFilterError('Start Date cannot be later than End Date.');
      return;
    }

    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setActivityPage(1);
  };

  const handleResetFilters = () => {
    setFilterError('');
    setActivePreset('school_year');
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setActivitySearch('');
    setSelectedAcademicYear('active');
    setActivityPage(1);
  };

  const displayedYear = overviewData.selectedAcademicYear || overviewData.activeAcademicYear;

  return (
    <AdminLayout>
      <div className="admin-overview-wrapper">
        {/* ================= 1. OVERVIEW HEADER ================= */}
        <header className="ov-header">
          <div>
            <h1 className="overview-title">Overview</h1>
            <p className="overview-subtitle">
              Monitor campus announcements, events, and administrative activities.
            </p>
          </div>

          <div className="ov-header-sy">
            {displayedYear && (
              <span
                className="overview-sy-pill"
                onClick={() => navigate('/admin/settings?tab=academic-year')}
                title="Manage School Years in System Settings"
              >
                <i className="fa-solid fa-graduation-cap"></i>
                SY {displayedYear.start_year}–{displayedYear.end_year} ({displayedYear.semester}) • {displayedYear.status || (displayedYear.is_active ? 'Active' : 'Archived')}
              </span>
            )}
            <select
              className="ov-sy-select"
              value={selectedAcademicYear}
              onChange={(e) => {
                setSelectedAcademicYear(e.target.value);
                setActivityPage(1);
              }}
              aria-label="Select School Year Reporting Context"
            >
              <option value="active">
                Active School Year{overviewData.activeAcademicYear ? ` (${overviewData.activeAcademicYear.start_year}–${overviewData.activeAcademicYear.end_year})` : ''}
              </option>
              {overviewData.academicYears.map((ay) => (
                <option key={ay.id} value={String(ay.id)}>
                  SY {ay.start_year}–{ay.end_year} ({ay.semester}) — {ay.status || (ay.is_active ? 'Active' : 'Archived')}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* ================= 2. UNIFIED DATE RANGE FILTER ================= */}
        <section className="ov-card ov-filter-card" aria-label="Reporting Date Range Filters">
          <div className="ov-filter-header-row">
            <div className="ov-preset-group" role="group" aria-label="Date Range Presets">
              {[
                { key: 'school_year', label: 'School Year' },
                { key: 'today', label: 'Today' },
                { key: 'last_7_days', label: 'Last 7 Days' },
                { key: 'last_30_days', label: 'Last 30 Days' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
                { key: 'this_year', label: 'This Year' },
                { key: 'custom', label: 'Custom Range' }
              ].map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`ov-preset-btn ${activePreset === preset.key ? 'active' : ''}`}
                  onClick={() => handleSelectDatePreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {overviewData.reportingPeriod && (
              <div className="ov-reporting-period-badge">
                <i className="fa-regular fa-calendar-check"></i>
                <span>
                  Reporting Period:{' '}
                  <strong>
                    {formatShortDate(overviewData.reportingPeriod.startDate)} – {formatShortDate(overviewData.reportingPeriod.endDate)}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleApplyDateFilters} className="ov-filter-bar">
            <div className="ov-date-controls">
              <div className="ov-date-field">
                <label htmlFor="ov-start-date">Start Date</label>
                <input
                  id="ov-start-date"
                  type="date"
                  className="ov-input ov-date-input"
                  value={draftStartDate}
                  max={draftEndDate || undefined}
                  onChange={(e) => {
                    setDraftStartDate(e.target.value);
                    setActivePreset('custom');
                    setFilterError('');
                  }}
                />
              </div>

              <div className="ov-date-field">
                <label htmlFor="ov-end-date">End Date</label>
                <input
                  id="ov-end-date"
                  type="date"
                  className="ov-input ov-date-input"
                  value={draftEndDate}
                  min={draftStartDate || undefined}
                  onChange={(e) => {
                    setDraftEndDate(e.target.value);
                    setActivePreset('custom');
                    setFilterError('');
                  }}
                />
              </div>

              <div className="ov-filter-actions">
                <button type="submit" className="ov-btn-primary">
                  <i className="fa-solid fa-filter"></i> Apply Filter
                </button>
                <button type="button" className="ov-btn-secondary" onClick={handleResetFilters}>
                  <i className="fa-solid fa-rotate-left"></i> Reset Filter
                </button>
              </div>
            </div>
          </form>

          {filterError && (
            <div className="ov-validation-error" role="alert">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{filterError}</span>
            </div>
          )}
        </section>

        {/* OVERVIEW ERROR BANNER */}
        {overviewError && (
          <div className="overview-alert-banner" role="alert">
            <div className="alert-content">
              <i className="fa-solid fa-triangle-exclamation alert-icon"></i>
              <span>{overviewError}</span>
            </div>
            <button type="button" className="btn-alert-retry" onClick={fetchOverview}>
              Retry
            </button>
          </div>
        )}

        {/* ================= 3. KEY STATISTICS CARDS ================= */}
        <section className="ov-kpi-grid" aria-label="Key Statistics">
          <OverviewStatCard
            label="Total Announcements"
            kpi={overviewData.kpis?.totalAnnouncements}
            subtext={`${overviewData.kpis?.totalAnnouncements?.publishedCount ?? 0} published`}
            icon="fa-bullhorn"
            tone="maroon"
            loading={overviewLoading}
            onClick={() => navigate('/admin/content-feed?tab=announcements')}
          />

          <OverviewStatCard
            label="Total Events"
            kpi={overviewData.kpis?.totalEvents}
            subtext={`${overviewData.kpis?.totalEvents?.upcomingCount ?? 0} upcoming`}
            icon="fa-calendar-days"
            tone="dark"
            loading={overviewLoading}
            onClick={() => navigate('/admin/content-feed?tab=events')}
          />

          <OverviewStatCard
            label="Pending Approvals"
            kpi={overviewData.kpis?.pendingApprovals}
            subtext={`${overviewData.kpis?.pendingApprovals?.pendingPosts ?? 0} posts • ${overviewData.kpis?.pendingApprovals?.pendingPages ?? 0} pages`}
            icon="fa-clock"
            tone="amber"
            loading={overviewLoading}
            onClick={() => navigate('/admin/post-approval?tab=pending')}
          />

          <OverviewStatCard
            label="Approved Pages"
            kpi={overviewData.kpis?.approvedPages}
            subtext="Active campus units & orgs"
            icon="fa-building-columns"
            tone="emerald"
            loading={overviewLoading}
            onClick={() => navigate('/admin/pages?tab=active')}
          />
        </section>

        {/* ================= 4 & 5. TWO ANALYTICS GRAPHS ================= */}
        <div className="ov-charts-grid">
          <PublishingActivityChart
            data={overviewData.publishingActivity}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />

          <UserAndPageActivityChart
            data={overviewData.userAndPageActivity}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />
        </div>

        {/* ================= 6. RECENT ADMINISTRATIVE ACTIVITY TABLE ================= */}
        <section className="ov-card" aria-label="Recent Administrative Activity">
          <div className="ov-card-header ov-activity-header">
            <div>
              <h2 className="ov-card-title">Recent Administrative Activity</h2>
              <p className="ov-card-desc">
                Chronological audit trail of verified system and administrative actions
              </p>
            </div>
            <div className="ov-activity-tools">
              <div className="ov-activity-search">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Filter activity log..."
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivityPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {overviewLoading ? (
            <div className="ov-table-skeleton">
              <div className="ov-skeleton ov-skeleton-row"></div>
              <div className="ov-skeleton ov-skeleton-row"></div>
              <div className="ov-skeleton ov-skeleton-row"></div>
            </div>
          ) : overviewError ? (
            <div className="ov-section-error">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{overviewError}</span>
              <button type="button" className="ov-btn-ghost" onClick={fetchOverview}>Retry</button>
            </div>
          ) : activityItems.length === 0 ? (
            <div className="ov-empty-box">
              <i className="fa-solid fa-clipboard-list"></i>
              <p>No recorded administrative activities found for this reporting period.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="overview-data-table">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Record Type</th>
                      <th>Performed By</th>
                      <th>Date &amp; Time</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityItems.map((act) => (
                      <tr key={act.id}>
                        <td className="ov-activity-cell">{act.activity}</td>
                        <td>
                          <span className="task-type-pill">{act.recordType}</span>
                        </td>
                        <td>{act.performedBy}</td>
                        <td className="ov-nowrap">{formatDateTime(act.createdAt)}</td>
                        <td>
                          <span className={`ov-act-status ov-act-${String(act.outcome || 'SUCCESS').toLowerCase()}`}>
                            {act.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => navigate(act.route || '/admin/audit-logs')}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={activityPagination.page}
                totalPages={activityPagination.totalPages}
                totalRecords={activityPagination.total}
                rowsPerPage={activityPagination.limit}
                onPageChange={(page) => setActivityPage(page)}
                onRowsPerPageChange={(limit) => {
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
