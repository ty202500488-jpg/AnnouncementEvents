import { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';
import '../styles/Profile.css';
import '../styles/Settings.css';

export default function StaffSettings() {
  const [settings, setSettings] = useState({
    newCampusAnnouncements: true,
    urgentAnnouncements: true,
    upcomingEvents: true,
    eventRegistrationReminders: true,
    followedPagesNotifications: true,
    darkMode: false,
    defaultFeedFilter: 'all',
    notificationDelivery: 'instant',
  });

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch settings from PostgreSQL backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const staffId = localStorage.getItem('staff_id') || '2024-STAFF01';
      try {
        const res = await fetch(`/api/settings?staff_id=${staffId}`);
        const data = await res.json();
        
        if (res.ok && data.settings) {
          setSettings(data.settings);
        } else {
          const storedSettings = localStorage.getItem('staffSettings');
          if (storedSettings) setSettings(JSON.parse(storedSettings));
        }
      } catch (err) {
        console.error('Database connection failed, loading local settings:', err);
        const storedSettings = localStorage.getItem('staffSettings');
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
    const staffId = localStorage.getItem('staff_id') || '2024-STAFF01';

    try {
      // 1. Save to PostgreSQL database
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, settings }),
      });

      if (!res.ok) throw new Error('Failed to persist in database');

      // 2. Cache in localStorage
      localStorage.setItem('staffSettings', JSON.stringify(settings));

      setMessage('Settings successfully updated and saved to server!');
      setErrorMessage('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      localStorage.setItem('staffSettings', JSON.stringify(settings));
      setMessage('Settings saved locally.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    if (window.confirm('Are you sure you want to log out of all other active sessions?')) {
      const staffId = localStorage.getItem('staff_id') || '2024-STAFF01';
      try {
        await fetch('/api/logout-other-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staff_id: staffId }),
        });

        setMessage('Successfully logged out of all other active sessions.');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error('Failed to logout sessions:', err);
        setErrorMessage('Failed to revoke sessions. Please try again.');
      }
    }
  };

  const handleDeleteAccountRequest = () => {
    if (window.confirm('Are you sure you want to request account deactivation or deletion? An administrator will review your request.')) {
      setMessage('Deactivation request sent to administration.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <StaffDashboardLayout activePage="settings">
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
              <h3>Settings & Preferences</h3>
              <p>Manage your notifications, feed appearance, and session security.</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            
            {/* SECTION 1: NOTIFICATIONS */}
            <div className="settings-section-group" style={{ paddingTop: 0 }}>
              <h4 className="settings-section-title">Notifications</h4>
              <p className="settings-section-desc">Control which updates appear.</p>
              
              <div className="space-y-1">
                <label className="settings-toggle-row">
                  <span>New campus announcements</span>
                  <input 
                    type="checkbox" 
                    name="newCampusAnnouncements" 
                    checked={settings.newCampusAnnouncements} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>

                <label className="settings-toggle-row">
                  <span>Urgent announcements</span>
                  <input 
                    type="checkbox" 
                    name="urgentAnnouncements" 
                    checked={settings.urgentAnnouncements} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>

                <label className="settings-toggle-row">
                  <span>Upcoming events</span>
                  <input 
                    type="checkbox" 
                    name="upcomingEvents" 
                    checked={settings.upcomingEvents} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>

                <label className="settings-toggle-row">
                  <span>Event registration reminders</span>
                  <input 
                    type="checkbox" 
                    name="eventRegistrationReminders" 
                    checked={settings.eventRegistrationReminders} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>

                <label className="settings-toggle-row">
                  <span>Notifications for followed pages</span>
                  <input 
                    type="checkbox" 
                    name="followedPagesNotifications" 
                    checked={settings.followedPagesNotifications} 
                    onChange={handleToggle} 
                    className="settings-toggle-input"
                  />
                </label>
              </div>
            </div>

            {/* SECTION 2: PREFERENCES */}
            <div className="settings-section-group">
              <h4 className="settings-section-title">Preferences</h4>
              <p className="settings-section-desc">Customize the experience.</p>
              
              <div className="space-y-3">
                <div className="settings-form-group">
                  <label>Default announcement feed filters</label>
                  <select 
                    name="defaultFeedFilter" 
                    value={settings.defaultFeedFilter} 
                    onChange={handleToggle} 
                    className="settings-select-input"
                  >
                    <option value="all">All Announcements</option>
                    <option value="university">University-Wide Only</option>
                    <option value="followed">Followed Pages Only</option>
                  </select>
                </div>

                <div className="settings-form-group">
                  <label>Preferred notification delivery</label>
                  <select 
                    name="notificationDelivery" 
                    value={settings.notificationDelivery} 
                    onChange={handleToggle} 
                    className="settings-select-input"
                  >
                    <option value="instant">Instant (Real-time)</option>
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Summary</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: SECURITY & ACCOUNT CONTROL */}
            <div className="settings-section-group">
              <h4 className="settings-section-title">Security & Account Control</h4>
              <p className="settings-section-desc">Manage your active sessions and account actions.</p>
              
              <div className="settings-action-stack">
                <button 
                  type="button" 
                  onClick={handleLogoutAllSessions} 
                  className="settings-btn-secondary"
                >
                  <span>Log out of all other sessions</span>
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>

                <button 
                  type="button" 
                  onClick={handleDeleteAccountRequest} 
                  className="settings-btn-danger"
                >
                  <span>Delete or deactivate account request</span>
                  <i className="fa-solid fa-user-slash"></i>
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
      </main>
    </StaffDashboardLayout>
  );
}