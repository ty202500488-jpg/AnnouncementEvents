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
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;

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
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const navigationSections = [
    {
      title: 'Main Menu',
      items: [
        { label: 'Overview', path: '/admin', icon: 'fa-solid fa-chart-pie' },
        { label: 'Content Feed', path: '/admin/content-feed', icon: 'fa-solid fa-newspaper' },
        { label: 'User Management', path: '/admin/users', icon: 'fa-solid fa-users' },
        { label: 'Page Management', path: '/admin/pages', icon: 'fa-solid fa-layer-group' },
      ],
    },
    {
      title: 'Content Workflow',
      items: [
        { label: 'Post Approval', path: '/admin/post-approval', icon: 'fa-solid fa-file-circle-check' },
        { label: 'Content Moderation', path: '/admin/moderation', icon: 'fa-solid fa-shield-halved' },
        { label: 'Archives', path: '/admin/archives', icon: 'fa-solid fa-box-archive' },
      ],
    },
    {
      title: 'System Administration',
      items: [
        { label: 'Reports', path: '/admin/reports', icon: 'fa-solid fa-chart-line' },
        { label: 'Audit Logs', path: '/admin/audit-logs', icon: 'fa-solid fa-clipboard-list' },
        { label: 'Settings', path: '/admin/settings', icon: 'fa-solid fa-sliders' },
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
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                aria-label="Notifications"
                style={{ position: 'relative', cursor: 'pointer', background: 'transparent', border: 'none' }}
              >
                <i className="fa-regular fa-bell" style={{ fontSize: '1.25rem' }}></i>
                {unreadNotifCount > 0 && <span className="badge-dot"></span>}
              </button>

              {showNotifDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: 0,
                    width: '280px',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--admin-slate-200, #e2e8f0)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                    padding: '0.75rem'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    Admin Notifications
                  </div>
                  <div style={{ padding: '1rem', fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'center' }}>
                    No pending notifications
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
                    const isActive = location.pathname === item.path;
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