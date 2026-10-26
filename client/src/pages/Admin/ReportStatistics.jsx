import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/ReportStatistics.css';

const ReportStatistics = () => {
  // Period & Date Filter States
  const [period, setPeriod] = useState('30_days'); // 7_days, 30_days, 90_days, this_month, this_year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dateError, setDateError] = useState('');

  // Main Category Tab Filter
  const [activeTab, setActiveTab] = useState('all'); // all, announcements, events

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Overview KPIs
  const [kpis, setKpis] = useState({
    totalAnnouncements: 0,
    publishedAnnouncements: 0,
    pendingAnnouncements: 0,
    totalEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    registeredStudents: 0,
    pendingVerifications: 0,
    activeMyPages: 0,
    totalRegistrations: 0,
    totalPresentAttendance: 0,
  });

  // Detailed Section Data
  const [announcementStats, setAnnouncementStats] = useState({
    trends: [],
    statuses: [],
    categories: [],
    byOffice: []
  });

  const [eventStats, setEventStats] = useState({
    trends: [],
    participation: []
  });

  const [userStats, setUserStats] = useState({
    verificationBreakdown: [],
    roleBreakdown: [],
    myPageCategories: []
  });

  // Detailed Table States
  const [tableSearch, setTableSearch] = useState('');
  const [tableData, setTableData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Build Filter Params
  const getFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    params.append('period', period);
    if (period === 'custom') {
      if (customStartDate) params.append('startDate', customStartDate);
      if (customEndDate) params.append('endDate', customEndDate);
    }
    return params.toString();
  }, [period, customStartDate, customEndDate]);

  // Fetch All Analytics Data
  const fetchReportData = useCallback(async (isRefresh = false) => {
    if (period === 'custom') {
      if (!customStartDate || !customEndDate) {
        setDateError('Please select both start and end dates.');
        return;
      }
      if (new Date(customStartDate) > new Date(customEndDate)) {
        setDateError('Start date cannot be after end date.');
        return;
      }
    }
    setDateError('');

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const query = getFilterParams();

    try {
      const [overviewRes, annRes, evtRes, usrRes, tableRes] = await Promise.allSettled([
        fetch(`/api/admin/reports/overview?${query}`, { headers }),
        fetch(`/api/admin/reports/announcements?${query}`, { headers }),
        fetch(`/api/admin/reports/events?${query}`, { headers }),
        fetch(`/api/admin/reports/users-mypages?${query}`, { headers }),
        fetch(`/api/admin/reports/detailed-table?${query}`, { headers })
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        const data = await overviewRes.value.json();
        setKpis(data);
      }

      if (annRes.status === 'fulfilled' && annRes.value.ok) {
        const data = await annRes.value.json();
        setAnnouncementStats(data);
      }

      if (evtRes.status === 'fulfilled' && evtRes.value.ok) {
        const data = await evtRes.value.json();
        setEventStats(data);
      }

      if (usrRes.status === 'fulfilled' && usrRes.value.ok) {
        const data = await usrRes.value.json();
        setUserStats(data);
      }

      if (tableRes.status === 'fulfilled' && tableRes.value.ok) {
        const data = await tableRes.value.json();
        setTableData(data.items || []);
      }

      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to load report statistics:', err);
      setError('Failed to synchronize statistics. Please verify backend connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, customStartDate, customEndDate, getFilterParams]);

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    fetchReportData();
  };

  // Safe Attendance Rate Calculation
  const calculateAttendanceRate = (present, registered) => {
    const regNum = Number(registered) || 0;
    const presNum = Number(present) || 0;
    if (regNum <= 0) return 'N/A';
    const rate = (presNum / regNum) * 100;
    return `${Math.min(rate, 100).toFixed(1)}%`;
  };

  // CSV Export Handling
  const exportToCSV = () => {
    if (!tableData || tableData.length === 0) {
      alert('No data available to export for the selected filters.');
      return;
    }

    const headers = ['ID', 'Title / Entity', 'Category', 'Responsible Office / Page', 'Announcements', 'Events', 'Registrations', 'Attendance Present', 'Date Added'];
    
    const sanitizeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (['=', '+', '-', '@'].includes(str.charAt(0))) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const rows = tableData.map(item => [
      sanitizeCSV(item.id || '-'),
      sanitizeCSV(item.title || item.name || 'N/A'),
      sanitizeCSV(item.category || 'General'),
      sanitizeCSV(item.office || item.pageName || 'Campus Wide'),
      sanitizeCSV(item.announcementCount ?? 0),
      sanitizeCSV(item.eventCount ?? 0),
      sanitizeCSV(item.registrationCount ?? 0),
      sanitizeCSV(item.attendanceCount ?? 0),
      sanitizeCSV(item.date ? new Date(item.date).toLocaleDateString() : 'N/A')
    ]);

    const csvContent = [
      `"WMSU CampusHub - Reports & Statistics Export"`,
      `"Reporting Period: ${period.replace('_', ' ').toUpperCase()}"`,
      `"Generated At: ${new Date().toLocaleString()}"`,
      '',
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `wmsu_report_statistics_${period}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Table Items
  const filteredTableRows = tableData.filter(row => {
    const title = (row.title || row.name || '').toLowerCase();
    const office = (row.office || row.pageName || '').toLowerCase();
    const query = tableSearch.toLowerCase();
    
    const matchesSearch = title.includes(query) || office.includes(query);
    const matchesTab = 
      activeTab === 'all' ? true :
      activeTab === 'announcements' ? (row.announcementCount > 0) :
      activeTab === 'events' ? (row.eventCount > 0) : true;

    return matchesSearch && matchesTab;
  });

  // Pagination Math
  const totalPages = Math.ceil(filteredTableRows.length / itemsPerPage) || 1;
  const paginatedRows = filteredTableRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <AdminLayout>
      <div className="report-statistics-page">
        {/* ==================== PAGE HEADER ==================== */}
        <div className="report-statistics-header">
          <div className="header-left">
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              <span>Admin</span>
              <i className="fa-solid fa-chevron-right separator"></i>
              <span className="active">Reports &amp; Statistics</span>
            </nav>
            <h1 className="page-title">Reports &amp; Statistics</h1>
            <p className="page-subtitle">
              Monitor campus communications, event participation, and official university page metrics.
            </p>
          </div>

          <div className="header-right-actions">
            {lastRefreshed && (
              <span className="last-refreshed-badge">
                <i className="fa-solid fa-clock-rotate-left"></i> Synced: {lastRefreshed}
              </span>
            )}
            <button 
              type="button" 
              className="btn-refresh" 
              onClick={() => fetchReportData(true)} 
              disabled={refreshing || loading}
              title="Sync Data"
            >
              <i className={`fa-solid fa-rotate ${refreshing ? 'fa-spin' : ''}`}></i>
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
            <button 
              type="button" 
              className="btn-export-csv" 
              onClick={exportToCSV}
              disabled={loading}
            >
              <i className="fa-solid fa-file-csv"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ==================== FILTER TOOLBAR ==================== */}
        <div className="report-statistics-filters">
          <div className="filter-group">
            <label htmlFor="period-select" className="filter-label">
              <i className="fa-solid fa-calendar-days"></i> Period:
            </label>
            <select
              id="period-select"
              className="period-dropdown"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {period === 'custom' && (
            <form onSubmit={handleApplyCustomDate} className="custom-date-form">
              <div className="date-input-wrap">
                <label htmlFor="start-date">Start:</label>
                <input
                  type="date"
                  id="start-date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-picker-input"
                />
              </div>
              <div className="date-input-wrap">
                <label htmlFor="end-date">End:</label>
                <input
                  type="date"
                  id="end-date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-picker-input"
                />
              </div>
              <button type="submit" className="btn-apply-date">Apply</button>
            </form>
          )}

          <div className="period-indicator">
            <span className="indicator-chip">
              Scope: <strong>{period.replace('_', ' ').toUpperCase()}</strong>
            </span>
          </div>
        </div>

        {dateError && <div className="filter-error-alert">{dateError}</div>}

        {/* ==================== ERROR STATE ==================== */}
        {error && (
          <div className="report-statistics-error" role="alert">
            <i className="fa-solid fa-circle-exclamation error-icon"></i>
            <div className="error-content">
              <h4>Database Sync Notice</h4>
              <p>{error}</p>
            </div>
            <button type="button" className="btn-retry" onClick={() => fetchReportData()}>
              Retry
            </button>
          </div>
        )}

        {/* ==================== KPI CARDS GRID (EXACT 2 ROWS x 3 COLUMNS) ==================== */}
        <section className="report-statistics-kpis" aria-label="Key Performance Indicators">
          <div className="report-statistics-card kpi-card border-top-maroon">
            <div className="kpi-icon-wrap maroon">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Total Announcements</span>
              <div className="kpi-value">{loading ? <span className="skeleton-line"></span> : (kpis.totalAnnouncements ?? 0)}</div>
              <span className="kpi-subtext">Lifetime university posts</span>
            </div>
          </div>

          <div className="report-statistics-card kpi-card border-top-green">
            <div className="kpi-icon-wrap green">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Published Posts</span>
              <div className="kpi-value">{loading ? <span className="skeleton-line"></span> : (kpis.publishedAnnouncements ?? 0)}</div>
              <span className="kpi-subtext">Active &amp; visible in feed</span>
            </div>
          </div>

          <div className="report-statistics-card kpi-card border-top-gold">
            <div className="kpi-icon-wrap gold">
              <i className="fa-solid fa-calendar-check"></i>
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Total Events</span>
              <div className="kpi-value">{loading ? <span className="skeleton-line"></span> : (kpis.totalEvents ?? 0)}</div>
              <span className="kpi-subtext">{kpis.upcomingEvents ?? 0} upcoming scheduled</span>
            </div>
          </div>

          <div className="report-statistics-card kpi-card border-top-blue">
            <div className="kpi-icon-wrap blue">
              <i className="fa-solid fa-user-graduate"></i>
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Registered Students</span>
              <div className="kpi-value">{loading ? <span className="skeleton-line"></span> : (kpis.registeredStudents ?? 0)}</div>
              <span className="kpi-subtext">{kpis.pendingVerifications ?? 0} pending review</span>
            </div>
          </div>

          <div className="report-statistics-card kpi-card border-top-purple">
            <div className="kpi-icon-wrap purple">
              <i className="fa-solid fa-landmark"></i>
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Active MyPages</span>
              <div className="kpi-value">{loading ? <span className="skeleton-line"></span> : (kpis.activeMyPages ?? 0)}</div>
              <span className="kpi-subtext">Verified official channels</span>
            </div>
          </div>

          <div className="report-statistics-card kpi-card border-top-crimson">
            <div className="kpi-icon-wrap crimson">
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <div className="kpi-details">
              <span className="kpi-label">QR Attendance Rate</span>
              <div className="kpi-value">
                {loading ? <span className="skeleton-line"></span> : calculateAttendanceRate(kpis.totalPresentAttendance, kpis.totalRegistrations)}
              </div>
              <span className="kpi-subtext">{kpis.totalPresentAttendance ?? 0} verified present</span>
            </div>
          </div>
        </section>

        {/* ==================== ANNOUNCEMENT ANALYTICS ==================== */}
        <section className="analytics-section">
          <div className="section-title-bar">
            <h2><i className="fa-solid fa-newspaper maroon-text"></i> Announcement Analytics</h2>
            <span className="section-note">Publishing activity and status breakdown</span>
          </div>

          <div className="charts-grid-two">
            {/* Status Breakdown */}
            <div className="report-statistics-card chart-card">
              <div className="chart-card-header">
                <h3>Announcement Status Distribution</h3>
              </div>
              <div className="chart-body">
                {loading ? (
                  <div className="skeleton-box"></div>
                ) : announcementStats.statuses && announcementStats.statuses.length > 0 ? (
                  <ul className="bar-list">
                    {announcementStats.statuses.map((item, idx) => (
                      <li key={idx} className="bar-item">
                        <div className="bar-info">
                          <span className="bar-name">{item.status}</span>
                          <span className="bar-count">{item.count}</span>
                        </div>
                        <div className="bar-track">
                          <div 
                            className={`bar-fill status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
                            style={{ width: `${Math.min((item.count / (kpis.totalAnnouncements || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="report-statistics-empty">
                    <i className="fa-solid fa-folder-open"></i>
                    <p>No status metrics recorded for this period.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Publishing by Office */}
            <div className="report-statistics-card chart-card">
              <div className="chart-card-header">
                <h3>Publishing Activity by Office / Page</h3>
              </div>
              <div className="chart-body">
                {loading ? (
                  <div className="skeleton-box"></div>
                ) : announcementStats.byOffice && announcementStats.byOffice.length > 0 ? (
                  <ul className="bar-list">
                    {announcementStats.byOffice.map((item, idx) => (
                      <li key={idx} className="bar-item">
                        <div className="bar-info">
                          <span className="bar-name">{item.officeName || 'Campus Wide'}</span>
                          <span className="bar-count">{item.count} posts</span>
                        </div>
                        <div className="bar-track">
                          <div 
                            className="bar-fill maroon-fill"
                            style={{ width: `${Math.min((item.count / 50) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="report-statistics-empty">
                    <i className="fa-solid fa-building"></i>
                    <p>No office attribution data recorded for this period.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ==================== EVENT & ATTENDANCE ANALYTICS ==================== */}
        <section className="analytics-section">
          <div className="section-title-bar">
            <h2><i className="fa-solid fa-calendar-days maroon-text"></i> Event &amp; QR Attendance Analytics</h2>
            <span className="section-note">Student registration engagement and verified attendance</span>
          </div>

          <div className="report-statistics-card table-card-wrap">
            <div className="chart-card-header card-padding-header">
              <h3>Event Participation Rates</h3>
            </div>
            
            {loading ? (
              <div className="skeleton-box margin-inner"></div>
            ) : eventStats.participation && eventStats.participation.length > 0 ? (
              <div className="responsive-table-container">
                <table className="report-statistics-table">
                  <thead>
                    <tr>
                      <th>Event Title</th>
                      <th>Organizer / MyPage</th>
                      <th>Date</th>
                      <th>Registrations</th>
                      <th>Present (QR)</th>
                      <th>Attendance Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventStats.participation.map((evt) => {
                      const rateStr = calculateAttendanceRate(evt.presentCount, evt.registrationCount);
                      return (
                        <tr key={evt.id || evt.title}>
                          <td className="font-semibold title-cell">{evt.title}</td>
                          <td>{evt.organizer || 'WMSU Administration'}</td>
                          <td>{evt.eventDate ? new Date(evt.eventDate).toLocaleDateString() : 'N/A'}</td>
                          <td><span className="badge-pill blue-pill">{evt.registrationCount || 0}</span></td>
                          <td><span className="badge-pill green-pill">{evt.presentCount || 0}</span></td>
                          <td className="font-semibold">{rateStr}</td>
                          <td>
                            <span className={`status-tag ${evt.status?.toLowerCase() || 'upcoming'}`}>
                              {evt.status || 'Upcoming'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="report-statistics-empty">
                <i className="fa-solid fa-calendar-xmark"></i>
                <p>No event registration or attendance records found for this period.</p>
              </div>
            )}
          </div>
        </section>

        {/* ==================== USER & MYPAGE ANALYTICS ==================== */}
        <section className="analytics-section">
          <div className="section-title-bar">
            <h2><i className="fa-solid fa-users maroon-text"></i> User Accounts &amp; MyPage Verification</h2>
            <span className="section-note">Account status and official page allocations</span>
          </div>

          <div className="charts-grid-two">
            {/* Verification Breakdown */}
            <div className="report-statistics-card chart-card">
              <div className="chart-card-header">
                <h3>Student Verification Status</h3>
              </div>
              <div className="chart-body">
                <div className="stat-pill-row">
                  <div className="stat-pill green-border">
                    <span className="stat-num">{userStats.verifiedCount ?? kpis.registeredStudents}</span>
                    <span className="stat-lbl">Verified Students</span>
                  </div>
                  <div className="stat-pill gold-border">
                    <span className="stat-num">{userStats.pendingCount ?? kpis.pendingVerifications}</span>
                    <span className="stat-lbl">Pending Review</span>
                  </div>
                  <div className="stat-pill red-border">
                    <span className="stat-num">{userStats.rejectedCount ?? 0}</span>
                    <span className="stat-lbl">Rejected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MyPage Categories */}
            <div className="report-statistics-card chart-card">
              <div className="chart-card-header">
                <h3>Official MyPages Allocation</h3>
              </div>
              <div className="chart-body">
                <div className="stat-pill-row">
                  <div className="stat-pill maroon-border">
                    <span className="stat-num">{userStats.collegesCount ?? 0}</span>
                    <span className="stat-lbl">Colleges</span>
                  </div>
                  <div className="stat-pill maroon-border">
                    <span className="stat-num">{userStats.orgsCount ?? 0}</span>
                    <span className="stat-lbl">Student Orgs</span>
                  </div>
                  <div className="stat-pill maroon-border">
                    <span className="stat-num">{userStats.officesCount ?? 0}</span>
                    <span className="stat-lbl">Admin Offices</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== DETAILED REPORTS TABLE ==================== */}
        <section className="analytics-section">
          <div className="section-title-bar">
            <h2><i className="fa-solid fa-table-list maroon-text"></i> Detailed Activity Logs</h2>
            <span className="section-note">Inspect aggregated entity performance data</span>
          </div>

          <div className="report-statistics-card table-card-wrap">
            <div className="table-toolbar">
              <div className="table-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                >
                  All Logs
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('announcements'); setCurrentPage(1); }}
                >
                  Announcements
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('events'); setCurrentPage(1); }}
                >
                  Events
                </button>
              </div>

              <div className="table-search-wrap">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  placeholder="Search title, office, or category..."
                  value={tableSearch}
                  onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                  className="table-search-input"
                />
              </div>
            </div>

            {loading ? (
              <div className="skeleton-box margin-inner" style={{ height: '220px' }}></div>
            ) : paginatedRows.length > 0 ? (
              <>
                <div className="responsive-table-container">
                  <table className="report-statistics-table">
                    <thead>
                      <tr>
                        <th>Title / Entity Name</th>
                        <th>Category</th>
                        <th>Responsible Office / Page</th>
                        <th>Announcements</th>
                        <th>Events</th>
                        <th>Registrations</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, idx) => (
                        <tr key={row.id || idx}>
                          <td className="font-semibold title-cell">{row.title || row.name || 'Untitled'}</td>
                          <td><span className="category-chip">{row.category || 'General'}</span></td>
                          <td>{row.office || row.pageName || 'Campus Wide'}</td>
                          <td>{row.announcementCount ?? 0}</td>
                          <td>{row.eventCount ?? 0}</td>
                          <td>{row.registrationCount ?? 0}</td>
                          <td>{row.attendanceCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="table-pagination">
                  <span className="pagination-info">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTableRows.length)} of {filteredTableRows.length} entries
                  </span>
                  <div className="pagination-buttons">
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span className="current-page-indicator">{currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="report-statistics-empty">
                <i className="fa-solid fa-magnifying-glass"></i>
                <p>No records matched your search or category filter.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default ReportStatistics;