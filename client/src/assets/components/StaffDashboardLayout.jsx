import { useState, useEffect } from 'react';
import '../../pages/styles/StudentDashboard.css';

export default function StaffDashboardLayout({ children, activePage }) {
  const [user, setUser] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    program: 'Staff / Department Coordinator'
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  
  // State for page creation and admin validation status
  const [pageStatus, setPageStatus] = useState({
    exists: false,
    status: 'none' // 'none', 'pending', 'approved', 'rejected'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || 'Alex',
          lastName: parsed.last_name || 'Rivera',
          program: parsed.program_name || 'Staff / Department Coordinator'
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
        const response = await fetch('http://localhost:5000/api/my-page-status', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` 
          }
        });
        const data = await response.json();
        if (response.ok) {
          setPageStatus({
            exists: data.exists || false,
            status: data.status || 'none' // e.g. 'approved', 'pending', etc.
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

  const isPageApproved = pageStatus.exists && pageStatus.status === 'approved';

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
            {/* Conditional Page Switcher on Nav Account Bar if validated */}
            {isPageApproved && (
              <a 
                href="/staff/mypage/dashboard" 
                className="btn-switch-page hidden-sm" 
                style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  padding: '0.375rem 0.75rem', 
                  background: 'var(--brand-700, #561C24)', 
                  color: '#fff', 
                  borderRadius: '6px', 
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <i className="fa-solid fa-right-left" style={{ fontSize: '0.65rem' }}></i>
                <span>Switch to Page</span>
              </a>
            )}

            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => window.location.href = '/staff/notifications'}>
                <i className="fa-regular fa-bell" style={{ fontSize: '1rem' }}></i>
                <span className="badge-dot"></span>
              </button>
            </div>

            <div className="divider-v"></div>

            {/* User Profile Pill */}
            <div className="profile-btn" onClick={() => window.location.href = '/staff/profile'}>
              <div className="avatar-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                  alt={`${user.firstName} ${user.lastName}`} 
                  className="avatar-img"
                  onError={(e) => { e.target.src = 'https://placehold.co/100x100/2563eb/ffffff?text=AR'; }}
                />
                <span className="online-status"></span>
              </div>
              <div className="hidden-sm" style={{ display: 'none', textAlign: 'left', paddingRight: '0.25rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.75rem', lineHeight: 1.2 }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.2 }}>{user.program}</div>
              </div>
              <i className="fa-solid fa-chevron-down hidden-sm" style={{ display: 'none', color: 'var(--slate-400)', fontSize: '10px', paddingRight: '0.25rem' }}></i>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER GRID */}
      <div className="main-container">

        {/* ==================== LEFT SIDEBAR ==================== */}
        <aside id="leftSidebar" className="lg-col-3 space-y-6 hidden lg-block">
          <div className="card space-y-5" style={{ padding: '1rem' }}>
            
            {/* Section: MAIN USER HEADER */}
            <div style={{ paddingTop: '0.75rem', borderBottom: '1px solid var(--slate-200)' }}>
              <div className="flex items-center gap-3" style={{ padding: '0.5rem 0.75rem' }}>
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                  alt={`${user.firstName} ${user.lastName}`} 
                  className="avatar-img"
                  onError={(e) => { e.target.src = 'https://placehold.co/100x100/2563eb/ffffff?text=AR'; }}
                />
                <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.875rem' }}>
                  {user.firstName} {user.lastName}
                </span>
              </div>
            </div>

            <div>
              <div className="nav-group-title">Main</div>
              <nav className="space-y-1">
                <a href="/staff/dashboard" className={`nav-item ${activePage === 'home' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-house nav-icon"></i>
                    <span>Home</span>
                  </div>
                </a>
                <a href="/staff/announcements" className={`nav-item ${activePage === 'announcements' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bullhorn nav-icon"></i>
                    <span>Announcements</span>
                  </div>
                </a>
                <a href="/staff/events" className={`nav-item ${activePage === 'events' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-regular fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
                <a href={isPageApproved ? "/staff/mypage/dashboard" : "/staff/mypage"} className={`nav-item ${activePage === 'mypage' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <i className="fa-solid fa-flag nav-icon"></i>
                      <span>My Page</span>
                    </div>
                    {isPageApproved && (
                      <span style={{ fontSize: '10px', background: 'var(--brand-100, #fce7f3)', color: 'var(--brand-700, #881337)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        Active
                      </span>
                    )}
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: PERSONAL */}
            <div>
              <div className="nav-group-title">Personal</div>
              <nav className="space-y-1">
                <a href="/staff/profile" className={`nav-item ${activePage === 'profile' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-regular fa-user nav-icon"></i>
                    <span>Profile</span>
                  </div>
                </a>
                <a href="/staff/notifications" className={`nav-item ${activePage === 'notifications' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-regular fa-bell nav-icon"></i>
                    <span>Notifications</span>
                  </div>
                </a>
                <a href="/staff/my-events" className={`nav-item ${activePage === 'my-events' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-solid fa-calendar-days nav-icon"></i>
                    <span>My Events</span>
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: SYSTEM */}
            <div>
              <div className="nav-group-title">System</div>
              <nav className="space-y-1">
                <a href="/staff/settings" className={`nav-item ${activePage === 'settings' ? 'active btn-nav' : ''}`}>
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

        {/* ==================== RIGHT SIDEBAR (CONSISTENT DEPARTMENT PAGES) ==================== */}
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