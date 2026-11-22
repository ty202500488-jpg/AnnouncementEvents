import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import HiddenPostCard from '../../assets/components/HiddenPostCard';
import {
  EventPostMeta,
  EventPostActionBar,
  PostAudienceBadge,
  ExpandablePostText,
  normalizePostAudience,
  toggleEventRegistrationRequest,
  applyEventRegistrationUpdate,
} from '../../assets/components/PortalShellElements';
import EventRegistrationModal from '../../assets/components/EventRegistrationModal';
import EventRegistrationsManagerModal from '../../assets/components/EventRegistrationsManagerModal';
import { getHighlightedCardProps, useHighlightedPost } from '../../utils/notificationUtils';
import { formatPostTimestamp } from '../../utils/dateUtils';
import {
  shuffleFeedItems,
  hidePostOnServer,
  unhidePostOnServer,
  hideAllFromPageOnServer,
} from '../../utils/feedUtils';
import '../styles/StaffDashboard.css';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingPageId, setTogglingPageId] = useState(null);
  const [hiddenPosts, setHiddenPosts] = useState({});
  const [hiddenPageKeys, setHiddenPageKeys] = useState([]);
  const [activeMenuKey, setActiveMenuKey] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(null);
  const [registeringEventId, setRegisteringEventId] = useState(null);
  const [registeringModalEvent, setRegisteringModalEvent] = useState(null);
  const [viewingRegistrationsEvent, setViewingRegistrationsEvent] = useState(null);
  const highlightedPostId = useHighlightedPost(!loading && feed.length > 0);

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
        setFeed((prev) => applyEventRegistrationUpdate(prev, eventId, null));
      } else {
        alert(result.message || 'Failed to update event registration.');
      }
    } catch {
      alert('Network error while updating event registration.');
    } finally {
      setRegisteringEventId(null);
    }
  };

  const token = localStorage.getItem('token');

  const fetchDashboardContent = async () => {
    try {
      const response = await fetch('http://localhost:5000/users/dashboard-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await response.json();
      if (response.ok) {
        // Tag each item with its type then shuffle feed on load
        const announcements = (data.announcements || []).map(a => ({ ...a, _type: 'Announcement' }));
        const events = (data.events || []).map(e => ({ ...e, _type: 'Event' }));
        setFeed(shuffleFeedItems([...announcements, ...events]));
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardContent();
  }, [token]);

  const handleToggleFollow = async (pageId, currentFollowState) => {
    if (!pageId) return;
    if (!token) {
      navigate('/auth');
      return;
    }

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
        setFeed(prev =>
          prev.map(item =>
            item.page_id === pageId ? { ...item, is_followed: !currentFollowState } : item
          )
        );
        fetchDashboardContent();
      }
    } catch (err) {
      console.error('Error toggling follow from feed:', err);
    } finally {
      setTogglingPageId(null);
    }
  };

  const handleHidePost = (postKey, postId) => {
    setHiddenPosts(prev => ({
      ...prev,
      [postKey]: { reason: null, dismissed: false, postId }
    }));
    setActiveMenuKey(null);
    hidePostOnServer(postId, token);
  };

  const handleUndoHidePost = (postKey, postId) => {
    setHiddenPosts(prev => {
      const next = { ...prev };
      delete next[postKey];
      return next;
    });
    unhidePostOnServer(postId, token);
  };

  const handleSelectHideReason = (postKey, postId, reason) => {
    setHiddenPosts(prev => ({
      ...prev,
      [postKey]: { ...(prev[postKey] || {}), reason, dismissed: false }
    }));
    hidePostOnServer(postId, token, reason);
  };

  const handleHideAllFromPage = (pageKey, pageId) => {
    if (!pageKey) return;
    setHiddenPageKeys(prev => (prev.includes(pageKey) ? prev : [...prev, pageKey]));
    if (pageId) hideAllFromPageOnServer(pageId, token);
  };

  const handleOpenEditPost = (item) => {
    setEditingPost(item);
    setPostTitle(item.title || '');
    setPostContent(item.content || item.description || '');
    setActiveMenuKey(null);
  };

  const handleSavePostEdit = async (e) => {
    e.preventDefault();
    if (!editingPost || !token) return;
    setSubmittingPost(true);
    const isEvent = editingPost._type === 'Event';
    const targetId = editingPost.id || editingPost.post_id;
    const editEndpoint = isEvent
      ? `http://localhost:5000/api/events/${targetId}`
      : `http://localhost:5000/api/announcements/${targetId}`;
    try {
      const bodyData = isEvent
        ? { event_title: postTitle, event_description: postContent }
        : { title: postTitle, content: postContent };
      const res = await fetch(editEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyData),
      });
      if (res.ok) {
        setFeed(prev =>
          prev.map(p =>
            (p.id || p.post_id) === targetId && p._type === editingPost._type
              ? { ...p, title: postTitle, content: postContent, description: postContent }
              : p
          )
        );
        setEditingPost(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to update post.');
      }
    } catch (err) {
      console.error('Error updating post:', err);
      alert('Network error while updating post.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost || !token) return;
    const isEvent = deletingPost._type === 'Event';
    const deleteId = deletingPost.id || deletingPost.post_id;
    const deleteEndpoint = isEvent
      ? `http://localhost:5000/api/events/${deleteId}`
      : `http://localhost:5000/api/announcements/${deleteId}`;
    try {
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFeed(prev =>
          prev.filter(p => !((p.id || p.post_id) === deleteId && p._type === deletingPost._type))
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to delete post.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Network error while deleting post.');
    } finally {
      setDeletingPost(null);
    }
  };

  const visibleFeed = feed.filter((item, idx) => {
    const key = `${item._type}-${item.id || idx}`;
    const pageKey = item.page_id || item.department_name || item.page_name;
    if (pageKey && hiddenPageKeys.includes(pageKey)) return false;
    if (hiddenPosts[key]?.dismissed) return false;

    const audienceKind = normalizePostAudience(item.audience);
    if (audienceKind === 'private') return false;
    if (audienceKind === 'followers') return !!item.is_followed;
    return true;
  });

  return (
    <StaffDashboardLayout activePage="home">
      {/* Hidden Scrollbar Global Style Injection */}
      <style>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>

      {/* ==================== CENTER MAIN CONTENT (DYNAMIC FEED) ==================== */}
      <main 
        className="lg-col-6 no-scrollbar" 
        style={{ 
          overflowY: 'auto', 
          maxHeight: '100%',
          minHeight: 0, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem', 
          paddingBottom: '2rem' 
        }}
      >
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : visibleFeed.length === 0 ? (
          <article className="card" style={{ padding: '1.75rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No posts available yet.</p>
          </article>
        ) : (
          visibleFeed.map((item, index) => {
            const postKey = `${item._type}-${item.id || index}`;
            const isEvent = item._type === 'Event';
            const deptName = item.department_name || item.page_name || 'Staff Department Office';
            const avatarText = item.code || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
            const isFollowed = !!item.is_followed;
            const pageId = item.page_id;
            
            // Format Timestamp / Date
            const postDate = formatPostTimestamp(item.created_at || item.date || item.event_date);
            const postImage = item.image_url || item.image || null;

            // Event-specific details
            const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
            const maxCapacity = item.max_capacity || item.capacity || 'Unlimited';
            const locationText = item.location || 'University Campus';
            const { domId, highlightStyle } = getHighlightedCardProps(item, highlightedPostId);
            const hideState = hiddenPosts[postKey];
            const pageKey = pageId || deptName;
            const postId = item.id || item.post_id;

            if (hideState) {
              return (
                <HiddenPostCard
                  key={item.id || index}
                  deptName={deptName}
                  pageId={pageId}
                  isFollowed={isFollowed}
                  togglingPageId={togglingPageId}
                  selectedReason={hideState.reason}
                  onUndo={() => handleUndoHidePost(postKey, postId)}
                  onSelectReason={(reason) => handleSelectHideReason(postKey, postId, reason)}
                  onUnfollow={() => handleToggleFollow(pageId, true)}
                  onHideAllFromPage={() => handleHideAllFromPage(pageKey, pageId)}
                  onViewPage={() => navigate(`/staff/page/${pageId}`)}
                />
              );
            }

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
                  flexShrink: 0,
                  ...highlightStyle
                }}
              >
                {/* 1. POST HEADER */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem 0.875rem 1rem' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1, cursor: pageId ? 'pointer' : 'default' }}
                    onClick={() => pageId && navigate(`/staff/page/${pageId}`)}
                    title={pageId ? `View ${deptName} page` : ''}
                  >
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
                        {pageId && (
                          <>
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFollow(pageId, isFollowed);
                              }}
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
                              title={isFollowed ? 'Click to unfollow page' : 'Click to follow page'}
                            >
                              {togglingPageId === pageId ? 'Updating...' : isFollowed ? 'Following' : 'Follow'}
                            </button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {isEvent ? (
                          <EventPostMeta
                            registeredCount={currentRegistered}
                            capacity={item.max_capacity || item.capacity}
                            createdAt={item.created_at}
                            audience={item.audience}
                            requiresRegistration={item.requires_registration !== false}
                          />
                        ) : (
                          <>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Announcement • {postDate}</span>
                            <span>•</span>
                            <PostAudienceBadge audience={item.audience} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, position: 'relative' }}>
                    {item.is_owner && (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuKey(prev => (prev === postKey ? null : postKey));
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '0.35rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '9999px'
                          }}
                          title="Manage post"
                        >
                          <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '0.95rem' }}></i>
                        </button>

                        {activeMenuKey === postKey && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '0.25rem',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.625rem',
                              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                              minWidth: '130px',
                              zIndex: 30,
                              overflow: 'hidden'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenEditPost(item)}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#1e293b',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingPost(item);
                                setActiveMenuKey(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.55rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                borderTop: '1px solid #f1f5f9',
                                textAlign: 'left',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#b91c1c',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <i className="fa-solid fa-trash-can"></i> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHidePost(postKey, postId);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '9999px'
                      }}
                      title="Hide this post"
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: '1rem' }}></i>
                    </button>
                  </div>
                </div>

                {/* 2. POST CONTENT & MEDIA CONTAINER */}
                <div style={{ padding: postImage ? '0.25rem 1rem 0.75rem 1rem' : '0.5rem 1rem 1rem 1rem' }}>
                  <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: postImage ? '1.0625rem' : '1.125rem', lineHeight: 1.35, margin: 0, ...(postImage ? {} : { textTransform: 'uppercase', letterSpacing: '0.01em' }) }}>
                    {item.title}
                  </h3>
                  <ExpandablePostText
                    text={item.content || item.description}
                    style={{ color: '#475569', fontSize: postImage ? '0.9rem' : '0.9375rem', lineHeight: postImage ? 1.5 : 1.6, margin: postImage ? '0.4rem 0 0 0' : '0.75rem 0 0 0' }}
                  />
                </div>
                {postImage && (
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
                )}

                {/* 3. EVENT REGISTRATION & ATTENDANCE BAR */}
                {isEvent && (
                  <EventPostActionBar
                    isRegistered={Boolean(item.is_registered)}
                    registrationStatus={item.registration_status}
                    rejectionReason={item.rejection_reason}
                    requiresRegistration={item.requires_registration !== false}
                    registeredCount={currentRegistered}
                    capacity={item.max_capacity || item.capacity}
                    pendingCount={item.pending_registration_count || 0}
                    isOwner={Boolean(item.is_owner)}
                    isRegistering={registeringEventId === postId}
                    onToggleRegister={!item.is_owner ? () => handleEventRegister(item) : null}
                    onViewRegistrations={() => setViewingRegistrationsEvent(item)}
                  />
                )}
              </article>
            );
          })
        )}
      </main>

      {editingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem'
          }}
          onClick={() => setEditingPost(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '480px',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Edit Post</h3>
              <button type="button" onClick={() => setEditingPost(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.1rem' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSavePostEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Post title"
                required
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              />
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Post content"
                rows={4}
                required
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.9rem', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setEditingPost(null)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submittingPost} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#7B0D1E', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {submittingPost ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {registeringModalEvent && (
        <EventRegistrationModal
          event={registeringModalEvent}
          onClose={() => setRegisteringModalEvent(null)}
          onSuccess={(data, targetId) => {
            setFeed((prev) => applyEventRegistrationUpdate(prev, targetId, data?.status || 'Registered'));
            setRegisteringModalEvent(null);
          }}
        />
      )}

      {viewingRegistrationsEvent && (
        <EventRegistrationsManagerModal
          event={viewingRegistrationsEvent}
          onClose={() => setViewingRegistrationsEvent(null)}
          onUpdated={(targetId, counts) => {
            setFeed((prev) =>
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

      {deletingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem'
          }}
          onClick={() => setDeletingPost(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '400px',
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Delete Post</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#475569' }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setDeletingPost(null)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeletePost} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#b91c1c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffDashboardLayout>
  );
}