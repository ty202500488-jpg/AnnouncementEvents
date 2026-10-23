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
        const rawApprovalStatus = data.status || 'pending';
        const formattedApproval = rawApprovalStatus.charAt(0).toUpperCase() + rawApprovalStatus.slice(1).toLowerCase();

        setPageData({
          pageId: data.pageId || data.page_id,
          name: pName,
          category: data.category,
          description: data.description || data.page_description,
          approvalStatus: formattedApproval,
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

  // Helper for status badge styling
  const getApprovalBadgeStyle = (status) => {
    switch (status) {
      case 'Approved':
        return {
          backgroundColor: 'var(--emerald-50)',
          color: 'var(--emerald-700)',
          borderColor: 'var(--emerald-100)'
        };
      case 'Rejected':
        return {
          backgroundColor: 'var(--rose-50)',
          color: 'var(--rose-600)',
          borderColor: 'var(--rose-100)'
        };
      case 'Pending':
      default:
        return {
          backgroundColor: 'var(--amber-100)',
          color: 'var(--amber-800)',
          borderColor: '#fde68a'
        };
    }
  };

  const getPageStatusBadgeStyle = (status) => {
    if (status === 'Active') {
      return {
        backgroundColor: 'var(--emerald-50)',
        color: 'var(--emerald-700)',
        borderColor: 'var(--emerald-100)'
      };
    }
    return {
      backgroundColor: 'var(--slate-100)',
      color: 'var(--slate-600)',
      borderColor: 'var(--slate-300)'
    };
  };

  if (loading) {
    return (
      <StaffDashboardLayout activePage="mypage">
        <main className="lg-col-6 space-y-6" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', fontWeight: 600, fontSize: '0.9375rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-accent)' }}></i>
            <p>Loading My Page Profile...</p>
          </div>
        </main>
      </StaffDashboardLayout>
    );
  }

  return (
    <StaffDashboardLayout activePage="mypage">
      <main className="lg-col-6 space-y-6" style={{ paddingBottom: '3rem' }}>
        
        {pageData ? (
          <>
            {/* Page Header */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>{pageData.name}</h1>
                  
                  {/* Approval Status Badge */}
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.625rem',
                    borderRadius: '9999px',
                    border: '1px solid',
                    ...getApprovalBadgeStyle(pageData.approvalStatus)
                  }}>
                    {pageData.approvalStatus}
                  </span>

                  {/* Page Status Badge */}
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.625rem',
                    borderRadius: '9999px',
                    border: '1px solid',
                    ...getPageStatusBadgeStyle(pageData.pageStatus)
                  }}>
                    {pageData.pageStatus}
                  </span>
                </div>

                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-accent)', margin: '0 0 0.75rem 0' }}>{pageData.category}</p>
                <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600)', lineHeight: 1.6, margin: 0 }}>
                  {pageData.description || 'No description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{ backgroundColor: '#ffffff', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', padding: '0.55rem 1rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' }}
                >
                  <i className="fa-solid fa-pen"></i> Edit Page
                </button>

                <button 
                  onClick={() => navigate('/staff/mypage/dashboard')}
                  style={{ background: 'var(--nav-gradient)', color: '#ffffff', border: 'none', padding: '0.55rem 1.125rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)', transition: 'all 0.2s' }}
                >
                  <i className="fa-solid fa-chart-line"></i> Switch to Page Dashboard <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                </button>
              </div>
            </div>

            {/* Latest Posts Section */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--slate-100)' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>Latest Posts</h2>
                <Link to="/staff/mypage/dashboard" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none' }}>
                  View All →
                </Link>
              </div>

              {posts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {posts.map((post, idx) => (
                    <div key={post.id || idx} style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--slate-50)', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flex: 1, minWidth: '240px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '0.5rem', backgroundColor: post.type === 'Event' ? '#e0f2fe' : 'var(--rose-50)', color: post.type === 'Event' ? '#0369a1' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                          <i className={post.type === 'Event' ? 'fa-solid fa-calendar-days' : 'fa-solid fa-bullhorn'}></i>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: post.type === 'Event' ? '#e0f2fe' : 'var(--rose-50)', color: post.type === 'Event' ? '#0369a1' : 'var(--color-accent)' }}>
                              {post.type || 'Announcement'}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'var(--slate-100)', color: 'var(--slate-700)' }}>
                              {post.status || 'Published'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{post.date || post.created_at || post.eventDate || 'Recent'}</span>
                          </div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.25rem 0' }}>{post.title}</h3>
                          <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', margin: 0, lineHeight: 1.5 }}>{post.description || post.content || 'No preview available.'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/staff/mypage/dashboard')}
                        style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.875rem', backgroundColor: '#ffffff', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: '0.375rem', cursor: 'pointer', alignSelf: 'center' }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', backgroundColor: 'var(--slate-50)', borderRadius: '0.75rem', border: '1px dashed var(--slate-300)' }}>
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
            </div>
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
            <div className="my-page-container" style={{ maxWidth: '500px', width: '100%' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--slate-200)' }}>
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
          </div>
        )}

      </main>
    </StaffDashboardLayout>
  );
}