import React, { useState, useEffect } from 'react';
import MyPage from './MyPage';
import '../styles/StaffDashboard.css';

export default function StaffDashboard({ onLogout }) {
  const [activeView, setActiveView] = useState('home'); // Controls view switching
  const [isMobileSidebarActive, setIsMobileSidebarActive] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Interaction states for dynamic posts
  const [likes, setLikes] = useState({});

  // Fetch announcements from the database on component load
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/dashboard-data', {
          method: 'POST', // Matches announcementRoutes.js endpoint[cite: 3]
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.announcements) {
          setAnnouncements(data.announcements);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileSidebarActive(!isMobileSidebarActive);
  };

  const handleLikeToggle = (id) => {
    setLikes(prev => {
      const current = prev[id] || { count: 0, liked: false };
      const newLiked = !current.liked;
      return {
        ...prev,
        [id]: {
          liked: newLiked,
          count: newLiked ? current.count + 1 : Math.max(0, current.count - 1)
        }
      };
    });
  };

  // Handle logout action
  const handleLogoutClick = (e) => {
    e.preventDefault();
    if (onLogout) {
      onLogout(); // Calls parent logout function if provided
    } else {
      // Fallback reload or redirection
      window.location.href = '/'; 
    }
  };

  // Render MyPage component when activeView is set to 'mypage'
  if (activeView === 'mypage') {
    return <MyPage onBack={() => setActiveView('home')} />;
  }

  return (
    <div className="staff-dashboard">
      {/* TOP NAVBAR */}
      <header className="header">
        <div className="header-container">
          
          {/* Left Logo & Branding */}
          <div className="flex items-center gap-3">
            <button 
              id="mobileMenuBtn" 
              className="mobile-menu-btn icon-btn" 
              style={{ color: 'var(--slate-600)' }}
              onClick={toggleMobileMenu}
            >
              <i className="fa-solid fa-bars" style={{ fontSize: '1.25rem' }}></i>
            </button>
            <div className="flex items-center gap-3">
              <div>
                <h1 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 700, color: '#561C24', fontSize: '1.525rem', lineHeight: 1.2, letterSpacing: '-0.025em' }}>
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
                  alt="Alex Rivera" 
                  className="avatar-img"
                  onError={(e) => { e.target.src = 'https://placehold.co/100x100/2563eb/ffffff?text=AR'; }}
                />
                <span className="online-status"></span>
              </div>
              <div className="hidden-sm" style={{ display: 'none', textAlign: 'left', paddingRight: '0.25rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.75rem', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Alex Rivera
                </div>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.2 }}>BS Computer Science</div>
              </div>
              <i className="fa-solid fa-chevron-down hidden-sm" style={{ display: 'none', color: 'var(--slate-400)', fontSize: '10px', paddingRight: '0.25rem' }}></i>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER GRID */}
      <div className="main-container">

        {/* ==================== LEFT SIDEBAR ==================== */}
        <aside id="leftSidebar" className={`lg-col-3 space-y-6 hidden lg-block ${isMobileSidebarActive ? 'mobile-sidebar-active' : ''}`}>
          <div className="card space-y-5" style={{ padding: '1rem' }}>
            
            {/* Section: MAIN Profile Header */}
            <div style={{ paddingTop: '0.75rem', borderBottom: '1px solid var(--slate-200)' }}>
              <div className="flex items-center gap-3" style={{ padding: '0.5rem 0.75rem' }}>
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                  alt="Alex Rivera" 
                  className="avatar-img"
                  onError={(e) => { e.target.src = 'https://placehold.co/100x100/2563eb/ffffff?text=AR'; }}
                />
                <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.875rem' }}> Alex Rivera</span>
              </div>
            </div>

            <div>
              <div className="nav-group-title">Main</div>
              <nav className="space-y-1">
                <a 
                  href="#home" 
                  className={`nav-item ${activeView === 'home' ? 'active btn-nav' : ''}`}
                  onClick={(e) => { e.preventDefault(); setActiveView('home'); }}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-house nav-icon"></i>
                    <span>Home</span>
                  </div>
                </a>
                <a href="#announcements" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bullhorn nav-icon"></i>
                    <span>Announcements</span>
                  </div>
                </a>
                <a href="#events" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-regular fa-calendar-days nav-icon"></i>
                    <span>Events</span>
                  </div>
                </a>
                <a 
                  href="#mypage" 
                  className={`nav-item ${activeView === 'mypage' ? 'active btn-nav' : ''}`}
                  onClick={(e) => { e.preventDefault(); setActiveView('mypage'); }}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-flag nav-icon"></i>
                    <span>My Page</span>
                  </div>
                </a>
              </nav>
            </div>

            {/* Section: PERSONAL */}
            <div>
              <div className="nav-group-title">Personal</div>
              <nav className="space-y-1">
                <a href="#profile" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-user nav-icon"></i>
                    <span>Profile</span>
                  </div>
                </a>
                <a href="#notifications" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-bell nav-icon"></i>
                    <span>Notifications</span>
                  </div>
                </a>
                <a href="#myevents" className="nav-item">
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
                <a href="#support" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-circle-info nav-icon"></i>
                    <span>Help & Support</span>
                  </div>
                </a>
                <a href="#settings" className="nav-item">
                  <div className="nav-item-content">
                    <i className="fa-solid fa-gear nav-icon"></i>
                    <span>Settings</span>
                  </div>
                </a>
                <a 
                  href="#logout" 
                  className="nav-item" 
                  style={{ color: 'var(--rose-600)' }}
                  onClick={handleLogoutClick}
                >
                  <div className="nav-item-content">
                    <i className="fa-solid fa-right-from-bracket nav-icon" style={{ color: 'var(--rose-600)' }}></i>
                    <span>Logout</span>
                  </div>
                </a>
              </nav>
            </div>
          </div>
        </aside>

        {/* ==================== CENTER MAIN CONTENT (Dynamic Database Feed) ==================== */}
        <main className="lg-col-6 space-y-6">
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading announcements...</p>
          ) : announcements.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>No announcements found.</p>
          ) : (
            announcements.map((item) => {
              const postId = item.id;
              const postLike = likes[postId] || { count: 0, liked: false };

              return (
                <article key={postId} className="card card-interactive" style={{ padding: '1.5rem' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '5.75rem', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        {item.department_code || 'SAO'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>
                            {item.department_name || 'Student Affairs Office'}
                          </h3>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently posted'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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

                    {item.image_url && (
                      <div style={{ marginTop: '1rem', borderRadius: '0.75rem', overflow: 'hidden', position: 'relative' }}>
                        <img 
                          src={item.image_url} 
                          alt="Announcement Media" 
                          style={{ width: '100%', height: '16rem', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { e.target.src = 'https://placehold.co/800x400/2563eb/ffffff?text=Announcement'; }}
                        />
                        {item.deadline && (
                          <div style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', color: '#ffffff', fontSize: '11px', fontWeight: 500, padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                            Registration Deadline: {item.deadline}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    <div className="flex items-center gap-6">
                      <button className="like-btn action-btn" onClick={() => handleLikeToggle(postId)}>
                        <i className={`${postLike.liked ? 'fa-solid liked-btn' : 'fa-regular'} fa-eye`} style={{ fontSize: '0.875rem' }}></i>
                        <span className="like-count">
                          {postLike.count > 0 ? `${postLike.count} Likes` : 'View Details'}
                        </span>
                      </button>
                    </div>
                    <button className="action-btn">
                      <i className="fa-solid fa-user-plus" style={{ fontSize: '0.875rem' }}></i>
                      <span>Register</span>
                    </button>
                  </div>
                </article>
              );
            })
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
              <a href="#wmsu" className="dept-item dept-item-university">
                <div className="dept-badge dept-badge-university">
                  <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <div className="dept-info">
                  <div className="flex items-center justify-between">
                    <span className="dept-title">Western Mindanao State University</span>
                  </div>
                  <span className="dept-sub">General updates & notices</span>
                </div>
              </a>

              <a href="#ccs" className="dept-item dept-item-user">
                <div className="dept-badge dept-badge-user">
                  <i className="fa-solid fa-laptop-code"></i>
                </div>
                <div className="dept-info">
                  <div className="flex items-center justify-between">
                    <span className="dept-title">College of Computing Studies</span>
                  </div>
                  <span className="dept-sub">CSS Department</span>
                </div>
              </a>

              <div className="dept-divider"></div>

              <a href="#cm" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-compass-drafting"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Medicine</span>
                  <span className="dept-sub">CM Department</span>
                </div>
              </a>

              <a href="#cla" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-flask"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Liberal Arts</span>
                  <span className="dept-sub">CLA Department</span>
                </div>
              </a>

              <a href="#cte" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-chalkboard-user"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Education</span>
                  <span className="dept-sub">CTE Department</span>
                </div>
              </a>

              <a href="#coe" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-gear"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Engineering</span>
                  <span className="dept-sub">COE Department</span>
                </div>
              </a>

              <a href="#cn" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-user-nurse"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Nursing</span>
                  <span className="dept-sub">CN Department</span>
                </div>
              </a>

              <a href="#cceje" className="dept-item">
                <div className="dept-badge">
                  <i className="fa-solid fa-users-gear"></i>
                </div>
                <div className="dept-info">
                  <span className="dept-title">College of Criminal Justice Education</span>
                  <span className="dept-sub">CCEJE Department</span>
                </div>
              </a>

              <a href="#seemore" className="see-more-btn">
                <span>See More</span>
              </a>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}