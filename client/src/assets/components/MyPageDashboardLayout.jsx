import { useState, useEffect } from 'react';
import '../../pages/styles/MyPageDashboard.css';

export default function MyPageDashboardLayout({ children, activeTab, onTabChange, onSwitchToStaffDashboard }) {
  const [user, setUser] = useState({
    firstName: 'Charm',
    lastName: 'Lagare',
    program: 'Staff / Department Coordinator'
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // State for page creation and admin validation status / Page Info
  const [pageInfo, setPageInfo] = useState({
    exists: false,
    status: 'none', // 'none', 'pending', 'approved', 'rejected'
    name: 'College Of Computing Studies',
    code: 'COCS',
    subtitle: 'Academic College'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || 'Charm',
          lastName: parsed.last_name || 'Lagare',
          program: parsed.program_name || parsed.role || 'Staff / Department Coordinator'
        });
      } catch (err) {
        console.error('Failed to parse user from localStorage', err);
      }
    }

    const fetchApprovedPages = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/approved-pages', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
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

        const response = await fetch('http://localhost:5000/api/my-page-status', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          }
        });
        const data = await response.json();
        if (response.ok) {
          const name = data.pageName || 'College Of Computing Studies';
          const initials = name
            .split(' ')
            .filter(w => w.length > 0)
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .substring(0, 4);

          setPageInfo({
            exists: data.exists || false,
            status: data.status || 'none',
            name: name,
            code: initials || 'COCS',
            subtitle: data.category || 'Academic College'
          });
        }
      } catch (err) {
        console.error('Failed to fetch user page status:', err);
      }
    };

    fetchApprovedPages();
    fetchUserPageStatus();

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const leftSidebar = document.getElementById('leftSidebar');
    const handleMenuClick = () => {
      leftSidebar?.classList.toggle('mobile-sidebar-active');
    };
    mobileMenuBtn?.addEventListener('click', handleMenuClick);

    return () => {
      mobileMenuBtn?.removeEventListener('click', handleMenuClick);
    };
  }, []);

  const handleNavigation = (tab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      if (tab === 'overview' || tab === 'announcements' || tab === 'events' || tab === 'registrations') {
        window.location.href = '/staff/mypage/dashboard';
      } else if (tab === 'profile') {
        window.location.href = '/staff/mypage/profile';
      } else if (tab === 'settings') {
        window.location.href = '/staff/mypage/settings';
      }
    }
  };

  return (
    <div className="staff-dashboard-wrapper student-dashboard-wrapper">
      {/* TOP NAVBAR */}
      <header className="header">
        <div className="header-container">
          
          {/* Left Logo & Branding */}
          <div className="flex items-center gap-3">
            <button id="mobileMenuBtn" className="mobile-menu-btn icon-btn" style={{ color: 'var(--slate-600)' }}>
              <i className="fa-solid fa-bars" style={{ fontSize: '1.25rem' }}></i>
            </button>
            <div className="flex items-center gap-3">
              <div>
                <h1 style={{ fontFamily: 'Bungee, sans-serif', fontWeight: 700, color: '#561C24', fontSize: '1.525rem', lineHeight: 1.2, letterSpacing: '-0.025em' }}>
                  CRIM<span style={{ color: '#881337' }}>SON</span>
                </h1>
              </div>
            </div>
          </div>

          {/* Middle Search Bar */}
          <div className="search-container">
            <div className="search-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input type="text" placeholder="Search Announcements, Events, Departments..." className="search-input" />
              <button className="filter-btn">
                <i className="fa-sliders fa-solid" style={{ fontSize: '0.75rem' }}></i>
              </button>
            </div>
          </div>

          {/* Right Profile & Quick Actions */}
          <div className="flex items-center gap-3"> 
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => window.location.href = '/staff/notifications'}>
                <i className="fa-regular fa-bell" style={{ fontSize: '1rem' }}></i>
                <span className="badge-dot"></span>
              </button>
            </div>

            <div className="divider-v"></div>

            {/* User Profile Pill */}
            <div className="profile-btn" onClick={() => window.location.href = '/staff/profile'} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div className="avatar-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                  alt={`${user.firstName} ${user.lastName}`} 
                  className="avatar-img"
                  onError={(e) => { e.target.src = 'https://placehold.co/100x100/2563eb/ffffff?text=CL'; }}
                />
                <span className="online-status"></span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: 'var(--slate-800)', fontSize: '0.8125rem', lineHeight: 1.2 }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.2 }}>{user.program}</div>
              </div>
              <i className="fa-solid fa-chevron-down" style={{ color: 'var(--slate-400)', fontSize: '10px', marginLeft: '0.25rem' }}></i>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER GRID */}
      <div className="main-container">

        {/* ==================== LEFT SIDEBAR ==================== */}
        <aside id="leftSidebar" className="lg-col-3 space-y-6 hidden lg-block">
          <div className="card space-y-5" style={{ padding: '1rem' }}>
            
            {/* Section: PAGE IDENTITY HEADER */}
            <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-200)' }}>
              <div className="flex items-center gap-3" style={{ padding: '0.375rem 0.5rem' }}>
                <div style={{ 
                  width: '2.5rem', 
                  height: '2.5rem', 
                  borderRadius: '0.5rem', 
                  backgroundColor: '#881337', 
                  color: '#ffffff', 
                  fontWeight: 800, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '0.75rem',
                  letterSpacing: '0.025em',
                  flexShrink: 0 
                }}>
                  {pageInfo.code}
                </div>
                <div className="dept-info" style={{ overflow: 'hidden' }}>
                  <span className="dept-title" style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pageInfo.name}
                  </span>
                  <span className="dept-sub" style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                    {pageInfo.subtitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Section: MAIN NAVIGATION */}
            <div>
              <div className="nav-group-title">MAIN</div>
              <nav className="space-y-1">
                <a 
                  href="#overview" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('overview'); }}
                  className={`nav-item ${activeTab === 'overview' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-house nav-icon"></i>
                    <span>Home</span>
                  </div>
                </a>
                <a 
                  href="#profile" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('profile'); }}
                  className={`nav-item ${activeTab === 'profile' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-id-badge nav-icon"></i>
                    <span>Page Profile</span>
                  </div>
                </a>
                <a 
                  href="#announcements" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('announcements'); }}
                  className={`nav-item ${activeTab === 'announcements' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bullhorn nav-icon"></i>
                    <span>Announcements</span>
                  </div>
                </a>
                <a 
                  href="#events" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('events'); }}
                  className={`nav-item ${activeTab === 'events' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-regular fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
                <a 
                  href="#registrations" 
                  onClick={(e) => { e.preventDefault(); handleNavigation('registrations'); }}
                  className={`nav-item ${activeTab === 'registrations' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-users-rectangle nav-icon"></i>
                    <span>Registrations</span>
                  </div>
                </a>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); if (onSwitchToStaffDashboard) onSwitchToStaffDashboard(); }}
                  className="nav-item"
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-flag nav-icon"></i>
                    <span>Staff Dashboard</span>
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: SYSTEM */}
            <div>
              <div className="nav-group-title">SYSTEM</div>
              <nav className="space-y-1">
                <a 
                  href="#settings"
                  onClick={(e) => { e.preventDefault(); handleNavigation('settings'); }}
                  className={`nav-item ${activeTab === 'settings' ? 'active btn-nav' : ''}`}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-gear nav-icon"></i>
                    <span>Settings</span>
                  </div>
                </a>
                <a href="/" className="nav-item" style={{ color: 'var(--rose-600)' }}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-right-from-bracket nav-icon" style={{ color: 'var(--rose-600)' }}></i>
                    <span>Logout</span>
                  </div>
                </a>
              </nav>
            </div>
          </div>
        </aside>

        {/* ==================== DYNAMIC CENTER CONTENT ==================== */}
        {children}

        {/* ==================== RIGHT SIDEBAR ==================== */}
        <aside className="lg-col-3 space-y-6">
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.975rem' }}>Department Pages</h3>
              <span style={{ color: 'var(--brand-600)', fontSize: '11px', fontWeight: 700, padding: '0.125rem 0.5rem', cursor: 'pointer' }}>View All</span>
            </div>

            <div className="dept-list space-y-2">
              {loadingDepts ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center', padding: '1rem' }}>Loading pages...</p>
              ) : departments.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center', padding: '1rem' }}>No approved pages found.</p>
              ) : (
                departments.map((dept, index) => (
                  <a key={dept.id || index} href={dept.url || '#'} className={`dept-item ${dept.is_university ? 'dept-item-university' : dept.is_user_dept ? 'dept-item-user' : ''}`}>
                    <div className={`dept-badge ${dept.is_university ? 'dept-badge-university' : dept.is_user_dept ? 'dept-badge-user' : ''}`}>
                      <i className={dept.icon || 'fa-solid fa-bookmark'}></i>
                    </div>
                    <div className="dept-info">
                      <span className="dept-title">{dept.name}</span>
                      <span className="dept-sub">{dept.subtitle || dept.category || 'Official Page'}</span>
                    </div>
                  </a>
                ))
              )}

              <a href="#" className="see-more-btn" style={{ marginTop: '0.75rem' }}>
                <span>See More</span>
              </a>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}