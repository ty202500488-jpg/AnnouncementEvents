import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import Pagination from '../../assets/components/Pagination';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import '../styles/SystemSettings.css';

const DEFAULT_SETTINGS = {
  // General
  system_name: 'WMSU Campus Announcements & Events System',
  system_description: 'Official announcements and event management portal for Western Mindanao State University.',
  default_timezone: 'Asia/Manila',
  date_format: 'YYYY-MM-DD',
  maintenance_mode: false,

  // Announcements & Moderation
  default_announcement_category: 'General',
  default_expiration_days: 14,
  require_approval_campus_wide: true,
  max_pinned_announcements: 5,
  allow_urgent_announcements: true,

  // Events & Attendance
  default_event_visibility: 'campus-only',
  enable_event_registration_default: true,
  default_registration_capacity: 100,
  registration_closing_lead_hours: 2,

  // Notifications
  enable_in_app_notifications: true,
  enable_email_notifications: false,
  notify_pending_approval: true,
  notify_student_verification: true,

  // Registration & Verification
  permitted_email_domain: 'wmsu.edu.ph',
  registration_open: true,
  require_student_id_cor_verification: true,
  pending_verification_expire_days: 7,

  // Security
  session_timeout_minutes: 30,
  max_login_attempts: 5,
  enable_rate_limiting: true,
};

const DEFAULT_ACADEMIC_YEAR = {
  id: null,
  start_year: 2026,
  end_year: 2027,
  semester: '1st Semester',
  start_date: '2026-08-01',
  end_date: '2027-05-31',
  status: 'Active',
  is_active: true,
};

