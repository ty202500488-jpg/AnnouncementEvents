import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../assets/components/AdminLayout';
import AdminPostCard from '../../assets/components/AdminPostCard';
import ConfirmationModal from '../../assets/components/ConfirmationModal';
import { getInitials } from '../../assets/components/PortalShellElements';
import '../styles/PageView.css';
import '../styles/ContentFeed.css';

export default function AdminProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    pageName: 'Western Mindanao State University',
    dept: 'MISTO Administration',
    email: 'admin@wmsu.edu.ph',
    employeeId: 'ADMIN-001',
    avatarUrl: '',
    bio: 'Official university page managing campus-wide announcements, events, and institutional updates.',
  });

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'announcements' | 'events' | 'about'
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...user });
  const [saveMessage, setSaveMessage] = useState('');

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [officialPageMeta, setOfficialPageMeta] = useState({ pageId: null, followersCount: 0, status: 'Approved' });
  const [activePostMenuKey, setActivePostMenuKey] = useState(null);
  const [failedImages, setFailedImages] = useState({});
  const [confirmAction, setConfirmAction] = useState(null); // { action: 'archive' | 'takedown', item }
  const [submittingAction, setSubmittingAction] = useState(false);

  const markImageFailed = useCallback((key) => {
    setFailedImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const initialData = {
          pageName: parsed.page_name || 'Western Mindanao State University',
          dept: parsed.department || parsed.dept || 'MISTO Administration',
          email: parsed.email || 'admin@wmsu.edu.ph',
          employeeId: parsed.employee_id || parsed.student_id || 'ADMIN-001',
          bio: parsed.bio || 'Official university page managing campus-wide announcements, events, and institutional updates.',
        };
        setUser(initialData);
        setFormData(initialData);
      } catch (err) {
        console.error('Failed to parse admin user:', err);
      }
    }

    const fetchOfficialPageAndPosts = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingPosts(false);
        return;
      }
      try {
        const pageRes = await fetch('/api/admin/official-page', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pageData = await pageRes.json();
        const resolvedPageId = pageData?.pageId || pageData?.page?.page_id || null;

        if (pageRes.ok && pageData?.page) {
          setOfficialPageMeta({
            pageId: resolvedPageId,
            followersCount: pageData.page.followers_count || 0,
            status: pageData.page.status || 'Approved',
          });
          setUser((prev) => {
            const next = {
              ...prev,
              pageName: pageData.page.page_name || prev.pageName,
              avatarUrl: pageData.page.avatar_url || prev.avatarUrl || '',
              bio: pageData.page.page_description || prev.bio,
            };
            setFormData(next);
            return next;
          });
        }

        if (resolvedPageId) {
          const res = await fetch(`/api/admin/content-feed?tab=all&status=approved&pageId=${resolvedPageId}&limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok && Array.isArray(data.items)) {
            setPosts(data.items);
          }
        } else {
          setPosts([]);
        }
      } catch (err) {
        console.warn('Failed to fetch admin official page posts:', err);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchOfficialPageAndPosts();

    const handleClickOutside = (e) => {
      if (!e.target.closest('.csf-post-menu-wrap')) {
        setActivePostMenuKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setUser(formData);
    setIsEditing(false);

    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/admin/official-page', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            page_name: formData.pageName,
            page_description: formData.bio,
            avatar_url: formData.avatarUrl || '',
          }),
        });
      } catch (err) {
        console.warn('Failed to update official page on server:', err);
      }
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = {
        ...storedUser,
        page_name: formData.pageName,
        department: formData.dept,
        email: formData.email,
        employee_id: formData.employeeId,
        bio: formData.bio,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('storage'));
      setSaveMessage('Official page profile updated successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save admin profile:', err);
    }
  };

  const handleExecutePostWorkflow = async (reasonText) => {
    if (!confirmAction?.item) return;
    setSubmittingAction(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/content-feed/${confirmAction.item.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          type: confirmAction.item.type,
          action: confirmAction.action,
          reason: reasonText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => !(p.id === confirmAction.item.id && p.type === confirmAction.item.type)));
        setSaveMessage(confirmAction.action === 'takedown' ? 'Post taken down and archived.' : 'Post archived.');
        setTimeout(() => setSaveMessage(''), 3000);
        setConfirmAction(null);
      } else {
        setSaveMessage(data.message || 'Failed to update post status.');
        setTimeout(() => setSaveMessage(''), 4000);
        setConfirmAction(null);
      }
    } catch (err) {
      console.error('AdminProfile post action error:', err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const fullName = user.pageName || 'Western Mindanao State University';
  const avatarFallback = getInitials(fullName, 'WM');

  const announcementsList = posts.filter((p) => p.type !== 'event');
  const eventsList = posts.filter((p) => p.type === 'event');

  let filteredPosts = posts;
  if (activeTab === 'announcements') filteredPosts = announcementsList;
  else if (activeTab === 'events') filteredPosts = eventsList;

  return (
    <AdminLayout fullBleed>
      <div className="pageview-wrapper" style={{ height: '100%', overflowY: 'auto' }}>
        {saveMessage && (
          <div
            style={{
              maxWidth: '1060px',
              width: '100%',
              margin: '0.75rem auto 0',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span><i className="fa-solid fa-circle-check" style={{ marginRight: '0.5rem' }}></i>{saveMessage}</span>
            <button type="button" onClick={() => setSaveMessage('')} style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* PAGEVIEW HERO COVER & PROFILE SECTION (Matched to Staff MyPageProfile) */}
        <section className="fb-cover-container">
          <div className="fb-cover-inner">
            <div className="fb-cover-banner">
              <div className="fb-cover-overlay">
                <div className="fb-cover-watermark">WMSU</div>
              </div>
            </div>

            <div className="fb-header-content">
              <div className="fb-profile-block">
                <div className="fb-avatar-box">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={fullName} />
                  ) : (
                    <div className="fb-avatar-fallback">{avatarFallback}</div>
                  )}
                </div>

                <div className="fb-name-meta">
                  <h1 className="fb-page-title">{fullName}</h1>
                  <div className="fb-page-subtitle">
                    <span className="fb-badge-pill">
                      <i className="fa-solid fa-certificate"></i>
                      Official Page
                    </span>
                    <span>•</span>
                    <span>Campus-Wide</span>
                    <span>•</span>
                    <span><strong>{posts.length}</strong> posts</span>
                  </div>
                </div>
              </div>

              <div className="fb-actions-group">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...user });
                    setIsEditing(true);
                  }}
                  className="btn-fb btn-fb-primary"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/content-feed')}
                  className="btn-fb btn-fb-secondary"
                >
                  <i className="fa-solid fa-newspaper"></i>
                  <span>Campus Feed</span>
                </button>
              </div>
            </div>

            <div className="fb-tabs-divider"></div>

            <nav className="fb-tabs-nav" aria-label="Profile navigation tabs">
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

        {/* 2-COLUMN BODY (Matched to Staff MyPageProfile) */}
        <main className="fb-main-container">
          <div className="fb-body-grid">
            <div className="fb-feed-col">
              {activeTab === 'about' ? (
                <article className="fb-card">
                  <h3 className="fb-card-title">
                    <i className="fa-solid fa-building-columns"></i>
                    Administrator Information &amp; Details
                  </h3>
                  <p className="fb-about-description">{user.bio}</p>
                  <ul className="fb-about-list">
                    <li className="fb-about-item">
                      <i className="fa-solid fa-certificate"></i>
                      <div>
                        <span className="fb-about-label">Page Type</span>
                        <span>Official Page</span>
                      </div>
                    </li>
                    <li className="fb-about-item">
                      <i className="fa-solid fa-shield-halved"></i>
                      <div>
                        <span className="fb-about-label">Visibility</span>
                        <span>Public Verified Campus Page</span>
                      </div>
                    </li>
                  </ul>
                </article>
              ) : loadingPosts ? (
                <div className="fb-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem', color: '#881337' }}></i>
                  Loading posts...
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="fb-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#64748b' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.75rem' }}></i>
                  <h3 style={{ margin: '0 0 0.25rem 0', color: '#334155', fontSize: '1.05rem' }}>No posts yet</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    {activeTab === 'events'
                      ? 'There are no events published yet.'
                      : activeTab === 'announcements'
                        ? 'There are no announcements published yet.'
                        : 'No announcements or events published yet.'}
                  </p>
                </div>
              ) : (
                <div className="content-feed-container">
                  <div className="csf-main">
                    {filteredPosts.map((item, idx) => {
                      const postKey = `${item.type}-${item.id || idx}`;
                      return (
                        <AdminPostCard
                          key={postKey}
                          item={item}
                          isMenuOpen={activePostMenuKey === postKey}
                          onToggleMenu={() => setActivePostMenuKey((prev) => (prev === postKey ? null : postKey))}
                          onCloseMenu={() => setActivePostMenuKey(null)}
                          onViewDetails={() => navigate('/admin/content-feed')}
                          onEdit={() => navigate('/admin/content-feed')}
                          onArchive={(target) => setConfirmAction({ action: 'archive', item: target })}
                          onTakeDown={(target) => setConfirmAction({ action: 'takedown', item: target })}
                          failedImages={failedImages}
                          onImageError={markImageFailed}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar About Card (Matched to PageView) */}
            <aside className="fb-sidebar-col">
              <div className="fb-card">
                <h3 className="fb-card-title">
                  <i className="fa-solid fa-circle-info"></i>
                  About
                </h3>
                <p className="fb-about-description">{user.bio}</p>
                <ul className="fb-about-list">
                  <li className="fb-about-item">
                    <i className="fa-solid fa-certificate"></i>
                    <div>
                      <span className="fb-about-label">Page Type</span>
                      <span>Official Page</span>
                    </div>
                  </li>
                  <li className="fb-about-item">
                    <i className="fa-solid fa-shield-halved"></i>
                    <div>
                      <span className="fb-about-label">Visibility</span>
                      <span>Public Verified Campus Page</span>
                    </div>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </main>

        {/* Edit Page Profile Modal (Matched to Staff MyPageProfile) */}
        {isEditing && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setIsEditing(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                border: '1px solid #e2e8f0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Edit Page Profile
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  aria-label="Close modal"
                  style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="admin-page-name" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Page Name
                  </label>
                  <input
                    id="admin-page-name"
                    type="text"
                    name="pageName"
                    value={formData.pageName}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="admin-avatar-url" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Profile Image URL (Logo / Avatar)
                  </label>
                  <input
                    id="admin-avatar-url"
                    type="url"
                    name="avatarUrl"
                    placeholder="https://example.com/logo.png"
                    value={formData.avatarUrl || ''}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="admin-bio" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Description
                  </label>
                  <textarea
                    id="admin-bio"
                    name="bio"
                    rows="4"
                    value={formData.bio}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#0f172a', backgroundColor: '#ffffff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn-fb btn-fb-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-fb btn-fb-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmationModal
          isOpen={Boolean(confirmAction)}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleExecutePostWorkflow}
          title={confirmAction?.action === 'takedown' ? 'Take Down & Archive Post' : 'Archive Post'}
          message={
            confirmAction?.action === 'takedown'
              ? `Taking down "${confirmAction?.item?.title}" will remove it from active feeds, archive it, record your reason in Audit Logs, and notify the creator.`
              : `Archiving "${confirmAction?.item?.title}" will remove it from active feeds and move it to Archives.`
          }
          confirmText={confirmAction?.action === 'takedown' ? 'Take Down Post' : 'Archive Post'}
          variant={confirmAction?.action === 'takedown' ? 'danger' : 'warning'}
          requireReason={true}
          reasonLabel="Moderation Reason"
          reasonPlaceholder="Provide a reason for this action..."
          loading={submittingAction}
        />
      </div>
    </AdminLayout>
  );
}
