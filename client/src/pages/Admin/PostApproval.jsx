import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import { PostAudienceBadge } from '../../assets/components/PortalShellElements';
import '../styles/PostApproval.css';

const PostApproval = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pending');
  const [contentTypeFilter, setContentTypeFilter] = useState('all'); // 'all', 'announcement', 'event'
  const [statusFilter, setStatusFilter] = useState('all');
  const [submissionDateFilter, setSubmissionDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('oldest');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Async Data States
  const [items, setItems] = useState([]);
  const [summaryCounts, setSummaryCounts] = useState({ pendingAnnouncements: 0, pendingEvents: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal Control States
  const [activeModal, setActiveModal] = useState(null); // 'review', 'decision'
  const [selectedItem, setSelectedItem] = useState(null);
  const [decisionType, setDecisionType] = useState(''); // 'approve', 'reject', 'correction'
  const [decisionReason, setDecisionReason] = useState('');

  // Handle Tab Switch
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setStatusFilter('all');
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({ tab: tabId });
  };

  // Fetch Post Approval Queue Data
  const fetchApprovalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    const queryParams = new URLSearchParams({
      tab: activeTab,
      type: contentTypeFilter,
      status: statusFilter,
      submissionDate: submissionDateFilter,
      search: debouncedSearch,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`/api/admin/post-approval?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setItems(data.items || []);
        if (data.counts) {
          setSummaryCounts(data.counts);
        }
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch pending submission queue.');
      }
    } catch (err) {
      console.error('Fetch Approval Queue Error:', err);
      setError(err.message || 'Unable to connect to post approval service.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, contentTypeFilter, statusFilter, submissionDateFilter, debouncedSearch, sortOrder, pagination.page, pagination.limit, navigate]);

  useEffect(() => {
    fetchApprovalData();
  }, [fetchApprovalData]);

  // Execute Review Decision (Approve / Reject / Correction)
  const handleExecuteDecision = async (reasonFromModal) => {
    if (!selectedItem || !decisionType) return;
    const finalReason = reasonFromModal !== undefined ? reasonFromModal : decisionReason;
    if ((decisionType === 'reject' || decisionType === 'correction') && !String(finalReason || '').trim()) {
      setFeedback({ type: 'error', message: 'A valid explanation is required for rejection or requesting corrections.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
      const response = await fetch(`/api/admin/post-approval/${selectedItem.id}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          type: selectedItem.type,
          decision: decisionType,
          reason: finalReason
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Review decision submitted successfully.' });
        setActiveModal(null);
        setSelectedItem(null);
        setDecisionType('');
        setDecisionReason('');
        fetchApprovalData();
      } else {
        throw new Error(data.message || 'Failed to process decision.');
      }
    } catch (err) {
      console.error('Decision Submission Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="post-approval-container">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="pa-header">
          <div className="pa-header-text">
            <div className="pa-breadcrumb">
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <span>Home</span>
              <span aria-hidden="true">/</span>
              <span className="is-current">Post Approvals</span>
            </div>
            <h1 className="pa-title">Post Approvals</h1>
          </div>

          <div className="pa-header-actions">
            <button
              type="button"
              className="btn-pa-primary"
              onClick={fetchApprovalData}
              disabled={loading}
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'pa-spin-icon' : ''}`} aria-hidden="true"></i>
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {feedback && (
          <div className={`pa-alert-banner pa-alert-${feedback.type}`}>
            <div className="pa-alert-content">
              <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{feedback.message}</span>
            </div>
            <button type="button" className="pa-close-alert-btn" onClick={() => setFeedback(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ================= CLICKABLE KPI STRIP ================= */}
        <div className="admin-kpi-strip" role="tablist" aria-label="Approval queue filters">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending' && contentTypeFilter === 'all'}
            className={`admin-kpi-tile ${activeTab === 'pending' && contentTypeFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => {
              handleTabChange('pending');
              setContentTypeFilter('all');
            }}
          >
            <div className="admin-kpi-meta">
              <span className="admin-kpi-label">Pending Queue</span>
              <span className="admin-kpi-value tone-amber">{loading ? '...' : summaryCounts.totalPending}</span>
            </div>
            <span className="admin-kpi-icon tone-amber" aria-hidden="true">
              <i className="fa-solid fa-hourglass-half"></i>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending' && contentTypeFilter === 'announcement'}
            className={`admin-kpi-tile ${activeTab === 'pending' && contentTypeFilter === 'announcement' ? 'is-active' : ''}`}
            onClick={() => {
              handleTabChange('pending');
              setContentTypeFilter('announcement');
            }}
          >
            <div className="admin-kpi-meta">
              <span className="admin-kpi-label">Announcements</span>
              <span className="admin-kpi-value tone-crimson">{loading ? '...' : summaryCounts.pendingAnnouncements}</span>
            </div>
            <span className="admin-kpi-icon tone-crimson" aria-hidden="true">
              <i className="fa-solid fa-bullhorn"></i>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending' && contentTypeFilter === 'event'}
            className={`admin-kpi-tile ${activeTab === 'pending' && contentTypeFilter === 'event' ? 'is-active' : ''}`}
            onClick={() => {
              handleTabChange('pending');
              setContentTypeFilter('event');
            }}
          >
            <div className="admin-kpi-meta">
              <span className="admin-kpi-label">Pending Events</span>
              <span className="admin-kpi-value">{loading ? '...' : summaryCounts.pendingEvents}</span>
            </div>
            <span className="admin-kpi-icon tone-blue" aria-hidden="true">
              <i className="fa-solid fa-calendar-days"></i>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviewed'}
            className={`admin-kpi-tile ${activeTab === 'reviewed' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('reviewed')}
          >
            <div className="admin-kpi-meta">
              <span className="admin-kpi-label">Reviewed</span>
              <span className="admin-kpi-value tone-emerald">{loading ? '...' : (summaryCounts.totalReviewed ?? 0)}</span>
            </div>
            <span className="admin-kpi-icon tone-emerald" aria-hidden="true">
              <i className="fa-solid fa-circle-check"></i>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'correction'}
            className={`admin-kpi-tile ${activeTab === 'correction' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('correction')}
          >
            <div className="admin-kpi-meta">
              <span className="admin-kpi-label">Corrections</span>
              <span className="admin-kpi-value tone-rose">{loading ? '...' : (summaryCounts.totalCorrection ?? 0)}</span>
            </div>
            <span className="admin-kpi-icon tone-rose" aria-hidden="true">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`admin-kpi-tile ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <div className="admin-kpi-meta">
              <span className="admin-kpi-label">All Submissions</span>
              <span className="admin-kpi-value tone-slate">{loading ? '...' : (summaryCounts.totalAll ?? 0)}</span>
            </div>
            <span className="admin-kpi-icon tone-slate" aria-hidden="true">
              <i className="fa-solid fa-layer-group"></i>
            </span>
          </button>
        </div>

        {/* ================= SINGLE-ROW INLINE FILTER BAR ================= */}
        <div className="admin-inline-filter-card">
          <div className="admin-inline-filter-row">
            <div className="admin-inline-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input 
                type="text" 
                placeholder="Search title, author, or page name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="admin-inline-search-input"
                aria-label="Search submissions"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="admin-inline-clear-btn"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchQuery('');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <select 
              className="admin-inline-select"
              value={contentTypeFilter}
              aria-label="Filter by content type"
              onChange={(e) => {
                setContentTypeFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <option value="all">All Content Types</option>
              <option value="announcement">Announcements Only</option>
              <option value="event">Events Only</option>
            </select>

            {(activeTab === 'reviewed' || activeTab === 'all') && (
              <select 
                className="admin-inline-select"
                value={statusFilter}
                aria-label="Filter by approval status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="all">All Statuses</option>
                {activeTab === 'all' && <option value="pending">Pending</option>}
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            )}

            <input
              type="date"
              className="admin-inline-select"
              value={submissionDateFilter}
              aria-label="Filter by submission date"
              onChange={(e) => {
                setSubmissionDateFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              title="Filter by Submission Date"
            />

            <select 
              className="admin-inline-select"
              value={sortOrder}
              aria-label="Sort submissions"
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <option value="oldest">Queue: Oldest First</option>
              <option value="newest">Queue: Newest First</option>
            </select>

            <button 
              type="button" 
              className="admin-inline-reset-btn"
              title="Reset filters"
              aria-label="Reset filters"
              onClick={() => {
                setSearchQuery('');
                setContentTypeFilter('all');
                setStatusFilter('all');
                setSubmissionDateFilter('');
                setSortOrder('oldest');
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* ================= DATA TABLE DISPLAY ================= */}
        <div className="pa-table-card">
          <div className="admin-table-head">
            <div className="admin-table-title">
              <i className="fa-solid fa-file-circle-check" aria-hidden="true"></i>
              <span>Submission Review Queue</span>
            </div>
            <span className="admin-table-matching">{pagination.total} Matching</span>
          </div>

          {loading ? (
            <div className="pa-table-skeleton-container">
              <div className="pa-skeleton-row"></div>
              <div className="pa-skeleton-row"></div>
              <div className="pa-skeleton-row"></div>
            </div>
          ) : error ? (
            <div className="pa-empty-state">
              <i className="fa-solid fa-triangle-exclamation pa-empty-icon pa-text-rose"></i>
              <h3>Failed to load review queue</h3>
              <p>{error}</p>
              <button type="button" className="btn-pa-primary" onClick={fetchApprovalData}>Retry</button>
            </div>
          ) : items.length === 0 ? (
            <div className="pa-empty-state">
              <i className="fa-solid fa-circle-check pa-empty-icon pa-text-emerald"></i>
              <h3>Review Queue Clear</h3>
              <p>No pending submissions require administrative review at this time.</p>
            </div>
          ) : (
            <div className="pa-table-responsive">
              <table className="pa-data-table">
                <thead>
                  <tr>
                    <th>Post ID</th>
                    <th>Submission Title</th>
                    <th>Type</th>
                    <th>Submitted By</th>
                    <th>Audience / Scope</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th className="pa-text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                          #{item.id}
                        </span>
                      </td>
                      <td>
                        <div className="pa-item-title-cell">
                          <span className="pa-item-title-text">{item.title}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                            {item.category && <span className="pa-item-category-sub">{item.category}</span>}
                            {item.is_university_wide && (
                              <span className="pa-spotlight-badge">
                                <i className="fa-solid fa-bullhorn"></i> University-Wide Spotlight
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`pa-type-tag pa-type-${item.type}`}>
                          <i className={`fa-solid ${item.type === 'event' ? 'fa-calendar-days' : 'fa-bullhorn'} pa-mr-4`}></i>
                          {item.type}
                        </span>
                      </td>
                      <td>
                        <div className="pa-author-cell">
                          <span className="pa-author-name">{item.submitted_by || item.author_name || 'Staff User'}</span>
                          <span className="pa-page-sub">{item.page_name || 'Main Campus'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                          <span className="pa-audience-pill">
                            <PostAudienceBadge audience={item.audience} showLabel />
                          </span>
                          {item.is_university_wide && item.expires_at && (
                            <span className="pa-spotlight-expiry">
                              Until {new Date(item.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="pa-text-muted-cell">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`pa-status-badge pa-status-${String(item.status).toLowerCase().replace(/\s+/g, '_')}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="pa-text-right">
                        <div className="admin-action-pill-group">
                          <button 
                            type="button" 
                            className="admin-action-icon is-view"
                            title="View submission details"
                            aria-label="View submission details"
                            onClick={() => {
                              setSelectedItem(item);
                              setActiveModal('review');
                            }}
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          {String(item.status || '').toLowerCase() === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="admin-action-icon is-approve"
                                title="Approve submission"
                                aria-label="Approve submission"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setDecisionType('approve');
                                  setActiveModal('decision');
                                }}
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                              <button
                                type="button"
                                className="admin-action-icon is-danger"
                                title="Reject submission"
                                aria-label="Reject submission"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setDecisionType('reject');
                                  setActiveModal('decision');
                                }}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= PAGINATION BAR ================= */}
          {!loading && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.total}
              pageSize={pagination.limit}
              onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              onPageSizeChange={(limit) => setPagination(prev => ({ ...prev, limit, page: 1 }))}
              loading={loading}
              itemLabel="submissions"
            />
          )}
        </div>

        {/* ================= MODALS & DRAWERS ================= */}

        {/* 1. DETAILED REVIEW MODAL */}
        {activeModal === 'review' && selectedItem && (
          <div className="pa-modal-backdrop">
            <div className="pa-modal-card pa-modal-large">
              <div className="pa-modal-header">
                <div>
                  <span className={`pa-type-tag pa-type-${selectedItem.type}`}>
                    {selectedItem.type}
                  </span>
                  <h2 className="pa-modal-title-text">{selectedItem.title}</h2>
                </div>
                <button type="button" className="pa-close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="pa-modal-body pa-split-view">
                
                {/* Left: Metadata Details */}
                <div className="pa-details-col">
                  <h3 className="pa-sub-heading">Submission Metadata</h3>
                  <div className="pa-info-grid">
                    <div><strong>Submitted By:</strong> {selectedItem.submitted_by || selectedItem.author_name || 'Staff Member'}</div>
                    <div><strong>Organization / Page:</strong> {selectedItem.page_name || 'University Office'}</div>
                    <div><strong>Category:</strong> {selectedItem.category || 'General'}</div>
                    <div><strong>Audience / Scope:</strong> <PostAudienceBadge audience={selectedItem.audience} showLabel /></div>
                    {selectedItem.is_university_wide && (
                      <>
                        <div>
                          <strong>Spotlight Request:</strong>{' '}
                          <span className="pa-spotlight-badge">University-Wide Spotlight</span>
                        </div>
                        <div>
                          <strong>Active Until:</strong>{' '}
                          {selectedItem.expires_at
                            ? new Date(selectedItem.expires_at).toLocaleString()
                            : 'No expiry specified'}
                        </div>
                      </>
                    )}
                    <div><strong>Submitted Date:</strong> {new Date(selectedItem.created_at).toLocaleString()}</div>
                    {selectedItem.scheduled_at && (
                      <div><strong>Scheduled Publication:</strong> {new Date(selectedItem.scheduled_at).toLocaleString()}</div>
                    )}
                  </div>

                  {/* Event Specific Metadata */}
                  {selectedItem.type === 'event' && (
                    <div className="pa-mt-12 pa-event-meta-card">
                      <h4 className="pa-sub-heading">Event Schedule & Venue</h4>
                      <div><strong>Start Time:</strong> {selectedItem.event_start ? new Date(selectedItem.event_start).toLocaleString() : 'TBD'}</div>
                      <div><strong>End Time:</strong> {selectedItem.event_end ? new Date(selectedItem.event_end).toLocaleString() : 'TBD'}</div>
                      <div><strong>Venue:</strong> {selectedItem.venue || 'Main Campus'}</div>
                      <div><strong>Organizer:</strong> {selectedItem.organizer || 'WMSU Staff'}</div>
                    </div>
                  )}
                </div>

                {/* Right: Content Preview Box */}
                <div className="pa-content-col">
                  <h3 className="pa-sub-heading">Submitted Body Content</h3>
                  {selectedItem.image_url ? (
                    <div className="pa-spotlight-image-preview">
                      <img src={selectedItem.image_url} alt={selectedItem.title} />
                    </div>
                  ) : selectedItem.is_university_wide ? (
                    <div className="pa-spotlight-logo-note">
                      <i className="fa-solid fa-image"></i>
                      <span>No image attached — WMSU logo will display in the Spotlight.</span>
                    </div>
                  ) : null}
                  <div className="pa-body-preview-card">
                    <p>{selectedItem.description || selectedItem.body || 'No text content submitted.'}</p>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pa-modal-footer pa-flex-between">
                <button type="button" className="btn-pa-secondary" onClick={() => setActiveModal(null)}>
                  Close
                </button>

                {String(selectedItem.status || '').toLowerCase() === 'pending' && (
                  <div className="pa-action-button-group">
                    <button 
                      type="button" 
                      className="btn-pa-amber" 
                      onClick={() => {
                        setDecisionType('correction');
                        setActiveModal('decision');
                      }}
                    >
                      <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                      <span>Request Corrections</span>
                    </button>
                    <button 
                      type="button" 
                      className="btn-pa-rose" 
                      onClick={() => {
                        setDecisionType('reject');
                        setActiveModal('decision');
                      }}
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                      <span>Reject</span>
                    </button>
                    <button 
                      type="button" 
                      className="btn-pa-emerald" 
                      onClick={() => {
                        setDecisionType('approve');
                        setActiveModal('decision');
                      }}
                    >
                      <i className="fa-solid fa-check" aria-hidden="true"></i>
                      <span>Approve &amp; Publish</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. DECISION REASON CONFIRMATION MODAL */}
        <ConfirmationModal
          isOpen={activeModal === 'decision' && Boolean(selectedItem)}
          title={
            decisionType === 'approve'
              ? 'Approve & Publish Submission?'
              : decisionType === 'reject'
              ? 'Reject Submission?'
              : 'Request Submission Corrections?'
          }
          message={
            selectedItem
              ? `Are you sure you want to ${
                  decisionType === 'approve'
                    ? 'approve and publish'
                    : decisionType === 'reject'
                    ? 'reject'
                    : 'request corrections for'
                } "${selectedItem.title}" submitted by ${selectedItem.submitted_by || selectedItem.author_name || 'Staff'}?`
              : ''
          }
          variant={decisionType === 'reject' ? 'danger' : decisionType === 'approve' ? 'success' : 'warning'}
          confirmText={
            decisionType === 'approve'
              ? 'Confirm & Publish'
              : decisionType === 'reject'
              ? 'Confirm Rejection'
              : 'Send Correction Request'
          }
          cancelText="Back to Review"
          requireReason={decisionType === 'reject' || decisionType === 'correction'}
          reasonLabel="Administrative Note / Instructions *"
          reasonPlaceholder={`State why this submission is being ${decisionType === 'reject' ? 'rejected' : 'returned for corrections'}...`}
          loading={submitting}
          onCancel={() => setActiveModal('review')}
          onConfirm={(reasonText) => handleExecuteDecision(reasonText)}
        />

      </div>
    </AdminLayout>
  );
};

export default PostApproval;