const SystemSettings = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);

  // Active School Year & History State
  const [activeSchoolYear, setActiveSchoolYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [academicHistory, setAcademicHistory] = useState([]);

  // School Year Form State (Create or Edit)
  const [editingYearId, setEditingYearId] = useState(null);
  const [syForm, setSyForm] = useState({
    start_year: 2027,
    end_year: 2028,
    semester: '1st Semester',
    start_date: '2027-08-01',
    end_date: '2028-05-31',
    status: 'Upcoming',
    set_active: false,
  });

  // School Year Table Filters & Pagination
  const [sySearch, setSySearch] = useState('');
  const [syStatusFilter, setSyStatusFilter] = useState('all');
  const [syPage, setSyPage] = useState(1);
  const [syPageSize, setSyPageSize] = useState(10);

  // School Year Switching Confirmation Modal State
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [targetSwitchYear, setTargetSwitchYear] = useState(null); // either existing row or 'from_form'
  const [switchingLoading, setSwitchingLoading] = useState(false);

  // Categories & Colleges/Departments State (Part 16)
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [catForm, setCatForm] = useState({ id: null, name: '', description: '' });
  const [deptForm, setDeptForm] = useState({ id: null, code: '', name: '', status: 'Active' });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState({ updatedAt: null, updatedBy: null, emailConfigured: true });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Sync URL query param ?tab=academic-year
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'academic-year' || tabParam === 'academic_year' || tabParam === 'school-year') {
      setActiveTab('academic_year');
    } else if (tabParam && ['general', 'announcements', 'events', 'taxonomy', 'notifications', 'registration', 'security'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const isSettingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const isDirty = isSettingsDirty;

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  };

  // Fetch Settings, School Years, Categories, and Departments
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getHeaders();

      const [settingsRes, ayRes, catRes, deptRes] = await Promise.all([
        fetch('/api/admin/settings', { headers }),
        fetch('/api/admin/academic-years?limit=100', { headers }),
        fetch('/api/admin/categories', { headers }),
        fetch('/api/admin/departments', { headers })
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          const merged = { ...DEFAULT_SETTINGS, ...data.settings };
          setSettings(merged);
          setSavedSettings(merged);
          setMetadata({
            updatedAt: data.metadata?.updatedAt || data.updatedAt || new Date().toISOString(),
            updatedBy: data.metadata?.updatedBy || data.updatedBy || 'MISTO Administrator',
            emailConfigured: data.metadata?.emailConfigured ?? false,
          });
        }
      }

      if (ayRes.ok) {
        const ayData = await ayRes.json();
        const activeSource = ayData.activePeriod || ayData.current;
        if (activeSource) {
          const fmtStart = activeSource.start_date
            ? String(activeSource.start_date).slice(0, 10)
            : `${activeSource.start_year}-08-01`;
          const fmtEnd = activeSource.end_date
            ? String(activeSource.end_date).slice(0, 10)
            : `${activeSource.end_year}-05-31`;

          const activeAY = {
            id: activeSource.id || activeSource.academic_year_id,
            start_year: activeSource.start_year,
            end_year: activeSource.end_year,
            semester: activeSource.semester,
            start_date: fmtStart,
            end_date: fmtEnd,
            status: activeSource.status || (activeSource.is_active ? 'Active' : 'Archived'),
            is_active: Boolean(activeSource.is_active),
          };
          setActiveSchoolYear(activeAY);

          // Suggest next upcoming school year in Create form
          const nextStart = Number(activeSource.start_year) + 1;
          setSyForm((prev) => ({
            ...prev,
            start_year: nextStart,
            end_year: nextStart + 1,
            start_date: `${nextStart}-08-01`,
            end_date: `${nextStart + 1}-05-31`,
          }));
        }
        if (Array.isArray(ayData.history)) {
          setAcademicHistory(ayData.history);
        }
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }
    } catch (err) {
      console.warn('Error fetching system settings:', err);
      showNotification('error', 'Unable to synchronize settings with server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSyFormChange = (field, value) => {
    setSyForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'start_year') {
        const startY = parseInt(value, 10);
        if (!isNaN(startY) && startY >= 2000 && startY <= 2100) {
          updated.end_year = startY + 1;
          updated.start_date = `${startY}-08-01`;
          updated.end_date = `${startY + 1}-05-31`;
        }
      }
      return updated;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Validate General System Settings
  const validateSettingsForm = () => {
    const newErrors = {};
    if (!settings.system_name || settings.system_name.trim() === '') {
      newErrors.system_name = 'System name is required.';
    }
    if (settings.max_pinned_announcements < 1 || settings.max_pinned_announcements > 20) {
      newErrors.max_pinned_announcements = 'Pinned limit must be between 1 and 20.';
    }
    if (settings.default_expiration_days < 1) {
      newErrors.default_expiration_days = 'Expiration period must be at least 1 day.';
    }
    if (settings.default_registration_capacity < 0) {
      newErrors.default_registration_capacity = 'Capacity cannot be negative.';
    }
    if (settings.session_timeout_minutes < 5 || settings.session_timeout_minutes > 480) {
      newErrors.session_timeout_minutes = 'Session timeout must be between 5 and 480 minutes.';
    }
    if (!settings.permitted_email_domain.includes('.')) {
      newErrors.permitted_email_domain = 'Enter a valid domain name (e.g., wmsu.edu.ph).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate School Year Form
  const validateSyForm = () => {
    const newErrors = {};
    const startY = parseInt(syForm.start_year, 10);
    const endY = parseInt(syForm.end_year, 10);

    if (!startY || startY < 2000 || startY > 2100) {
      newErrors.start_year = 'Enter a valid start year (2000–2100).';
    }
    if (endY !== startY + 1) {
      newErrors.end_year = 'End year must be Start Year + 1 (e.g., 2027–2028).';
    }
    if (!syForm.start_date) {
      newErrors.start_date = 'Start date is required.';
    }
    if (!syForm.end_date) {
      newErrors.end_date = 'End date is required.';
    }
    if (syForm.start_date && syForm.end_date && new Date(syForm.start_date) >= new Date(syForm.end_date)) {
      newErrors.end_date = 'End date must be after start date.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save System Settings
  const handleSaveSettings = async () => {
    if (!validateSettingsForm()) {
      showNotification('error', 'Please correct the highlighted validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ settings }),
      });
      if (!response.ok) throw new Error('Failed to save general system settings.');
      setSavedSettings(settings);
      showNotification('success', 'System configuration saved successfully.');
    } catch (err) {
      showNotification('error', err.message || 'An error occurred while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Submit School Year Create / Edit Form
  const handleSyFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateSyForm()) {
      showNotification('error', 'Please fix the school year validation errors.');
      return;
    }

    // If user toggled "Activate immediately", open the School Year Switching Confirmation Modal first!
    if (!editingYearId && syForm.set_active) {
      setTargetSwitchYear({
        isFromForm: true,
        start_year: syForm.start_year,
        end_year: syForm.end_year,
        semester: syForm.semester,
        start_date: syForm.start_date,
        end_date: syForm.end_date,
      });
      setSwitchModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const url = editingYearId
        ? `/api/admin/academic-years/${editingYearId}`
        : '/api/admin/academic-years';
      const method = editingYearId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          start_year: Number(syForm.start_year),
          end_year: Number(syForm.end_year),
          semester: syForm.semester,
          start_date: syForm.start_date,
          end_date: syForm.end_date,
          status: syForm.status,
          is_active: false,
          set_active: false,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save school year.');
      }

      showNotification('success', data.message || 'School year saved successfully.');
      setEditingYearId(null);
      await fetchSettings();
    } catch (err) {
      showNotification('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Prompt to Activate an existing School Year from the table
  const handlePromptActivateYear = (yearItem) => {
    if (yearItem.is_active) {
      showNotification('error', 'This school year is already active.');
      return;
    }
    setTargetSwitchYear({
      isFromForm: false,
      id: yearItem.id || yearItem.academic_year_id,
      start_year: yearItem.start_year,
      end_year: yearItem.end_year,
      semester: yearItem.semester,
      start_date: yearItem.start_date,
      end_date: yearItem.end_date,
    });
    setSwitchModalOpen(true);
  };

  // Confirm & Execute Transactional School Year Switch + Auto-Archiving
  const handleConfirmSchoolYearSwitch = async () => {
    if (!targetSwitchYear) return;
    setSwitchingLoading(true);

    try {
      let res;
      if (targetSwitchYear.isFromForm) {
        res = await fetch('/api/admin/academic-years', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            start_year: Number(targetSwitchYear.start_year),
            end_year: Number(targetSwitchYear.end_year),
            semester: targetSwitchYear.semester,
            start_date: targetSwitchYear.start_date,
            end_date: targetSwitchYear.end_date,
            is_active: true,
            set_active: true,
          }),
        });
      } else {
        res = await fetch(`/api/admin/academic-years/${targetSwitchYear.id}/activate`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            reason: `Activated SY ${targetSwitchYear.start_year}–${targetSwitchYear.end_year} (${targetSwitchYear.semester}) via System Settings`,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to switch active school year.');
      }

      showNotification('success', data.message || 'Active school year switched and previous school year archived.');
      setSwitchModalOpen(false);
      setTargetSwitchYear(null);
      setEditingYearId(null);
      await fetchSettings();
    } catch (err) {
      showNotification('error', err.message || 'Failed to switch school year.');
    } finally {
      setSwitchingLoading(false);
    }
  };

  // Populate form to Edit a School Year
  const handleStartEditYear = (item) => {
    setEditingYearId(item.id || item.academic_year_id);
    setSyForm({
      start_year: item.start_year,
      end_year: item.end_year,
      semester: item.semester || '1st Semester',
      start_date: item.start_date ? String(item.start_date).slice(0, 10) : `${item.start_year}-08-01`,
      end_date: item.end_date ? String(item.end_date).slice(0, 10) : `${item.end_year}-05-31`,
      status: item.status || (item.is_active ? 'Active' : 'Archived'),
      set_active: false,
    });
    setErrors({});
  };

  // Filtered & Paginated School Years
  const filteredHistory = useMemo(() => {
    return academicHistory.filter((item) => {
      const itemStatus = String(item.status || (item.is_active ? 'Active' : 'Archived')).toLowerCase();
      if (syStatusFilter !== 'all' && itemStatus !== syStatusFilter.toLowerCase()) {
        return false;
      }
      if (sySearch.trim()) {
        const q = sySearch.trim().toLowerCase();
        const label = `${item.start_year}-${item.end_year} ${item.start_year}–${item.end_year} ${item.semester} ${itemStatus}`.toLowerCase();
        if (!label.includes(q)) return false;
      }
      return true;
    });
  }, [academicHistory, syStatusFilter, sySearch]);

  const syTotalPages = Math.max(1, Math.ceil(filteredHistory.length / syPageSize));
  const pagedHistory = useMemo(() => {
    const start = (syPage - 1) * syPageSize;
    return filteredHistory.slice(start, start + syPageSize);
  }, [filteredHistory, syPage, syPageSize]);

  // Save Category
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    try {
      const url = catForm.id ? `/api/admin/categories/${catForm.id}` : '/api/admin/categories';
      const method = catForm.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ name: catForm.name.trim(), description: catForm.description.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save category.');
      showNotification('success', data.message || 'Category saved.');
      setCatForm({ id: null, name: '', description: '' });
      fetchSettings();
    } catch (err) {
      showNotification('error', err.message);
    }
  };

  // Save Department/College
  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.code.trim() || !deptForm.name.trim()) return;
    try {
      const url = deptForm.id ? `/api/admin/departments/${deptForm.id}` : '/api/admin/departments';
      const method = deptForm.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          code: deptForm.code.trim().toUpperCase(),
          name: deptForm.name.trim(),
          status: deptForm.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save college/department.');
      showNotification('success', data.message || 'College/Department saved.');
      setDeptForm({ id: null, code: '', name: '', status: 'Active' });
      fetchSettings();
    } catch (err) {
      showNotification('error', err.message);
    }
  };

  const handleResetToSaved = () => {
    setSettings(savedSettings);
    setErrors({});
    showNotification('success', 'Discarded unsaved changes.');
  };

  const tabs = [
    { id: 'general', label: 'General', icon: 'fa-solid fa-gear' },
    { id: 'academic_year', label: 'School Year Management', icon: 'fa-solid fa-graduation-cap' },
    { id: 'taxonomy', label: 'Categories & Colleges', icon: 'fa-solid fa-building-columns' },
    { id: 'announcements', label: 'Announcements & Moderation', icon: 'fa-solid fa-bullhorn' },
    { id: 'events', label: 'Events & Attendance', icon: 'fa-solid fa-calendar-check' },
    { id: 'notifications', label: 'Notifications', icon: 'fa-solid fa-bell' },
    { id: 'registration', label: 'Verification & Access', icon: 'fa-solid fa-user-shield' },
    { id: 'security', label: 'Security Policies', icon: 'fa-solid fa-lock' },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="system-settings-page loading-state">
          <i className="fa-solid fa-circle-notch fa-spin spinner-icon"></i>
          <p>Loading WMSU System Configuration...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="system-settings-page">
        {/* Toast Alert */}
        {toast && (
          <div className={`settings-toast toast-${toast.type}`} role="alert">
            <i className={toast.type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'}></i>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} aria-label="Close message">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* Header Bar */}
        <header className="settings-header">
          <div className="header-title-area">
            <div className="breadcrumbs">
              <span>Admin</span> <i className="fa-solid fa-chevron-right"></i> <span>Configuration</span> <i className="fa-solid fa-chevron-right"></i> <span className="active">System Settings</span>
            </div>
            <h1>
              System Settings {isDirty && <span className="unsaved-badge">Unsaved Changes</span>}
            </h1>
            <p className="header-description">
              Manage global operation parameters, School Year transitions & automatic data archiving, categories, colleges, moderation rules, and security policies.
            </p>
            {metadata.updatedAt && (
              <div className="last-updated-meta">
                <i className="fa-solid fa-clock-rotate-left"></i>
                <span>Last updated: {new Date(metadata.updatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                {metadata.updatedBy && <span>by <strong>{metadata.updatedBy}</strong></span>}
              </div>
            )}
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetToSaved}
              disabled={!isDirty || saving}
            >
              <i className="fa-solid fa-rotate-left"></i> Discard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveSettings}
              disabled={!isDirty || saving}
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i> Save Changes
                </>
              )}
            </button>
          </div>
        </header>

        {/* Settings Body Layout */}
        <div className="settings-body-layout">
          {/* Navigation Category Sidebar */}
          <nav className="settings-nav" aria-label="Settings categories">
            <div className="mobile-category-select">
              <label htmlFor="category-select" className="sr-only">Select Category</label>
              <select
                id="category-select"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            <ul className="desktop-category-list">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    className={`nav-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <i className={tab.icon}></i>
                    <span>{tab.label}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="reset-defaults-box">
              <button
                type="button"
                className="btn-link-danger"
                onClick={() => setShowResetConfirmModal(true)}
              >
                <i className="fa-solid fa-arrow-rotate-left"></i> Reset All to Defaults
              </button>
            </div>
          </nav>

          {/* Main Content Area */}
          <main className="settings-content-card">
            {/* 1. GENERAL SETTINGS */}
            {activeTab === 'general' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-sliders"></i> General System Configuration</h2>
                <p className="section-desc">Basic identification, temporal parameters, and operational status.</p>

                <div className="form-group">
                  <label htmlFor="system_name">System Name <span className="required">*</span></label>
                  <input
                    type="text"
                    id="system_name"
                    value={settings.system_name}
                    onChange={(e) => handleChange('system_name', e.target.value)}
                    className={errors.system_name ? 'input-error' : ''}
                  />
                  {errors.system_name && <span className="error-text">{errors.system_name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="system_description">System Description</label>
                  <textarea
                    id="system_description"
                    rows="3"
                    value={settings.system_description}
                    onChange={(e) => handleChange('system_description', e.target.value)}
                  ></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label htmlFor="default_timezone">Default Timezone</label>
                    <select
                      id="default_timezone"
                      value={settings.default_timezone}
                      onChange={(e) => handleChange('default_timezone', e.target.value)}
                    >
                      <option value="Asia/Manila">Asia/Manila (PHT - UTC+8)</option>
                      <option value="UTC">UTC (Universal Coordinated Time)</option>
                    </select>
                  </div>

                  <div className="form-group col-6">
                    <label htmlFor="date_format">Date Display Format</label>
                    <select
                      id="date_format"
                      value={settings.date_format}
                      onChange={(e) => handleChange('date_format', e.target.value)}
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-26)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (10/26/2026)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (26/10/2026)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="maintenance_mode" className="toggle-label">Maintenance Mode</label>
                    <p className="toggle-desc">
                      When enabled, access to non-admin users will be restricted while system operations are performed.
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="maintenance_mode"
                      checked={settings.maintenance_mode}
                      onChange={(e) => handleChange('maintenance_mode', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </section>
            )}

            {/* 2. SCHOOL YEAR MANAGEMENT & AUTO-ARCHIVING (PART 4) */}
            {activeTab === 'academic_year' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-graduation-cap"></i> School Year Management & Automatic Archiving</h2>
                <p className="section-desc">
                  Manage academic school years and semesters. Switching the active school year automatically archives the previous active school year's announcements and completed events while preserving all registrations, attendance history, and ongoing cross-year events.
                </p>

                {/* Active School Year Banner */}
                <div className="current-period-banner">
                  <div className="period-badge">
                    <span className="badge-label">Current Active School Year</span>
                    <span className="badge-value">
                      SY {activeSchoolYear.start_year}–{activeSchoolYear.end_year} ({activeSchoolYear.semester})
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.2rem' }}>
                      <i className="fa-regular fa-calendar"></i> Duration: <strong>{activeSchoolYear.start_date}</strong> to <strong>{activeSchoolYear.end_date}</strong>
                    </span>
                  </div>
                  <span className="status-pill status-active">
                    <i className="fa-solid fa-circle"></i> Active School Year
                  </span>
                </div>

                {/* Create / Edit School Year Form */}
                <form onSubmit={handleSyFormSubmit} className="sy-management-form-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      {editingYearId ? (
                        <><i className="fa-solid fa-pen-to-square" style={{ color: '#7b0d1e' }}></i> Edit School Year #{editingYearId}</>
                      ) : (
                        <><i className="fa-solid fa-plus-circle" style={{ color: '#7b0d1e' }}></i> Create New School Year</>
                      )}
                    </h3>
                    {editingYearId && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                        onClick={() => {
                          setEditingYearId(null);
                          setErrors({});
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group col-6">
                      <label htmlFor="sy_start_year">Start Year <span className="required">*</span></label>
                      <input
                        type="number"
                        id="sy_start_year"
                        min="2000"
                        max="2100"
                        value={syForm.start_year}
                        onChange={(e) => handleSyFormChange('start_year', e.target.value)}
                        className={errors.start_year ? 'input-error' : ''}
                      />
                      {errors.start_year && <span className="error-text">{errors.start_year}</span>}
                    </div>

                    <div className="form-group col-6">
                      <label htmlFor="sy_end_year">End Year (Start + 1) <span className="required">*</span></label>
                      <input
                        type="number"
                        id="sy_end_year"
                        value={syForm.end_year}
                        onChange={(e) => handleSyFormChange('end_year', e.target.value)}
                        className={errors.end_year ? 'input-error' : ''}
                      />
                      {errors.end_year && <span className="error-text">{errors.end_year}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group col-6">
                      <label htmlFor="sy_start_date">Start Date <span className="required">*</span></label>
                      <input
                        type="date"
                        id="sy_start_date"
                        value={syForm.start_date}
                        onChange={(e) => handleSyFormChange('start_date', e.target.value)}
                        className={errors.start_date ? 'input-error' : ''}
                      />
                      {errors.start_date && <span className="error-text">{errors.start_date}</span>}
                    </div>

                    <div className="form-group col-6">
                      <label htmlFor="sy_end_date">End Date <span className="required">*</span></label>
                      <input
                        type="date"
                        id="sy_end_date"
                        value={syForm.end_date}
                        onChange={(e) => handleSyFormChange('end_date', e.target.value)}
                        className={errors.end_date ? 'input-error' : ''}
                      />
                      {errors.end_date && <span className="error-text">{errors.end_date}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group col-6">
                      <label htmlFor="sy_semester">Semester <span className="required">*</span></label>
                      <select
                        id="sy_semester"
                        value={syForm.semester}
                        onChange={(e) => handleSyFormChange('semester', e.target.value)}
                      >
                        <option value="1st Semester">1st Semester</option>
                        <option value="2nd Semester">2nd Semester</option>
                        <option value="Summer">Summer</option>
                      </select>
                    </div>

                    <div className="form-group col-6">
                      <label htmlFor="sy_status">Initial Status</label>
                      <select
                        id="sy_status"
                        value={syForm.status}
                        onChange={(e) => handleSyFormChange('status', e.target.value)}
                        disabled={syForm.set_active}
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  {!editingYearId && (
                    <div className="form-group card-toggle-group" style={{ marginBottom: '1rem' }}>
                      <div className="toggle-info">
                        <label htmlFor="sy_set_active" className="toggle-label">
                          Activate Immediately & Archive Current School Year ({activeSchoolYear.start_year}–{activeSchoolYear.end_year})
                        </label>
                        <p className="toggle-desc">
                          When checked, saving will prompt confirmation and run a database transaction to switch the active school year and archive {activeSchoolYear.start_year}–{activeSchoolYear.end_year}.
                        </p>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          id="sy_set_active"
                          checked={syForm.set_active}
                          onChange={(e) => handleSyFormChange('set_active', e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <i className={editingYearId ? 'fa-solid fa-check' : 'fa-solid fa-plus'}></i>{' '}
                      {editingYearId
                        ? 'Update School Year'
                        : syForm.set_active
                        ? 'Create & Activate School Year'
                        : 'Create School Year'}
                    </button>
                  </div>
                </form>

                {/* School Years Directory & History Table */}
                <div className="history-subsection">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}><i className="fa-solid fa-clock-rotate-left"></i> All School Years & Historical Records</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Search school year..."
                        value={sySearch}
                        onChange={(e) => {
                          setSySearch(e.target.value);
                          setSyPage(1);
                        }}
                        style={{ padding: '0.42rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      />
                      <select
                        value={syStatusFilter}
                        onChange={(e) => {
                          setSyStatusFilter(e.target.value);
                          setSyPage(1);
                        }}
                        style={{ padding: '0.42rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Archived">Archived</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  {pagedHistory.length === 0 ? (
                    <p className="no-history-text">No school years match your filter criteria.</p>
                  ) : (
                    <>
                      <div className="table-responsive">
                        <table className="history-table">
                          <thead>
                            <tr>
                              <th>School Year</th>
                              <th>Semester</th>
                              <th>Start – End Dates</th>
                              <th>Associated Records</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedHistory.map((item) => {
                              const statusLabel = item.is_active ? 'Active' : (item.status || 'Archived');
                              const sDate = item.start_date ? String(item.start_date).slice(0, 10) : `${item.start_year}-08-01`;
                              const eDate = item.end_date ? String(item.end_date).slice(0, 10) : `${item.end_year}-05-31`;

                              return (
                                <tr key={item.id || `${item.start_year}-${item.semester}`}>
                                  <td className="font-semibold">
                                    SY {item.start_year}–{item.end_year}
                                  </td>
                                  <td>{item.semester}</td>
                                  <td style={{ fontSize: '0.78rem', color: '#475569' }}>
                                    {sDate} → {eDate}
                                  </td>
                                  <td style={{ fontSize: '0.78rem', color: '#334155' }}>
                                    <strong>{item.announcements_count || 0}</strong> Ann •{' '}
                                    <strong>{item.events_count || 0}</strong> Evt •{' '}
                                    <span style={{ color: '#64748b' }}>({item.archived_posts_count || 0} Archived)</span>
                                  </td>
                                  <td>
                                    <span
                                      className={`status-pill ${
                                        item.is_active
                                          ? 'status-active'
                                          : statusLabel.toLowerCase() === 'upcoming'
                                          ? 'status-upcoming'
                                          : 'status-inactive'
                                      }`}
                                    >
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                      {!item.is_active && (
                                        <button
                                          type="button"
                                          className="sy-action-btn activate"
                                          onClick={() => handlePromptActivateYear(item)}
                                          title="Activate this school year and automatically archive the current active year"
                                        >
                                          <i className="fa-solid fa-power-off"></i> Activate
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="sy-action-btn edit"
                                        onClick={() => handleStartEditYear(item)}
                                        title="Edit School Year dates or details"
                                      >
                                        <i className="fa-solid fa-pen"></i> Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="sy-action-btn view"
                                        onClick={() => navigate(`/admin/archives?academicYearId=${item.id || item.academic_year_id}`)}
                                        title="Browse announcements, events, registrations, and attendance for this school year"
                                      >
                                        <i className="fa-solid fa-box-archive"></i> Records
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <Pagination
                        currentPage={syPage}
                        totalPages={syTotalPages}
                        totalRecords={filteredHistory.length}
                        pageSize={syPageSize}
                        onPageChange={(p) => setSyPage(p)}
                        onPageSizeChange={(s) => {
                          setSyPageSize(s);
                          setSyPage(1);
                        }}
                        itemLabel="school years"
                      />
                    </>
                  )}
                </div>
              </section>
            )}

            {/* 3. CATEGORIES & COLLEGES/DEPARTMENTS MANAGEMENT (PART 16) */}
            {activeTab === 'taxonomy' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-building-columns"></i> Categories & Colleges / Departments</h2>
                <p className="section-desc">
                  Manage official announcement/event categories and WMSU colleges/departments used across filters and analytics.
                </p>

                {/* Announcement & Event Categories */}
                <div className="taxonomy-block">
                  <h3><i className="fa-solid fa-tags"></i> Announcement & Event Categories</h3>
                  <form onSubmit={handleSaveCategory} className="taxonomy-inline-form">
                    <input
                      type="text"
                      placeholder="Category Name (e.g., Scholarship)"
                      value={catForm.name}
                      onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={catForm.description}
                      onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))}
                    />
                    <button type="submit" className="btn btn-primary">
                      {catForm.id ? 'Update Category' : 'Add Category'}
                    </button>
                    {catForm.id && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setCatForm({ id: null, name: '', description: '' })}
                      >
                        Cancel
                      </button>
                    )}
                  </form>

                  <div className="table-responsive" style={{ marginTop: '0.85rem' }}>
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Category Name</th>
                          <th>Description</th>
                          <th>Posts Count</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((c) => (
                          <tr key={c.id}>
                            <td className="font-semibold">{c.name}</td>
                            <td>{c.description || '—'}</td>
                            <td>{c.posts_count || 0}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="sy-action-btn edit"
                                onClick={() => setCatForm({ id: c.id, name: c.name, description: c.description || '' })}
                              >
                                <i className="fa-solid fa-pen"></i> Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Colleges & Departments */}
                <div className="taxonomy-block" style={{ marginTop: '2rem' }}>
                  <h3><i className="fa-solid fa-graduation-cap"></i> WMSU Colleges & Academic Departments</h3>
                  <form onSubmit={handleSaveDepartment} className="taxonomy-inline-form">
                    <input
                      type="text"
                      placeholder="Code (e.g., CCS)"
                      value={deptForm.code}
                      onChange={(e) => setDeptForm((p) => ({ ...p, code: e.target.value }))}
                      style={{ maxWidth: '130px' }}
                      required
                    />
                    <input
                      type="text"
                      placeholder="College / Department Full Name"
                      value={deptForm.name}
                      onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                    <select
                      value={deptForm.status}
                      onChange={(e) => setDeptForm((p) => ({ ...p, status: e.target.value }))}
                      style={{ maxWidth: '140px' }}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <button type="submit" className="btn btn-primary">
                      {deptForm.id ? 'Update College' : 'Add College'}
                    </button>
                    {deptForm.id && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setDeptForm({ id: null, code: '', name: '', status: 'Active' })}
                      >
                        Cancel
                      </button>
                    )}
                  </form>

                  <div className="table-responsive" style={{ marginTop: '0.85rem' }}>
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>College / Department Name</th>
                          <th>Programs</th>
                          <th>Students</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map((d) => (
                          <tr key={d.id}>
                            <td className="font-semibold">{d.code}</td>
                            <td>{d.name}</td>
                            <td>{d.programs_count || 0}</td>
                            <td>{d.students_count || 0}</td>
                            <td>
                              <span className={`status-pill ${String(d.status).toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}`}>
                                {d.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="sy-action-btn edit"
                                onClick={() => setDeptForm({ id: d.id, code: d.code, name: d.name, status: d.status || 'Active' })}
                              >
                                <i className="fa-solid fa-pen"></i> Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* 4. ANNOUNCEMENT & MODERATION SETTINGS */}
            {activeTab === 'announcements' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-bullhorn"></i> Announcement & Moderation Rules</h2>
                <p className="section-desc">Configure publishing workflows, expiration rules, and approval requirements.</p>

                <div className="form-group">
                  <label htmlFor="default_announcement_category">Default Category</label>
                  <select
                    id="default_announcement_category"
                    value={settings.default_announcement_category}
                    onChange={(e) => handleChange('default_announcement_category', e.target.value)}
                  >
                    {categories.length > 0 ? (
                      categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="General">General</option>
                        <option value="Academic">Academic</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Campus Life">Campus Life</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label htmlFor="default_expiration_days">Default Post Expiration (Days)</label>
                    <input
                      type="number"
                      id="default_expiration_days"
                      min="1"
                      value={settings.default_expiration_days}
                      onChange={(e) => handleChange('default_expiration_days', parseInt(e.target.value, 10) || 1)}
                      className={errors.default_expiration_days ? 'input-error' : ''}
                    />
                    {errors.default_expiration_days && <span className="error-text">{errors.default_expiration_days}</span>}
                  </div>

                  <div className="form-group col-6">
                    <label htmlFor="max_pinned_announcements">Max Pinned Posts Limit</label>
                    <input
                      type="number"
                      id="max_pinned_announcements"
                      min="1"
                      max="20"
                      value={settings.max_pinned_announcements}
                      onChange={(e) => handleChange('max_pinned_announcements', parseInt(e.target.value, 10) || 1)}
                      className={errors.max_pinned_announcements ? 'input-error' : ''}
                    />
                    {errors.max_pinned_announcements && <span className="error-text">{errors.max_pinned_announcements}</span>}
                  </div>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="require_approval_campus_wide" className="toggle-label">Require Admin Approval for Campus-Wide Posts</label>
                    <p className="toggle-desc">Staff posts marked as campus-wide must be reviewed by administrators before public display.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="require_approval_campus_wide"
                      checked={settings.require_approval_campus_wide}
                      onChange={(e) => handleChange('require_approval_campus_wide', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="allow_urgent_announcements" className="toggle-label">Enable Urgent Announcement Priority</label>
                    <p className="toggle-desc">Allows high-priority posts to display banners across all campus landing portals.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="allow_urgent_announcements"
                      checked={settings.allow_urgent_announcements}
                      onChange={(e) => handleChange('allow_urgent_announcements', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </section>
            )}

            {/* 5. EVENT & ATTENDANCE SETTINGS */}
            {activeTab === 'events' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-calendar-check"></i> Event & Registration Defaults</h2>
                <p className="section-desc">Manage standard registration capacities, event defaults, and closing lead times.</p>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label htmlFor="default_event_visibility">Default Event Visibility</label>
                    <select
                      id="default_event_visibility"
                      value={settings.default_event_visibility}
                      onChange={(e) => handleChange('default_event_visibility', e.target.value)}
                    >
                      <option value="campus-only">Campus-Only (WMSU Authenticated)</option>
                      <option value="public">Public</option>
                      <option value="department-only">Department Only</option>
                    </select>
                  </div>

                  <div className="form-group col-6">
                    <label htmlFor="default_registration_capacity">Default Registration Capacity</label>
                    <input
                      type="number"
                      id="default_registration_capacity"
                      min="0"
                      value={settings.default_registration_capacity}
                      onChange={(e) => handleChange('default_registration_capacity', parseInt(e.target.value, 10) || 0)}
                      className={errors.default_registration_capacity ? 'input-error' : ''}
                    />
                    {errors.default_registration_capacity && <span className="error-text">{errors.default_registration_capacity}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="registration_closing_lead_hours">Registration Cut-off Before Event (Hours)</label>
                  <input
                    type="number"
                    id="registration_closing_lead_hours"
                    min="0"
                    value={settings.registration_closing_lead_hours}
                    onChange={(e) => handleChange('registration_closing_lead_hours', parseInt(e.target.value, 10) || 0)}
                  />
                  <span className="field-hint">Automatically closes registrations X hours prior to event start time.</span>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="enable_event_registration_default" className="toggle-label">Enable Registration by Default</label>
                    <p className="toggle-desc">Automatically enable attendee registration when creating a new event.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="enable_event_registration_default"
                      checked={settings.enable_event_registration_default}
                      onChange={(e) => handleChange('enable_event_registration_default', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </section>
            )}

            {/* 6. NOTIFICATION SETTINGS */}
            {activeTab === 'notifications' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-bell"></i> Notification Preferences</h2>
                <p className="section-desc">Configure automated alert dispatch channels across the campus system.</p>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="enable_in_app_notifications" className="toggle-label">In-App Notifications</label>
                    <p className="toggle-desc">Deliver real-time dashboard notifications to students and faculty.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="enable_in_app_notifications"
                      checked={settings.enable_in_app_notifications}
                      onChange={(e) => handleChange('enable_in_app_notifications', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="enable_email_notifications" className="toggle-label">Email Notifications</label>
                    <p className="toggle-desc">
                      Send email broadcasts for critical announcements and opted-in page updates.
                      {!metadata.emailConfigured && <span className="warning-pill"> SMTP Server Unconfigured</span>}
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="enable_email_notifications"
                      checked={settings.enable_email_notifications}
                      onChange={(e) => handleChange('enable_email_notifications', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="notify_pending_approval" className="toggle-label">Pending Content Alerts for Admins</label>
                    <p className="toggle-desc">Notify administrators when staff members submit new posts for review.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="notify_pending_approval"
                      checked={settings.notify_pending_approval}
                      onChange={(e) => handleChange('notify_pending_approval', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </section>
            )}

            {/* 7. REGISTRATION & VERIFICATION SETTINGS */}
            {activeTab === 'registration' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-user-shield"></i> Student Verification & Access</h2>
                <p className="section-desc">Manage domain restrictions and identity verification requirements.</p>

                <div className="form-group">
                  <label htmlFor="permitted_email_domain">Permitted Student Email Domain <span className="required">*</span></label>
                  <input
                    type="text"
                    id="permitted_email_domain"
                    value={settings.permitted_email_domain}
                    onChange={(e) => handleChange('permitted_email_domain', e.target.value)}
                    className={errors.permitted_email_domain ? 'input-error' : ''}
                  />
                  {errors.permitted_email_domain && <span className="error-text">{errors.permitted_email_domain}</span>}
                  <span className="field-hint">Only registrations ending with this domain will be accepted.</span>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="require_student_id_cor_verification" className="toggle-label">Require COR & ID Upload for Verification</label>
                    <p className="toggle-desc">Students must upload valid WMSU ID and Certificate of Registration before accessing full features.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="require_student_id_cor_verification"
                      checked={settings.require_student_id_cor_verification}
                      onChange={(e) => handleChange('require_student_id_cor_verification', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </section>
            )}

            {/* 8. SECURITY SETTINGS */}
            {activeTab === 'security' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-lock"></i> Security Policies</h2>
                <p className="section-desc">Administrative session limits and login rate limiting policies.</p>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label htmlFor="session_timeout_minutes">Admin Session Timeout (Minutes) <span className="required">*</span></label>
                    <input
                      type="number"
                      id="session_timeout_minutes"
                      min="5"
                      max="480"
                      value={settings.session_timeout_minutes}
                      onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value, 10) || 5)}
                      className={errors.session_timeout_minutes ? 'input-error' : ''}
                    />
                    {errors.session_timeout_minutes && <span className="error-text">{errors.session_timeout_minutes}</span>}
                  </div>

                  <div className="form-group col-6">
                    <label htmlFor="max_login_attempts">Max Failed Login Attempts</label>
                    <input
                      type="number"
                      id="max_login_attempts"
                      min="3"
                      max="10"
                      value={settings.max_login_attempts}
                      onChange={(e) => handleChange('max_login_attempts', parseInt(e.target.value, 10) || 3)}
                    />
                  </div>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="enable_rate_limiting" className="toggle-label">Enable API Rate Limiting</label>
                    <p className="toggle-desc">Protect backend API routes against automated login brute-force attempts.</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="enable_rate_limiting"
                      checked={settings.enable_rate_limiting}
                      onChange={(e) => handleChange('enable_rate_limiting', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </section>
            )}
          </main>
        </div>

        {/* PART 4.4: SCHOOL YEAR SWITCHING CONFIRMATION MODAL */}
        <ConfirmationModal
          isOpen={switchModalOpen}
          title="Change Active School Year?"
          itemName={
            targetSwitchYear
              ? `Activate: SY ${targetSwitchYear.start_year}–${targetSwitchYear.end_year} (${targetSwitchYear.semester})`
              : ''
          }
          itemSubtitle={`Archive: SY ${activeSchoolYear.start_year}–${activeSchoolYear.end_year} (${activeSchoolYear.semester})`}
          variant="warning"
          confirmText="Confirm and Switch"
          cancelText="Cancel"
          loading={switchingLoading}
          message={
            targetSwitchYear
              ? `You are about to activate School Year ${targetSwitchYear.start_year}–${targetSwitchYear.end_year} (${targetSwitchYear.semester}). The current school year, ${activeSchoolYear.start_year}–${activeSchoolYear.end_year} (${activeSchoolYear.semester}), will be archived. Its announcements, events, registrations, and attendance records will remain accessible to administrators.`
              : ''
          }
          onConfirm={handleConfirmSchoolYearSwitch}
          onCancel={() => {
            if (!switchingLoading) {
              setSwitchModalOpen(false);
              setTargetSwitchYear(null);
            }
          }}
        >
          <div style={{ padding: '0.75rem 0.9rem', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.79rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong><i className="fa-solid fa-shield-halved"></i> Non-Destructive Transition Policy:</strong>
            <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0 }}>
              <li>All announcements and completed events from <strong>{activeSchoolYear.start_year}–{activeSchoolYear.end_year}</strong> will be marked as Archived.</li>
              <li>Any ongoing or upcoming events crossing school-year boundaries (or with open attendance sessions) will remain operational without interruption.</li>
              <li>New announcements and events will automatically default to <strong>{targetSwitchYear?.start_year}–{targetSwitchYear?.end_year}</strong>.</li>
            </ul>
          </div>
        </ConfirmationModal>

        {/* RESET DEFAULTS CONFIRMATION MODAL */}
        <ConfirmationModal
          isOpen={showResetConfirmModal}
          title="Confirm Reset to System Defaults"
          variant="danger"
          confirmText="Confirm Reset"
          cancelText="Cancel"
          message="Are you sure you want to reset all configuration fields to original default values? Click Save Changes afterward to commit."
          onConfirm={() => {
            setSettings(DEFAULT_SETTINGS);
            setErrors({});
            setShowResetConfirmModal(false);
            showNotification('success', 'Settings reset to system default values. Click Save Changes to commit.');
          }}
          onCancel={() => setShowResetConfirmModal(false)}
        />
      </div>
    </AdminLayout>
  );
};

export default SystemSettings;
