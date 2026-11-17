import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/PageView.css';
import '../../styles/StudentDashboard.css';
import { PortalNavbar, buildPortalProfileMenuItems, EventPostMeta, PostAudienceBadge, getInitials } from '../../../assets/components/PortalShellElements';
import { formatPostTimestamp } from '../../../utils/dateUtils';
import { usePortalSearch } from '../../../utils/usePortalSearch';

export default function MyPageProfile({ onSwitchToStaffDashboard, fromStaffDashboard = false }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  // Active Dropdown Menu State for Posts
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Page Edit State
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [submittingPage, setSubmittingPage] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Academic College');
  const [editBio, setEditBio] = useState('');
  const [editProfileImage, setEditProfileImage] = useState('');

  // Post Edit State
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postType, setPostType] = useState('Announcement');
  const [postContent, setPostContent] = useState('');
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [removePostImage, setRemovePostImage] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Post Delete State
  const [deletingPost, setDeletingPost] = useState(null);

  // Navbar search, notifications & profile dropdown state
  const {
    searchQuery,
    filterCategory,
    searchResults,
    isSearching,
    showDropdown,
    searchContainerRef,
    handleSearchChange,
    handleToggleFilter,
    handleSelectSearchResult,
  } = usePortalSearch('mypage');

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchPageData();

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
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
        // Ignore silent fetch errors
      } finally {
        setLoadingNotifs(false);
      }
    };
    fetchNotifications();
  }, [token]);

  const fetchPageData = async () => {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/my-page-status', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      if (response.ok && data.exists) {
        const pName = data.pageName || data.name || '';
        const rawApprovalStatus = data.status || 'pending';
        const formattedApproval = rawApprovalStatus.charAt(0).toUpperCase() + rawApprovalStatus.slice(1).toLowerCase();
        const imgUrl = data.profile_image || data.logo || data.image_url || '';

        const loadedPage = {
          pageId: data.pageId || data.page_id,
          name: pName,
          code: data.pageCode || 'WMSU',
          category: data.category,
          description: data.description || data.page_description,
          approvalStatus: formattedApproval,
          pageStatus: data.pageStatus || 'Active',
          profileImage: imgUrl,
          coverUrl: data.cover_url || '',
          followersCount: data.followers_count || data.followersCount || 0,
        };

        setPageData(loadedPage);
        setEditName(pName);
        setEditCategory(data.category || '');
        setEditBio(data.description || data.page_description || '');
        setEditProfileImage(imgUrl);

        fetchPagePosts(loadedPage.pageId, authToken);
      }
    } catch (error) {
      console.error('Error fetching page data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPagePosts = async (pageId, authToken) => {
    try {
      const res = await fetch(`http://localhost:5000/api/mypage/posts?pageId=${pageId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const postData = await res.json();
        const announcements = (postData.announcements || []).map((a) => ({ ...a, type: 'Announcement' }));
        const events = (postData.events || []).map((e) => ({ ...e, type: 'Event' }));
        const postList = Array.isArray(postData) ? postData : [...announcements, ...events];
        const sorted = postList.sort(
          (a, b) =>
            new Date(b.created_at || b.date || b.eventDate || b.event_date) -
            new Date(a.created_at || a.date || a.eventDate || a.event_date)
        );
        setPosts(sorted);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Error fetching page posts:', err);
      setPosts([]);
    }
  };

  const handleUpdatePage = async (e) => {
    e.preventDefault();
    setSubmittingPage(true);

    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/mypage/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          pageName: editName,
          category: editCategory,
          description: editBio,
          profileImage: editProfileImage,
        }),
      });

      if (response.ok) {
        setIsEditingPage(false);
        fetchPageData();
      } else {
        setPageData((prev) => ({
          ...prev,
          name: editName,
          category: editCategory,
          description: editBio || 'No description provided.',
          profileImage: editProfileImage,
        }));
        setIsEditingPage(false);
      }
    } catch (err) {
      console.error('Error updating page:', err);
      setIsEditingPage(false);
    } finally {
      setSubmittingPage(false);
    }
  };

  const handleOpenEditPost = (post) => {
    setEditingPost(post);
    setPostTitle(post.title || post.event_title || '');
    setPostType(post.type || 'Announcement');
    setPostContent(post.content || post.description || post.event_description || '');
    setPostImagePreview(post.image_url || post.image || null);
    setRemovePostImage(false);
    setActiveMenuId(null);
  };

  const handlePostImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Selected image exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result;
      if (file.type === 'image/gif') {
        setPostImagePreview(rawDataUrl);
        setRemovePostImage(false);
        return;
      }
      const img = new Image();
      img.onerror = () => {
        setPostImagePreview(rawDataUrl);
        setRemovePostImage(false);
      };
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        setPostImagePreview(ctx ? (ctx.drawImage(img, 0, 0, width, height), canvas.toDataURL('image/jpeg', 0.85)) : rawDataUrl);
        setRemovePostImage(false);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    setSubmittingPost(true);

    const isEvent = editingPost.type === 'Event' || Boolean(editingPost.event_id || editingPost.event_title);
    const targetId = isEvent
      ? editingPost.event_id || editingPost.id
      : editingPost.announcement_id || editingPost.id;
    const editEndpoint = isEvent
      ? `http://localhost:5000/api/events/${targetId}`
      : `http://localhost:5000/api/announcements/${targetId}`;
    const authToken = localStorage.getItem('token');

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
          Authorization: `Bearer ${authToken}`,
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
            const pId = isEvent ? p.event_id || p.id : p.announcement_id || p.id;
            return pId === targetId
              ? { ...p, title: postTitle, content: postContent, description: postContent, image_url: updatedImg }
              : p;
          })
        );
      } else {
        alert('Failed to update post.');
      }
    } catch (err) {
      console.error('Error editing post:', err);
      alert('Network error while updating post.');
    } finally {
      setSubmittingPost(false);
      setEditingPost(null);
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost) return;
    const authToken = localStorage.getItem('token');

    const isEventPost = deletingPost.type === 'Event' || Boolean(deletingPost.event_id || deletingPost.event_title);
    const deleteId = isEventPost
      ? deletingPost.event_id || deletingPost.id
      : deletingPost.announcement_id || deletingPost.id;
    const deleteEndpoint = isEventPost
      ? `http://localhost:5000/api/events/${deleteId}`
      : `http://localhost:5000/api/announcements/${deleteId}`;

    try {
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p !== deletingPost));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to delete post.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Network error while deleting post.');
    } finally {
      setDeletingPost(null);
      setActiveMenuId(null);
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

  const pageName = pageData?.name || 'College Of Computing Studies';
  const pageCode = pageData?.code || 'COCS';
  const pageCategory = pageData?.category || 'Academic College';
  const pageDescription = pageData?.description || 'No description provided.';
  const avatarFallback = getInitials(pageName, pageCode);
  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;

  const profileMenuItems = buildPortalProfileMenuItems({
    role: 'staff',
    hasApprovedPage: true,
    swapDashboardHref: '/staff/dashboard',
    onSwapDashboard: () => {
      if (onSwitchToStaffDashboard) onSwitchToStaffDashboard();
      else navigate('/staff/dashboard');
    },
    extraItems: [
      {
        label: 'MyPage Feed',
        href: '/staff/mypage/dashboard',
        icon: 'fa-solid fa-house',
      },
      {
        label: 'Page Settings',
        href: '/staff/mypage/settings',
        icon: 'fa-solid fa-sliders',
      },
    ],
  });

  const navbarBlock = (
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
        homeHref={fromStaffDashboard ? '/staff/dashboard' : '/staff/mypage/dashboard'}
        homeAriaLabel={fromStaffDashboard ? 'Staff Dashboard' : 'MyPage Home'}
        isMobileMenuOpen={false}
        onToggleMobileMenu={() => navigate(fromStaffDashboard ? '/staff/dashboard' : '/staff/mypage/dashboard')}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        filterCategory={filterCategory}
        onToggleFilter={handleToggleFilter}
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
        onToggleNotifDropdown={() => setShowNotifDropdown((prev) => !prev)}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNotifClick={handleNotifClick}
        notifDropdownRef={notifDropdownRef}
        profileTitle={pageName}
        profileSubtitle={pageCategory}
        profileInitials={avatarFallback}
        showProfileDropdown={showProfileDropdown}
        onToggleProfileDropdown={() => setShowProfileDropdown((prev) => !prev)}
        onCloseProfileDropdown={() => setShowProfileDropdown(false)}
        profileDropdownRef={profileDropdownRef}
        profileMenuItems={profileMenuItems}
        onLogout={handleLogout}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="pageview-wrapper">
        {navbarBlock}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
          <p style={{ color: '#7B0D1E', fontWeight: 600, fontSize: '1.1rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
            Loading Page Profile...
          </p>
        </div>
      </div>
    );
  }

  const announcementsList = posts.filter((p) => p.type !== 'Event' && !p.event_id && !p.event_title);
  const eventsList = posts.filter((p) => p.type === 'Event' || Boolean(p.event_id || p.event_title));

  let filteredPosts = posts;
  if (activeTab === 'announcements') filteredPosts = announcementsList;
  else if (activeTab === 'events') filteredPosts = eventsList;

  return (
    <div className="pageview-wrapper">
      {/* 1. TOP NAVIGATION BAR (Same as MyPage Navbar) */}
      {navbarBlock}

      {/* 2. PAGEVIEW HERO COVER & PROFILE SECTION */}
      <section className="fb-cover-container">
        <div className="fb-cover-inner">
          <div className="fb-cover-banner">
            {pageData?.coverUrl ? (
              <img src={pageData.coverUrl} alt={`${pageName} Cover`} />
            ) : (
              <div className="fb-cover-overlay">
                <div className="fb-cover-watermark">WMSU</div>
              </div>
            )}
          </div>

          <div className="fb-header-content">
            <div className="fb-profile-block">
              <div className="fb-avatar-box">
                {pageData?.profileImage ? (
                  <img src={pageData.profileImage} alt={pageName} />
                ) : (
                  <div className="fb-avatar-fallback">{avatarFallback}</div>
                )}
              </div>

              <div className="fb-name-meta">
                <h1 className="fb-page-title">{pageName}</h1>
                <div className="fb-page-subtitle">
                  <span className="fb-badge-pill">
                    <i className="fa-solid fa-certificate"></i>
                    {pageCategory}
                  </span>
                  <span>•</span>
                  <span><strong>{pageData?.followersCount || 0}</strong> followers</span>
                  <span>•</span>
                  <span><strong>{posts.length}</strong> posts</span>
                </div>
              </div>
            </div>

            <div className="fb-actions-group">
              <button
                type="button"
                onClick={() => setIsEditingPage(true)}
                className="btn-fb btn-fb-primary"
              >
                <i className="fa-solid fa-pen-to-square"></i>
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/staff/mypage/dashboard')}
                className="btn-fb btn-fb-secondary"
              >
                {fromStaffDashboard ? (
                  <>
                    <i className="fa-solid fa-right-left"></i>
                    <span>Switch Now</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-arrow-left"></i>
                    <span>Back to Feed</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="fb-tabs-divider"></div>

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

      {/* 3. PAGEVIEW 2-COLUMN BODY (NO LEFT/RIGHT DASHBOARD SIDEBARS) */}
      <main className="fb-main-container">
        <div className="fb-body-grid">
          <div className="fb-feed-col" ref={menuRef}>
            {activeTab === 'about' ? (
              <article className="fb-card">
                <h3 className="fb-card-title">
                  <i className="fa-solid fa-building-columns"></i>
                  Page Information &amp; Details
                </h3>
                <p className="fb-about-description">{pageDescription}</p>
                <ul className="fb-about-list">
                  <li className="fb-about-item">
                    <i className="fa-solid fa-tag"></i>
                    <div>
                      <span className="fb-about-label">Category</span>
                      <span>{pageCategory}</span>
                    </div>
                  </li>
                  <li className="fb-about-item">
                    <i className="fa-solid fa-circle-check"></i>
                    <div>
                      <span className="fb-about-label">Approval Status</span>
                      <span>{pageData?.approvalStatus || 'Approved'}</span>
                    </div>
                  </li>
                  <li className="fb-about-item">
                    <i className="fa-solid fa-signal"></i>
                    <div>
                      <span className="fb-about-label">Page Status</span>
                      <span>{pageData?.pageStatus || 'Active'}</span>
                    </div>
                  </li>
                </ul>
              </article>
            ) : filteredPosts.length === 0 ? (
              <div className="fb-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#64748b' }}>
                <i className="fa-solid fa-folder-open" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.75rem' }}></i>
                <h3 style={{ margin: '0 0 0.25rem 0', color: '#334155', fontSize: '1.05rem' }}>No posts yet</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  {activeTab === 'events'
                    ? 'There are no events published on this page yet.'
                    : activeTab === 'announcements'
                      ? 'There are no announcements published on this page yet.'
                      : 'This page has not published any announcements or events yet.'}
                </p>
              </div>
            ) : (
              filteredPosts.map((item, idx) => {
                const isEvent = item.type === 'Event' || Boolean(item.event_id || item.event_title);
                const postId = item.id || item.post_id || item.event_id || item.announcement_id || idx;
                const postDate = formatPostTimestamp(item.created_at || item.date || item.eventDate || item.event_date);
                const postImage = item.image_url || item.image || null;
                const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
                const maxCapacity = item.max_capacity || item.capacity || 'Unlimited';
                const locationText = item.location || item.venue || 'University Campus';
                const titleText = item.title || item.event_title || '';
                const bodyText = item.content || item.description || item.event_description || '';

                return (
                  <article
                    key={postId}
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
                          {pageData?.profileImage ? (
                            <img src={pageData.profileImage} alt={pageName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span>{avatarFallback}</span>
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {pageName}
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', flexShrink: 0 }}>
                        <button
                          type="button"
                          aria-label="Post options"
                          title="More options"
                          onClick={() => setActiveMenuId((prev) => (prev === postId ? null : postId))}
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

                        {activeMenuId === postId && (
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
                    </div>

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
                            alt={titleText || 'Post attachment'}
                            style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ padding: '0.875rem 1rem 0.875rem 1rem' }}>
                          {titleText && (
                            <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                              {titleText}
                            </h3>
                          )}
                          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: titleText ? '0.4rem 0 0 0' : 0 }}>
                            {bodyText}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
                        {titleText && (
                          <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.35, margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                            {titleText}
                          </h3>
                        )}
                        <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.6, margin: titleText ? '0.75rem 0 0 0' : 0 }}>
                          {bodyText}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <aside className="fb-sidebar-col">
            <div className="fb-card">
              <h3 className="fb-card-title">
                <i className="fa-solid fa-circle-info"></i>
                About
              </h3>
              <p className="fb-about-description">{pageDescription}</p>
              <ul className="fb-about-list">
                <li className="fb-about-item">
                  <i className="fa-solid fa-building"></i>
                  <div>
                    <span className="fb-about-label">Category</span>
                    <span>{pageCategory}</span>
                  </div>
                </li>
                <li className="fb-about-item">
                  <i className="fa-solid fa-circle-check"></i>
                  <div>
                    <span className="fb-about-label">Status</span>
                    <span>{pageData?.approvalStatus || 'Approved'} • {pageData?.pageStatus || 'Active'}</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="fb-card" style={{ backgroundColor: '#f8fafc' }}>
              <h3 className="fb-card-title">
                <i className="fa-solid fa-chart-simple"></i>
                Page Insights
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                <div style={{ padding: '0.75rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7B0D1E' }}>{pageData?.followersCount || 0}</div>
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

      {/* Edit Page Profile Modal */}
      {isEditingPage && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', maxWidth: '500px', width: '100%', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Edit Page Profile</h3>
              <button type="button" onClick={() => setIsEditingPage(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleUpdatePage}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="editName" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Page Name</label>
                <input
                  type="text"
                  id="editName"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="editProfileImage" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Profile Image URL (Logo / Avatar)</label>
                <input
                  type="url"
                  id="editProfileImage"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  placeholder="https://example.com/logo.png"
                  value={editProfileImage}
                  onChange={(e) => setEditProfileImage(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="editCategory" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Category</label>
                <select
                  id="editCategory"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  required
                >
                  <option value="Academic College">Academic College</option>
                  <option value="Administrative Office">Administrative Office</option>
                  <option value="Student Organization">Student Organization</option>
                  <option value="Campus Council">Campus Council</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="editBio" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Description</label>
                <textarea
                  id="editBio"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  rows="4"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditingPage(false)}
                  className="btn-fb btn-fb-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPage}
                  className="btn-fb btn-fb-primary"
                >
                  {submittingPage ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Edit Post</h3>
              <button type="button" onClick={() => setEditingPost(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleSavePostEdit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Post Title</label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Post Type</label>
                <select
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  required
                >
                  <option value="Announcement">Announcement</option>
                  <option value="Event">Event</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Content / Description</label>
                <textarea
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  rows="5"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Post Image (Stored in Database)</label>
                {postImagePreview && (
                  <div style={{ position: 'relative', width: '100%', maxHeight: '220px', overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                    <img src={postImagePreview} alt="Post preview" style={{ width: '100%', height: 'auto', objectFit: 'cover', display: 'block' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setPostImagePreview(null);
                        setRemovePostImage(true);
                      }}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', border: 'none', borderRadius: '9999px', padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePostImageSelect}
                  style={{ fontSize: '0.8125rem', color: '#475569' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="btn-fb btn-fb-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="btn-fb btn-fb-primary"
                >
                  {submittingPost ? 'Updating...' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPost && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', margin: '0 auto 1rem' }}>
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Delete Post?</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button type="button" onClick={() => setDeletingPost(null)} className="btn-fb btn-fb-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePost}
                style={{ padding: '0.55rem 1.25rem', backgroundColor: '#e11d48', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
