import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '../styles/PageView.css';
import '../styles/StudentDashboard.css';
import { PortalNavbar, buildPortalProfileMenuItems, EventPostMeta, EventPostActionBar, PostAudienceBadge, getInitials } from '../../assets/components/PortalShellElements';
import { formatPostTimestamp } from '../../utils/dateUtils';

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
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [removePostImage, setRemovePostImage] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role') || role;
  const isStaff = userRole === 'staff';
  const homeHref = token ? (isStaff ? '/staff/dashboard' : '/student/dashboard') : '/';

  let parsedUser = null;
  try {
    const rawUser = localStorage.getItem('user');
    parsedUser = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    parsedUser = null;
  }
  const profileTitle = parsedUser
    ? `${parsedUser.first_name || ''} ${parsedUser.last_name || ''}`.trim() || 'Campus Member'
    : 'Guest Viewer';
  const profileSubtitle = parsedUser
    ? (parsedUser.program_name || parsedUser.course || parsedUser.department_name || (isStaff ? 'Staff' : 'Student'))
    : 'WMSU Portal';
  const profileInitials = getInitials(profileTitle, 'WM');

  // Navbar search, notifications & profile dropdown state (matching MyPage navbar)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);
  const [hasApprovedPage, setHasApprovedPage] = useState(false);

  useEffect(() => {
    if (!token || !isStaff) {
      setHasApprovedPage(false);
      return;
    }

    let cancelled = false;
    fetch('/api/my-page-status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setHasApprovedPage(
            Boolean(data.exists && (data.status === 'approved' || data.status === 'active'))
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, isStaff]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !token) {
      setSearchResults([]);
      setIsSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(q)}&type=${filterCategory}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, filterCategory, token]);

  useEffect(() => {
    if (!token) return;
    const fetchNotifications = async () => {
      try {
        setLoadingNotifs(true);
        const res = await fetch('http://localhost:5000/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch {
        // Ignore silent notification fetch error
      } finally {
        setLoadingNotifs(false);
      }
    };
    fetchNotifications();
  }, [token]);

  const handleToggleFilter = () => {
    const order = ['all', 'announcements', 'events', 'departments'];
    const next = order[(order.indexOf(filterCategory) + 1) % order.length];
    setFilterCategory(next);
  };

  const handleSelectSearchResult = (item, openOnly) => {
    if (openOnly) {
      setShowDropdown(true);
      return;
    }
    setShowDropdown(false);
    if (!item) return;
    if (item.type === 'page') {
      navigate(isStaff ? `/staff/page/${item.id}` : `/student/page/${item.id}`);
    } else if (item.type === 'event') {
      navigate(isStaff ? '/staff/events' : '/student/events');
    } else {
      navigate(isStaff ? '/staff/announcements' : '/student/announcements');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await fetch('http://localhost:5000/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore silent failure
    }
  };

  const handleNotifClick = async (notif) => {
    setShowNotifDropdown(false);
    if (!notif.is_read && token) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      try {
        await fetch(`http://localhost:5000/api/notifications/${notif.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore silent failure
      }
    }
    if (notif.link) navigate(notif.link);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/auth');
  };

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;
  const profileMenuItems = token
    ? buildPortalProfileMenuItems({
        role: isStaff ? 'staff' : 'student',
        hasApprovedPage: isStaff && hasApprovedPage,
        swapDashboardHref: '/staff/mypage/dashboard',
        extraItems: [
          {
            label: 'Dashboard',
            href: homeHref,
            icon: 'fa-solid fa-house',
          },
        ],
      })
    : [
        {
          label: 'Sign In',
          icon: 'fa-solid fa-right-to-bracket',
          onClick: () => navigate('/auth'),
        },
      ];

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
        fetchPageData();
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

  const handleOpenEditPost = (item) => {
    setEditingPost(item);
    setPostTitle(item.title || '');
    setPostContent(item.content || item.description || '');
    setPostImagePreview(item.image_url || null);
    setRemovePostImage(false);
    setActiveMenuId(null);
  };

  const handlePostImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Selected image exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPostImagePreview(reader.result);
      setRemovePostImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost || !token) return;
    setSubmittingPost(true);

    const isEvent = editingPost.post_type === 'event';
    const targetId = editingPost.id || editingPost.post_id;
    const editEndpoint = isEvent
      ? `http://localhost:5000/api/events/${targetId}`
      : `http://localhost:5000/api/announcements/${targetId}`;

    try {
      const bodyData = isEvent
        ? {
            event_title: postTitle,
            event_description: postContent,
            image_data: postImagePreview,
            remove_image: removePostImage,
          }
        : {
            title: postTitle,
            content: postContent,
            image_data: postImagePreview,
            remove_image: removePostImage,
          };

      const res = await fetch(editEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        const updatedImg =
          resData.announcement?.image_url ??
          resData.event?.image_url ??
          (removePostImage ? null : postImagePreview);
        setPosts((prev) =>
          prev.map((p) => {
            const pId = p.id || p.post_id;
            return pId === targetId
              ? { ...p, title: postTitle, content: postContent, description: postContent, image_url: updatedImg }
              : p;
          })
        );
        showToast('Post updated successfully!');
        setEditingPost(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'Failed to update post.');
      }
    } catch (err) {
      console.error('Error editing post:', err);
      showToast('Network error while updating post.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost || !token) return;
    const isEvent = deletingPost.post_type === 'event';
    const deleteId = deletingPost.id || deletingPost.post_id;
    const deleteEndpoint = isEvent
      ? `http://localhost:5000/api/events/${deleteId}`
      : `http://localhost:5000/api/announcements/${deleteId}`;

    try {
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => (p.id || p.post_id) !== deleteId));
        showToast('Post deleted.');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'Failed to delete post.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      showToast('Network error while deleting post.');
    } finally {
      setDeletingPost(null);
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
      {/* 1. TOP NAVIGATION BAR (Same as MyPage Navbar) */}
      <div
        className="student-dashboard-wrapper fb-shell-layout"
        style={{
          width: '100%',
          minHeight: '72px',
          height: 'auto',
          flexShrink: 0,
          overflow: 'visible',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: '#ffffff',
        }}
      >
        <PortalNavbar
          homeHref={homeHref}
          homeAriaLabel="CRIMSON Home"
          isMobileMenuOpen={false}
          onToggleMobileMenu={handleGoBack}
          searchQuery={searchQuery}
          onSearchChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(Boolean(e.target.value.trim()));
          }}
          filterCategory={filterCategory}
          onToggleFilter={handleToggleFilter}
          searchResults={searchResults}
          isSearching={isSearching}
          showSearchDropdown={showDropdown}
          onSelectSearchResult={handleSelectSearchResult}
          searchContainerRef={searchContainerRef}
          showQrButton={Boolean(token)}
          qrHref={isStaff ? '/staff/attendance/check-in/scan' : '/student/attendance/check-in/scan'}
          notifications={notifications}
          loadingNotifs={loadingNotifs}
          unreadNotifCount={unreadNotifCount}
          showNotifDropdown={showNotifDropdown}
          onToggleNotifDropdown={() => setShowNotifDropdown((prev) => !prev)}
          onMarkAllAsRead={handleMarkAllAsRead}
          onNotifClick={handleNotifClick}
          notifDropdownRef={notifDropdownRef}
          profileTitle={profileTitle}
          profileSubtitle={profileSubtitle}
          profileInitials={profileInitials}
          showProfileDropdown={showProfileDropdown}
          onToggleProfileDropdown={() => setShowProfileDropdown((prev) => !prev)}
          onCloseProfileDropdown={() => setShowProfileDropdown(false)}
          profileDropdownRef={profileDropdownRef}
          profileMenuItems={profileMenuItems}
          onLogout={token ? handleLogout : () => navigate('/auth')}
        />
      </div>

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
                  <span>Following</span>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    <span>Follow</span>
                  </>
                )}
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
              <span>All Posts</span>
              <span className="fb-tab-count">{posts.length}</span>
            </button>

            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'announcements' ? 'active' : ''}`}
              onClick={() => setActiveTab('announcements')}
            >
              <span>Announcements</span>
              <span className="fb-tab-count">{announcementsList.length}</span>
            </button>

            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <span>Events</span>
              <span className="fb-tab-count">{eventsList.length}</span>
            </button>

            <button 
              type="button" 
              className={`fb-tab-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
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
                      <i className="fa-solid fa-envelope"></i>
                      <div>
                        <span className="fb-about-label">Contact Email</span>
                        <a href={`mailto:${page.contact_email}`} style={{ color: '#7B0D1E', textDecoration: 'none' }}>
                          {page.contact_email}
                        </a>
                      </div>
                    </li>
                  )}
                  <li className="fb-about-item">
                    <i className="fa-solid fa-calendar-check"></i>
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
                <i className="fa-solid fa-folder-open fb-empty-icon"></i>
                <h4>No {activeTab === 'all' ? 'posts' : activeTab} published yet</h4>
                <p>Check back later for new announcements and upcoming campus events from this page.</p>
              </div>
            ) : (
              /* POST CARDS */
              filteredPosts.map((item, idx) => {
                const isEvent = item.post_type === 'event';
                const postDate = formatPostTimestamp(item.created_at);
                const isRegistered = !!item.is_registered;
                const postImage = item.image_url;
                const currentRegistered = item.registered_count || 0;
                const maxCapacity = item.capacity || 'Unlimited';
                const locationText = item.location || item.venue || 'University Campus';

                return (
                  <article
                    key={item.id || item.post_id || idx}
                    className="card card-interactive"
                    style={{
                      padding: '1rem 0',
                      backgroundColor: '#ffffff',
                      borderRadius: '1.25rem',
                      border: '1px solid var(--slate-200, #e2e8f0)',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                      overflow: 'hidden',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {/* 1. FEED-STYLE POST HEADER */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0 1rem 0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #9f1239 0%, #881337 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          {page.avatar_url ? (
                            <img src={page.avatar_url} alt={page.page_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span>{pageAvatarText}</span>
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {page.page_name}
                          </h4>
                          <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {isEvent ? (
                              <EventPostMeta
                                registeredCount={currentRegistered}
                                capacity={item.max_capacity || item.capacity}
                                createdAt={item.created_at}
                                audience={item.audience}
                              />
                            ) : (
                              <>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Announcement • {postDate}</span>
                                <span>•</span>
                                <PostAudienceBadge audience={item.audience} />
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {(page.is_owner || item.is_owner) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            aria-label="Post options"
                            title="More options"
                            onClick={() => {
                              const key = item.id || item.post_id || idx;
                              setActiveMenuId((prev) => (prev === key ? null : key));
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#16162b',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1rem' }}></i>
                          </button>

                          {activeMenuId === (item.id || item.post_id || idx) && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 0.25rem)',
                                right: 0,
                                minWidth: '140px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.5rem',
                                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                                padding: '0.25rem',
                                zIndex: 30,
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenEditPost(item)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.5rem 0.75rem',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  color: '#1e293b',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <i className="fa-solid fa-pen-to-square" style={{ color: '#64748b' }}></i>
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingPost(item);
                                  setActiveMenuId(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.5rem 0.75rem',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  color: '#e11d48',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <i className="fa-solid fa-trash"></i>
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. FEED-STYLE MEDIA / CONTENT CONTAINER */}
                    {postImage ? (
                      <>
                        <div
                          style={{
                            backgroundColor: '#0f172a',
                            width: '100%',
                            maxHeight: '450px',
                            overflow: 'hidden',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            position: 'relative',
                          }}
                        >
                          <img
                            src={postImage}
                            alt={item.title || 'Post attachment'}
                            style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ padding: '0.875rem 1rem 0.875rem 1rem' }}>
                          {item.title && (
                            <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                              {item.title}
                            </h3>
                          )}
                          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: item.title ? '0.4rem 0 0 0' : 0 }}>
                            {item.content || item.description || ''}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
                        {item.title && (
                          <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.35, margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                            {item.title}
                          </h3>
                        )}
                        <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.6, margin: item.title ? '0.75rem 0 0 0' : 0 }}>
                          {item.content || item.description || ''}
                        </p>
                      </div>
                    )}

                    {/* 3. EVENT REGISTRATION & ATTENDANCE BAR */}
                    {isEvent && (
                      <EventPostActionBar
                        isRegistered={isRegistered}
                        isRegistering={registeringEventId === (item.id || item.post_id)}
                        onToggleRegister={() => handleEventRegister(item.id || item.post_id, isRegistered)}
                        onScanAttendance={token ? () => {
                          const scanToken = prompt("Scan or enter event QR token:");
                          if (scanToken) {
                            const clean = scanToken.trim().split('/').pop();
                            navigate(isStaff ? `/staff/attendance/check-in/${clean}` : `/student/attendance/check-in/${clean}`);
                          }
                        } : null}
                      />
                    )}
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
                    <i className="fa-solid fa-envelope"></i>
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

      {/* Edit Post Modal */}
      {editingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '0.875rem',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Edit Post</h3>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSavePostEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Content
                </label>
                <textarea
                  rows={4}
                  required
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Image Attachment
                </label>
                {postImagePreview && !removePostImage && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <img
                      src={postImagePreview}
                      alt="Preview"
                      style={{ maxHeight: '160px', borderRadius: '0.5rem', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPostImagePreview(null);
                        setRemovePostImage(true);
                      }}
                      style={{
                        marginTop: '0.35rem',
                        background: 'none',
                        border: 'none',
                        color: '#e11d48',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Remove image
                    </button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handlePostImageSelect} style={{ fontSize: '0.8125rem' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditingPost(null)} className="btn-fb btn-fb-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingPost} className="btn-fb btn-fb-primary">
                  {submittingPost ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {deletingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#ffffff',
              borderRadius: '0.875rem',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Delete Post?
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#475569' }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setDeletingPost(null)} className="btn-fb btn-fb-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePost}
                style={{
                  padding: '0.55rem 1.15rem',
                  backgroundColor: '#e11d48',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
