import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../pages/styles/StudentDashboard.css';
import '../../pages/styles/MyPageDashboard.css';
import useSessionGuard from './useSessionGuard';
import UniversityWideSpotlight from './UniversityWideSpotlight';
import { usePortalSearch } from '../../utils/usePortalSearch';
import {
  PortalNavbar,
  DepartmentPagesSidebarList,
  buildPortalProfileMenuItems,
  getInitials,
} from './PortalShellElements';

export default function MyPageDashboardLayout({ children, activeTab, onTabChange, onSwitchToStaffDashboard }) {
  const navigate = useNavigate();
  useSessionGuard();

  const [user, setUser] = useState({
    firstName: 'Charm',
    lastName: 'Lagare',
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
  } = usePortalSearch('mypage');

  // PROFILE DROPDOWN STATE & LOGIC
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  // NOTIFICATIONS DROPDOWN STATE & LOGIC
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  // State for page info
  const [pageInfo, setPageInfo] = useState({
    exists: false,
    status: 'none',
    name: 'College Of Computing Studies',
    subtitle: 'Academic College'
  });

  const unreadNotifCount = notifications.filter(n => !n.is_read && !n.is_archived).length;

  const loadUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || 'Charm',
          lastName: parsed.last_name || 'Lagare',
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
      const response = await fetch('/api/mypage/notifications', {
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

    const fetchUserPageStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/my-page-status', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          }
        });
        const data = await response.json();
        if (response.ok) {
          setPageInfo({
            exists: data.exists || false,
            status: data.status || 'none',
            name: data.pageName || 'College Of Computing Studies',
            subtitle: data.category || 'Academic College'
          });
        }
      } catch (err) {
        console.error('Failed to fetch user page status:', err);
      }
    };

    fetchApprovedPages();
    fetchUserPageStatus();
    fetchNotifications();

    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('notifications-updated', fetchNotifications);
    window.addEventListener('focus', fetchNotifications);
    const notifInterval = setInterval(fetchNotifications, 30000);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('notifications-updated', fetchNotifications);
      window.removeEventListener('focus', fetchNotifications);
      clearInterval(notifInterval);
    };
  }, []);

  const handleMarkAllAsRead = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/mypage/notifications/read-all', {
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
        const response = await fetch(`/api/mypage/notifications/${notif.id}/read`, {
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
    }
  };

  const handleNavigation = (tab) => {
    setIsMobileMenuOpen(false);
    if (onTabChange) {
      onTabChange(tab);
    }
    
    switch (tab) {
      case 'overview':
        navigate('/staff/mypage/dashboard');
        break;
      case 'profile':
        navigate('/staff/mypage/profile');
        break;
      case 'notifications':
        navigate('/staff/mypage/notifications');
        break;
      case 'announcements':
        navigate('/staff/mypage/announcements');
        break;
      case 'events':
        navigate('/staff/mypage/events');
        break;
      case 'registrations':
        navigate('/staff/mypage/registrations');
        break;
      case 'attendance':
        navigate('/staff/mypage/attendance');
        break;
      case 'settings':
        navigate('/staff/mypage/settings');
        break;
      default:
        break;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const pageInitials = getInitials(pageInfo.name, 'MP');

  const myPageProfileMenuItems = buildPortalProfileMenuItems({
    role: 'staff',
    hasApprovedPage: true,
    swapDashboardHref: '/staff/dashboard',
    swapTargetName: `${user.firstName} ${user.lastName}`.trim() || 'Staff Dashboard',
    swapTargetInitials: getInitials(`${user.firstName} ${user.lastName}`, 'ST'),
    onSwapDashboard: () => {
      if (onSwitchToStaffDashboard) onSwitchToStaffDashboard();
      else navigate('/staff/dashboard');
    },
  });

  return (
    <div className="staff-dashboard staff-dashboard-wrapper student-dashboard-wrapper fb-shell-layout mypage-shell">
      <style>{`
        @media (min-width: 1024px) {
          .mobile-bottom-nav {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .profile-details-text {
            display: none !important;
          }
        }
      `}</style>

      {/* TOP NAVBAR */}
      <PortalNavbar
        homeHref="/staff/mypage/dashboard"
        homeAriaLabel="CRIMSON MyPage Home"
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filterCategory={filterCategory}
        onToggleFilter={toggleFilterCategory}
        searchPlaceholder={`Search ${filterCategory === 'all' ? 'Announcement, Events, Departments...' : filterCategory + '...'}`}
        searchResults={searchResults}
        isSearching={isSearching}
        showSearchDropdown={showDropdown}
        onSelectSearchResult={handleSelectSearchResult}
        searchContainerRef={searchContainerRef}
        showQrButton={true}
        qrHref="/staff/attendance/check-in/scan"
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
        profileTitle={pageInfo.name}
        profileSubtitle={pageInfo.subtitle}
        profileInitials={pageInitials}
        profileHref="/staff/mypage/profile"
        showProfileDropdown={showProfileDropdown}
        onToggleProfileDropdown={() => setShowProfileDropdown(!showProfileDropdown)}
        onCloseProfileDropdown={() => setShowProfileDropdown(false)}
        profileDropdownRef={profileDropdownRef}
        profileMenuItems={myPageProfileMenuItems}
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
                <span className="fb-avatar-badge" aria-hidden="true">{pageInitials}</span>
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, color: 'var(--slate-900)', fontSize: '0.875rem', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pageInfo.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--slate-600)', display: 'block', marginTop: '2px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pageInfo.subtitle}
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
                <a 
                  href="/staff/mypage/dashboard" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('overview'); }}
                  className={`nav-item ${activeTab === 'overview' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-house nav-icon"></i>
                    <span>Home</span>
                  </div>
                </a>
                <a 
                  href="/staff/mypage/announcements" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('announcements'); }}
                  className={`nav-item ${activeTab === 'announcements' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bullhorn nav-icon"></i>
                    <span>Announcements</span>
                  </div>
                </a>
                <a 
                  href="/staff/mypage/events" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('events'); }}
                  className={`nav-item ${activeTab === 'events' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
              </nav>
            </div>

            <div className="fb-nav-section">
              <div className="nav-group-title">Management</div>
              <nav className="space-y-1">
                <a 
                  href="/staff/mypage/registrations" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('registrations'); }}
                  className={`nav-item ${activeTab === 'registrations' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-users-rectangle nav-icon"></i>
                    <span>Registrations</span>
                  </div>
                </a>
                <a 
                  href="/staff/mypage/attendance" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('attendance'); }}
                  className={`nav-item ${activeTab === 'attendance' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-clipboard-user nav-icon"></i>
                    <span>Attendance</span>
                  </div>
                </a>
                <a 
                  href="/staff/mypage/notifications" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('notifications'); }}
                  className={`nav-item ${activeTab === 'notifications' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bell nav-icon"></i>
                    <span>Notifications</span>
                  </div>
                  {unreadNotifCount > 0 && (
                    <span 
                      style={{
                        backgroundColor: '#881337',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '9999px'
                      }}
                    >
                      {unreadNotifCount}
                    </span>
                  )}
                </a>
                <a 
                  href="/staff/mypage/profile" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('profile'); }}
                  className={`nav-item ${activeTab === 'profile' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-id-badge nav-icon"></i>
                    <span>Page Profile</span>
                  </div>
                </a>
              </nav>
            </div>

            <div className="fb-nav-section">
              <div className="nav-group-title">System</div>
              <nav className="space-y-1">
                <a 
                  href="/staff/mypage/settings"
                  onClick={(e) => { e.preventDefault(); handleNavigation('settings'); }}
                  className={`nav-item ${activeTab === 'settings' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-gear nav-icon"></i>
                    <span>Settings</span>
                  </div>
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="nav-item nav-item-logout"
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-right-from-bracket nav-icon"></i>
                    <span>Logout</span>
                  </div>
                </button>
              </nav>
            </div>
          </div>
        </aside>

        {/* DYNAMIC CENTER CONTENT */}
        <div className="fb-center-track">
          <div className="mobile-spotlight-slot">
            <UniversityWideSpotlight role="staff" variant="mobile" />
          </div>
          {children}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="lg-col-3 space-y-6 hidden lg-block">
          <UniversityWideSpotlight role="staff" variant="desktop" />
          <DepartmentPagesSidebarList
            departments={departments}
            loadingDepts={loadingDepts}
            pageBasePath="/staff/page"
          />
        </aside>

      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (ICONS ONLY) */}
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
          href="/staff/mypage/dashboard" 
          onClick={(e) => { e.preventDefault(); handleNavigation('overview'); }}
          aria-label="Home"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            textDecoration: 'none',
            color: activeTab === 'overview' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-house" style={{ fontSize: '1.25rem' }}></i>
        </a>

        <a 
          href="/staff/mypage/notifications" 
          onClick={(e) => { e.preventDefault(); handleNavigation('notifications'); }}
          aria-label="Notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            textDecoration: 'none',
            color: activeTab === 'notifications' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-bell" style={{ fontSize: '1.25rem' }}></i>
        </a>

        <a 
          href="/staff/mypage/announcements" 
          onClick={(e) => { e.preventDefault(); handleNavigation('announcements'); }}
          aria-label="Announcements"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            textDecoration: 'none',
            color: activeTab === 'announcements' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-bullhorn" style={{ fontSize: '1.25rem' }}></i>
        </a>

        <a 
          href="/staff/mypage/events" 
          onClick={(e) => { e.preventDefault(); handleNavigation('events'); }}
          aria-label="Events"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            textDecoration: 'none',
            color: activeTab === 'events' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-calendar-days" style={{ fontSize: '1.25rem' }}></i>
        </a>

        <a 
          href="/staff/mypage/registrations" 
          onClick={(e) => { e.preventDefault(); handleNavigation('registrations'); }}
          aria-label="Registrations"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            textDecoration: 'none',
            color: activeTab === 'registrations' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-users-rectangle" style={{ fontSize: '1.25rem' }}></i>
        </a>
      </nav>
    </div>
  );
}