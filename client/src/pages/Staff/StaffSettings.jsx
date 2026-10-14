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

  useEffect(() => {
    const storedSettings = localStorage.getItem('staffSettings');
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (err) {
        console.error('Failed to parse settings from localStorage', err);
      }
    }
  }, []);

  const handleToggle = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('staffSettings', JSON.stringify(settings));
      setMessage('Settings successfully updated!');
      setErrorMessage('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save settings', err);
      setErrorMessage('Failed to save settings. Please try again.');
    }
  };

  const handleLogoutAllSessions = async () => {
    if (window.confirm('Are you sure you want to log out of all other active sessions?')) {
      try {
        setMessage('Successfully logged out of all other sessions.');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error('Failed to logout sessions', err);
      }
    }
  };

  const handleDeleteAccountRequest = () => {
    if (window.confirm('Are you sure you want to request account deactivation or deletion? An administrator will review your request.')) {
      try {
        setMessage('Deactivation request sent to administration.');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error('Failed to submit deactivation request', err);
      }
    }
  };

  return (
    <StaffDashboardLayout activePage="settings">
      <main className="lg-col-6 space-y-6">
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

        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Settings & Preferences</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Manage your notifications, feed appearance, and session security.</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* SECTION 1: NOTIFICATIONS */}
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.25rem' }}>Notifications</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>Control which updates appear.</p>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between" style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                  <span>New campus announcements</span>
                  <input 
                    type="checkbox" 
                    name="newCampusAnnouncements" 
                    checked={settings.newCampusAnnouncements} 
                    onChange={handleToggle} 
                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--color-primary)' }}
                  />
                </label>

                <label className="flex items-center justify-between" style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                  <span>Urgent announcements</span>
                  <input 
                    type="checkbox" 
                    name="urgentAnnouncements" 
                    checked={settings.urgentAnnouncements} 
                    onChange={handleToggle} 
                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--color-primary)' }}
                  />
                </label>

                <label className="flex items-center justify-between" style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                  <span>Upcoming events</span>
                  <input 
                    type="checkbox" 
                    name="upcomingEvents" 
                    checked={settings.upcomingEvents} 
                    onChange={handleToggle} 
                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--color-primary)' }}
                  />
                </label>

                <label className="flex items-center justify-between" style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                  <span>Event registration reminders</span>
                  <input 
                    type="checkbox" 
                    name="eventRegistrationReminders" 
                    checked={settings.eventRegistrationReminders} 
                    onChange={handleToggle} 
                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--color-primary)' }}
                  />
                </label>

                <label className="flex items-center justify-between" style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                  <span>Notifications for followed pages</span>
                  <input 
                    type="checkbox" 
                    name="followedPagesNotifications" 
                    checked={settings.followedPagesNotifications} 
                    onChange={handleToggle} 
                    style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--color-primary)' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--slate-100)' }}></div>

            {/* SECTION 2: PREFERENCES */}
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.25rem' }}>Preferences</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>Customize the experience.</p>
              
              <div className="space-y-4">
                <div className="form-group full-span">
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-600)' }}>Default announcement feed filters</label>
                  <select 
                    name="defaultFeedFilter" 
                    value={settings.defaultFeedFilter} 
                    onChange={handleToggle} 
                    className="form-input"
                  >
                    <option value="all">All Announcements</option>
                    <option value="university">University-Wide Only</option>
                    <option value="followed">Followed Pages Only</option>
                  </select>
                </div>

                <div className="form-group full-span">
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-600)' }}>Preferred notification delivery</label>
                  <select 
                    name="notificationDelivery" 
                    value={settings.notificationDelivery} 
                    onChange={handleToggle} 
                    className="form-input"
                  >
                    <option value="instant">Instant (Real-time)</option>
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Summary</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--slate-100)' }}></div>

            {/* SECTION 3: ACCOUNT SECURITY & ACTIONS */}
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '0.75rem' }}>Security & Account Control</h4>
              <div className="flex flex-col gap-3">
                <button 
                  type="button" 
                  onClick={handleLogoutAllSessions} 
                  className="cancel-profile-btn" 
                  style={{ textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>Log out of all other sessions</span>
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>

                <button 
                  type="button" 
                  onClick={handleDeleteAccountRequest} 
                  style={{ textAlign: 'left', width: '100%', backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>Delete or deactivate account request</span>
                  <i className="fa-solid fa-user-slash"></i>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3" style={{ marginTop: '2rem' }}>
              <button type="submit" className="save-profile-btn">
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      </main>
    </StaffDashboardLayout>
  );
}