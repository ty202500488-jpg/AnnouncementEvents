import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import '../styles/SystemSettings.css';

const SystemSettings = () => {
  const navigate = useNavigate();
  
  // Navigation & Category Tab State
  const [activeCategory, setActiveCategory] = useState('general');

  // Operational Data States
  const [settings, setSettings] = useState({});
  const [initialSettings, setInitialSettings] = useState({});
  const [systemHealth, setSystemHealth] = useState(null);

  // Async & UX States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch Current Settings & System Health from Backend
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('token');

    try {
      const [settingsRes, healthRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/settings', {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        }),
        fetch('http://localhost:5000/api/admin/settings/health', {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
      ]);

      if (settingsRes.status === 401 || settingsRes.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/auth');
        return;
      }

      const settingsData = await settingsRes.json();
      const healthData = await healthRes.json();

      if (settingsRes.ok) {
        setSettings(settingsData.settings || {});
        setInitialSettings(settingsData.settings || {});
        setHasUnsavedChanges(false);
      } else {
        throw new Error(settingsData.message || 'Failed to load system settings.');
      }

      if (healthRes.ok) {
        setSystemHealth(healthData);
      }
    } catch (err) {
      console.error('Fetch System Settings Error:', err);
      setError(err.message || 'Unable to connect to settings service.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Input Changes & Track Dirty Form State
  const handleInputChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    
    // Check if dirty
    const isDirty = JSON.stringify(updated) !== JSON.stringify(initialSettings);
    setHasUnsavedChanges(isDirty);
  };

  // Discard Unsaved Changes
  const handleDiscardChanges = () => {
    setSettings(initialSettings);
    setHasUnsavedChanges(false);
    setFeedback({ type: 'info', message: 'Unsaved changes discarded.' });
  };

  // Save Settings to Backend API
  const handleSaveSettings = async () => {
    setSaving(true);
    setFeedback(null);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ settings })
      });

      const data = await response.json();

      if (response.ok) {
        setSettings(data.settings);
        setInitialSettings(data.settings);
        setHasUnsavedChanges(false);
        setShowConfirmModal(false);
        setFeedback({ type: 'success', message: data.message || 'System settings updated successfully.' });
      } else {
        throw new Error(data.message || 'Failed to persist setting updates.');
      }
    } catch (err) {
      console.error('Save Settings Error:', err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="system-settings-container">
        
        {/* ================= PAGE HEADER ================= */}
        <div className="ss-header">
          <div>
            <h1 className="ss-title">System Settings</h1>
            <p className="ss-subtitle">
              Configure system-wide policies, publishing behavior, access rules, and operational preferences for the WMSU Campus Announcements & Events System.
            </p>
          </div>

          <div className="ss-header-actions">
            {hasUnsavedChanges && (
              <button 
                type="button" 
                className="btn-ss-secondary"
                onClick={handleDiscardChanges}
                disabled={saving}
              >
                Discard Changes
              </button>
            )}

            <button 
              type="button" 
              className={`btn-ss-primary ${hasUnsavedChanges ? 'pulse-btn' : ''}`}
              onClick={() => {
                if (settings.maintenance_mode_enabled !== initialSettings.maintenance_mode_enabled) {
                  setShowConfirmModal(true);
                } else {
                  handleSaveSettings();
                }
              }}
              disabled={!hasUnsavedChanges || saving}
            >
              <i className={`fa-solid fa-floppy-disk ${saving ? 'spin-icon' : ''}`}></i>
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {feedback && (
          <div className={`ss-alert-banner ${feedback.type}`}>
            <div className="alert-content">
              <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : feedback.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`}></i>
              <span>{feedback.message}</span>
            </div>
            <button type="button" className="close-alert-btn" onClick={() => setFeedback(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* ================= MAIN LAYOUT GRID ================= */}
        <div className="ss-layout-grid">
          
          {/* Left Category Navigation Sidebar */}
          <div className="ss-category-nav">
            {[
              { id: 'general', label: 'General Configuration', icon: 'fa-sliders' },
              { id: 'registration', label: 'Registration & Verification', icon: 'fa-user-shield' },
              { id: 'policies', label: 'Content & Scheduling Policies', icon: 'fa-file-signature' },
              { id: 'maintenance', label: 'Maintenance & Controls', icon: 'fa-screwdriver-wrench' },
              { id: 'info', label: 'System Information & Health', icon: 'fa-server' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`category-nav-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <i className={`fa-solid ${cat.icon}`}></i>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Right Configuration Form Surface */}
          <div className="ss-content-panel">
            {loading ? (
              <div className="settings-skeleton-container">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
              </div>
            ) : error ? (
              <div className="ss-empty-state">
                <i className="fa-solid fa-triangle-exclamation empty-icon text-rose"></i>
                <h3>Unable to Load Settings</h3>
                <p>{error}</p>
                <button type="button" className="btn-ss-primary" onClick={fetchSettings}>Retry</button>
              </div>
            ) : (
              <>
                {/* 1. GENERAL CONFIGURATION */}
                {activeCategory === 'general' && (
                  <div className="settings-section">
                    <h2 className="section-title">General Identity & Localization</h2>
                    <p className="section-desc">Manage system display identity and default time options.</p>

                    <div className="form-group margin-top-16">
                      <label htmlFor="system-name">System Display Name</label>
                      <input 
                        id="system-name"
                        type="text"
                        value={settings.system_display_name || ''}
                        onChange={(e) => handleInputChange('system_display_name', e.target.value)}
                        className="ss-input"
                      />
                      <span className="field-hint">Used in automated university email headers and system notifications.</span>
                    </div>

                    <div className="form-group margin-top-16">
                      <label htmlFor="time-zone">Default Administrative Timezone</label>
                      <select 
                        id="time-zone"
                        value={settings.default_time_zone || 'Asia/Manila'}
                        onChange={(e) => handleInputChange('default_time_zone', e.target.value)}
                        className="ss-select"
                      >
                        <option value="Asia/Manila">Asia/Manila (PST - GMT+8)</option>
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                      </select>
                      <span className="field-hint">Controls announcement scheduling and event registration timestamps.</span>
                    </div>
                  </div>
                )}

                {/* 2. REGISTRATION & VERIFICATION */}
                {activeCategory === 'registration' && (
                  <div className="settings-section">
                    <h2 className="section-title">Student Registration Policies</h2>
                    <p className="section-desc">Control student onboarding and credential verification requirements.</p>

                    <div className="toggle-setting-row margin-top-16">
                      <div className="toggle-info">
                        <strong>Allow New Student Registrations</strong>
                        <p>When disabled, the public student registration form will reject new signups.</p>
                      </div>
                      <label className="switch-toggle">
                        <input 
                          type="checkbox"
                          checked={settings.allow_student_registration === 'true'}
                          onChange={(e) => handleInputChange('allow_student_registration', e.target.checked ? 'true' : 'false')}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    <div className="toggle-setting-row margin-top-16">
                      <div className="toggle-info">
                        <strong>Require Manual Verification (COR & Student ID)</strong>
                        <p>Enforces administrative approval before student accounts can post or register for events.</p>
                      </div>
                      <label className="switch-toggle">
                        <input 
                          type="checkbox"
                          checked={settings.require_manual_verification === 'true'}
                          onChange={(e) => handleInputChange('require_manual_verification', e.target.checked ? 'true' : 'false')}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 3. CONTENT & SCHEDULING POLICIES */}
                {activeCategory === 'policies' && (
                  <div className="settings-section">
                    <h2 className="section-title">Content & Publishing Restrictions</h2>
                    <p className="section-desc">Define scheduling rules and upload boundaries for Staff users.</p>

                    <div className="toggle-setting-row margin-top-16">
                      <div className="toggle-info">
                        <strong>Allow Staff Scheduling</strong>
                        <p>Permits authorized Staff members to schedule announcements and events for future dates.</p>
                      </div>
                      <label className="switch-toggle">
                        <input 
                          type="checkbox"
                          checked={settings.staff_scheduling_enabled === 'true'}
                          onChange={(e) => handleInputChange('staff_scheduling_enabled', e.target.checked ? 'true' : 'false')}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    <div className="form-group margin-top-16">
                      <label htmlFor="upload-limit">Maximum Poster / Attachment Size (MB)</label>
                      <input 
                        id="upload-limit"
                        type="number"
                        min="1"
                        max="50"
                        value={settings.max_upload_size_mb || 10}
                        onChange={(e) => handleInputChange('max_upload_size_mb', e.target.value)}
                        className="ss-input"
                      />
                      <span className="field-hint">Backend multer middleware will reject files larger than this threshold.</span>
                    </div>
                  </div>
                )}

                {/* 4. MAINTENANCE & CONTROLS */}
                {activeCategory === 'maintenance' && (
                  <div className="settings-section">
                    <h2 className="section-title">Maintenance Mode & Access Lock</h2>
                    <p className="section-desc">Lock non-administrator public access during critical system updates.</p>

                    <div className="toggle-setting-row margin-top-16 warning-row">
                      <div className="toggle-info">
                        <strong className="text-rose">Enable System Maintenance Mode</strong>
                        <p>Intercepts student/staff traffic with a custom maintenance announcement.</p>
                      </div>
                      <label className="switch-toggle">
                        <input 
                          type="checkbox"
                          checked={settings.maintenance_mode_enabled === 'true'}
                          onChange={(e) => handleInputChange('maintenance_mode_enabled', e.target.checked ? 'true' : 'false')}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    <div className="form-group margin-top-16">
                      <label htmlFor="maint-msg">Public Maintenance Message</label>
                      <textarea 
                        id="maint-msg"
                        rows="3"
                        value={settings.maintenance_message || ''}
                        onChange={(e) => handleInputChange('maintenance_message', e.target.value)}
                        className="ss-textarea"
                      ></textarea>
                    </div>
                  </div>
                )}

                {/* 5. SYSTEM INFORMATION & HEALTH */}
                {activeCategory === 'info' && (
                  <div className="settings-section">
                    <h2 className="section-title">Server Environment & Health Status</h2>
                    <p className="section-desc">Live operational diagnostic metrics from the Express backend.</p>

                    {systemHealth ? (
                      <div className="health-grid margin-top-16">
                        <div className="health-card">
                          <span className="health-label">Backend API Status</span>
                          <span className="health-value text-emerald">
                            <i className="fa-solid fa-circle-check margin-right-4"></i>
                            {systemHealth.status}
                          </span>
                        </div>

                        <div className="health-card">
                          <span className="health-label">PostgreSQL Connection</span>
                          <span className="health-value text-emerald">
                            <i className="fa-solid fa-database margin-right-4"></i>
                            {systemHealth.database}
                          </span>
                        </div>

                        <div className="health-card">
                          <span className="health-label">Server Uptime</span>
                          <span className="health-value">{Math.floor(systemHealth.uptime / 60)} minutes</span>
                        </div>

                        <div className="health-card">
                          <span className="health-label">Node Environment</span>
                          <span className="health-value uppercase">{systemHealth.environment}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 font-small">Health diagnostic information unavailable.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* HIGH IMPACT CONFIRMATION MODAL */}
        {showConfirmModal && (
          <div className="ss-modal-backdrop">
            <div className="ss-modal-card small-modal">
              <div className="modal-header">
                <h2 className="text-rose">Confirm Maintenance Mode Toggle</h2>
                <button type="button" className="close-btn" onClick={() => setShowConfirmModal(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body">
                <p>
                  Toggling system maintenance mode will affect all non-administrative students and staff users. Are you sure you wish to proceed?
                </p>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ss-secondary" onClick={() => setShowConfirmModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-ss-primary danger-btn" onClick={handleSaveSettings}>
                  Confirm & Save
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