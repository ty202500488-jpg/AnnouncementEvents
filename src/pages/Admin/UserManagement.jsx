import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/UserManagement.css';

const UserManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab State ('all', 'verification', 'staff')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');

  // Shared Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Data States
  const [users, setUsers] = useState([]);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [eligibleUsersList, setEligibleUsersList] = useState([]);
  const [availablePagesList, setAvailablePagesList] = useState([]);

  // Async States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal & Drawer States
  const [activeModal, setActiveModal] = useState(null); // 'user_details', 'verify_review', 'grant_staff', 'revoke_staff', 'edit_user'
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStaffItem, setSelectedStaffItem] = useState(null);

  // Form States
  const [reviewReason, setReviewReason] = useState('');
  const [grantFormData, setGrantFormData] = useState({ userId: '', pageId: '', roleScope: 'page_editor' });
  const [editFormData, setEditFormData] = useState({ firstName: '', lastName: '', studentId: '', college: '', program: '' });

  // Update tab in URL query when switched
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({ tab: tabName });
  };

  // Fetch Backend Data according to Active Tab
  const fetchTabData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    const queryParams = new URLSearchParams({
      tab: activeTab,
      search: searchQuery,
      role: roleFilter,
      status: statusFilter,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`http://localhost:5000/api/admin/users?${queryParams.toString()}`, {
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
        if (activeTab === 'all') {
          setUsers(data.users || []);
        } else if (activeTab === 'verification') {
          setVerificationQueue(data.verifications || []);
        } else if (activeTab === 'staff') {
          setStaffAssignments(data.staff || []);
          setEligibleUsersList(data.eligibleUsers || []);
          setAvailablePagesList(data.availablePages || []);
        }

        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch user management records.');
      }
    } catch (err) {
      console.error('Fetch User Management Error:', err);
      setError(err.message || 'Unable to connect to administrative user service.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, roleFilter, statusFilter, sortOrder, pagination.page, pagination.limit, navigate]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // Execute Student Verification Decision (Approve / Reject / Correction)
  const handleVerificationDecision = async (decisionType) => {
    if (!selectedUser) return;
    if ((decisionType === 'reject' || decisionType === 'correction') && !reviewReason.trim()) {
      setFeedback({ type: 'error', message: 'A reason or instruction is required for rejection/correction.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/users/${selectedUser.id}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          decision: decisionType,
          reason: reviewReason
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || `Verification ${decisionType} updated.` });
        setActiveModal(null);
        setSelectedUser(null);
        setReviewReason('');
        fetchTabData();
      } else {
        throw new Error(data.message || 'Verification update failed.');
      }
    } catch (err) {
      console.error('Verification Decision Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Grant Staff Access Submit
  const handleGrantStaffAccess = async (e) => {
    e.preventDefault();
    if (!grantFormData.userId || !grantFormData.pageId) {
      setFeedback({ type: 'error', message: 'Please select both a user and an organization page.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/admin/staff-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(grantFormData)
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Staff access successfully granted.' });
        setActiveModal(null);
        setGrantFormData({ userId: '', pageId: '', roleScope: 'page_editor' });
        fetchTabData();
      } else {
        throw new Error(data.message || 'Failed to grant staff access.');
      }
    } catch (err) {
      console.error('Grant Staff Access Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke Staff Access
  const handleRevokeStaffAccess = async () => {
    if (!selectedStaffItem) return;
    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/staff-access/${selectedStaffItem.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Staff access revoked.' });
        setActiveModal(null);
        setSelectedStaffItem(null);
        fetchTabData();
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
      <div className="user-management-container">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="um-header">
          <div>
            <h1 className="um-title">User Management</h1>
            <p className="um-subtitle">
              Manage student accounts, review verification submissions, and control authorized Staff access.
            </p>
          </div>

          <div className="um-header-actions">
            <button 
              type="button" 
              className="btn-um-secondary"
              onClick={fetchTabData}
              disabled={loading}
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'spin-icon' : ''}`}></i>
              <span>Refresh</span>
            </button>

            {activeTab === 'staff' && (
              <button 
                type="button" 
                className="btn-um-primary"
                onClick={() => setActiveModal('grant_staff')}
              >
                <i className="fa-solid fa-user-shield"></i>
                <span>Grant Staff Access</span>
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {feedback && (
          <div className={`um-alert-banner ${feedback.type}`}>
            <div className="alert-content">
              <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{feedback.message}</span>
            </div>
            <button type="button" className="close-alert-btn" onClick={() => setFeedback(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ================= NAVIGATION TABS & CONTROLS ================= */}
        <div className="um-controls-card">
          
          {/* Main Navigation Tabs */}
          <div className="um-tabs-list">
            {[
              { id: 'all', label: 'All Users', icon: 'fa-users' },
              { id: 'verification', label: 'Student Verification', icon: 'fa-user-check' },
              { id: 'staff', label: 'Staff Access', icon: 'fa-user-gear' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`um-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <i className={`fa-solid ${tab.icon} tab-icon`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search and Toolbar */}
          <div className="um-toolbar">
            <div className="um-search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder={`Search ${activeTab === 'staff' ? 'staff member or organization...' : 'name, WMSU email, or ID...'}`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="um-search-input"
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Verification Status Filter */}
            {activeTab === 'verification' && (
              <div className="um-filter-item">
                <select 
                  className="um-select" 
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="all">All Submissions</option>
                  <option value="pending">Pending Review</option>
                  <option value="verified">Verified</option>
                  <option value="correction">Correction Required</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            {/* Role Filter for All Users */}
            {activeTab === 'all' && (
              <div className="um-filter-item">
                <select 
                  className="um-select" 
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            )}

            {/* Reset Action */}
            {(searchQuery || roleFilter !== 'all' || (statusFilter !== 'all' && statusFilter !== 'pending')) && (
              <button 
                type="button" 
                className="btn-um-link"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </button>
            )}

          </div>
        </div>

        {/* ================= TAB 1: ALL USERS TABLE ================= */}
        {activeTab === 'all' && (
          <div className="um-table-card">
            {loading ? (
              <div className="table-skeleton-container">
                <div className="skeleton-row"></div>
                <div className="skeleton-row"></div>
                <div className="skeleton-row"></div>
              </div>
            ) : error ? (
              <div className="um-empty-state">
                <i className="fa-solid fa-triangle-exclamation empty-icon text-rose"></i>
                <h3>Failed to load user list</h3>
                <p>{error}</p>
                <button type="button" className="btn-um-primary" onClick={fetchTabData}>Retry</button>
              </div>
            ) : users.length === 0 ? (
              <div className="um-empty-state">
                <i className="fa-solid fa-users-slash empty-icon"></i>
                <h3>No Users Found</h3>
                <p>No registered accounts matched your active filters.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="um-data-table">
                  <thead>
                    <tr>
                      <th>User Details</th>
                      <th>Student ID</th>
                      <th>Role</th>
                      <th>Program / College</th>
                      <th>Verification</th>
                      <th>Registered Date</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-name-cell">
                            <span className="user-full-name">{u.first_name} {u.last_name}</span>
                            <span className="user-email">{u.email}</span>
                          </div>
                        </td>
                        <td><span className="font-mono">{u.student_id || 'N/A'}</span></td>
                        <td>
                          <span className={`role-badge role-${u.role}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <div className="academic-cell">
                            <span>{u.program || u.course || 'N/A'}</span>
                            <span className="college-sub">{u.college || u.department || 'WMSU'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill status-${u.verification_status || (u.is_verified ? 'verified' : 'pending')}`}>
                            {u.verification_status || (u.is_verified ? 'Verified' : 'Pending')}
                          </span>
                        </td>
                        <td className="text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="text-right">
                          <button 
                            type="button" 
                            className="btn-table-action"
                            onClick={() => {
                              setSelectedUser(u);
                              setActiveModal('user_details');
                            }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: STUDENT VERIFICATION ================= */}
        {activeTab === 'verification' && (
          <div className="um-table-card">
            {loading ? (
              <div className="table-skeleton-container">
                <div className="skeleton-row"></div>
                <div className="skeleton-row"></div>
              </div>
            ) : verificationQueue.length === 0 ? (
              <div className="um-empty-state">
                <i className="fa-solid fa-circle-check empty-icon text-emerald"></i>
                <h3>Queue Empty</h3>
                <p>No student submissions are currently awaiting verification review.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="um-data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>WMSU Email</th>
                      <th>Student ID</th>
                      <th>College & Program</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationQueue.map(item => (
                      <tr key={item.id}>
                        <td className="font-semibold text-slate-800">{item.first_name} {item.last_name}</td>
                        <td className="text-slate-600">{item.email}</td>
                        <td><span className="font-mono">{item.student_id || 'N/A'}</span></td>
                        <td>{item.program || item.college || 'WMSU Student'}</td>
                        <td className="text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-pill status-${item.verification_status || 'pending'}`}>
                            {item.verification_status || 'Pending'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button 
                            type="button" 
                            className="btn-table-action primary"
                            onClick={() => {
                              setSelectedUser(item);
                              setActiveModal('verify_review');
                            }}
                          >
                            Review Submissions
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: STAFF ACCESS ================= */}
        {activeTab === 'staff' && (
          <div className="um-table-card">
            {loading ? (
              <div className="table-skeleton-container">
                <div className="skeleton-row"></div>
              </div>
            ) : staffAssignments.length === 0 ? (
              <div className="um-empty-state">
                <i className="fa-solid fa-user-gear empty-icon"></i>
                <h3>No Staff Assignments</h3>
                <p>No active Staff access permissions have been assigned yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="um-data-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>WMSU Email</th>
                      <th>Assigned Organization / Page</th>
                      <th>Permission Scope</th>
                      <th>Granted Date</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAssignments.map(s => (
                      <tr key={s.id}>
                        <td className="font-semibold text-slate-800">{s.first_name} {s.last_name}</td>
                        <td className="text-slate-600">{s.email}</td>
                        <td>
                          <span className="page-assigned-pill">
                            <i className="fa-solid fa-layer-group margin-right-4"></i>
                            {s.page_name || 'Organization Page'}
                          </span>
                        </td>
                        <td><span className="scope-badge">{s.role_scope || 'Page Staff'}</span></td>
                        <td className="text-slate-500">{new Date(s.granted_at || s.created_at).toLocaleDateString()}</td>
                        <td className="text-right">
                          <button 
                            type="button" 
                            className="btn-table-action danger"
                            onClick={() => {
                              setSelectedStaffItem(s);
                              setActiveModal('revoke_staff');
                            }}
                          >
                            Revoke Access
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= PAGINATION BAR ================= */}
        {!loading && (users.length > 0 || verificationQueue.length > 0 || staffAssignments.length > 0) && (
          <div className="um-pagination-bar">
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
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

        {/* 1. STUDENT VERIFICATION REVIEW PANEL */}
        {activeModal === 'verify_review' && selectedUser && (
          <div className="um-modal-backdrop">
            <div className="um-modal-card large-modal">
              <div className="modal-header">
                <h2>Student Verification Review</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body split-view">
                {/* Left: Academic & Personal Details */}
                <div className="details-col">
                  <h3 className="sub-heading">Student Information</h3>
                  <div className="info-grid">
                    <div><strong>Full Name:</strong> {selectedUser.first_name} {selectedUser.last_name}</div>
                    <div><strong>Student ID:</strong> {selectedUser.student_id || 'N/A'}</div>
                    <div><strong>WMSU Email:</strong> {selectedUser.email}</div>
                    <div><strong>College:</strong> {selectedUser.college || 'N/A'}</div>
                    <div><strong>Program:</strong> {selectedUser.program || selectedUser.course || 'N/A'}</div>
                    <div><strong>Submission Date:</strong> {new Date(selectedUser.created_at).toLocaleString()}</div>
                  </div>

                  {/* Decision Reason Field */}
                  <div className="form-group margin-top-16">
                    <label htmlFor="review-reason">Review Comments / Reason (For Rejection or Correction) *</label>
                    <textarea 
                      id="review-reason"
                      rows="3"
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      placeholder="Specify clear instructions if requesting corrections or state rejection details..."
                      className="um-textarea"
                    ></textarea>
                  </div>
                </div>

                {/* Right: Authenticated Document Preview Box */}
                <div className="documents-col">
                  <h3 className="sub-heading">Uploaded Verification Documents</h3>
                  
                  <div className="doc-preview-box">
                    <div className="doc-header">
                      <i className="fa-solid fa-file-pdf icon-pdf"></i>
                      <span>Certificate of Registration (COR)</span>
                    </div>
                    {selectedUser.cor_url ? (
                      <a 
                        href={`http://localhost:5000/api/admin/documents/view?path=${encodeURIComponent(selectedUser.cor_url)}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn-doc-view"
                      >
                        Secure View COR
                      </a>
                    ) : (
                      <span className="no-doc-text">No COR file uploaded</span>
                    )}
                  </div>

                  <div className="doc-preview-box">
                    <div className="doc-header">
                      <i className="fa-solid fa-id-card icon-id"></i>
                      <span>WMSU Student ID Card</span>
                    </div>
                    {selectedUser.student_id_url ? (
                      <a 
                        href={`http://localhost:5000/api/admin/documents/view?path=${encodeURIComponent(selectedUser.student_id_url)}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn-doc-view"
                      >
                        Secure View Student ID
                      </a>
                    ) : (
                      <span className="no-doc-text">No ID document uploaded</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="modal-footer flex-between">
                <button type="button" className="btn-um-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>

                <div className="action-button-group">
                  <button 
                    type="button" 
                    className="btn-um-amber" 
                    disabled={submitting}
                    onClick={() => handleVerificationDecision('correction')}
                  >
                    Request Corrections
                  </button>
                  <button 
                    type="button" 
                    className="btn-um-rose" 
                    disabled={submitting}
                    onClick={() => handleVerificationDecision('reject')}
                  >
                    Reject Verification
                  </button>
                  <button 
                    type="button" 
                    className="btn-um-emerald" 
                    disabled={submitting}
                    onClick={() => handleVerificationDecision('approve')}
                  >
                    Approve Verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. GRANT STAFF ACCESS MODAL */}
        {activeModal === 'grant_staff' && (
          <div className="um-modal-backdrop">
            <div className="um-modal-card">
              <div className="modal-header">
                <h2>Grant Staff Permissions</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleGrantStaffAccess} className="modal-body">
                
                <div className="form-group">
                  <label htmlFor="select-user">Select Eligible User *</label>
                  <select 
                    id="select-user"
                    className="um-select" 
                    required
                    value={grantFormData.userId}
                    onChange={(e) => setGrantFormData(prev => ({ ...prev, userId: e.target.value }))}
                  >
                    <option value="">-- Choose User --</option>
                    {eligibleUsersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="select-page">Assign Organization / Department Page *</label>
                  <select 
                    id="select-page"
                    className="um-select" 
                    required
                    value={grantFormData.pageId}
                    onChange={(e) => setGrantFormData(prev => ({ ...prev, pageId: e.target.value }))}
                  >
                    <option value="">-- Select Approved Page --</option>
                    {availablePagesList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category || 'Page'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="select-scope">Permission Scope</label>
                  <select 
                    id="select-scope"
                    className="um-select" 
                    value={grantFormData.roleScope}
                    onChange={(e) => setGrantFormData(prev => ({ ...prev, roleScope: e.target.value }))}
                  >
                    <option value="page_editor">Page Editor (Announcements & Events)</option>
                    <option value="page_manager">Page Manager (Full Page Operations)</option>
                  </select>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-um-secondary" onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-um-primary" disabled={submitting}>
                    {submitting ? 'Granting...' : 'Confirm Staff Access'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* 3. REVOKE STAFF ACCESS CONFIRMATION MODAL */}
        {activeModal === 'revoke_staff' && selectedStaffItem && (
          <div className="um-modal-backdrop">
            <div className="um-modal-card small-modal">
              <div className="modal-header">
                <h2>Revoke Staff Access</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Are you sure you want to revoke Staff management permissions for <strong>{selectedStaffItem.first_name} {selectedStaffItem.last_name}</strong> from <strong>{selectedStaffItem.page_name}</strong>?
                </p>
                <span className="warning-note">This action will immediately restrict their staff editing rights without deleting their user account.</span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-um-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-um-rose" disabled={submitting} onClick={handleRevokeStaffAccess}>
                  {submitting ? 'Revoking...' : 'Confirm Revoke'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. USER DETAILS MODAL */}
        {activeModal === 'user_details' && selectedUser && (
          <div className="um-modal-backdrop">
            <div className="um-modal-card">
              <div className="modal-header">
                <h2>User Profile Details</h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                <div className="info-grid">
                  <div><strong>Full Name:</strong> {selectedUser.first_name} {selectedUser.last_name}</div>
                  <div><strong>WMSU Email:</strong> {selectedUser.email}</div>
                  <div><strong>Student ID:</strong> {selectedUser.student_id || 'N/A'}</div>
                  <div><strong>System Role:</strong> <span className="font-semibold uppercase">{selectedUser.role}</span></div>
                  <div><strong>College:</strong> {selectedUser.college || 'N/A'}</div>
                  <div><strong>Program:</strong> {selectedUser.program || selectedUser.course || 'N/A'}</div>
                  <div><strong>Verification Status:</strong> {selectedUser.verification_status || (selectedUser.is_verified ? 'Verified' : 'Pending')}</div>
                  <div><strong>Registered On:</strong> {new Date(selectedUser.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-um-secondary" onClick={() => setActiveModal(null)}>
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

export default UserManagement;