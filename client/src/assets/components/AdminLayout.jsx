import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo.jpg';
import { PostPageAvatar, getInitials } from './PortalShellElements';
import { formatPostTimestamp } from '../../utils/dateUtils';
import { formatNotificationDisplay } from '../../utils/notificationUtils';
import '../../pages/styles/AdminDashboard.css';

const AdminLayout = ({ children, headerCenter = null, fullBleed = false }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile menu toggle state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Admin Official Page State
  const [user, setUser] = useState({
    displayName: 'Western Mindanao State University',
    subtitle: 'System Administrator',
    avatarUrl: ''
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

  const loadAdminIdentity = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser((prev) => ({
          displayName: parsed.page_name || prev.displayName || 'Western Mindanao State University',
          subtitle: 'System Administrator',
          avatarUrl: parsed.avatar_url || prev.avatarUrl || ''
        }));
      } catch (err) {
        console.error('Failed to parse admin user data:', err);
      }
    }

    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/admin/official-page', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.page) {
            setUser({
              displayName: data.page.page_name || 'Western Mindanao State University',
              subtitle: 'System Administrator',
              avatarUrl: data.page.avatar_url || ''
            });
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    loadAdminIdentity();
    window.addEventListener('storage', loadAdminIdentity);

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
      window.removeEventListener('storage', loadAdminIdentity);
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
      title: 'Main Navigation',
      items: [
        { label: 'Overview', path: '/admin', aliases: ['/admin', '/admin/dashboard'], icon: 'fa-solid fa-chart-pie' },
        { label: 'Campus Feed', path: '/admin/content-feed', aliases: ['/admin/content-feed'], icon: 'fa-solid fa-newspaper' },
      ],
    },
    {
      title: 'Management',
      items: [
        { label: 'Post Approvals', path: '/admin/post-approval', aliases: ['/admin/post-approval', '/admin/posts', '/admin/moderation'], icon: 'fa-solid fa-file-circle-check' },
        { label: 'Page Management', path: '/admin/pages', aliases: ['/admin/pages'], icon: 'fa-solid fa-layer-group' },
        { label: 'User Management', path: '/admin/users', aliases: ['/admin/users'], icon: 'fa-solid fa-users' },
      ],
    },
    {
      title: 'Records & Analytics',
      items: [
        { label: 'Archives', path: '/admin/archives', aliases: ['/admin/archives'], icon: 'fa-solid fa-box-archive' },
        { label: 'Reports', path: '/admin/reports', aliases: ['/admin/reports'], icon: 'fa-solid fa-chart-line' },
        { label: 'Audit Logs', path: '/admin/audit-logs', aliases: ['/admin/audit-logs'], icon: 'fa-solid fa-clipboard-list' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { label: 'My Profile', path: '/admin/profile', aliases: ['/admin/profile', '/admin/mypage/profile'], icon: 'fa-solid fa-user' },
        { label: 'System Settings', path: '/admin/settings', aliases: ['/admin/settings'], icon: 'fa-solid fa-sliders' },
      ],
    },
  ];

  const adminInitials = getInitials(user.displayName, 'WM');

  return (
    <div className="admin-dashboard-container">
      {/* ==================== HEADER BAR ==================== */}
      <header className="header">
        <div className="admin-header-inner">
          {/* Left Brand Logo + Mobile Sidebar Toggle */}
          <div className="admin-header-brand">
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
            </button>
            <Link to="/admin" className="admin-brand-link" aria-label="CRIMSON Admin Home">
              <img
                src={logo}
                alt="WMSU Crimson Logo"
                style={{ height: '48px', width: '48px', objectFit: 'contain', borderRadius: '50%' }}
              />
              <span
                className="admin-brand-wordmark"
                style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 800, letterSpacing: '0.05em' }}
              >
                CRIM<span className="admin-brand-accent">SON</span>
              </span>
            </Link>
          </div>

          {headerCenter && (
            <div className="admin-header-center">
              {headerCenter}
            </div>
          )}

          {/* Right Header Actions */}
          <div className="header-right">
            {/* Notifications Dropdown */}
            <div ref={notifDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                className="bell-btn icon-btn"
                onClick={() => {
                  const next = !showNotifDropdown;
                  setShowNotifDropdown(next);
                  if (next) fetchAdminNotifications();
                }}
                aria-label="Notifications"
              >
                <i className="fa-solid fa-bell" style={{ fontSize: '0.95rem' }}></i>
                {unreadNotifCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #cbd5e1' }}>
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
                      notifications.filter(n => !n.is_archived).map(notif => {
                        const { pageName, title: displayTitle, summary } = formatNotificationDisplay(notif);
                        return (
                        <div
                          key={notif.id}
                          onClick={() => handleAdminNotifClick(notif)}
                          style={{
                            padding: '0.625rem 0.75rem',
                            borderRadius: '0.5rem',
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: !notif.is_read ? '#fff5f6' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                            <PostPageAvatar
                              avatarUrl={notif.page_avatar_url}
                              label={pageName}
                              fallbackCode={notif.page_code}
                              size="2rem"
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: !notif.is_read ? 700 : 600, fontSize: '0.8125rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {pageName}
                                </span>
                                <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {formatPostTimestamp(notif.created_at)}
                                </span>
                              </div>
                              {displayTitle && (
                                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {displayTitle}
                                </div>
                              )}
                              {summary && (
                                <p style={{ fontSize: '0.725rem', color: '#475569', margin: '0.1rem 0 0 0', lineHeight: 1.35 }}>
                                  {summary}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Component */}
            <div ref={profileDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                className="admin-profile-trigger"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                aria-expanded={showProfileDropdown}
                aria-label="Account menu"
              >
                <span className="admin-avatar-badge" aria-hidden="true" style={{ overflow: 'hidden' }}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    adminInitials
                  )}
                </span>
                <div className="profile-details-text" style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8125rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.subtitle}
                  </div>
                </div>
                <i className="fa-solid fa-chevron-down" style={{ color: '#94a3b8', fontSize: '10px', flexShrink: 0 }}></i>
              </button>

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
                      {user.displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {user.subtitle}
                    </div>
                  </div>

                  <Link to="/admin/profile" onClick={() => setShowProfileDropdown(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#334155', textDecoration: 'none' }}>
                    <i className="fa-solid fa-user" style={{ width: '16px', color: '#64748b' }}></i> My Profile
                  </Link>

                  <Link to="/admin/settings" onClick={() => setShowProfileDropdown(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#334155', textDecoration: 'none' }}>
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
        {isMobileMenuOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* DOCKED CRIMSON SIDEBAR */}
        <aside className={`sidebar ${isMobileMenuOpen ? 'is-open' : ''}`} aria-label="Admin Navigation">
          <nav className="admin-sidebar-nav">
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
                          onClick={() => setIsMobileMenuOpen(false)}
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
          </nav>
        </aside>

        {/* MAIN VIEWPORT CANVAS */}
        <main className={`main-viewport ${fullBleed ? 'admin-main-fullbleed' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;