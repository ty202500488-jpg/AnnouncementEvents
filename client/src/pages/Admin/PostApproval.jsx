import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
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
            <h1 className="pa-title">Post Approval</h1>
            <p className="pa-subtitle">
              Review Staff-submitted announcements and events before they are published to the WMSU community.
            </p>
          </div>

          <div className="pa-header-actions">
            <button 
              type="button" 
              className="btn-pa-secondary"
              onClick={fetchApprovalData}
              disabled={loading}
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'pa-spin-icon' : ''}`}></i>
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

        {/* ================= SUMMARY METRIC CARDS ================= */}
        <div className="pa-summary-grid">
          
          <div className="pa-summary-card pa-pointer-card" onClick={() => { handleTabChange('pending'); setContentTypeFilter('all'); }}>
            <div className="pa-card-body">
              <div className="pa-card-info">
                <span className="pa-card-label">Total Pending Reviews</span>
                <div className="pa-card-value">{loading ? '...' : summaryCounts.totalPending}</div>
                <span className="pa-card-subtext pa-status-amber-text">Requires administrative decision</span>
              </div>
              <div className="pa-card-icon-box pa-amber-box">
                <i className="fa-solid fa-file-circle-check"></i>
              </div>
            </div>
          </div>

          <div className="pa-summary-card pa-pointer-card" onClick={() => { handleTabChange('pending'); setContentTypeFilter('announcement'); }}>
            <div className="pa-card-body">
              <div className="pa-card-info">
                <span className="pa-card-label">Pending Announcements</span>
                <div className="pa-card-value">{loading ? '...' : summaryCounts.pendingAnnouncements}</div>
                <span className="pa-card-subtext">Campus updates & notices</span>
              </div>
              <div className="pa-card-icon-box pa-maroon-box">
                <i className="fa-solid fa-bullhorn"></i>
              </div>
            </div>
          </div>

          <div className="pa-summary-card pa-pointer-card" onClick={() => { handleTabChange('pending'); setContentTypeFilter('event'); }}>
            <div className="pa-card-body">
              <div className="pa-card-info">
                <span className="pa-card-label">Pending Events</span>
                <div className="pa-card-value">{loading ? '...' : summaryCounts.pendingEvents}</div>
                <span className="pa-card-subtext">Activities & gatherings</span>
              </div>
              <div className="pa-card-icon-box pa-maroon-box">
                <i className="fa-solid fa-calendar-days"></i>
              </div>
            </div>
          </div>

        </div>

        {/* ================= NAVIGATION TABS & TOOLBAR ================= */}
        <div className="pa-controls-card">
          
          {/* Tabs */}
          <div className="pa-tabs-list">
            {[
              { id: 'pending', label: `Pending Queue (${summaryCounts.totalPending})` },
              { id: 'reviewed', label: 'Recently Reviewed' },
              { id: 'correction', label: 'Needs Correction' },
              { id: 'all', label: 'All Submissions' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`pa-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="pa-toolbar">
            <div className="pa-search-box">
              <i className="fa-solid fa-magnifying-glass pa-search-icon"></i>
              <input 
                type="text" 
                placeholder="Search title, author, or page name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="pa-search-input"
                aria-label="Search submissions"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="pa-clear-search-btn"
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

            <div className="pa-filter-item">
              <select 
                className="pa-select"
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
            </div>

            {(activeTab === 'reviewed' || activeTab === 'all') && (
              <div className="pa-filter-item">
                <select 
                  className="pa-select"
                  value={statusFilter}
                  aria-label="Filter by approval status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="all">All Approval Statuses</option>
                  {activeTab === 'all' && <option value="pending">Pending</option>}
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            <div className="pa-filter-item">
              <input
                type="date"
                className="pa-select"
                value={submissionDateFilter}
                aria-label="Filter by submission date"
                onChange={(e) => {
                  setSubmissionDateFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                title="Filter by Submission Date"
              />
            </div>

            <div className="pa-filter-item">
              <select 
                className="pa-select"
                value={sortOrder}
                aria-label="Sort submissions"
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="oldest">Oldest First (Priority Queue)</option>
                <option value="newest">Newest First</option>
              </select>
            </div>

            {(searchQuery || contentTypeFilter !== 'all' || statusFilter !== 'all' || submissionDateFilter || sortOrder !== 'oldest') && (
              <button 
                type="button" 
                className="btn-pa-link"
                onClick={() => {
                  setSearchQuery('');
                  setContentTypeFilter('all');
                  setStatusFilter('all');
                  setSubmissionDateFilter('');
                  setSortOrder('oldest');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

        </div>

        {/* ================= DATA TABLE DISPLAY ================= */}
        <div className="pa-table-card">
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
                          <span className="pa-audience-pill">{item.audience || 'All Students'}</span>
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
                        <div className="pa-action-button-group" style={{ justifyContent: 'flex-end', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button 
                            type="button" 
                            className="btn-pa-table-action"
                            onClick={() => {
                              setSelectedItem(item);
                              setActiveModal('review');
                            }}
                          >
                            View
                          </button>
                          {String(item.status || '').toLowerCase() === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn-pa-emerald"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedItem(item);
                                  setDecisionType('approve');
                                  setActiveModal('decision');
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-pa-rose"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedItem(item);
                                  setDecisionType('reject');
                                  setActiveModal('decision');
                                }}
                              >
                                Reject
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
        </div>

        {/* ================= PAGINATION BAR ================= */}
        {!loading && items.length > 0 && (
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
                    <div><strong>Audience / Scope:</strong> {selectedItem.audience || 'All Students'}</div>
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
                      <i className="fa-regular fa-image"></i>
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
                      Request Corrections
                    </button>
                    <button 
                      type="button" 
                      className="btn-pa-rose" 
                      onClick={() => {
                        setDecisionType('reject');
                        setActiveModal('decision');
                      }}
                    >
                      Reject Submission
                    </button>
                    <button 
                      type="button" 
                      className="btn-pa-emerald" 
                      onClick={() => {
                        setDecisionType('approve');
                        setActiveModal('decision');
                      }}
                    >
                      Approve & Publish
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