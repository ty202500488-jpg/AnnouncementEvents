import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/PageManagement.css';

const PageManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab & Filter States ('all', 'pending', 'active', 'suspended', 'archived', 'rejected')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Operational Data States
  const [pagesList, setPagesList] = useState([]);
  const [summaryCounts, setSummaryCounts] = useState({ total: 0, pending: 0, active: 0, suspended: 0, archived: 0 });
  const [eligibleStaffUsers, setEligibleStaffUsers] = useState([]);

  // Async States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal & Drawer States
  const [activeModal, setActiveModal] = useState(null); // 'review', 'create', 'edit', 'staff', 'status_change'
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageStaffMembers, setPageStaffMembers] = useState([]);

  // Form Input States
  const [actionReason, setActionReason] = useState('');
  const [pendingActionType, setPendingActionType] = useState(''); // 'approve', 'reject', 'suspend', 'reactivate', 'archive'
  
  const [pageFormData, setPageFormData] = useState({
    name: '',
    description: '',
    category: 'Organization',
    college: '',
    department: ''
  });

  const [staffFormData, setStaffFormData] = useState({
    userId: '',
    roleScope: 'page_editor'
  });

  // Synchronize Tab with Search Query Params
  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({ tab: tabId });
  };

  // Fetch Page Management Data from API
  const fetchPagesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    const params = new URLSearchParams({
      tab: activeTab,
      search: searchQuery,
      category: categoryFilter,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`http://localhost:5000/api/admin/pages?${params.toString()}`, {
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
        setPagesList(data.pages || []);
        if (data.counts) {
          setSummaryCounts(data.counts);
        }
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch campus pages.');
      }
    } catch (err) {
      console.error('Fetch Pages Error:', err);
      setError(err.message || 'Unable to connect to administrative page services.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, categoryFilter, sortOrder, pagination.page, pagination.limit, navigate]);

  useEffect(() => {
    fetchPagesData();
  }, [fetchPagesData]);

  // Fetch Assigned Staff Members for Selected Page
  const fetchPageStaff = async (pageId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/admin/pages/${pageId}/staff`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      const data = await response.json();
      if (response.ok) {
        setPageStaffMembers(data.staff || []);
        setEligibleStaffUsers(data.eligibleUsers || []);
      }
    } catch (err) {
      console.error('Fetch Page Staff Error:', err);
    }
  };

  // Open Staff Management Modal
  const handleOpenStaffModal = (page) => {
    setSelectedPage(page);
    fetchPageStaff(page.id);
    setActiveModal('staff');
  };

  // Submit Status Lifecycle Action (Approve, Reject, Suspend, Reactivate, Archive)
  const handleExecuteStatusChange = async () => {
    if (!selectedPage || !pendingActionType) return;
    if ((pendingActionType === 'reject' || pendingActionType === 'suspend') && !actionReason.trim()) {
      setFeedback({ type: 'error', message: 'A valid explanation or reason is required for this action.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/pages/${selectedPage.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          action: pendingActionType,
          reason: actionReason
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Page status successfully updated.' });
        setActiveModal(null);
        setSelectedPage(null);
        setActionReason('');
        setPendingActionType('');
        fetchPagesData();
      } else {
        throw new Error(data.message || 'Failed to execute page status update.');
      }
    } catch (err) {
      console.error('Page Status Action Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Page Creation Submit
  const handleCreatePageSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/admin/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(pageFormData)
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Official page successfully established.' });
        setActiveModal(null);
        setPageFormData({ name: '', description: '', category: 'Organization', college: '', department: '' });
        fetchPagesData();
      } else {
        throw new Error(data.message || 'Failed to create page.');
      }
    } catch (err) {
      console.error('Create Page Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Assign Staff Member to Page
  const handleAssignStaffSubmit = async (e) => {
    e.preventDefault();
    if (!staffFormData.userId || !selectedPage) return;

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/pages/${selectedPage.id}/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(staffFormData)
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Staff access assigned successfully.' });
        setStaffFormData({ userId: '', roleScope: 'page_editor' });
        fetchPageStaff(selectedPage.id);
        fetchPagesData();
      } else {
        throw new Error(data.message || 'Failed to assign staff.');
      }
    } catch (err) {
      console.error('Assign Staff Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke Staff Assignment
  const handleRevokePageStaff = async (staffId) => {
    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/pages/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Staff access revoked.' });
        fetchPageStaff(selectedPage.id);
        fetchPagesData();
      } else {
        throw new Error(data.message || 'Failed to revoke staff access.');
      }
    } catch (err) {
      console.error('Revoke Staff Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="page-management-container">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="pm-header">
          <div>
            <h1 className="pm-title">Page Management</h1>
            <p className="pm-subtitle">
              Review official page requests, manage page status, and control page-specific Staff access.
            </p>
          </div>

          <div className="pm-header-actions">
            <button 
              type="button" 
              className="btn-pm-secondary"
              onClick={fetchPagesData}
              disabled={loading}
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'spin-icon' : ''}`}></i>
              <span>Refresh</span>
            </button>

            <button 
              type="button" 
              className="btn-pm-primary"
              onClick={() => setActiveModal('create')}
            >
              <i className="fa-solid fa-plus"></i>
              <span>Create Official Page</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {feedback && (
          <div className={`pm-alert-banner ${feedback.type}`}>
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
        <div className="pm-summary-grid">
          
          <div className="pm-summary-card pointer-card" onClick={() => handleTabSelect('all')}>
            <div className="card-body">
              <div>
                <span className="card-label">Total System Pages</span>
                <div className="card-value">{loading ? '...' : summaryCounts.total}</div>
                <span className="card-subtext">All registered entities</span>
              </div>
              <div className="card-icon-box maroon-box">
                <i className="fa-solid fa-layer-group"></i>
              </div>
            </div>
          </div>

          <div className="pm-summary-card pointer-card" onClick={() => handleTabSelect('pending')}>
            <div className="card-body">
              <div>
                <span className="card-label">Pending Approval</span>
                <div className="card-value">{loading ? '...' : summaryCounts.pending}</div>
                <span className="card-subtext status-amber-text">Awaiting administrative decision</span>
              </div>
              <div className="card-icon-box amber-box">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
            </div>
          </div>

          <div className="pm-summary-card pointer-card" onClick={() => handleTabSelect('active')}>
            <div className="card-body">
              <div>
                <span className="card-label">Active & Approved</span>
                <div className="card-value">{loading ? '...' : summaryCounts.active}</div>
                <span className="card-subtext status-green-text">Publicly operational</span>
              </div>
              <div className="card-icon-box green-box">
                <i className="fa-solid fa-circle-check"></i>
              </div>
            </div>
          </div>

          <div className="pm-summary-card pointer-card" onClick={() => handleTabSelect('suspended')}>
            <div className="card-body">
              <div>
                <span className="card-label">Suspended / Archived</span>
                <div className="card-value">{loading ? '...' : summaryCounts.suspended + summaryCounts.archived}</div>
                <span className="card-subtext status-rose-text">Operations restricted</span>
              </div>
              <div className="card-icon-box rose-box">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
            </div>
          </div>

        </div>

        {/* ================= NAVIGATION TABS & TOOLBAR ================= */}
        <div className="pm-controls-card">
          
          {/* Nav Tabs */}
          <div className="pm-tabs-list">
            {[
              { id: 'all', label: 'All Pages' },
              { id: 'pending', label: `Pending Requests (${summaryCounts.pending})` },
              { id: 'active', label: 'Active Pages' },
              { id: 'suspended', label: 'Suspended' },
              { id: 'archived', label: 'Archived' },
              { id: 'rejected', label: 'Rejected Requests' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`pm-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabSelect(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Toolbar */}
          <div className="pm-toolbar">
            <div className="pm-search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder="Search page name, description, category, or college..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="pm-search-input"
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <div className="pm-filter-item">
              <select 
                className="pm-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="all">All Categories</option>
                <option value="Organization">Student Organization</option>
                <option value="Department">Academic Department</option>
                <option value="College">College Unit</option>
                <option value="Office">University Office</option>
              </select>
            </div>

            {(searchQuery || categoryFilter !== 'all') && (
              <button 
                type="button" 
                className="btn-pm-link"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

        </div>

        {/* ================= DATA TABLE DISPLAY ================= */}
        <div className="pm-table-card">
          {loading ? (
            <div className="table-skeleton-container">
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
            </div>
          ) : error ? (
            <div className="pm-empty-state">
              <i className="fa-solid fa-triangle-exclamation empty-icon text-rose"></i>
              <h3>Failed to load page entries</h3>
              <p>{error}</p>
              <button type="button" className="btn-pm-primary" onClick={fetchPagesData}>Retry</button>
            </div>
          ) : pagesList.length === 0 ? (
            <div className="pm-empty-state">
              <i className="fa-solid fa-layer-group empty-icon"></i>
              <h3>No Pages Found</h3>
              <p>No organization or departmental pages match your selected tab or search criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="pm-data-table">
                <thead>
                  <tr>
                    <th>Page Profile</th>
                    <th>Category</th>
                    <th>Affiliation</th>
                    <th>Assigned Staff</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagesList.map(page => (
                    <tr key={page.id}>
                      <td>
                        <div className="page-profile-cell">
                          <div className="page-avatar">
                            {page.logo_url ? (
                              <img src={page.logo_url} alt={page.name} />
                            ) : (
                              <i className="fa-solid fa-building-columns"></i>
                            )}
                          </div>
                          <div className="page-title-group">
                            <span className="page-name-text">{page.name}</span>
                            <span className="page-creator-text">By: {page.creator_name || 'System Admin'}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="category-tag">{page.category || 'General'}</span></td>
                      <td>
                        <div className="affiliation-cell">
                          <span>{page.college || page.department || 'WMSU Main Campus'}</span>
                        </div>
                      </td>
                      <td>
                        <button 
                          type="button" 
                          className="staff-count-btn"
                          onClick={() => handleOpenStaffModal(page)}
                        >
                          <i className="fa-solid fa-users margin-right-4"></i>
                          <span>{page.staff_count || 0} Staff</span>
                        </button>
                      </td>
                      <td>
                        <span className={`status-pill status-${page.status}`}>
                          {page.status}
                        </span>
                      </td>
                      <td className="text-slate-500">{new Date(page.created_at).toLocaleDateString()}</td>
                      <td className="text-right">
                        <div className="table-action-group">
                          
                          {/* Pending Requests: Review Action */}
                          {page.status === 'pending' && (
                            <button 
                              type="button" 
                              className="btn-table-action primary"
                              onClick={() => {
                                setSelectedPage(page);
                                setActiveModal('review');
                              }}
                            >
                              Review Request
                            </button>
                          )}

                          {/* Staff Access Management */}
                          {page.status === 'approved' || page.status === 'active' ? (
                            <button 
                              type="button" 
                              className="btn-table-action secondary"
                              onClick={() => handleOpenStaffModal(page)}
                              title="Manage Assigned Staff"
                            >
                              <i className="fa-solid fa-user-gear"></i>
                            </button>
                          ) : null}

                          {/* Suspend / Reactivate Controls */}
                          {page.status === 'active' || page.status === 'approved' ? (
                            <button 
                              type="button" 
                              className="btn-table-action danger"
                              title="Suspend Page"
                              onClick={() => {
                                setSelectedPage(page);
                                setPendingActionType('suspend');
                                setActiveModal('status_change');
                              }}
                            >
                              <i className="fa-solid fa-ban"></i>
                            </button>
                          ) : page.status === 'suspended' ? (
                            <button 
                              type="button" 
                              className="btn-table-action success"
                              title="Reactivate Page"
                              onClick={() => {
                                setSelectedPage(page);
                                setPendingActionType('reactivate');
                                setActiveModal('status_change');
                              }}
                            >
                              <i className="fa-solid fa-circle-check"></i>
                            </button>
                          ) : null}

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
        {!loading && pagesList.length > 0 && (
          <div className="pm-pagination-bar">
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

        {/* 1. PAGE REQUEST REVIEW MODAL */}
        {activeModal === 'review' && selectedPage && (
          <div className="pm-modal-backdrop">
            <div className="pm-modal-card large-modal">
              <div className="modal-header">
                <h2>Review Page Approval Request</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body split-view">
                <div className="details-col">
                  <h3 className="sub-heading">Submitted Page Details</h3>
                  <div className="info-grid">
                    <div><strong>Requested Page Name:</strong> {selectedPage.name}</div>
                    <div><strong>Category:</strong> {selectedPage.category}</div>
                    <div><strong>College / Unit:</strong> {selectedPage.college || 'N/A'}</div>
                    <div><strong>Department:</strong> {selectedPage.department || 'N/A'}</div>
                    <div><strong>Submitted By:</strong> {selectedPage.creator_name || 'Staff User'} ({selectedPage.creator_email || 'N/A'})</div>
                    <div><strong>Submission Date:</strong> {new Date(selectedPage.created_at).toLocaleString()}</div>
                  </div>

                  <div className="margin-top-12">
                    <strong>Page Purpose & Description:</strong>
                    <p className="description-box">{selectedPage.description || 'No detailed description provided.'}</p>
                  </div>

                  <div className="form-group margin-top-16">
                    <label htmlFor="review-reason">Review Comment / Rejection Reason (Required if declining)</label>
                    <textarea 
                      id="review-reason"
                      rows="3"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Specify reasons if declining this request..."
                      className="pm-textarea"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="modal-footer flex-between">
                <button type="button" className="btn-pm-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <div className="action-button-group">
                  <button 
                    type="button" 
                    className="btn-pm-rose" 
                    disabled={submitting}
                    onClick={() => {
                      setPendingActionType('reject');
                      handleExecuteStatusChange();
                    }}
                  >
                    Reject Request
                  </button>
                  <button 
                    type="button" 
                    className="btn-pm-emerald" 
                    disabled={submitting}
                    onClick={() => {
                      setPendingActionType('approve');
                      handleExecuteStatusChange();
                    }}
                  >
                    Approve Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. CREATE PAGE MODAL */}
        {activeModal === 'create' && (
          <div className="pm-modal-backdrop">
            <div className="pm-modal-card">
              <div className="modal-header">
                <h2>Create Official Campus Page</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleCreatePageSubmit} className="modal-body">
                <div className="form-group">
                  <label htmlFor="page-name">Page Name *</label>
                  <input 
                    id="page-name"
                    type="text"
                    required
                    value={pageFormData.name}
                    onChange={(e) => setPageFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. WMSU Computer Science Society"
                    className="pm-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="page-category">Category *</label>
                  <select 
                    id="page-category"
                    className="pm-select"
                    value={pageFormData.category}
                    onChange={(e) => setPageFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Organization">Student Organization</option>
                    <option value="Department">Academic Department</option>
                    <option value="College">College Unit</option>
                    <option value="Office">University Office</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="page-college">College / University Unit</label>
                  <input 
                    id="page-college"
                    type="text"
                    value={pageFormData.college}
                    onChange={(e) => setPageFormData(prev => ({ ...prev, college: e.target.value }))}
                    placeholder="e.g. College of Science and Mathematics"
                    className="pm-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="page-description">Description</label>
                  <textarea 
                    id="page-description"
                    rows="3"
                    value={pageFormData.description}
                    onChange={(e) => setPageFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief outline of the page's charter and responsibilities..."
                    className="pm-textarea"
                  ></textarea>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-pm-secondary" onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-pm-primary" disabled={submitting}>
                    {submitting ? 'Establishing...' : 'Create & Approve Page'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. MANAGED PAGE STAFF ASSIGNMENTS MODAL */}
        {activeModal === 'staff' && selectedPage && (
          <div className="pm-modal-backdrop">
            <div className="pm-modal-card large-modal">
              <div className="modal-header">
                <h2>Assigned Staff — {selectedPage.name}</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                {/* Form to Assign New Staff */}
                <form onSubmit={handleAssignStaffSubmit} className="assign-staff-bar">
                  <div className="flex-1">
                    <label htmlFor="staff-user">Grant Staff Access to User</label>
                    <select 
                      id="staff-user"
                      required
                      className="pm-select"
                      value={staffFormData.userId}
                      onChange={(e) => setStaffFormData(prev => ({ ...prev, userId: e.target.value }))}
                    >
                      <option value="">-- Choose User --</option>
                      {eligibleStaffUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="role-scope">Scope</label>
                    <select 
                      id="role-scope"
                      className="pm-select"
                      value={staffFormData.roleScope}
                      onChange={(e) => setStaffFormData(prev => ({ ...prev, roleScope: e.target.value }))}
                    >
                      <option value="page_editor">Page Editor</option>
                      <option value="page_manager">Page Manager</option>
                    </select>
                  </div>

                  <button type="submit" className="btn-pm-primary margin-top-auto" disabled={submitting}>
                    Assign Access
                  </button>
                </form>

                {/* Assigned Staff List */}
                <div className="margin-top-16">
                  <h4 className="sub-heading">Currently Assigned Staff</h4>
                  {pageStaffMembers.length === 0 ? (
                    <p className="text-slate-500 font-small">No staff members are currently assigned to manage this page.</p>
                  ) : (
                    <table className="pm-data-table">
                      <thead>
                        <tr>
                          <th>Staff Name</th>
                          <th>Email</th>
                          <th>Scope</th>
                          <th>Assigned Date</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageStaffMembers.map(st => (
                          <tr key={st.id}>
                            <td className="font-semibold">{st.first_name} {st.last_name}</td>
                            <td className="text-slate-600">{st.email}</td>
                            <td><span className="scope-badge">{st.role_scope}</span></td>
                            <td className="text-slate-500">{new Date(st.created_at).toLocaleDateString()}</td>
                            <td className="text-right">
                              <button 
                                type="button" 
                                className="btn-table-action danger"
                                onClick={() => handleRevokePageStaff(st.id)}
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-pm-secondary" onClick={() => setActiveModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. LIFECYCLE CONFIRMATION MODAL (Suspend / Reactivate) */}
        {activeModal === 'status_change' && selectedPage && (
          <div className="pm-modal-backdrop">
            <div className="pm-modal-card small-modal">
              <div className="modal-header">
                <h2>Confirm Page {pendingActionType}</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Are you sure you want to <strong>{pendingActionType}</strong> the page <strong>"{selectedPage.name}"</strong>?
                </p>

                {pendingActionType === 'suspend' && (
                  <div className="form-group margin-top-12">
                    <label htmlFor="suspend-reason">Reason for Suspension *</label>
                    <textarea 
                      id="suspend-reason"
                      rows="3"
                      required
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="State reason for restricting this page's operation..."
                      className="pm-textarea"
                    ></textarea>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-pm-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className={`btn-pm-primary ${pendingActionType === 'suspend' ? 'danger-btn' : ''}`}
                  disabled={submitting}
                  onClick={handleExecuteStatusChange}
                >
                  {submitting ? 'Processing...' : `Confirm ${pendingActionType}`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default PageManagement;