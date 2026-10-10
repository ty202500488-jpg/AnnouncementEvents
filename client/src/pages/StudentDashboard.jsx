import { useState, useEffect } from 'react';
import './styles/StudentDashboard.css';

export default function StudentDashboard() {
  const [user, setUser] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    program: 'BS Computer Science'
  });

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Load user profile from localStorage stored during login
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({
          firstName: parsed.first_name || 'Alex',
          lastName: parsed.last_name || 'Rivera',
          program: parsed.program_name || 'BS Computer Science'
        });
      } catch (err) {
        console.error('Failed to parse user from localStorage', err);
      }
    }

    // 2. Fetch announcements & events from your backend database API
    const fetchDashboardContent = async () => {
      try {
        const response = await fetch('http://localhost:5000/users/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok && data.announcements) {
          setAnnouncements(data.announcements);
        }
      } catch (err) {
        console.error('Error connecting to backend for dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardContent();

    // Mobile menu toggle logic
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const leftSidebar = document.getElementById('leftSidebar');
    const handleMenuClick = () => {
      leftSidebar?.classList.toggle('mobile-sidebar-active');
    };
    mobileMenuBtn?.addEventListener('click', handleMenuClick);

    // Interactive Like/View button toggles
    const likeBtns = document.querySelectorAll('.like-btn');
    const handleLikeClick = (e) => {
      const btn = e.currentTarget;
      const icon = btn.querySelector('i');
      const countSpan = btn.querySelector('.like-count');
      let currentCount = parseInt(countSpan.textContent) || 0;

      if (icon.classList.contains('fa-regular')) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'liked-btn');
        countSpan.textContent = `${currentCount + 1} Likes`;
      } else {
        icon.classList.remove('fa-solid', 'liked-btn');
        icon.classList.add('fa-regular');
        countSpan.textContent = `${currentCount - 1} Likes`;
      }
    };
    likeBtns.forEach(btn => btn.addEventListener('click', handleLikeClick));

    // Bookmark button toggles
    const bookmarkBtns = document.querySelectorAll('.bookmark-btn');
    const handleBookmarkClick = (e) => {
      const btn = e.currentTarget;
      const icon = btn.querySelector('i');
      if (icon.classList.contains('fa-regular')) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'bookmarked-btn');
      } else {
        icon.classList.remove('fa-solid', 'bookmarked-btn');
        icon.classList.add('fa-regular');
      }
    };
    bookmarkBtns.forEach(btn => btn.addEventListener('click', handleBookmarkClick));

    return () => {
      mobileMenuBtn?.removeEventListener('click', handleMenuClick);
      likeBtns.forEach(btn => btn.removeEventListener('click', handleLikeClick));
      bookmarkBtns.forEach(btn => btn.removeEventListener('click', handleBookmarkClick));
    };
  }, []);

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

          {/* Middle Search Bar */}
          <div className="search-container">
            <div className="search-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input type="text" id="searchInput" placeholder="Search Announcements, Events, Departments..." className="search-input" />
              <button className="filter-btn">
                <i className="fa-sliders fa-solid" style={{ fontSize: '0.75rem' }}></i>
              </button>
            </div>
          </div>

          {/* Right Profile & Quick Actions */}
          <div className="flex items-center gap-3"> 
            <div style={{ position: 'relative' }}>
              <button id="notifBtn" className="icon-btn">
                <i className="fa-regular fa-bell" style={{ fontSize: '1rem' }}></i>
                <span className="badge-dot"></span>
              </button>
            </div>

            <div className="divider-v"></div>

            {/* User Profile Dropdown */}
            <div className="profile-btn">
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
                <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.75rem', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
                <a href="#" className="nav-item active btn-nav">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-house nav-icon"></i>
                    <span>Home</span>
                  </div>
                </a>
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bullhorn nav-icon"></i>
                    <span>Announcements</span>
                  </div>
                </a>
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-regular fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-building-columns nav-icon"></i>
                    <span>My Events</span>
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: PERSONAL */}
            <div>
              <div className="nav-group-title">Personal</div>
              <nav className="space-y-1">
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-regular fa-user nav-icon"></i>
                    <span>Profile</span>
                  </div>
                </a>
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-regular fa-bell nav-icon"></i>
                    <span>Notifications</span>
                  </div>
                </a>
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bookmark nav-icon"></i>
                    <span>Saved</span>
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: SYSTEM */}
            <div>
              <div className="nav-group-title">System</div>
              <nav className="space-y-1">
                <a href="#" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-circle-info nav-icon"></i>
                    <span>Help & Support</span>
                  </div>
                </a>
                <a href="#" className="nav-item">
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

        {/* ==================== CENTER MAIN CONTENT (DYNAMIC FEED) ==================== */}
        <main className="lg-col-6 space-y-6">
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
          ) : announcements.length === 0 ? (
            <article className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--slate-600)' }}>No database announcements available yet.</p>
            </article>
          ) : (
            announcements.map((item, index) => (
              <article key={item.id || index} className="card card-interactive" style={{ padding: '1.5rem' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '5.75rem', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      WMSU
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>{item.department_name || 'University Notice'}</h3>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="bookmark-btn action-btn" style={{ padding: '0.25rem' }}>
                      <i className="fa-regular fa-bookmark" style={{ fontSize: '1rem' }}></i>
                    </button>
                    <button className="action-btn" style={{ padding: '0.25rem' }}>
                      <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1rem', color: 'var(--slate-400)' }}></i>
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem', lineHeight: 1.375 }}>
                    {item.title}
                  </h4>
                  <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.5rem', lineHeight: 1.625 }}>
                    {item.content}
                  </p>
                </div>

                <div className="flex items-center justify-between" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  <div className="flex items-center gap-6">
                    <button className="like-btn action-btn">
                      <i className="fa-regular fa-eye" style={{ fontSize: '0.875rem' }}></i>
                      <span className="like-count">View Details</span>
                    </button>
                  </div>
                  <button className="action-btn">
                    <i className="fa-solid fa-user-plus" style={{ fontSize: '0.875rem' }}></i>
                    <span>Register</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </main>

        {/* ==================== RIGHT SIDEBAR ==================== */}
        <aside className="lg-col-3 space-y-6">
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>Departments</h3>
              <span style={{ color: 'var(--brand-600)', fontSize: '11px', fontWeight: 700, padding: '0.125rem 0.5rem', cursor: 'pointer' }}>View All</span>
            </div>

            <div className="dept-list space-y-2">
              <a href="#" className="dept-item dept-item-university">
                <div className="dept-badge dept-badge-university">
                  <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">Western Mindanao State University</span>
                  <span className="dept-sub">General updates & notices</span>
                </div>
              </a>

              <a href="#" className="dept-item dept-item-user">
                <div className="dept-badge dept-badge-user">
                  <i className="fa-solid fa-laptop-code"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Computing Studies</span>
                  <span className="dept-sub">CSS Department</span>
                </div>
              </a>

              <div className="dept-divider"></div>

              <a href="#" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-compass-drafting"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Medicine</span>
                  <span className="dept-sub">CM Department</span>
                </div>
              </a>

              <a href="#" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-flask"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Liberal Arts</span>
                  <span className="dept-sub">CLA Department</span>
                </div>
              </a>

              <a href="#" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-chalkboard-user"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Education</span>
                  <span className="dept-sub">CTE Department</span>
                </div>
              </a>

              <a href="#" className="see-more-btn">
                <span>See More</span>
              </a>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}