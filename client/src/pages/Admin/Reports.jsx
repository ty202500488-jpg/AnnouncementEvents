import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/Reports.css';

// 6 Core Report Categories matching administrative requirements
const REPORT_CATEGORIES = [
  { id: 'students', label: 'Student Registration & Verification', icon: 'fa-user-graduate', endpoint: '/api/admin/reports/students' },
  { id: 'announcements', label: 'Announcement Report', icon: 'fa-bullhorn', endpoint: '/api/admin/reports/announcements' },
  { id: 'events', label: 'Event Report', icon: 'fa-calendar-days', endpoint: '/api/admin/reports/events' },
  { id: 'attendance', label: 'Event Attendance Report', icon: 'fa-qrcode', endpoint: '/api/admin/reports/attendance' },
  { id: 'pages', label: 'Page & Staff Activity Report', icon: 'fa-building-columns', endpoint: '/api/admin/reports/pages' },
  { id: 'moderation', label: 'Post Approval & Moderation Report', icon: 'fa-clipboard-check', endpoint: '/api/admin/reports/moderation' }
];

// CSV Column Definitions per Report Category
const REPORT_CSV_SCHEMAS = {
  students: [
    { label: 'Student ID', key: 'student_id' },
    { label: 'First Name', key: 'first_name' },
    { label: 'Middle Name', key: 'middle_name' },
    { label: 'Last Name', key: 'last_name' },
    { label: 'WMSU Email', key: 'email' },
    { label: 'College', key: 'college_name' },
    { label: 'Department', key: 'department_name' },
    { label: 'Program', key: 'program_name' },
    { label: 'Year Level', key: 'year_level' },
    { label: 'Registration Date', key: 'created_at', isDate: true },
    { label: 'Verification Status', key: 'verification_status' }
  ],
  announcements: [
    { label: 'Announcement ID', key: 'id' },
    { label: 'Announcement Title', key: 'title' },
    { label: 'Category', key: 'category' },
    { label: 'Author', key: 'author_name' },
    { label: 'Associated Page', key: 'page_name' },
    { label: 'Target Audience', key: 'target_audience' },
    { label: 'College / Department', key: 'unit_name' },
    { label: 'Submission Date', key: 'submitted_at', isDate: true },
    { label: 'Publication Date', key: 'published_at', isDate: true },
    { label: 'Status', key: 'status' }
  ],
  events: [
    { label: 'Event ID', key: 'id' },
    { label: 'Event Title', key: 'title' },
    { label: 'Event Category', key: 'category' },
    { label: 'Organizer / Page', key: 'organizer_name' },
    { label: 'Event Location', key: 'location' },
    { label: 'Start Date', key: 'start_date', isDate: true },
    { label: 'End Date', key: 'end_date', isDate: true },
    { label: 'Registration Count', key: 'registration_count' },
    { label: 'Event Status', key: 'status' },
    { label: 'Created Date', key: 'created_at', isDate: true }
  ],
  attendance: [
    { label: 'Attendance ID', key: 'attendance_id' },
    { label: 'Event ID', key: 'event_id' },
    { label: 'Event Title', key: 'event_title' },
    { label: 'Student ID', key: 'student_id' },
    { label: 'Student Name', key: 'student_name' },
    { label: 'Student Email', key: 'email' },
    { label: 'Registration Status', key: 'reg_status' },
    { label: 'Attendance Status', key: 'attendance_status' },
    { label: 'Attendance Date', key: 'marked_at', isDate: true },
    { label: 'Marked By', key: 'marked_by_name' }
  ],
  pages: [
    { label: 'Page ID', key: 'id' },
    { label: 'Page Name', key: 'name' },
    { label: 'Page Category', key: 'category' },
    { label: 'Assigned Staff', key: 'staff_name' },
    { label: 'College / Department', key: 'unit_name' },
    { label: 'Total Announcements', key: 'total_announcements' },
    { label: 'Total Events', key: 'total_events' },
    { label: 'Page Status', key: 'status' },
    { label: 'Date Created', key: 'created_at', isDate: true },
    { label: 'Last Activity', key: 'last_activity', isDate: true }
  ],
  moderation: [
    { label: 'Submission ID', key: 'id' },
    { label: 'Post Title', key: 'title' },
    { label: 'Submitted By', key: 'submitted_by_name' },
    { label: 'Associated Page', key: 'page_name' },
    { label: 'Submission Date', key: 'created_at', isDate: true },
    { label: 'Review Status', key: 'review_status' },
    { label: 'Reviewed By', key: 'reviewed_by_name' },
    { label: 'Decision Date', key: 'reviewed_at', isDate: true },
    { label: 'Archive / Removal Reason', key: 'decision_reason' }
  ]
};

