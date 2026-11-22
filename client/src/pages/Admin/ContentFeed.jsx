import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import AdminPostCard, { resolveAdminMediaUrl } from '../../assets/components/AdminPostCard';
import EventRegistrationsManagerModal from '../../assets/components/EventRegistrationsManagerModal';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import UniversityWideSpotlight from '../../assets/components/UniversityWideSpotlight';
import SpotlightExpirationPicker from '../../assets/components/SpotlightExpirationPicker';
import {
  formatSpotlightDateTime,
  hasSpotlightExpirationChanged,
  validateSpotlightExpirationAdjustment,
} from '../../utils/spotlightExpirationUtils';
import { DepartmentPagesSidebarList, PostPageAvatar, getInitials } from '../../assets/components/PortalShellElements';
import '../styles/ContentFeed.css';

/** Normalize image URLs across base64 data URIs, relative /uploads paths, and remote URLs. */
const resolveMediaUrl = resolveAdminMediaUrl;

const ContentFeed = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Filter States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'announcements', 'events', 'archived', 'takedown'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Filter Metadata & Department Pages Options
  const [collegesList, setCollegesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [academicYearsList, setAcademicYearsList] = useState([]);
  const [approvedPages, setApprovedPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [officialPage, setOfficialPage] = useState({
    page_name: 'Western Mindanao State University',
    page_code: 'WM',
    avatar_url: null,
  });

  // Data States
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });

  // UI Control States
  const [quickComposerText, setQuickComposerText] = useState('');
  const [activePostMenuKey, setActivePostMenuKey] = useState(null);
  const [modalPickerView, setModalPickerView] = useState(null); // null | 'postType' | 'category'
  const [activeModal, setActiveModal] = useState(null); // 'create_announcement', 'create_event', 'edit', 'preview', 'archive', 'takedown', 'restore', 'delete'
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewingRegistrationsEvent, setViewingRegistrationsEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [failedImages, setFailedImages] = useState({});
  const [expiresAtReason, setExpiresAtReason] = useState('');
  const [expiresAtError, setExpiresAtError] = useState('');

  const markImageFailed = useCallback((key) => {
    setFailedImages(prev => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

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

  const openCreateModal = (mode = 'create_announcement') => {
    const draft = quickComposerText.trim();
    if (draft) {
      setFormData(prev => ({ ...prev, description: draft }));
      setQuickComposerText('');
    }
    setActiveModal(mode);
  };

  const officialPageName = officialPage?.page_name || 'Western Mindanao State University';
  const adminInitials = getInitials(officialPageName, 'WM');
  const officialAvatarUrl = resolveMediaUrl(officialPage?.avatar_url);

  // Sync URL ?tab=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['all', 'announcements', 'events', 'archived', 'takedown'].includes(tabParam)) {
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

  // Fetch filter metadata (colleges, categories, academic years) & approved department pages
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

    fetch('/api/approved-pages', {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && Array.isArray(data.pages)) {
          setApprovedPages(data.pages);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPages(false));

    if (token) {
      fetch('/api/admin/official-page', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.page) {
            setOfficialPage(data.page);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Close Post 3-Dots Menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.csf-post-menu-wrap')) {
        setActivePostMenuKey(null);
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

    const effectiveTab = activeTab;
    const isActiveFeedTab = ['all', 'announcements', 'events'].includes(activeTab);
    const effectiveStatus =
      isActiveFeedTab && statusFilter === 'all'
        ? 'approved'
        : statusFilter;

    const params = new URLSearchParams({
      tab: effectiveTab,
      search: debouncedSearch,
      category: categoryFilter,
      college: collegeFilter,
      status: effectiveStatus,
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

  const handleOpenConfirm = (action, item) => {
    setSelectedItem(item);
    setActiveModal(action);
  };

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

  const toLocalDateTimeInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Open Edit Modal with Prepopulated Data
  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setExpiresAtReason('');
    setExpiresAtError('');
    setFormData({
      title: item.title || '',
      description: item.description || item.body || '',
      category: item.category || 'General',
      audience: item.audience || 'All Campus',
      scheduled_at: toLocalDateTimeInput(item.scheduled_at),
      expires_at: item.is_university_wide ? (item.expires_at || '') : toLocalDateTimeInput(item.expires_at),
      event_start: toLocalDateTimeInput(item.event_start),
      event_end: toLocalDateTimeInput(item.event_end),
      venue: item.venue || '',
      organizer: item.organizer || '',
      reg_deadline: toLocalDateTimeInput(item.reg_deadline),
      capacity: item.capacity || ''
    });
    setActiveModal('edit');
  };

  // Reset Form Modal State
  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setModalPickerView(null);
    setExpiresAtReason('');
    setExpiresAtError('');
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

    const isEditingSpotlight = Boolean(activeModal === 'edit' && selectedItem?.is_university_wide);
    const spotlightExpiryChanged = isEditingSpotlight && hasSpotlightExpirationChanged(selectedItem.expires_at, formData.expires_at);

    if (isEditingSpotlight) {
      const check = validateSpotlightExpirationAdjustment({
        originalExpiresAt: selectedItem.expires_at,
        nextExpiresAt: formData.expires_at,
        reason: expiresAtReason,
        isPendingApproval: false,
      });
      if (!check.valid) {
        setExpiresAtError(check.error);
        return;
      }
      setExpiresAtError('');
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    let endpoint = '/api/admin/content-feed';
    let method = 'POST';
    const toIsoOrNull = (val) => {
      if (!val) return null;
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };
    const payload = {
      ...formData,
      scheduled_at: toIsoOrNull(formData.scheduled_at),
      expires_at: toIsoOrNull(formData.expires_at),
      event_start: toIsoOrNull(formData.event_start),
      event_end: toIsoOrNull(formData.event_end),
      reg_deadline: toIsoOrNull(formData.reg_deadline),
      ...(spotlightExpiryChanged ? { expires_at_reason: expiresAtReason.trim() } : {}),
    };

    if (activeModal === 'create_announcement') {
      payload.type = 'announcement';
      payload.audience = 'All Campus';
    } else if (activeModal === 'create_event') {
      payload.type = 'event';
      payload.audience = 'All Campus';
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
        window.dispatchEvent(new Event('spotlight:refresh'));
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

  const activeFilterCount = [
    categoryFilter !== 'all',
    collegeFilter !== 'all',
    statusFilter !== 'all',
    academicYearFilter !== 'all',
    dateFilter !== '',
    sortOrder !== 'newest',
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setCollegeFilter('all');
    setStatusFilter('all');
    setAcademicYearFilter('all');
    setDateFilter('');
    setSortOrder('newest');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const viewNavItems = [
    { id: 'all', label: 'All', icon: 'fa-solid fa-layer-group' },
    { id: 'announcements', label: 'Announcements', icon: 'fa-solid fa-bullhorn' },
    { id: 'events', label: 'Events', icon: 'fa-solid fa-calendar-days' },
    { id: 'archived', label: 'Archived', icon: 'fa-solid fa-box-archive' },
    { id: 'takedown', label: 'Taken Down', icon: 'fa-solid fa-shield-halved' },
  ];

  const headerSearchNode = (
    <div className="acf-header-search-wrap">
      <div className="acf-header-search-pill">
        <i className="fa-solid fa-magnifying-glass acf-header-search-icon" aria-hidden="true"></i>
        <input
          type="text"
          placeholder="Search title, organizer, or page..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          className="acf-header-search-input"
          aria-label="Search announcements and events"
        />
        {searchQuery && (
          <button
            type="button"
            className="acf-header-clear-btn"
            onClick={() => {
              setSearchQuery('');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            aria-label="Clear search"
            title="Clear search"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            className="acf-header-reset-chip"
            onClick={handleResetFilters}
            title="Reset all filters"
            aria-label="Reset all filters"
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout headerCenter={headerSearchNode} fullBleed>
      <div className="content-feed-container acf-workspace is-feed-mode">

        {/* ================= RESPONSIVE MOBILE SEARCH BAR (< 768px) ================= */}
        <div className="acf-mobile-bar">
          <div className="acf-mobile-search-row">
            <div className="acf-header-search-pill">
              <i className="fa-solid fa-magnifying-glass acf-header-search-icon" aria-hidden="true"></i>
              <input
                type="text"
                placeholder="Search title, organizer, or page..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="acf-header-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="acf-header-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  aria-label="Clear search"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ================= 2-COLUMN WORKSPACE (CENTER STREAM + RIGHT RAIL) ================= */}
        <div className="acf-shell">

          {/* MAIN SCROLLABLE STREAM (TOP CONTROLS + FEED + PAGINATION) */}
          <section className="acf-center-track" aria-label="Campus Feed stream">
            <div className="acf-center-inner">

              {/* TOP WORKSPACE FILTER & VIEW TABS BAR */}
              <div className="acf-top-controls">
                {/* Horizontal View Tabs + Collapsible Filters Trigger */}
                <div className="acf-views-toolbar">
                  <nav className="acf-views-tabs" aria-label="Content views">
                    {viewNavItems.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          className={`acf-view-tab ${isActive ? 'is-active' : ''}`}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setPagination(prev => ({ ...prev, page: 1 }));
                          }}
                        >
                          <i className={tab.icon} aria-hidden="true"></i>
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  <button
                    type="button"
                    className={`acf-filters-toggle-btn ${showFiltersPanel || activeFilterCount > 0 ? 'is-active' : ''}`}
                    onClick={() => setShowFiltersPanel(prev => !prev)}
                    aria-expanded={showFiltersPanel}
                  >
                    <i className="fa-solid fa-sliders"></i>
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="acf-filter-count-pill">{activeFilterCount}</span>
                    )}
                    <i className={`fa-solid ${showFiltersPanel ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: '0.68rem' }}></i>
                  </button>
                </div>

                {/* Collapsible Filters Panel */}
                {showFiltersPanel && (
                  <div className="acf-filters-drawer">
                    <div className="acf-filters-drawer-head">
                      <span className="acf-rail-section-label">Filter Content</span>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-feed-link"
                          onClick={handleResetFilters}
                        >
                          Reset all
                        </button>
                      )}
                    </div>

                    <div className="acf-filters-grid">
                      <div className="acf-filter-field">
                        <label htmlFor="acf-year-select">School Year</label>
                        <select
                          id="acf-year-select"
                          className="feed-select acf-rail-select"
                          value={academicYearFilter}
                          onChange={(e) => {
                            setAcademicYearFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                          }}
                        >
                          <option value="all">All School Years</option>
                          {academicYearsList.map(ay => (
                            <option key={ay.id} value={ay.id}>
                              SY {ay.label}{ay.is_active ? ' (Active)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="acf-filter-field">
                        <label htmlFor="category-select">Category</label>
                        <select
                          id="category-select"
                          className="feed-select acf-rail-select"
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

                      <div className="acf-filter-field">
                        <label htmlFor="acf-college-select">College / Office</label>
                        <select
                          id="acf-college-select"
                          className="feed-select acf-rail-select"
                          value={collegeFilter}
                          onChange={(e) => {
                            setCollegeFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                          }}
                        >
                          <option value="all">All Colleges / Offices</option>
                          {collegesList.map(col => (
                            <option key={col.id} value={col.name}>
                              {col.code ? `${col.code} — ${col.name}` : col.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="acf-filter-field">
                        <label htmlFor="acf-status-select">Status</label>
                        <select
                          id="acf-status-select"
                          className="feed-select acf-rail-select"
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                          }}
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

                      <div className="acf-filter-field">
                        <label htmlFor="acf-date-input">Date</label>
                        <input
                          id="acf-date-input"
                          type="date"
                          className="feed-select acf-rail-select"
                          value={dateFilter}
                          onChange={(e) => {
                            setDateFilter(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                          }}
                          title="Filter by Event or Publication Date"
                        />
                      </div>

                      <div className="acf-filter-field">
                        <label htmlFor="sort-select">Sort</label>
                        <select
                          id="sort-select"
                          className="feed-select acf-rail-select"
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
                    </div>
                  </div>
                )}
              </div>

              {/* Student/Staff-Matched Compact Horizontal Posting Composer */}
              <div className="mypage-composer">
                <div className="mypage-composer-row">
                  <div className="mypage-composer-avatar" aria-hidden="true">
                    {officialAvatarUrl ? (
                      <img src={officialAvatarUrl} alt={officialPageName} />
                    ) : (
                      adminInitials
                    )}
                  </div>

                  <div className="mypage-composer-input-wrap">
                    <input
                      type="text"
                      className="mypage-composer-input"
                      placeholder="What's on your mind?"
                      aria-label="What's on your mind?"
                      value={quickComposerText}
                      onChange={(e) => setQuickComposerText(e.target.value)}
                      onClick={() => {
                        if (!quickComposerText.trim()) {
                          openCreateModal('create_announcement');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          openCreateModal('create_announcement');
                        }
                      }}
                    />

                    <div className="mypage-composer-actions">
                      <button
                        type="button"
                        className="mypage-composer-icon-btn"
                        onClick={() => openCreateModal('create_announcement')}
                        title="Create Announcement"
                        aria-label="Create Announcement"
                        style={{ color: '#be123c' }}
                      >
                        <i className="fa-solid fa-bullhorn"></i>
                      </button>
                      <button
                        type="button"
                        className="mypage-composer-icon-btn"
                        onClick={() => openCreateModal('create_event')}
                        title="Create Event"
                        aria-label="Create Event"
                        style={{ color: '#b45309' }}
                      >
                        <i className="fa-solid fa-calendar-days"></i>
                      </button>
                      <button
                        type="button"
                        className="mypage-composer-icon-btn"
                        onClick={() => openCreateModal('create_announcement')}
                        title="Add Photo"
                        aria-label="Add Photo"
                        style={{ color: '#15803d' }}
                      >
                        <i className="fa-solid fa-image"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Spotlight slot (< 1080px) */}
              <div className="acf-mobile-spotlight-slot">
                <UniversityWideSpotlight role="admin" variant="mobile" />
              </div>

              {/* FEEDBACK ALERT BANNER */}
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

              {/* CONTENT LISTING */}
              {loading ? (
                <div className="csf-main">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="skeleton-card">
                      <div className="skeleton-line width-40 height-20"></div>
                      <div className="skeleton-line width-80 height-24"></div>
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
                      : 'There are no items currently listed in this view.'}
                  </p>
                </div>
              ) : (
                <div className="csf-main">
                  {items.map((item) => {
                    const postKey = `${item.type}-${item.id}`;
                    return (
                      <AdminPostCard
                        key={postKey}
                        item={item}
                        isMenuOpen={activePostMenuKey === postKey}
                        onToggleMenu={() => setActivePostMenuKey((prev) => (prev === postKey ? null : postKey))}
                        onCloseMenu={() => setActivePostMenuKey(null)}
                        onViewDetails={handleOpenPreview}
                        onViewRegistrations={setViewingRegistrationsEvent}
                        onEdit={handleOpenEdit}
                        onArchive={(target) => handleOpenConfirm('archive', target)}
                        onTakeDown={(target) => handleOpenConfirm('takedown', target)}
                        onRestore={(target) => handleOpenConfirm('restore', target)}
                        onDelete={(target) => handleOpenConfirm('delete', target)}
                        failedImages={failedImages}
                        onImageError={markImageFailed}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT BORDERLESS RAIL: UNIVERSITY-WIDE SPOTLIGHT, DEPARTMENT PAGES & MODERATION */}
          <aside className="acf-right-rail">
            <UniversityWideSpotlight role="admin" variant="desktop" />

            <div className="acf-right-divider">
              <DepartmentPagesSidebarList
                departments={approvedPages}
                loadingDepts={loadingPages}
                pageBasePath="/page"
              />
            </div>
          </aside>

        </div>

        {/* ================= MODALS & DRAWERS ================= */}

        {/* 1. CREATE / EDIT POST MODAL (MATCHED TO MYPAGE/STUDENT) */}
        {(activeModal === 'create_announcement' || activeModal === 'create_event' || activeModal === 'edit') && (() => {
          const isEditMode = activeModal === 'edit';
          const currentPostType = isEditMode
            ? (selectedItem?.type || 'announcement')
            : (activeModal === 'create_event' ? 'event' : 'announcement');
          const isEventForm = currentPostType === 'event';
          const adminName = officialPageName;

          const categoryOptions = categoriesList.length > 0
            ? categoriesList.map((c) => ({
                value: c.name,
                label: c.name,
                desc: 'Announcement category',
                icon: 'fa-solid fa-folder-open',
              }))
            : [
                { value: 'General', label: 'General', desc: 'General campus update', icon: 'fa-solid fa-tag' },
                { value: 'Academic', label: 'Academic', desc: 'Academic notices & schedules', icon: 'fa-solid fa-graduation-cap' },
                { value: 'Urgent', label: 'Urgent', desc: 'Time-sensitive advisories', icon: 'fa-solid fa-triangle-exclamation' },
                { value: 'Campus Life', label: 'Campus Life', desc: 'Student activities & organizations', icon: 'fa-solid fa-users' },
                { value: 'Sports', label: 'Sports', desc: 'Athletics & tournaments', icon: 'fa-solid fa-trophy' },
                { value: 'Scholarship', label: 'Scholarship', desc: 'Grants & financial aid', icon: 'fa-solid fa-award' },
              ];

          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
              }}
              onClick={handleCloseModal}
            >
              <div
                className="no-scrollbar"
                style={{
                  backgroundColor: '#ffffff',
                  width: '100%',
                  maxWidth: '540px',
                  borderRadius: '1rem',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {modalPickerView && (
                    <button
                      type="button"
                      onClick={() => setModalPickerView(null)}
                      aria-label="Back to Create Post"
                      style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: 'none', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <i className="fa-solid fa-arrow-left" style={{ fontSize: '0.9rem' }}></i>
                    </button>
                  )}
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', textAlign: 'center', width: '100%', margin: 0 }}>
                    {modalPickerView === 'postType'
                      ? 'Post Type'
                      : modalPickerView === 'category'
                        ? 'Select Category'
                        : isEditMode
                          ? 'Edit Post'
                          : 'Create Post'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    aria-label="Close modal"
                    style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <i className="fa-solid fa-xmark" style={{ fontSize: '1rem' }}></i>
                  </button>
                </div>

                {modalPickerView ? (
                  <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(modalPickerView === 'postType'
                      ? [
                          { value: 'announcement', label: 'Announcement', desc: 'Share campus news, updates, or reminders.', icon: 'fa-solid fa-bullhorn' },
                          { value: 'event', label: 'Event', desc: 'Host an event with date, venue, and registration.', icon: 'fa-solid fa-calendar-days' },
                        ]
                      : categoryOptions
                    ).map((opt) => {
                      const currentVal =
                        modalPickerView === 'postType'
                          ? currentPostType
                          : formData.category;
                      const isSelected = currentVal === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (modalPickerView === 'postType') {
                              setActiveModal(opt.value === 'event' ? 'create_event' : 'create_announcement');
                            } else {
                              setFormData(prev => ({ ...prev, category: opt.value }));
                            }
                            setModalPickerView(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            width: '100%',
                            padding: '0.75rem 0.875rem',
                            borderRadius: '0.75rem',
                            border: `1.5px solid ${isSelected ? '#881337' : '#e2e8f0'}`,
                            backgroundColor: isSelected ? '#fff1f2' : '#ffffff',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                            <div
                              style={{
                                width: '2.25rem',
                                height: '2.25rem',
                                borderRadius: '50%',
                                backgroundColor: isSelected ? '#881337' : '#f1f5f9',
                                color: isSelected ? '#ffffff' : '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <i className={opt.icon} style={{ fontSize: '0.9rem' }}></i>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{opt.label}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{opt.desc}</div>
                            </div>
                          </div>
                          <span
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: `2px solid ${isSelected ? '#881337' : '#cbd5e1'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && (
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#881337' }} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <form onSubmit={handleSubmitForm} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <PostPageAvatar
                        avatarUrl={resolveMediaUrl(selectedItem?.page_avatar_url) || officialAvatarUrl || null}
                        label={selectedItem?.page_name || adminName}
                        fallbackCode={adminInitials}
                      />

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.2 }}>
                          {selectedItem?.page_name || adminName}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => !isEditMode && setModalPickerView('postType')}
                            disabled={isEditMode}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, color: '#881337', cursor: isEditMode ? 'default' : 'pointer', opacity: isEditMode ? 0.85 : 1 }}
                          >
                            <i className={isEventForm ? 'fa-solid fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                            <span>{isEventForm ? 'Event' : 'Announcement'}</span>
                            {!isEditMode && <i className="fa-solid fa-caret-down" style={{ fontSize: '0.75rem' }}></i>}
                          </button>

                          {!isEventForm && (
                            <button
                              type="button"
                              onClick={() => setModalPickerView('category')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                            >
                              <i className="fa-solid fa-tag" style={{ fontSize: '0.75rem', color: '#64748b' }}></i>
                              <span>{formData.category || 'General'}</span>
                              <i className="fa-solid fa-caret-down" style={{ fontSize: '0.75rem' }}></i>
                            </button>
                          )}

                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, color: '#881337' }}
                            title="Admin posts are always visible campus-wide"
                          >
                            <i className="fa-solid fa-earth-americas" style={{ fontSize: '0.75rem', color: '#881337' }}></i>
                            <span>Campus-Wide</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <input
                      id="content-title"
                      type="text"
                      name="title"
                      required
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder={isEventForm ? 'Event Title...' : 'Announcement Title...'}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.9375rem', fontWeight: 700, outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
                    />

                    {isEventForm && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                        <div>
                          <label htmlFor="event-start" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>START DATE &amp; TIME *</label>
                          <input id="event-start" type="datetime-local" name="event_start" required value={formData.event_start} onChange={handleInputChange} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label htmlFor="event-end" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>END DATE &amp; TIME</label>
                          <input id="event-end" type="datetime-local" name="event_end" value={formData.event_end} onChange={handleInputChange} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label htmlFor="event-venue" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>LOCATION / VENUE</label>
                          <input id="event-venue" type="text" name="venue" placeholder="e.g. WMSU Gymnasium" value={formData.venue} onChange={handleInputChange} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label htmlFor="event-organizer" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>ORGANIZER</label>
                          <input id="event-organizer" type="text" name="organizer" placeholder="e.g. University Student Council" value={formData.organizer} onChange={handleInputChange} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label htmlFor="event-capacity" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>CAPACITY</label>
                          <input id="event-capacity" type="number" min="0" name="capacity" placeholder="Max capacity" value={formData.capacity} onChange={handleInputChange} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label htmlFor="event-deadline" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>REG. DEADLINE</label>
                          <input id="event-deadline" type="datetime-local" name="reg_deadline" value={formData.reg_deadline} onChange={handleInputChange} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    )}

                    <textarea
                      id="content-description"
                      name="description"
                      required
                      rows="4"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Write post description..."
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9375rem', resize: 'none', outline: 'none', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'inherit', minHeight: '110px', boxSizing: 'border-box' }}
                    ></textarea>

                    {!isEditMode && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#0f172a' }}>Add to your post</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setActiveModal(isEventForm ? 'create_announcement' : 'create_event')}
                            title="Toggle Event"
                            aria-label="Toggle Event"
                            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.4rem 0.55rem', cursor: 'pointer', color: '#b45309', fontSize: '1.05rem' }}
                          >
                            <i className="fa-solid fa-calendar-days"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const loc = prompt('Enter Location:', formData.venue);
                              if (loc !== null) setFormData(prev => ({ ...prev, venue: loc }));
                            }}
                            title="Set Location"
                            aria-label="Set Location"
                            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.4rem 0.55rem', cursor: 'pointer', color: '#be123c', fontSize: '1.05rem' }}
                          >
                            <i className="fa-solid fa-location-dot"></i>
                          </button>
                        </div>
                      </div>
                    )}

                    {isEditMode && selectedItem?.is_university_wide && (
                      <SpotlightExpirationPicker
                        idPrefix="cf-edit-exp"
                        originalExpiresAt={selectedItem.expires_at}
                        value={formData.expires_at}
                        onChange={(nextIso) => {
                          setFormData(prev => ({ ...prev, expires_at: nextIso }));
                          if (expiresAtError) setExpiresAtError('');
                        }}
                        reason={expiresAtReason}
                        onReasonChange={(val) => {
                          setExpiresAtReason(val);
                          if (expiresAtError) setExpiresAtError('');
                        }}
                        disabled={submitting}
                        error={expiresAtError}
                      />
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: '#881337', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.75 : 1 }}
                    >
                      {submitting ? 'Submitting...' : isEditMode ? 'Save Changes' : 'Post'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })()}

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
                {(() => {
                  const previewMedia = resolveMediaUrl(selectedItem.image_url);
                  const previewKey = `preview-${selectedItem.type}-${selectedItem.id}`;
                  if (!previewMedia || failedImages[previewKey]) return null;
                  return (
                    <div className="preview-media-frame">
                      <img
                        src={previewMedia}
                        alt={selectedItem.title}
                        onError={() => markImageFailed(previewKey)}
                      />
                    </div>
                  );
                })()}

                <div className="preview-meta-list">
                  <div><strong>Category:</strong> {selectedItem.category || 'General'}</div>
                  <div><strong>Audience:</strong> {selectedItem.audience || 'All Campus'}</div>
                  <div><strong>School Year:</strong> {selectedItem.academic_year_label || 'Active Period'}</div>
                  <div><strong>Source / Unit:</strong> {selectedItem.page_name || selectedItem.department_name || 'University Administration'}</div>
                  <div><strong>Status:</strong> <span className={`workflow-status-badge status-${String(selectedItem.status).toLowerCase()}`}>{selectedItem.status}</span></div>
                  <div><strong>Author:</strong> {selectedItem.submitted_by || selectedItem.author_name || 'Administrator'}</div>
                  <div><strong>Date Created:</strong> {new Date(selectedItem.created_at).toLocaleString()}</div>
                  {selectedItem.is_university_wide && (
                    <div><strong>Spotlight Active Until:</strong> {formatSpotlightDateTime(selectedItem.expires_at)}</div>
                  )}
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
          variant={
            activeModal === 'takedown' || activeModal === 'delete'
              ? 'danger'
              : activeModal === 'archive'
              ? 'warning'
              : 'success'
          }
          confirmText={
            activeModal === 'archive'
              ? 'Archive Post & Notify Creator'
              : activeModal === 'takedown'
              ? 'Archive Takedown & Notify Creator'
              : activeModal === 'delete'
              ? 'Permanently Delete & Notify Creator'
              : 'Confirm Restore'
          }
          requireReason={activeModal === 'archive' || activeModal === 'takedown' || activeModal === 'delete'}
          reasonLabel={
            activeModal === 'archive' || activeModal === 'takedown'
              ? 'Reason for Archiving (logged in Audit Logs & sent to creator)'
              : activeModal === 'delete'
              ? 'Reason for Permanent Deletion (logged & sent to creator)'
              : 'Reason for restoring'
          }
          reasonPlaceholder={`Provide a clear reason (e.g., rule violation details) for audit logs and creator notification...`}
          loading={submitting}
          message={
            activeModal === 'archive'
              ? `This will remove "${selectedItem?.title}" from student feeds, archive it in the database, record your reason in Audit Logs, and notify the post creator.`
              : activeModal === 'takedown'
              ? `This will immediately remove "${selectedItem?.title}" from student feeds, archive it as a rule-violation takedown, record your reason in Audit Logs, and notify the post creator.`
              : activeModal === 'delete'
              ? `This will permanently delete the already-archived post "${selectedItem?.title}" from the database, log the deletion in Audit Logs, and notify the post creator.`
              : `This will restore "${selectedItem?.title}" back to active campus visibility.`
          }
          onConfirm={handleExecuteWorkflow}
          onCancel={handleCloseModal}
        />

        {viewingRegistrationsEvent && (
          <EventRegistrationsManagerModal
            event={viewingRegistrationsEvent}
            onClose={() => setViewingRegistrationsEvent(null)}
            onUpdated={(eventId, counts) => {
              setItems((prev) =>
                prev.map((it) =>
                  it.type === 'event' && it.id === eventId
                    ? { ...it, ...counts }
                    : it
                )
              );
            }}
          />
        )}

      </div>
    </AdminLayout>
  );
};

export default ContentFeed;
