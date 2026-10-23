import { useState, useEffect, useRef } from 'react';
import '../../pages/styles/StudentDashboard.css';

export default function DashboardLayout({ children, activePage }) {
  const [user, setUser] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    program: 'BS Computer Science'
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // SEARCH BAR STATE & LOGIC
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'announcements', 'events', 'departments'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  const loadUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || 'Alex',
          lastName: parsed.last_name || 'Rivera',
          program: parsed.program_name || parsed.course || 'BS Computer Science'
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
        const response = await fetch('http://localhost:5000/users/approved-pages', {
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

    fetchApprovedPages();

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const leftSidebar = document.getElementById('leftSidebar');
    const handleMenuClick = () => {
      leftSidebar?.classList.toggle('mobile-sidebar-active');
    };
    mobileMenuBtn?.addEventListener('click', handleMenuClick);

    // Click outside handler for search dropdown
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Live storage update listener for cross-component synchronization
    const handleStorageChange = () => {
      loadUserData();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mobileMenuBtn?.removeEventListener('click', handleMenuClick);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Live Search Query Handler
  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length > 0) {
      setIsSearching(true);
      setShowDropdown(true);

      try {
        // Query matching approved department pages existing in system
        const deptMatches = departments
          .filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
          .map(d => ({
            id: d.id,
            title: d.name,
            category: 'departments',
            type: 'Department Page',
            url: d.url || '#'
          }));

        // Query existing system announcements & events
        const staticSystemRecords = [
          { id: 'ann-1', title: 'Midterm Examination Schedule', category: 'announcements', type: 'Announcement', url: '/student/announcements' },
          { id: 'ann-2', title: 'Graduation Ceremony Guidelines', category: 'announcements', type: 'Announcement', url: '/student/announcements' },
          { id: 'evt-1', title: 'Annual University Sports Fest 2026', category: 'events', type: 'Event', url: '/student/events' },
          { id: 'evt-2', title: 'Hackathon & Tech Expo', category: 'events', type: 'Event', url: '/student/events' }
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

  return (
    <div className="student-dashboard-wrapper">
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

            {/* Dropdown Results */}
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
              <button className="icon-btn" onClick={() => window.location.href = '/student/notifications'}>
                <i className="fa-regular fa-bell" style={{ fontSize: '1rem' }}></i>
                <span className="badge-dot"></span>
              </button>
            </div>

            <div className="divider-v"></div>

            {/* User Profile Pill */}
            <div className="profile-btn" onClick={() => window.location.href = '/student/profile'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.85rem', lineHeight: 1.2 }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.2 }}>{user.program}</div>
              </div>
              <i className="fa-solid fa-chevron-down" style={{ color: 'var(--slate-400)', fontSize: '10px' }}></i>
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
            <div style={{ paddingTop: '0.75rem', borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0 0.75rem', textAlign: 'left' }}>
                <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.875rem', display: 'block', lineHeight: 1.2 }}>
                  {user.firstName} {user.lastName}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--slate-500)', display: 'block', marginTop: '3px', lineHeight: 1.2 }}>
                  {user.program}
                </span>
              </div>
            </div>

            <div>
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
                    <i className="fa-regular fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: PERSONAL */}
            <div>
              <div className="nav-group-title">Personal</div>
              <nav className="space-y-1">
                <a href="/student/profile" className={`nav-item ${activePage === 'profile' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-regular fa-user nav-icon"></i>
                    <span>Profile</span>
                  </div>
                </a>
                <a href="/student/notifications" className={`nav-item ${activePage === 'notifications' ? 'active btn-nav' : ''}`}>
                  <div className="nav-item-content">
                    <i className="fa-regular fa-bell nav-icon"></i>
                    <span>Notifications</span>
                  </div>
                </a>
                <a href="/student/my-events" className={`nav-item ${activePage === 'my-events' ? 'active btn-nav' : ''}`}>
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
                <a href="/student/settings" className={`nav-item ${activePage === 'settings' ? 'active btn-nav' : ''}`}>
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