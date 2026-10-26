import React, { useState, useEffect, useRef } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/StaffDashboard.css';
import '../../styles/Profile.css';
import '../../styles/MyPageDashboard.css';

export default function MyPageProfile({ onSwitchToStaffDashboard }) {
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [posts, setPosts] = useState([]);
  
  // Active Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Page Edit State
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [submittingPage, setSubmittingPage] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Academic College');
  const [editBio, setEditBio] = useState('');

  // Post Edit State
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postType, setPostType] = useState('Announcement');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Post Delete State
  const [deletingPostId, setDeletingPostId] = useState(null);

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

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch('http://localhost:5000/api/my-page-status', { headers });
      const data = await response.json();

      if (response.ok && data.exists) {
        const pName = data.pageName || data.name || 'College Of Computing Studies';
        const rawApproval = data.status || 'Approved';
        const formattedApproval = rawApproval.charAt(0).toUpperCase() + rawApproval.slice(1).toLowerCase();

        const loadedPage = {
          pageId: data.pageId || data.page_id || 1,
          name: pName,
          code: data.pageCode || 'COCS',
          category: data.category || 'Academic College',
          description: data.description || data.page_description || 'No description provided.',
          approvalStatus: formattedApproval,
          pageStatus: data.pageStatus || 'Active'
        };

        setPageData(loadedPage);
        setEditName(loadedPage.name);
        setEditCategory(loadedPage.category);
        setEditBio(loadedPage.description === 'No description provided.' ? '' : loadedPage.description);

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
        const postList = Array.isArray(postData) ? postData : (postData.posts || []);
        const sorted = postList.sort((a, b) => new Date(b.date || b.created_at || b.event_date) - new Date(a.date || a.created_at || a.event_date));
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
          description: editBio
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
          description: editBio || 'No description provided.'
        }));
        setIsEditingPage(false);
      }
    } catch (err) {
      console.error('Error updating page:', err);
      setPageData(prev => ({
        ...prev,
        name: editName,
        category: editCategory,
        description: editBio || 'No description provided.'
      }));
      setIsEditingPage(false);
    } finally {
      setSubmittingPage(false);
    }
  };

  // Open Edit Post Modal
  const handleOpenEditPost = (post) => {
    setEditingPost(post);
    setPostTitle(post.title || '');
    setPostType(post.type || 'Announcement');
    setPostContent(post.content || post.description || '');
    setActiveMenuId(null);
  };

  // Save Post Edit
  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    setSubmittingPost(true);

    const targetId = editingPost.id || editingPost.post_id;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`http://localhost:5000/api/posts/${targetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: postTitle,
          type: postType,
          content: postContent
        })
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => (p.id || p.post_id) === targetId ? {
          ...p,
          title: postTitle,
          type: postType,
          content: postContent
        } : p));
      } else {
        setPosts(prev => prev.map(p => (p.id || p.post_id) === targetId ? {
          ...p,
          title: postTitle,
          type: postType,
          content: postContent
        } : p));
      }
    } catch (err) {
      console.error('Error editing post:', err);
      setPosts(prev => prev.map(p => (p.id || p.post_id) === targetId ? {
        ...p,
        title: postTitle,
        type: postType,
        content: postContent
      } : p));
    } finally {
      setSubmittingPost(false);
      setEditingPost(null);
    }
  };

  // Delete Post Handler
  const handleDeletePost = async () => {
    if (!deletingPostId) return;
    const token = localStorage.getItem('token');

    const isEvent = deletingPostId.type === 'Event' || Boolean(deletingPostId.event_id || deletingPostId.event_title);
    const targetId = isEvent
      ? (deletingPostId.event_id || deletingPostId.id || deletingPostId.post_id)
      : (deletingPostId.announcement_id || deletingPostId.id || deletingPostId.post_id);
    const endpoint = isEvent
      ? `http://localhost:5000/api/events/${targetId}`
      : `http://localhost:5000/api/announcements/${targetId}`;

    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setPosts(prev => prev.filter(p => {
          const pIsEvent = p.type === 'Event' || Boolean(p.event_id || p.event_title);
          const pTargetId = pIsEvent ? (p.event_id || p.id || p.post_id) : (p.announcement_id || p.id || p.post_id);
          return !(pIsEvent === isEvent && String(pTargetId) === String(targetId));
        }));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to delete post from database.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Network error while deleting post.');
    } finally {
      setDeletingPostId(null);
      setActiveMenuId(null);
    }
  };

  const hideScrollbarStyle = `
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `;

  if (loading) {
    return (
      <MyPageDashboardLayout activeTab="profile" pageName="College Of Computing Studies" pageCode="COCS">
        <style>{hideScrollbarStyle}</style>
        <main className="lg-col-6 space-y-6 no-scrollbar" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#881337' }}></i>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading Page Profile...</p>
          </div>
        </main>
      </MyPageDashboardLayout>
    );
  }

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

      <main className="lg-col-6 space-y-6 no-scrollbar" style={{ width: '100%', maxWidth: '840px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* Rearranged Page Header Profile Card with Badges at the Bottom */}
        <div 
          className="card" 
          style={{ 
            borderRadius: '1rem', 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
            padding: '2rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
            
            {/* Left Content Area: Page Name -> Category -> Bio -> Badges at the bottom */}
            <div style={{ flex: 1 }}>
              {/* Row 1: Page Name */}
              <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0', lineHeight: 1.2 }}>
                {pageData?.name || 'College Of Computing Studies'}
              </h1>

              {/* Row 2: Category */}
              <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#881337', margin: '0 0 0.875rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {pageData?.category || 'Academic College'}
              </p>

              {/* Row 3: Bio / Description */}
              <p style={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1.25rem 0', maxWidth: '680px' }}>
                {pageData?.description || 'No description provided.'}
              </p>

              {/* Row 4: Badges at the very bottom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '0.7rem', marginRight: '0.3rem' }}></i>
                  {pageData?.approvalStatus || 'Approved'}
                </span>

                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                  {pageData?.pageStatus || 'Active'}
                </span>
              </div>
            </div>

            {/* Right Action: Edit Profile Button */}
            <button
              type="button"
              onClick={() => setIsEditingPage(true)}
              style={{
                backgroundColor: '#ffffff',
                color: '#881337',
                border: '1.5px solid #881337',
                padding: '0.55rem 1.15rem',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fa-solid fa-pen-to-square" style={{ fontSize: '0.75rem' }}></i> Edit Profile
            </button>
          </div>
        </div>

        {/* Stream Post List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.25rem 0' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Published Posts <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>{posts.length}</span>
            </h2>
          </div>

          {posts.length > 0 ? (
            posts.map((post, idx) => {
              const isEvent = post.type === 'Event' || Boolean(post.event_id || post.event_title);
              const rawId = isEvent ? (post.event_id || post.id || post.post_id) : (post.announcement_id || post.id || post.post_id);
              const pId = `${isEvent ? 'Event' : 'Announcement'}-${rawId ?? idx}`;
              const formattedDate = post.date || post.created_at || post.event_date || 'Just now';
              const isMenuOpen = activeMenuId === pId;

              return (
                <article key={pId} className="card" style={{ borderRadius: '1rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.02)', padding: '1.5rem', position: 'relative' }}>
                  
                  {/* Card Header & Vertical 3-Dots Menu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.2rem 0' }}>
                        {pageData?.name || 'Page Admin'}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.675rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '0.25rem', backgroundColor: isEvent ? '#fef3c7' : '#fff1f2', color: isEvent ? '#b45309' : '#e11d48' }}>
                          {isEvent ? 'Event' : 'Announcement'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>•</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{formattedDate}</span>
                      </div>
                    </div>

                    {/* 3-Dots Dropdown Trigger */}
                    <div style={{ position: 'relative' }} ref={isMenuOpen ? menuRef : null}>
                      <button 
                        type="button" 
                        onClick={() => setActiveMenuId(isMenuOpen ? null : pId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '1.125rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div 
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '0.25rem',
                            backgroundColor: '#ffffff',
                            borderRadius: '0.5rem',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e2e8f0',
                            minWidth: '130px',
                            zIndex: 50,
                            overflow: 'hidden',
                            padding: '0.35rem 0'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenEditPost(post)}
                            style={{
                              width: '100%',
                              padding: '0.5rem 1rem',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square" style={{ color: '#881337', fontSize: '0.85rem' }}></i> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeletingPostId(post); setActiveMenuId(null); }}
                            style={{
                              width: '100%',
                              padding: '0.5rem 1rem',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            <i className="fa-solid fa-trash-can" style={{ fontSize: '0.85rem' }}></i> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', lineHeight: 1.35 }}>
                    {post.title}
                  </h3>
                  
                  {(post.content || post.description) && (
                    <p style={{ fontSize: '0.90rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>
                      {post.content || post.description}
                    </p>
                  )}
                </article>
              );
            })
          ) : (
            <div 
              style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                backgroundColor: '#ffffff',
                borderRadius: '1rem',
                border: '1.5px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.875rem' }}></i>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.35rem 0' }}>
                No published posts found
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, maxWidth: '380px', lineHeight: 1.5 }}>
                You haven't posted any announcements or events yet.
              </p>
            </div>
          )}
        </div>

        {/* Edit Page Information Modal */}
        {isEditingPage && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="no-scrollbar" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Edit Page Information</h3>
                <button type="button" onClick={() => setIsEditingPage(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>

              <form onSubmit={handleUpdatePage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' }}>PAGE NAME</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }} required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' }}>CATEGORY</label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }} required>
                    <option value="Academic College">Academic College</option>
                    <option value="Administrative Office">Administrative Office</option>
                    <option value="Student Organization">Student Organization</option>
                    <option value="Campus Council">Campus Council</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' }}>DESCRIPTION / BIO</label>
                  <textarea rows="4" value={editBio} onChange={(e) => setEditBio(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', resize: 'vertical', outline: 'none' }}></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsEditingPage(false)} style={{ padding: '0.55rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingPage} style={{ padding: '0.55rem 1.25rem', backgroundColor: '#881337', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    {submittingPage ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Post Modal */}
        {editingPost && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="no-scrollbar" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Edit Post</h3>
                <button type="button" onClick={() => setEditingPost(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>

              <form onSubmit={handleSavePostEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' }}>POST TITLE</label>
                  <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }} required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' }}>POST TYPE</label>
                  <select value={postType} onChange={(e) => setPostType(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }} required>
                    <option value="Announcement">Announcement</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' }}>CONTENT / DESCRIPTION</label>
                  <textarea rows="5" value={postContent} onChange={(e) => setPostContent(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', resize: 'vertical', outline: 'none' }}></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setEditingPost(null)} style={{ padding: '0.55rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingPost} style={{ padding: '0.55rem 1.25rem', backgroundColor: '#881337', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    {submittingPost ? 'Updating...' : 'Save Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingPostId && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', margin: '0 auto 1rem' }}>
                <i className="fa-solid fa-trash-can"></i>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Delete Post?</h3>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
                Are you sure you want to delete this post? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={() => setDeletingPostId(null)} style={{ padding: '0.55rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleDeletePost} style={{ padding: '0.55rem 1.25rem', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
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