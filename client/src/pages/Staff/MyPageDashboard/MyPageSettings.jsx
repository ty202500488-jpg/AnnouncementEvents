import { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/MyPageDashboard.css';
import '../../styles/Settings.css';

export default function MyPageSettings() {
  const [settings, setSettings] = useState({
    name: 'College Of Computing Studies',
    category: 'Academic College',
    description: 'Official page for the College of Computing Studies. Providing academic updates, department announcements, and event schedules for CS, IT, and IS students.',
    eventRegistrationAlerts: true,
    publicationStatusUpdates: true,
    emailNotifications: false,
  });

  const [managerInfo] = useState({
    name: 'Charm Lagare',
    email: 'charm.lagare@university.edu.ph',
    role: 'Primary Page Owner & Staff Admin',
    assignedDate: 'October 15, 2024'
  });

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Fetch settings from database backend on mount with localStorage fallback
  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/my-page/settings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok && data.settings) {
          setSettings(data.settings);
        } else {
          const storedSettings = localStorage.getItem('myPageSettings');
          if (storedSettings) setSettings(JSON.parse(storedSettings));
        }
      } catch (err) {
        console.error('Database connection failed, loading local settings:', err);
        const storedSettings = localStorage.getItem('myPageSettings');
        if (storedSettings) setSettings(JSON.parse(storedSettings));
      }
    };

    fetchSettings();
  }, []);

  const handleToggle = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      // 1. Save to PostgreSQL database
      const res = await fetch('/api/my-page/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) throw new Error('Failed to persist in database');

      // 2. Cache in localStorage
      localStorage.setItem('myPageSettings', JSON.stringify(settings));

      setMessage('Page settings successfully updated and saved to server!');
      setErrorMessage('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      localStorage.setItem('myPageSettings', JSON.stringify(settings));
      setMessage('Settings saved locally.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferRequest = () => {
    setShowTransferModal(true);
  };

  const handleDeactivationRequest = () => {
    if (window.confirm('Are you sure you want to request page deactivation or archiving? An administrator will review your request.')) {
      setMessage('Page deactivation request sent to administration.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <MyPageDashboardLayout activeTab="settings">
      <main className="lg-col-6 space-y-6 settings-wrapper">
        {message && (
          <div className="alert-success">
            <i className="fa-solid fa-circle-check"></i>
            <span>{message}</span>
          </div>
        )}

        {errorMessage && (
          <div className="alert-error" style={{ backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="settings-container-card">
          <div className="settings-header-box">
            <div>
              <h3>Page Settings</h3>
              <p>Manage your page identity, manager access, and notification preferences.</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            
            {/* SECTION 1: PAGE INFORMATION */}
            <div className="settings-section-group" style={{ paddingTop: 0 }}>
              <h4 className="settings-section-title">Page Information</h4>
              <p className="settings-section-desc">Essential identity details visible across the platform.</p>
              
              <div className="space-y-3">
                <div className="settings-form-group">
                  <label htmlFor="name">Page Name</label>
                  <input 
                    type="text"
                    id="name"
                    name="name"
                    value={settings.name}
                    onChange={handleToggle}
                    className="settings-select-input"
                    placeholder="e.g. College of Computing Studies"
                    required
                  />
                </div>

                <div className="settings-form-group">
                  <label htmlFor="category">Page Category</label>
                  <select 
                    id="category"
                    name="category"
                    value={settings.category}
                    onChange={handleToggle}
                    className="settings-select-input"
                  >
                    <option value="Academic College">Academic College</option>
                    <option value="Academic Department">Academic Department</option>
                    <option value="Student Council">Student Council</option>
                    <option value="Student Organization">Student Organization</option>
                    <option value="Administrative Office">Administrative Office</option>
                  </select>
                </div>

                <div className="settings-form-group">
                  <label htmlFor="description">Page Description</label>
                  <textarea 
                    id="description"
                    name="description"
                    rows={4}
                    value={settings.description}
                    onChange={handleToggle}
                    className="settings-select-input"
                    placeholder="Provide a short description of this page..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: PAGE ACCESS & MANAGEMENT */}
            <div className="settings-section-group">
              <h4 className="settings-section-title">Page Access & Ownership</h4>
              <p className="settings-section-desc">Read-only details of the current page manager and ownership change guidelines.</p>
              
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900)' }}>{managerInfo.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{managerInfo.email}</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#047857', padding: '0.25rem 0.625rem', borderRadius: '1rem', border: '1px solid #a7f3d0' }}>
                    Active Owner
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.75rem', borderTop: '1px solid var(--slate-200)', paddingTop: '0.75rem', color: 'var(--slate-600)' }}>
                  <div>
                    <span style={{ color: 'var(--slate-400)', display: 'block' }}>Assigned Permission Role</span>
                    <strong style={{ color: 'var(--slate-800)' }}>{managerInfo.role}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--slate-400)', display: 'block' }}>Owner Since</span>
                    <strong style={{ color: 'var(--slate-800)' }}>{managerInfo.assignedDate}</strong>
                  </div>
                </div>
              </div>

              <div className="settings-action-stack">
                <button 
                  type="button" 
                  onClick={handleTransferRequest} 
                  className="settings-btn-secondary"
                >
                  <span>Request manager ownership change</span>
                  <i className="fa-solid fa-arrow-right-arrow-left"></i>
                </button>
              </div>
            </div>

            {/* SECTION 3: NOTIFICATIONS */}
            <div className="settings-section-group">
              <h4 className="settings-section-title">Notifications</h4>
              <p className="settings-section-desc">Choose which updates trigger automated alerts.</p>
              
              <div className="space-y-1">
                <label className="settings-toggle-row">
                  <span>Event registration alerts</span>
                  <input 
                    type="checkbox" 
                    name="eventRegistrationAlerts" 
                    checked={settings.eventRegistrationAlerts} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>

                <label className="settings-toggle-row">
                  <span>Publishing status results</span>
                  <input 
                    type="checkbox" 
                    name="publicationStatusUpdates" 
                    checked={settings.publicationStatusUpdates} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>

                <label className="settings-toggle-row">
                  <span>Email notification digests</span>
                  <input 
                    type="checkbox" 
                    name="emailNotifications" 
                    checked={settings.emailNotifications} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>
              </div>
            </div>

            {/* SECTION 4: SECURITY & ACCOUNT CONTROL */}
            <div className="settings-section-group">
              <h4 className="settings-section-title">Security & Account Control</h4>
              <p className="settings-section-desc">Manage account actions and page status.</p>
              
              <div className="settings-action-stack">
                <a 
                  href="/staff/profile" 
                  className="settings-btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  <span>Change password in Staff Profile</span>
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </a>

                <button 
                  type="button" 
                  onClick={handleDeactivationRequest} 
                  className="settings-btn-danger"
                >
                  <span>Request page deactivation or archiving</span>
                  <i className="fa-solid fa-file-excel"></i>
                </button>
              </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="settings-footer-actions">
              <button type="submit" disabled={loading} className="settings-save-btn">
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>

          </form>
        </div>

        {/* REQUEST MANAGER TRANSFER MODAL */}
        {showTransferModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <div className="settings-container-card" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                  Request Manager Transfer
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: '1.1rem' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', marginBottom: '1rem', lineHeight: 1.5 }}>
                To transfer ownership of <strong>{settings.name}</strong> to another staff member, submit a formal request to your system administrator.
              </p>

              <div className="settings-form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="newManagerEmail">New Manager's University Email</label>
                <input
                  id="newManagerEmail"
                  type="email"
                  className="settings-select-input"
                  placeholder="e.g. successor.staff@university.edu.ph"
                />
              </div>

              <div className="settings-form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="transferReason">Reason for Succession / Transfer</label>
                <textarea
                  id="transferReason"
                  rows={3}
                  className="settings-select-input"
                  placeholder="Provide details regarding the ownership change..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="settings-btn-secondary"
                  style={{ width: 'auto', padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setMessage('Succession request submitted to System Administrator.');
                    setTimeout(() => setMessage(''), 3000);
                  }}
                  className="settings-save-btn"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </MyPageDashboardLayout>
  );
}