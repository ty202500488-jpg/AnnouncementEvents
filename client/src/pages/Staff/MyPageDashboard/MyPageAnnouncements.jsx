import { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import {
  PostPageAvatar,
  PostAudienceBadge,
  PostOwnerActionMenu,
  PostEditDeleteModals,
  updatePostRequest,
  deletePostRequest,
} from '../../../assets/components/PortalShellElements';
import { formatPostTimestamp } from '../../../utils/dateUtils';
import '../../styles/MyPageDashboard.css';

export default function MyPageAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMenuKey, setActiveMenuKey] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);
  const [filter] = useState('all');

  const handleOpenEditPost = (item) => {
    setEditingPost(item);
    setPostTitle(item.title || '');
    setPostContent(item.content || item.description || '');
    setActiveMenuKey(null);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    setSubmittingPost(true);
    try {
      const result = await updatePostRequest(editingPost, { title: postTitle, content: postContent });
      if (result.ok) {
        setAnnouncements((prev) =>
          prev.map((p) =>
            (p.id || p.post_id) === result.id
              ? { ...p, title: postTitle, content: postContent, description: postContent }
              : p
          )
        );
        setEditingPost(null);
      } else {
        alert(result.message || 'Failed to update post.');
      }
    } catch {
      alert('Network error while updating post.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost) return;
    try {
      const result = await deletePostRequest(deletingPost);
      if (result.ok) {
        setAnnouncements((prev) => prev.filter((p) => (p.id || p.post_id) !== result.id));
      } else {
        alert(result.message || 'Failed to delete post.');
      }
    } catch {
      alert('Network error while deleting post.');
    } finally {
      setDeletingPost(null);
    }
  };

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const statusRes = await fetch('http://localhost:5000/api/my-page-status', { headers });
        if (!statusRes.ok) {
          setError('Could not load page status.');
          return;
        }
        const statusData = await statusRes.json();
        if (!statusData.exists || !statusData.pageId) {
          setAnnouncements([]);
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/mypage/posts?pageId=${statusData.pageId}`,
          { headers }
        );
        if (!res.ok) {
          setError('Failed to load announcements.');
          return;
        }
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      } catch (err) {
        console.error('Failed to fetch page announcements:', err);
        setError('Unable to reach the server.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const filteredAnnouncements = announcements.filter(item => {
    if (filter === 'university') return item.is_university;
    if (filter === 'department') return !item.is_university;
    return true;
  });

  return (
    <MyPageDashboardLayout activeTab="announcements">
      <main 
        className="lg-col-6 hide-scrollbar" 
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2rem'
        }}
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem 1rem' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#8c1030' }}></i>
            <p style={{ fontSize: '0.875rem' }}>Loading announcements...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#991b1b', background: '#fef2f2', borderRadius: '0.625rem', border: '1px solid #fecdd3' }}>
            {error}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-solid fa-bullhorn" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No announcements available for this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredAnnouncements.map((item, index) => {
              const deptName = item.page_name || item.department_name || 'My Page';
              const avatarText = item.department_code || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
              const postDate = formatPostTimestamp(item.created_at);
              const postImage = item.image_url || item.image || null;

              return (
                <article 
                  key={item.announcement_id || item.id || index} 
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
                      <PostPageAvatar
                        avatarUrl={item.page_avatar_url}
                        label={deptName}
                        fallbackCode={item.code || item.department_code}
                      />

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {deptName}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Announcement • {postDate}</span>
                          <span>•</span>
                          <PostAudienceBadge audience={item.audience} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <PostOwnerActionMenu
                        isOpen={activeMenuKey === (item.id || item.post_id || index)}
                        onToggle={() => {
                          const key = item.id || item.post_id || index;
                          setActiveMenuKey((prev) => (prev === key ? null : key));
                        }}
                        onEdit={() => handleOpenEditPost(item)}
                        onDelete={() => {
                          setDeletingPost(item);
                          setActiveMenuKey(null);
                        }}
                      />
                    </div>
                  </div>

                  {/* Body Content */}
                  {postImage ? (
                    <div style={{ 
                      backgroundColor: '#0f172a', 
                      width: '100%',
                      maxHeight: '450px',
                      overflow: 'hidden',
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      position: 'relative'
                    }}>
                      <img 
                        src={postImage} 
                        alt={item.title} 
                        style={{ width: '100%', height: 'auto', objectFit: 'cover' }} 
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
                      <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.35, margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                        {item.title}
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.9375rem', marginTop: '0.75rem', lineHeight: 1.6, margin: '0.75rem 0 0 0' }}>
                        {item.content || item.description}
                      </p>
                    </div>
                  )}

                  {postImage && (
                    <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                      <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                        {item.title}
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.5, margin: '0.4rem 0 0 0' }}>
                        {item.content || item.description}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
      <PostEditDeleteModals
        editingPost={editingPost}
        postTitle={postTitle}
        postContent={postContent}
        onChangeTitle={setPostTitle}
        onChangeContent={setPostContent}
        onCloseEdit={() => setEditingPost(null)}
        onSubmitEdit={handleSavePostEdit}
        submitting={submittingPost}
        deletingPost={deletingPost}
        onCloseDelete={() => setDeletingPost(null)}
        onConfirmDelete={handleDeletePost}
      />
    </MyPageDashboardLayout>
  );
}