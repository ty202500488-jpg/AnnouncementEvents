import { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/MyPageDashboard.css';
import '../../styles/Settings.css';

export default function MyPageSettings() {
  const [activeTab, setActiveTab] = useState('page-info');
  const [feedback, setFeedback] = useState({ success: '', error: '' });
  const [loading, setLoading] = useState(false);

  // Page Identity & Settings State
  const [settings, setSettings] = useState({
    name: 'College Of Computing Studies',
    category: 'Academic College',
    description: 'Official page for the College of Computing Studies. Providing academic updates, department announcements, and event schedules for CS, IT, and IS students.',
    eventRegistrationAlerts: true,
    publicationStatusUpdates: true,
    emailNotifications: false,
    publicFollowersVisible: true,
    allowStudentComments: true,
  });

  // Current Page Manager Info (Read-only)
  const [managerInfo] = useState({
    name: 'Charm Lagare',
    email: 'charm.lagare@university.edu.ph',
    role: 'Primary Page Owner & Staff Admin',
    assignedDate: 'October 15, 2024'
  });

  // Deactivation Modal State
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');

  const showToast = (success, error = '') => {
    setFeedback({ success, error });
    setTimeout(() => setFeedback({ success: '', error: '' }), 4000);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/my-page/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
        } else {
          const stored = localStorage.getItem('myPageSettings');
          if (stored) setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        }
      } catch {
        const stored = localStorage.getItem('myPageSettings');
        if (stored) setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
      }
    };
    fetchSettings();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      await fetch('/api/my-page/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings }),
      });
      localStorage.setItem('myPageSettings', JSON.stringify(settings));
      showToast('Page settings successfully saved to server!');
    } catch {
      localStorage.setItem('myPageSettings', JSON.stringify(settings));
      showToast('Page settings saved locally.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateSubmit = (e) => {
    e.preventDefault();
    if (!deactivationReason.trim()) {
      showToast('', 'Please provide a reason for the archiving request.');
      return;
    }
    setShowDeactivateModal(false);
    setDeactivationReason('');
    showToast('Page deactivation request sent to administration.');
  };

  return (
    <MyPageDashboardLayout activeTab="settings">
      {/* Hidden Scrollbars Globally */}
      <style>{`
        .staff-dashboard .lg-col-6,
        .staff-dashboard .lg-col-6::-webkit-scrollbar,
        .lp-settings-scroll,
        .lp-settings-scroll::-webkit-scrollbar,
        .lp-segmented-nav,
        .lp-segmented-nav::-webkit-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
          padding-right: 0 !important;
        }
        .staff-dashboard .lg-col-6::-webkit-scrollbar,
        .lp-settings-scroll::-webkit-scrollbar,
        .lp-segmented-nav::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
      `}</style>

      {/* ==================== CENTER MAIN CONTENT ==================== */}
      <main className="lg-col-6 lp-settings-scroll">
        {/* Toast Alerts */}
        {feedback.success && (
          <div className="alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <span>{feedback.success}</span>
          </div>
        )}
        {feedback.error && (
          <div className="lp-toast-error">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{feedback.error}</span>
          </div>
        )}

        {/* Clean Header Area */}
        <div className="lp-header-wrap">
          <h1 className="lp-title">Page Settings</h1>
        </div>

        {/* Gray Segmented Tab Bar */}
        <div className="lp-segmented-nav">
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'page-info' ? 'active' : ''}`}
            onClick={() => setActiveTab('page-info')}
          >
            Page Identity
          </button>
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'ownership' ? 'active' : ''}`}
            onClick={() => setActiveTab('ownership')}
          >
            Management
          </button>
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        {/* Main Content Card */}
        <div className="card lp-white-card">
          {/* TAB 1: PAGE IDENTITY */}
          {activeTab === 'page-info' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Page Information</h2>
                <p>Essential identity details visible across the university platform</p>
              </div>

              <form onSubmit={handleSaveSettings} className="lp-form-layout">
                <div className="lp-field-group">
                  <label htmlFor="name">Page Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={settings.name}
                    onChange={handleInputChange}
                    placeholder="e.g. College of Computing Studies"
                    required
                  />
                </div>

                <div className="lp-field-group">
                  <label htmlFor="category">Page Category</label>
                  <select
                    id="category"
                    name="category"
                    value={settings.category}
                    onChange={handleInputChange}
                  >
                    <option value="Academic College">Academic College</option>
                    <option value="Academic Department">Academic Department</option>
                    <option value="Student Council">Student Council</option>
                    <option value="Student Organization">Student Organization</option>
                    <option value="Administrative Office">Administrative Office</option>
                  </select>
                </div>

                <div className="lp-field-group">
                  <label htmlFor="description">Page Description</label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={settings.description}
                    onChange={handleInputChange}
                    placeholder="Provide a short description of this page..."
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="lp-btn-action-row">
                  <button type="submit" className="lp-primary-btn" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Page Details'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Notification Preferences</h2>
                <p>Choose which page events trigger automated alerts and notifications</p>
              </div>

              <div className="lp-toggle-rows">
                <div className="lp-row">
                  <div className="lp-row-text">
                    <h3>Event Registration Alerts</h3>
                    <p>Receive notifications when students register for events hosted by this page</p>
                  </div>
                  <label className="lp-toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.eventRegistrationAlerts}
                      onChange={() => handleToggle('eventRegistrationAlerts')}
                    />
                    <span className="lp-toggle-slider"></span>
                  </label>
                </div>

                <div className="lp-row">
                  <div className="lp-row-text">
                    <h3>Publishing Status Results</h3>
                    <p>Alerts when proposed announcements or events receive administrator approval</p>
                  </div>
                  <label className="lp-toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.publicationStatusUpdates}
                      onChange={() => handleToggle('publicationStatusUpdates')}
                    />
                    <span className="lp-toggle-slider"></span>
                  </label>
                </div>

                <div className="lp-row">
                  <div className="lp-row-text">
                    <h3>Email Notification Digests</h3>
                    <p>Receive daily or weekly summaries of page interactions via institutional email</p>
                  </div>
                  <label className="lp-toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={() => handleToggle('emailNotifications')}
                    />
                    <span className="lp-toggle-slider"></span>
                  </label>
                </div>

                <div className="lp-row">
                  <div className="lp-row-text">
                    <h3>Public Follower List</h3>
                    <p>Allow enrolled students to see the list of members following this page</p>
                  </div>
                  <label className="lp-toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.publicFollowersVisible}
                      onChange={() => handleToggle('publicFollowersVisible')}
                    />
                    <span className="lp-toggle-slider"></span>
                  </label>
                </div>

                <div className="lp-row">
                  <div className="lp-row-text">
                    <h3>Student Comments on Announcements</h3>
                    <p>Allow authenticated students to post feedback on published bulletins</p>
                  </div>
                  <label className="lp-toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.allowStudentComments}
                      onChange={() => handleToggle('allowStudentComments')}
                    />
                    <span className="lp-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="lp-btn-action-row">
                <button
                  type="button"
                  className="lp-primary-btn"
                  onClick={handleSaveSettings}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: OWNERSHIP & MANAGEMENT (READ-ONLY) */}
          {activeTab === 'ownership' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Page Access & Ownership</h2>
                <p>Read-only details of the current page manager</p>
              </div>

              <div className="lp-identity-box">
                <div className="lp-avatar-box">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div className="lp-identity-info">
                  <div className="lp-identity-title-row">
                    <h3>{managerInfo.name}</h3>
                    <span className="lp-badge-tag">Active Owner</span>
                  </div>
                  <p>{managerInfo.email}</p>
                </div>
              </div>

              <div className="lp-details-grid">
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Assigned Permission Role</span>
                  <span className="lp-cell-val">{managerInfo.role}</span>
                </div>
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Owner Since</span>
                  <span className="lp-cell-val">{managerInfo.assignedDate}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADVANCED / ARCHIVE */}
          {activeTab === 'advanced' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Advanced Controls</h2>
                <p>Direct staff security links and page status management</p>
              </div>

              <div className="lp-system-banner">
                <span className="lp-banner-badge">Management Directive</span>
                <h3>Department Page Operations</h3>
                <p>
                  Pages represent official units of Western Mindanao State University. Modifications to page titles
                  and departmental records undergo institutional review.
                </p>
              </div>

              <div className="lp-sub-section">
                <h3>Credentials Management</h3>
                <p className="lp-muted-desc">To change your personal account password, visit your primary profile settings.</p>
                <a href="/staff/profile" className="lp-maroon-link">
                  Open Staff Profile Security <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
              </div>

              <hr className="lp-separator" />

              <div className="lp-sub-section">
                <h3>Danger Zone</h3>
                <p className="lp-muted-desc">
                  Archiving or deactivating this page will hide all published bulletins and future event registrations from students.
                </p>
                <button
                  type="button"
                  className="lp-danger-btn"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => setShowDeactivateModal(true)}
                >
                  <i className="fa-solid fa-box-archive"></i>
                  <span>Request Page Deactivation / Archiving</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACCOUNT ACTIONS CARD */}
        <div className="card lp-bottom-card">
          <div>
            <h3>Page Operations & Status</h3>
            <p>Page: {settings.name} • {settings.category}</p>
          </div>
          <div className="lp-actions-group">
            <button
              type="button"
              onClick={() => setShowDeactivateModal(true)}
              className="lp-danger-btn"
            >
              <i className="fa-solid fa-box-archive"></i>
              <span>Deactivate Page</span>
            </button>
          </div>
        </div>

        {/* DEACTIVATION MODAL */}
        {showDeactivateModal && (
          <div className="lp-modal-backdrop">
            <div className="lp-modal-sheet">
              <div className="lp-modal-top">
                <h3>Request Page Archiving</h3>
                <button type="button" onClick={() => setShowDeactivateModal(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <p className="lp-modal-caution">
                Institutional pages cannot be deleted immediately to preserve historical student activity and attendance logs. An administrative review is required.
              </p>
              <form onSubmit={handleDeactivateSubmit} className="lp-form-layout">
                <div className="lp-field-group">
                  <label>Reason for Deactivation</label>
                  <textarea
                    rows={3}
                    value={deactivationReason}
                    onChange={(e) => setDeactivationReason(e.target.value)}
                    placeholder="Specify why this page is being archived or deactivated..."
                    required
                  />
                </div>
                <div className="lp-modal-footer">
                  <button
                    type="button"
                    className="lp-secondary-btn"
                    onClick={() => setShowDeactivateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="lp-danger-btn">
                    Confirm Deactivation Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </MyPageDashboardLayout>
  );
}