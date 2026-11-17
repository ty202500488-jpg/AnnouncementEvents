import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../pages/styles/StudentDashboard.css';
import useSessionGuard from './useSessionGuard';
import UniversityWideSpotlight from './UniversityWideSpotlight';
import { usePortalSearch } from '../../utils/usePortalSearch';
import {
  PortalNavbar,
  DepartmentPagesSidebarList,
  buildPortalProfileMenuItems,
  getInitials,
} from './PortalShellElements';

export default function DashboardLayout({ children, activePage }) {
  const navigate = useNavigate();
  useSessionGuard();

  const [user, setUser] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    program: 'BS Computer Science'
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // MOBILE MENU STATE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // SEARCH BAR STATE & LOGIC
  const {
    searchQuery,
    filterCategory,
    searchResults,
    isSearching,
    showDropdown,
    searchContainerRef,
    handleSearchChange,
    handleToggleFilter: toggleFilterCategory,
    handleSelectSearchResult,
  } = usePortalSearch('student');

  // PROFILE DROPDOWN STATE & LOGIC
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  // NOTIFICATIONS STATE & LOGIC
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);

  const unreadNotifCount = notifications.filter(n => !n.is_read && !n.is_archived).length;

  const loadUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || parsed.firstName || 'Alex',
          lastName: parsed.last_name || parsed.lastName || 'Rivera',
          program: parsed.program_name || parsed.course || parsed.program || 'BS Computer Science'
        });
      } catch (err) {
        console.error('Failed to parse user from localStorage', err);
      }
    }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadingNotifs(false);
      return;
    }

    try {
      const response = await fetch('/api/student/notifications', {
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
      console.error('Failed to fetch student notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    loadUserData();

    const fetchApprovedPages = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/approved-pages', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const data = await response.json();
        if (response.ok && data.pages) {
          setDepartments(data.pages);
        }
      } catch (err) {
        console.error('Failed to fetch approved pages:', err);
      } finally {
        setLoadingDepts(false);
      }
    };

    fetchApprovedPages();
    fetchNotifications();

    const pollId = setInterval(fetchNotifications, 30000);
    const onNotificationsUpdated = () => fetchNotifications();
    window.addEventListener('notifications-updated', onNotificationsUpdated);
    window.addEventListener('focus', onNotificationsUpdated);

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

  const handleMarkAllAsRead = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/student/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        window.dispatchEvent(new CustomEvent('notifications-updated'));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(`/api/student/notifications/${notif.id}/read`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          setNotifications(prev =>
            prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
          );
          window.dispatchEvent(new CustomEvent('notifications-updated'));
        }
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    setShowNotifDropdown(false);
    if (notif.url) {
      navigate(notif.url);
    } else {
      navigate('/student/notifications');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const userInitials = getInitials(`${user.firstName} ${user.lastName}`, 'ST');

  return (
    <div className="student-dashboard-wrapper fb-shell-layout">
      <style>{`
        @media (min-width: 1024px) {
          .mobile-bottom-nav {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .user-program {
            display: none !important;
          }
          .search-input {
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      {/* TOP NAVBAR */}
      <PortalNavbar
        homeHref="/student/dashboard"
        homeAriaLabel="CRIMSON Student Home"
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filterCategory={filterCategory}
        onToggleFilter={toggleFilterCategory}
        searchPlaceholder={`Search ${filterCategory === 'all' ? 'Announcements, Events...' : filterCategory + '...'}`}
        searchResults={searchResults}
        isSearching={isSearching}
        showSearchDropdown={showDropdown}
        onSelectSearchResult={handleSelectSearchResult}
        searchContainerRef={searchContainerRef}
        showQrButton={true}
        qrHref="/student/attendance/check-in/scan"
        notifications={notifications}
        loadingNotifs={loadingNotifs}
        unreadNotifCount={unreadNotifCount}
        showNotifDropdown={showNotifDropdown}
        onToggleNotifDropdown={() => {
          const next = !showNotifDropdown;
          setShowNotifDropdown(next);
          if (next) fetchNotifications();
        }}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNotifClick={handleNotifClick}
        notifDropdownRef={notifDropdownRef}
        profileTitle={`${user.firstName} ${user.lastName}`}
        profileSubtitle={user.program}
        profileInitials={userInitials}
        showProfileDropdown={showProfileDropdown}
        onToggleProfileDropdown={() => setShowProfileDropdown(!showProfileDropdown)}
        onCloseProfileDropdown={() => setShowProfileDropdown(false)}
        profileDropdownRef={profileDropdownRef}
        profileMenuItems={buildPortalProfileMenuItems({ role: 'student' })}
        onLogout={handleLogout}
      />

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 45
          }}
        ></div>
      )}

      {/* MAIN CONTAINER GRID */}
      <div className="main-container">

        {/* LEFT SIDEBAR */}
        <aside 
          id="leftSidebar" 
          className={`lg-col-3 space-y-6 ${isMobileMenuOpen ? 'mobile-sidebar-active' : 'hidden lg-block'}`}
          style={isMobileMenuOpen ? {
            display: 'block',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '280px',
            height: '100vh',
            zIndex: 50,
            backgroundColor: '#ffffff',
            boxShadow: '10px 0 25px rgba(0, 0, 0, 0.15)',
            overflowY: 'auto',
            padding: '1rem',
            transition: 'transform 0.3s ease-in-out'
          } : {}}
        >
          <div className="card space-y-4">
            
            <div className="fb-sidebar-profile">
              <div className="fb-sidebar-profile-inner">
                <span className="fb-avatar-badge" aria-hidden="true">{userInitials}</span>
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, color: 'var(--slate-900)', fontSize: '0.875rem', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.firstName} {user.lastName}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--slate-600)', display: 'block', marginTop: '2px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.program}
                  </span>
                </div>
              </div>
              {isMobileMenuOpen && (
                <button 
                  type="button" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ color: 'var(--slate-600)', background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer' }}
                  aria-label="Close navigation menu"
                >
                  <i className="fa-solid fa-xmark" style={{ fontSize: '1.2rem' }}></i>
                </button>
              )}
            </div>

            <div className="fb-nav-section">
              <div className="nav-group-title">Main</div>
              <nav className="space-y-1">
                <a href="/student/dashboard" className={`nav-item ${activePage === 'home' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-house nav-icon"></i>
                    <span>Home</span>
                  </div>
                </a>
                <a href="/student/announcements" className={`nav-item ${activePage === 'announcements' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bullhorn nav-icon"></i>
                    <span>Announcements</span>
                  </div>
                </a>
                <a href="/student/events" className={`nav-item ${activePage === 'events' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
              </nav>
            </div>

            <div className="fb-nav-section">
              <div className="nav-group-title">Personal</div>
              <nav className="space-y-1">
                <a href="/student/profile" className={`nav-item ${activePage === 'profile' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-user nav-icon"></i>
                    <span>Profile</span>
                  </div>
                </a>
                <a href="/student/notifications" className={`nav-item ${activePage === 'notifications' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bell nav-icon"></i>
                    <span>Notifications</span>
                  </div>
                  {unreadNotifCount > 0 && (
                    <span style={{ backgroundColor: '#881337', color: '#ffffff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '9999px' }}>
                      {unreadNotifCount}
                    </span>
                  )}
                </a>
                <a href="/student/my-events" className={`nav-item ${activePage === 'my-events' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-calendar-days nav-icon"></i>
                    <span>My Events</span>
                  </div>
                </a>
              </nav>
            </div>

            <div className="fb-nav-section">
              <div className="nav-group-title">System</div>
              <nav className="space-y-1">
                <a href="/student/settings" className={`nav-item ${activePage === 'settings' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-gear nav-icon"></i>
                    <span>Settings</span>
                  </div>
                </a>
              </nav>
            </div>
          </div>
        </aside>

        {/* DYNAMIC CENTER CONTENT */}
        <div className="fb-center-track">
          <div className="mobile-spotlight-slot">
            <UniversityWideSpotlight role="student" variant="mobile" />
          </div>
          {children}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="lg-col-3 space-y-6 hidden lg-block">
          <UniversityWideSpotlight role="student" variant="desktop" />
          <DepartmentPagesSidebarList
            departments={departments}
            loadingDepts={loadingDepts}
            pageBasePath="/student/page"
          />
        </aside>

      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav 
        className="mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '56px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--slate-200, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 40,
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
        }}
      >
        <a 
          href="/student/dashboard" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: activePage === 'home' ? 700 : 500,
            color: activePage === 'home' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-house" style={{ fontSize: '1.1rem' }}></i>
        </a>

        <a 
          href="/student/announcements" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: activePage === 'announcements' ? 700 : 500,
            color: activePage === 'announcements' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-bullhorn" style={{ fontSize: '1.1rem' }}></i>
        </a>

        <a 
          href="/student/events" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: activePage === 'events' ? 700 : 500,
            color: activePage === 'events' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-calendar-days" style={{ fontSize: '1.1rem' }}></i>
        </a>

        <a 
          href="/student/profile" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: activePage === 'profile' ? 700 : 500,
            color: activePage === 'profile' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-user" style={{ fontSize: '1.1rem' }}></i>
        </a>
      </nav>
    </div>
  );
}