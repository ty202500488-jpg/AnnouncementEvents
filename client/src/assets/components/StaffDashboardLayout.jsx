import { useState, useEffect, useRef } from 'react';
import '../../pages/styles/StudentDashboard.css';
import logo from '../../assets/images/logo.jpg';

export default function StaffDashboardLayout({ children, activePage }) {
  const [user, setUser] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    program: 'BS Computer Science'
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  
  const [pageStatus, setPageStatus] = useState({
    exists: false,
    status: 'none'
  });

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
          firstName: parsed.first_name || parsed.firstName || 'Alex',
          lastName: parsed.last_name || parsed.lastName || 'Rivera',
          program: parsed.program_name || parsed.course || parsed.program || 'BS Computer Science'
        });
      } catch (err) {
        console.error('Failed to parse user from localStorage', err);
      }
    }
  };

  useEffect(() => {
    loadUserData();

    const fetchApprovedPages = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/approved-pages', {
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

        const response = await fetch('http://localhost:5000/api/my-page-status', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          }
        });
        const data = await response.json();
        if (response.ok) {
          setPageStatus({
            exists: data.exists || false,
            status: data.status || 'none'
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
          .filter(d => d.name && d.name.toLowerCase().includes(query.toLowerCase()))
          .map(d => ({
            id: d.id,
            title: d.name,
            category: 'departments',
            type: 'Department Page',
            url: d.url || `/student/page/${d.id}`
          }));

        const staticSystemRecords = [
          { id: 'ann-1', title: 'Midterm Examination Schedule', category: 'announcements', type: 'Announcement', url: '/staff/announcements' },
          { id: 'ann-2', title: 'Graduation Ceremony Guidelines', category: 'announcements', type: 'Announcement', url: '/staff/announcements' },
          { id: 'evt-1', title: 'Annual University Sports Fest 2026', category: 'events', type: 'Event', url: '/staff/events' },
          { id: 'evt-2', title: 'Hackathon & Tech Expo', category: 'events', type: 'Event', url: '/staff/events' }
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

  const isPageApproved = pageStatus.exists && (pageStatus.status === 'approved' || pageStatus.status === 'active');

  return (
    <div className="staff-dashboard-wrapper student-dashboard-wrapper" style={{ paddingBottom: '4rem' }}>
      <style>{`
        @media (min-width: 1024px) {
          .mobile-bottom-nav {
            display: none !important;
          }
        }
      `}</style>

      {/* TOP NAVBAR */}
      <header className="header">
        <div className="header-container">
          
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

          {/* Search Bar */}
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

          {/* Right Header Actions */}
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
                  <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.85rem', lineHeight: 1.2 }}>
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
                  {isPageApproved && (
                    <a href="/staff/mypage/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                      <i className="fa-solid fa-chart-line" style={{ width: '16px', color: '#7B0D1E' }}></i> Page Dashboard
                    </a>
                  )}
                  <a href="/staff/settings" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8125rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                    <i className="fa-solid fa-gear" style={{ width: '16px', color: 'var(--slate-500)' }}></i> Settings
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
            
            <div style={{ paddingTop: '0.75rem', borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ padding: '0 0.75rem', textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.875rem', lineHeight: 1.2 }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.2, marginTop: '2px' }}>
                  {user.program}
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
                <a href="/staff/mypage" className={`nav-item ${activePage === 'mypage' ? 'active btn-nav' : ''}`}>
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

        {/* DYNAMIC CENTER CONTENT */}
        {children}

        {/* RIGHT SIDEBAR WITH CATEGORIES DISPLAYED BELOW DEPARTMENT NAMES */}
        <aside className="lg-col-3 space-y-6 hidden lg-block">
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.975rem' }}>Department Pages</h3>
              <span style={{ color: '#881337', fontSize: '11px', fontWeight: 700, padding: '0.125rem 0.5rem', cursor: 'pointer' }}>View All</span>
            </div>

            <div className="dept-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loadingDepts ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center', padding: '1rem' }}>Loading pages...</p>
              ) : departments.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center', padding: '1rem' }}>No approved pages found.</p>
              ) : (
                departments.map((dept, index) => (
                  <a 
                    key={dept.id || index} 
                    href={dept.url || `/student/page/${dept.id}`} 
                    className="dept-item"
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#ffffff',
                      borderRadius: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderLeft: '4px solid #e2e8f0',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff5f6';
                      e.currentTarget.style.borderColor = '#fecdd3';
                      e.currentTarget.style.borderLeftColor = '#881337';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(136, 19, 55, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.borderLeftColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02)';
                    }}
                  >
                    <div className="dept-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span className="dept-title" style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.875rem' }}>{dept.name}</span>
                      <span className="dept-sub" style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 500 }}>{dept.category || dept.subtitle || 'Official Page'}</span>
                    </div>
                  </a>
                ))
              )}

              <a href="#" className="see-more-btn" style={{ marginTop: '0.5rem', textAlign: 'center', display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#881337', textDecoration: 'none' }}>
                <span>See More</span>
              </a>
            </div>
          </div>
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
          height: '60px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--slate-200, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
        }}
      >
        <a 
          href="/staff/dashboard" 
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
          <span>Home</span>
        </a>

        <a 
          href="/staff/announcements" 
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
          <span>Announcements</span>
        </a>

        <a 
          href="/staff/events" 
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
          <i className="fa-regular fa-calendar-days" style={{ fontSize: '1.1rem' }}></i>
          <span>Events</span>
        </a>

        <a 
          href="/staff/mypage" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            fontSize: '10px',
            fontWeight: activePage === 'mypage' ? 700 : 500,
            color: activePage === 'mypage' ? '#881337' : 'var(--slate-500, #64748b)'
          }}
        >
          <i className="fa-solid fa-flag" style={{ fontSize: '1.1rem' }}></i>
          <span>My Page</span>
        </a>

        <a 
          href="/staff/profile" 
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
          <i className="fa-regular fa-user" style={{ fontSize: '1.1rem' }}></i>
          <span>Profile</span>
        </a>
      </nav>
    </div>
  );
}