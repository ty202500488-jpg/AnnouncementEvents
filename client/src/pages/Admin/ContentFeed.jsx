import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import '../styles/ContentFeed.css';

const ContentFeed = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation & Filter States (Parts 10 & 11)
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'announcements', 'events', 'scheduled', 'archived', 'takedown'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  // Filter Metadata Options
  const [collegesList, setCollegesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [academicYearsList, setAcademicYearsList] = useState([]);

  // Data States
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // UI Control States
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'create_announcement', 'create_event', 'edit', 'preview', 'archive', 'takedown', 'restore', 'delete'
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Event Engagement (Registrations & Attendance) in Preview Modal
  const [eventEngagement, setEventEngagement] = useState({
    loading: false,
    registrations: [],
    session: null,
    summary: { totalRegistered: 0, totalAttended: 0 }
  });

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General',
    audience: 'All Campus',
    scheduled_at: '',
    expires_at: '',
    event_start: '',
    event_end: '',
    venue: '',
    organizer: '',
    reg_deadline: '',
    capacity: ''
  });

  const createMenuRef = useRef(null);

  // Sync URL ?tab=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['all', 'announcements', 'events', 'scheduled', 'archived', 'takedown'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch filter metadata (colleges, categories, academic years)
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/reports/metadata', {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        if (Array.isArray(data.departments)) setCollegesList(data.departments);
        if (Array.isArray(data.categories)) setCategoriesList(data.categories);
        if (Array.isArray(data.academicYears)) setAcademicYearsList(data.academicYears);
      })
      .catch(() => {});
  }, []);

  // Close Create Dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Content Feed Data from Backend API
  const fetchFeedData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    const params = new URLSearchParams({
      tab: activeTab,
      search: debouncedSearch,
      category: categoryFilter,
      college: collegeFilter,
      status: statusFilter,
      academicYearId: academicYearFilter,
      eventDate: dateFilter,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`/api/admin/content-feed?${params.toString()}`, {
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
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch content feed.');
      }
    } catch (err) {
      console.error('Fetch Content Feed Error:', err);
      setError(err.message || 'Unable to connect to administration server.');
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    debouncedSearch,
    categoryFilter,
    collegeFilter,
    statusFilter,
    academicYearFilter,
    dateFilter,
    sortOrder,
    pagination.page,
    pagination.limit,
    navigate
  ]);

  useEffect(() => {
    fetchFeedData();
  }, [fetchFeedData]);

  // Load Event Registrations & Attendance when previewing an event
  const handleOpenPreview = async (item) => {
    setSelectedItem(item);
    setActiveModal('preview');

    if (item.type === 'event') {
      setEventEngagement({ loading: true, registrations: [], session: null, summary: { totalRegistered: 0, totalAttended: 0 } });
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/admin/content-feed/${item.id}/engagement`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const data = await res.json();
          setEventEngagement({
            loading: false,
            registrations: data.registrations || [],
            session: data.session || null,
            summary: data.summary || { totalRegistered: 0, totalAttended: 0 }
          });
        } else {
          setEventEngagement(prev => ({ ...prev, loading: false }));
        }
      } catch (_) {
        setEventEngagement(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Handle Form Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Open Edit Modal with Prepopulated Data
  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || item.body || '',
      category: item.category || 'General',
      audience: item.audience || 'All Campus',
      scheduled_at: item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '',
      expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '',
      event_start: item.event_start ? new Date(item.event_start).toISOString().slice(0, 16) : '',
      event_end: item.event_end ? new Date(item.event_end).toISOString().slice(0, 16) : '',
      venue: item.venue || '',
      organizer: item.organizer || '',
      reg_deadline: item.reg_deadline ? new Date(item.reg_deadline).toISOString().slice(0, 16) : '',
      capacity: item.capacity || ''
    });
    setActiveModal('edit');
  };

  // Reset Form Modal State
  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setFormData({
      title: '',
      description: '',
      category: 'General',
      audience: 'All Campus',
      scheduled_at: '',
      expires_at: '',
      event_start: '',
      event_end: '',
      venue: '',
      organizer: '',
      reg_deadline: '',
      capacity: ''
    });
  };

  // Handle Submission for Create / Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const token = localStorage.getItem('token');

    let endpoint = '/api/admin/content-feed';
    let method = 'POST';
    const payload = { ...formData };

    if (activeModal === 'create_announcement') {
      payload.type = 'announcement';
    } else if (activeModal === 'create_event') {
      payload.type = 'event';
    } else if (activeModal === 'edit' && selectedItem) {
      endpoint = `/api/admin/content-feed/${selectedItem.id}?type=${selectedItem.type}`;
      method = 'PUT';
    }

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || 'Action executed successfully.' });
        handleCloseModal();
        fetchFeedData();
      } else {
        throw new Error(data.message || 'Operation failed.');
      }
    } catch (err) {
      console.error('Submit Form Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Workflow Operations (Archive, Takedown, Restore, Delete)
  const handleExecuteWorkflow = async (reasonText) => {
    if (!selectedItem) return;

    setSubmitting(true);
    const token = localStorage.getItem('token');
    const actionType = activeModal; // 'archive', 'takedown', 'restore', 'delete'

    try {
      let response;
      if (actionType === 'delete') {
        response = await fetch(`/api/admin/content-feed/${selectedItem.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ reason: reasonText })
        });
      } else {
        response = await fetch(`/api/admin/content-feed/${selectedItem.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            type: selectedItem.type,
            action: actionType,
            reason: reasonText
          })
        });
      }

      const data = await response.json();

      if (response.ok) {
        setFeedback({ type: 'success', message: data.message || `Content successfully updated.` });
        handleCloseModal();
        fetchFeedData();
      } else {
        throw new Error(data.message || 'Failed to execute status update.');
      }
    } catch (err) {
      console.error('Workflow Action Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const hasActiveFilters =
    searchQuery ||
    categoryFilter !== 'all' ||
    collegeFilter !== 'all' ||
    statusFilter !== 'all' ||
    academicYearFilter !== 'all' ||
    dateFilter !== '' ||
    sortOrder !== 'newest';

  return (
    <AdminLayout>
      <div className="content-feed-container">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="feed-header">
          <div>
            <h1 className="feed-title">Announcements & Events</h1>
            <p className="feed-subtitle">
              View, filter, publish, moderate, and manage all campus announcements, events, registrations, and attendance.
            </p>
          </div>

          <div className="feed-header-actions">
            <button 
              type="button" 
              className="btn-feed-secondary" 
              onClick={fetchFeedData}
              disabled={loading}
              title="Refresh Content Feed"
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'spin-icon' : ''}`}></i>
              <span>Refresh</span>
            </button>

            {/* Create Content Dropdown Button */}
            <div className="create-menu-wrapper" ref={createMenuRef}>
              <button 
                type="button" 
                className="btn-feed-primary"
                onClick={() => setShowCreateMenu(!showCreateMenu)}
              >
                <i className="fa-solid fa-plus"></i>
                <span>Create Content</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7rem' }}></i>
              </button>

              {showCreateMenu && (
                <div className="create-dropdown-menu">
                  <button 
                    type="button" 
                    className="dropdown-menu-item"
                    onClick={() => {
                      setShowCreateMenu(false);
                      setActiveModal('create_announcement');
                    }}
                  >
                    <i className="fa-solid fa-bullhorn icon-maroon"></i>
                    <div>
                      <div className="menu-item-title">Create Announcement</div>
                      <div className="menu-item-sub">Publish general campus updates</div>
                    </div>
                  </button>

                  <button 
                    type="button" 
                    className="dropdown-menu-item"
                    onClick={() => {
                      setShowCreateMenu(false);
                      setActiveModal('create_event');
                    }}
                  >
                    <i className="fa-regular fa-calendar-days icon-maroon"></i>
                    <div>
                      <div className="menu-item-title">Create Event</div>
                      <div className="menu-item-sub">Schedule activities & check-ins</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FEEDBACK ALERT BANNERS */}
        {feedback && (
          <div className={`feed-alert-banner ${feedback.type}`}>
            <div className="alert-content">
              <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{feedback.message}</span>
            </div>
            <button type="button" className="close-alert-btn" onClick={() => setFeedback(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ================= NAVIGATION TABS & FILTERS ================= */}
        <div className="feed-controls-card">
          
          {/* Tabs */}
          <div className="feed-tabs-list">
            {[
              { id: 'all', label: 'All Content' },
              { id: 'announcements', label: 'Announcements' },
              { id: 'events', label: 'Events' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'archived', label: 'Archived' },
              { id: 'takedown', label: 'Taken Down' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`feed-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter & Search Toolbar */}
          <div className="feed-toolbar" style={{ flexWrap: 'wrap' }}>
            
            {/* Search Field */}
            <div className="feed-search-box" style={{ minWidth: '220px' }}>
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder="Search title, organizer, or page..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="feed-search-input"
              />
              {searchQuery && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* School Year Filter */}
            <div className="feed-filter-item">
              <select
                className="feed-select"
                value={academicYearFilter}
                onChange={(e) => {
                  setAcademicYearFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                aria-label="Filter by School Year"
              >
                <option value="all">All School Years</option>
                {academicYearsList.map(ay => (
                  <option key={ay.id} value={ay.id}>
                    SY {ay.label}{ay.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="feed-filter-item">
              <select 
                id="category-select"
                className="feed-select" 
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="all">All Categories</option>
                {categoriesList.length > 0 ? (
                  categoriesList.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))
                ) : (
                  <>
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Campus Life">Campus Life</option>
                    <option value="Sports">Sports</option>
                    <option value="Scholarship">Scholarship</option>
                  </>
                )}
              </select>
            </div>

            {/* College / Department Filter */}
            <div className="feed-filter-item">
              <select
                className="feed-select"
                value={collegeFilter}
                onChange={(e) => {
                  setCollegeFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                aria-label="Filter by College or Department"
              >
                <option value="all">All Colleges / Offices</option>
                {collegesList.map(col => (
                  <option key={col.id} value={col.name}>
                    {col.code ? `${col.code} — ${col.name}` : col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="feed-filter-item">
              <select
                className="feed-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                aria-label="Filter by Status"
              >
                <option value="all">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Archived">Archived</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="feed-filter-item">
              <input
                type="date"
                className="feed-select"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                title="Filter by Event or Publication Date"
              />
            </div>

            {/* Sorting Order */}
            <div className="feed-filter-item">
              <select 
                id="sort-select"
                className="feed-select" 
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button 
                type="button" 
                className="btn-feed-link"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setCollegeFilter('all');
                  setStatusFilter('all');
                  setAcademicYearFilter('all');
                  setDateFilter('');
                  setSortOrder('newest');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                Reset Filters
              </button>
            )}

          </div>

        </div>

        {/* ================= CONTENT LISTING GRID ================= */}
        {loading ? (
          <div className="feed-skeleton-grid">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="skeleton-card">
                <div className="skeleton-line width-40 height-20"></div>
                <div className="skeleton-line width-80 height-24" style={{ margin: '0.5rem 0' }}></div>
                <div className="skeleton-line width-100 height-60"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="feed-empty-state">
            <i className="fa-solid fa-triangle-exclamation empty-icon text-rose"></i>
            <h3 className="empty-title">Error Loading Content</h3>
            <p className="empty-desc">{error}</p>
            <button type="button" className="btn-feed-primary" onClick={fetchFeedData}>Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="feed-empty-state">
            <i className="fa-solid fa-box-open empty-icon"></i>
            <h3 className="empty-title">No Content Records Found</h3>
            <p className="empty-desc">
              {hasActiveFilters
                ? 'No items match your active search or filter criteria.'
                : 'There are no items currently listed in this category view.'}
            </p>
          </div>
        ) : (
          <div className="feed-cards-grid">
            {items.map(item => {
              const isArchived = item.is_archived || String(item.status).toLowerCase() === 'archived';
              const isTakenDown = String(item.status).toLowerCase() === 'rejected';

              return (
                <div key={`${item.type}-${item.id}`} className="feed-item-card">
                  
                  {/* Card Top Metadata Header */}
                  <div className="card-top-bar">
                    <div className="card-type-group">
                      <span className={`type-badge ${item.type}`}>
                        <i className={`fa-solid ${item.type === 'event' ? 'fa-calendar-days' : 'fa-bullhorn'}`}></i>
                        {item.type}
                      </span>
                      <span className="category-pill">{item.category || 'General'}</span>
                      {item.academic_year_label && (
                        <span className="category-pill" style={{ background: '#fff1f2', color: '#7b0d1e' }}>
                          SY {item.academic_year_label}
                        </span>
                      )}
                    </div>

                    <span className={`workflow-status-badge status-${String(item.status).toLowerCase()}`}>
                      {item.status}
                    </span>
                  </div>

                  {/* Card Title & Content Body */}
                  <h2 className="card-item-title">{item.title}</h2>
                  <p className="card-item-snippet">
                    {item.description || item.body ? (
                      (item.description || item.body).length > 140 
                        ? `${(item.description || item.body).substring(0, 140)}...` 
                        : (item.description || item.body)
                    ) : 'No description provided.'}
                  </p>

                  {/* Event Specific Metadata Bar */}
                  {item.type === 'event' && (
                    <div className="event-meta-box">
                      <div className="meta-row">
                        <i className="fa-regular fa-clock meta-icon"></i>
                        <span>{item.event_start ? new Date(item.event_start).toLocaleString() : 'Date TBD'}</span>
                      </div>
                      {item.venue && (
                        <div className="meta-row">
                          <i className="fa-solid fa-location-dot meta-icon"></i>
                          <span>{item.venue}</span>
                        </div>
                      )}
                      <div className="meta-row">
                        <i className="fa-solid fa-users meta-icon"></i>
                        <span>
                          <strong>{item.registered_count || 0}</strong>{item.capacity ? `/${item.capacity}` : ''} Registered •{' '}
                          <strong>{item.attended_count || 0}</strong> Attended
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Author & Creation Info */}
                  <div className="card-author-footer">
                    <div className="author-details">
                      <span className="author-name">
                        {item.page_name || item.department_name || 'University Administration'} • {item.author_name || 'Admin'}
                      </span>
                      <span className="post-date">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="card-actions-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                      <button 
                        type="button" 
                        className="card-icon-btn" 
                        style={{ width: 'auto', padding: '0 0.6rem', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 600 }}
                        title="View Details & Attendance"
                        onClick={() => handleOpenPreview(item)}
                      >
                        <i className="fa-solid fa-eye"></i>
                        <span>View</span>
                      </button>

                      <button 
                        type="button" 
                        className="card-icon-btn" 
                        style={{ width: 'auto', padding: '0 0.6rem', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 600 }}
                        title="Edit Record"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                        <span>Edit</span>
                      </button>

                      {isArchived || isTakenDown ? (
                        <button 
                          type="button" 
                          className="card-icon-btn text-emerald" 
                          style={{ width: 'auto', padding: '0 0.6rem', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 600 }}
                          title="Restore Item"
                          onClick={() => {
                            setSelectedItem(item);
                            setActiveModal('restore');
                          }}
                        >
                          <i className="fa-solid fa-rotate-left"></i>
                          <span>Restore</span>
                        </button>
                      ) : (
                        <>
                          <button 
                            type="button" 
                            className="card-icon-btn text-amber" 
                            style={{ width: 'auto', padding: '0 0.6rem', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 600 }}
                            title="Archive Item"
                            onClick={() => {
                              setSelectedItem(item);
                              setActiveModal('archive');
                            }}
                          >
                            <i className="fa-solid fa-box-archive"></i>
                            <span>Archive</span>
                          </button>
                          <button 
                            type="button" 
                            className="card-icon-btn text-rose" 
                            style={{ width: 'auto', padding: '0 0.6rem', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 600 }}
                            title="Take Down (Moderate)"
                            onClick={() => {
                              setSelectedItem(item);
                              setActiveModal('takedown');
                            }}
                          >
                            <i className="fa-solid fa-shield-halved"></i>
                            <span>Take Down</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="card-icon-btn text-rose"
                        style={{ width: 'auto', padding: '0 0.6rem', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 600 }}
                        title="Permanently Delete Record"
                        onClick={() => {
                          setSelectedItem(item);
                          setActiveModal('delete');
                        }}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* ================= GLOBAL PAGINATION BAR (PART 5) ================= */}
        {!loading && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalRecords={pagination.total}
            pageSize={pagination.limit}
            onPageChange={(nextPage) => setPagination(prev => ({ ...prev, page: nextPage }))}
            onPageSizeChange={(nextLimit) => setPagination(prev => ({ ...prev, limit: nextLimit, page: 1 }))}
            loading={loading}
            itemLabel="posts"
          />
        )}

        {/* ================= MODALS & DRAWERS ================= */}

        {/* 1. CREATE / EDIT CONTENT MODAL */}
        {(activeModal === 'create_announcement' || activeModal === 'create_event' || activeModal === 'edit') && (
          <div className="modal-backdrop">
            <div className="modal-container-card">
              <div className="modal-card-header">
                <h2 className="modal-card-title">
                  {activeModal === 'edit' 
                    ? `Edit ${selectedItem?.type === 'event' ? 'Event' : 'Announcement'}`
                    : activeModal === 'create_event' ? 'Create Campus Event' : 'Create Campus Announcement'}
                </h2>
                <button type="button" className="close-modal-btn" onClick={handleCloseModal}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="modal-form-body">
                
                {/* Title */}
                <div className="form-group">
                  <label htmlFor="content-title">Title *</label>
                  <input 
                    id="content-title"
                    type="text" 
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter post or event title"
                    className="modal-input"
                  />
                </div>

                {/* Description / Body */}
                <div className="form-group">
                  <label htmlFor="content-description">Body Content / Description *</label>
                  <textarea 
                    id="content-description"
                    name="description"
                    required
                    rows="4"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Provide complete details..."
                    className="modal-textarea"
                  ></textarea>
                </div>

                {/* Category & Audience Row */}
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="content-category">Category</label>
                    <select 
                      id="content-category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="modal-select"
                    >
                      {categoriesList.length > 0 ? (
                        categoriesList.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="General">General</option>
                          <option value="Academic">Academic</option>
                          <option value="Urgent">Urgent</option>
                          <option value="Campus Life">Campus Life</option>
                          <option value="Sports">Sports</option>
                          <option value="Scholarship">Scholarship</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="content-audience">Audience / Scope</label>
                    <select 
                      id="content-audience"
                      name="audience"
                      value={formData.audience}
                      onChange={handleInputChange}
                      className="modal-select"
                    >
                      <option value="All Campus">All Campus</option>
                      <option value="All Students">All Students</option>
                      <option value="Staff Only">Staff Only</option>
                      <option value="University-Wide">University-Wide</option>
                    </select>
                  </div>
                </div>

                {/* Event Specific Fields */}
                {(activeModal === 'create_event' || (activeModal === 'edit' && selectedItem?.type === 'event')) && (
                  <>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label htmlFor="event-start">Start Date & Time *</label>
                        <input 
                          id="event-start"
                          type="datetime-local"
                          name="event_start"
                          required
                          value={formData.event_start}
                          onChange={handleInputChange}
                          className="modal-input"
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label htmlFor="event-end">End Date & Time</label>
                        <input 
                          id="event-end"
                          type="datetime-local"
                          name="event_end"
                          value={formData.event_end}
                          onChange={handleInputChange}
                          className="modal-input"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label htmlFor="event-venue">Venue / Location</label>
                        <input 
                          id="event-venue"
                          type="text"
                          name="venue"
                          value={formData.venue}
                          onChange={handleInputChange}
                          placeholder="e.g. WMSU Gymnasium"
                          className="modal-input"
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label htmlFor="event-organizer">Organizer</label>
                        <input 
                          id="event-organizer"
                          type="text"
                          name="organizer"
                          value={formData.organizer}
                          onChange={handleInputChange}
                          placeholder="e.g. University Student Council"
                          className="modal-input"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label htmlFor="event-capacity">Registration Capacity</label>
                        <input
                          id="event-capacity"
                          type="number"
                          min="0"
                          name="capacity"
                          value={formData.capacity}
                          onChange={handleInputChange}
                          placeholder="e.g. 200"
                          className="modal-input"
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label htmlFor="event-deadline">Registration Deadline</label>
                        <input
                          id="event-deadline"
                          type="datetime-local"
                          name="reg_deadline"
                          value={formData.reg_deadline}
                          onChange={handleInputChange}
                          className="modal-input"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Scheduled Publication */}
                <div className="form-group">
                  <label htmlFor="scheduled-at">Schedule Publication (Optional)</label>
                  <input 
                    id="scheduled-at"
                    type="datetime-local"
                    name="scheduled_at"
                    value={formData.scheduled_at}
                    onChange={handleInputChange}
                    className="modal-input"
                  />
                  <span className="field-hint">Leave blank to publish immediately upon creation.</span>
                </div>

                {/* Form Footer Buttons */}
                <div className="modal-footer-actions">
                  <button type="button" className="btn-feed-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-feed-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Save & Publish'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* 2. PREVIEW DETAILS & EVENT REGISTRATION/ATTENDANCE MODAL */}
        {activeModal === 'preview' && selectedItem && (
          <div className="modal-backdrop">
            <div className="modal-container-card" style={{ maxWidth: '680px' }}>
              <div className="modal-card-header">
                <div>
                  <span className={`type-badge ${selectedItem.type}`}>
                    {selectedItem.type}
                  </span>
                  <h2 className="modal-card-title" style={{ marginTop: '0.25rem' }}>{selectedItem.title}</h2>
                </div>
                <button type="button" className="close-modal-btn" onClick={handleCloseModal}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="preview-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                <div className="preview-meta-list">
                  <div><strong>Category:</strong> {selectedItem.category || 'General'}</div>
                  <div><strong>Audience:</strong> {selectedItem.audience || 'All Campus'}</div>
                  <div><strong>School Year:</strong> {selectedItem.academic_year_label || 'Active Period'}</div>
                  <div><strong>Source / Unit:</strong> {selectedItem.page_name || selectedItem.department_name || 'University Administration'}</div>
                  <div><strong>Status:</strong> <span className={`workflow-status-badge status-${String(selectedItem.status).toLowerCase()}`}>{selectedItem.status}</span></div>
                  <div><strong>Author:</strong> {selectedItem.submitted_by || selectedItem.author_name || 'Administrator'}</div>
                  <div><strong>Date Created:</strong> {new Date(selectedItem.created_at).toLocaleString()}</div>
                </div>

                {selectedItem.type === 'event' && (
                  <div className="preview-event-box">
                    <div><strong>Start:</strong> {selectedItem.event_start ? new Date(selectedItem.event_start).toLocaleString() : 'N/A'}</div>
                    <div><strong>End:</strong> {selectedItem.event_end ? new Date(selectedItem.event_end).toLocaleString() : 'N/A'}</div>
                    <div><strong>Venue:</strong> {selectedItem.venue || 'N/A'}</div>
                    <div><strong>Organizer:</strong> {selectedItem.organizer || 'N/A'}</div>
                    <div><strong>Capacity:</strong> {selectedItem.capacity || 'Unlimited'}</div>
                  </div>
                )}

                <div className="preview-content-box">
                  <h4 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Content Body</h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#475569' }}>
                    {selectedItem.description || selectedItem.body || 'No detailed content available.'}
                  </p>
                </div>

                {/* Event Registrations & Attendance Inspection (Part 11) */}
                {selectedItem.type === 'event' && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.95rem' }}>
                        <i className="fa-solid fa-clipboard-user" style={{ color: '#7b0d1e', marginRight: '6px' }}></i>
                        Event Registrations & Attendance ({eventEngagement.summary.totalRegistered} Registered • {eventEngagement.summary.totalAttended} Attended)
                      </h4>
                      {eventEngagement.session && (
                        <span className="category-pill">
                          QR Session: {eventEngagement.session.status}
                        </span>
                      )}
                    </div>

                    {eventEngagement.loading ? (
                      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Loading registration & attendance records...</p>
                    ) : eventEngagement.registrations.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                        No student registrations recorded for this event yet.
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto', maxHeight: '220px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                              <th style={{ padding: '0.5rem' }}>Student</th>
                              <th style={{ padding: '0.5rem' }}>Student ID</th>
                              <th style={{ padding: '0.5rem' }}>College</th>
                              <th style={{ padding: '0.5rem' }}>Attendance</th>
                              <th style={{ padding: '0.5rem' }}>Check-in Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventEngagement.registrations.map((reg) => (
                              <tr key={reg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{reg.student_name}</td>
                                <td style={{ padding: '0.5rem' }}>{reg.student_number}</td>
                                <td style={{ padding: '0.5rem' }}>{reg.college}</td>
                                <td style={{ padding: '0.5rem' }}>
                                  <span style={{ fontWeight: 700, color: ['PRESENT', 'LATE'].includes(String(reg.attendance_status).toUpperCase()) ? '#059669' : '#64748b' }}>
                                    {reg.attendance_status || reg.registration_status || 'Registered'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem', color: '#64748b' }}>
                                  {reg.checkin_time ? new Date(reg.checkin_time).toLocaleString() : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-feed-secondary" onClick={handleCloseModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. GLOBAL REUSABLE CONFIRMATION MODAL FOR ARCHIVE / TAKEDOWN / RESTORE / DELETE (PART 6) */}
        <ConfirmationModal
          isOpen={['archive', 'takedown', 'restore', 'delete'].includes(activeModal) && Boolean(selectedItem)}
          title={
            activeModal === 'archive'
              ? 'Archive Content?'
              : activeModal === 'takedown'
              ? 'Take Down Content?'
              : activeModal === 'delete'
              ? 'Permanently Delete Content?'
              : 'Restore Content?'
          }
          itemName={selectedItem?.title || ''}
          itemSubtitle={selectedItem ? `${String(selectedItem.type).toUpperCase()} • ${selectedItem.page_name || 'Campus Page'}` : ''}
          variant={
            activeModal === 'takedown' || activeModal === 'delete'
              ? 'danger'
              : activeModal === 'archive'
              ? 'warning'
              : 'success'
          }
          confirmText={
            activeModal === 'archive'
              ? 'Confirm Archive'
              : activeModal === 'takedown'
              ? 'Confirm Takedown'
              : activeModal === 'delete'
              ? 'Confirm Delete'
              : 'Confirm Restore'
          }
          requireReason={activeModal === 'archive' || activeModal === 'takedown' || activeModal === 'delete'}
          reasonLabel={`Reason for ${activeModal || 'action'}`}
          reasonPlaceholder={`Provide a clear reason for audit logs...`}
          loading={submitting}
          message={
            activeModal === 'archive'
              ? `This will move "${selectedItem?.title}" to the Historical Archives while preserving all associated data.`
              : activeModal === 'takedown'
              ? `This will immediately remove "${selectedItem?.title}" from active campus feeds and mark it as Rejected.`
              : activeModal === 'delete'
              ? `Are you sure you want to permanently delete "${selectedItem?.title}"? For historical preservation, archiving is recommended unless this record is inappropriate or invalid.`
              : `This will restore "${selectedItem?.title}" back to active campus visibility.`
          }
          onConfirm={handleExecuteWorkflow}
          onCancel={handleCloseModal}
        />

      </div>
    </AdminLayout>
  );
};

export default ContentFeed;
