import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import '../styles/Reports.css';

// 6 Core Report Categories matching administrative requirements
const REPORT_CATEGORIES = [
  {
    id: 'students',
    label: 'Student Directory Report',
    icon: 'fa-user-graduate',
    tone: 'emerald',
    description: 'Comprehensive student registration and verification directory across colleges, departments, programs, and year levels.',
    endpoint: '/api/admin/reports/students'
  },
  {
    id: 'announcements',
    label: 'Announcement Report',
    icon: 'fa-bullhorn',
    tone: 'amber',
    description: 'Published, pending, and archived campus announcements with category, author, unit affiliation, and publication dates.',
    endpoint: '/api/admin/reports/announcements'
  },
  {
    id: 'events',
    label: 'Event Report',
    icon: 'fa-calendar-days',
    tone: 'rose',
    description: 'Campus event schedule, organizer pages, venues, registration counts, and lifecycle status across school years.',
    endpoint: '/api/admin/reports/events'
  },
  {
    id: 'attendance',
    label: 'Event Attendance Report',
    icon: 'fa-qrcode',
    tone: 'blue',
    description: 'Student event registration and QR attendance verification log with timestamps and staff marker details.',
    endpoint: '/api/admin/reports/attendance'
  },
  {
    id: 'pages',
    label: 'Page & Staff Activity Report',
    icon: 'fa-building-columns',
    tone: 'crimson',
    description: 'Directory of official campus pages, assigned staff, unit affiliations, total posts, and current operational status.',
    endpoint: '/api/admin/reports/pages'
  },
  {
    id: 'moderation',
    label: 'Post Moderation & Audit Report',
    icon: 'fa-clipboard-check',
    tone: 'slate',
    description: 'Review and moderation trail detailing post approvals, rejections, reviewers, decision dates, and reasons.',
    endpoint: '/api/admin/reports/moderation'
  }
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
  // Report Category & Two-View State (null = Reports Hub, string = Detail Report View)
  const [selectedCategory, setSelectedCategory] = useState('students');
  const [activeReportView, setActiveReportView] = useState(null);

  // Summary Metrics State (From /api/admin/reports/summary)
  const [summaryStats, setSummaryStats] = useState({
    totalRegisteredStudents: 0,
    totalAnnouncementsPublished: 0,
    totalEventsCreated: 0,
    totalEventRegistrations: 0
  });

  // Filter States
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown Metadata Options (Populated from DB)
  const [academicYearList, setAcademicYearList] = useState([]);
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
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Fetch Filter Metadata (Colleges, Departments, Programs, School Years)
  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/metadata', { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAcademicYearList(data.academicYears || []);
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
    if (academicYearFilter) params.append('academicYearId', academicYearFilter);
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
  }, [academicYearFilter, dateFrom, dateTo, collegeFilter, deptFilter, programFilter, categoryTypeFilter, statusFilter]);

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
  }, [selectedCategory, fetchReportData]);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchReportData();
  };

  const handleResetFilters = () => {
    setAcademicYearFilter('');
    setDateFrom('');
    setDateTo('');
    setCollegeFilter('');
    setDeptFilter('');
    setProgramFilter('');
    setCategoryTypeFilter('');
    setStatusFilter('');
    setSearchTerm('');
    setSortColumn('');
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
  const handleExportCSV = async (categoryOverride = null) => {
    const targetCategoryId = typeof categoryOverride === 'string' ? categoryOverride : selectedCategory;
    const activeCategoryObj = REPORT_CATEGORIES.find(c => c.id === targetCategoryId);
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

      const schema = REPORT_CSV_SCHEMAS[targetCategoryId];
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
      const filename = filenameMap[targetCategoryId] || `WMSU_Report_${dateStr}.csv`;

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
            <div className="admin-page-breadcrumb">
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <span>Home</span>
              <span aria-hidden="true">/</span>
              {activeReportView ? (
                <>
                  <button
                    type="button"
                    className="reports-breadcrumb-link"
                    onClick={() => setActiveReportView(null)}
                  >
                    Reports
                  </button>
                  <span aria-hidden="true">/</span>
                  <span className="is-current">
                    {REPORT_CATEGORIES.find(c => c.id === activeReportView)?.label || 'Report'}
                  </span>
                </>
              ) : (
                <span className="is-current">Reports</span>
              )}
            </div>
            <h1 className="header-title">
              {activeReportView
                ? (REPORT_CATEGORIES.find(c => c.id === activeReportView)?.label || 'Report')
                : 'Campus & Operations Reports'}
            </h1>
          </div>

          {activeReportView ? (
            <div className="header-meta-group" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="reports-csv-btn"
                onClick={() => window.print()}
              >
                <i className="fa-solid fa-print" aria-hidden="true"></i>
                <span>Print Report</span>
              </button>
              <button
                type="button"
                className="reports-open-btn"
                style={{ flex: 'none' }}
                onClick={() => handleExportCSV(activeReportView)}
                disabled={exporting || loading}
              >
                <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-file-csv'}`} aria-hidden="true"></i>
                <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          ) : (
            <div className="header-meta-group" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              {lastGeneratedAt && (
                <span className="admin-header-amber-pill">
                  <i className="fa-solid fa-calendar" aria-hidden="true"></i>
                  <span>{lastGeneratedAt}</span>
                </span>
              )}
            </div>
          )}
        </header>

        {/* ==================== B. REPORTS HUB GRID (WHEN NO REPORT IS OPEN) ==================== */}
        {!activeReportView ? (
          <section className="reports-hub-grid" aria-label="Available Administrative Reports">
            {REPORT_CATEGORIES.map(category => (
              <article key={category.id} className="reports-hub-card">
                <div>
                  <div className="reports-hub-card-head">
                    <span className={`reports-hub-icon tone-${category.tone}`} aria-hidden="true">
                      <i className={`fa-solid ${category.icon}`}></i>
                    </span>
                    <h2 className="reports-hub-title">{category.label}</h2>
                  </div>
                  <p className="reports-hub-desc" style={{ marginTop: '0.7rem' }}>
                    {category.description}
                  </p>
                </div>

                <div className="reports-hub-actions">
                  <button
                    type="button"
                    className="reports-open-btn"
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setActiveReportView(category.id);
                      setCurrentPage(1);
                    }}
                  >
                    <i className="fa-solid fa-table-list" aria-hidden="true"></i>
                    <span>Open Report</span>
                  </button>
                  <button
                    type="button"
                    className="reports-csv-btn"
                    onClick={() => handleExportCSV(category.id)}
                    disabled={exporting}
                    title={`Export ${category.label} to CSV`}
                  >
                    <i className="fa-solid fa-file-csv" aria-hidden="true"></i>
                    <span>CSV</span>
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="reports-unified-card" aria-label="Report Data">
            {/* ==================== C. INTEGRATED FILTER BAR ==================== */}
            <div className="reports-unified-filter-bar">
              <form onSubmit={handleApplyFilters} className="admin-inline-filter-row">
                <div className="admin-inline-search">
                  <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                  <input
                    type="text"
                    placeholder={`Search ${REPORT_CATEGORIES.find(c => c.id === activeReportView)?.label || 'report'}...`}
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="admin-inline-search-input"
                    aria-label="Search report records"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="admin-inline-clear-btn"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchTerm('');
                        setCurrentPage(1);
                      }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                <select
                  id="filter-school-year"
                  value={academicYearFilter}
                  onChange={e => setAcademicYearFilter(e.target.value)}
                  className="admin-inline-select"
                  aria-label="School Year"
                >
                  <option value="">All School Years</option>
                  {academicYearList.map(yr => (
                    <option key={yr.id} value={yr.id}>
                      {yr.year_label} ({yr.semester}) — {yr.status || (yr.is_active ? 'Active' : 'Archived')}
                    </option>
                  ))}
                </select>

                <input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="admin-inline-select"
                  aria-label="Date From"
                  title="Date From"
                />

                <input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="admin-inline-select"
                  aria-label="Date To"
                  title="Date To"
                />

                {['students', 'announcements', 'pages'].includes(selectedCategory) && (
                  <select
                    id="filter-college"
                    value={collegeFilter}
                    onChange={e => {
                      setCollegeFilter(e.target.value);
                      setDeptFilter('');
                    }}
                    className="admin-inline-select"
                    aria-label="College"
                  >
                    <option value="">All Colleges</option>
                    {collegeList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}

                {['students', 'announcements'].includes(selectedCategory) && (
                  <select
                    id="filter-dept"
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="admin-inline-select"
                    aria-label="Department"
                  >
                    <option value="">All Departments</option>
                    {deptList
                      .filter(d => !collegeFilter || String(d.college_id) === String(collegeFilter))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                )}

                {selectedCategory === 'students' && (
                  <select
                    id="filter-program"
                    value={programFilter}
                    onChange={e => setProgramFilter(e.target.value)}
                    className="admin-inline-select"
                    aria-label="Academic Program"
                  >
                    <option value="">All Programs</option>
                    {programList
                      .filter(p => !deptFilter || String(p.department_id) === String(deptFilter))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                )}

                {['announcements', 'events', 'pages'].includes(selectedCategory) && (
                  <select
                    id="filter-type"
                    value={categoryTypeFilter}
                    onChange={e => setCategoryTypeFilter(e.target.value)}
                    className="admin-inline-select"
                    aria-label="Category Classification"
                  >
                    <option value="">All Classifications</option>
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
                )}

                <select
                  id="filter-status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="admin-inline-select"
                  aria-label="Status"
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

                <button type="button" className="admin-inline-reset-btn" onClick={handleResetFilters} disabled={loading}>
                  <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                  <span>Reset</span>
                </button>
              </form>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="report-alert-banner error" role="alert" style={{ margin: '1rem' }}>
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
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={filteredAndSortedRecords.length}
              rowsPerPage={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onRowsPerPageChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
              }}
            />
          )}
            </section>
        )}
      </div>
    </AdminLayout>
  );
};

export default Reports;