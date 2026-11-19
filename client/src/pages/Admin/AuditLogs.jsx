import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../assets/components/AdminLayout'; // Adjust path if AdminLayout is in components
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import '../styles/AuditLogs.css';

const formatAuditDescription = (log) => {
  if (!log) return '';
  const actionKey = String(log.action || '').toUpperCase();
  const actionLabel = String(log.action || 'Activity')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const rawTarget = String(log.resource_title || '').trim();
  const isRawIdPlaceholder = /^(user|record|post|page)\s*#\d+$/i.test(rawTarget);
  const cleanTarget = isRawIdPlaceholder ? '' : rawTarget;

  let summaryText = '';
  if (actionKey.includes('LOGIN_FAILED') || actionKey.includes('FAILED_LOGIN')) {
    summaryText = `Failed sign-in attempt${cleanTarget ? ` for ${cleanTarget}` : ''}`;
  } else if (actionKey.includes('LOGIN')) {
    summaryText = `${cleanTarget || log.actor_label || 'User'} signed in to the portal`;
  } else if (actionKey.includes('LOGOUT')) {
    summaryText = `${cleanTarget || log.actor_label || 'User'} signed out of the portal`;
  } else if (actionKey.includes('REGISTER')) {
    summaryText = `Registered new account${cleanTarget ? ` for ${cleanTarget}` : ''}`;
  } else if (cleanTarget) {
    const targetPrefix =
      log.resource_type && !cleanTarget.toLowerCase().startsWith(String(log.resource_type).toLowerCase())
        ? `${String(log.resource_type).toLowerCase()} `
        : '';
    summaryText = `${actionLabel} on ${targetPrefix}${cleanTarget}`;
  } else {
    summaryText = `${actionLabel} in ${log.module || 'System'}`;
  }

  const reasonPart = log.reason ? ` (${log.reason})` : '';
  return `${summaryText}${reasonPart}`;
};

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
  const [actorFilter, setActorFilter] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState('ALL');
  const [isSecurityOnly, setIsSecurityOnly] = useState(false);
  const [periodPreset, setPeriodPreset] = useState('7d'); // 24h, 7d, 30d, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal / Details & Permanent Post Deletion
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
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
        actor: actorFilter,
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
  }, [currentPage, pageSize, debouncedSearch, actorFilter, selectedRole, selectedModule, selectedOutcome, isSecurityOnly, startDate, endDate]);

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
    setActorFilter('');
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
        actor: actorFilter,
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
      setError(err.message || 'CSV export failed.');
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

  const handlePermanentDeletePost = async (reasonText) => {
    if (!postToDelete?.target_post_id) return;
    setDeletingPost(true);
    setActionFeedback(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/content-feed/${postToDelete.target_post_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reasonText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to permanently delete archived post.');
      }

      setActionFeedback({
        type: 'success',
        message: data.message || 'Archived post permanently deleted and creator notified.'
      });
      setPostToDelete(null);
      setIsModalOpen(false);
      await Promise.all([fetchAuditLogs(), fetchAuditSummary()]);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to permanently delete archived post.'
      });
      setPostToDelete(null);
      setIsModalOpen(false);
    } finally {
      setDeletingPost(false);
    }
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
          <div className="audit-header-title-block">
            <div className="audit-logs-breadcrumb">
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <span onClick={() => window.location.href = '/admin'}>Home</span>
              <span>/</span>
              <span className="current">Audit Logs</span>
            </div>
            <h1 className="audit-logs-title">Audit Logs</h1>
          </div>

          <div className="audit-logs-actions">
            <button
              type="button"
              className="btn-audit-secondary"
              onClick={() => window.print()}
            >
              <i className="fa-solid fa-print" aria-hidden="true"></i>
              <span>Print Report</span>
            </button>
            <button
              type="button"
              className="btn-audit-primary"
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-csv'}`} aria-hidden="true"></i>
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* ACTION FEEDBACK BANNER */}
        {actionFeedback && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: actionFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: actionFeedback.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${actionFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className={`fa-solid ${actionFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
              aria-label="Dismiss notification"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ==================== FILTER TOOLBAR ==================== */}
        <div className="admin-inline-filter-card">
          <div className="admin-inline-filter-row">
            <div className="admin-inline-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input
                type="text"
                className="admin-inline-search-input"
                placeholder="Search description, action, module, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search audit logs"
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchTerm('')}
                  className="admin-inline-clear-btn"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <select
              id="period-preset"
              className="admin-inline-select"
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value)}
              aria-label="Period"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {periodPreset === 'custom' && (
              <>
                <input
                  type="date"
                  className="admin-inline-select"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="Start date"
                />
                <input
                  type="date"
                  className="admin-inline-select"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="End date"
                />
              </>
            )}

            <select
              className="admin-inline-select"
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by role"
            >
              <option value="ALL">All Roles</option>
              <option value="Administrator">Administrator</option>
              <option value="Staff">Staff</option>
              <option value="Student">Student</option>
              <option value="Unauthenticated">Unauthenticated</option>
            </select>

            <select
              className="admin-inline-select"
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by module"
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

            <select
              className="admin-inline-select"
              value={selectedOutcome}
              onChange={(e) => { setSelectedOutcome(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by outcome"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
              <option value="DENIED">Denied</option>
            </select>

            <button
              type="button"
              className="admin-inline-reset-btn"
              onClick={handleClearFilters}
              title="Reset filters"
              aria-label="Reset filters"
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
            </button>
          </div>
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
            <div className="admin-table-head">
              <div className="admin-table-title">
                <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i>
                <span>System Audit Logs</span>
              </div>
              <span className="admin-table-matching">{totalRecords} Matching</span>
            </div>

            <table className="audit-logs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const modulePrefix = log.module ? `[${log.module}] ` : '';
                  const descriptionText = formatAuditDescription(log);

                  const isPostArchiveLog =
                    String(log.action || '').toLowerCase().includes('archive') &&
                    ['post', 'announcement', 'event'].includes(String(log.target_type || '').toLowerCase());
                  const canDeleteArchivedPost = Boolean(log.target_post_id && log.target_post_is_archived);
                  const alreadyPurgedPost = isPostArchiveLog && !log.target_post_id;

                  return (
                    <tr key={log.id} className="audit-logs-row">
                      <td className="cell-nowrap cell-timestamp">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className="audit-user-cell">
                          <span className="audit-user-name">{log.actor_label || 'System'}</span>
                          <span className="audit-user-role">@{String(log.actor_role || 'system').toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="cell-action">
                        <span className="audit-action-pill">{log.action}</span>
                        {alreadyPurgedPost && (
                          <span className="audit-purged-tag">Deleted</span>
                        )}
                      </td>
                      <td>
                        <span className="audit-module-text">{log.module || 'system'}</span>
                      </td>
                      <td className="cell-description" title={`${modulePrefix}${descriptionText}`}>
                        <span className="audit-desc-text">{descriptionText}</span>
                      </td>
                      <td className="cell-nowrap">
                        <span className={`audit-logs-badge ${renderBadgeClass(log.outcome || log.status)}`}>
                          {log.outcome || log.status || 'SUCCESS'}
                        </span>
                      </td>
                      <td className="text-right cell-nowrap">
                        <div className="admin-action-pill-group">
                          <button
                            type="button"
                            className="admin-action-icon is-view"
                            onClick={() => handleOpenDetails(log)}
                            title="View Audit Record Details"
                            aria-label="View Audit Record Details"
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          {canDeleteArchivedPost && (
                            <button
                              type="button"
                              className="admin-action-icon is-danger"
                              onClick={() => setPostToDelete(log)}
                              title="Permanently delete this archived post and notify creator"
                              aria-label="Delete archived post"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ==================== INTEGRATED PAGINATION BAR ==================== */}
            {!loading && logs.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalRecords={totalRecords}
                rowsPerPage={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
                onRowsPerPageChange={(limit) => {
                  setPageSize(limit);
                  setCurrentPage(1);
                }}
              />
            )}
          </div>
        )}

        {/* ==================== READ-ONLY DETAILS MODAL ==================== */}
        {isModalOpen && selectedLog && (
          <div className="audit-logs-modal-backdrop" onClick={() => setIsModalOpen(false)}>
            <div 
              className="modal-card audit-logs-modal" 
              ref={modalRef} 
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <div className="modal-header">
                <div>
                  <h2 id="modal-title">Audit Event Details</h2>
                  <span className="modal-id">Event ID: {selectedLog.id}</span>
                </div>
                <button 
                  type="button" 
                  className="close-btn" 
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
                    <span className="detail-value">
                      {new Date(selectedLog.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
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
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Action</span>
                    <span className="detail-value bold">{selectedLog.action}</span>
                  </div>

                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="detail-label">Description</span>
                    <span className="detail-value">{formatAuditDescription(selectedLog)}</span>
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
              </div>

              <div className="modal-footer" style={{ gap: '0.5rem' }}>
                {selectedLog.target_post_id && selectedLog.target_post_is_archived && (
                  <button
                    type="button"
                    className="btn-audit-secondary"
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      borderColor: '#dc2626'
                    }}
                    onClick={() => setPostToDelete(selectedLog)}
                  >
                    <i className="fa-solid fa-trash-can" style={{ marginRight: '0.4rem' }}></i>
                    Permanently Delete Archived Post
                  </button>
                )}
                <button type="button" className="btn-audit-secondary" onClick={() => setIsModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== CONFIRM PERMANENT DELETION OF ARCHIVED POST ==================== */}
        <ConfirmationModal
          isOpen={Boolean(postToDelete)}
          title="Permanently Delete Archived Post?"
          itemName={postToDelete?.target_post_title || postToDelete?.resource_title || 'Archived Post'}
          itemSubtitle={postToDelete ? `Post ID #${postToDelete.target_post_id} • Archived in System Logs` : ''}
          variant="danger"
          confirmText="Permanently Delete & Notify Creator"
          requireReason={true}
          initialReason={postToDelete?.target_post_archive_reason || postToDelete?.reason || ''}
          reasonLabel="Reason for Permanent Deletion (logged & sent to post creator)"
          reasonPlaceholder="Explain why this archived post is being permanently deleted..."
          loading={deletingPost}
          message={`This will permanently remove "${postToDelete?.target_post_title || postToDelete?.resource_title || 'this post'}" from the database, record the permanent deletion in System Audit Logs, and notify the post creator why it was permanently deleted.`}
          onConfirm={handlePermanentDeletePost}
          onCancel={() => setPostToDelete(null)}
        />

      </div>
    </AdminLayout>
  );
};

export default AuditLogs;