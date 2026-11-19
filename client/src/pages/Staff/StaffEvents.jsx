import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import {
  EventPostMeta,
  EventPostActionBar,
  PostOwnerActionMenu,
  ExpandablePostText,
  PostEditDeleteModals,
  toggleEventRegistrationRequest,
  applyEventRegistrationUpdate,
  updatePostRequest,
  deletePostRequest,
} from '../../assets/components/PortalShellElements';
import EventRegistrationModal from '../../assets/components/EventRegistrationModal';
import EventRegistrationsManagerModal from '../../assets/components/EventRegistrationsManagerModal';
import { getHighlightedCardProps, useHighlightedPost } from '../../utils/notificationUtils';
import '../styles/StaffDashboard.css';

export default function StaffEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registeringEventId, setRegisteringEventId] = useState(null);
  const [registeringModalEvent, setRegisteringModalEvent] = useState(null);
  const [viewingRegistrationsEvent, setViewingRegistrationsEvent] = useState(null);
  const [activeMenuKey, setActiveMenuKey] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);
  const highlightedPostId = useHighlightedPost(!loading && events.length > 0);
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
        setEvents((prev) =>
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
        setEvents((prev) => prev.filter((p) => (p.id || p.post_id) !== result.id));
      } else {
        alert(result.message || 'Failed to delete post.');
      }
    } catch {
      alert('Network error while deleting post.');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleEventRegister = async (eventItem) => {
    const eventId = eventItem.id || eventItem.post_id;
    const statusLower = String(eventItem.registration_status || '').toLowerCase();
    const isAlreadySubmitted = Boolean(eventItem.is_registered) || statusLower === 'registered' || statusLower === 'pending';

    if (!isAlreadySubmitted) {
      if (!token) {
        navigate('/auth');
        return;
      }
      setRegisteringModalEvent(eventItem);
      return;
    }

    setRegisteringEventId(eventId);
    try {
      const result = await toggleEventRegistrationRequest(eventId, true);
      if (result.unauthenticated) {
        navigate('/auth');
        return;
      }
      if (result.ok) {
        setEvents((prev) => applyEventRegistrationUpdate(prev, eventId, null));
      } else {
        alert(result.message || 'Failed to update event registration.');
      }
    } catch {
      alert('Network error while updating event registration.');
    } finally {
      setRegisteringEventId(null);
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('http://localhost:5000/users/events-data', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        const data = await response.json();
        if (response.ok && data.events) {
          setEvents(data.events.filter((item) => item.is_followed || item.is_owner));
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
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
        setEvents(prev =>
          prev.map(item =>
            item.page_id === pageId ? { ...item, is_followed: !currentFollowState } : item
          )
        );
      }
    } catch (err) {
      console.error('Failed to update follow status:', err);
    }
  };

  const filteredEvents = events.filter(item => !!item.is_followed || !!item.is_owner);

  return (
    <StaffDashboardLayout activePage="events">
      <main 
        className="lg-col-6 hide-scrollbar" 
        style={{ 
          height: 'calc(100vh - 5rem)', 
          overflowY: 'auto',
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
            <p style={{ fontSize: '0.875rem' }}>Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No events from followed pages yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((item, index) => {
              const deptName = item.department_name || item.page_name || 'University Office';
              const avatarText = deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
              const isFollowed = !!item.is_followed;
              const postImage = item.image_url || item.image || null;
              
              const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
              const locationText = item.location || 'University Campus';
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
                        <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <EventPostMeta
                            registeredCount={currentRegistered}
                            capacity={item.max_capacity || item.capacity}
                            createdAt={item.created_at}
                            audience={item.audience}
                            requiresRegistration={item.requires_registration !== false}
                          />
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
                      <ExpandablePostText
                        text={item.description}
                        style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.6, margin: '0.75rem 0 0 0' }}
                      />
                    </div>
                  )}

                  {postImage && (
                    <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                      <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                        {item.title}
                      </h3>
                      <ExpandablePostText
                        text={item.description}
                        style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: '0.4rem 0 0 0' }}
                      />
                    </div>
                  )}

                  <EventPostActionBar
                    isRegistered={Boolean(item.is_registered)}
                    registrationStatus={item.registration_status}
                    rejectionReason={item.rejection_reason}
                    requiresRegistration={item.requires_registration !== false}
                    registeredCount={currentRegistered}
                    capacity={item.max_capacity || item.capacity}
                    pendingCount={item.pending_registration_count || 0}
                    isOwner={Boolean(item.is_owner)}
                    isRegistering={registeringEventId === (item.id || item.post_id)}
                    onToggleRegister={!item.is_owner ? () => handleEventRegister(item) : null}
                    onViewRegistrations={() => setViewingRegistrationsEvent(item)}
                    onScanAttendance={() => {
                      const scanToken = prompt("Scan or enter event QR token:");
                      if (scanToken) {
                        const clean = scanToken.trim().split('/').pop();
                        navigate(`/staff/attendance/check-in/${clean}`);
                      }
                    }}
                  />
                </article>
              );
            })}
          </div>
        )}
      </main>
      {registeringModalEvent && (
        <EventRegistrationModal
          event={registeringModalEvent}
          onClose={() => setRegisteringModalEvent(null)}
          onSuccess={(data, targetId) => {
            setEvents((prev) => applyEventRegistrationUpdate(prev, targetId, data?.status || 'Registered'));
            setRegisteringModalEvent(null);
          }}
        />
      )}
      {viewingRegistrationsEvent && (
        <EventRegistrationsManagerModal
          event={viewingRegistrationsEvent}
          onClose={() => setViewingRegistrationsEvent(null)}
          onUpdated={(targetId, counts) => {
            setEvents((prev) =>
              prev.map((p) =>
                (p.id || p.post_id) === targetId
                  ? {
                      ...p,
                      registered_count: counts.registered_count,
                      current_registered: counts.registered_count,
                      pending_registration_count: counts.pending_registration_count,
                    }
                  : p
              )
            );
          }}
        />
      )}
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
    </StaffDashboardLayout>
  );
}