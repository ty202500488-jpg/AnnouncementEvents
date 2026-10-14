import { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StudentDashboard.css';
import '../styles/Notification.css';

export default function StaffNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch('http://localhost:5000/users/notifications', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok && data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notifId) => {
    try {
      await fetch(`http://localhost:5000/users/notifications/${notifId}/read`, {
        method: 'POST',
      });
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  return (
    <StaffDashboardLayout activePage="notifications">
      <main className="lg-col-6 space-y-6">
        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Staff Notifications</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Stay updated with announcements and events.</p>
            </div>
            <span className="notif-badge-count">{notifications.filter(n => !n.is_read).length} Unread</span>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <div className="notif-empty-state">
              <i className="fa-regular fa-bell-slash"></i>
              <p>No new notifications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`notif-item-card ${notif.is_read ? 'read' : 'unread'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`notif-icon-box ${notif.type === 'event' ? 'event' : 'announcement'}`}>
                      <i className={notif.type === 'event' ? 'fa-regular fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="notif-page-name">{notif.page_name || 'System Notice'}</span>
                        <span className="notif-type-tag">{notif.type || 'announcement'}</span>
                      </div>
                      <p className="notif-message-text">
                        {notif.message}
                      </p>
                      <span className="notif-time-stamp">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {!notif.is_read && (
                    <button 
                      onClick={() => handleMarkAsRead(notif.id)} 
                      className="notif-mark-read-btn"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </StaffDashboardLayout>
  );
}