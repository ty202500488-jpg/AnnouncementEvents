import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import {
  PostPageAvatar,
  PostAudienceBadge,
  PostOwnerActionMenu,
  PostEditDeleteModals,
  updatePostRequest,
  deletePostRequest,
} from '../../assets/components/PortalShellElements';
import { getHighlightedCardProps, useHighlightedPost } from '../../utils/notificationUtils';
import { formatPostTimestamp } from '../../utils/dateUtils';
import '../styles/StudentDashboard.css';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuKey, setActiveMenuKey] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);
  const highlightedPostId = useHighlightedPost(!loading && announcements.length > 0);
  const token = localStorage.getItem('token');

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
      try {
        const response = await fetch('http://localhost:5000/users/dashboard-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        const data = await response.json();
        if (response.ok && data.announcements) {
          setAnnouncements(data.announcements.filter((item) => item.is_followed || item.is_owner));
        }
      } catch (err) {
        console.error('Failed to fetch announcements:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [token]);

  const handleToggleFollow = async (pageId, currentFollowState) => {
    if (!pageId || !token) return;
    const method = currentFollowState ? 'DELETE' : 'POST';
    try {
      const response = await fetch(`http://localhost:5000/api/pages/${pageId}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        setAnnouncements(prev =>
          prev.map(item =>
            item.page_id === pageId ? { ...item, is_followed: !currentFollowState } : item
          )
        );
      }
    } catch (err) {
      console.error('Failed to update follow status:', err);
    }
  };

  const filteredAnnouncements = announcements.filter(item => !!item.is_followed);

  return (
    <DashboardLayout activePage="announcements">
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
        ) : filteredAnnouncements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-solid fa-bullhorn" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No announcements from followed pages yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredAnnouncements.map((item, index) => {
              const deptName = item.department_name || item.page_name || 'University Notice';
              const avatarText = item.department_code || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
              const isFollowed = !!item.is_followed;
              const postDate = formatPostTimestamp(item.created_at);
              const postImage = item.image_url || item.image || null;
              const { domId, highlightStyle } = getHighlightedCardProps(item, highlightedPostId);

              return (
                <article 
                  id={domId}
                  key={item.id || index} 
                  className="card card-interactive" 
                  style={{ 
                    padding: '1rem 0', 
                    borderRadius: '1.25rem',
                    border: '1px solid var(--slate-200, #e2e8f0)',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                    overflow: 'hidden',
                    ...highlightStyle
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deptName}
                          </h4>
                          {item.page_id && (
                            <>
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                              <button
                                type="button"
                                onClick={() => handleToggleFollow(item.page_id, isFollowed)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  margin: 0,
                                  color: '#2563eb',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  lineHeight: 1.2
                                }}
                                title={isFollowed ? 'Click to unfollow' : 'Click to follow'}
                              >
                                {isFollowed ? 'Following' : 'Follow'}
                              </button>
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Announcement • {postDate}</span>
                          <span>•</span>
                          <PostAudienceBadge audience={item.audience} />
                        </div>
                      </div>
                    </div>

                    {item.is_owner && (
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
                    )}
                  </div>

                  {/* Post Media or Clean Text Body */}
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
                        {item.content}
                      </p>
                    </div>
                  )}

                  {postImage && (
                    <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                      <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                        {item.title}
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.5, margin: '0.4rem 0 0 0' }}>
                        {item.content}
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
    </DashboardLayout>
  );
}