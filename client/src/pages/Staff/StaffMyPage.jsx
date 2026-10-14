import React, { useState } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';
import '../styles/MyPage.css';

export default function StaffMyPage({ onBack }) {
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('');
  const [pageBio, setPageBio] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdPage, setCreatedPage] = useState(null);

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/staff/dashboard';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/create-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageName, pageCategory, pageBio }),
      });

      const data = await response.json();

      if (response.ok) {
        setCreatedPage({
          name: pageName,
          category: pageCategory,
          bio: pageBio,
          status: 'Pending Admin Approval'
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

  // If page is created, show the created page management view
  if (createdPage) {
    return (
      <StaffDashboardLayout activePage="mypage">
        <main className="lg-col-6 space-y-6">
          <div className="card" style={{ padding: '1.75rem' }}>
            <div className="flex items-start justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1.25rem' }}>
              <div className="flex items-center gap-4">
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  WMSU
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.125rem' }}>{createdPage.name}</h3>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706' }}>
                      {createdPage.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--brand-600)', fontWeight: 600, marginTop: '0.125rem' }}>{createdPage.category}</p>
                </div>
              </div>
              <button 
                onClick={() => setCreatedPage(null)} 
                className="cancel-profile-btn"
                style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
              >
                Create Another Page
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>About Department</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', lineHeight: 1.5 }}>{createdPage.bio || 'No bio provided.'}</p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.9375rem', marginBottom: '0.75rem' }}>Page Announcements & Feed</h4>
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '2px dashed var(--slate-200)', borderRadius: '0.75rem', color: 'var(--slate-500)' }}>
                <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--slate-300)' }}></i>
                <p style={{ fontSize: '0.875rem' }}>No announcements posted on this page yet.</p>
                <button className="save-profile-btn" style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.375rem 0.875rem' }}>
                  Create First Announcement
                </button>
              </div>
            </div>
          </div>
        </main>
      </StaffDashboardLayout>
    );
  }

  return (
    <div className="my-page-container">
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="flex items-center gap-3">
            <button onClick={handleBackNavigation} className="icon-btn" title="Back">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <h1 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 700, color: '#561C24', fontSize: '1.525rem', lineHeight: 1.2, letterSpacing: '-0.025em' }}>
              CRIM<span style={{ color: '#881337' }}>SON</span>
            </h1>
          </div>
          <div className="profile-btn" onClick={() => window.location.href = '/staff/profile'}>
            <div className="avatar-wrapper">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                alt="Staff Profile" 
                className="avatar-img" 
              />
              <span className="online-status"></span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Creator Grid Layout */}
      <div className="creator-wrapper">
        
        {/* Left Setup Sidebar */}
        <aside className="creator-sidebar">
          <div>
            <h1 className="creator-title" style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 700, color: '#000000', fontSize: '1.525rem', lineHeight: 1.2, letterSpacing: '-0.025em' }}>
              Create Page
            </h1>
            <p className="creator-subtitle">
              Set up a department, college, or student organization page for official announcements.
            </p>

            <form id="createPageForm" onSubmit={handleSubmit}>
              {/* Page Name Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="pageName">Department / Org Name (Required)</label>
                <input 
                  type="text" 
                  id="pageName" 
                  className="form-input" 
                  placeholder="e.g., College of Computing Studies" 
                  required 
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                />
                <p className="form-hint">Use the official name of your office, college, or student organization.</p>
              </div>

              {/* Category Select */}
              <div className="form-group">
                <label className="form-label" htmlFor="pageCategory">Category (Required)</label>
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

              {/* Bio Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="pageBio">Bio (Optional)</label>
                <textarea 
                  id="pageBio" 
                  className="form-textarea" 
                  rows="3" 
                  placeholder="Tell students about this department's mission..." 
                  value={pageBio}
                  onChange={(e) => setPageBio(e.target.value)}
                ></textarea>
              </div>
            </form>
          </div>

          <div>
            <button type="submit" form="createPageForm" className="btn-submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Create Page'}
            </button>
          </div>
        </aside>

        {/* Right Live Desktop Preview */}
        <main className="creator-preview-pane">
          <div className="preview-header">
            <span className="preview-title">Desktop Preview</span>
            <div className="device-toggle">
              <button className="device-btn active"><i className="fa-solid fa-desktop"></i></button>
              <button className="device-btn"><i className="fa-solid fa-mobile-screen-button"></i></button>
            </div>
          </div>

          <div className="preview-card">
            {/* Cover Banner */}
            <div className="preview-banner"></div>

            {/* Avatar and Header Info */}
            <div className="preview-avatar-wrapper">
              <div className="preview-avatar">
                <i className="fa-solid fa-building-columns"></i>
              </div>
              <div>
                <h2 className="preview-dept-name">
                  {pageName.trim() !== '' ? pageName : 'Department Name'}
                </h2>
                <span className="preview-dept-category">
                  {pageCategory !== '' ? pageCategory : 'Category'}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="preview-nav-tabs">
              <span className="active">Announcements</span>
              <span>About</span>
              <span>Events</span>
              <span>Members</span>
            </div>

            {/* Preview Content Body */}
            <div className="preview-body">
              <div className="preview-sidebar-card">
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--slate-800)' }}>Intro</h4>
                <p id="previewBioDisplay" style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', lineHeight: '1.4' }}>
                  {pageBio.trim() !== '' ? pageBio : 'Add a bio to let students know what your page is about.'}
                </p>
              </div>
              <div className="preview-feed-card">
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '9999px', backgroundColor: 'var(--slate-200)' }}></div>
                  <div style={{ height: '12px', width: '40%', backgroundColor: 'var(--slate-200)', borderRadius: '4px' }}></div>
                </div>
                <div style={{ height: '60px', backgroundColor: 'var(--slate-100)', borderRadius: '4px' }}></div>
              </div>
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}