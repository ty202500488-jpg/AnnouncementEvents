import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/StudentDashboard.css';
import '../../styles/Notification.css';

export default function MyPageNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const token = localStorage.getItem('token');

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mypage/notifications', {
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
      console.error('Failed to fetch MyPage notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notifId, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/notifications/${notifId}/read`, {
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
      const response = await fetch('http://localhost:5000/api/mypage/notifications/read-all', {
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

  const handleToggleArchive = async (notifId, currentArchived, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/notifications/${notifId}/archive`, {
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

  const handleDelete = async (notifId, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:5000/api/mypage/notifications/${notifId}`, {
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

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.url) {
      navigate(notif.url);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read && !n.is_archived).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read && !n.is_archived;
    if (filter === 'archived') return n.is_archived;
    return !n.is_archived;
  });

  return (
    <MyPageDashboardLayout activeTab="notifications">
      <main 
        className="lg-col-6 hide-scrollbar" 
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2rem'
        }}
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Compact Header */}
        <div 
          className="flex items-center justify-between" 
          style={{ 
            marginBottom: '1.25rem', 
            paddingBottom: '0.625rem', 
            borderBottom: '1px solid var(--slate-200, #e2e8f0)' 
          }}
        >
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.0625rem', margin: 0 }}>MyPage Notifications</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>
              Stay updated with page registrations, status changes, and announcements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--brand-200, #bfdbfe)',
                  color: 'var(--brand-600, #2563eb)',
                  padding: '0.3rem 0.625rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Mark all as read
              </button>
            )}

            {/* Filter Pills */}
            <div className="flex items-center gap-1" style={{ backgroundColor: '#ffffff', padding: '0.2rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
              {['all', 'unread'].map((type) => {
                const isActive = filter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilter(type)}
                    style={{
                      padding: '0.3rem 0.625rem',
                      borderRadius: '0.375rem',
                      backgroundColor: isActive ? 'var(--brand-600, #2563eb)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--slate-600)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{type}</span>
                    {type === 'unread' && unreadCount > 0 && (
                      <span style={{ 
                        backgroundColor: isActive ? '#ffffff' : 'var(--brand-600, #2563eb)', 
                        color: isActive ? 'var(--brand-600, #2563eb)' : '#ffffff', 
                        fontSize: '9px', 
                        fontWeight: 700, 
                        padding: '1px 5px', 
                        borderRadius: '9999px' 
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem 1rem' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--brand-600)' }}></i>
            <p style={{ fontSize: '0.875rem' }}>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-regular fa-bell-slash" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No new notifications available.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredNotifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`notif-item-card ${notif.is_read ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(notif)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1.125rem',
                  borderRadius: '0.625rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  cursor: notif.url ? 'pointer' : 'default'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`notif-icon-box ${notif.type === 'event' || notif.type === 'registration' ? 'event' : 'announcement'}`}>
                    <i className={
                      notif.type === 'registration' ? 'fa-solid fa-user-plus' :
                      notif.type === 'event' ? 'fa-regular fa-calendar-days' : 
                      'fa-solid fa-bullhorn'
                    }></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="notif-page-name">{notif.page_name || 'MyPage Alert'}</span>
                      <span className="notif-type-tag">{notif.type || 'system'}</span>
                    </div>
                    <p className="notif-message-text" style={{ marginTop: '0.25rem', color: 'var(--slate-700)', fontSize: '0.875rem' }}>{notif.message}</p>
                    <span className="notif-time-stamp" style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem', display: 'inline-block' }}>
                      {notif.created_at ? new Date(notif.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {!notif.is_read && (
                    <button 
                      type="button"
                      onClick={(e) => handleMarkAsRead(notif.id, e)} 
                      title="Mark as read"
                      style={{ background: 'transparent', border: 'none', color: 'var(--slate-400)', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <i className="fa-regular fa-circle-check"></i>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleToggleArchive(notif.id, notif.is_archived, e)}
                    title={notif.is_archived ? 'Unarchive' : 'Archive'}
                    style={{ background: 'transparent', border: 'none', color: 'var(--slate-400)', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <i className={`fa-solid ${notif.is_archived ? 'fa-box-open' : 'fa-box-archive'}`}></i>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(notif.id, e)}
                    title="Delete"
                    style={{ background: 'transparent', border: 'none', color: 'var(--rose-600, #e11d48)', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <i className="fa-regular fa-trash-can"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </MyPageDashboardLayout>
  );
}