const Reports = () => {
  // Report Category State
  const [selectedCategory, setSelectedCategory] = useState('students');

  // Summary Metrics State (From /api/admin/reports/summary)
  const [summaryStats, setSummaryStats] = useState({
    totalRegisteredStudents: 0,
    totalAnnouncementsPublished: 0,
    totalEventsCreated: 0,
    totalEventRegistrations: 0
  });

  // Filter States
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown Metadata Options (Populated from DB)
  const [collegeList, setCollegeList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [programList, setProgramList] = useState([]);

  // Data Preview States
  const [records, setRecords] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);

  // Search, Sort, and Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Notification helper
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Auth Header Builder
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  // Fetch Summary Statistics
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/summary', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load summary statistics');
      const data = await res.json();
      setSummaryStats({
        totalRegisteredStudents: data.totalRegisteredStudents || 0,
        totalAnnouncementsPublished: data.totalAnnouncementsPublished || 0,
        totalEventsCreated: data.totalEventsCreated || 0,
        totalEventRegistrations: data.totalEventRegistrations || 0
      });
    } catch (err) {
      console.error('Summary error:', err);
    }
  }, []);

  // Fetch Filter Metadata (Colleges, Departments, Programs)
  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/metadata', { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCollegeList(data.colleges || []);
        setDeptList(data.departments || []);
        setProgramList(data.programs || []);
      }
    } catch (err) {
      console.error('Metadata error:', err);
    }
  }, []);

  // Build Query Parameters string
  const buildQueryParams = useCallback((overrides = {}) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('startDate', dateFrom);
    if (dateTo) params.append('endDate', dateTo);
    if (collegeFilter) params.append('collegeId', collegeFilter);
    if (deptFilter) params.append('departmentId', deptFilter);
    if (programFilter) params.append('programId', programFilter);
    if (categoryTypeFilter) params.append('category', categoryTypeFilter);
    if (statusFilter) params.append('status', statusFilter);

    Object.entries(overrides).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, val);
      }
    });

    return params.toString();
  }, [dateFrom, dateTo, collegeFilter, deptFilter, programFilter, categoryTypeFilter, statusFilter]);

  // Fetch Selected Report Records & Chart Analytics
  const fetchReportData = useCallback(async () => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      setErrorMessage('Start date cannot be later than end date.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const activeCategoryObj = REPORT_CATEGORIES.find(c => c.id === selectedCategory);
    const queryString = buildQueryParams();

    try {
      const res = await fetch(`${activeCategoryObj.endpoint}?${queryString}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Access denied. Administrator privileges required.');
        }
        throw new Error('Failed to retrieve reporting data from server.');
      }

      const json = await res.json();
      setRecords(json.records || []);
      setAnalyticsData(json.analytics || null);
      setCurrentPage(1);
      setLastGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      console.error('Report fetch error:', err);
      setErrorMessage(err.message || 'Error communicating with database.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, buildQueryParams, dateFrom, dateTo]);

  // Initial Load & Category Change
  useEffect(() => {
    fetchSummary();
    fetchMetadata();
  }, [fetchSummary, fetchMetadata]);

  useEffect(() => {
    fetchReportData();
  }, [selectedCategory]);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchReportData();
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCollegeFilter('');
    setDeptFilter('');
    setProgramFilter('');
    setCategoryTypeFilter('');
    setStatusFilter('');
    setSearchTerm('');
    setSortColumn('');
    setTimeout(() => {
      fetchReportData();
    }, 0);
  };

  // Safe Cell Formatting & Date Localization
  const formatCellValue = (val, isDate = false) => {
    if (val === null || val === undefined || val === '') return '—';
    if (isDate) {
      const d = new Date(val);
      return !isNaN(d.getTime()) ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    }
    return String(val);
  };

  // Client-Side Searching & Sorting for Table Preview
  const currentSchema = useMemo(() => REPORT_CSV_SCHEMAS[selectedCategory] || [], [selectedCategory]);

  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(rec =>
        Object.values(rec).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(term))
      );
    }

    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a[sortColumn] ?? '';
        let valB = b[sortColumn] ?? '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, searchTerm, sortColumn, sortOrder]);

  const handleSort = (key) => {
    if (sortColumn === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortOrder('asc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedRecords.slice(start, start + itemsPerPage);
  }, [filteredAndSortedRecords, currentPage, itemsPerPage]);

  // CSV Formula Injection Sanitizer & Escape Handler
  const sanitizeForCSV = (value, isDate = false) => {
    if (value === null || value === undefined) return '""';
    let str = isDate ? formatCellValue(value, true) : String(value);

    // Escape interior double-quotes
    str = str.replace(/"/g, '""');

    // Formula Injection Mitigation: Prefix unsafe starters (=, +, -, @, \t, \r)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    return `"${str}"`;
  };

  // CSV Export: Fetches ALL filtered matching database records (not just pagination)
  const handleExportCSV = async () => {
    const activeCategoryObj = REPORT_CATEGORIES.find(c => c.id === selectedCategory);
    setExporting(true);

    try {
      // Pass exportAll=true to bypass pagination on the server and fetch complete matching dataset
      const queryString = buildQueryParams({ exportAll: 'true' });
      const res = await fetch(`${activeCategoryObj.endpoint}?${queryString}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Server error while exporting data');
      const json = await res.json();
      const exportData = json.records || [];

      if (exportData.length === 0) {
        showToast('No records available for export.', 'error');
        setExporting(false);
        return;
      }

      const schema = REPORT_CSV_SCHEMAS[selectedCategory];
      const headers = schema.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');

      const rows = exportData.map(record =>
        schema.map(col => sanitizeForCSV(record[col.key], col.isDate)).join(',')
      );

      // Prepend UTF-8 BOM (\uFEFF) to guarantee proper encoding in Excel and Google Sheets
      const csvString = '\uFEFF' + [headers, ...rows].join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const filenameMap = {
        students: `Student_Registration_Report_${dateStr}.csv`,
        announcements: `Announcement_Report_${dateStr}.csv`,
        events: `Event_Report_${dateStr}.csv`,
        attendance: `Event_Attendance_Report_${dateStr}.csv`,
        pages: `Page_Activity_Report_${dateStr}.csv`,
        moderation: `Post_Moderation_Report_${dateStr}.csv`
      };
      const filename = filenameMap[selectedCategory] || `WMSU_Report_${dateStr}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Successfully generated and downloaded ${filename}`);
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export failed. Please check network connection and try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="reports-container">
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`report-toast ${toastMessage.type}`} role="status">
            <i className={`fa-solid ${toastMessage.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
            <span>{toastMessage.message}</span>
          </div>
        )}

        {/* ==================== A. PAGE HEADER ==================== */}
        <header className="reports-header">
          <div className="header-text-group">
            <h1 className="header-title">Reports & Statistics</h1>
            <p className="header-desc">
              Generate, analyze, and export reports about campus announcements, events, students, and system activities.
            </p>
          </div>
          <div className="header-meta-group">
            <div className="generation-timestamp">
              <span className="timestamp-label">Current Report Date:</span>
              <span className="timestamp-value">
                {lastGeneratedAt || new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <button
              type="button"
              className="btn-sync-refresh"
              onClick={fetchReportData}
              disabled={loading || exporting}
              title="Refresh Current Report"
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* ==================== B. SUMMARY STATISTICS CARDS ==================== */}
        <section className="summary-cards-grid" aria-label="Summary System Statistics">
          <div className="summary-card maroon-accent">
            <div className="card-body">
              <span className="card-label">Total Registered Students</span>
              <span className="card-number">{summaryStats.totalRegisteredStudents.toLocaleString()}</span>
              <span className="card-footer-desc">Verified & active student database</span>
            </div>
            <div className="card-icon-container">
              <i className="fa-solid fa-user-graduate"></i>
            </div>
          </div>

          <div className="summary-card gold-accent">
            <div className="card-body">
              <span className="card-label">Announcements Published</span>
              <span className="card-number">{summaryStats.totalAnnouncementsPublished.toLocaleString()}</span>
              <span className="card-footer-desc">Approved university & college posts</span>
            </div>
            <div className="card-icon-container">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
          </div>

          <div className="summary-card crimson-accent">
            <div className="card-body">
              <span className="card-label">Total Events Created</span>
              <span className="card-number">{summaryStats.totalEventsCreated.toLocaleString()}</span>
              <span className="card-footer-desc">Scheduled institutional gatherings</span>
            </div>
            <div className="card-icon-container">
              <i className="fa-solid fa-calendar-check"></i>
            </div>
          </div>

          <div className="summary-card dark-maroon-accent">
            <div className="card-body">
              <span className="card-label">Total Event Registrations</span>
              <span className="card-number">{summaryStats.totalEventRegistrations.toLocaleString()}</span>
              <span className="card-footer-desc">Combined registered student signups</span>
            </div>
            <div className="card-icon-container">
              <i className="fa-solid fa-clipboard-user"></i>
            </div>
          </div>
        </section>

        {/* ==================== C. REPORT CATEGORY SELECTION ==================== */}
        <section className="category-selection-section" aria-label="Report Category Tabs">
          <div className="category-selection-header">
            <h2>Select Report Category</h2>
            <span className="category-indicator">Active Category: <strong>{REPORT_CATEGORIES.find(c => c.id === selectedCategory)?.label}</strong></span>
          </div>
          <div className="category-tabs-grid">
            {REPORT_CATEGORIES.map(category => (
              <button
                key={category.id}
                type="button"
                className={`category-tab-btn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                <div className="tab-icon-wrap">
                  <i className={`fa-solid ${category.icon}`}></i>
                </div>
                <span className="tab-title">{category.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ==================== 4. REPORT FILTERS ==================== */}
        <section className="reports-card filter-panel-section">
          <div className="filter-panel-header">
            <h3><i className="fa-solid fa-filter maroon-text"></i> Filter Parameters</h3>
            <span className="filter-hint">Fields adjust based on the selected report category</span>
          </div>

          <form onSubmit={handleApplyFilters} className="filter-grid-form">
            <div className="filter-field">
              <label htmlFor="filter-date-from">Date From</label>
              <input
                id="filter-date-from"
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-field">
              <label htmlFor="filter-date-to">Date To</label>
              <input
                id="filter-date-to"
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="filter-input"
              />
            </div>

            {/* College Filter: Applicable for students, announcements, pages */}
            {['students', 'announcements', 'pages'].includes(selectedCategory) && (
              <div className="filter-field">
                <label htmlFor="filter-college">College</label>
                <select
                  id="filter-college"
                  value={collegeFilter}
                  onChange={e => {
                    setCollegeFilter(e.target.value);
                    setDeptFilter('');
                  }}
                  className="filter-select"
                >
                  <option value="">All Colleges</option>
                  {collegeList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Department Filter: Applicable for students and announcements */}
            {['students', 'announcements'].includes(selectedCategory) && (
              <div className="filter-field">
                <label htmlFor="filter-dept">Department</label>
                <select
                  id="filter-dept"
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Departments</option>
                  {deptList
                    .filter(d => !collegeFilter || String(d.college_id) === String(collegeFilter))
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
              </div>
            )}

            {/* Program Filter: Applicable for students */}
            {selectedCategory === 'students' && (
              <div className="filter-field">
                <label htmlFor="filter-program">Academic Program</label>
                <select
                  id="filter-program"
                  value={programFilter}
                  onChange={e => setProgramFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Programs</option>
                  {programList
                    .filter(p => !deptFilter || String(p.department_id) === String(deptFilter))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
            )}

            {/* Category Filter: Applicable for announcements, events, and pages */}
            {['announcements', 'events', 'pages'].includes(selectedCategory) && (
              <div className="filter-field">
                <label htmlFor="filter-type">Category Classification</label>
                <select
                  id="filter-type"
                  value={categoryTypeFilter}
                  onChange={e => setCategoryTypeFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Categories</option>
                  {selectedCategory === 'announcements' && (
                    <>
                      <option value="Academic">Academic</option>
                      <option value="Administrative">Administrative</option>
                      <option value="Student Life">Student Life</option>
                      <option value="Emergency">Emergency Alert</option>
                    </>
                  )}
                  {selectedCategory === 'events' && (
                    <>
                      <option value="Academic">Academic</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Sports">Sports</option>
                      <option value="Webinar">Webinar / Workshop</option>
                    </>
                  )}
                  {selectedCategory === 'pages' && (
                    <>
                      <option value="College">College</option>
                      <option value="Department">Department</option>
                      <option value="Organization">Student Organization</option>
                      <option value="Office">Administrative Office</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="filter-field">
              <label htmlFor="filter-status">Status</label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                {selectedCategory === 'students' && (
                  <>
                    <option value="Verified">Verified</option>
                    <option value="Pending">Pending Verification</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}
                {selectedCategory === 'announcements' && (
                  <>
                    <option value="Published">Published</option>
                    <option value="Pending">Pending Review</option>
                    <option value="Archived">Archived</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}
                {selectedCategory === 'events' && (
                  <>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </>
                )}
                {selectedCategory === 'attendance' && (
                  <>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Not Marked">Not Marked</option>
                  </>
                )}
                {selectedCategory === 'pages' && (
                  <>
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}
                {selectedCategory === 'moderation' && (
                  <>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Pending">Pending</option>
                    <option value="Archived">Archived</option>
                  </>
                )}
              </select>
            </div>

            <div className="filter-actions-group">
              <button type="button" className="btn-filter-reset" onClick={handleResetFilters} disabled={loading}>
                <i className="fa-solid fa-rotate-left"></i> Reset
              </button>
            </div>
          </form>
        </section>

        {/* ==================== 7. DATABASE ANALYTICS CHARTS ==================== */}
        {analyticsData && (
          <section className="reports-card analytics-breakdown-card" aria-label="Analytics Summary">
            <div className="analytics-header">
              <h3><i className="fa-solid fa-chart-pie maroon-text"></i> Category Breakdown Analysis</h3>
              <span className="analytics-subtitle">Aggregated from PostgreSQL records for current criteria</span>
            </div>

            <div className="analytics-metrics-strip">
              {analyticsData.summaryPills && analyticsData.summaryPills.map((pill, idx) => (
                <div key={idx} className="metric-pill">
                  <span className="metric-pill-label">{pill.label}</span>
                  <span className="metric-pill-value">{pill.value}</span>
                </div>
              ))}
            </div>

            {analyticsData.distribution && analyticsData.distribution.length > 0 && (
              <div className="distribution-bars-container">
                {analyticsData.distribution.map((item, idx) => {
                  const maxVal = Math.max(...analyticsData.distribution.map(d => d.count), 1);
                  const pct = Math.min(100, Math.round((item.count / maxVal) * 100));
                  return (
                    <div key={idx} className="dist-bar-item">
                      <div className="dist-bar-label-group">
                        <span className="dist-label">{item.label}</span>
                        <span className="dist-count">{item.count.toLocaleString()}</span>
                      </div>
                      <div className="dist-track">
                        <div className="dist-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ==================== 5 & 6. PREVIEW TABLE & CSV EXPORT ==================== */}
        <section className="reports-card report-table-section" aria-label="Report Data Preview">
          {/* Table Header & Controls */}
          <div className="table-controls-bar">
            <div className="table-title-group">
              <h3 className="preview-heading">Report Preview</h3>
              <span className="records-count-chip">
                {filteredAndSortedRecords.length.toLocaleString()} Matching Record{filteredAndSortedRecords.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="table-action-group">
              <div className="search-box">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  placeholder="Search in preview..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="search-input"
                />
              </div>

              {/* Primary CSV Export Button */}
              <button
                type="button"
                className="btn-export-csv"
                onClick={handleExportCSV}
                disabled={loading || exporting || records.length === 0}
                title="Download complete filtered dataset as a spreadsheet-ready CSV"
              >
                <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-file-csv'}`}></i>
                <span>{exporting ? 'Generating CSV...' : 'Export CSV'}</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="report-alert-banner error" role="alert">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Table Container */}
          <div className="table-scroll-wrap">
            {loading ? (
              <div className="table-loader-state">
                <div className="loading-spinner"></div>
                <p>Loading database records...</p>
              </div>
            ) : paginatedRows.length > 0 ? (
              <table className="reports-data-table">
                <thead>
                  <tr>
                    {currentSchema.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="sortable-th"
                        title={`Click to sort by ${col.label}`}
                      >
                        <div className="th-content">
                          <span>{col.label}</span>
                          <span className="sort-icon">
                            {sortColumn === col.key ? (
                              sortOrder === 'asc' ? <i className="fa-solid fa-arrow-up-short-wide"></i> : <i className="fa-solid fa-arrow-down-wide-short"></i>
                            ) : (
                              <i className="fa-solid fa-sort"></i>
                            )}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, rIdx) => (
                    <tr key={row.id || row.student_id || row.attendance_id || rIdx}>
                      {currentSchema.map(col => (
                        <td key={col.key} className={col.key.includes('status') ? 'status-td' : ''}>
                          {col.key.includes('status') ? (
                            <span className={`status-pill ${String(row[col.key] || '').toLowerCase().replace(/\s+/g, '-')}`}>
                              {formatCellValue(row[col.key])}
                            </span>
                          ) : (
                            formatCellValue(row[col.key], col.isDate)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="table-empty-state">
                <i className="fa-solid fa-inbox empty-icon"></i>
                <h4>No Records Match Filters</h4>
                <p>Try modifying your date scope or selecting broader college/department criteria.</p>
              </div>
            )}
          </div>

          {/* Pagination Toolbar */}
          {!loading && filteredAndSortedRecords.length > 0 && (
            <div className="table-pagination-footer">
              <span className="pagination-text">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedRecords.length)} of {filteredAndSortedRecords.length} entries
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  className="btn-page"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <i className="fa-solid fa-chevron-left"></i> Previous
                </button>
                <span className="page-indicator">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  className="btn-page"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default Reports;