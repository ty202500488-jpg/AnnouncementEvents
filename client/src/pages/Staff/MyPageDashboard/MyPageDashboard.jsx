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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [bookmarks, setBookmarks] = useState({});
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postType, setPostType] = useState('announcement');
  const [audience, setAudience] = useState('All Campus');
  const [categoryId, setCategoryId] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [editingPost, setEditingPost] = useState(null);

  const [pageName, setPageName] = useState('Student Affairs Office');
  const [pageCode, setPageCode] = useState('SAO');
  const [userName, setUserName] = useState('Staff User');

  const fetchPageAndFeedData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      // Fetch Feed Data
      const response = await fetch('http://localhost:5000/api/dashboard-data', {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.announcements) setAnnouncements(data.announcements);
        if (data.events) setEvents(data.events);
      }

      // Fetch Categories
      const catRes = await fetch('http://localhost:5000/api/categories', { headers });
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.categories) setCategories(catData.categories);
      }

      // Fetch Page Status
      const statusRes = await fetch('http://localhost:5000/api/my-page-status', { headers });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.exists) {
          if (statusData.pageName) setPageName(statusData.pageName);
          if (statusData.pageCode) setPageCode(statusData.pageCode);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

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

    fetchPageAndFeedData();
  }, []);

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
    setCategoryId('');
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
    } finally {
      setActiveMenuId(null);
    }
  };

  const handleStartEdit = (item, type) => {
    setEditingPost({ ...item, type });
    setPostType(type);
    setQuickTitle(item.title || item.event_title || '');
    setQuickBody(item.content || item.event_description || item.description || '');
    setCategoryId(item.category_id || '');
    setEventDate(item.event_date ? item.event_date.split('T')[0] : '');
    setLocation(item.location || item.venue || '');
    setCapacity(item.capacity || '');
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickBody.trim()) return;

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
          content: quickBody,
          description: quickBody,
          category_id: categoryId ? parseInt(categoryId) : null
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
            setAnnouncements(prev => prev.map(an => an.announcement_id === editingPost.announcement_id ? { ...an, title: quickTitle, content: quickBody, description: quickBody, category_id: categoryId } : an));
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
              description: quickBody,
              category_id: categoryId ? parseInt(categoryId) : null
            })
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || 'Failed to publish announcement.');
            return;
          }
          if (data.announcement) {
            setAnnouncements([data.announcement, ...announcements]);
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
              capacity: capacity ? parseInt(capacity) : null
            })
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || 'Failed to publish event.');
            return;
          }
          if (data.event) {
            setEvents([data.event, ...events]);
          }
        }
      }

      resetForm();
    } catch (err) {
      console.error('Failed to publish post:', err);
      alert('Network error while publishing post.');
    }
  };

  const formatPostTime = (dateStr) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      <main className="lg-col-6 space-y-6" style={{ width: '100%', maxWidth: '680px', margin: '0 auto' }}>
        
        {/* Trigger Box */}
        <div className="card" style={{ padding: '1.25rem', width: '100%', borderRadius: '1rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div 
              onClick={() => { setEditingPost(null); setIsModalOpen(true); }}
              style={{ width: '100%', backgroundColor: '#f8fafc', borderRadius: '9999px', padding: '0.75rem 1.25rem', color: '#64748b', fontSize: '0.875rem', cursor: 'pointer', border: '1px solid #e2e8f0' }}
            >
              Write an announcement, event, or post description...
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingTop: '0.625rem', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                onClick={() => { setPostType('announcement'); setIsModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#881337', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fa-solid fa-bullhorn" style={{ color: '#e11d48' }}></i> Announcement
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0' }}></div>
              <button 
                type="button" 
                onClick={() => { setPostType('event'); setIsModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#881337', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fa-regular fa-calendar-days" style={{ color: '#d97706' }}></i> Event
              </button>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0' }}></div>
              <button 
                type="button" 
                onClick={() => { setIsModalOpen(true); setTimeout(() => fileInputRef.current?.click(), 100); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#475569', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <i className="fa-regular fa-image" style={{ color: '#10b981' }}></i> Photo
              </button>
            </div>
          </div>
        </div>

        {/* Modal Form */}
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
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', textAlign: 'center', width: '100%', margin: 0 }}>
                  {editingPost ? 'Edit Post' : 'Create Post'}
                </h3>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="fa-solid fa-xmark" style={{ fontSize: '1rem' }}></i>
                </button>
              </div>

              <form onSubmit={handlePublishPost} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.2 }}>
                    {pageName}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <select 
                      id="post-type-select"
                      name="postType"
                      value={postType} 
                      onChange={(e) => setPostType(e.target.value)}
                      style={{ backgroundColor: '#f1f5f9', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '11px', fontWeight: 700, color: '#881337', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="announcement">Announcement</option>
                      <option value="event">Event</option>
                    </select>

                    {postType === 'announcement' && (
                      <select 
                        id="category-select"
                        name="categoryId"
                        value={categoryId} 
                        onChange={(e) => setCategoryId(e.target.value)}
                        style={{ backgroundColor: '#f1f5f9', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '11px', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="">Select Category...</option>
                        {categories.map((cat) => (
                          <option key={cat.category_id} value={cat.category_id}>
                            {cat.category_name}
                          </option>
                        ))}
                      </select>
                    )}

                    <select 
                      id="audience-select"
                      name="audience"
                      value={audience} 
                      onChange={(e) => setAudience(e.target.value)}
                      style={{ backgroundColor: '#f1f5f9', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '11px', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="All Campus">All Campus</option>
                      <option value="Students Only">Students Only</option>
                      <option value="Faculty Only">Faculty Only</option>
                    </select>
                  </div>
                </div>

                <input 
                  id="post-title"
                  name="title"
                  type="text" 
                  placeholder={postType === 'announcement' ? "Announcement Title..." : "Event Title..."} 
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9375rem', fontWeight: 700, outline: 'none', color: '#0f172a' }}
                  required
                />

                {postType === 'event' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div>
                      <label htmlFor="event-date" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>EVENT DATE</label>
                      <input id="event-date" name="event_date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', backgroundColor: '#ffffff' }} required />
                    </div>
                    <div>
                      <label htmlFor="event-location" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>LOCATION / VENUE</label>
                      <input id="event-location" name="location" type="text" placeholder="e.g. CCS Gym" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', backgroundColor: '#ffffff' }} />
                    </div>
                    <div>
                      <label htmlFor="event-capacity" style={{ fontSize: '10px', fontWeight: 700, color: '#881337', display: 'block', marginBottom: '2px' }}>CAPACITY</label>
                      <input id="event-capacity" name="capacity" type="number" placeholder="Max capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', backgroundColor: '#ffffff' }} />
                    </div>
                  </div>
                )}

                <textarea 
                  id="post-body"
                  name="content"
                  rows="4" 
                  placeholder="Write post description..." 
                  value={quickBody}
                  onChange={(e) => setQuickBody(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9375rem', resize: 'none', outline: 'none', color: '#1e293b', fontFamily: 'inherit', minHeight: '110px' }}
                  required
                ></textarea>

                {imagePreview && (
                  <div style={{ position: 'relative', width: '100%', maxHeight: '220px', overflow: 'hidden', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
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

                <input id="post-image-upload" name="image" type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#334155' }}>Add to your post</span>
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
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading department feed...</p>
        ) : announcements.length === 0 && events.length === 0 ? (
          <article className="card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '1rem' }}>
            <p style={{ color: '#475569', fontWeight: 600 }}>No Announcements or Events posted yet.</p>
          </article>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Render Announcements */}
            {announcements.map((item, index) => {
              const postId = `ann-${item.announcement_id || index}`;
              const isBookmarked = bookmarks[postId] || false;

              return (
                <article key={postId} style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {pageCode || 'SAO'}
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2 }}>{item.page_name || pageName}</h3>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                          {formatPostTime(item.created_at)}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                      <button 
                        onClick={() => handleBookmarkToggle(postId)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: isBookmarked ? '#0f172a' : '#94a3b8' }}
                      >
                        <i className={`${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark`} style={{ fontSize: '1.1rem' }}></i>
                      </button>

                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === postId ? null : postId)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#94a3b8' }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1.1rem' }}></i>
                      </button>

                      {activeMenuId === postId && (
                        <div style={{ position: 'absolute', right: 0, top: '2rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, width: '120px', overflow: 'hidden' }}>
                          <button 
                            onClick={() => handleStartEdit(item, 'announcement')} 
                            style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', fontSize: '0.8125rem', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <i className="fa-solid fa-pen" style={{ fontSize: '0.75rem' }}></i> Edit
                          </button>
                          <button 
                            onClick={() => handleDeletePost(item.announcement_id, 'announcement')} 
                            style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', fontSize: '0.8125rem', color: '#e11d48', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <i className="fa-solid fa-trash" style={{ fontSize: '0.75rem' }}></i> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h4 style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', margin: 0, lineHeight: 1.3 }}>{item.title}</h4>
                      {item.category_name && (
                        <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#881337', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.category_name}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#475569', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{item.content || item.description}</p>
                  </div>

                  {/* Image Attachment */}
                  {item.image_url && (
                    <div style={{ position: 'relative', width: '100%', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '1rem' }}>
                      <img src={item.image_url} alt="Post content" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '380px', objectFit: 'cover' }} />
                    </div>
                  )}

                  {/* Footer Action Links */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                      <i className="fa-regular fa-eye" style={{ fontSize: '0.9rem' }}></i>
                      <span>View Details</span>
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                      <i className="fa-solid fa-bullhorn" style={{ fontSize: '0.85rem' }}></i>
                      <span>Announcement</span>
                    </button>
                  </div>

                </article>
              );
            })}

            {/* Render Events */}
            {events.map((ev, index) => {
              const eventId = `ev-${ev.event_id || index}`;
              const isBookmarked = bookmarks[eventId] || false;

              return (
                <article key={eventId} style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {pageCode || 'SAO'}
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2 }}>{ev.page_name || pageName}</h3>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                          {formatPostTime(ev.created_at)}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                      <button 
                        onClick={() => handleBookmarkToggle(eventId)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: isBookmarked ? '#0f172a' : '#94a3b8' }}
                      >
                        <i className={`${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark`} style={{ fontSize: '1.1rem' }}></i>
                      </button>

                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === eventId ? null : eventId)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#94a3b8' }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1.1rem' }}></i>
                      </button>

                      {activeMenuId === eventId && (
                        <div style={{ position: 'absolute', right: 0, top: '2rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, width: '120px', overflow: 'hidden' }}>
                          <button 
                            onClick={() => handleStartEdit(ev, 'event')} 
                            style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', fontSize: '0.8125rem', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <i className="fa-solid fa-pen" style={{ fontSize: '0.75rem' }}></i> Edit
                          </button>
                          <button 
                            onClick={() => handleDeletePost(ev.event_id, 'event')} 
                            style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', fontSize: '0.8125rem', color: '#e11d48', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <i className="fa-solid fa-trash" style={{ fontSize: '0.75rem' }}></i> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', margin: '0 0 0.5rem 0', lineHeight: 1.3 }}>{ev.event_title || ev.title}</h4>
                    <p style={{ color: '#475569', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{ev.event_description || ev.description}</p>
                  </div>

                  {/* Image Attachment + Badge Overlay */}
                  <div style={{ position: 'relative', width: '100%', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '1rem' }}>
                    <img 
                      src={ev.image_url || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop"} 
                      alt="Event" 
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '380px', objectFit: 'cover' }} 
                    />
                    
                    <div style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', backdropFilter: 'blur(4px)' }}>
                      {ev.event_date ? `Event Date: ${new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Event Open'}
                    </div>
                  </div>

                  {/* Footer Action Links */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                      <i className="fa-regular fa-eye" style={{ fontSize: '0.9rem' }}></i>
                      <span>View Details</span>
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                      <i className="fa-solid fa-user-plus" style={{ fontSize: '0.85rem' }}></i>
                      <span>Register</span>
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