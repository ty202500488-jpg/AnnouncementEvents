import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout'; // Import existing AdminLayout
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import '../styles/Archives.css';

const Archives = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State Management
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryError, setSummaryError] = useState(false);

  // Summary counts & School Years state
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(
    searchParams.get('academicYearId') || 'ALL'
  );
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
      const qs = selectedAcademicYear && selectedAcademicYear !== 'ALL'
        ? `?academicYearId=${encodeURIComponent(selectedAcademicYear)}`
        : '';
      const res = await fetch(`/api/admin/archives/summary${qs}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch summary counts');
      const data = await res.json();
      if (data.academicYears) {
        setAcademicYears(data.academicYears);
      }
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
  }, [selectedAcademicYear]);

  // Fetch Paginated & Filtered Archive Records
  const fetchArchivedRecords = useCallback(
    async (page = 1, customLimit) => {
      setRecordsLoading(true);
      setError(null);
      const effectiveLimit = customLimit || pagination.limit;
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: effectiveLimit.toString(),
          search: debouncedSearch,
          category: activeCategory,
          type: recordTypeFilter,
          reason: reasonFilter,
          academicYearId: selectedAcademicYear,
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
        const incoming = Array.isArray(data.records) ? data.records : [];
        const seenKeys = new Set();
        const uniqueRecords = incoming.filter((r) => {
          const k = r.uid || `${r.type || 'POST'}-${r.id}`;
          if (seenKeys.has(k)) return false;
          seenKeys.add(k);
          return true;
        });
        setRecords(uniqueRecords);
        setPagination({
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          totalRecords: data.totalRecords || 0,
          limit: data.limit || effectiveLimit,
        });
      } catch (err) {
        console.error('Records fetch error:', err);
        setError(err.message || 'An error occurred while loading archived records.');
      } finally {
        setRecordsLoading(false);
        setLoading(false);
      }
    },
    [debouncedSearch, activeCategory, recordTypeFilter, reasonFilter, selectedAcademicYear, dateFrom, dateTo, sortBy, pagination.limit]
  );

  // Trigger Data Loads
  useEffect(() => {
    fetchArchiveSummary();
  }, [fetchArchiveSummary]);

  useEffect(() => {
    fetchArchivedRecords(1);
  }, [debouncedSearch, activeCategory, recordTypeFilter, reasonFilter, selectedAcademicYear, dateFrom, dateTo, sortBy]);

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
    setSelectedAcademicYear('ALL');
    setSearchParams({});
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
        academicYearId: selectedAcademicYear,
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
      setActionFeedback({ type: 'error', message: `Export failed: ${err.message}` });
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
        body: JSON.stringify({ recordType: recordToRestore.type, type: recordToRestore.type }),
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
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <Link to="/admin">Home</Link>
              <span className="archives-breadcrumb-separator">/</span>
              <span className="archives-breadcrumb-current">Archives</span>
            </nav>
            <div>
              <h1 className="archives-title">Archives</h1>
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

        {/* Clickable Summary KPI Strip */}
        <section className="admin-kpi-strip" aria-label="Archive summary statistics">
          {[
            { id: 'ALL', label: 'Total Archived', value: summary.totalArchived, icon: 'fa-box-archive', tone: 'blue', valTone: '' },
            { id: 'ANNOUNCEMENT', label: 'Announcements', value: summary.announcements, icon: 'fa-bullhorn', tone: 'amber', valTone: 'tone-amber' },
            { id: 'EVENT', label: 'Archived Events', value: summary.events, icon: 'fa-calendar-check', tone: 'emerald', valTone: 'tone-emerald' },
            { id: 'PAGE', label: 'Other Records', value: summary.other, icon: 'fa-folder-tree', tone: 'slate', valTone: 'tone-slate' }
          ].map(card => (
            <button
              key={card.id}
              type="button"
              className={`admin-kpi-tile ${activeCategory === card.id ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(card.id)}
            >
              <div className="admin-kpi-meta">
                <span className="admin-kpi-label">{card.label}</span>
                <span className={`admin-kpi-value ${card.valTone}`}>
                  {summaryError ? '—' : card.value.toLocaleString()}
                </span>
              </div>
              <span className={`admin-kpi-icon tone-${card.tone}`} aria-hidden="true">
                <i className={`fa-solid ${card.icon}`}></i>
              </span>
            </button>
          ))}
        </section>

        {/* Single-Row Inline Filter Bar */}
        <div className="admin-inline-filter-card">
          <div className="admin-inline-filter-row">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="admin-inline-select"
              aria-label="Filter by archive category"
            >
              <option value="ALL">All Categories</option>
              <option value="ANNOUNCEMENT">Announcements</option>
              <option value="EVENT">Events</option>
              <option value="REGISTRATION">Event Registrations</option>
              <option value="ATTENDANCE">Attendance Records</option>
              <option value="PAGE">Pages</option>
              <option value="MODERATION">Moderation Records</option>
            </select>

            <div className="admin-inline-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input
                type="text"
                placeholder="Search title, keywords, student, or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-inline-search-input"
                aria-label="Search records"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="admin-inline-clear-btn"
                  aria-label="Clear search query"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <select
              id="school-year-filter"
              value={selectedAcademicYear}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAcademicYear(val);
                if (val && val !== 'ALL') {
                  setSearchParams({ academicYearId: val });
                } else {
                  setSearchParams({});
                }
              }}
              className="admin-inline-select"
              aria-label="Filter by School Year"
            >
              <option value="ALL">All School Years</option>
              {academicYears.map((yr) => (
                <option key={yr.id} value={String(yr.id)}>
                  {yr.label || `${yr.start_year}–${yr.end_year} (${yr.semester}) — ${yr.status || (yr.is_active ? 'Active' : 'Archived')}`}
                </option>
              ))}
            </select>

            <select
              id="reason-filter"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="admin-inline-select"
              aria-label="Filter by archive reason"
            >
              <option value="ALL">All Archive Reasons</option>
              <option value="EXPIRED">Expired</option>
              <option value="MANUAL">Manually Archived</option>
              <option value="TAKEN_DOWN">Taken Down / Removed</option>
              <option value="COMPLETED">Completed Event</option>
            </select>

            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="admin-inline-select"
              aria-label="Sort archived records"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="alphabetical">Sort: A–Z</option>
            </select>

            <button
              type="button"
              onClick={handleClearFilters}
              className="admin-inline-reset-btn"
              title="Reset filters"
              aria-label="Reset filters"
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* Data Table / Cards Container */}
        <section className="archives-table-card" aria-label="Archived records table">
          <div className="admin-table-head">
            <div className="admin-table-title">
              <i className="fa-solid fa-box-archive" aria-hidden="true"></i>
              <span>Archived Records</span>
            </div>
            <span className="admin-table-matching">{pagination.totalRecords ?? 0} Matching</span>
          </div>

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
                {searchQuery || activeCategory !== 'ALL' || selectedAcademicYear !== 'ALL' || reasonFilter !== 'ALL' || dateFrom
                  ? 'No records match your filters'
                  : 'No archived records yet'}
              </h3>
              <p>
                {searchQuery || activeCategory !== 'ALL' || selectedAcademicYear !== 'ALL' || reasonFilter !== 'ALL' || dateFrom
                  ? 'Try adjusting your search criteria or clear active filters.'
                  : 'Records will appear here when announcements, events, or pages are archived.'}
              </p>
              {(searchQuery || activeCategory !== 'ALL' || selectedAcademicYear !== 'ALL' || reasonFilter !== 'ALL' || dateFrom) && (
                <button onClick={handleClearFilters} className="archives-btn archives-btn-primary">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Administrative Archives Data Table */}
              <div className="archives-table-responsive">
                <table className="archives-table">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Title / Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Original Owner</th>
                      <th scope="col">Archived Date</th>
                      <th scope="col">Archive Reason</th>
                      <th scope="col" className="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const recordTypeUpper = String(record.type || '').toUpperCase();
                      const isRestorable = ['ANNOUNCEMENT', 'EVENT', 'PAGE'].includes(recordTypeUpper);
                      const ownerLabel =
                        record.author && record.office && record.author !== record.office
                          ? `${record.author} (${record.office})`
                          : record.author || record.office || 'System';

                      return (
                        <tr key={record.uid || `${record.type}-${record.id}`}>
                          <td>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                              #{record.id}
                            </span>
                          </td>
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
                          <td className="archives-td-muted">{ownerLabel}</td>
                          <td className="archives-td-muted">{formatDate(record.archivedAt)}</td>
                          <td>
                            <span className="archives-reason-tag">{record.archiveReason || 'Standard Expiration'}</span>
                          </td>
                          <td className="text-right">
                            <div className="admin-action-pill-group">
                              <button
                                type="button"
                                className="admin-action-icon is-view"
                                title="View Details"
                                aria-label="View Details"
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setIsDetailsModalOpen(true);
                                }}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              {isRestorable && (
                                <button
                                  type="button"
                                  className="admin-action-icon is-approve"
                                  title="Restore Record"
                                  aria-label="Restore Record"
                                  onClick={() => {
                                    setRecordToRestore(record);
                                    setIsRestoreModalOpen(true);
                                  }}
                                >
                                  <i className="fa-solid fa-rotate-left"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {!recordsLoading && !error && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalRecords={pagination.totalRecords}
              rowsPerPage={pagination.limit}
              loading={recordsLoading}
              onPageChange={(page) => fetchArchivedRecords(page)}
              onRowsPerPageChange={(limit) => {
                setPagination((prev) => ({ ...prev, limit, currentPage: 1 }));
                fetchArchivedRecords(1, limit);
              }}
            />
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
        <ConfirmationModal
          isOpen={isRestoreModalOpen && Boolean(recordToRestore)}
          title="Confirm Record Restoration"
          message={
            recordToRestore
              ? `Are you sure you want to restore "${recordToRestore.title}"? Restoring this item safely returns it to its administration module without force-publishing expired content onto student feeds.`
              : ''
          }
          variant="primary"
          confirmText="Confirm Restore"
          cancelText="Cancel"
          loading={isRestoring}
          onCancel={() => !isRestoring && setIsRestoreModalOpen(false)}
          onConfirm={confirmRestore}
        />
      </div>
    </AdminLayout>
  );
};

export default Archives;