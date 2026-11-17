import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import SearchableUserSelect from '../../assets/components/SearchableUserSelect';
import '../styles/PageManagement.css';

const VALID_PAGE_TABS = ['all', 'pending', 'active', 'suspended', 'archived', 'rejected'];

const PageManagement = () => {
  const navigate = useNavigate();
  const { tab: routeTab } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const resolveTab = useCallback((rawTab) => {
    const normalized = String(rawTab || '').toLowerCase();
    return VALID_PAGE_TABS.includes(normalized) ? normalized : 'all';
  }, []);

  // Tab & Filter States ('all', 'pending', 'active', 'suspended', 'archived', 'rejected')
  const [activeTab, setActiveTab] = useState(() => resolveTab(routeTab || searchParams.get('tab')));
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Operational Data States
  const [pagesList, setPagesList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
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

  // Sync activeTab when route param (/admin/pages/:tab) or query param (?tab=...) changes
  useEffect(() => {
    const incoming = routeTab || searchParams.get('tab');
    const resolved = resolveTab(incoming);
    setActiveTab(resolved);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [routeTab, searchParams, resolveTab]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Synchronize Tab with Search Query Params (always stays on /admin/pages?tab=...)
  const handleTabSelect = (tabId) => {
    const resolved = resolveTab(tabId);
    setActiveTab(resolved);
    setPagination(prev => ({ ...prev, page: 1 }));
    if (routeTab) {
      navigate(`/admin/pages?tab=${resolved}`);
    } else {
      setSearchParams({ tab: resolved });
    }
  };

  // Fetch Page Management Data from API
  const fetchPagesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    const params = new URLSearchParams({
      tab: activeTab,
      search: debouncedSearch,
      category: categoryFilter,
      department: departmentFilter,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`/api/admin/pages?${params.toString()}`, {
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
        if (data.departments) {
          setDepartmentsList(data.departments);
        }
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
  }, [activeTab, debouncedSearch, categoryFilter, departmentFilter, sortOrder, pagination.page, pagination.limit, navigate]);

  useEffect(() => {
    fetchPagesData();
  }, [fetchPagesData]);

  // Fetch Assigned Staff Members for Selected Page
  const fetchPageStaff = async (pageId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/admin/pages/${pageId}/staff`, {
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
  const handleExecuteStatusChange = async (overrideAction, overrideReason) => {
    const actionToRun = overrideAction || pendingActionType;
    const reasonToUse = overrideReason !== undefined ? overrideReason : actionReason;
    if (!selectedPage || !actionToRun) return;
    if ((actionToRun === 'reject' || actionToRun === 'suspend') && !String(reasonToUse || '').trim()) {
      setFeedback({ type: 'error', message: 'A valid explanation or reason is required for this action.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`/api/admin/pages/${selectedPage.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          action: actionToRun,
          reason: reasonToUse
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
      const response = await fetch('/api/admin/pages', {
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
      const response = await fetch(`/api/admin/pages/${selectedPage.id}/staff`, {
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
      const response = await fetch(`/api/admin/pages/staff/${staffId}`, {
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
            <div className="admin-page-breadcrumb">
              <i className="fa-solid fa-house" aria-hidden="true"></i>
              <span>Home</span>
              <span aria-hidden="true">/</span>
              <span className="is-current">Page Management</span>
            </div>
            <h1 className="pm-title">Page Management</h1>
          </div>

          <div className="pm-header-actions">
            <button 
              type="button" 
              className="btn-pm-primary"
              onClick={() => setActiveModal('create')}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i>
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

        {/* ================= CLICKABLE KPI STRIP ================= */}
        <div className="admin-kpi-strip" role="tablist" aria-label="Page status filters">
          {[
            { id: 'all', label: 'Total Pages', value: summaryCounts.total, icon: 'fa-layer-group', tone: 'blue', valTone: '' },
            { id: 'active', label: 'Active Pages', value: summaryCounts.active, icon: 'fa-circle-check', tone: 'emerald', valTone: 'tone-emerald' },
            { id: 'pending', label: 'Pending', value: summaryCounts.pending, icon: 'fa-hourglass-half', tone: 'amber', valTone: 'tone-amber' },
            { id: 'suspended', label: 'Suspended', value: summaryCounts.suspended, icon: 'fa-triangle-exclamation', tone: 'rose', valTone: 'tone-rose' },
            { id: 'archived', label: 'Archived', value: summaryCounts.archived, icon: 'fa-box-archive', tone: 'slate', valTone: 'tone-slate' },
            { id: 'rejected', label: 'Rejected', value: summaryCounts.rejected ?? 0, icon: 'fa-ban', tone: 'slate', valTone: 'tone-slate' }
          ].map(card => (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={activeTab === card.id}
              className={`admin-kpi-tile ${activeTab === card.id ? 'is-active' : ''}`}
              onClick={() => handleTabSelect(card.id)}
            >
              <div className="admin-kpi-meta">
                <span className="admin-kpi-label">{card.label}</span>
                <span className={`admin-kpi-value ${card.valTone}`}>
                  {loading ? '...' : card.value}
                </span>
              </div>
              <span className={`admin-kpi-icon tone-${card.tone}`} aria-hidden="true">
                <i className={`fa-solid ${card.icon}`}></i>
              </span>
            </button>
          ))}
        </div>

        {/* ================= SINGLE-ROW INLINE FILTER BAR ================= */}
        <div className="admin-inline-filter-card">
          <div className="admin-inline-filter-row">
            <div className="admin-inline-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input 
                type="text" 
                placeholder="Search page name, description, category, or college..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="admin-inline-search-input"
                aria-label="Search pages"
              />
              {searchQuery && (
                <button type="button" className="admin-inline-clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <select 
              className="admin-inline-select"
              value={categoryFilter}
              aria-label="Filter by category"
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

            <select 
              className="admin-inline-select"
              value={departmentFilter}
              aria-label="Filter by college or unit"
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <option value="all">All Colleges / Units</option>
              {departmentsList.map((dept, idx) => {
                const deptName = typeof dept === 'string' ? dept : dept.name;
                const deptCode = typeof dept === 'string' ? '' : dept.code;
                return (
                  <option key={dept.id || idx} value={deptName}>
                    {deptCode ? `${deptCode} — ${deptName}` : deptName}
                  </option>
                );
              })}
            </select>

            <select
              className="admin-inline-select"
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              aria-label="Sort pages"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>

            <button 
              type="button" 
              className="admin-inline-reset-btn"
              title="Reset filters"
              aria-label="Reset filters"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setDepartmentFilter('all');
                setSortOrder('newest');
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {/* ================= DATA TABLE DISPLAY ================= */}
        <div className="pm-table-card">
          <div className="admin-table-head">
            <div className="admin-table-title">
              <i className="fa-solid fa-layer-group" aria-hidden="true"></i>
              <span>Organization &amp; Department Pages</span>
            </div>
            <span className="admin-table-matching">{pagination.total} Matching</span>
          </div>

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
                    <th>Page ID</th>
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
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                          #{page.id}
                        </span>
                      </td>
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
                        <span className={`status-pill status-${String(page.status || '').toLowerCase()}`}>
                          {page.status}
                        </span>
                      </td>
                      <td className="text-slate-500">{new Date(page.created_at).toLocaleDateString()}</td>
                      <td className="text-right">
                        <div className="admin-action-pill-group">
                          {(() => {
                            const st = String(page.status || '').toLowerCase();
                            return (
                              <>
                                <button
                                  type="button"
                                  className="admin-action-icon is-view"
                                  title="View Page Details"
                                  aria-label="View Page Details"
                                  onClick={() => {
                                    setSelectedPage(page);
                                    setActiveModal('review');
                                  }}
                                >
                                  <i className="fa-solid fa-eye"></i>
                                </button>

                                {st === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-action-icon is-approve"
                                      title="Approve Page Request"
                                      aria-label="Approve Page Request"
                                      onClick={() => {
                                        setSelectedPage(page);
                                        setPendingActionType('approve');
                                        setActiveModal('status_change');
                                      }}
                                    >
                                      <i className="fa-solid fa-check"></i>
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-action-icon is-danger"
                                      title="Reject Page Request"
                                      aria-label="Reject Page Request"
                                      onClick={() => {
                                        setSelectedPage(page);
                                        setPendingActionType('reject');
                                        setActiveModal('status_change');
                                      }}
                                    >
                                      <i className="fa-solid fa-xmark"></i>
                                    </button>
                                  </>
                                )}

                                {(st === 'approved' || st === 'active') && (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-action-icon is-edit"
                                      onClick={() => handleOpenStaffModal(page)}
                                      title="Manage Assigned Staff"
                                      aria-label="Manage Assigned Staff"
                                    >
                                      <i className="fa-solid fa-user-gear"></i>
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-action-icon is-danger"
                                      title="Suspend Page"
                                      aria-label="Suspend Page"
                                      onClick={() => {
                                        setSelectedPage(page);
                                        setPendingActionType('suspend');
                                        setActiveModal('status_change');
                                      }}
                                    >
                                      <i className="fa-solid fa-ban"></i>
                                    </button>
                                  </>
                                )}

                                {st === 'suspended' && (
                                  <button
                                    type="button"
                                    className="admin-action-icon is-approve"
                                    title="Reactivate Page"
                                    aria-label="Reactivate Page"
                                    onClick={() => {
                                      setSelectedPage(page);
                                      setPendingActionType('reactivate');
                                      setActiveModal('status_change');
                                    }}
                                  >
                                    <i className="fa-solid fa-rotate-left"></i>
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= PAGINATION BAR ================= */}
          {!loading && pagesList.length > 0 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.total}
              pageSize={pagination.limit}
              onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              onPageSizeChange={(limit) => setPagination(prev => ({ ...prev, limit, page: 1 }))}
              loading={loading}
              itemLabel="pages"
            />
          )}
        </div>

        {/* ================= MODALS & DRAWERS ================= */}

        {/* 1. PAGE REQUEST REVIEW MODAL */}
        {activeModal === 'review' && selectedPage && (
          <div className="pm-modal-backdrop">
            <div className="pm-modal-card large-modal">
              <div className="modal-header">
                <h2>
                  {String(selectedPage.status || '').toLowerCase() === 'pending'
                    ? 'Review Page Approval Request'
                    : 'Page Profile Details'}
                </h2>
                <button type="button" className="close-btn" onClick={() => setActiveModal(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body split-view">
                <div className="details-col">
                  <h3 className="sub-heading">Page Information</h3>
                  <div className="info-grid">
                    <div><strong>Page Name:</strong> {selectedPage.name}</div>
                    <div><strong>Category:</strong> {selectedPage.category}</div>
                    <div><strong>Status:</strong> {selectedPage.status}</div>
                    <div><strong>College / Unit:</strong> {selectedPage.college || 'N/A'}</div>
                    <div><strong>Department:</strong> {selectedPage.department || 'N/A'}</div>
                    <div><strong>Submitted By:</strong> {selectedPage.creator_name || 'Staff User'} ({selectedPage.creator_email || 'N/A'})</div>
                    <div><strong>Assigned Staff:</strong> {selectedPage.staff_count || 0}</div>
                    <div><strong>Followers:</strong> {selectedPage.followers_count || 0}</div>
                    <div><strong>Created Date:</strong> {new Date(selectedPage.created_at).toLocaleString()}</div>
                  </div>

                  <div className="margin-top-12">
                    <strong>Page Purpose & Description:</strong>
                    <p className="description-box">{selectedPage.description || 'No detailed description provided.'}</p>
                  </div>

                  {String(selectedPage.status || '').toLowerCase() === 'pending' && (
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
                  )}
                </div>
              </div>

              <div className={`modal-footer ${String(selectedPage.status || '').toLowerCase() === 'pending' ? 'flex-between' : ''}`}>
                <button type="button" className="btn-pm-secondary" onClick={() => setActiveModal(null)}>
                  Close
                </button>
                {String(selectedPage.status || '').toLowerCase() === 'pending' && (
                  <div className="action-button-group">
                    <button 
                      type="button" 
                      className="btn-pm-rose" 
                      disabled={submitting}
                      onClick={() => {
                        setPendingActionType('reject');
                        handleExecuteStatusChange('reject', actionReason);
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
                        handleExecuteStatusChange('approve', actionReason);
                      }}
                    >
                      Approve Page
                    </button>
                  </div>
                )}
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
                    <SearchableUserSelect
                      label="Grant Staff Access to User"
                      required
                      disabled={submitting}
                      users={eligibleStaffUsers}
                      value={staffFormData.userId}
                      excludeUserIds={pageStaffMembers.map((st) => st.user_id)}
                      onChange={(userId) => setStaffFormData(prev => ({ ...prev, userId }))}
                      placeholder="Search user by name, WMSU email, or ID..."
                    />
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

        {/* 4. LIFECYCLE CONFIRMATION MODAL (Suspend / Reactivate / Archive) */}
        <ConfirmationModal
          isOpen={activeModal === 'status_change' && Boolean(selectedPage)}
          title={`Confirm Page ${pendingActionType ? pendingActionType.charAt(0).toUpperCase() + pendingActionType.slice(1) : 'Action'}?`}
          message={
            selectedPage
              ? `Are you sure you want to ${pendingActionType} the official page "${selectedPage.name}"?`
              : ''
          }
          variant={pendingActionType === 'suspend' || pendingActionType === 'reject' ? 'danger' : pendingActionType === 'reactivate' ? 'success' : 'warning'}
          confirmText={`Confirm ${pendingActionType ? pendingActionType.charAt(0).toUpperCase() + pendingActionType.slice(1) : 'Action'}`}
          cancelText="Cancel"
          requireReason={pendingActionType === 'suspend' || pendingActionType === 'reject'}
          reasonLabel="Reason for Action *"
          reasonPlaceholder="State reason for restricting or modifying this page's status..."
          loading={submitting}
          onCancel={() => setActiveModal(null)}
          onConfirm={(reasonText) => handleExecuteStatusChange(pendingActionType, reasonText)}
        />

      </div>
    </AdminLayout>
  );
};

export default PageManagement;