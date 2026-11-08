import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/ContentFeed.css';

const ContentFeed = () => {
  const navigate = useNavigate();

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'announcements', 'events', 'scheduled', 'archived', 'takedown'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Data States
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // UI Control States
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'create_announcement', 'create_event', 'edit', 'preview', 'archive', 'takedown'
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General',
    audience: 'All Students',
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
      search: searchQuery,
      category: categoryFilter,
      sort: sortOrder,
      page: pagination.page,
      limit: pagination.limit
    });

    try {
      const response = await fetch(`http://localhost:5000/api/admin/content-feed?${params.toString()}`, {
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
  }, [activeTab, searchQuery, categoryFilter, sortOrder, pagination.page, pagination.limit, navigate]);

  useEffect(() => {
    fetchFeedData();
  }, [fetchFeedData]);

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
      audience: item.audience || 'All Students',
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
    setActionReason('');
    setFormData({
      title: '',
      description: '',
      category: 'General',
      audience: 'All Students',
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

    let endpoint = 'http://localhost:5000/api/admin/content-feed';
    let method = 'POST';
    const payload = { ...formData };

    if (activeModal === 'create_announcement') {
      payload.type = 'announcement';
    } else if (activeModal === 'create_event') {
      payload.type = 'event';
    } else if (activeModal === 'edit' && selectedItem) {
      endpoint = `http://localhost:5000/api/admin/content-feed/${selectedItem.id}?type=${selectedItem.type}`;
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

  // Handle Workflow Operations (Archive, Takedown, Restore)
  const handleExecuteWorkflow = async () => {
    if (!selectedItem) return;
    if ((activeModal === 'takedown' || activeModal === 'archive') && !actionReason.trim()) {
      setFeedback({ type: 'error', message: 'A valid reason is required for this action.' });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');
    const actionType = activeModal; // 'archive', 'takedown', 'restore'

    try {
      const response = await fetch(`http://localhost:5000/api/admin/content-feed/${selectedItem.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          type: selectedItem.type,
          action: actionType,
          reason: actionReason
        })
      });

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

  return (
    <AdminLayout>
      <div className="content-feed-container">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="feed-header">
          <div>
            <h1 className="feed-title">Content Feed</h1>
            <p className="feed-subtitle">
              View and manage campus announcements and events in one place.
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
          <div className="feed-toolbar">
            
            {/* Search Field */}
            <div className="feed-search-box">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder="Search by title, author, or scope..."
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

            {/* Category Filter */}
            <div className="feed-filter-item">
              <label htmlFor="category-select" className="sr-only">Category</label>
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
                <option value="General">General</option>
                <option value="Academic">Academic</option>
                <option value="Sports">Sports</option>
                <option value="Organizations">Organizations</option>
              </select>
            </div>

            {/* Sorting Order */}
            <div className="feed-filter-item">
              <label htmlFor="sort-select" className="sr-only">Sort Order</label>
              <select 
                id="sort-select"
                className="feed-select" 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(searchQuery || categoryFilter !== 'all' || sortOrder !== 'newest') && (
              <button 
                type="button" 
                className="btn-feed-link"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setSortOrder('newest');
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
              {searchQuery || categoryFilter !== 'all' 
                ? 'No items match your active search or filter criteria.'
                : 'There are no items currently listed in this category view.'}
            </p>
          </div>
        ) : (
          <div className="feed-cards-grid">
            {items.map(item => (
              <div key={`${item.type}-${item.id}`} className="feed-item-card">
                
                {/* Card Top Metadata Header */}
                <div className="card-top-bar">
                  <div className="card-type-group">
                    <span className={`type-badge ${item.type}`}>
                      <i className={`fa-solid ${item.type === 'event' ? 'fa-calendar-days' : 'fa-bullhorn'}`}></i>
                      {item.type}
                    </span>
                    <span className="category-pill">{item.category || 'General'}</span>
                  </div>

                  <span className={`workflow-status-badge status-${item.status}`}>
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
                  </div>
                )}

                {/* Author & Creation Info */}
                <div className="card-author-footer">
                  <div className="author-details">
                    <span className="author-name">{item.submitted_by || item.author_name || 'System Administrator'}</span>
                    <span className="post-date">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="card-actions-row">
                    <button 
                      type="button" 
                      className="card-icon-btn" 
                      title="View Details"
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModal('preview');
                      }}
                    >
                      <i className="fa-solid fa-eye"></i>
                    </button>

                    {item.status !== 'takedown' && (
                      <button 
                        type="button" 
                        className="card-icon-btn" 
                        title="Edit Record"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                    )}

                    {item.status === 'archived' ? (
                      <button 
                        type="button" 
                        className="card-icon-btn text-emerald" 
                        title="Restore Item"
                        onClick={() => {
                          setSelectedItem(item);
                          setActiveModal('restore');
                        }}
                      >
                        <i className="fa-solid fa-rotate-left"></i>
                      </button>
                    ) : item.status !== 'takedown' && (
                      <button 
                        type="button" 
                        className="card-icon-btn text-amber" 
                        title="Archive Item"
                        onClick={() => {
                          setSelectedItem(item);
                          setActiveModal('archive');
                        }}
                      >
                        <i className="fa-solid fa-box-archive"></i>
                      </button>
                    )}

                    {item.status !== 'takedown' && (
                      <button 
                        type="button" 
                        className="card-icon-btn text-rose" 
                        title="Take Down (Moderate)"
                        onClick={() => {
                          setSelectedItem(item);
                          setActiveModal('takedown');
                        }}
                      >
                        <i className="fa-solid fa-shield-halved"></i>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* ================= PAGINATION BAR ================= */}
        {!loading && items.length > 0 && (
          <div className="feed-pagination-bar">
            <span className="pagination-text">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
            </span>
            <div className="pagination-btn-group">
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
                      <option value="General">General</option>
                      <option value="Academic">Academic</option>
                      <option value="Sports">Sports</option>
                      <option value="Organizations">Organizations</option>
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

        {/* 2. PREVIEW DETAILS MODAL */}
        {activeModal === 'preview' && selectedItem && (
          <div className="modal-backdrop">
            <div className="modal-container-card">
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

              <div className="preview-modal-body">
                <div className="preview-meta-list">
                  <div><strong>Category:</strong> {selectedItem.category || 'General'}</div>
                  <div><strong>Audience:</strong> {selectedItem.audience || 'All Students'}</div>
                  <div><strong>Status:</strong> <span className={`workflow-status-badge status-${selectedItem.status}`}>{selectedItem.status}</span></div>
                  <div><strong>Author:</strong> {selectedItem.submitted_by || selectedItem.author_name || 'Administrator'}</div>
                  <div><strong>Date Created:</strong> {new Date(selectedItem.created_at).toLocaleString()}</div>
                </div>

                {selectedItem.type === 'event' && (
                  <div className="preview-event-box">
                    <div><strong>Start:</strong> {selectedItem.event_start ? new Date(selectedItem.event_start).toLocaleString() : 'N/A'}</div>
                    <div><strong>End:</strong> {selectedItem.event_end ? new Date(selectedItem.event_end).toLocaleString() : 'N/A'}</div>
                    <div><strong>Venue:</strong> {selectedItem.venue || 'N/A'}</div>
                    <div><strong>Organizer:</strong> {selectedItem.organizer || 'N/A'}</div>
                  </div>
                )}

                <div className="preview-content-box">
                  <h4 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Content Body</h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#475569' }}>
                    {selectedItem.description || selectedItem.body || 'No detailed content available.'}
                  </p>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-feed-secondary" onClick={handleCloseModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. WORKFLOW ACTION MODAL (Archive / Takedown / Restore) */}
        {(activeModal === 'archive' || activeModal === 'takedown' || activeModal === 'restore') && selectedItem && (
          <div className="modal-backdrop">
            <div className="modal-container-card small-modal">
              <div className="modal-card-header">
                <h2 className="modal-card-title">
                  {activeModal === 'archive' && 'Archive Content'}
                  {activeModal === 'takedown' && 'Take Down Content'}
                  {activeModal === 'restore' && 'Restore Content'}
                </h2>
                <button type="button" className="close-modal-btn" onClick={handleCloseModal}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-form-body">
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                  Are you sure you want to execute <strong>{activeModal}</strong> for "<strong>{selectedItem.title}</strong>"?
                </p>

                {(activeModal === 'archive' || activeModal === 'takedown') && (
                  <div className="form-group">
                    <label htmlFor="action-reason">Reason for {activeModal} *</label>
                    <textarea 
                      id="action-reason"
                      rows="3"
                      required
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder={`State why this content is being ${activeModal === 'archive' ? 'archived' : 'taken down'}...`}
                      className="modal-textarea"
                    ></textarea>
                  </div>
                )}

                <div className="modal-footer-actions">
                  <button type="button" className="btn-feed-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className={`btn-feed-primary ${activeModal === 'takedown' ? 'danger-btn' : ''}`}
                    disabled={submitting}
                    onClick={handleExecuteWorkflow}
                  >
                    {submitting ? 'Processing...' : `Confirm ${activeModal}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default ContentFeed;