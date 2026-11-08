import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';
import '../styles/Profile.css';
import '../styles/Settings.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [feedback, setFeedback] = useState({ success: '', error: '' });

  // Read-only student profile
  const [profile, setProfile] = useState({
    firstName: 'AL',
    middleName: 'M.',
    lastName: 'Kamlon',
    studentId: '2023-01458',
    email: 'ty202501626@wmsu.edu.ph',
    accountStatus: 'Active',
    lastLogin: 'Oct 30, 2026, 09:15 AM'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setProfile(prev => ({
          ...prev,
          firstName: parsed.first_name || parsed.firstName || prev.firstName,
          middleName: parsed.middle_name || prev.middleName,
          lastName: parsed.last_name || parsed.lastName || prev.lastName,
          email: parsed.email || prev.email,
          studentId: parsed.student_id || prev.studentId,
        }));
      } catch (err) {
        console.error('Failed to parse user profile', err);
      }
    }
  }, []);

  // 8 Required Student Notification Channels
  const [notifications, setNotifications] = useState({
    universityAnnouncements: true,
    collegeAnnouncements: true,
    departmentAnnouncements: false,
    followedPages: true,
    upcomingEvents: true,
    eventReminders: true,
    eventUpdates: true,
    registrationUpdates: true
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Security Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Support State
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [supportForm, setSupportForm] = useState({
    category: 'Technical Bug',
    subject: '',
    description: ''
  });
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  // Deactivation Modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [isSubmittingDeactivation, setIsSubmittingDeactivation] = useState(false);

  const showToast = (success, error = '') => {
    setFeedback({ success, error });
    setTimeout(() => setFeedback({ success: '', error: '' }), 4000);
  };

  const handleToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNotifications = () => {
    setIsSavingNotifications(true);
    setTimeout(() => {
      setIsSavingNotifications(false);
      showToast('Notification preferences saved successfully!');
    }, 450);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('', 'New password and confirmation do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showToast('', 'Password must be at least 8 characters long.');
      return;
    }

    setIsChangingPassword(true);
    setTimeout(() => {
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully.');
    }, 600);
  };

  const handleSupportSubmit = (e) => {
    e.preventDefault();
    if (!supportForm.subject.trim() || !supportForm.description.trim()) {
      showToast('', 'Please complete all required fields.');
      return;
    }
    setIsSubmittingSupport(true);
    setTimeout(() => {
      setIsSubmittingSupport(false);
      setSupportForm({ category: 'Technical Bug', subject: '', description: '' });
      showToast('Technical issue submitted. Campus IT will review your ticket.');
    }, 600);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of your session?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  const handleDeactivateSubmit = (e) => {
    e.preventDefault();
    if (!deactivationReason.trim()) {
      showToast('', 'Please state a reason for deactivation.');
      return;
    }
    setIsSubmittingDeactivation(true);
    setTimeout(() => {
      setIsSubmittingDeactivation(false);
      setShowDeactivateModal(false);
      setDeactivationReason('');
      showToast('Deactivation request submitted for administrative review.');
    }, 700);
  };

  const faqs = [
    {
      q: 'How do I change my password?',
      a: 'Go to the Security tab, enter your current password, and type a new password with at least 8 characters.'
    },
    {
      q: 'Why are official student details read-only?',
      a: 'Your name, student ID, and WMSU email are verified institutional records managed by university administrators.'
    },
    {
      q: 'Why can I not turn off emergency announcements?',
      a: 'Mandatory university safety directives and emergency alerts cannot be disabled.'
    },
    {
      q: 'How do I register for events?',
      a: 'Open the Events tab on the sidebar, choose an event, and submit registration. Confirmations appear in Registration Updates.'
    }
  ];

  return (
    <DashboardLayout activePage="settings">
      {/* Hide Scrollbars Globally for this page */}
      <style>{`
        .lp-settings-scroll::-webkit-scrollbar,
        .lp-segmented-nav::-webkit-scrollbar,
        body::-webkit-scrollbar,
        html::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .lp-settings-scroll,
        .lp-segmented-nav,
        body,
        html {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      {/* ==================== CENTER MAIN CONTENT ==================== */}
      <main 
        className="lg-col-6 lp-settings-scroll" 
        style={{
          overflowY: 'auto',
          maxHeight: '100%',
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          paddingBottom: '2rem'
        }}
      >
        {/* Toast alerts */}
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
          <h1 className="lp-title">Settings</h1>
        </div>

        {/* Gray Segmented Tab Bar with Floating Active Pill */}
        <div className="lp-segmented-nav">
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            Account
          </button>
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
          <button
            type="button"
            className={`lp-nav-pill ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            Advanced
          </button>
        </div>

        {/* Main Content Card */}
        <div className="card lp-white-card">
          {/* TAB 1: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Notification Preferences</h2>
                <p>Manage how you receive notifications from the campus system</p>
              </div>

              <div className="lp-toggle-rows">
                {[
                  { id: 'universityAnnouncements', title: 'University Announcements', desc: 'Newly published university-wide announcements' },
                  { id: 'collegeAnnouncements', title: 'College Announcements', desc: 'Announcements relevant to your college' },
                  { id: 'departmentAnnouncements', title: 'Department Announcements', desc: 'Department-specific circulars and updates' },
                  { id: 'followedPages', title: 'Followed Pages', desc: 'New announcements and events from followed pages' },
                  { id: 'upcomingEvents', title: 'Upcoming Events', desc: 'Newly published campus events' },
                  { id: 'eventReminders', title: 'Event Reminders', desc: 'Reminders for events you registered for' },
                  { id: 'eventUpdates', title: 'Event Updates', desc: 'Changes to schedules, venues, or details of registered events' },
                  { id: 'registrationUpdates', title: 'Registration Updates', desc: 'Registration confirmations and status updates' }
                ].map((item) => (
                  <div key={item.id} className="lp-row">
                    <div className="lp-row-text">
                      <h3>{item.title}</h3>
                      <p>{item.desc}</p>
                    </div>
                    <label className="lp-toggle-switch">
                      <input
                        type="checkbox"
                        checked={notifications[item.id]}
                        onChange={() => handleToggle(item.id)}
                      />
                      <span className="lp-toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="lp-btn-action-row">
                <button
                  type="button"
                  className="lp-primary-btn"
                  onClick={handleSaveNotifications}
                  disabled={isSavingNotifications}
                >
                  {isSavingNotifications ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNT INFORMATION */}
          {activeTab === 'account' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Account Information</h2>
                <p>View your official registered student credentials</p>
              </div>

              <div className="lp-identity-box">
                <div className="lp-avatar-box">
                  <i className="fa-solid fa-user-graduate"></i>
                </div>
                <div className="lp-identity-info">
                  <div className="lp-identity-title-row">
                    <h3>{`${profile.firstName} ${profile.middleName} ${profile.lastName}`}</h3>
                    <span className="lp-badge-tag">Verified Record</span>
                  </div>
                  <p>{profile.email}</p>
                </div>
              </div>

              <div className="lp-details-grid">
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">First Name</span>
                  <span className="lp-cell-val">{profile.firstName}</span>
                </div>
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Middle Name</span>
                  <span className="lp-cell-val">{profile.middleName}</span>
                </div>
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Last Name</span>
                  <span className="lp-cell-val">{profile.lastName}</span>
                </div>
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Student ID</span>
                  <span className="lp-cell-val font-mono">{profile.studentId}</span>
                </div>
                <div className="lp-detail-cell full">
                  <span className="lp-cell-label">WMSU Institutional Email</span>
                  <span className="lp-cell-val">{profile.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === 'security' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Security Settings</h2>
                <p>Manage your account password and security status</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="lp-form-layout">
                <div className="lp-field-group">
                  <label>Current Password</label>
                  <div className="lp-input-container">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      className="lp-eye-action"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      <i className={`fa-regular ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="lp-field-group">
                  <label>New Password</label>
                  <div className="lp-input-container">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="At least 8 characters"
                      required
                    />
                    <button
                      type="button"
                      className="lp-eye-action"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      <i className={`fa-regular ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="lp-field-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Repeat new password"
                    required
                  />
                </div>

                <button type="submit" className="lp-primary-btn" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Saving...' : 'Save Password'}
                </button>
              </form>

              <hr className="lp-separator" />

              <div className="lp-sub-section">
                <h3>Account Activity</h3>
                <div className="lp-activity-stats">
                  <div>
                    <span className="lp-cell-label">Account Status</span>
                    <span className="lp-active-pill">{profile.accountStatus}</span>
                  </div>
                  <div>
                    <span className="lp-cell-label">Last Session Login</span>
                    <span className="lp-stats-value">{profile.lastLogin}</span>
                  </div>
                </div>
              </div>

              <hr className="lp-separator" />

              <div className="lp-sub-section">
                <h3>Account Recovery</h3>
                <p className="lp-muted-desc">Forgot your credentials or need to reset access?</p>
                <a href="/forgot-password" className="lp-maroon-link">
                  Go to Forgot Password Recovery <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
              </div>
            </div>
          )}

          {/* TAB 4: ADVANCED / ABOUT & SUPPORT */}
          {activeTab === 'about' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Advanced & Support</h2>
                <p>System documentation, frequently asked questions, and technical helpdesk</p>
              </div>

              <div className="lp-system-banner">
                <span className="lp-banner-badge">WMSU System</span>
                <h3>Campus Announcements & Events Management</h3>
                <p>The official digital communications platform for Western Mindanao State University.</p>
              </div>

              <div className="lp-sub-section">
                <h3>Frequently Asked Questions</h3>
                <div className="lp-faq-container">
                  {faqs.map((faq, index) => (
                    <div key={index} className="lp-faq-box">
                      <button
                        type="button"
                        className="lp-faq-trigger"
                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      >
                        <span>{faq.q}</span>
                        <i className={`fa-solid ${expandedFaq === index ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </button>
                      {expandedFaq === index && <div className="lp-faq-body">{faq.a}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <hr className="lp-separator" />

              <div className="lp-sub-section">
                <h3>Report a Technical Issue</h3>
                <p className="lp-muted-desc">Encountering bugs or issues? Submit a report directly to IT support.</p>

                <form onSubmit={handleSupportSubmit} className="lp-form-layout">
                  <div className="lp-field-group">
                    <label>Issue Category</label>
                    <select
                      value={supportForm.category}
                      onChange={(e) => setSupportForm({ ...supportForm, category: e.target.value })}
                    >
                      <option value="Technical Bug">Technical Bug</option>
                      <option value="Event Registration Issue">Event Registration Issue</option>
                      <option value="Notification Issue">Notification Issue</option>
                      <option value="Account Access Problem">Account Access Problem</option>
                    </select>
                  </div>

                  <div className="lp-field-group">
                    <label>Subject</label>
                    <input
                      type="text"
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })}
                      placeholder="Brief summary of the issue"
                      required
                    />
                  </div>

                  <div className="lp-field-group">
                    <label>Description</label>
                    <textarea
                      rows="3"
                      value={supportForm.description}
                      onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })}
                      placeholder="Steps to reproduce..."
                      required
                    />
                  </div>

                  <button type="submit" className="lp-primary-btn" disabled={isSubmittingSupport}>
                    {isSubmittingSupport ? 'Submitting...' : 'Submit Issue'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACCOUNT ACTIONS CARD */}
        <div className="card lp-bottom-card">
          <div>
            <h3>Account Session & Status</h3>
            <p>End your active session or request student account deactivation</p>
          </div>
          <div className="lp-actions-group">
            <button type="button" onClick={handleLogout} className="lp-secondary-btn">
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Log Out</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeactivateModal(true)}
              className="lp-danger-btn"
            >
              <i className="fa-solid fa-user-xmark"></i>
              <span>Request Deactivation</span>
            </button>
          </div>
        </div>

        {/* DEACTIVATION MODAL */}
        {showDeactivateModal && (
          <div className="lp-modal-backdrop">
            <div className="lp-modal-sheet">
              <div className="lp-modal-top">
                <h3>Request Account Deactivation</h3>
                <button type="button" onClick={() => setShowDeactivateModal(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <p className="lp-modal-caution">
                Institutional policies require administrative review to preserve academic records. Accounts are not deleted immediately.
              </p>
              <form onSubmit={handleDeactivateSubmit} className="lp-form-layout">
                <div className="lp-field-group">
                  <label>Reason for Request</label>
                  <textarea
                    rows="3"
                    value={deactivationReason}
                    onChange={(e) => setDeactivationReason(e.target.value)}
                    placeholder="Please specify why you are requesting deactivation..."
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
                  <button type="submit" className="lp-danger-btn" disabled={isSubmittingDeactivation}>
                    {isSubmittingDeactivation ? 'Submitting...' : 'Confirm Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}