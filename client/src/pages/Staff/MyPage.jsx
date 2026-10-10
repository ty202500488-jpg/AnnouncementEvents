import React, { useState } from 'react';
import '../styles/MyPage.css';

export default function MyPage({ onBack }) {
  // State for form inputs and real-time preview tracking
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('');
  const [pageBio, setPageBio] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        alert('Page submitted successfully! It will be published once approved by an admin.');
        setPageName('');
        setPageCategory('');
        setPageBio('');
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

  return (
    <div className="my-page-container">
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="icon-btn" title="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h1 style={{ fontFamily: "'Bungee', sans-serif", fontWeight: 700, color: '#561C24', fontSize: '1.525rem', lineHeight: 1.2, letterSpacing: '-0.025em' }}>
              CRIM<span style={{ color: '#881337' }}>SON</span>
            </h1>
          </div>
          <div className="profile-btn">
            <div className="avatar-wrapper">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop" 
                alt="Alex Rivera" 
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