import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import { ReferenceBarChartCard, ReferenceAreaLineChartCard } from '../../assets/components/OverviewCharts';
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

const OverviewStatCard = ({ label, kpi, subtext, icon, tone = 'maroon', loading, onClick }) => {
  const current = Number(kpi?.current) || 0;

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

      <div className={`ov-kpi-value ov-val-${tone}`}>
        {loading ? (
          <div className="ov-skeleton ov-skeleton-val"></div>
        ) : (
          current.toLocaleString()
        )}
      </div>

      <div className="ov-kpi-subtext-line">
        {loading ? <div className="ov-skeleton ov-skeleton-meta"></div> : <span>{subtext}</span>}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Reference-Matched UI State
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const quickActionsRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target)) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResetFilters = () => {
    setDashboardSearch('');
    setSelectedAcademicYear('active');
    setActivePreset('school_year');
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setFilterError('');
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

  const filteredActivityItems = dashboardSearch.trim()
    ? activityItems.filter((act) => {
        const q = dashboardSearch.trim().toLowerCase();
        return (
          String(act.activity || '').toLowerCase().includes(q) ||
          String(act.actor || act.performedBy || '').toLowerCase().includes(q) ||
          String(act.category || act.recordType || '').toLowerCase().includes(q) ||
          String(act.affectedResource || '').toLowerCase().includes(q)
        );
      })
    : activityItems;

  return (
    <AdminLayout>
      <div className="admin-overview-wrapper">
        {/* ================= 1. TOP PAGE HEADER & PRIMARY CTAs ================= */}
        <div className="ov-page-header">
          <div className="ov-page-title-block">
            <div className="ov-breadcrumb">
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <span>Home</span>
              <span aria-hidden="true">/</span>
              <span className="is-current">Admin Dashboard</span>
            </div>
            <h1 className="overview-title">Admin Dashboard</h1>
          </div>

          <div className="ov-page-actions">
            <button
              type="button"
              className="ov-btn ov-btn-primary"
              onClick={() => navigate('/admin/content-feed')}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i>
              <span>Create Post</span>
            </button>

            <button
              type="button"
              className="ov-btn ov-btn-deep"
              onClick={() => navigate('/admin/post-approval?tab=pending')}
            >
              <i className="fa-solid fa-file-circle-check" aria-hidden="true"></i>
              <span>Post Approvals</span>
            </button>

            <div className="ov-quick-actions-wrap" ref={quickActionsRef}>
              <button
                type="button"
                className="ov-btn ov-btn-secondary"
                onClick={() => setShowQuickActions((prev) => !prev)}
                aria-expanded={showQuickActions}
              >
                <i className="fa-solid fa-sliders" aria-hidden="true"></i>
                <span>Quick Actions</span>
                <i className="fa-solid fa-caret-down" style={{ fontSize: '0.7rem' }} aria-hidden="true"></i>
              </button>

              {showQuickActions && (
                <div className="ov-quick-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/admin/pages'); }}>
                    <i className="fa-solid fa-layer-group"></i> Page Management
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/admin/users'); }}>
                    <i className="fa-solid fa-users"></i> User Management
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/admin/reports'); }}>
                    <i className="fa-solid fa-chart-line"></i> Reports &amp; Statistics
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/admin/audit-logs'); }}>
                    <i className="fa-solid fa-clipboard-list"></i> Audit Logs
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/admin/settings'); }}>
                    <i className="fa-solid fa-gear"></i> System Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= 2. DISMISSIBLE WELCOME BANNER ================= */}
        {showWelcomeBanner && (
          <div className="ov-welcome-banner" role="status">
            <div className="ov-welcome-left">
              <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
              <span>Welcome back, System Administrator!</span>
            </div>
            <button
              type="button"
              className="ov-welcome-close"
              onClick={() => setShowWelcomeBanner(false)}
              aria-label="Dismiss welcome banner"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        )}

        {/* ================= 3. SINGLE-ROW LIVE SEARCH & FILTER BAR ================= */}
        <section className="ov-filter-bar-card" aria-label="Dashboard Search and Filters">
          <div className="ov-filter-bar-row">
            <div className="ov-filter-field ov-filter-search">
              <label htmlFor="ov-live-search" className="ov-filter-label">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <span>Live Dashboard Search:</span>
              </label>
              <div className="ov-search-input-wrap">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                  id="ov-live-search"
                  type="text"
                  className="ov-search-input"
                  placeholder="Search activity, actor, category, or resource..."
                  value={dashboardSearch}
                  onChange={(e) => setDashboardSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="ov-filter-field">
              <label htmlFor="ov-sy-select" className="ov-filter-label">
                <i className="fa-solid fa-graduation-cap" aria-hidden="true"></i>
                <span>School Year:</span>
              </label>
              <select
                id="ov-sy-select"
                className="ov-filter-select"
                value={selectedAcademicYear}
                onChange={handleAcademicYearChange}
                aria-label="Select School Year"
              >
                <option value="active">
                  Active SY
                  {overviewData.activeAcademicYear
                    ? ` (${overviewData.activeAcademicYear.start_year}–${overviewData.activeAcademicYear.end_year})`
                    : ''}
                </option>
                {overviewData.academicYears.map((ay) => (
                  <option key={ay.id} value={String(ay.id)}>
                    SY {ay.start_year}–{ay.end_year} ({ay.semester})
                  </option>
                ))}
              </select>
            </div>

            <div className="ov-filter-field">
              <label htmlFor="ov-date-preset-select" className="ov-filter-label">
                <i className="fa-regular fa-calendar" aria-hidden="true"></i>
                <span>Date Filter Period:</span>
              </label>
              <select
                id="ov-date-preset-select"
                className="ov-filter-select"
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

            {activePreset === 'custom' && (
              <>
                <div className="ov-filter-field ov-filter-date-field">
                  <label htmlFor="ov-custom-start" className="ov-filter-label">
                    <span>Start Date:</span>
                  </label>
                  <input
                    id="ov-custom-start"
                    type="date"
                    className="ov-filter-date-input"
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>

                <div className="ov-filter-field ov-filter-date-field">
                  <label htmlFor="ov-custom-end" className="ov-filter-label">
                    <span>End Date:</span>
                  </label>
                  <input
                    id="ov-custom-end"
                    type="date"
                    className="ov-filter-date-input"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="ov-filter-reset-wrap">
              <button
                type="button"
                className="ov-btn ov-btn-secondary ov-reset-btn"
                onClick={handleResetFilters}
                title="Reset all filters"
                aria-label="Reset all filters"
              >
                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {filterError && (
            <div className="ov-inline-error" role="alert" style={{ marginTop: '0.5rem' }}>
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
              <span>{filterError}</span>
            </div>
          )}
        </section>

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

        {/* ================= 4. PRIMARY KPI CARDS (ROW 1) ================= */}
        <section className="ov-kpi-grid" aria-label="Key Performance Indicators">
          <OverviewStatCard
            label="Total Announcements"
            kpi={overviewData.kpis?.totalAnnouncements}
            icon="fa-bullhorn"
            tone="maroon"
            loading={overviewLoading}
            onClick={() => navigate('/admin/content-feed?tab=announcements')}
          />

          <OverviewStatCard
            label="Total Events"
            kpi={overviewData.kpis?.totalEvents}
            icon="fa-calendar-days"
            tone="emerald"
            loading={overviewLoading}
            onClick={() => navigate('/admin/content-feed?tab=events')}
          />

          <OverviewStatCard
            label="Pending Approvals"
            kpi={overviewData.kpis?.pendingApprovals}
            icon="fa-clock"
            tone="amber"
            loading={overviewLoading}
            onClick={() => navigate('/admin/post-approval?tab=pending')}
          />

          <OverviewStatCard
            label="Approved Pages"
            kpi={overviewData.kpis?.approvedPages}
            icon="fa-building-columns"
            tone="blue"
            loading={overviewLoading}
            onClick={() => navigate('/admin/pages?tab=active')}
          />
        </section>

        {/* ================= 5. QUICK STATUS STRIP (ROW 2) ================= */}
        <section className="ov-status-strip" aria-label="System Status Summary">
          <div
            className="ov-status-mini-card is-active-sy"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/settings?tab=academic-year')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/admin/settings?tab=academic-year'); }}
          >
            <div>
              <div className="ov-mini-label-row">
                <span className="ov-sy-live-dot" aria-hidden="true"></span>
                <span className="ov-mini-label">Active School Year</span>
              </div>
              <div className="ov-mini-val is-emerald">
                {displayedYear ? `SY ${displayedYear.start_year}–${displayedYear.end_year}` : 'Active SY'}
              </div>
            </div>
            <i className="fa-solid fa-graduation-cap ov-mini-icon is-emerald" aria-hidden="true"></i>
          </div>

          <div
            className="ov-status-mini-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/post-approval?tab=pending')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/admin/post-approval?tab=pending'); }}
          >
            <div>
              <div className="ov-mini-label">Post Approvals</div>
              <div className="ov-mini-val is-amber">
                {overviewData.kpis?.pendingApprovals?.pendingPosts ?? 0} Pending
              </div>
            </div>
            <i className="fa-solid fa-file-circle-check ov-mini-icon is-amber" aria-hidden="true"></i>
          </div>

          <div
            className="ov-status-mini-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/pages?tab=pending')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/admin/pages?tab=pending'); }}
          >
            <div>
              <div className="ov-mini-label">Page Requests</div>
              <div className="ov-mini-val is-rose">
                {overviewData.kpis?.pendingApprovals?.pendingPages ?? 0} Awaiting Review
              </div>
            </div>
            <i className="fa-solid fa-building-columns ov-mini-icon is-rose" aria-hidden="true"></i>
          </div>

          <div className="ov-status-mini-card is-static">
            <div>
              <div className="ov-mini-label">Approved Pages</div>
              <div className="ov-mini-val is-emerald">
                {overviewData.kpis?.approvedPages?.totalActivePages ?? 0} Active
              </div>
            </div>
            <i className="fa-solid fa-circle-check ov-mini-icon is-emerald" aria-hidden="true"></i>
          </div>
        </section>

        {/* ================= 6. ANALYTICAL REPORTS SECTION HEADER ================= */}
        <div className="ov-section-bar">
          <div className="ov-section-heading">
            <i className="fa-solid fa-chart-line" aria-hidden="true"></i>
            <h2>Analytical Reports &amp; Activity Trends</h2>
          </div>
          <div className="ov-scope-pill">
            <i className="fa-regular fa-clock" aria-hidden="true"></i>
            <span>Scope: {formattedPeriodLabel || 'Active School Year'}</span>
          </div>
        </div>

        {/* ================= 7. REFERENCE-MATCHED ANALYTICS GRAPHS ================= */}
        <div className="ov-charts-top-grid">
          <ReferenceBarChartCard
            number="1"
            title="Published Content Volume"
            badgeText="Top Volume"
            badgeTone="emerald"
            bars={[
              { label: 'Announcements', value: Number(overviewData.kpis?.totalAnnouncements?.current) || 0, color: '#479973' },
              { label: 'Events', value: Number(overviewData.kpis?.totalEvents?.current) || 0, color: '#881337' },
            ]}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />

          <ReferenceBarChartCard
            number="2"
            title="Pending & Active Governance"
            badgeText="Moderation Queue"
            badgeTone="rose"
            bars={[
              { label: 'Pending Posts', value: Number(overviewData.kpis?.pendingApprovals?.pendingPosts) || 0, color: '#df5c6e' },
              { label: 'Pending Pages', value: Number(overviewData.kpis?.pendingApprovals?.pendingPages) || 0, color: '#f59e0b' },
              { label: 'Approved Pages', value: Number(overviewData.kpis?.approvedPages?.totalActivePages) || 0, color: '#2563eb' },
            ]}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />
        </div>

        <div className="ov-charts-bottom-grid">
          <ReferenceAreaLineChartCard
            number="3"
            title="Announcements Over Time"
            color="#1d6ff2"
            gradId="ovGradAnn"
            valueLabel="Announcements"
            series={(overviewData.publishingActivity?.series || []).map((s) => ({ label: s.label, value: s.announcements }))}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />

          <ReferenceAreaLineChartCard
            number="4"
            title="Events Publishing Trends"
            color="#15804b"
            gradId="ovGradEvt"
            valueLabel="Events"
            series={(overviewData.publishingActivity?.series || []).map((s) => ({ label: s.label, value: s.events }))}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />

          <ReferenceAreaLineChartCard
            number="5"
            title="User & Page Growth Trends"
            color="#ea6a08"
            gradId="ovGradGrowth"
            valueLabel="Registrations"
            series={(overviewData.userAndPageActivity?.series || []).map((s) => ({
              label: s.label,
              value: (Number(s.students) || 0) + (Number(s.staff) || 0) + (Number(s.pages) || 0),
            }))}
            loading={overviewLoading}
            error={overviewError}
            onRetry={fetchOverview}
          />
        </div>

        {/* ================= 8. RECENT ADMINISTRATIVE ACTIVITY TABLE ================= */}
        <section className="ov-card ov-activity-card" aria-label="Recent Administrative Activity">
          <div className="admin-table-head">
            <div className="admin-table-title">
              <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
              <span>Recent Administrative Activity</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="admin-table-matching">{activityPagination.total} Matching</span>
              <button
                type="button"
                className="ov-btn ov-btn-secondary ov-btn-sm"
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
          ) : filteredActivityItems.length === 0 ? (
            <div className="ov-empty-box compact">
              <div className="ov-empty-icon-wrap" aria-hidden="true">
                <i className="fa-solid fa-clipboard-list"></i>
              </div>
              <h3 className="ov-empty-title">No administrative activity found</h3>
              <p className="ov-empty-desc">
                No verified system or administrative actions matched {dashboardSearch.trim() ? `"${dashboardSearch.trim()}"` : (formattedPeriodLabel || 'this period')}.
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
                    {filteredActivityItems.map((act) => {
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
