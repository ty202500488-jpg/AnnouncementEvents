import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import {
  EventPostMeta,
  EventPostActionBar,
  PostOwnerActionMenu,
  PostEditDeleteModals,
  updatePostRequest,
  deletePostRequest,
} from '../../assets/components/PortalShellElements';
import '../styles/StudentDashboard.css';

export default function MyEvents() {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [togglingPageId, setTogglingPageId] = useState(null);
  const [activeMenuKey, setActiveMenuKey] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);
  const token = localStorage.getItem('token');

  const handleOpenEditPost = (item) => {
    setEditingPost(item);
    setPostTitle(item.title || item.event_title || '');
    setPostContent(item.description || item.event_description || item.content || '');
    setActiveMenuKey(null);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    setSubmittingPost(true);
    try {
      const result = await updatePostRequest(editingPost, { title: postTitle, content: postContent });
      if (result.ok) {
        setMyEvents((prev) =>
          prev.map((p) =>
            (p.id || p.event_id) === result.id
              ? { ...p, title: postTitle, event_title: postTitle, content: postContent, description: postContent, event_description: postContent }
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
        setMyEvents((prev) => prev.filter((p) => (p.id || p.event_id) !== result.id));
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
    const fetchMyEvents = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        const studentId = parsedUser.id || parsedUser.student_id;

        const response = await fetch(`http://localhost:5000/users/my-events?student_id=${studentId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        const data = await response.json();
        if (response.ok && data.events) {
          setMyEvents(data.events);
        }
      } catch (err) {
        console.error('Failed to fetch user events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyEvents();
  }, []);

  const handleCancelRegistration = async (eventId) => {
    if (!window.confirm('Are you sure you want to cancel your registration for this event?')) return;

    try {
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : {};
      const studentId = parsedUser.id || parsedUser.student_id;

      const response = await fetch(`http://localhost:5000/users/events/${eventId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
      });

      if (response.ok) {
        setMyEvents(prev => prev.filter(ev => ev.id !== eventId));
      }
    } catch (err) {
      console.error('Failed to cancel event registration', err);
    }
  };

  const handleToggleFollow = async (pageId, currentFollowState) => {
    if (!pageId || !token) return;
    setTogglingPageId(pageId);
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
        setMyEvents(prev =>
          prev.map(item =>
            item.page_id === pageId ? { ...item, is_followed: !currentFollowState } : item
          )
        );
      }
    } catch (err) {
      console.error('Failed to update follow status:', err);
    } finally {
      setTogglingPageId(null);
    }
  };

  const filteredEvents = myEvents.filter(item => {
    if (statusFilter === 'upcoming') return new Date(item.date) >= new Date();
    if (statusFilter === 'completed') return new Date(item.date) < new Date();
    return true;
  });

  return (
    <DashboardLayout activePage="my-events">
      <main 
        className="lg-col-6 hide-scrollbar" 
        style={{ 
          height: 'calc(100vh - 5rem)', 
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2.5rem'
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
            <p style={{ fontSize: '0.875rem' }}>Loading your events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-solid fa-calendar-check" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>You have not registered for any events yet.</p>
            <a 
              href="/student/events" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.375rem', 
                marginTop: '0.875rem', 
                fontSize: '0.8125rem', 
                color: '#8c1030', 
                fontWeight: 600, 
                textDecoration: 'none',
                padding: '0.4rem 0.875rem',
                borderRadius: '0.375rem',
                backgroundColor: '#fff1f2',
                border: '1px solid #ffe4e6'
              }}
            >
              Browse Campus Events <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((item) => {
              const isUpcoming = new Date(item.date) >= new Date();
              const deptName = item.department_name || 'University Office';
              const avatarText = deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
              const pageId = item.page_id;
              const isFollowed = !!item.is_followed;
              const postDate = item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA';
              const postImage = item.image_url || item.image || null;
              
              const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
              const maxCapacity = item.max_capacity || item.capacity || 'Unlimited';
              const locationText = item.location || 'University Campus';

              return (
                <article 
                  key={item.id} 
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
                      <div 
                        style={{ 
                          width: '2.5rem', 
                          height: '2.5rem', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #9f1239 0%, #881337 100%)', 
                          color: '#ffffff', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 800, 
                          fontSize: '0.8rem',
                          flexShrink: 0,
                          overflow: 'hidden'
                        }}
                      >
                        {item.page_avatar_url ? (
                          <img src={item.page_avatar_url} alt={deptName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          avatarText
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deptName}
                          </h4>
                          {pageId && (
                            <>
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                              <button
                                type="button"
                                onClick={() => handleToggleFollow(pageId, isFollowed)}
                                disabled={togglingPageId === pageId}
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
                                {togglingPageId === pageId ? 'Updating...' : isFollowed ? 'Following' : 'Follow'}
                              </button>
                            </>
                          )}
                          <span 
                            style={{ 
                              fontSize: '0.625rem', 
                              fontWeight: 600, 
                              padding: '0.1rem 0.4rem', 
                              borderRadius: '9999px', 
                              backgroundColor: isUpcoming ? '#e6f7ef' : '#f1f5f9', 
                              color: isUpcoming ? '#0f8a5f' : '#475569',
                              border: `1px solid ${isUpcoming ? '#a7e3c8' : '#e2e8f0'}`
                            }}
                          >
                            {isUpcoming ? 'Confirmed' : 'Ended'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <EventPostMeta
                            registeredCount={currentRegistered}
                            capacity={item.max_capacity || item.capacity}
                            createdAt={item.created_at}
                            audience={item.audience}
                          />
                        </div>
                      </div>
                    </div>

                    {item.is_owner && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <PostOwnerActionMenu
                          isOpen={activeMenuKey === (item.id || item.event_id)}
                          onToggle={() => {
                            const key = item.id || item.event_id;
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
                        {item.description}
                      </p>
                    </div>
                  )}

                  {postImage && (
                    <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                      <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                        {item.title}
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.5, margin: '0.4rem 0 0 0' }}>
                        {item.description}
                      </p>
                    </div>
                  )}

                  {/* Inline Action Bar (Scan / Unregister) */}
                  <EventPostActionBar
                    isRegistered={true}
                    onToggleRegister={isUpcoming ? () => handleCancelRegistration(item.id) : null}
                    onScanAttendance={isUpcoming ? () => {
                      const scanToken = prompt("Scan or enter event QR token:");
                      if (scanToken) {
                        const clean = scanToken.trim().split('/').pop();
                        navigate(`/student/attendance/check-in/${clean}`);
                      }
                    } : null}
                  />
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