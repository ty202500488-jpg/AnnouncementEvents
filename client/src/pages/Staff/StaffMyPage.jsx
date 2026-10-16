import React, { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';
import '../styles/MyPage.css';

export default function StaffMyPage({ onBack }) {
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('1'); 
  const [organizationId, setOrganizationId] = useState('1');
  const [pageBio, setPageBio] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [createdPage, setCreatedPage] = useState(null);

  useEffect(() => {
    const checkExistingPage = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoadingStatus(false);
          return;
        }

        const response = await fetch('http://localhost:5000/api/my-page-status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (response.ok && data.exists) {
          setCreatedPage({
            pageId: data.pageId,
            name: data.pageName,
            category: data.category,
            bio: data.description,
            status: data.status === 'pending' ? 'Pending Admin Approval' : data.status
          });
        }
      } catch (error) {
        console.error('Error checking page status:', error);
      } finally {
        setLoadingStatus(false);
      }
    };

    checkExistingPage();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('CRITICAL: No token found in localStorage! You are not logged in properly.');
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
        setCreatedPage({
          pageId: data.page.page_id,
          name: data.page.page_name,
          category: pageCategory,
          bio: data.page.page_description,
          status: data.page.status === 'Pending' ? 'Pending Admin Approval' : data.page.status
        });
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

  const handleSwitchDashboard = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/staff/mypage/dashboard';
    }
  };

  if (loadingStatus) {
    return (
      <StaffDashboardLayout activePage="mypage">
        <main className="lg-col-6 space-y-6" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', fontWeight: 600, fontSize: '0.9375rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#881337' }}></i>
            <p>Loading your page status...</p>
          </div>
        </main>
      </StaffDashboardLayout>
    );
  }

  if (createdPage) {
    return (
      <StaffDashboardLayout activePage="mypage">
        <main className="lg-col-6 space-y-6" style={{ paddingBottom: '3rem' }}>
          
          {/* Top Switcher & Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button 
              onClick={handleSwitchDashboard}
              style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', background: '#f1f5f9', color: 'var(--slate-700)', border: '1px solid var(--slate-300)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' }}
            >
              <i className="fa-solid fa-right-left"></i> Switch to Page Dashboard
            </button>

            <a href={`/public/page/${createdPage.pageId}`} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#881337', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <i className="fa-solid fa-pen"></i> Edit Page
            </a>
          </div>

          {/* Header Section */}
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#881337', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 4px 12px rgba(136, 19, 55, 0.25)', flexShrink: 0, backgroundImage: 'radial-gradient(circle, #881337 0%, #561C24 100%)' }}>
                WMSU
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--slate-900)' }}>{createdPage.name}</h2>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                    {createdPage.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#881337', fontWeight: 600, margin: '0.25rem 0 0 0' }}>{createdPage.category}</p>
              </div>
            </div>
          </div>

          {/* Page Management Section */}
          <div className="card" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '1.25rem' }}>Page management</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              
              {/* Create Announcement Card */}
              <div style={{ padding: '1.5rem', background: 'var(--slate-50, #f8fafc)', borderRadius: '0.875rem', border: '1px solid var(--slate-200)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                <div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#881337', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', marginBottom: '1rem', border: '1px solid #fecaca' }}>
                    <i className="fa-solid fa-bullhorn"></i>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-900)', margin: '0 0 0.35rem 0' }}>Create announcement</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', lineHeight: 1.5, margin: 0 }}>Publish approved notices.</p>
                </div>
                <button 
                  onClick={() => window.location.href = '/staff/mypage/dashboard'} 
                  style={{ marginTop: '1.5rem', backgroundColor: '#881337', color: '#fff', border: 'none', padding: '0.625rem 1.125rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                >
                  Create Notice
                </button>
              </div>

              {/* Create Event Card */}
              <div style={{ padding: '1.5rem', background: 'var(--slate-50, #f8fafc)', borderRadius: '0.875rem', border: '1px solid var(--slate-200)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                <div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#881337', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', marginBottom: '1rem', border: '1px solid #fecaca' }}>
                    <i className="fa-solid fa-calendar-days"></i>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-900)', margin: '0 0 0.35rem 0' }}>Create event</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', lineHeight: 1.5, margin: 0 }}>Add schedules, venues, and posters.</p>
                </div>
                <button 
                  onClick={() => window.location.href = '/staff/mypage/dashboard'} 
                  style={{ marginTop: '1.5rem', backgroundColor: '#881337', color: '#fff', border: 'none', padding: '0.625rem 1.125rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                >
                  Create Event
                </button>
              </div>

            </div>
          </div>

        </main>
      </StaffDashboardLayout>
    );
  }

  return (
    <StaffDashboardLayout activePage="mypage">
      <main className="lg-col-6 space-y-6">
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '-0.5rem' }}>
          <button 
            onClick={handleSwitchDashboard}
            style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', background: '#f1f5f9', color: 'var(--slate-700)', border: '1px solid var(--slate-300)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <i className="fa-solid fa-right-left"></i> Switch to Page Dashboard
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Form Card */}
          <div className="card" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)' }}>
            <h1 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.25rem', marginBottom: '0.35rem' }}>
              Create Page
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Set up your official department, college, or student organization page.
            </p>

            <form id="createPageForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="form-label" htmlFor="pageName" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--slate-700)' }}>Department / Org Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input 
                  type="text" 
                  id="pageName" 
                  className="form-input" 
                  placeholder="e.g., College of Computing Studies" 
                  required 
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--slate-300)', fontSize: '0.9375rem', outline: 'none', color: 'var(--slate-800)', background: '#fff' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>Use your official university office or org title.</span>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="form-label" htmlFor="pageCategory" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--slate-700)' }}>Category <span style={{ color: '#dc2626' }}>*</span></label>
                <select 
                  id="pageCategory" 
                  className="form-select" 
                  value={pageCategory}
                  onChange={(e) => setPageCategory(e.target.value)}
                  required
                  style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--slate-300)', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: 'var(--slate-800)' }}
                >
                  <option value="" disabled>Select a category</option>
                  <option value="Academic College">Academic College</option>
                  <option value="Administrative Office">Administrative Office</option>
                  <option value="Student Organization">Student Organization</option>
                  <option value="Campus Council">Campus Council</option>
                </select>
              </div>

              {(pageCategory === 'Academic College' || pageCategory === 'Administrative Office') && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label className="form-label" htmlFor="departmentId" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--slate-700)' }}>Select Specific College / Dept</label>
                  <select 
                    id="departmentId" 
                    className="form-select" 
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--slate-300)', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: 'var(--slate-800)' }}
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
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label className="form-label" htmlFor="organizationId" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--slate-700)' }}>Select Organization</label>
                  <select 
                    id="organizationId" 
                    className="form-select" 
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--slate-300)', fontSize: '0.9375rem', backgroundColor: '#fff', outline: 'none', color: 'var(--slate-800)' }}
                  >
                    <option value="1">University Student Council</option>
                  </select>
                </div>
              )}

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="form-label" htmlFor="pageBio" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--slate-700)' }}>Bio / Description (Optional)</label>
                <textarea 
                  id="pageBio" 
                  className="form-textarea" 
                  rows="3" 
                  placeholder="Share your department's mission or summary..." 
                  value={pageBio}
                  onChange={(e) => setPageBio(e.target.value)}
                  style={{ padding: '0.675rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--slate-300)', fontSize: '0.9375rem', outline: 'none', resize: 'vertical', color: 'var(--slate-800)' }}
                ></textarea>
              </div>

              <button type="submit" className="btn-submit" disabled={submitting} style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#881337', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                {submitting ? 'Submitting...' : 'Create Page'}
              </button>
            </form>
          </div>

          {/* Right Live Preview Card */}
          <div className="card" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid var(--slate-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Desktop Preview</span>
              <div style={{ display: 'flex', gap: '0.35rem', color: 'var(--slate-400)', fontSize: '0.8125rem' }}>
                <i className="fa-solid fa-desktop" style={{ color: '#881337' }}></i>
              </div>
            </div>

            <div style={{ border: '1px solid var(--slate-200)', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#fff' }}>
              <div style={{ padding: '1rem', display: 'flex', gap: '0.875rem', alignItems: 'center', borderBottom: '1px solid var(--slate-100)' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                  <i className="fa-solid fa-building-columns"></i>
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h2 style={{ fontSize: '0.975rem', fontWeight: 700, color: 'var(--slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                    {pageName.trim() !== '' ? pageName : 'Department Name'}
                  </h2>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#881337' }}>
                    {pageCategory !== '' ? pageCategory : 'Category'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'var(--slate-50)' }}>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
                  <h4 style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--slate-600)', textTransform: 'uppercase' }}>Intro</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', lineHeight: '1.4', margin: 0, wordBreak: 'break-word' }}>
                    {pageBio.trim() !== '' ? pageBio : 'Add a bio to let students know what your page is about.'}
                  </p>
                </div>
                <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--slate-200)' }}></div>
                    <div style={{ height: '8px', width: '35%', backgroundColor: 'var(--slate-200)', borderRadius: '4px' }}></div>
                  </div>
                  <div style={{ height: '35px', backgroundColor: 'var(--slate-100)', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </StaffDashboardLayout>
  );
}