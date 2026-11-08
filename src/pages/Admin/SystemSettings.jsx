import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../assets/components/AdminLayout';
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
  enable_email_notifications: false, // Flagged unavailable if SMTP is unconfigured
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
  start_year: 2026,
  end_year: 2027,
  semester: '1st Semester',
  is_active: true,
};

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  
  // Academic Year State
  const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [savedAcademicYear, setSavedAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [academicHistory, setAcademicHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState({ updatedAt: null, updatedBy: null });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Check unsaved changes
  const isSettingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const isAcademicYearDirty = JSON.stringify(academicYear) !== JSON.stringify(savedAcademicYear);
  const isDirty = isSettingsDirty || isAcademicYearDirty;

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch Settings & Academic Year on Mount
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };

      // Fetch System Settings
      const settingsRes = await fetch('/api/admin/settings', { headers });
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          const merged = { ...DEFAULT_SETTINGS, ...data.settings };
          setSettings(merged);
          setSavedSettings(merged);
          setMetadata({
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'MISTO Administrator',
          });
        }
      }

      // Fetch Academic Year
      const ayRes = await fetch('/api/admin/academic-years', { headers });
      if (ayRes.ok) {
        const ayData = await ayRes.json();
        if (ayData.activePeriod) {
          const activeAY = {
            start_year: ayData.activePeriod.start_year,
            end_year: ayData.activePeriod.end_year,
            semester: ayData.activePeriod.semester,
            is_active: ayData.activePeriod.is_active,
          };
          setAcademicYear(activeAY);
          setSavedAcademicYear(activeAY);
        }
        if (ayData.history) {
          setAcademicHistory(ayData.history);
        }
      }
    } catch (err) {
      console.warn('Backend endpoints unreachable; retaining default state:', err);
      showNotification('error', 'Unable to synchronize settings with server. Displaying current local defaults.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Form Change for Settings
  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Handle Form Change for Academic Year
  const handleAcademicYearChange = (field, value) => {
    setAcademicYear((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'start_year') {
        const startY = parseInt(value, 10);
        if (!isNaN(startY)) {
          updated.end_year = startY + 1;
        }
      }
      return updated;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Validation Logic
  const validateForm = () => {
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

    // Academic Year Validation
    if (activeTab === 'academic_year' || isAcademicYearDirty) {
      const startY = parseInt(academicYear.start_year, 10);
      const endY = parseInt(academicYear.end_year, 10);
      if (!startY || startY < 2000 || startY > 2100) {
        newErrors.start_year = 'Enter a valid start year.';
      }
      if (endY !== startY + 1) {
        newErrors.end_year = 'End year must follow start year (Start Year + 1).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Trigger Confirmation Modal before saving Academic Year switch
  const handleInitiateSave = () => {
    if (!validateForm()) {
      showNotification('error', 'Please correct the highlighted validation errors before saving.');
      return;
    }

    if (isAcademicYearDirty) {
      setPendingAction('save_academic_year');
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  };

  // Save Settings and Academic Year
  const executeSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };

      // Save System Settings if dirty
      if (isSettingsDirty) {
        const response = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ settings }),
        });
        if (!response.ok) throw new Error('Failed to save general system settings.');
        setSavedSettings(settings);
      }

      // Save Academic Year if dirty
      if (isAcademicYearDirty) {
        const ayResponse = await fetch('/api/admin/academic-years', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            start_year: academicYear.start_year,
            end_year: academicYear.end_year,
            semester: academicYear.semester,
            set_active: academicYear.is_active,
          }),
        });

        if (!ayResponse.ok) {
          const ayErr = await ayResponse.json().catch(() => ({}));
          throw new Error(ayErr.message || 'Failed to update academic year.');
        }

        const ayResData = await ayResponse.json();
        setSavedAcademicYear(academicYear);
        if (ayResData.activePeriod) {
          fetchSettings(); // Refresh history list
        }
      }

      showNotification('success', 'System settings and academic period updated successfully.');
    } catch (err) {
      showNotification('error', err.message || 'An error occurred while attempting to save changes.');
    } finally {
      setSaving(false);
      setShowConfirmModal(false);
      setPendingAction(null);
    }
  };

  // Reset Actions
  const handleResetToSaved = () => {
    setSettings(savedSettings);
    setAcademicYear(savedAcademicYear);
    setErrors({});
    showNotification('success', 'Discarded unsaved changes.');
  };

  const handleConfirmResetDefaults = () => {
    setPendingAction('reset_defaults');
    setShowConfirmModal(true);
  };

  const executePendingAction = () => {
    if (pendingAction === 'reset_defaults') {
      setSettings(DEFAULT_SETTINGS);
      setAcademicYear(DEFAULT_ACADEMIC_YEAR);
      setErrors({});
      showNotification('success', 'Settings reset to system default values. Click Save Changes to commit.');
      setShowConfirmModal(false);
      setPendingAction(null);
    } else if (pendingAction === 'save_academic_year') {
      executeSave();
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: 'fa-solid fa-gear' },
    { id: 'academic_year', label: 'Academic Year', icon: 'fa-solid fa-graduation-cap' },
    { id: 'announcements', label: 'Announcements', icon: 'fa-solid fa-bullhorn' },
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
              <span>Admin</span> <i className="fa-solid fa-chevron-right"></i> <span>System Administration</span> <i className="fa-solid fa-chevron-right"></i> <span className="active">System Settings</span>
            </div>
            <h1>
              System Settings {isDirty && <span className="unsaved-badge">Unsaved Changes</span>}
            </h1>
            <p className="header-description">
              Manage global operation parameters, academic periods, moderation policies, and security guidelines for WMSU.
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
              onClick={handleInitiateSave}
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
          {/* Navigation Category Sidebar / Mobile Dropdown */}
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
                onClick={handleConfirmResetDefaults}
              >
                <i className="fa-solid fa-arrow-rotate-left"></i> Reset All to Defaults
              </button>
            </div>
          </nav>

          {/* Main Content Area */}
          <main className="settings-content-card">
            {/* GENERAL SETTINGS */}
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

            {/* ACADEMIC YEAR SETTINGS */}
            {activeTab === 'academic_year' && (
              <section className="settings-section">
                <h2><i className="fa-solid fa-graduation-cap"></i> Academic Year Configuration</h2>
                <p className="section-desc">Set the current active school year and semester for university broadcasts and events.</p>

                <div className="current-period-banner">
                  <div className="period-badge">
                    <span className="badge-label">Active Period</span>
                    <span className="badge-value">{academicYear.start_year}–{academicYear.end_year} | {academicYear.semester}</span>
                  </div>
                  <span className={`status-pill ${academicYear.is_active ? 'status-active' : 'status-inactive'}`}>
                    <i className="fa-solid fa-circle"></i> {academicYear.is_active ? 'Active Period' : 'Inactive'}
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label htmlFor="start_year">School Year Start <span className="required">*</span></label>
                    <input
                      type="number"
                      id="start_year"
                      min="2000"
                      max="2100"
                      value={academicYear.start_year}
                      onChange={(e) => handleAcademicYearChange('start_year', e.target.value)}
                      className={errors.start_year ? 'input-error' : ''}
                    />
                    {errors.start_year && <span className="error-text">{errors.start_year}</span>}
                  </div>

                  <div className="form-group col-6">
                    <label htmlFor="end_year">School Year End (Derived) <span className="required">*</span></label>
                    <input
                      type="number"
                      id="end_year"
                      value={academicYear.end_year}
                      onChange={(e) => handleAcademicYearChange('end_year', e.target.value)}
                      className={errors.end_year ? 'input-error' : ''}
                    />
                    {errors.end_year && <span className="error-text">{errors.end_year}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="semester">Current Semester <span className="required">*</span></label>
                  <select
                    id="semester"
                    value={academicYear.semester}
                    onChange={(e) => handleAcademicYearChange('semester', e.target.value)}
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>

                <div className="form-group card-toggle-group">
                  <div className="toggle-info">
                    <label htmlFor="is_active" className="toggle-label">Designate as Current Active Academic Period</label>
                    <p className="toggle-desc">
                      Activating this period deactivates previous school years while preserving all historical records.
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={academicYear.is_active}
                      onChange={(e) => handleAcademicYearChange('is_active', e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {/* Academic Year History */}
                <div className="history-subsection">
                  <h3><i className="fa-solid fa-clock-rotate-left"></i> Academic Year History</h3>
                  {academicHistory.length === 0 ? (
                    <p className="no-history-text">No previous academic periods recorded.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>School Year</th>
                            <th>Semester</th>
                            <th>Status</th>
                            <th>Created By</th>
                            <th>Last Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {academicHistory.map((item) => (
                            <tr key={item.id || `${item.start_year}-${item.semester}`}>
                              <td className="font-semibold">{item.start_year}–{item.end_year}</td>
                              <td>{item.semester}</td>
                              <td>
                                <span className={`status-pill ${item.is_active ? 'status-active' : 'status-inactive'}`}>
                                  {item.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>{item.created_by || 'System Admin'}</td>
                              <td>{new Date(item.updated_at || item.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ANNOUNCEMENT & MODERATION SETTINGS */}
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
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Emergency">Emergency / Safety</option>
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
                    <p className="toggle-desc">Staff posts marked as campus-wide must be reviewed by MISTO admins before public display.</p>
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

            {/* EVENT & ATTENDANCE SETTINGS */}
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

            {/* NOTIFICATION SETTINGS */}
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
                      Send email broadcasts for critical announcements.
                      {!settings.enable_email_notifications && <span className="warning-pill"> SMTP Server Unconfigured</span>}
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

            {/* REGISTRATION & VERIFICATION SETTINGS */}
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

            {/* SECURITY SETTINGS */}
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

        {/* Action Confirmation Modal */}
        {showConfirmModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
              <h3>
                <i className="fa-solid fa-triangle-exclamation modal-warn-icon"></i>{' '}
                {pendingAction === 'save_academic_year'
                  ? 'Confirm Active Academic Period Change'
                  : 'Confirm Reset to System Defaults'}
              </h3>
              <p>
                {pendingAction === 'save_academic_year'
                  ? `Are you sure you want to activate Academic Year ${academicYear.start_year}–${academicYear.end_year} (${academicYear.semester})? This will deactivate the current academic period. Historical records will remain intact.`
                  : 'Are you sure you want to reset all configuration fields to original factory defaults? This action will overwrite any unsaved local modifications.'}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingAction(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={pendingAction === 'save_academic_year' ? 'btn btn-primary' : 'btn btn-danger'}
                  onClick={executePendingAction}
                >
                  {pendingAction === 'save_academic_year' ? 'Confirm & Activate' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SystemSettings;