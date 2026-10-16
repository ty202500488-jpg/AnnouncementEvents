import React, { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/StaffDashboard.css';
import '../../styles/Profile.css';
import '../../styles/Settings.css';
import '../../styles/MyPageDashboard.css';

export default function MyPageDashboard({ onSwitchToStaffDashboard }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Interaction States
  const [likes, setLikes] = useState({});
  const [bookmarks, setBookmarks] = useState({});

  // Post Creator State
  const [isExpanded, setIsExpanded] = useState(false);
  const [postType, setPostType] = useState('announcement');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');

  // Editing State
  const [editingPost, setEditingPost] = useState(null);

  // Department Page Profile State (Synced with localStorage)
  const [pageName, setPageName] = useState('College Of Computing Studies');
  const [pageCode, setPageCode] = useState('COCS');
  const [pageBio, setPageBio] = useState('Official department page and announcement board.');

  useEffect(() => {
    // Load stored profile data from localStorage to match page profile
    const storedProfile = localStorage.getItem('myPageProfile');
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile);
        if (parsed.pageName) setPageName(parsed.pageName);
        if (parsed.pageCode) setPageCode(parsed.pageCode);
        if (parsed.description) setPageBio(parsed.description);
      } catch (err) {
        console.error('Failed to parse page profile from localStorage', err);
      }
    }

    const fetchPageData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const response = await fetch('http://localhost:5000/api/dashboard-data', {
          method: 'POST',
          headers
        });
        const data = await response.json();
        if (response.ok) {
          if (data.announcements) setAnnouncements(data.announcements);
          if (data.events) setEvents(data.events);
        }

        const statusRes = await fetch('http://localhost:5000/api/my-page-status', { headers });
        const statusData = await statusRes.json();
        if (statusRes.ok && statusData.exists) {
          if (statusData.pageName) setPageName(statusData.pageName);
          if (statusData.pageCode) setPageCode(statusData.pageCode);
          if (statusData.description) setPageBio(statusData.description);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
  }, []);

  const handleLikeToggle = (id) => {
    setLikes(prev => {
      const current = prev[id] || { count: 0, liked: false };
      const newLiked = !current.liked;
      return {
        ...prev,
        [id]: {
          liked: newLiked,
          count: newLiked ? current.count + 1 : Math.max(0, current.count - 1)
        }
      };
    });
  };

  const handleBookmarkToggle = (id) => {
    setBookmarks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDeletePost = async (id, type) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'event' 
        ? `http://localhost:5000/api/events/${id}` 
        : `http://localhost:5000/api/announcements/${id}`;
      
      const response = await fetch(endpoint, { 
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });

      if (response.ok) {
        if (type === 'event') {
          setEvents(prev => prev.filter(item => item.event_id !== id));
        } else {
          setAnnouncements(prev => prev.filter(item => item.announcement_id !== id));
        }
      } else {
        alert('Failed to delete the post.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleStartEdit = (item, type) => {
    setEditingPost({ ...item, type });
    setPostType(type);
    setQuickTitle(item.title || item.event_title || '');
    setQuickBody(item.content || item.event_description || '');
    setEventDate(item.event_date ? item.event_date.split('T')[0] : '');
    setLocation(item.location || '');
    setCapacity(item.capacity || '');
    setIsExpanded(true);
  };

  const handleQuickPublish = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim() && !quickBody.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      if (editingPost) {
        const isEvent = editingPost.type === 'event';
        const endpoint = isEvent 
          ? `http://localhost:5000/api/events/${editingPost.event_id}` 
          : `http://localhost:5000/api/announcements/${editingPost.announcement_id}`;

        const bodyData = isEvent ? {
          event_title: quickTitle,
          event_description: quickBody,
          event_date: eventDate || new Date().toISOString().split('T')[0],
          location: location || 'TBD',
          capacity: capacity ? parseInt(capacity) : null
        } : {
          title: quickTitle,
          content: quickBody
        };

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers,
          body: JSON.stringify(bodyData)
        });

        if (response.ok) {
          if (isEvent) {
            setEvents(prev => prev.map(ev => ev.event_id === editingPost.event_id ? { ...ev, event_title: quickTitle, event_description: quickBody, event_date: eventDate, location, capacity } : ev));
          } else {
            setAnnouncements(prev => prev.map(an => an.announcement_id === editingPost.announcement_id ? { ...an, title: quickTitle, content: quickBody } : an));
          }
        }
      } else {
        if (postType === 'announcement') {
          const response = await fetch('http://localhost:5000/api/announcements', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              title: quickTitle,
              content: quickBody,
              status: 'Published',
              is_pinned: false
            })
          });
          const data = await response.json();
          if (response.ok) {
            setAnnouncements([data.announcement || { announcement_id: Date.now(), title: quickTitle, content: quickBody, status: 'Published', created_at: new Date().toISOString() }, ...announcements]);
          }
        } else {
          const response = await fetch('http://localhost:5000/api/events', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              event_title: quickTitle,
              event_description: quickBody,
              event_date: eventDate || new Date().toISOString().split('T')[0],
              location: location || 'TBD',
              capacity: capacity ? parseInt(capacity) : null,
              status: 'Published'
            })
          });
          const data = await response.json();
          if (response.ok) {
            setEvents([data.event || { event_id: Date.now(), event_title: quickTitle, event_description: quickBody, event_date: eventDate || 'TBD', status: 'Published', registrations: 0 }, ...events]);
          }
        }
      }

      setQuickTitle('');
      setQuickBody('');
      setEventDate('');
      setLocation('');
      setCapacity('');
      setEditingPost(null);
      setIsExpanded(false);
    } catch (err) {
      console.error('Failed to publish post:', err);
    }
  };

  return (
    <MyPageDashboardLayout 
      activeTab={activeTab} 
      pageName={pageName}
      pageCode={pageCode}
      onTabChange={(tab) => {
        if (tab === 'profile') window.location.href = '/staff/mypage/profile';
        else if (tab === 'settings') window.location.href = '/staff/mypage/settings';
        else if (tab === 'registrations') window.location.href = '/staff/mypage/registrations';
        else if (tab === 'help') window.location.href = '/staff/mypage/help';
        else setActiveTab(tab);
      }} 
      onSwitchToStaffDashboard={onSwitchToStaffDashboard}
    >
      <main className="lg-col-6 space-y-6" style={{ width: '100%' }}>
        
        {/* Quick Post Creator Card */}
        <div className="card" style={{ padding: '0.875rem 1.25rem', width: '100%' }}>
          {!isExpanded ? (
            <div className="flex items-center gap-3">
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: '#881337', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>
                {pageCode ? pageCode.substring(0, 3).toUpperCase() : pageName.substring(0, 2).toUpperCase()}
              </div>
              <div 
                onClick={() => { setEditingPost(null); setIsExpanded(true); }}
                style={{ flex: 1, backgroundColor: 'var(--slate-100)', borderRadius: '9999px', padding: '0.625rem 1.25rem', color: 'var(--slate-500)', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                What's on your mind?
              </div>
            </div>
          ) : (
            <form onSubmit={handleQuickPublish} className="space-y-3">
              <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--slate-100)', paddingBottom: '0.5rem' }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--slate-800)' }}>
                    {editingPost ? 'Edit Post' : 'Create Department Post'}
                  </span>
                </div>
                <button type="button" onClick={() => { setIsExpanded(false); setEditingPost(null); }} style={{ background: 'none', border: 'none', color: 'var(--slate-400)', cursor: 'pointer' }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {!editingPost && (
                <div className="flex items-center gap-2" style={{ background: 'var(--slate-50)', padding: '0.375rem', borderRadius: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setPostType('announcement')}
                    style={{
                      flex: 1, padding: '0.375rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: postType === 'announcement' ? '#ffffff' : 'transparent',
                      color: postType === 'announcement' ? '#881337' : 'var(--slate-500)',
                      boxShadow: postType === 'announcement' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <i className="fa-solid fa-bullhorn" style={{ marginRight: '0.35rem' }}></i> Announcement
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostType('event')}
                    style={{
                      flex: 1, padding: '0.375rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: postType === 'event' ? '#ffffff' : 'transparent',
                      color: postType === 'event' ? '#881337' : 'var(--slate-500)',
                      boxShadow: postType === 'event' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <i className="fa-solid fa-calendar-days" style={{ marginRight: '0.35rem' }}></i> Event
                  </button>
                </div>
              )}

              <input 
                type="text" 
                placeholder={postType === 'announcement' ? "Announcement title..." : "Event title..."} 
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', fontSize: '0.875rem' }}
              />

              {postType === 'event' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', fontSize: '0.75rem' }} />
                  <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', fontSize: '0.75rem' }} />
                  <input type="number" placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', fontSize: '0.75rem' }} />
                </div>
              )}

              <textarea 
                rows="3" 
                placeholder={postType === 'announcement' ? "Write announcement content..." : "Event description..."} 
                value={quickBody}
                onChange={(e) => setQuickBody(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', fontSize: '0.875rem', resize: 'none' }}
                autoFocus
              ></textarea>

              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-slate-500">
                  <i className="fa-regular fa-image" style={{ color: '#10b981', cursor: 'pointer', fontSize: '1.125rem' }}></i>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setIsExpanded(false); setEditingPost(null); }} style={{ padding: '0.4rem 0.875rem', background: 'var(--slate-100)', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-600)', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" className="btn-nav" style={{ padding: '0.4rem 1.125rem', fontSize: '0.75rem' }}>{editingPost ? 'Update' : 'Post'}</button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Feed Timeline */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : announcements.length === 0 && events.length === 0 ? (
          <article className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No database announcements available yet.</p>
          </article>
        ) : (
          <div className="space-y-4">
            {announcements.map((item, index) => {
              const postId = item.announcement_id || index;
              const postLike = likes[postId] || { count: 0, liked: false };
              const isBookmarked = bookmarks[postId] || false;

              return (
                <article key={postId} className="card card-interactive" style={{ padding: '1.5rem' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '5.75rem', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        {pageCode ? pageCode.substring(0, 3).toUpperCase() : pageName.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>{pageName}</h3>
                        <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem' }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'} &bull; <span style={{ color: 'var(--emerald-600)', fontWeight: 600 }}>Announcement</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="bookmark-btn action-btn" onClick={() => handleBookmarkToggle(postId)} style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <i className={`${isBookmarked ? 'fa-solid bookmarked-btn' : 'fa-regular'} fa-bookmark`} style={{ fontSize: '1rem' }}></i>
                      </button>
                      <button onClick={() => handleStartEdit(item, 'announcement')} className="action-btn" title="Edit" style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-600)' }}>
                        <i className="fa-solid fa-pen" style={{ fontSize: '0.9rem' }}></i>
                      </button>
                      <button onClick={() => handleDeletePost(item.announcement_id, 'announcement')} className="action-btn" title="Delete" style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose-600)' }}>
                        <i className="fa-solid fa-trash" style={{ fontSize: '1rem' }}></i>
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>{item.title}</h4>
                    <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.5rem', lineHeight: 1.625 }}>{item.content}</p>
                  </div>

                  <div className="flex items-center justify-between" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    <button className="like-btn action-btn" onClick={() => handleLikeToggle(postId)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <i className={`${postLike.liked ? 'fa-solid liked-btn' : 'fa-regular'} fa-eye`} style={{ fontSize: '0.875rem' }}></i>
                      <span>{postLike.count > 0 ? `${postLike.count} Likes` : 'View Details'}</span>
                    </button>
                  </div>
                </article>
              );
            })}

            {events.map((ev, index) => {
              const eventId = ev.event_id || `ev-${index}`;
              const eventLike = likes[eventId] || { count: 0, liked: false };
              const isBookmarked = bookmarks[eventId] || false;

              return (
                <article key={eventId} className="card card-interactive" style={{ padding: '1.5rem' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '5.75rem', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        {pageCode ? pageCode.substring(0, 3).toUpperCase() : pageName.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>{pageName}</h3>
                        <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem' }}>{ev.event_date || 'TBD'} &bull; <span style={{ color: 'var(--amber-700)', fontWeight: 600 }}>Event</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="bookmark-btn action-btn" onClick={() => handleBookmarkToggle(eventId)} style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <i className={`${isBookmarked ? 'fa-solid bookmarked-btn' : 'fa-regular'} fa-bookmark`} style={{ fontSize: '1rem' }}></i>
                      </button>
                      <button onClick={() => handleStartEdit(ev, 'event')} className="action-btn" title="Edit" style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-600)' }}>
                        <i className="fa-solid fa-pen" style={{ fontSize: '0.9rem' }}></i>
                      </button>
                      <button onClick={() => handleDeletePost(ev.event_id, 'event')} className="action-btn" title="Delete" style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose-600)' }}>
                        <i className="fa-solid fa-trash" style={{ fontSize: '1rem' }}></i>
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>{ev.event_title}</h4>
                    <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.5rem', lineHeight: 1.625 }}>{ev.event_description}</p>
                  </div>

                  <div className="flex items-center justify-between" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    <button className="like-btn action-btn" onClick={() => handleLikeToggle(eventId)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <i className={`${eventLike.liked ? 'fa-solid liked-btn' : 'fa-regular'} fa-eye`} style={{ fontSize: '0.875rem' }}></i>
                      <span>{eventLike.count > 0 ? `${eventLike.count} Likes` : 'View Details'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </main>
    </MyPageDashboardLayout>
  );
}