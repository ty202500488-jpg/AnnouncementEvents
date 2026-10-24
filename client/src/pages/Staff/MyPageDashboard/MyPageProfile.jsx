import React, { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/StaffDashboard.css';
import '../../styles/Profile.css';
import '../../styles/MyPageDashboard.css';

export default function MyPageProfile({ onSwitchToStaffDashboard }) {
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Academic College');
  const [editBio, setEditBio] = useState('');

  useEffect(() => {
    fetchPageData();
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
        setPosts(sorted.slice(0, 5));
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
          description: editBio
        })
      });

      if (response.ok) {
        setIsEditing(false);
        fetchPageData();
      } else {
        setPageData(prev => ({
          ...prev,
          name: editName,
          category: editCategory,
          description: editBio || 'No description provided.'
        }));
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error updating page:', err);
      setPageData(prev => ({
        ...prev,
        name: editName,
        category: editCategory,
        description: editBio || 'No description provided.'
      }));
      setIsEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MyPageDashboardLayout activeTab="profile" pageName="College Of Computing Studies" pageCode="COCS">
        <main className="lg-col-6 space-y-6" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', fontWeight: 600 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#881337' }}></i>
            <p>Loading Page Profile...</p>
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
      <main className="lg-col-6 space-y-6" style={{ width: '100%', paddingBottom: '3rem' }}>
        
        {/* Page Profile Card */}
        <div className="card" style={{ padding: '2rem', borderRadius: '1rem', backgroundColor: '#ffffff', border: '1px solid var(--slate-200, #e2e8f0)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: 0, lineHeight: 1.2 }}>
                {pageData?.name || 'College Of Computing Studies'}
              </h1>
              
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                {pageData?.approvalStatus || 'Approved'}
              </span>

              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                {pageData?.pageStatus || 'Active'}
              </span>
            </div>

            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#881337', margin: '0 0 0.875rem 0' }}>
              {pageData?.category || 'Academic College'}
            </p>

            <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600, #475569)', lineHeight: 1.6, margin: 0 }}>
              {pageData?.description || 'No description provided.'}
            </p>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#881337',
                  border: '1.5px solid #881337',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className="fa-solid fa-pen" style={{ fontSize: '0.75rem' }}></i> Edit Page
              </button>
            </div>
          </div>
        </div>

        {/* Latest Posts Section */}
        <div className="card" style={{ padding: '2rem', borderRadius: '1rem', backgroundColor: '#ffffff', border: '1px solid var(--slate-200, #e2e8f0)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-100, #f1f5f9)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: 0 }}>
              Latest Posts
            </h2>
            <a 
              href="/staff/mypage/dashboard" 
              style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#881337', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              View All →
            </a>
          </div>

          {posts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {posts.map((post, idx) => (
                <div key={post.id || idx} style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--slate-50, #f8fafc)', borderRadius: '0.75rem', border: '1px solid var(--slate-200, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '0.5rem', backgroundColor: post.type === 'Event' ? '#fef3c7' : '#fff1f2', color: post.type === 'Event' ? '#b45309' : '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      <i className={post.type === 'Event' ? 'fa-solid fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: post.type === 'Event' ? '#fef3c7' : '#fff1f2', color: post.type === 'Event' ? '#b45309' : '#e11d48' }}>
                          {post.type || 'Announcement'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{post.date || post.created_at || 'Recent'}</span>
                      </div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--slate-900)', margin: 0 }}>{post.title}</h3>
                    </div>
                  </div>
                  <a 
                    href="/staff/mypage/dashboard" 
                    style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.875rem', backgroundColor: '#ffffff', color: '#881337', border: '1px solid #881337', borderRadius: '0.375rem', textDecoration: 'none' }}
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          ) : (
            /* Clean Empty Posts Display Box */
            <div 
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                backgroundColor: 'var(--slate-50, #f8fafc)',
                borderRadius: '0.75rem',
                border: '1.5px dashed var(--slate-300, #cbd5e1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="fa-solid fa-bullhorn" style={{ fontSize: '2.25rem', color: '#94a3b8', marginBottom: '0.875rem' }}></i>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-800, #1e293b)', margin: '0 0 0.35rem 0' }}>
                No posts published yet
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-500, #64748b)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                Create your first announcement or event from your page dashboard.
              </p>
            </div>
          )}
        </div>

        {/* Edit Page Modal */}
        {isEditing && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '500px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>Edit Page Information</h3>
                <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--slate-500)' }}>×</button>
              </div>

              <form onSubmit={handleUpdatePage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '4px' }}>PAGE NAME</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', fontSize: '0.875rem' }} required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '4px' }}>CATEGORY</label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', fontSize: '0.875rem' }} required>
                    <option value="Academic College">Academic College</option>
                    <option value="Administrative Office">Administrative Office</option>
                    <option value="Student Organization">Student Organization</option>
                    <option value="Campus Council">Campus Council</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '4px' }}>DESCRIPTION / BIO</label>
                  <textarea rows="4" value={editBio} onChange={(e) => setEditBio(e.target.value)} style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', fontSize: '0.875rem', resize: 'vertical' }}></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '0.55rem 1rem', backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} style={{ padding: '0.55rem 1.25rem', backgroundColor: '#881337', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </MyPageDashboardLayout>
  );
}