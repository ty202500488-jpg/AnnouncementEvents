import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/PostApproval.css';

const PostApproval = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pending');
  const [contentTypeFilter, setContentTypeFilter] = useState('all'); // 'all', 'announcement', 'event'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('oldest');

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
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({ tab: tabId });
  };

  // Fetch Post Approval Queue Data
  const fetchApprovalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    const queryParams = new URLSearchParams({
      tab: activeTab,
      type: contentTypeFilter,
      search: searchQuery,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`http://localhost:5000/api/admin/post-approval?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
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
  }, [activeTab, contentTypeFilter, searchQuery, sortOrder, pagination.page, pagination.limit, navigate]);

  useEffect(() => {
    fetchApprovalData();
  }, [fetchApprovalData]);

  // Execute Review Decision (Approve / Reject / Correction)
  const handleExecuteDecision = async () => {
    if (!selectedItem || !decisionType) return;
    if ((decisionType === 'reject' || decisionType === 'correction') && !decisionReason.trim()) {
      setFeedback({ type: 'error', message: 'A valid explanation is required for rejection or requesting corrections.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/post-approval/${selectedItem.id}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          type: selectedItem.type,
          decision: decisionType,
          reason: decisionReason
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
          <div>
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
              <i className={`fa-solid fa-rotate-right ${loading ? 'spin-icon' : ''}`}></i>
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {feedback && (
          <div className={`pa-alert-banner ${feedback.type}`}>
            <div className="alert-content">
              <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{feedback.message}</span>
            </div>
            <button type="button" className="close-alert-btn" onClick={() => setFeedback(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ================= SUMMARY METRIC CARDS ================= */}
        <div className="pa-summary-grid">
          
          <div className="pa-summary-card pointer-card" onClick={() => { handleTabChange('pending'); setContentTypeFilter('all'); }}>
            <div className="card-body">
              <div>
                <span className="card-label">Total Pending Reviews</span>
                <div className="card-value">{loading ? '...' : summaryCounts.totalPending}</div>
                <span className="card-subtext status-amber-text">Requires administrative decision</span>
              </div>
              <div className="card-icon-box amber-box">
                <i className="fa-solid fa-file-circle-check"></i>
              </div>
            </div>
          </div>

          <div className="pa-summary-card pointer-card" onClick={() => { handleTabChange('pending'); setContentTypeFilter('announcement'); }}>
            <div className="card-body">
              <div>
                <span className="card-label">Pending Announcements</span>
                <div className="card-value">{loading ? '...' : summaryCounts.pendingAnnouncements}</div>
                <span className="card-subtext">Campus updates & notices</span>
              </div>
              <div className="card-icon-box maroon-box">
                <i className="fa-solid fa-bullhorn"></i>
              </div>
            </div>
          </div>

          <div className="pa-summary-card pointer-card" onClick={() => { handleTabChange('pending'); setContentTypeFilter('event'); }}>
            <div className="card-body">
              <div>
                <span className="card-label">Pending Events</span>
                <div className="card-value">{loading ? '...' : summaryCounts.pendingEvents}</div>
                <span className="card-subtext">Activities & gatherings</span>
              </div>
              <div className="card-icon-box maroon-box">
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
              { id: 'correction', label: 'Needs Correction' }
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
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder="Search title, author, or page name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="pa-search-input"
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <div className="pa-filter-item">
              <select 
                className="pa-select"
                value={contentTypeFilter}
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

            <div className="pa-filter-item">
              <select 
                className="pa-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="oldest">Oldest First (Priority Queue)</option>
                <option value="newest">Newest First</option>
              </select>
            </div>

            {(searchQuery || contentTypeFilter !== 'all' || sortOrder !== 'oldest') && (
              <button 
                type="button" 
                className="btn-pa-link"
                onClick={() => {
                  setSearchQuery('');
                  setContentTypeFilter('all');
                  setSortOrder('oldest');
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
            <div className="table-skeleton-container">
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
            </div>
          ) : error ? (
            <div className="pa-empty-state">
              <i className="fa-solid fa-triangle-exclamation empty-icon text-rose"></i>
              <h3>Failed to load review queue</h3>
              <p>{error}</p>
              <button type="button" className="btn-pa-primary" onClick={fetchApprovalData}>Retry</button>
            </div>
          ) : items.length === 0 ? (
            <div className="pa-empty-state">
              <i className="fa-solid fa-circle-check empty-icon text-emerald"></i>
              <h3>Review Queue Clear</h3>
              <p>No pending submissions require administrative review at this time.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="pa-data-table">
                <thead>
                  <tr>
                    <th>Submission Title</th>
                    <th>Type</th>
                    <th>Submitted By</th>
                    <th>Audience / Scope</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>
                        <div className="item-title-cell">
                          <span className="item-title-text">{item.title}</span>
                          {item.category && <span className="item-category-sub">{item.category}</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`type-tag type-${item.type}`}>
                          <i className={`fa-solid ${item.type === 'event' ? 'fa-calendar-days' : 'fa-bullhorn'} margin-right-4`}></i>
                          {item.type}
                        </span>
                      </td>
                      <td>
                        <div className="author-cell">
                          <span className="author-name">{item.submitted_by || item.author_name || 'Staff User'}</span>
                          <span className="page-sub">{item.page_name || 'Main Campus'}</span>
                        </div>
                      </td>
                      <td><span className="audience-pill">{item.audience || 'All Students'}</span></td>
                      <td className="text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-pill status-${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button 
                          type="button" 
                          className="btn-table-action primary"
                          onClick={() => {
                            setSelectedItem(item);
                            setActiveModal('review');
                          }}
                        >
                          Review Content
                        </button>
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
          <div className="pa-pagination-bar">
            <span className="pagination-info">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
            </span>
            <div className="pagination-actions">
              <button 
                type="button" 
                className="btn-pagination"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </button>
              <button 
                type="button" 
                className="btn-pagination"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ================= MODALS & DRAWERS ================= */}

        {/* 1. DETAILED REVIEW MODAL */}
        {activeModal === 'review' && selectedItem && (
          <div className="pa-modal-backdrop">
            <div className="pa-modal-card large-modal">
              <div className="modal-header">
                <div>
                  <span className={`type-tag type-${selectedItem.type}`}>
                    {selectedItem.type}
                  </span>
                  <h2 className="modal-title-text">{selectedItem.title}</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body split-view">
                
                {/* Left: Metadata Details */}
                <div className="details-col">
                  <h3 className="sub-heading">Submission Metadata</h3>
                  <div className="info-grid">
                    <div><strong>Submitted By:</strong> {selectedItem.submitted_by || selectedItem.author_name || 'Staff Member'}</div>
                    <div><strong>Organization / Page:</strong> {selectedItem.page_name || 'University Office'}</div>
                    <div><strong>Category:</strong> {selectedItem.category || 'General'}</div>
                    <div><strong>Audience / Scope:</strong> {selectedItem.audience || 'All Students'}</div>
                    <div><strong>Submitted Date:</strong> {new Date(selectedItem.created_at).toLocaleString()}</div>
                    {selectedItem.scheduled_at && (
                      <div><strong>Scheduled Publication:</strong> {new Date(selectedItem.scheduled_at).toLocaleString()}</div>
                    )}
                  </div>

                  {/* Event Specific Metadata */}
                  {selectedItem.type === 'event' && (
                    <div className="margin-top-12 event-meta-card">
                      <h4 className="sub-heading">Event Schedule & Venue</h4>
                      <div><strong>Start Time:</strong> {selectedItem.event_start ? new Date(selectedItem.event_start).toLocaleString() : 'TBD'}</div>
                      <div><strong>End Time:</strong> {selectedItem.event_end ? new Date(selectedItem.event_end).toLocaleString() : 'TBD'}</div>
                      <div><strong>Venue:</strong> {selectedItem.venue || 'Main Campus'}</div>
                      <div><strong>Organizer:</strong> {selectedItem.organizer || 'WMSU Staff'}</div>
                    </div>
                  )}
                </div>

                {/* Right: Content Preview Box */}
                <div className="content-col">
                  <h3 className="sub-heading">Submitted Body Content</h3>
                  <div className="body-preview-card">
                    <p>{selectedItem.description || selectedItem.body || 'No text content submitted.'}</p>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="modal-footer flex-between">
                <button type="button" className="btn-pa-secondary" onClick={() => setActiveModal(null)}>
                  Close
                </button>

                {activeTab === 'pending' && (
                  <div className="action-button-group">
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
        {activeModal === 'decision' && selectedItem && (
          <div className="pa-modal-backdrop">
            <div className="pa-modal-card small-modal">
              <div className="modal-header">
                <h2>Confirm Decision: {decisionType.toUpperCase()}</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal('review')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Are you sure you want to execute <strong>{decisionType}</strong> for "<strong>{selectedItem.title}</strong>"?
                </p>

                {(decisionType === 'reject' || decisionType === 'correction') && (
                  <div className="form-group margin-top-12">
                    <label htmlFor="decision-reason">Administrative Note / Instructions *</label>
                    <textarea 
                      id="decision-reason"
                      rows="3"
                      required
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      placeholder={`State why this submission is being ${decisionType === 'reject' ? 'rejected' : 'returned for corrections'}...`}
                      className="pa-textarea"
                    ></textarea>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-pa-secondary" onClick={() => setActiveModal('review')}>
                  Back
                </button>
                <button 
                  type="button" 
                  className={`btn-pa-primary ${decisionType === 'reject' ? 'danger-btn' : decisionType === 'approve' ? 'success-btn' : ''}`}
                  disabled={submitting}
                  onClick={handleExecuteDecision}
                >
                  {submitting ? 'Submitting...' : `Confirm ${decisionType}`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default PostApproval;