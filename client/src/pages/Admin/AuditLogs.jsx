import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../assets/components/AdminLayout'; // Adjust path if AdminLayout is in components
import '../styles/AuditLogs.css';

const AuditLogs = () => {
  // --- Filters & State ---
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    securityEvents: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaryError, setSummaryError] = useState(false);

  // Filter values
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState('ALL');
  const [isSecurityOnly, setIsSecurityOnly] = useState(false);
  const [periodPreset, setPeriodPreset] = useState('7d'); // 24h, 7d, 30d, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal / Details
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Modal accessibility ref
  const modalRef = useRef(null);

  // --- Debounce Search ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on search
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Handle Date Preset Calculation
  useEffect(() => {
    if (periodPreset === 'custom') return;
    const now = new Date();
    let start = new Date();

    if (periodPreset === '24h') {
      start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (periodPreset === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (periodPreset === '30d') {
      start.setDate(now.getDate() - 30);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
    setCurrentPage(1);
  }, [periodPreset]);

  // --- Fetch Logs Data ---
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch,
        role: selectedRole !== 'ALL' ? selectedRole : '',
        module: selectedModule !== 'ALL' ? selectedModule : '',
        outcome: selectedOutcome !== 'ALL' ? selectedOutcome : '',
        securityOnly: isSecurityOnly,
        startDate: startDate || '',
        endDate: endDate || ''
      });

      const res = await fetch(`/api/admin/audit-logs?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status})`);
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.totalRecords || 0);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Audit log fetch error:', err);
      setError(err.message || 'An error occurred while loading audit events.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, selectedRole, selectedModule, selectedOutcome, isSecurityOnly, startDate, endDate]);

  // --- Fetch Summary Overview Metrics ---
  const fetchAuditSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(false);

    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        startDate: startDate || '',
        endDate: endDate || ''
      });

      const res = await fetch(`/api/admin/audit-logs/summary?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load metrics');
      const data = await res.json();

      setSummary({
        totalActions: data.totalActions ?? 0,
        successfulActions: data.successfulActions ?? 0,
        failedActions: data.failedActions ?? 0,
        securityEvents: data.securityEvents ?? 0,
      });
    } catch (err) {
      console.error('Audit summary error:', err);
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAuditLogs();
    fetchAuditSummary();
  }, [fetchAuditLogs, fetchAuditSummary]);

  // --- Clear Filters Action ---
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedRole('ALL');
    setSelectedModule('ALL');
    setSelectedOutcome('ALL');
    setIsSecurityOnly(false);
    setPeriodPreset('7d');
    setCurrentPage(1);
  };

  // --- Export CSV Handler ---
  const handleExportCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        search: debouncedSearch,
        role: selectedRole !== 'ALL' ? selectedRole : '',
        module: selectedModule !== 'ALL' ? selectedModule : '',
        outcome: selectedOutcome !== 'ALL' ? selectedOutcome : '',
        securityOnly: isSecurityOnly,
        startDate: startDate || '',
        endDate: endDate || ''
      });

      const res = await fetch(`/api/admin/audit-logs/export?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to generate export file.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const formattedDate = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `wmsu-audit-logs-${formattedDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'CSV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  // Modal keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleOpenDetails = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const renderBadgeClass = (outcome) => {
    switch ((outcome || '').toUpperCase()) {
      case 'SUCCESS':
        return 'badge-success';
      case 'FAILURE':
      case 'FAILED':
        return 'badge-failure';
      case 'DENIED':
      case 'ACCESS_DENIED':
        return 'badge-denied';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <AdminLayout>
      <div className="audit-logs-page">
        
        {/* ==================== PAGE HEADER ==================== */}
        <div className="audit-logs-header">
          <div>
            <div className="audit-logs-breadcrumb">
              <span onClick={() => window.location.href = '/admin'}>Dashboard</span>
              <i className="fa-solid fa-chevron-right"></i>
              <span className="current">Audit Logs</span>
            </div>
            <h1 className="audit-logs-title">Audit Logs</h1>
            <p className="audit-logs-description">
              Review administrative actions, system activity, and security-related events across WMSU SAMS.
            </p>
          </div>

          <div className="audit-logs-actions">
            {lastRefreshed && (
              <span className="last-refreshed-text">
                Updated: {lastRefreshed}
              </span>
            )}
            <button 
              type="button" 
              className="btn-audit-secondary" 
              onClick={() => { fetchAuditLogs(); fetchAuditSummary(); }}
              disabled={loading}
              title="Refresh Data"
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
            <button 
              type="button" 
              className="btn-audit-primary" 
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              <i className="fa-solid fa-file-csv"></i>
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* ==================== OVERVIEW SUMMARY CARDS ==================== */}
        <div className="audit-logs-summary">
          <div className="summary-card">
            <div className="summary-card-icon icon-total">
              <i className="fa-solid fa-list-check"></i>
            </div>
            <div className="summary-card-body">
              <span className="summary-card-label">Total Actions</span>
              <h2 className="summary-card-value">
                {summaryLoading ? '0' : (summaryError ? '0' : summary.totalActions.toLocaleString())}
              </h2>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-card-icon icon-success">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <div className="summary-card-body">
              <span className="summary-card-label">Successful Actions</span>
              <h2 className="summary-card-value text-success">
                {summaryLoading ? '0' : (summaryError ? '0' : summary.successfulActions.toLocaleString())}
              </h2>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-card-icon icon-failed">
              <i className="fa-solid fa-circle-xmark"></i>
            </div>
            <div className="summary-card-body">
              <span className="summary-card-label">Failed Actions</span>
              <h2 className="summary-card-value text-failure">
                {summaryLoading ? '0' : (summaryError ? '0' : summary.failedActions.toLocaleString())}
              </h2>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-card-icon icon-security">
              <i className="fa-solid fa-shield-cat"></i>
            </div>
            <div className="summary-card-body">
              <span className="summary-card-label">Security Events</span>
              <h2 className="summary-card-value text-security">
                {summaryLoading ? '0' : (summaryError ? '0' : summary.securityEvents.toLocaleString())}
              </h2>
            </div>
          </div>
        </div>

        {/* ==================== FILTER TOOLBAR ==================== */}
        <div className="audit-logs-filters">
          <div className="filter-group search-group">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input 
              type="text" 
              className="audit-input search-input" 
              placeholder="Search actor, action, module, or resource..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="period-preset">Period:</label>
            <select 
              id="period-preset"
              className="audit-select" 
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {periodPreset === 'custom' && (
            <div className="filter-group custom-date-group">
              <input 
                type="date" 
                className="audit-input date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="date-sep">to</span>
              <input 
                type="date" 
                className="audit-input date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          <div className="filter-group">
            <select 
              className="audit-select" 
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Roles</option>
              <option value="Administrator">Administrator</option>
              <option value="Staff">Staff</option>
              <option value="Student">Student</option>
              <option value="Unauthenticated">Unauthenticated</option>
            </select>
          </div>

          <div className="filter-group">
            <select 
              className="audit-select" 
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Modules</option>
              <option value="Authentication">Authentication</option>
              <option value="Student Verification">Student Verification</option>
              <option value="Post Approval">Post Moderation</option>
              <option value="Announcements">Announcements</option>
              <option value="Events">Events</option>
              <option value="Attendance">Attendance</option>
              <option value="Page Management">Page Management</option>
              <option value="Archives">Archives</option>
              <option value="System Settings">System Settings</option>
            </select>
          </div>

          <div className="filter-group">
            <select 
              className="audit-select" 
              value={selectedOutcome}
              onChange={(e) => { setSelectedOutcome(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
              <option value="DENIED">Denied</option>
            </select>
          </div>

          <div className="filter-group checkbox-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={isSecurityOnly}
                onChange={(e) => { setIsSecurityOnly(e.target.checked); setCurrentPage(1); }}
              />
              <span>Security Events Only</span>
            </label>
          </div>

          <button 
            type="button" 
            className="btn-clear-filters" 
            onClick={handleClearFilters}
          >
            Clear Filters
          </button>
        </div>

        {/* Filter Summary Counter */}
        <div className="audit-results-info">
          <span>Showing {logs.length} of {totalRecords} matching audit records</span>
        </div>

        {/* ==================== AUDIT TABLE / DATA STATE ==================== */}
        {error ? (
          <div className="audit-logs-error">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <div>
              <h3>Failed to Load Audit Logs</h3>
              <p>{error}</p>
            </div>
            <button className="btn-audit-primary" onClick={fetchAuditLogs}>
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="audit-logs-loading">
            <div className="skeleton-row"></div>
            <div className="skeleton-row"></div>
            <div className="skeleton-row"></div>
            <div className="skeleton-row"></div>
            <div className="skeleton-row"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="audit-logs-empty">
            <i className="fa-solid fa-folder-open"></i>
            <h3>No audit records match your filters</h3>
            <p>Try adjusting your search query, date selection, or resetting filters.</p>
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="audit-table-wrapper">
            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Affected Resource</th>
                  <th>Outcome</th>
                  <th>Source IP</th>
                  <th className="text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="audit-logs-row">
                    <td className="cell-nowrap cell-timestamp">
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className="actor-cell">
                        <span className="actor-name">{log.actor_label || 'Unauthenticated'}</span>
                        <span className="actor-role-badge">{log.actor_role || '0'}</span>
                      </div>
                    </td>
                    <td className="cell-action">
                      <span className="action-label">{log.action}</span>
                    </td>
                    <td>
                      <span className="module-tag">{log.module}</span>
                    </td>
                    <td className="cell-resource">
                      <span className="resource-type">{log.resource_type || '—'}</span>
                      <span className="resource-title" title={log.resource_title}>
                        {log.resource_title || (log.resource_id ? `#${log.resource_id}` : '—')}
                      </span>
                    </td>
                    <td>
                      <span className={`audit-logs-badge ${renderBadgeClass(log.outcome)}`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="cell-nowrap cell-ip">
                      {log.ip_address || '—'}
                    </td>
                    <td className="text-right">
                      <button 
                        type="button" 
                        className="btn-view-details" 
                        onClick={() => handleOpenDetails(log)}
                        aria-label="View Audit Record Details"
                      >
                        <i className="fa-solid fa-eye"></i> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== SERVER-SIDE PAGINATION ==================== */}
        {!loading && logs.length > 0 && (
          <div className="audit-logs-pagination">
            <div className="pagination-info">
              <span>Page {currentPage} of {totalPages}</span>
              <select 
                className="audit-select size-select" 
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={15}>15 rows</option>
                <option value={30}>30 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>

            <div className="pagination-controls">
              <button 
                className="btn-page" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              >
                <i className="fa-solid fa-chevron-left"></i> Previous
              </button>
              
              <button 
                className="btn-page" 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              >
                Next <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}

        {/* ==================== READ-ONLY DETAILS MODAL ==================== */}
        {isModalOpen && selectedLog && (
          <div className="audit-logs-modal-backdrop" onClick={() => setIsModalOpen(false)}>
            <div 
              className="audit-logs-modal" 
              ref={modalRef} 
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <div className="modal-header">
                <div>
                  <h3 id="modal-title" className="modal-title">Audit Event Details</h3>
                  <span className="modal-id">Event ID: {selectedLog.id}</span>
                </div>
                <button 
                  type="button" 
                  className="modal-close-btn" 
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Close modal"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                <div className="modal-grid">
                  <div className="detail-item">
                    <span className="detail-label">Exact Timestamp</span>
                    <span className="detail-value">{new Date(selectedLog.created_at).toUTCString()}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Outcome</span>
                    <span className={`audit-logs-badge ${renderBadgeClass(selectedLog.outcome)}`}>
                      {selectedLog.outcome}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Actor</span>
                    <span className="detail-value">{selectedLog.actor_label || 'Unauthenticated'}</span>
                    <span className="detail-subtext">ID: {selectedLog.actor_user_id || 0} | Role: {selectedLog.actor_role || 0}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Action</span>
                    <span className="detail-value bold">{selectedLog.action}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Module / Subsystem</span>
                    <span className="detail-value">{selectedLog.module}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Affected Resource</span>
                    <span className="detail-value">{selectedLog.resource_type || 0}</span>
                    <span className="detail-subtext">ID: {selectedLog.resource_id || 0}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Source IP Address</span>
                    <span className="detail-value">{selectedLog.ip_address || '0.0.0.0'}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Request Correlation ID</span>
                    <span className="detail-value">{selectedLog.request_id || 0}</span>
                  </div>
                </div>

                {selectedLog.reason && (
                  <div className="modal-section">
                    <h4>Recorded Reason / Reason Message</h4>
                    <p className="reason-text">{selectedLog.reason}</p>
                  </div>
                )}

                {/* State Changes Table */}
                {selectedLog.metadata?.changes && (
                  <div className="modal-section">
                    <h4>State Changes</h4>
                    <table className="changes-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Previous Value</th>
                          <th>New Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedLog.metadata.changes).map(([field, val]) => (
                          <tr key={field}>
                            <td className="field-name">{field}</td>
                            <td className="old-val">{String(val.old ?? 0)}</td>
                            <td className="new-val">{String(val.new ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Additional Metadata JSON */}
                <div className="modal-section">
                  <h4>Structured Metadata</h4>
                  <pre className="metadata-json">
                    {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-audit-secondary" onClick={() => setIsModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default AuditLogs;