import { useState, useEffect, useRef } from 'react';
import '../../pages/styles/MyPageDashboard.css';
import logo from '../../assets/images/logo.jpg';

export default function MyPageDashboardLayout({ children, activeTab, onTabChange, onSwitchToStaffDashboard }) {
  const [user, setUser] = useState({
    firstName: 'Charm',
    lastName: 'Lagare',
    program: 'Staff / Department Coordinator'
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // MOBILE MENU STATE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // SEARCH BAR STATE & LOGIC
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  // PROFILE DROPDOWN STATE & LOGIC
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  const loadUserData = () => {
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
  };

  const [pageInfo, setPageInfo] = useState({
    exists: false,
    status: 'none',
    name: 'College Of Computing Studies',
    subtitle: 'Academic College'
  });

  useEffect(() => {
    loadUserData();

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

    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleStorageChange = () => {
      loadUserData();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length > 0) {
      setIsSearching(true);
      setShowDropdown(true);

      try {
        const deptMatches = departments
          .filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
          .map(d => ({
            id: d.id,
            title: d.name,
            category: 'departments',
            type: 'Department Page',
            url: d.url || '/staff/mypage/dashboard'
          }));

        const staticSystemRecords = [
          { id: 'ann-1', title: 'Midterm Examination Schedule', category: 'announcements', type: 'Announcement', url: '/staff/mypage/dashboard' },
          { id: 'ann-2', title: 'Graduation Ceremony Guidelines', category: 'announcements', type: 'Announcement', url: '/staff/mypage/dashboard' },
          { id: 'evt-1', title: 'Annual University Sports Fest 2026', category: 'events', type: 'Event', url: '/staff/mypage/dashboard' },
          { id: 'evt-2', title: 'Hackathon & Tech Expo', category: 'events', type: 'Event', url: '/staff/mypage/dashboard' }
        ].filter(item => item.title.toLowerCase().includes(query.toLowerCase()));

        const combinedResults = [...deptMatches, ...staticSystemRecords].filter(item => {
          return filterCategory === 'all' || item.category === filterCategory;
        });

        setSearchResults(combinedResults);
      } catch (err) {
        console.error('Search query failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const toggleFilterCategory = () => {
    const categories = ['all', 'announcements', 'events', 'departments'];
    const currentIndex = categories.indexOf(filterCategory);
    const nextCategory = categories[(currentIndex + 1) % categories.length];
    setFilterCategory(nextCategory);

    if (searchQuery.trim().length > 0) {
      const event = { target: { value: searchQuery } };
      handleSearchChange(event);
    }
  };

  const handleNavigation = (tab) => {
    setIsMobileMenuOpen(false);
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
            <button 
              type="button" 
              className="mobile-menu-btn icon-btn" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ color: 'var(--slate-600)' }}
              aria-label="Toggle Menu"
            >
              <i className="fa-solid fa-bars" style={{ fontSize: '1.25rem' }}></i>
            </button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="CRIMSON Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain', borderRadius: '50%' }} />
            </div>
          </div>

          {/* Middle Search Bar */}
          <div className="search-container" ref={searchContainerRef} style={{ position: 'relative' }}>
            <div className="search-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder={`Search ${filterCategory === 'all' ? 'Announcement, Events, Departments...' : filterCategory + '...'}`} 
                className="search-input"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
              />
              <button 
                type="button"
                className="filter-btn" 
                onClick={toggleFilterCategory}
                title={`Current Filter: ${filterCategory.toUpperCase()}`}
                style={{
                  color: filterCategory !== 'all' ? '#881337' : 'inherit',
                  fontWeight: filterCategory !== 'all' ? 700 : 400
                }}
              >
                <i className="fa-sliders fa-solid" style={{ fontSize: '0.75rem' }}></i>
              </button>
            </div>

            {showDropdown && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.5rem',
                  backgroundColor: '#ffffff',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  zIndex: 50,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '0.5rem'
                }}
              >
                {isSearching ? (
                  <p style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center' }}>Searching database...</p>
                ) : searchResults.length === 0 ? (
                  <p style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center' }}>No matching records found in system</p>
                ) : (
                  searchResults.map(result => (
                    <a
                      key={result.id}
                      href={result.url}
                      onClick={() => setShowDropdown(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.375rem',
                        textDecoration: 'none',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50, #f8fafc)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-800, #1e293b)' }}>
                          {result.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--slate-400, #94a3b8)' }}>
                          {result.type}
                        </div>
                      </div>
                      <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--slate-300)' }}></i>
                    </a>
                  ))
                )}
              </div>
            )}
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

            <div ref={profileDropdownRef} style={{ position: 'relative' }}>
              <div 
                className="profile-btn" 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)} 
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', userSelect: 'none' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: 'var(--slate-800)', fontSize: '0.8125rem', lineHeight: 1.2 }}>
                    {user.firstName} {user.lastName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.2 }}>{user.program}</div>
                </div>
                <i className="fa-solid fa-chevron-down" style={{ color: 'var(--slate-400)', fontSize: '10px' }}></i>
              </div>

              {showProfileDropdown && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: 0,
                    width: '220px',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--slate-200, #e2e8f0)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--slate-100)', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-800)' }}>{user.firstName} {user.lastName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--slate-500)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.program}</div>
                  </div>

                  <a href="/staff/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                    <i className="fa-regular fa-user" style={{ width: '16px', color: 'var(--slate-500)' }}></i> Profile
                  </a>
                  <a href="/staff/mypage" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                    <i className="fa-solid fa-flag" style={{ width: '16px', color: '#7B0D1E' }}></i> My Page
                  </a>
                  <a href="#" onClick={(e) => { e.preventDefault(); if (onSwitchToStaffDashboard) onSwitchToStaffDashboard(); else window.location.href = '/staff/dashboard'; }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                    <i className="fa-solid fa-chart-line" style={{ width: '16px', color: '#7B0D1E' }}></i> Staff Dashboard
                  </a>
                  <div style={{ borderTop: '1px solid var(--slate-100)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--rose-600)', textDecoration: 'none' }}>
                      <i className="fa-solid fa-right-from-bracket" style={{ width: '16px' }}></i> Logout
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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
            padding: '1rem'
          } : {}}
        >
          <div className="card space-y-5" style={{ padding: '1rem', height: '100%' }}>
            
            <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ padding: '0.375rem 0.5rem' }}>
                <div className="dept-info" style={{ overflow: 'hidden' }}>
                  <span className="dept-title" style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pageInfo.name}
                  </span>
                  <span className="dept-sub" style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                    {pageInfo.subtitle}
                  </span>
                </div>
              </div>
              {isMobileMenuOpen && (
                <button 
                  type="button" 
                  className="icon-btn lg:hidden" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ color: 'var(--slate-600)' }}
                >
                  <i className="fa-solid fa-xmark" style={{ fontSize: '1.2rem' }}></i>
                </button>
              )}
            </div>

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
                  onClick={(e) => { e.preventDefault(); if (onSwitchToStaffDashboard) onSwitchToStaffDashboard(); else window.location.href = '/staff/dashboard'; }}
                  className="nav-item"
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-flag nav-icon"></i>
                    <span>Staff Dashboard</span>
                  </div>
                </a>
              </nav>
            </div>

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

        {/* DYNAMIC CENTER CONTENT */}
        {children}

        {/* RIGHT SIDEBAR */}
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