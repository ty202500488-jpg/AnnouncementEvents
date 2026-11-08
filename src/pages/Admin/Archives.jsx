import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout'; // Import existing AdminLayout
import '../styles/Archives.css';

const Archives = () => {
  // State Management
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryError, setSummaryError] = useState(false);

  // Summary counts state
  const [summary, setSummary] = useState({
    totalArchived: 0,
    announcements: 0,
    events: 0,
    other: 0,
    thisMonth: 0,
  });

  // Records list & pagination
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
  });

  // Filter States
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState('ALL');
  const [reasonFilter, setReasonFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Modal States
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [recordToRestore, setRecordToRestore] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [actionFeedback, setActionFeedback] = useState({ type: '', message: '' });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Shared Auth Header Generator
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  };

  // Fetch Summary Metrics
  const fetchArchiveSummary = useCallback(async () => {
    setSummaryError(false);
    try {
      const res = await fetch('/api/admin/archives/summary', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch summary counts');
      const data = await res.json();
      setSummary({
        totalArchived: data.totalArchived || 0,
        announcements: data.announcements || 0,
        events: data.events || 0,
        other: data.other || 0,
        thisMonth: data.thisMonth || 0,
      });
    } catch (err) {
      console.error('Summary fetch error:', err);
      setSummaryError(true);
    }
  }, []);

  // Fetch Paginated & Filtered Archive Records
  const fetchArchivedRecords = useCallback(
    async (page = 1) => {
      setRecordsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
          search: debouncedSearch,
          category: activeCategory,
          type: recordTypeFilter,
          reason: reasonFilter,
          dateFrom,
          dateTo,
          sort: sortBy,
        });

        const res = await fetch(`/api/admin/archives?${queryParams.toString()}`, {
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}: Unable to retrieve archives.`);
        }

        const data = await res.json();
        setRecords(data.records || []);
        setPagination({
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          totalRecords: data.totalRecords || 0,
          limit: data.limit || 10,
        });
      } catch (err) {
        console.error('Records fetch error:', err);
        setError(err.message || 'An error occurred while loading archived records.');
      } finally {
        setRecordsLoading(false);
        setLoading(false);
      }
    },
    [debouncedSearch, activeCategory, recordTypeFilter, reasonFilter, dateFrom, dateTo, sortBy, pagination.limit]
  );

  // Trigger Data Loads
  useEffect(() => {
    fetchArchiveSummary();
  }, [fetchArchiveSummary]);

  useEffect(() => {
    fetchArchivedRecords(1);
  }, [debouncedSearch, activeCategory, recordTypeFilter, reasonFilter, dateFrom, dateTo, sortBy]);

  const handleRefresh = () => {
    fetchArchiveSummary();
    fetchArchivedRecords(pagination.currentPage);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setActiveCategory('ALL');
    setRecordTypeFilter('ALL');
    setReasonFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  };

  // CSV Export Handler
  const handleExportCSV = async () => {
    try {
      const queryParams = new URLSearchParams({
        search: debouncedSearch,
        category: activeCategory,
        type: recordTypeFilter,
        reason: reasonFilter,
        dateFrom,
        dateTo,
        export: 'true',
      });

      const response = await fetch(`/api/admin/archives/export?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to generate export file.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `wmsu-archive-records-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Restore Handler
  const confirmRestore = async () => {
    if (!recordToRestore) return;
    setIsRestoring(true);
    setActionFeedback({ type: '', message: '' });

    try {
      const res = await fetch(`/api/admin/archives/${recordToRestore.id}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ recordType: recordToRestore.type }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Restoration failed.');

      setActionFeedback({
        type: 'success',
        message: `"${recordToRestore.title}" restored successfully. Content returned to workflow without force publishing.`,
      });
      setIsRestoreModalOpen(false);
      setRecordToRestore(null);
      handleRefresh();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  // Date Formatter helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? 'N/A'
      : date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  return (
    <AdminLayout>
      <div className="archives-page">
        {/* Top Feedback Banner */}
        {actionFeedback.message && (
          <div className={`archives-alert archives-alert-${actionFeedback.type}`} role="alert">
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback({ type: '', message: '' })}
              className="archives-alert-close"
              aria-label="Close notification"
            >
              &times;
            </button>
          </div>
        )}

        {/* Page Header */}
        <header className="archives-header">
          <div className="archives-header-left">
            <nav className="archives-breadcrumb" aria-label="Breadcrumb">
              <Link to="/admin">Admin</Link>
              <span className="archives-breadcrumb-separator">/</span>
              <span className="archives-breadcrumb-current">Archives</span>
            </nav>
            <div className="archives-title-group">
              <i className="fa-solid fa-box-archive archives-header-icon" aria-hidden="true"></i>
              <div>
                <h1 className="archives-title">Archives</h1>
                <p className="archives-subtitle">
                  Manage, review, and restore historical announcements, events, and retained system records.
                </p>
              </div>
            </div>
          </div>

          <div className="archives-header-actions">
            <button
              type="button"
              className="archives-btn archives-btn-secondary"
              onClick={handleRefresh}
              disabled={recordsLoading}
              title="Refresh archive data"
            >
              <i className={`fa-solid fa-rotate-right ${recordsLoading ? 'fa-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="archives-btn archives-btn-primary"
              onClick={handleExportCSV}
              disabled={pagination.totalRecords === 0}
              title="Export current filtered selection to CSV"
            >
              <i className="fa-solid fa-file-export"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        {/* Summary Overview Cards */}
        <section className="archives-summary-grid" aria-label="Archive summary statistics">
          <div className="archives-card">
            <div className="archives-card-body">
              <div className="archives-card-info">
                <span className="archives-card-label">Total Archived Records</span>
                <span className="archives-card-value">
                  {summaryError ? '—' : summary.totalArchived.toLocaleString()}
                </span>
              </div>
              <div className="archives-card-icon archives-icon-maroon">
                <i className="fa-solid fa-box-archive"></i>
              </div>
            </div>
          </div>

          <div className="archives-card">
            <div className="archives-card-body">
              <div className="archives-card-info">
                <span className="archives-card-label">Archived Announcements</span>
                <span className="archives-card-value">
                  {summaryError ? '—' : summary.announcements.toLocaleString()}
                </span>
              </div>
              <div className="archives-card-icon archives-icon-gold">
                <i className="fa-solid fa-bullhorn"></i>
              </div>
            </div>
          </div>

          <div className="archives-card">
            <div className="archives-card-body">
              <div className="archives-card-info">
                <span className="archives-card-label">Archived Events</span>
                <span className="archives-card-value">
                  {summaryError ? '—' : summary.events.toLocaleString()}
                </span>
              </div>
              <div className="archives-card-icon archives-icon-dark">
                <i className="fa-solid fa-calendar-check"></i>
              </div>
            </div>
          </div>

          <div className="archives-card">
            <div className="archives-card-body">
              <div className="archives-card-info">
                <span className="archives-card-label">Other Records</span>
                <span className="archives-card-value">
                  {summaryError ? '—' : summary.other.toLocaleString()}
                </span>
              </div>
              <div className="archives-card-icon archives-icon-slate">
                <i className="fa-solid fa-folder-tree"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Category Tabs & Filter Controls */}
        <div className="archives-controls-container">
          {/* Category Tabs */}
          <div className="archives-category-tabs" role="tablist">
            {[
              { id: 'ALL', label: 'All Records', icon: 'fa-layer-group' },
              { id: 'ANNOUNCEMENT', label: 'Announcements', icon: 'fa-bullhorn' },
              { id: 'EVENT', label: 'Events', icon: 'fa-calendar-days' },
              { id: 'PAGE', label: 'Pages', icon: 'fa-file-lines' },
              { id: 'MODERATION', label: 'Moderation Records', icon: 'fa-shield-halved' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeCategory === tab.id}
                className={`archives-tab-btn ${activeCategory === tab.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(tab.id)}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Detailed Filters Panel */}
          <div className="archives-filters-panel">
            <div className="archives-filter-row">
              {/* Search Bar */}
              <div className="archives-search-group">
                <i className="fa-solid fa-magnifying-glass archives-search-icon"></i>
                <input
                  type="text"
                  placeholder="Search title, keywords, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="archives-input archives-search-input"
                  aria-label="Search records"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="archives-search-clear"
                    aria-label="Clear search query"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {/* Archive Reason Filter */}
              <div className="archives-filter-select-wrapper">
                <label htmlFor="reason-filter" className="sr-only">
                  Archive Reason
                </label>
                <select
                  id="reason-filter"
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="archives-select"
                >
                  <option value="ALL">All Archive Reasons</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="MANUAL">Manually Archived</option>
                  <option value="TAKEN_DOWN">Taken Down / Removed</option>
                  <option value="COMPLETED">Completed Event</option>
                </select>
              </div>

              {/* Sorting Filter */}
              <div className="archives-filter-select-wrapper">
                <label htmlFor="sort-filter" className="sr-only">
                  Sort Order
                </label>
                <select
                  id="sort-filter"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="archives-select"
                >
                  <option value="newest">Newest Archived First</option>
                  <option value="oldest">Oldest Archived First</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Date Range & Reset Row */}
            <div className="archives-filter-row archives-filter-row-secondary">
              <div className="archives-date-group">
                <label className="archives-date-label">Archive Date Range:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="archives-input archives-date-input"
                  aria-label="Archive date from"
                />
                <span className="archives-date-separator">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="archives-input archives-date-input"
                  aria-label="Archive date to"
                />
              </div>

              <div className="archives-filter-actions">
                <span className="archives-count-indicator">
                  Showing <strong>{pagination.totalRecords}</strong> matching record(s)
                </span>
                {(searchQuery ||
                  activeCategory !== 'ALL' ||
                  reasonFilter !== 'ALL' ||
                  dateFrom ||
                  dateTo ||
                  sortBy !== 'newest') && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="archives-btn-text"
                  >
                    <i className="fa-solid fa-filter-circle-xmark"></i> Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Data Table / Cards Container */}
        <section className="archives-table-card" aria-label="Archived records table">
          {recordsLoading ? (
            <div className="archives-loading-state">
              <i className="fa-solid fa-spinner fa-spin archives-spinner"></i>
              <p>Loading archived records...</p>
            </div>
          ) : error ? (
            <div className="archives-error-state">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <h3>Failed to Load Archives</h3>
              <p>{error}</p>
              <button onClick={handleRefresh} className="archives-btn archives-btn-secondary">
                <i className="fa-solid fa-rotate-right"></i> Retry
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="archives-empty-state">
              <i className="fa-solid fa-box-open"></i>
              <h3>
                {searchQuery || activeCategory !== 'ALL' || dateFrom
                  ? 'No records match your filters'
                  : 'No archived records yet'}
              </h3>
              <p>
                {searchQuery || activeCategory !== 'ALL' || dateFrom
                  ? 'Try adjusting your search criteria or clear active filters.'
                  : 'Records will appear here when announcements, events, or pages are archived.'}
              </p>
              {(searchQuery || activeCategory !== 'ALL' || dateFrom) && (
                <button onClick={handleClearFilters} className="archives-btn archives-btn-primary">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Table */}
              <div className="archives-table-responsive">
                <table className="archives-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Type</th>
                      <th scope="col">Author / Office</th>
                      <th scope="col">Archived Date</th>
                      <th scope="col">Archived By</th>
                      <th scope="col">Archive Reason</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td className="archives-td-title">
                          <button
                            type="button"
                            className="archives-title-btn"
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsDetailsModalOpen(true);
                            }}
                            title="Click to view full record details"
                          >
                            {record.title}
                          </button>
                        </td>
                        <td>
                          <span className={`archives-badge archives-badge-${record.type?.toLowerCase()}`}>
                            {record.type}
                          </span>
                        </td>
                        <td className="archives-td-muted">{record.author || record.office || 'System'}</td>
                        <td className="archives-td-muted">{formatDate(record.archivedAt)}</td>
                        <td className="archives-td-muted">{record.archivedBy || 'Automated System'}</td>
                        <td>
                          <span className="archives-reason-tag">{record.archiveReason || 'Standard Expiration'}</span>
                        </td>
                        <td>
                          <span className="archives-badge archives-badge-archived">Archived</span>
                        </td>
                        <td className="text-right">
                          <div className="archives-row-actions">
                            <button
                              type="button"
                              className="archives-action-btn"
                              title="Inspect Record"
                              onClick={() => {
                                setSelectedRecord(record);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <i className="fa-solid fa-eye"></i>
                            </button>
                            <button
                              type="button"
                              className="archives-action-btn archives-action-restore"
                              title="Restore Record"
                              onClick={() => {
                                setRecordToRestore(record);
                                setIsRestoreModalOpen(true);
                              }}
                            >
                              <i className="fa-solid fa-rotate-left"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="archives-mobile-cards">
                {records.map((record) => (
                  <div key={record.id} className="archives-mobile-card">
                    <div className="archives-mobile-card-header">
                      <span className={`archives-badge archives-badge-${record.type?.toLowerCase()}`}>
                        {record.type}
                      </span>
                      <span className="archives-mobile-date">{formatDate(record.archivedAt)}</span>
                    </div>
                    <h4
                      className="archives-mobile-title"
                      onClick={() => {
                        setSelectedRecord(record);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      {record.title}
                    </h4>
                    <div className="archives-mobile-meta">
                      <div>
                        <strong>Author:</strong> {record.author || record.office || 'System'}
                      </div>
                      <div>
                        <strong>Reason:</strong> {record.archiveReason || 'Standard Expiration'}
                      </div>
                    </div>
                    <div className="archives-mobile-actions">
                      <button
                        type="button"
                        className="archives-btn archives-btn-secondary archives-btn-sm"
                        onClick={() => {
                          setSelectedRecord(record);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <i className="fa-solid fa-eye"></i> View
                      </button>
                      <button
                        type="button"
                        className="archives-btn archives-btn-primary archives-btn-sm"
                        onClick={() => {
                          setRecordToRestore(record);
                          setIsRestoreModalOpen(true);
                        }}
                      >
                        <i className="fa-solid fa-rotate-left"></i> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <footer className="archives-pagination">
                  <span className="archives-pagination-info">
                    Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong>
                  </span>
                  <div className="archives-pagination-buttons">
                    <button
                      type="button"
                      className="archives-btn archives-btn-secondary"
                      disabled={pagination.currentPage === 1 || recordsLoading}
                      onClick={() => fetchArchivedRecords(pagination.currentPage - 1)}
                    >
                      <i className="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <button
                      type="button"
                      className="archives-btn archives-btn-secondary"
                      disabled={pagination.currentPage === pagination.totalPages || recordsLoading}
                      onClick={() => fetchArchivedRecords(pagination.currentPage + 1)}
                    >
                      Next <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </section>

        {/* Record Details Modal */}
        {isDetailsModalOpen && selectedRecord && (
          <div className="archives-modal-overlay" onClick={() => setIsDetailsModalOpen(false)}>
            <div
              className="archives-modal-container"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="record-details-title"
              aria-modal="true"
            >
              <header className="archives-modal-header">
                <div className="archives-modal-title-wrap">
                  <span className={`archives-badge archives-badge-${selectedRecord.type?.toLowerCase()}`}>
                    {selectedRecord.type}
                  </span>
                  <h3 id="record-details-title" className="archives-modal-title">
                    {selectedRecord.title}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="archives-modal-close"
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </header>

              <div className="archives-modal-body">
                <div className="archives-detail-grid">
                  <div>
                    <label>Author / Responsible Office</label>
                    <p>{selectedRecord.author || selectedRecord.office || 'N/A'}</p>
                  </div>
                  <div>
                    <label>Original Publication Date</label>
                    <p>{formatDate(selectedRecord.publishedAt)}</p>
                  </div>
                  <div>
                    <label>Archived Date</label>
                    <p>{formatDate(selectedRecord.archivedAt)}</p>
                  </div>
                  <div>
                    <label>Archived By</label>
                    <p>{selectedRecord.archivedBy || 'Automated System'}</p>
                  </div>
                  <div>
                    <label>Archive Reason</label>
                    <p>{selectedRecord.archiveReason || 'Standard Expiration'}</p>
                  </div>
                  <div>
                    <label>Status Before Archival</label>
                    <p>{selectedRecord.previousStatus || 'Published'}</p>
                  </div>
                </div>

                <div className="archives-detail-section">
                  <label>Original Content Preview</label>
                  <div className="archives-content-preview">
                    {selectedRecord.content || 'No content payload recorded for this record.'}
                  </div>
                </div>

                {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                  <div className="archives-detail-section">
                    <label>Associated Attachments</label>
                    <ul className="archives-attachment-list">
                      {selectedRecord.attachments.map((file, idx) => (
                        <li key={idx}>
                          <i className="fa-solid fa-paperclip"></i>
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            {file.name || `Attachment ${idx + 1}`}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <footer className="archives-modal-footer">
                <button
                  type="button"
                  className="archives-btn archives-btn-secondary"
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="archives-btn archives-btn-primary"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setRecordToRestore(selectedRecord);
                    setIsRestoreModalOpen(true);
                  }}
                >
                  <i className="fa-solid fa-rotate-left"></i> Restore Record
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Restore Safe Confirmation Dialog */}
        {isRestoreModalOpen && recordToRestore && (
          <div className="archives-modal-overlay" onClick={() => !isRestoring && setIsRestoreModalOpen(false)}>
            <div
              className="archives-modal-container archives-modal-sm"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="restore-modal-title"
              aria-modal="true"
            >
              <header className="archives-modal-header">
                <h3 id="restore-modal-title" className="archives-modal-title">
                  Confirm Record Restoration
                </h3>
                <button
                  onClick={() => !isRestoring && setIsRestoreModalOpen(false)}
                  className="archives-modal-close"
                  disabled={isRestoring}
                >
                  &times;
                </button>
              </header>

              <div className="archives-modal-body">
                <p>
                  Are you sure you want to restore <strong>"{recordToRestore.title}"</strong>?
                </p>
                <blockquote className="archives-notice-box">
                  <i className="fa-solid fa-shield-halved"></i>
                  <div>
                    <strong>Publication Policy Notice:</strong>
                    <br />
                    Restoring this item will safely return it to its respective administration module for review or
                    management. It will <strong>NOT</strong> automatically re-publish old or expired content live onto
                    student feeds.
                  </div>
                </blockquote>
              </div>

              <footer className="archives-modal-footer">
                <button
                  type="button"
                  className="archives-btn archives-btn-secondary"
                  onClick={() => setIsRestoreModalOpen(false)}
                  disabled={isRestoring}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="archives-btn archives-btn-primary"
                  onClick={confirmRestore}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Restoring...
                    </>
                  ) : (
                    'Confirm Restore'
                  )}
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Archives;