import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '../styles/PageView.css';
import logo from '../../assets/images/logo.jpg';

export default function PageView({ role = 'guest' }) {
  const { pageId } = useParams();
  const navigate = useNavigate();

  const [page, setPage] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [toastMessage, setToastMessage] = useState(null);
  const [isSubmittingFollow, setIsSubmittingFollow] = useState(false);
  const [registeringEventId, setRegisteringEventId] = useState(null);

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role') || role;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const fetchPageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // 1. Fetch Page Details
      const pageRes = await fetch(`http://localhost:5000/api/pages/${pageId}`, { headers });
      const pageData = await pageRes.json();

      if (!pageRes.ok) {
        throw new Error(pageData.message || 'Page not found');
      }

      setPage(pageData.page);

      // 2. Fetch Page Posts
      const postsRes = await fetch(`http://localhost:5000/api/pages/${pageId}/posts`, { headers });
      const postsData = await postsRes.json();

      if (postsRes.ok && postsData.posts) {
        setPosts(postsData.posts);
      }
    } catch (err) {
      console.error('Failed to load page view:', err);
      setError(err.message || 'Failed to load page information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pageId) {
      fetchPageData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pageId]);

  const handleToggleFollow = async () => {
    if (!token) {
      navigate('/auth');
      return;
    }

    if (isSubmittingFollow || !page) return;
    setIsSubmittingFollow(true);

    const isCurrentlyFollowed = !!page.is_followed;
    const method = isCurrentlyFollowed ? 'DELETE' : 'POST';
    const endpoint = `http://localhost:5000/api/pages/${pageId}/follow`;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (response.ok) {
        setPage(prev => ({
          ...prev,
          is_followed: data.is_followed,
          followers_count: data.followers_count
        }));
        showToast(data.message || (data.is_followed ? 'Now following page!' : 'Unfollowed page.'));
      } else {
        showToast(data.message || 'Unable to update follow state.');
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      showToast('Network error updating follow state.');
    } finally {
      setIsSubmittingFollow(false);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Page link copied to clipboard!');
    } else {
      showToast('Copy URL from your browser address bar.');
    }
  };

  const handleEventRegister = async (eventId, isAlreadyRegistered) => {
    if (!token) {
      navigate('/auth');
      return;
    }

    setRegisteringEventId(eventId);
    const method = isAlreadyRegistered ? 'DELETE' : 'POST';
    const endpoint = isAlreadyRegistered 
      ? `http://localhost:5000/api/users/events/${eventId}/cancel`
      : `http://localhost:5000/api/users/events/${eventId}/register`;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (response.ok) {
        showToast(isAlreadyRegistered ? 'Registration cancelled.' : 'Successfully registered for event!');
        // Refresh posts to reflect updated count and registration state
        fetchPageData();
      } else {
        showToast(data.message || 'Action failed.');
      }
    } catch (err) {
      console.error('Error with event registration:', err);
      showToast('Network error during event registration.');
    } finally {
      setRegisteringEventId(null);
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      if (userRole === 'student') navigate('/student/dashboard');
      else if (userRole === 'staff') navigate('/staff/dashboard');
      else if (userRole === 'admin') navigate('/admin/dashboard');
      else navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="pageview-wrapper" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#7B0D1E', fontWeight: 600, fontSize: '1.1rem' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
          Loading Facebook page view...
        </p>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="pageview-wrapper" style={{ alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px', background: '#fff', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '2.5rem', color: '#e11d48', marginBottom: '1rem' }}></i>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Page Not Found</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error || 'This campus page does not exist or has been removed.'}
          </p>
          <button onClick={handleGoBack} className="btn-fb btn-fb-primary" style={{ width: '100%' }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Filter posts based on active tab
  const announcementsList = posts.filter(p => p.post_type === 'announcement');
  const eventsList = posts.filter(p => p.post_type === 'event');

  let filteredPosts = posts;
  if (activeTab === 'announcements') filteredPosts = announcementsList;
  else if (activeTab === 'events') filteredPosts = eventsList;

  const pageAvatarText = page.page_code || page.page_name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const pageCategoryBadge = page.department_name ? 'Academic College' : (page.org_name ? 'Student Organization' : 'Campus Office');

  return (
    <div className="pageview-wrapper">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="pageview-topbar">
        <div className="pageview-topbar-inner">
          <button 
            type="button" 
            onClick={handleGoBack} 
            className="btn-fb btn-fb-secondary" 
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            title="Go back"
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>Back</span>
          </button>

          <Link to="/" className="pageview-brand">
            <img src={logo} alt="CRIMSON Logo" />
            <span>CRIMSON Platform</span>
          </Link>

          <div className="pageview-nav-links">
            {token ? (
              <button 
                type="button" 
                onClick={() => navigate(userRole === 'staff' ? '/staff/dashboard' : '/student/dashboard')}
                className="btn-fb btn-fb-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
              >
                <i className="fa-solid fa-house"></i>
                <span className="hidden sm-inline">Dashboard</span>
              </button>
            ) : (
              <Link to="/auth" className="btn-fb btn-fb-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. FACEBOOK HERO COVER & PROFILE SECTION */}
      <section className="fb-cover-container">
        <div className="fb-cover-inner">
          
          {/* Cover Photo Banner */}
          <div className="fb-cover-banner">
            {page.cover_url ? (
              <img src={page.cover_url} alt={`${page.page_name} Cover`} />
            ) : (
              <div className="fb-cover-overlay">
                <div className="fb-cover-watermark">WMSU</div>
              </div>
            )}
          </div>

          {/* Profile Header Info */}
          <div className="fb-header-content">
            <div className="fb-profile-block">
              {/* Overlapping Avatar */}
              <div className="fb-avatar-box">
                {page.avatar_url ? (
                  <img src={page.avatar_url} alt={page.page_name} />
                ) : (
                  <div className="fb-avatar-fallback">{pageAvatarText}</div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="fb-name-meta">
                <h1 className="fb-page-title">{page.page_name}</h1>
                <div className="fb-page-subtitle">
                  <span className="fb-badge-pill">
                    <i className="fa-solid fa-certificate"></i>
                    {pageCategoryBadge}
                  </span>
                  <span>•</span>
                  <span><strong>{page.followers_count || 0}</strong> followers</span>
                  <span>•</span>
                  <span><strong>{posts.length}</strong> posts</span>
                </div>
              </div>
            </div>

            {/* Action Buttons on Right */}
            <div className="fb-actions-group">
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={isSubmittingFollow}
                className={`btn-fb ${page.is_followed ? 'btn-fb-following' : 'btn-fb-primary'}`}
              >
                {isSubmittingFollow ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : page.is_followed ? (
                  <>
                    <i className="fa-solid fa-check"></i>
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    <span>Follow</span>
                  </>
                )}
              </button>

              <button type="button" onClick={handleShare} className="btn-fb btn-fb-secondary">
                <i className="fa-solid fa-share-nodes"></i>
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="fb-tabs-divider"></div>

          {/* Facebook Tabs Bar */}
          <nav className="fb-tabs-nav" aria-label="Page navigation tabs">
            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <i className="fa-solid fa-newspaper"></i>
              <span>All Posts</span>
              <span className="fb-tab-count">{posts.length}</span>
            </button>

            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'announcements' ? 'active' : ''}`}
              onClick={() => setActiveTab('announcements')}
            >
              <i className="fa-solid fa-bullhorn"></i>
              <span>Announcements</span>
              <span className="fb-tab-count">{announcementsList.length}</span>
            </button>

            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <i className="fa-regular fa-calendar-days"></i>
              <span>Events</span>
              <span className="fb-tab-count">{eventsList.length}</span>
            </button>

            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <i className="fa-solid fa-circle-info"></i>
              <span>About</span>
            </button>
          </nav>

        </div>
      </section>

      {/* 3. FACEBOOK BODY (2-COLUMN GRID) */}
      <main className="fb-main-container">
        <div className="fb-body-grid">

          {/* LEFT / MAIN COLUMN: FEED OF POSTS */}
          <div className="fb-feed-col">
            {activeTab === 'about' ? (
              /* DETAILED ABOUT TAB VIEW */
              <article className="fb-card">
                <h3 className="fb-card-title">
                  <i className="fa-solid fa-building-columns"></i>
                  About {page.page_name}
                </h3>
                <p className="fb-about-description">
                  {page.page_description || 'Official campus page dedicated to publishing verified announcements, university deadlines, student notices, and campus events.'}
                </p>
                
                <ul className="fb-about-list">
                  <li className="fb-about-item">
                    <i className="fa-solid fa-tag"></i>
                    <div>
                      <span className="fb-about-label">Category</span>
                      <span>{pageCategoryBadge} ({page.page_code || 'PAGE'})</span>
                    </div>
                  </li>
                  {page.department_name && (
                    <li className="fb-about-item">
                      <i className="fa-solid fa-graduation-cap"></i>
                      <div>
                        <span className="fb-about-label">College / Department</span>
                        <span>{page.department_name}</span>
                      </div>
                    </li>
                  )}
                  {page.contact_email && (
                    <li className="fb-about-item">
                      <i className="fa-regular fa-envelope"></i>
                      <div>
                        <span className="fb-about-label">Contact Email</span>
                        <a href={`mailto:${page.contact_email}`} style={{ color: '#7B0D1E', textDecoration: 'none' }}>
                          {page.contact_email}
                        </a>
                      </div>
                    </li>
                  )}
                  <li className="fb-about-item">
                    <i className="fa-regular fa-calendar-check"></i>
                    <div>
                      <span className="fb-about-label">Page Established</span>
                      <span>{page.created_at ? new Date(page.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Official Campus Unit'}</span>
                    </div>
                  </li>
                </ul>
              </article>
            ) : filteredPosts.length === 0 ? (
              /* EMPTY POSTS STATE */
              <div className="fb-empty-feed">
                <i className="fa-regular fa-folder-open fb-empty-icon"></i>
                <h4>No {activeTab === 'all' ? 'posts' : activeTab} published yet</h4>
                <p>Check back later for new announcements and upcoming campus events from this page.</p>
              </div>
            ) : (
              /* POST CARDS */
              filteredPosts.map((item, idx) => {
                const isEvent = item.post_type === 'event';
                const postDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                const isRegistered = !!item.is_registered;

                return (
                  <article key={item.id || item.post_id || idx} className="fb-post-card">
                    {/* Post Author Header */}
                    <div className="fb-post-header">
                      <div className="fb-post-author">
                        <div className="fb-post-author-avatar">
                          {page.avatar_url ? (
                            <img src={page.avatar_url} alt={page.page_name} />
                          ) : (
                            <span>{pageAvatarText}</span>
                          )}
                        </div>
                        <div>
                          <div className="fb-post-author-name">{page.page_name}</div>
                          <div className="fb-post-time">
                            <span>{postDate}</span>
                            <span>•</span>
                            <span>{item.category_name || 'General'}</span>
                          </div>
                        </div>
                      </div>

                      <span className={`fb-post-type-tag ${isEvent ? 'fb-tag-event' : 'fb-tag-announcement'}`}>
                        {isEvent ? 'Event' : 'Announcement'}
                      </span>
                    </div>

                    {/* Post Content */}
                    <div className="fb-post-body">
                      {item.title && <h3 className="fb-post-title">{item.title}</h3>}
                      <p className="fb-post-text">{item.content || item.description || ''}</p>
                    </div>

                    {/* Post Image Attachment */}
                    {item.image_url && (
                      <div className="fb-post-media">
                        <img src={item.image_url} alt={item.title || 'Post attachment'} />
                      </div>
                    )}

                    {/* Event RSVP / Registration Box */}
                    {isEvent && (
                      <div className="fb-event-box">
                        <div className="fb-event-grid">
                          <div className="fb-event-row">
                            <i className="fa-regular fa-calendar"></i>
                            <span>
                              <strong>Date:</strong> {item.event_date ? new Date(item.event_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA'}
                            </span>
                          </div>
                          <div className="fb-event-row">
                            <i className="fa-solid fa-location-dot"></i>
                            <span>
                              <strong>Venue:</strong> {item.location || item.venue || 'University Campus'}
                            </span>
                          </div>
                          <div className="fb-event-row">
                            <i className="fa-solid fa-users"></i>
                            <span>
                              <strong>Capacity:</strong> {item.registered_count || 0} / {item.capacity || 'Unlimited'} registered
                            </span>
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => handleEventRegister(item.id || item.post_id, isRegistered)}
                            disabled={registeringEventId === (item.id || item.post_id)}
                            className={`btn-fb ${isRegistered ? 'btn-fb-following' : 'btn-fb-primary'}`}
                            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                          >
                            {registeringEventId === (item.id || item.post_id) ? (
                              <i className="fa-solid fa-spinner fa-spin"></i>
                            ) : isRegistered ? (
                              <>
                                <i className="fa-solid fa-circle-check" style={{ color: '#059669' }}></i>
                                <span>Registered</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-ticket"></i>
                                <span>Register Now</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Post Footer Bar */}
                    <div className="fb-post-footer">
                      <span>Official WMSU Notice</span>
                      <button 
                        type="button" 
                        onClick={handleShare}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <i className="fa-solid fa-share"></i>
                        <span>Share</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* RIGHT COLUMN: FACEBOOK SIDEBAR CARDS */}
          <aside className="fb-sidebar-col">
            
            {/* About Card */}
            <div className="fb-card">
              <h3 className="fb-card-title">
                <i className="fa-solid fa-circle-info"></i>
                About
              </h3>
              <p className="fb-about-description">
                {page.page_description || 'Western Mindanao State University official campus department and service page.'}
              </p>

              <ul className="fb-about-list">
                <li className="fb-about-item">
                  <i className="fa-solid fa-shield-halved"></i>
                  <div>
                    <span className="fb-about-label">Visibility</span>
                    <span>Public Verified Campus Page</span>
                  </div>
                </li>
                {page.contact_email && (
                  <li className="fb-about-item">
                    <i className="fa-regular fa-envelope"></i>
                    <div>
                      <span className="fb-about-label">Contact</span>
                      <span>{page.contact_email}</span>
                    </div>
                  </li>
                )}
                <li className="fb-about-item">
                  <i className="fa-solid fa-users"></i>
                  <div>
                    <span className="fb-about-label">Followers</span>
                    <span>{page.followers_count || 0} students and staff</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Upcoming Events Mini-Widget */}
            {eventsList.length > 0 && (
              <div className="fb-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <h3 className="fb-card-title" style={{ margin: 0 }}>
                    <i className="fa-regular fa-calendar-days"></i>
                    Upcoming Events
                  </h3>
                  <span 
                    onClick={() => setActiveTab('events')} 
                    style={{ fontSize: '0.75rem', color: '#7B0D1E', fontWeight: 700, cursor: 'pointer' }}
                  >
                    See all
                  </span>
                </div>

                <div className="fb-mini-events-list">
                  {eventsList.slice(0, 3).map((ev, i) => {
                    const evDate = ev.event_date ? new Date(ev.event_date) : new Date();
                    const monthStr = evDate.toLocaleString('en-US', { month: 'short' });
                    const dayStr = evDate.getDate();

                    return (
                      <div key={ev.id || i} className="fb-mini-event-item">
                        <div className="fb-mini-event-datebox">
                          <span className="fb-mini-event-month">{monthStr}</span>
                          <span className="fb-mini-event-day">{dayStr}</span>
                        </div>
                        <div className="fb-mini-event-details">
                          <h4 className="fb-mini-event-title">{ev.title}</h4>
                          <div className="fb-mini-event-sub">
                            <i className="fa-solid fa-location-dot" style={{ marginRight: '0.25rem', color: '#94a3b8' }}></i>
                            {ev.location || 'Campus'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Page Statistics Card */}
            <div className="fb-card" style={{ backgroundColor: '#f8fafc' }}>
              <h3 className="fb-card-title">
                <i className="fa-solid fa-chart-simple"></i>
                Page Insights
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                <div style={{ padding: '0.75rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7B0D1E' }}>{page.followers_count || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Followers</div>
                </div>
                <div style={{ padding: '0.75rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{posts.length}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Posts</div>
                </div>
              </div>
            </div>

          </aside>

        </div>
      </main>

      {/* 4. TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fb-toast">
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
