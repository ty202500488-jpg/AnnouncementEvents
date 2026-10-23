import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';
import '../styles/MyPage.css';

export default function StaffMyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBio, setEditBio] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initial creation form state if page doesn't exist yet
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('1'); 
  const [organizationId, setOrganizationId] = useState('1');
  const [pageBio, setPageBio] = useState('');

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

      const response = await fetch('http://localhost:5000/api/my-page-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok && data.exists) {
        const pName = data.pageName || data.name || '';
        setPageData({
          pageId: data.pageId || data.page_id,
          name: pName,
          category: data.category,
          description: data.description || data.page_description,
          approvalStatus: data.status ? (data.status.charAt(0).toUpperCase() + data.status.slice(1)) : 'Pending',
          pageStatus: data.pageStatus || 'Active'
        });

        setEditName(pName);
        setEditCategory(data.category || '');
        setEditBio(data.description || data.page_description || '');

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
        const postList = Array.isArray(postData) ? postData : (postData.posts || []);
        const sorted = postList.sort((a, b) => new Date(b.date || b.created_at || b.eventDate) - new Date(a.date || a.created_at || a.eventDate));
        setPosts(sorted.slice(0, 5));
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
        pageDescription: pageBio
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
          description: editBio
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

  if (loading) {
    return (
      <StaffDashboardLayout activePage="mypage">
        <main className="lg-col-6 space-y-6" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', fontWeight: 600, fontSize: '0.9375rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#7B0D1E' }}></i>
            <p>Loading My Page Profile...</p>
          </div>
        </main>
      </StaffDashboardLayout>
    );
  }

  return (
    <StaffDashboardLayout activePage="mypage">
      <style>{`
        /* Hide scrollbars across Chrome, Safari, Edge, and Firefox */
        ::-webkit-scrollbar {
          display: none;
        }
        html, body, * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="lg-col-6 space-y-6" style={{ paddingBottom: '3rem' }}>
        
        {pageData ? (
          <>
            {/* Page Header: Name, Category, Clean Status Badges, Description, and Actions */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{pageData.name}</h1>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: pageData.approvalStatus === 'Approved' ? '#dcfce7' : pageData.approvalStatus === 'Rejected' ? '#fee2e2' : '#fef3c7',
                      color: pageData.approvalStatus === 'Approved' ? '#166534' : pageData.approvalStatus === 'Rejected' ? '#991b1b' : '#92400e',
                      border: `1px solid ${pageData.approvalStatus === 'Approved' ? '#bbf7d0' : pageData.approvalStatus === 'Rejected' ? '#fecaca' : '#fde68a'}`
                    }}>
                      {pageData.approvalStatus}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: pageData.pageStatus === 'Active' ? '#fff5f6' : '#f1f5f9',
                      color: pageData.pageStatus === 'Active' ? '#881337' : '#64748b',
                      border: `1px solid ${pageData.pageStatus === 'Active' ? '#fecdd3' : '#cbd5e1'}`
                    }}>
                      {pageData.pageStatus}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#7B0D1E', margin: '0 0 0.75rem 0' }}>{pageData.category}</p>
                <p style={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  {pageData.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{ backgroundColor: '#ffffff', color: '#7B0D1E', border: '1px solid #7B0D1E', padding: '0.55rem 1rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' }}
                >
                  <i className="fa-solid fa-pen"></i> Edit Page
                </button>

                <button 
                  onClick={() => navigate('/staff/mypage/dashboard')}
                  style={{ backgroundColor: '#7B0D1E', color: '#ffffff', border: 'none', padding: '0.55rem 1.125rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(123, 13, 30, 0.2)', transition: 'all 0.2s' }}
                >
                  <i className="fa-solid fa-chart-line"></i> Switch to Page Dashboard <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                </button>
              </div>
            </div>

            {/* Latest Posts Section */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Latest Posts</h2>
                <Link to="/staff/mypage/dashboard" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7B0D1E', textDecoration: 'none' }}>
                  View All →
                </Link>
              </div>

              {posts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {posts.map((post, idx) => (
                    <div key={post.id || idx} style={{ padding: '1rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flex: 1, minWidth: '240px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '0.5rem', backgroundColor: post.type === 'Event' ? '#e0f2fe' : '#fce7f3', color: post.type === 'Event' ? '#0369a1' : '#be185d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                          <i className={post.type === 'Event' ? 'fa-solid fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: post.type === 'Event' ? '#e0f2fe' : '#fce7f3', color: post.type === 'Event' ? '#0369a1' : '#be185d' }}>
                              {post.type || 'Announcement'}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: '#f1f5f9', color: '#475569' }}>
                              {post.status || 'Published'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{post.date || post.created_at || post.eventDate || 'Recent'}</span>
                          </div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{post.title}</h3>
                          <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>{post.description || post.content || 'No preview available.'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/staff/mypage/dashboard')}
                        style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.875rem', backgroundColor: '#ffffff', color: '#7B0D1E', border: '1px solid #7B0D1E', borderRadius: '0.375rem', cursor: 'pointer', alignSelf: 'center' }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                  <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.75rem' }}></i>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', margin: '0 0 0.25rem 0' }}>No posts published yet</h3>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1rem 0' }}>Create your first announcement or event from your page dashboard.</p>
                  <button
                    onClick={() => navigate('/staff/mypage/dashboard')}
                    style={{ backgroundColor: '#7B0D1E', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Go to Page Dashboard
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Create Page View if page not yet created */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            <div className="card" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.25rem', marginBottom: '0.35rem' }}>
                Create Page
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Set up your official department, college, or student organization page.
              </p>

              <form onSubmit={handleCreatePage} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label htmlFor="pageName" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Department / Org Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input 
                    type="text" 
                    id="pageName" 
                    placeholder="e.g., College of Computing Studies" 
                    required 
                    value={pageName}
                    onChange={(e) => setPageName(e.target.value)}
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', outline: 'none', color: '#1e293b', background: '#fff' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label htmlFor="pageCategory" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Category <span style={{ color: '#dc2626' }}>*</span></label>
                  <select 
                    id="pageCategory" 
                    value={pageCategory}
                    onChange={(e) => setPageCategory(e.target.value)}
                    required
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: '#1e293b' }}
                  >
                    <option value="" disabled>Select a category</option>
                    <option value="Academic College">Academic College</option>
                    <option value="Administrative Office">Administrative Office</option>
                    <option value="Student Organization">Student Organization</option>
                    <option value="Campus Council">Campus Council</option>
                  </select>
                </div>

                {(pageCategory === 'Academic College' || pageCategory === 'Administrative Office') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label htmlFor="departmentId" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Select Specific College / Dept</label>
                    <select 
                      id="departmentId" 
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: '#1e293b' }}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label htmlFor="organizationId" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Select Organization</label>
                    <select 
                      id="organizationId" 
                      value={organizationId}
                      onChange={(e) => setOrganizationId(e.target.value)}
                      style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: '#1e293b' }}
                    >
                      <option value="1">University Student Council</option>
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label htmlFor="pageBio" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Bio / Description (Optional)</label>
                  <textarea 
                    id="pageBio" 
                    rows="3" 
                    placeholder="Share your department's mission or summary..." 
                    value={pageBio}
                    onChange={(e) => setPageBio(e.target.value)}
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', outline: 'none', resize: 'vertical', color: '#1e293b' }}
                  ></textarea>
                </div>

                <button type="submit" disabled={submitting} style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#7B0D1E', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(123, 13, 30, 0.2)' }}>
                  {submitting ? 'Submitting...' : 'Create Page'}
                </button>
              </form>
            </div>

            {/* Preview Card */}
            <div className="card" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Desktop Preview</span>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fff' }}>
                <div style={{ padding: '1rem', display: 'flex', gap: '0.875rem', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                    <i className="fa-solid fa-building-columns"></i>
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <h3 style={{ fontSize: '0.975rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                      {pageName.trim() !== '' ? pageName : 'Department Name'}
                    </h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7B0D1E' }}>
                      {pageCategory !== '' ? pageCategory : 'Category'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem', color: '#64748b', textTransform: 'uppercase' }}>Intro</h4>
                    <p style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.4', margin: 0, wordBreak: 'break-word' }}>
                      {pageBio.trim() !== '' ? pageBio : 'Add a bio to let students know what your page is about.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Page Modal */}
        {isEditing && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Edit Page Information</h3>
                <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>

              <form onSubmit={handleUpdatePage} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label htmlFor="editName" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Page Name</label>
                  <input
                    type="text"
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', outline: 'none', color: '#1e293b' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label htmlFor="editCategory" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Category</label>
                  <select
                    id="editCategory"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: '#1e293b' }}
                  >
                    <option value="Academic College">Academic College</option>
                    <option value="Administrative Office">Administrative Office</option>
                    <option value="Student Organization">Student Organization</option>
                    <option value="Campus Council">Campus Council</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label htmlFor="editBio" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>Description</label>
                  <textarea
                    id="editBio"
                    rows="4"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9375rem', outline: 'none', resize: 'vertical', color: '#1e293b' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{ padding: '0.625rem 1.125rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '0.625rem 1.125rem', backgroundColor: '#7B0D1E', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(123, 13, 30, 0.2)' }}
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </StaffDashboardLayout>
  );
}