import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.jpg';
import '../../pages/styles/AdminDashboard.css';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile menu toggle state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Admin User State
  const [user, setUser] = useState({
    firstName: 'MISTO',
    lastName: 'Administrator',
    dept: 'Western Mindanao State University'
  });

  // Profile Dropdown State & Logic
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  // Notification State & Dropdown
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);

  const unreadNotifCount = notifications.filter(n => !n.is_read && !n.is_archived).length;

  const fetchAdminNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadingNotifs(false);
      return;
    }
    try {
      const response = await fetch('/api/admin/notifications', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.warn('Failed to fetch admin notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    // Load User Data from localStorage if present
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || parsed.firstName || 'MISTO',
          lastName: parsed.last_name || parsed.lastName || 'Administrator',
          dept: parsed.department || parsed.dept || 'Western Mindanao State University'
        });
      } catch (err) {
        console.error('Failed to parse admin user data:', err);
      }
    }

    fetchAdminNotifications();
    const pollId = setInterval(fetchAdminNotifications, 30000);
    const onNotificationsUpdated = () => fetchAdminNotifications();
    window.addEventListener('notifications-updated', onNotificationsUpdated);
    window.addEventListener('focus', onNotificationsUpdated);

    // Click outside listener for dropdowns
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(pollId);
      window.removeEventListener('notifications-updated', onNotificationsUpdated);
      window.removeEventListener('focus', onNotificationsUpdated);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMarkAllAdminRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('/api/admin/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        window.dispatchEvent(new CustomEvent('notifications-updated'));
      }
    } catch (err) {
      console.warn('Failed to mark admin notifications as read:', err);
    }
  };

  const handleAdminNotifClick = async (notif) => {
    if (!notif.is_read) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch(`/api/admin/notifications/${notif.id}/read`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          });
          if (response.ok) {
            setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n)));
            window.dispatchEvent(new CustomEvent('notifications-updated'));
          }
        } catch (err) {
          console.warn('Failed to mark admin notification as read:', err);
        }
      }
    }
    setShowNotifDropdown(false);
    navigate(notif.url || '/admin/post-approval?tab=pending');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const navigationSections = [
    {
      title: 'Main Menu',
      items: [
        { label: 'Overview', path: '/admin', aliases: ['/admin', '/admin/dashboard'], icon: 'fa-solid fa-chart-pie' },
        { label: 'Announcements & Events', path: '/admin/content-feed', aliases: ['/admin/content-feed'], icon: 'fa-solid fa-newspaper' },
        { label: 'Post Approvals', path: '/admin/post-approval', aliases: ['/admin/post-approval', '/admin/posts', '/admin/moderation'], icon: 'fa-solid fa-file-circle-check' },
        { label: 'Page Management', path: '/admin/pages', aliases: ['/admin/pages'], icon: 'fa-solid fa-layer-group' },
        { label: 'User Management', path: '/admin/users', aliases: ['/admin/users'], icon: 'fa-solid fa-users' },
      ],
    },
    {
      title: 'Records & Analytics',
      items: [
        { label: 'Archives', path: '/admin/archives', aliases: ['/admin/archives'], icon: 'fa-solid fa-box-archive' },
        { label: 'Reports & Statistics', path: '/admin/reports', aliases: ['/admin/reports'], icon: 'fa-solid fa-chart-line' },
        { label: 'Audit Logs', path: '/admin/audit-logs', aliases: ['/admin/audit-logs'], icon: 'fa-solid fa-clipboard-list' },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { label: 'System Settings', path: '/admin/settings', aliases: ['/admin/settings'], icon: 'fa-solid fa-sliders' },
      ],
    },
  ];

  return (
    <div className="admin-dashboard-container">
      {/* ==================== HEADER BAR ==================== */}
      <header className="header" style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#ffffff', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.5rem 1rem' }}>
          
          {/* Left Logo / Mobile Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link to="/admin" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img 
                src={logo} 
                alt="WMSU Crimson Logo" 
                style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '50%' }} 
              />
            </Link>
          </div>

          {/* Right Header Actions */}
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* Notifications Dropdown */}
            <div ref={notifDropdownRef} style={{ position: 'relative' }}>
              <button 
                type="button"
                className="bell-btn icon-btn" 
                onClick={() => {
                  const next = !showNotifDropdown;
                  setShowNotifDropdown(next);
                  if (next) fetchAdminNotifications();
                }}
                aria-label="Notifications"
                style={{ position: 'relative', cursor: 'pointer', background: 'transparent', border: 'none' }}
              >
                <i className="fa-regular fa-bell" style={{ fontSize: '1.25rem' }}></i>
                {unreadNotifCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-4px',
                      backgroundColor: '#881337',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '9999px',
                      lineHeight: 1.3
                    }}
                  >
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: 0,
                    width: '320px',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--admin-slate-200, #e2e8f0)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                      Admin Notifications
                    </span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAdminRead}
                        style={{ background: 'none', border: 'none', color: '#881337', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {loadingNotifs ? (
                      <div style={{ padding: '1rem', fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'center' }}>
                        Loading notifications...
                      </div>
                    ) : notifications.filter(n => !n.is_archived).length === 0 ? (
                      <div style={{ padding: '1rem', fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'center' }}>
                        No pending notifications
                      </div>
                    ) : (
                      notifications.filter(n => !n.is_archived).map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleAdminNotifClick(notif)}
                          style={{
                            padding: '0.625rem 0.75rem',
                            borderRadius: '0.5rem',
                            backgroundColor: !notif.is_read ? '#fff5f6' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <span style={{ fontWeight: !notif.is_read ? 700 : 600, fontSize: '0.8125rem', color: '#1e293b', lineHeight: 1.25 }}>
                              {notif.title || 'Admin Alert'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0, lineHeight: 1.35 }}>
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Component */}
            <div ref={profileDropdownRef} style={{ position: 'relative' }}>
              <div 
                className="profile-info" 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
              >
                <div className="user-text-details" style={{ textAlign: 'right' }}>
                  <span className="user-name" style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="user-dept" style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                    {user.dept}
                  </span>
                </div>
                <i className="fa-solid fa-chevron-down dropdown-icon" style={{ fontSize: '10px', color: '#64748b' }}></i>
              </div>

              {showProfileDropdown && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: 0,
                    width: '200px',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {user.dept}
                    </div>
                  </div>

                  <Link to="/admin/settings" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#334155', textDecoration: 'none' }}>
                    <i className="fa-solid fa-sliders" style={{ width: '16px', color: '#64748b' }}></i> Settings
                  </Link>

                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                    <button 
                      onClick={handleLogout} 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#e11d48', background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-right-from-bracket" style={{ width: '16px' }}></i> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ==================== MAIN BODY LAYOUT ==================== */}
      <div className="app-container">
        {/* FLOATING BURGUNDY HOVER-EXPANDABLE SIDEBAR */}
        <aside className="sidebar">
          <div>
            {navigationSections.map((section, sectionIdx) => (
              <React.Fragment key={sectionIdx}>
                <div className="nav-section-title">{section.title}</div>
                <ul className="nav-list">
                  {section.items.map((item, itemIdx) => {
                    const isActive = item.aliases
                      ? item.aliases.includes(location.pathname)
                      : location.pathname === item.path;
                    return (
                      <li key={itemIdx}>
                        <Link
                          to={item.path}
                          className={`nav-item-link ${isActive ? 'active' : ''}`}
                        >
                          <div className="nav-item-content">
                            <i className={`${item.icon} nav-icon`}></i>
                            <span className="nav-item-text">{item.label}</span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </React.Fragment>
            ))}
          </div>
        </aside>

        {/* MAIN VIEWPORT CANVAS */}
        <main className="main-viewport">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;