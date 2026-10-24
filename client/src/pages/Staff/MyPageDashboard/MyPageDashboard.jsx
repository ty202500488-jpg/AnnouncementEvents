import React, { useState, useEffect, useRef } from 'react';
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
  
  const [likes, setLikes] = useState({});
  const [bookmarks, setBookmarks] = useState({});

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postType, setPostType] = useState('announcement');
  const [audience, setAudience] = useState('All Campus');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [editingPost, setEditingPost] = useState(null);

  const [pageName, setPageName] = useState('College Of Computing Studies');
  const [pageCode, setPageCode] = useState('COCS');
  const [userName, setUserName] = useState('Charm');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.first_name || parsed.firstName) {
          setUserName(parsed.first_name || parsed.firstName);
        }
      } catch (e) {
        console.error('Failed to parse user', e);
      }
    }

    const storedProfile = localStorage.getItem('myPageProfile');
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile);
        if (parsed.pageName) setPageName(parsed.pageName);
        if (parsed.pageCode) setPageCode(parsed.pageCode);
      } catch (err) {
        console.error('Failed to parse page profile', err);
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setQuickTitle('');
    setQuickBody('');
    setEventDate('');
    setLocation('');
    setCapacity('');
    setSelectedImage(null);
    setImagePreview(null);
    setEditingPost(null);
    setIsModalOpen(false);
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
    setIsModalOpen(true);
  };

  const handlePublishPost = async (e) => {
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
            setEvents([data.event || { event_id: Date.now(), event_title: quickTitle, event_description: quickBody, event_date: eventDate || 'TBD', location, capacity, status: 'Published' }, ...events]);
          }
        }
      }

      resetForm();
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
        else setActiveTab(tab);
      }} 
      onSwitchToStaffDashboard={onSwitchToStaffDashboard}
    >
      <main className="lg-col-6 space-y-6" style={{ width: '100%' }}>
        
        {/* Trigger Box */}
        <div className="card" style={{ padding: '1.25rem', width: '100%', borderRadius: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div 
              onClick={() => { setEditingPost(null); setIsModalOpen(true); }}
              style={{ width: '100%', backgroundColor: 'var(--slate-100, #f1f5f9)', borderRadius: '9999px', padding: '0.75rem 1.25rem', color: 'var(--slate-500, #64748b)', fontSize: '0.875rem', cursor: 'pointer', border: '1px solid var(--slate-200, #e2e8f0)' }}
            >
              Write an announcement, event, or post description...
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingTop: '0.625rem', borderTop: '1px solid var(--slate-100, #f1f5f9)' }}>
              <button 
                type="button" 
                onClick={() => { setPostType('announcement'); setIsModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#881337', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fa-solid fa-bullhorn" style={{ color: '#e11d48' }}></i> Announcement
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--slate-200)' }}></div>
              <button 
                type="button" 
                onClick={() => { setPostType('event'); setIsModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#881337', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fa-regular fa-calendar-days" style={{ color: '#d97706' }}></i> Event
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--slate-200)' }}></div>
              <button 
                type="button" 
                onClick={() => { setIsModalOpen(true); setTimeout(() => fileInputRef.current?.click(), 100); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--slate-600)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fa-regular fa-image" style={{ color: '#10b981' }}></i> Photo
              </button>
            </div>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={resetForm}
          >
            <div 
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '540px',
                borderRadius: '1rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--slate-900)', textAlign: 'center', width: '100%', margin: 0 }}>
                  {editingPost ? 'Edit Post' : 'Create Post'}
                </h3>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--slate-100)', border: 'none', color: 'var(--slate-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="fa-solid fa-xmark" style={{ fontSize: '1rem' }}></i>
                </button>
              </div>

              <form onSubmit={handlePublishPost} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--slate-900)', lineHeight: 1.2 }}>
                    {pageName}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <select 
                      value={postType} 
                      onChange={(e) => setPostType(e.target.value)}
                      style={{ backgroundColor: 'var(--slate-100)', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '11px', fontWeight: 700, color: '#881337', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="announcement">📢 Announcement</option>
                      <option value="event">📅 Event</option>
                    </select>

                    <select 
                      value={audience} 
                      onChange={(e) => setAudience(e.target.value)}
                      style={{ backgroundColor: 'var(--slate-100)', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '11px', fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="All Campus">👥 All Campus</option>
                      <option value="Students Only">🎓 Students Only</option>
                      <option value="Faculty Only">🏛️ Faculty Only</option>
                    </select>
                  </div>
                </div>

                <input 
                  type="text" 
                  placeholder={postType === 'announcement' ? "Announcement Title..." : "Event Title..."} 
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)', fontSize: '0.9375rem', fontWeight: 700, outline: 'none', color: 'var(--slate-900)' }}
                  required
                />

                {postType === 'event' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: 'var(--slate-50)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>EVENT DATE</label>
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', fontSize: '0.75rem', backgroundColor: '#ffffff' }} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>LOCATION / VENUE</label>
                      <input type="text" placeholder="e.g. CCS Gym" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', fontSize: '0.75rem', backgroundColor: '#ffffff' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>CAPACITY</label>
                      <input type="number" placeholder="Max capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', fontSize: '0.75rem', backgroundColor: '#ffffff' }} />
                    </div>
                  </div>
                )}

                <textarea 
                  rows="4" 
                  placeholder="Write post description..." 
                  value={quickBody}
                  onChange={(e) => setQuickBody(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--slate-200)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9375rem', resize: 'none', outline: 'none', color: 'var(--slate-800)', fontFamily: 'inherit', minHeight: '110px' }}
                  required
                ></textarea>

                {imagePreview && (
                  <div style={{ position: 'relative', width: '100%', maxHeight: '220px', overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
                    <img src={imagePreview} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      type="button" 
                      onClick={handleRemoveImage}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }}></i>
                    </button>
                  </div>
                )}

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--slate-200)', borderRadius: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)' }}>Add to your post</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', padding: '0.4rem', cursor: 'pointer', color: '#10b981', fontSize: '1.1rem' }}><i className="fa-regular fa-image"></i></button>
                    <button type="button" onClick={() => setPostType(postType === 'event' ? 'announcement' : 'event')} style={{ background: 'none', border: 'none', padding: '0.4rem', cursor: 'pointer', color: '#d97706', fontSize: '1.1rem' }}><i className="fa-regular fa-calendar-days"></i></button>
                    <button type="button" onClick={() => { const loc = prompt('Enter Location:', location); if(loc !== null) setLocation(loc); }} style={{ background: 'none', border: 'none', padding: '0.4rem', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem' }}><i className="fa-solid fa-location-dot"></i></button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: '#881337', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
                >
                  {editingPost ? 'Save Changes' : 'Post'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Feed List */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading department feed...</p>
        ) : announcements.length === 0 && events.length === 0 ? (
          <article className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', color: 'var(--slate-300)', marginBottom: '0.5rem', display: 'block' }}></i>
            <p style={{ color: 'var(--slate-600)', fontWeight: 600 }}>No Announcements or Events posted yet.</p>
          </article>
        ) : (
          <div className="space-y-4">
            {announcements.map((item, index) => {
              const postId = item.announcement_id || index;
              const postLike = likes[postId] || { count: 0, liked: false };
              const isBookmarked = bookmarks[postId] || false;

              return (
                <article key={postId} className="card card-interactive" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem', lineHeight: 1.2 }}>{pageName}</h3>
                      <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}</span>
                        <span>&bull;</span>
                        <span style={{ color: '#e11d48', fontWeight: 700, backgroundColor: '#fff1f2', padding: '1px 6px', borderRadius: '4px' }}>Announcement</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button className="bookmark-btn action-btn" onClick={() => handleBookmarkToggle(postId)} style={{ padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <i className={`${isBookmarked ? 'fa-solid bookmarked-btn' : 'fa-regular'} fa-bookmark`} style={{ fontSize: '0.95rem', color: isBookmarked ? '#881337' : 'var(--slate-400)' }}></i>
                      </button>
                      <button onClick={() => handleStartEdit(item, 'announcement')} className="action-btn" title="Edit" style={{ padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                        <i className="fa-solid fa-pen" style={{ fontSize: '0.85rem' }}></i>
                      </button>
                      <button onClick={() => handleDeletePost(item.announcement_id, 'announcement')} className="action-btn" title="Delete" style={{ padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose-600)' }}>
                        <i className="fa-solid fa-trash" style={{ fontSize: '0.9rem' }}></i>
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.875rem' }}>
                    <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.975rem', lineHeight: 1.3 }}>{item.title}</h4>
                    <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.375rem', lineHeight: 1.625 }}>{item.content}</p>
                  </div>

                  <div className="flex items-center justify-between" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    <button className="like-btn action-btn" onClick={() => handleLikeToggle(postId)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', color: postLike.liked ? '#881337' : 'var(--slate-500)' }}>
                      <i className={`${postLike.liked ? 'fa-solid' : 'fa-regular'} fa-heart`} style={{ fontSize: '0.9rem', color: postLike.liked ? '#e11d48' : 'inherit' }}></i>
                      <span>{postLike.count > 0 ? `${postLike.count} Likes` : 'Like'}</span>
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
                <article key={eventId} className="card card-interactive" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem', lineHeight: 1.2 }}>{pageName}</h3>
                      <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{ev.event_date || 'Upcoming'}</span>
                        <span>&bull;</span>
                        <span style={{ color: '#b45309', fontWeight: 700, backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>Event</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button className="bookmark-btn action-btn" onClick={() => handleBookmarkToggle(eventId)} style={{ padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <i className={`${isBookmarked ? 'fa-solid bookmarked-btn' : 'fa-regular'} fa-bookmark`} style={{ fontSize: '0.95rem', color: isBookmarked ? '#881337' : 'var(--slate-400)' }}></i>
                      </button>
                      <button onClick={() => handleStartEdit(ev, 'event')} className="action-btn" title="Edit" style={{ padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                        <i className="fa-solid fa-pen" style={{ fontSize: '0.85rem' }}></i>
                      </button>
                      <button onClick={() => handleDeletePost(ev.event_id, 'event')} className="action-btn" title="Delete" style={{ padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose-600)' }}>
                        <i className="fa-solid fa-trash" style={{ fontSize: '0.9rem' }}></i>
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.875rem' }}>
                    <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.975rem', lineHeight: 1.3 }}>{ev.event_title}</h4>
                    <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.375rem', lineHeight: 1.625 }}>{ev.event_description}</p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.875rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                      <i className="fa-regular fa-calendar-days" style={{ color: '#881337' }}></i>
                      <span>{ev.event_date || 'Date TBD'}</span>
                    </div>
                    {ev.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                        <i className="fa-solid fa-location-dot" style={{ color: '#e11d48' }}></i>
                        <span>{ev.location}</span>
                      </div>
                    )}
                    {ev.capacity && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                        <i className="fa-solid fa-users" style={{ color: '#2563eb' }}></i>
                        <span>Cap: {ev.capacity}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    <button className="like-btn action-btn" onClick={() => handleLikeToggle(eventId)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', color: eventLike.liked ? '#881337' : 'var(--slate-500)' }}>
                      <i className={`${eventLike.liked ? 'fa-solid' : 'fa-regular'} fa-heart`} style={{ fontSize: '0.9rem', color: eventLike.liked ? '#e11d48' : 'inherit' }}></i>
                      <span>{eventLike.count > 0 ? `${eventLike.count} Likes` : 'Like'}</span>
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