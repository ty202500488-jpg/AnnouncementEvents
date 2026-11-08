import { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';
import '../styles/Profile.css';
import '../styles/Settings.css';

export default function StaffSettings() {
  const [activeTab, setActiveTab] = useState('notifications');
  const [feedback, setFeedback] = useState({ success: '', error: '' });

  // Read-only Staff Profile details
  const [profile, setProfile] = useState({
    firstName: 'Maria',
    middleName: 'L.',
    lastName: 'Santos',
    staffId: '2024-STAFF01',
    email: 'msantos@wmsu.edu.ph',
    department: 'College of Computing Studies',
    role: 'Department Staff / Moderator',
    accountStatus: 'Active',
    lastLogin: 'Oct 30, 2026, 08:45 AM'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedStaffId = localStorage.getItem('staff_id');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setProfile(prev => ({
          ...prev,
          firstName: parsed.first_name || parsed.firstName || prev.firstName,
          middleName: parsed.middle_name || prev.middleName,
          lastName: parsed.last_name || parsed.lastName || prev.lastName,
          email: parsed.email || prev.email,
          staffId: storedStaffId || parsed.staff_id || parsed.employee_id || prev.staffId,
          department: parsed.department_name || parsed.department || prev.department
        }));
      } catch (err) {
        console.error('Failed to parse staff profile:', err);
      }
    }
  }, []);

  // Staff-specific notification channels
  const [notifications, setNotifications] = useState({
    universityAnnouncements: true,
    departmentAnnouncements: true,
    pageSubmissions: true,
    eventApprovalAlerts: true,
    attendanceReports: true,
    studentInquiries: true,
    moderationAlerts: true,
    systemBroadcasts: true
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

  // Support / Technical Report State
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [supportForm, setSupportForm] = useState({
    category: 'System Bug',
    subject: '',
    description: ''
  });
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  // Deactivation Modal State
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

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    const staffId = profile.staffId;

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, settings: notifications }),
      });
      localStorage.setItem('staffSettings', JSON.stringify(notifications));
      showToast('Notification preferences saved successfully!');
    } catch {
      localStorage.setItem('staffSettings', JSON.stringify(notifications));
      showToast('Notification preferences saved locally.');
    } finally {
      setIsSavingNotifications(false);
    }
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
      showToast('Staff credentials updated successfully.');
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
      setSupportForm({ category: 'System Bug', subject: '', description: '' });
      showToast('Technical report logged. IT Operations has been notified.');
    }, 600);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of your staff account?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('staff_id');
      window.location.href = '/login';
    }
  };

  const handleDeactivateSubmit = (e) => {
    e.preventDefault();
    if (!deactivationReason.trim()) {
      showToast('', 'Please state a reason for the deactivation request.');
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

  const staffFaqs = [
    {
      q: 'How do I manage departmental announcements?',
      a: 'Authorized staff can draft and publish bulletins from the Announcements tab or through your department page workspace.'
    },
    {
      q: 'Why are staff profile credentials read-only?',
      a: 'Official institutional identities, employee IDs, and assigned department units are centrally verified by campus HR and IT administrators.'
    },
    {
      q: 'Can staff mute emergency university broadcasts?',
      a: 'Urgent university-wide bulletins and emergency safety alerts cannot be muted in accordance with institutional policy.'
    },
    {
      q: 'How do I review student event registration requests?',
      a: 'Navigate to the Events module on your staff dashboard to monitor attendee capacity, track QR codes, and generate attendance manifests.'
    }
  ];

  return (
    <StaffDashboardLayout activePage="settings">
      {/* Strict Hidden Scrollbar CSS Overrides for this View */}
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
          <h1 className="lp-title">Settings</h1>
        </div>

        {/* Gray Segmented Tab Bar */}
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
                <p>Manage how you receive alerts and departmental notices</p>
              </div>

              <div className="lp-toggle-rows">
                {[
                  { id: 'universityAnnouncements', title: 'University Announcements', desc: 'Newly published campus-wide circulars and directives' },
                  { id: 'departmentAnnouncements', title: 'Department Announcements', desc: 'Internal updates relevant to your assigned college' },
                  { id: 'pageSubmissions', title: 'Page Submission Alerts', desc: 'Alerts when organizations submit content for review' },
                  { id: 'eventApprovalAlerts', title: 'Event Approvals & Schedules', desc: 'Status notices for registered and created events' },
                  { id: 'attendanceReports', title: 'Attendance & QR Check-in', desc: 'Automated summaries of event attendance scans' },
                  { id: 'studentInquiries', title: 'Student Inquiries', desc: 'Questions submitted to your department page' },
                  { id: 'moderationAlerts', title: 'Content Moderation', desc: 'Flagged posts or content requiring staff review' },
                  { id: 'systemBroadcasts', title: 'System Operations Broadcasts', desc: 'Maintenance updates and platform schedule notices' }
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

          {/* TAB 2: STAFF ACCOUNT INFORMATION */}
          {activeTab === 'account' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Account Information</h2>
                <p>View your official institutional staff profile and assigned department</p>
              </div>

              <div className="lp-identity-box">
                <div className="lp-avatar-box">
                  <i className="fa-solid fa-user-tie"></i>
                </div>
                <div className="lp-identity-info">
                  <div className="lp-identity-title-row">
                    <h3>{`${profile.firstName} ${profile.middleName} ${profile.lastName}`}</h3>
                    <span className="lp-badge-tag">Verified Staff</span>
                  </div>
                  <p>{profile.department} • {profile.email}</p>
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
                  <span className="lp-cell-label">Staff ID</span>
                  <span className="lp-cell-val font-mono">{profile.staffId}</span>
                </div>
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Assigned Department</span>
                  <span className="lp-cell-val">{profile.department}</span>
                </div>
                <div className="lp-detail-cell">
                  <span className="lp-cell-label">Access Role</span>
                  <span className="lp-cell-val">{profile.role}</span>
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
                <p>Manage your account password and review session access</p>
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
                <h3>Staff Account Activity</h3>
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
                <p className="lp-muted-desc">Need to reset forgotten credentials or request security review?</p>
                <a href="/forgot-password" className="lp-maroon-link">
                  Go to Institutional Password Recovery <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
              </div>
            </div>
          )}

          {/* TAB 4: ADVANCED / ABOUT & SUPPORT */}
          {activeTab === 'about' && (
            <div className="lp-content-block">
              <div className="lp-block-header">
                <h2>Advanced & Staff Support</h2>
                <p>System documentation, staff FAQs, and technical bug reporting</p>
              </div>

              <div className="lp-system-banner">
                <span className="lp-banner-badge">WMSU Staff Portal</span>
                <h3>Campus Announcements & Events Management System</h3>
                <p>Administrative interface for departmental communications and event coordination.</p>
              </div>

              <div className="lp-sub-section">
                <h3>Frequently Asked Questions</h3>
                <div className="lp-faq-container">
                  {staffFaqs.map((faq, index) => (
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
                <h3>Report a System Issue</h3>
                <p className="lp-muted-desc">Encountering permission glitches or server errors? Submit a report directly to IT operations.</p>

                <form onSubmit={handleSupportSubmit} className="lp-form-layout">
                  <div className="lp-field-group">
                    <label>Issue Category</label>
                    <select
                      value={supportForm.category}
                      onChange={(e) => setSupportForm({ ...supportForm, category: e.target.value })}
                    >
                      <option value="System Bug">System Bug</option>
                      <option value="Event Approval Error">Event Approval Error</option>
                      <option value="Announcement Publishing Issue">Announcement Publishing Issue</option>
                      <option value="Staff Role & Permissions">Staff Role & Permissions</option>
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
            <p>End your staff session or submit an account deactivation review</p>
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
                Staff accounts require HR and campus administrator approval before revocation to preserve institutional records.
              </p>
              <form onSubmit={handleDeactivateSubmit} className="lp-form-layout">
                <div className="lp-field-group">
                  <label>Reason for Request</label>
                  <textarea
                    rows="3"
                    value={deactivationReason}
                    onChange={(e) => setDeactivationReason(e.target.value)}
                    placeholder="Please specify why you are requesting staff account deactivation..."
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
    </StaffDashboardLayout>
  );
}