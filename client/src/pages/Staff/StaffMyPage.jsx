import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';
import '../styles/MyPage.css';

export default function StaffMyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [posts, setPosts] = useState([]);
  
  // Active Dropdown Menu State for Posts
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Edit Page State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editProfileImage, setEditProfileImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initial creation form state if page doesn't exist yet
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('1'); 
  const [organizationId, setOrganizationId] = useState('1');
  const [pageBio, setPageBio] = useState('');
  const [pageProfileImage, setPageProfileImage] = useState('');

  // Post Edit Modal State
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postType, setPostType] = useState('Announcement');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Post Delete State
  const [deletingPost, setDeletingPost] = useState(null);

  useEffect(() => {
    fetchPageData();

    // Close dropdown menu when clicking outside
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPageData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/my-page-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok && data.exists) {
        const pName = data.pageName || data.name || '';
        const rawApprovalStatus = data.status || 'pending';
        const formattedApproval = rawApprovalStatus.charAt(0).toUpperCase() + rawApprovalStatus.slice(1).toLowerCase();
        const imgUrl = data.profile_image || data.logo || data.image_url || '';

        setPageData({
          pageId: data.pageId || data.page_id,
          name: pName,
          category: data.category,
          description: data.description || data.page_description,
          approvalStatus: formattedApproval,
          pageStatus: data.pageStatus || 'Active',
          profileImage: imgUrl
        });

        setEditName(pName);
        setEditCategory(data.category || '');
        setEditBio(data.description || data.page_description || '');
        setEditProfileImage(imgUrl);

        fetchPagePosts(data.pageId || data.page_id, token);
      }
    } catch (error) {
      console.error('Error fetching page data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPagePosts = async (pageId, token) => {
    try {
      const res = await fetch(`http://localhost:5000/api/mypage/posts?pageId=${pageId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const postData = await res.json();
        const announcements = (postData.announcements || []).map(a => ({ ...a, type: 'Announcement' }));
        const events = (postData.events || []).map(e => ({ ...e, type: 'Event' }));
        const postList = [...announcements, ...events];
        const sorted = postList.sort((a, b) => new Date(b.date || b.created_at || b.eventDate) - new Date(a.date || a.created_at || a.eventDate));
        setPosts(sorted);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Error fetching page posts:', err);
      setPosts([]);
    }
  };

  const handleCreatePage = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You are not logged in properly.');
        setSubmitting(false);
        return;
      }

      const payload = {
        pageName, 
        pageCategory, 
        pageDescription: pageBio,
        profileImage: pageProfileImage
      };

      if (pageCategory === 'Student Organization' || pageCategory === 'Campus Council') {
        payload.organizationId = Number(organizationId);
      } else {
        payload.departmentId = Number(departmentId);
      }

      const response = await fetch('http://localhost:5000/api/create-page', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        fetchPageData();
      } else {
        alert(`Error: ${data.message || 'Failed to create page'}`);
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Failed to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePage = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/mypage/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pageName: editName,
          category: editCategory,
          description: editBio,
          profileImage: editProfileImage
        })
      });

      const data = await response.json();
      if (response.ok) {
        setIsEditing(false);
        fetchPageData();
      } else {
        alert(`Error updating page: ${data.message || 'Failed to update'}`);
      }
    } catch (err) {
      console.error('Error updating page:', err);
      alert('Failed to connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditPost = (post) => {
    setEditingPost(post);
    setPostTitle(post.title || '');
    setPostType(post.type || 'Announcement');
    setPostContent(post.content || post.description || '');
    setActiveMenuId(null);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    setSubmittingPost(true);

    const isEvent = editingPost.type === 'Event';
    const targetId = isEvent
      ? (editingPost.event_id || editingPost.id)
      : (editingPost.announcement_id || editingPost.id);
    const editEndpoint = isEvent
      ? `http://localhost:5000/api/events/${targetId}`
      : `http://localhost:5000/api/announcements/${targetId}`;
    const token = localStorage.getItem('token');

    try {
      const bodyData = isEvent ? {
        event_title: postTitle,
        event_description: postContent
      } : {
        title: postTitle,
        content: postContent
      };

      const res = await fetch(editEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => {
          const pId = isEvent ? (p.event_id || p.id) : (p.announcement_id || p.id);
          return pId === targetId ? { ...p, title: postTitle, content: postContent, description: postContent } : p;
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to update post.');
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
    const token = localStorage.getItem('token');

    const isEventPost = deletingPost.type === 'Event';
    const deleteId = isEventPost
      ? (deletingPost.event_id || deletingPost.id)
      : (deletingPost.announcement_id || deletingPost.id);
    const deleteEndpoint = isEventPost
      ? `http://localhost:5000/api/events/${deleteId}`
      : `http://localhost:5000/api/announcements/${deleteId}`;

    try {
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setPosts(prev => prev.filter(p => p !== deletingPost));
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

  const getApprovalBadgeStyle = (status) => {
    switch (status) {
      case 'Approved':
        return { backgroundColor: 'var(--emerald-50)', color: 'var(--emerald-700)', borderColor: 'var(--emerald-100)' };
      case 'Rejected':
        return { backgroundColor: 'var(--rose-50)', color: 'var(--rose-600)', borderColor: 'var(--rose-100)' };
      case 'Pending':
      default:
        return { backgroundColor: 'var(--amber-100)', color: 'var(--amber-800)', borderColor: '#fde68a' };
    }
  };

  const getPageStatusBadgeStyle = (status) => {
    if (status === 'Active') {
      return { backgroundColor: 'var(--emerald-50)', color: 'var(--emerald-700)', borderColor: 'var(--emerald-100)' };
    }
    return { backgroundColor: 'var(--slate-100)', color: 'var(--slate-600)', borderColor: 'var(--slate-300)' };
  };

  const hideScrollbarStyle = `
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `;

  if (loading) {
    return (
      <StaffDashboardLayout activePage="mypage">
        <style>{hideScrollbarStyle}</style>
        <main className="lg-col-6 space-y-6 no-scrollbar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', fontWeight: 600, fontSize: '0.9375rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-accent)' }}></i>
            <p>Loading My Page Profile...</p>
          </div>
        </main>
      </StaffDashboardLayout>
    );
  }

  const avatarFallback = pageData?.name ? pageData.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() : 'WMSU';

  return (
    <StaffDashboardLayout activePage="mypage">
      <style>{hideScrollbarStyle}</style>
      <main className="lg-col-6 no-scrollbar" style={{ paddingBottom: '3rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {pageData ? (
          <>
            {/* Page Header Profile Card with Profile Image */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-card)', position: 'relative' }}>
              
              {/* Top-Right Action Buttons */}
              <div style={{ position: 'absolute', top: '1.75rem', right: '1.75rem', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{ backgroundColor: '#ffffff', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)', padding: '0.55rem 1.15rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                >
                  <i className="fa-solid fa-pen-to-square" style={{ fontSize: '0.75rem' }}></i> Edit
                </button>

                <button 
                  onClick={() => navigate('/staff/mypage/dashboard')}
                  style={{ background: 'var(--nav-gradient)', color: '#ffffff', border: 'none', padding: '0.55rem 1.125rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                >
                    MyPage <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                </button>
              </div>

              {/* Header Content with Profile Image & Text alignment */}
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', paddingRight: '220px', flexWrap: 'wrap' }}>
                
                {/* Profile Image Avatar */}
                <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', backgroundColor: '#fbe4e8', color: '#8c1030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--slate-200)' }}>
                  {pageData.profileImage ? (
                    <img src={pageData.profileImage} alt={pageData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    avatarFallback
                  )}
                </div>

                {/* Text Info */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.25rem 0', lineHeight: 1.2 }}>
                    {pageData.name}
                  </h1>

                  <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-accent)', margin: '0 0 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {pageData.category}
                  </p>

                  <p style={{ fontSize: '0.9rem', color: 'var(--slate-600)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                    {pageData.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', border: '1px solid', ...getApprovalBadgeStyle(pageData.approvalStatus) }}>
                      <i className="fa-solid fa-circle-check" style={{ fontSize: '0.7rem', marginRight: '0.3rem' }}></i>
                      {pageData.approvalStatus}
                    </span>

                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', border: '1px solid', ...getPageStatusBadgeStyle(pageData.pageStatus) }}>
                      {pageData.pageStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Small and Visible All Posts Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.25rem 0 0.25rem', margin: 0 }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-700)', margin: 0 }}>
                All Posts
              </h3>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)', backgroundColor: 'var(--slate-100)', padding: '0.1rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--slate-200)' }}>
                {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}
              </span>
            </div>

            {/* Published Posts Feed Cards (Consistent with Feed UI) */}
            {posts.length > 0 ? (
              posts.map((post, idx) => {
                const pId = post.id || post.post_id || idx;
                const formattedDate = post.date || post.created_at || post.eventDate ? new Date(post.date || post.created_at || post.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                const isMenuOpen = activeMenuId === pId;
                const isEvent = post.type === 'Event';
                const postImage = post.image_url || post.image || null;

                const currentRegistered = post.registered_count ?? post.current_registered ?? 0;
                const maxCapacity = post.max_capacity || post.capacity || 'Unlimited';
                const locationText = post.location || 'University Campus';

                return (
                  <article 
                    key={pId} 
                    className="card card-interactive" 
                    style={{ 
                      padding: '1rem 0', 
                      borderRadius: '1.25rem',
                      border: '1px solid var(--slate-200, #e2e8f0)',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Post Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem 0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <div 
                          style={{ 
                            width: '2.5rem', 
                            height: '2.5rem', 
                            borderRadius: '50%', 
                            backgroundColor: '#fbe4e8', 
                            color: '#8c1030', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 800, 
                            fontSize: '0.8rem',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}
                        >
                          {pageData.profileImage ? (
                            <img src={pageData.profileImage} alt={pageData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            avatarFallback
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {pageData.name}
                          </h4>
                          <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {isEvent ? (
                              <>
                                <span><i className="fa-solid fa-users" style={{ color: '#94a3b8' }}></i> {currentRegistered} / {maxCapacity} registered</span>
                                <span>•</span>
                                <span><i className="fa-solid fa-location-dot" style={{ color: '#94a3b8' }}></i> {locationText}</span>
                                <span>•</span>
                                <span><i className="fa-regular fa-clock" style={{ color: '#94a3b8' }}></i> {formattedDate}</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-regular fa-clock" style={{ fontSize: '0.75rem', color: '#94a3b8' }}></i>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.type || 'Announcement'} • {formattedDate}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 3-Dots Dropdown Menu */}
                      <div style={{ position: 'relative', flexShrink: 0 }} ref={isMenuOpen ? menuRef : null}>
                        <button 
                          type="button" 
                          onClick={() => setActiveMenuId(isMenuOpen ? null : pId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#16162b',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="More options"
                        >
                          <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1rem' }}></i>
                        </button>

                        {isMenuOpen && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid var(--slate-200)', minWidth: '130px', zIndex: 50, padding: '0.35rem 0' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPost(post)}
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--color-accent)' }}></i> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeletingPost(post); setActiveMenuId(null); }}
                              style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rose-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              <i className="fa-solid fa-trash-can"></i> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Post Media or Clean Text Body */}
                    {postImage ? (
                      <div style={{ backgroundColor: '#0f172a', width: '100%', maxHeight: '450px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                        <img src={postImage} alt={post.title} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
                        <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.35, margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                          {post.title}
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.9375rem', marginTop: '0.75rem', lineHeight: 1.6, margin: '0.75rem 0 0 0', whiteSpace: 'pre-line' }}>
                          {post.description || post.content || 'No preview available.'}
                        </p>
                      </div>
                    )}

                    {postImage && (
                      <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                        <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                          {post.title}
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.5, margin: '0.4rem 0 0 0', whiteSpace: 'pre-line' }}>
                          {post.description || post.content || 'No preview available.'}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-card)' }}>
                <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', color: 'var(--slate-400)', marginBottom: '0.75rem' }}></i>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-800)', margin: '0 0 0.25rem 0' }}>No posts published yet</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', margin: '0 0 1rem 0' }}>Create your first announcement or event from your page dashboard.</p>
                <button
                  onClick={() => navigate('/staff/mypage/dashboard')}
                  style={{ background: 'var(--nav-gradient)', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Go to Page Dashboard
                </button>
              </div>
            )}
          </>
        ) : (
          /* Create Page Form View */
          <div className="my-page-container">
            <div className="creator-wrapper-single">
              <div className="creator-sidebar" style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
                <h2 className="creator-title">Create Page</h2>
                <p className="creator-subtitle">
                  Set up your official department, college, or student organization page.
                </p>

                <form onSubmit={handleCreatePage}>
                  <div className="form-group">
                    <label htmlFor="pageName" className="form-label">
                      Department / Org Name <span style={{ color: 'var(--rose-600)' }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      id="pageName" 
                      className="form-input"
                      placeholder="e.g., College of Computing Studies" 
                      required 
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pageProfileImage" className="form-label">Profile Image URL (Logo / Avatar)</label>
                    <input 
                      type="url" 
                      id="pageProfileImage" 
                      className="form-input"
                      placeholder="https://example.com/logo.png" 
                      value={pageProfileImage}
                      onChange={(e) => setPageProfileImage(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pageCategory" className="form-label">
                      Category <span style={{ color: 'var(--rose-600)' }}>*</span>
                    </label>
                    <select 
                      id="pageCategory" 
                      className="form-select"
                      value={pageCategory}
                      onChange={(e) => setPageCategory(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select a category</option>
                      <option value="Academic College">Academic College</option>
                      <option value="Administrative Office">Administrative Office</option>
                      <option value="Student Organization">Student Organization</option>
                      <option value="Campus Council">Campus Council</option>
                    </select>
                  </div>

                  {(pageCategory === 'Academic College' || pageCategory === 'Administrative Office') && (
                    <div className="form-group">
                      <label htmlFor="departmentId" className="form-label">Select Specific College / Dept</label>
                      <select 
                        id="departmentId" 
                        className="form-select"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                      >
                        <option value="1">College of Law (LAW)</option>
                        <option value="2">College of Agriculture (COA)</option>
                        <option value="3">College of Liberal Arts (CLA)</option>
                        <option value="4">College of Architecture (COARCH)</option>
                        <option value="5">College of Nursing (CN)</option>
                        <option value="6">College of Asian & Islamic Studies (CAIS)</option>
                        <option value="7">College of Computing Studies (CCS)</option>
                        <option value="8">College of Forestry & Environmental Studies (CFES)</option>
                        <option value="9">College of Criminal Justice Education (CCJE)</option>
                        <option value="10">College of Home Economics (CHE)</option>
                        <option value="11">College of Engineering (COE)</option>
                        <option value="12">College of Medicine (CM)</option>
                        <option value="13">College of Public Administration & Development Studies (CPADS)</option>
                        <option value="14">College of Sports Science & Physical Education (CSSPE)</option>
                        <option value="15">College of Science & Mathematics (CSM)</option>
                        <option value="16">College of Social Work & Community Development (CSWCD)</option>
                        <option value="17">College of Teacher Education (CTE)</option>
                      </select>
                    </div>
                  )}

                  {(pageCategory === 'Student Organization' || pageCategory === 'Campus Council') && (
                    <div className="form-group">
                      <label htmlFor="organizationId" className="form-label">Select Organization</label>
                      <select 
                        id="organizationId" 
                        className="form-select"
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                      >
                        <option value="1">University Student Council</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="pageBio" className="form-label">Bio / Description (Optional)</label>
                    <textarea 
                      id="pageBio" 
                      className="form-textarea"
                      rows="4" 
                      placeholder="Share your department's mission or summary..."
                      value={pageBio}
                      onChange={(e) => setPageBio(e.target.value)}
                    ></textarea>
                  </div>

                  <button type="submit" disabled={submitting} className="btn-submit" style={{ marginTop: '0.5rem' }}>
                    {submitting ? 'Submitting...' : 'Create Page'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Page Modal */}
        {isEditing && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="no-scrollbar" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>Edit Page Information</h3>
                <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--slate-500)' }}>×</button>
              </div>

              <form onSubmit={handleUpdatePage}>
                <div className="form-group">
                  <label htmlFor="editName" className="form-label">Page Name</label>
                  <input
                    type="text"
                    id="editName"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editProfileImage" className="form-label">Profile Image URL (Logo / Avatar)</label>
                  <input
                    type="url"
                    id="editProfileImage"
                    className="form-input"
                    placeholder="https://example.com/logo.png"
                    value={editProfileImage}
                    onChange={(e) => setEditProfileImage(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editCategory" className="form-label">Category</label>
                  <select
                    id="editCategory"
                    className="form-select"
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

                <div className="form-group">
                  <label htmlFor="editBio" className="form-label">Description</label>
                  <textarea
                    id="editBio"
                    className="form-textarea"
                    rows="4"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{ padding: '0.625rem 1.125rem', backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)', border: '1px solid var(--slate-300)', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '0.625rem 1.125rem', background: 'var(--nav-gradient)', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Post Modal */}
        {editingPost && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="no-scrollbar" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>Edit Post</h3>
                <button onClick={() => setEditingPost(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--slate-500)' }}>×</button>
              </div>

              <form onSubmit={handleSavePostEdit}>
                <div className="form-group">
                  <label className="form-label">Post Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Post Type</label>
                  <select
                    className="form-select"
                    value={postType}
                    onChange={(e) => setPostType(e.target.value)}
                    required
                  >
                    <option value="Announcement">Announcement</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Content / Description</label>
                  <textarea
                    className="form-textarea"
                    rows="5"
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    required
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    style={{ padding: '0.625rem 1.125rem', backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)', border: '1px solid var(--slate-300)', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPost}
                    style={{ padding: '0.625rem 1.125rem', background: 'var(--nav-gradient)', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
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
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--slate-200)', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--rose-50)', color: 'var(--rose-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', margin: '0 auto 1rem' }}>
                <i className="fa-solid fa-trash-can"></i>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.5rem 0' }}>Delete Post?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                Are you sure you want to delete this post? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={() => setDeletingPost(null)} style={{ padding: '0.55rem 1.25rem', backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)', border: '1px solid var(--slate-300)', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleDeletePost} style={{ padding: '0.55rem 1.25rem', backgroundColor: 'var(--rose-600)', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </StaffDashboardLayout>
  );
}