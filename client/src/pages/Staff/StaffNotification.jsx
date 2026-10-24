import { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StudentDashboard.css';
import '../styles/Notification.css';

export default function StaffNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'archived'

  const token = localStorage.getItem('token');

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:5000/users/notifications', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
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

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notifId) => {
    try {
      const response = await fetch(`http://localhost:5000/users/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('http://localhost:5000/users/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleToggleArchive = async (notifId, currentArchived) => {
    try {
      const response = await fetch(`http://localhost:5000/users/notifications/${notifId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_archived: !currentArchived })
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notifId ? { ...n, is_archived: !currentArchived } : n)
        );
      }
    } catch (err) {
      console.error('Failed to update archive state:', err);
    }
  };

  const handleDelete = async (notifId) => {
    try {
      const response = await fetch(`http://localhost:5000/users/notifications/${notifId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notifId));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read && !n.is_archived).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read && !n.is_archived;
    if (filter === 'archived') return n.is_archived;
    return !n.is_archived;
  });

  return (
    <StaffDashboardLayout activePage="notifications">
      <main className="lg-col-6 space-y-6">
        <div className="card" style={{ padding: '1.75rem', backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.1rem', margin: 0 }}>Notifications</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Stay updated with announcements and events.</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'transparent',
                  border: '1px solid #881337',
                  color: '#881337',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Tab Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === 'all' ? '#881337' : 'transparent',
                color: filter === 'all' ? '#ffffff' : '#64748b'
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === 'unread' ? '#881337' : 'transparent',
                color: filter === 'unread' ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              Unread
              {unreadCount > 0 && (
                <span style={{ backgroundColor: filter === 'unread' ? '#ffffff' : '#881337', color: filter === 'unread' ? '#881337' : '#ffffff', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '9999px' }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilter('archived')}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === 'archived' ? '#881337' : 'transparent',
                color: filter === 'archived' ? '#ffffff' : '#64748b'
              }}
            >
              Archived
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading notifications...</p>
          ) : filteredNotifications.length === 0 ? (
            <div className="notif-empty-state">
              <i className="fa-regular fa-bell-slash"></i>
              <p>No notifications found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`notif-item-card ${notif.is_read ? 'read' : 'unread'}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
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
                      <p className="notif-message-text">{notif.message}</p>
                      <span className="notif-time-stamp">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {!notif.is_read && (
                      <button 
                        onClick={() => handleMarkAsRead(notif.id)} 
                        title="Mark as read"
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}
                      >
                        <i className="fa-regular fa-circle-check"></i>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(notif.id, notif.is_archived)}
                      title={notif.is_archived ? 'Unarchive' : 'Archive'}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <i className={`fa-solid ${notif.is_archived ? 'fa-box-open' : 'fa-box-archive'}`}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(notif.id)}
                      title="Delete"
                      style={{ background: 'transparent', border: 'none', color: '#e11d48', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </StaffDashboardLayout>
  );
}