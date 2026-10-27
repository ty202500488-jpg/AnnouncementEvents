import React, { useState, useEffect, useRef } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/StaffDashboard.css';
import '../../styles/Profile.css';
import '../../styles/MyPageDashboard.css';

export default function MyPageProfile({ onSwitchToStaffDashboard }) {
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [posts, setPosts] = useState([]);
  
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

        const loadedPage = {
          pageId: data.pageId || data.page_id,
          name: pName,
          code: data.pageCode || 'WMSU',
          category: data.category,
          description: data.description || data.page_description,
          approvalStatus: formattedApproval,
          pageStatus: data.pageStatus || 'Active',
          profileImage: imgUrl
        };

        setPageData(loadedPage);
        setEditName(pName);
        setEditCategory(data.category || '');
        setEditBio(data.description || data.page_description || '');
        setEditProfileImage(imgUrl);

        fetchPagePosts(loadedPage.pageId, token);
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
        const postList = Array.isArray(postData) ? postData : [...announcements, ...events];
        const sorted = postList.sort((a, b) => new Date(b.date || b.created_at || b.eventDate || b.event_date) - new Date(a.date || a.created_at || a.eventDate || a.event_date));
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

      if (response.ok) {
        setIsEditingPage(false);
        fetchPageData();
      } else {
        setPageData(prev => ({
          ...prev,
          name: editName,
          category: editCategory,
          description: editBio || 'No description provided.',
          profileImage: editProfileImage
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
    setPostTitle(post.title || '');
    setPostType(post.type || 'Announcement');
    setPostContent(post.content || post.description || '');
    setActiveMenuId(null);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    setSubmittingPost(true);

    const isEvent = editingPost.type === 'Event' || Boolean(editingPost.event_id || editingPost.event_title);
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
    const token = localStorage.getItem('token');

    const isEventPost = deletingPost.type === 'Event' || Boolean(deletingPost.event_id || deletingPost.event_title);
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
        return { backgroundColor: 'var(--emerald-50, #ecfdf5)', color: 'var(--emerald-700, #047857)', borderColor: 'var(--emerald-100, #a7f3d0)' };
      case 'Rejected':
        return { backgroundColor: 'var(--rose-50, #fff1f2)', color: 'var(--rose-600, #e11d48)', borderColor: 'var(--rose-100, #fecdd3)' };
      case 'Pending':
      default:
        return { backgroundColor: 'var(--amber-100, #fef3c7)', color: 'var(--amber-800, #92400e)', borderColor: '#fde68a' };
    }
  };

  const getPageStatusBadgeStyle = (status) => {
    if (status === 'Active') {
      return { backgroundColor: 'var(--emerald-50, #ecfdf5)', color: 'var(--emerald-700, #047857)', borderColor: 'var(--emerald-100, #a7f3d0)' };
    }
    return { backgroundColor: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-600, #475569)', borderColor: 'var(--slate-300, #cbd5e1)' };
  };

  const hideScrollbarStyle = `
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `;

  if (loading) {
    return (
      <MyPageDashboardLayout activeTab="profile" pageName="College Of Computing Studies" pageCode="COCS">
        <style>{hideScrollbarStyle}</style>
        <main className="lg-col-6 space-y-6 no-scrollbar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-500, #64748b)', fontWeight: 600, fontSize: '0.9375rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-accent, #881337)' }}></i>
            <p>Loading My Page Profile...</p>
          </div>
        </main>
      </MyPageDashboardLayout>
    );
  }

  const avatarFallback = pageData?.name ? pageData.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() : 'WMSU';

  return (
    <MyPageDashboardLayout 
      activeTab="profile" 
      pageName={pageData?.name || 'College Of Computing Studies'}
      pageCode={pageData?.code || 'COCS'}
      onTabChange={(tab) => {
        if (tab === 'overview') window.location.href = '/staff/mypage/dashboard';
        else if (tab === 'settings') window.location.href = '/staff/mypage/settings';
        else if (tab === 'registrations') window.location.href = '/staff/mypage/registrations';
      }} 
      onSwitchToStaffDashboard={onSwitchToStaffDashboard}
    >
      <style>{hideScrollbarStyle}</style>

      <main className="lg-col-6 no-scrollbar" style={{ paddingBottom: '3rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
        
        {/* Page Header Profile Card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200, #e2e8f0)', padding: '1.75rem', boxShadow: 'var(--shadow-card, 0 1px 3px 0 rgba(0,0,0,0.05))', position: 'relative' }}>
          
          {/* Top-Right Action Button */}
          <div style={{ position: 'absolute', top: '1.75rem', right: '1.75rem', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            <button
              onClick={() => setIsEditingPage(true)}
              style={{ backgroundColor: '#ffffff', color: 'var(--color-accent, #881337)', border: '1.5px solid var(--color-accent, #881337)', padding: '0.55rem 1.15rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
            >
              <i className="fa-solid fa-pen-to-square" style={{ fontSize: '0.75rem' }}></i> Edit Profile
            </button>
          </div>

          {/* Header Content with Profile Image & Text alignment */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', paddingRight: '140px', flexWrap: 'wrap' }}>
            
            {/* Profile Image Avatar */}
            <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', backgroundColor: '#fbe4e8', color: '#8c1030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.125rem', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--slate-200, #e2e8f0)' }}>
              {pageData?.profileImage ? (
                <img src={pageData.profileImage} alt={pageData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                avatarFallback
              )}
            </div>

            {/* Text Info */}
            <div style={{ flex: 1, minWidth: '180px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: '0 0 0.25rem 0', lineHeight: 1.2 }}>
                {pageData?.name || 'College Of Computing Studies'}
              </h1>

              <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-accent, #881337)', margin: '0 0 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {pageData?.category || 'Academic College'}
              </p>

              <p style={{ fontSize: '0.9rem', color: 'var(--slate-600, #475569)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                {pageData?.description || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', border: '1px solid', ...getApprovalBadgeStyle(pageData?.approvalStatus || 'Approved') }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '0.7rem', marginRight: '0.3rem' }}></i>
                  {pageData?.approvalStatus || 'Approved'}
                </span>

                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', border: '1px solid', ...getPageStatusBadgeStyle(pageData?.pageStatus || 'Active') }}>
                  {pageData?.pageStatus || 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Small and Visible All Posts Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.25rem 0 0.25rem', margin: 0 }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-700, #334155)', margin: 0 }}>
            All Posts
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500, #64748b)', backgroundColor: 'var(--slate-100, #f1f5f9)', padding: '0.1rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--slate-200, #e2e8f0)' }}>
            {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}
          </span>
        </div>

        {/* Published Posts Feed Cards */}
        {posts.length > 0 ? (
          posts.map((post, idx) => {
            const pId = post.id || post.post_id || idx;
            const formattedDate = post.date || post.created_at || post.eventDate || post.event_date ? new Date(post.date || post.created_at || post.eventDate || post.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
            const isMenuOpen = activeMenuId === pId;
            const isEvent = post.type === 'Event' || Boolean(post.event_id || post.event_title);
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
                      {pageData?.profileImage ? (
                        <img src={pageData.profileImage} alt={pageData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        avatarFallback
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pageData?.name || 'Page Admin'}
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
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid var(--slate-200, #e2e8f0)', minWidth: '130px', zIndex: 50, padding: '0.35rem 0' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditPost(post)}
                          style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700, #334155)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--color-accent, #881337)' }}></i> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeletingPost(post); setActiveMenuId(null); }}
                          style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rose-600, #e11d48)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
          <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200, #e2e8f0)', boxShadow: 'var(--shadow-card, 0 1px 3px 0 rgba(0,0,0,0.05))' }}>
            <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', color: 'var(--slate-400, #94a3b8)', marginBottom: '0.75rem' }}></i>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-800, #1e293b)', margin: '0 0 0.25rem 0' }}>No posts published yet</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500, #64748b)', margin: '0 0 1rem 0' }}>Create your first announcement or event from your page dashboard.</p>
          </div>
        )}

        {/* Edit Page Modal */}
        {isEditingPage && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="no-scrollbar" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))', border: '1px solid var(--slate-200, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: 0 }}>Edit Page Information</h3>
                <button onClick={() => setIsEditingPage(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--slate-500, #64748b)' }}>×</button>
              </div>

              <form onSubmit={handleUpdatePage}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="editName" className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Page Name</label>
                  <input
                    type="text"
                    id="editName"
                    className="form-input"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="editProfileImage" className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Profile Image URL (Logo / Avatar)</label>
                  <input
                    type="url"
                    id="editProfileImage"
                    className="form-input"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    placeholder="https://example.com/logo.png"
                    value={editProfileImage}
                    onChange={(e) => setEditProfileImage(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="editCategory" className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Category</label>
                  <select
                    id="editCategory"
                    className="form-select"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
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

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="editBio" className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Description</label>
                  <textarea
                    id="editBio"
                    className="form-textarea"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    rows="4"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingPage(false)}
                    style={{ padding: '0.625rem 1.125rem', backgroundColor: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-700, #334155)', border: '1px solid var(--slate-300, #cbd5e1)', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPage}
                    style={{ padding: '0.625rem 1.125rem', background: 'var(--nav-gradient, #881337)', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
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
            <div className="no-scrollbar" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))', border: '1px solid var(--slate-200, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: 0 }}>Edit Post</h3>
                <button onClick={() => setEditingPost(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--slate-500, #64748b)' }}>×</button>
              </div>

              <form onSubmit={handleSavePostEdit}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Post Title</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Post Type</label>
                  <select
                    className="form-select"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    value={postType}
                    onChange={(e) => setPostType(e.target.value)}
                    required
                  >
                    <option value="Announcement">Announcement</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-700, #334155)', marginBottom: '0.25rem' }}>Content / Description</label>
                  <textarea
                    className="form-textarea"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
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
                    style={{ padding: '0.625rem 1.125rem', backgroundColor: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-700, #334155)', border: '1px solid var(--slate-300, #cbd5e1)', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPost}
                    style={{ padding: '0.625rem 1.125rem', background: 'var(--nav-gradient, #881337)', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
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
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1))', border: '1px solid var(--slate-200, #e2e8f0)', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--rose-50, #fff1f2)', color: 'var(--rose-600, #e11d48)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', margin: '0 auto 1rem' }}>
                <i className="fa-solid fa-trash-can"></i>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: '0 0 0.5rem 0' }}>Delete Post?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-600, #475569)', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                Are you sure you want to delete this post? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={() => setDeletingPost(null)} style={{ padding: '0.55rem 1.25rem', backgroundColor: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-700, #334155)', border: '1px solid var(--slate-300, #cbd5e1)', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleDeletePost} style={{ padding: '0.55rem 1.25rem', backgroundColor: 'var(--rose-600, #e11d48)', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </MyPageDashboardLayout>
  );
}