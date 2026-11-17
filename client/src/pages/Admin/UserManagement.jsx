import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import SearchableUserSelect from '../../assets/components/SearchableUserSelect';
import '../styles/UserManagement.css';

const UserManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab State ('all', 'verification', 'staff')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');

  // Shared Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Data States
  const [users, setUsers] = useState([]);
  const [collegesList, setCollegesList] = useState([]);
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
  const [activeModal, setActiveModal] = useState(null); // 'user_details', 'verify_review', 'grant_staff', 'revoke_staff', 'account_status'
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStaffItem, setSelectedStaffItem] = useState(null);
  const [pendingAccountAction, setPendingAccountAction] = useState(''); // 'activate', 'suspend', 'archive'

  // Form States
  const [reviewReason, setReviewReason] = useState('');
  const [grantFormData, setGrantFormData] = useState({ userId: '', pageId: '', roleScope: 'page_editor' });
  const [editFormData, setEditFormData] = useState({ firstName: '', lastName: '', studentId: '', college: '', program: '' });

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      search: debouncedSearch,
      role: roleFilter,
      college: collegeFilter,
      status: statusFilter,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`/api/admin/users?${queryParams.toString()}`, {
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
        if (data.colleges) {
          setCollegesList(data.colleges);
        }
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
  }, [activeTab, debouncedSearch, roleFilter, collegeFilter, statusFilter, sortOrder, pagination.page, pagination.limit, navigate]);

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
      const response = await fetch(`/api/admin/users/${selectedUser.id}/verify`, {
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

  // Fetch binary image from PostgreSQL via authenticated admin endpoint and open in new tab
  const handleOpenFullDocument = async (userId, docType) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(
        `/api/admin/documents/view?userId=${encodeURIComponent(userId)}&type=${encodeURIComponent(docType)}`,
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        }
      );
      if (!response.ok) {
        throw new Error('Could not load document image from database.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      console.error('Open Document Error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to open document.' });
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
      const response = await fetch('/api/admin/staff-access', {
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
      const response = await fetch(`/api/admin/staff-access/${selectedStaffItem.id}`, {
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

  // Activate / Suspend / Archive User Account
  const handleExecuteAccountStatusChange = async (reasonText) => {
    if (!selectedUser || !pendingAccountAction) return;
    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          action: pendingAccountAction,
          reason: reasonText
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'User account status updated.' });
        setActiveModal(null);
        setSelectedUser(null);
        setPendingAccountAction('');
        fetchTabData();
      } else {
        throw new Error(data.message || 'Failed to update user account status.');
      }
    } catch (err) {
      console.error('Account Status Update Error:', err);
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
          <div className="um-header-title-block">
            <div className="um-breadcrumb">
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <span>Home</span>
              <span aria-hidden="true">/</span>
              <span className="is-current">User Management</span>
            </div>
            <h1 className="um-title">User Management</h1>
          </div>

          <div className="um-header-actions">
            <button
              type="button"
              className={`um-nav-pill-btn ${activeTab === 'all' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              <i className="fa-solid fa-users" aria-hidden="true"></i>
              <span>All Users</span>
            </button>

            <button
              type="button"
              className={`um-nav-pill-btn ${activeTab === 'staff' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('staff')}
            >
              <i className="fa-solid fa-user-shield" aria-hidden="true"></i>
              <span>Staff Access</span>
            </button>

            <button
              type="button"
              className={`um-nav-pill-btn ${activeTab === 'verification' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('verification')}
            >
              <i className="fa-solid fa-user-check" aria-hidden="true"></i>
              <span>Verification Requests</span>
            </button>

            {activeTab === 'staff' && (
              <button
                type="button"
                className="btn-um-primary"
                onClick={() => setActiveModal('grant_staff')}
              >
                <i className="fa-solid fa-plus" aria-hidden="true"></i>
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

        {/* ================= SINGLE-ROW LABELED FILTER BAR ================= */}
        <div className="um-controls-card">
          <div className="um-toolbar um-ref-toolbar">
            <div className="um-ref-field um-ref-search">
              <label htmlFor="um-search-input" className="um-ref-label">Search Users</label>
              <div className="um-search-box">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  id="um-search-input"
                  type="text"
                  placeholder={`Search ${activeTab === 'staff' ? 'staff member or organization...' : 'ID, name, WMSU email...'}`}
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
            </div>

            {activeTab === 'verification' && (
              <div className="um-ref-field">
                <label htmlFor="um-ver-status" className="um-ref-label">Status</label>
                <select
                  id="um-ver-status"
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

            {activeTab === 'all' && (
              <>
                <div className="um-ref-field">
                  <label htmlFor="um-role-filter" className="um-ref-label">Role</label>
                  <select
                    id="um-role-filter"
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

                <div className="um-ref-field">
                  <label htmlFor="um-status-filter" className="um-ref-label">Status</label>
                  <select
                    id="um-status-filter"
                    className="um-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </>
            )}

            {(activeTab === 'all' || activeTab === 'verification') && (
              <div className="um-ref-field">
                <label htmlFor="um-college-filter" className="um-ref-label">College</label>
                <select
                  id="um-college-filter"
                  className="um-select"
                  value={collegeFilter}
                  onChange={(e) => {
                    setCollegeFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="all">All Colleges</option>
                  {collegesList.map((col, idx) => {
                    const colName = typeof col === 'string' ? col : col.name;
                    const colCode = typeof col === 'string' ? '' : col.code;
                    return (
                      <option key={col.id || idx} value={colName}>
                        {colCode ? `${colCode} — ${colName}` : colName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="um-ref-reset-wrap">
              <button
                type="button"
                className="btn-um-secondary um-reset-btn"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setCollegeFilter('all');
                  setStatusFilter(activeTab === 'verification' ? 'pending' : 'all');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================= TAB 1: ALL USERS TABLE ================= */}
        {activeTab === 'all' && (
          <div className="um-table-card">
            <div className="um-table-card-head">
              <div className="um-table-card-title">
                <i className="fa-solid fa-users" aria-hidden="true"></i>
                <span>Portal User Accounts</span>
              </div>
              <span className="um-matching-badge">{pagination.total} Matching</span>
            </div>

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
                      <th>User ID</th>
                      <th>User Information</th>
                      <th>Email Address</th>
                      <th>Program / College</th>
                      <th>Role</th>
                      <th>Account Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const acctStatus = String(u.status || 'Active');
                      const isSuspended = acctStatus.toLowerCase() === 'suspended';
                      return (
                      <tr key={u.id}>
                        <td><span className="um-id-tag">#{u.id}</span></td>
                        <td>
                          <div className="user-name-cell">
                            <span className="user-full-name">{u.first_name} {u.last_name}</span>
                            <span className="user-email font-mono">{u.student_id || `@${u.role}`}</span>
                          </div>
                        </td>
                        <td>
                          <span className="um-email-cell">
                            <i className="fa-regular fa-envelope" aria-hidden="true"></i>
                            <span>{u.email}</span>
                          </span>
                        </td>
                        <td>
                          <div className="academic-cell">
                            <span>{u.program || u.course || '—'}</span>
                            <span className="college-sub">{u.college || u.department || 'WMSU'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge role-${u.role}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isSuspended ? 'status-rejected' : 'status-verified'}`}>
                            {acctStatus}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="admin-action-pill-group">
                            <button
                              type="button"
                              className="admin-action-icon is-view"
                              title="View user details"
                              aria-label="View user details"
                              onClick={() => {
                                setSelectedUser(u);
                                setActiveModal('user_details');
                              }}
                            >
                              <i className="fa-solid fa-eye"></i>
                            </button>
                            {u.role !== 'admin' && (
                              isSuspended ? (
                                <button
                                  type="button"
                                  className="admin-action-icon is-approve"
                                  title="Reactivate Account"
                                  aria-label="Reactivate Account"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setPendingAccountAction('activate');
                                    setActiveModal('account_status');
                                  }}
                                >
                                  <i className="fa-solid fa-circle-check"></i>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-action-icon is-danger"
                                  title="Suspend Account"
                                  aria-label="Suspend Account"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setPendingAccountAction('suspend');
                                    setActiveModal('account_status');
                                  }}
                                >
                                  <i className="fa-solid fa-ban"></i>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* ================= INTEGRATED PAGINATION BAR ================= */}
            {!loading && users.length > 0 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalRecords={pagination.total}
                rowsPerPage={pagination.limit}
                onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              />
            )}
          </div>
        )}

        {/* ================= TAB 2: STUDENT VERIFICATION ================= */}
        {activeTab === 'verification' && (
          <div className="um-table-card">
            <div className="um-table-card-head">
              <div className="um-table-card-title">
                <i className="fa-solid fa-user-check" aria-hidden="true"></i>
                <span>Student Verification Queue</span>
              </div>
              <span className="um-matching-badge">{pagination.total} Matching</span>
            </div>
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
                          <div className="admin-action-pill-group">
                            <button 
                              type="button" 
                              className="admin-action-icon is-edit"
                              title="Review Submissions"
                              aria-label="Review Submissions"
                              onClick={() => {
                                setSelectedUser(item);
                                setActiveModal('verify_review');
                              }}
                            >
                              <i className="fa-solid fa-eye"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* ================= INTEGRATED PAGINATION BAR ================= */}
            {!loading && verificationQueue.length > 0 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalRecords={pagination.total}
                rowsPerPage={pagination.limit}
                onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              />
            )}
          </div>
        )}

        {/* ================= TAB 3: STAFF ACCESS ================= */}
        {activeTab === 'staff' && (
          <div className="um-table-card">
            <div className="um-table-card-head">
              <div className="um-table-card-title">
                <i className="fa-solid fa-user-shield" aria-hidden="true"></i>
                <span>Authorized Staff Access</span>
              </div>
              <span className="um-matching-badge">{pagination.total} Matching</span>
            </div>
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
                          <div className="admin-action-pill-group">
                            <button 
                              type="button" 
                              className="admin-action-icon is-danger"
                              title="Revoke Access"
                              aria-label="Revoke Access"
                              onClick={() => {
                                setSelectedStaffItem(s);
                                setActiveModal('revoke_staff');
                              }}
                            >
                              <i className="fa-solid fa-ban"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* ================= INTEGRATED PAGINATION BAR ================= */}
            {!loading && staffAssignments.length > 0 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalRecords={pagination.total}
                rowsPerPage={pagination.limit}
                onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              />
            )}
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
                      <i className="fa-solid fa-camera icon-pdf"></i>
                      <span>Certificate of Registration (COR)</span>
                    </div>
                    {selectedUser.has_cor_image || selectedUser.cor_image_data ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {selectedUser.cor_image_data && (
                          <img
                            src={selectedUser.cor_image_data}
                            alt="Captured COR"
                            style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#0f172a' }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenFullDocument(selectedUser.id, 'cor')}
                          className="btn-doc-view"
                        >
                          Open Full Image (From DB)
                        </button>
                      </div>
                    ) : (
                      <span className="no-doc-text">No COR photo stored in database</span>
                    )}
                  </div>

                  <div className="doc-preview-box">
                    <div className="doc-header">
                      <i className="fa-solid fa-id-card icon-id"></i>
                      <span>WMSU Student ID Card</span>
                    </div>
                    {selectedUser.has_student_id_image || selectedUser.student_id_image_data ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {selectedUser.student_id_image_data && (
                          <img
                            src={selectedUser.student_id_image_data}
                            alt="Captured Student ID"
                            style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#0f172a' }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenFullDocument(selectedUser.id, 'id')}
                          className="btn-doc-view"
                        >
                          Open Full Image (From DB)
                        </button>
                      </div>
                    ) : (
                      <span className="no-doc-text">No Student ID photo stored in database</span>
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
                  <SearchableUserSelect
                    label="Select Eligible User"
                    required
                    disabled={submitting}
                    users={eligibleUsersList}
                    value={grantFormData.userId}
                    excludeUserIds={staffAssignments
                      .filter((sa) => grantFormData.pageId && String(sa.page_id) === String(grantFormData.pageId))
                      .map((sa) => sa.user_id)}
                    onChange={(userId) => setGrantFormData(prev => ({ ...prev, userId }))}
                    placeholder="Search user by name, WMSU email, or Student ID..."
                  />
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
        <ConfirmationModal
          isOpen={activeModal === 'revoke_staff' && Boolean(selectedStaffItem)}
          title="Revoke Staff Access?"
          message={
            selectedStaffItem
              ? `Are you sure you want to revoke Staff management permissions for ${selectedStaffItem.first_name} ${selectedStaffItem.last_name} from "${selectedStaffItem.page_name}"? This immediately restricts their staff editing rights without deleting their user account.`
              : ''
          }
          variant="danger"
          confirmText="Confirm Revoke"
          cancelText="Cancel"
          loading={submitting}
          onCancel={() => setActiveModal(null)}
          onConfirm={handleRevokeStaffAccess}
        />

        {/* 3B. ACCOUNT STATUS CONFIRMATION MODAL */}
        <ConfirmationModal
          isOpen={activeModal === 'account_status' && Boolean(selectedUser)}
          title={pendingAccountAction === 'suspend' ? 'Suspend User Account?' : 'Activate User Account?'}
          message={
            selectedUser
              ? `Are you sure you want to ${pendingAccountAction} the account of ${selectedUser.first_name} ${selectedUser.last_name} (${selectedUser.email})?`
              : ''
          }
          variant={pendingAccountAction === 'suspend' ? 'danger' : 'success'}
          confirmText={pendingAccountAction === 'suspend' ? 'Confirm Suspend' : 'Confirm Activate'}
          cancelText="Cancel"
          requireReason={pendingAccountAction === 'suspend'}
          reasonLabel="Reason for Account Suspension *"
          reasonPlaceholder="Specify reason for suspending this user account..."
          loading={submitting}
          onCancel={() => {
            setActiveModal(null);
            setPendingAccountAction('');
          }}
          onConfirm={(reasonText) => handleExecuteAccountStatusChange(reasonText)}
        />

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