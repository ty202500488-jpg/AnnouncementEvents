import React, { useState, useEffect, useRef } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/StaffDashboard.css';
import '../../styles/Profile.css';
import '../../styles/Settings.css';
import '../../styles/MyPageDashboard.css';

export default function MyPageDashboard({ onSwitchToStaffDashboard }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [feed, setFeed] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

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
        const announcements = (data.announcements || []).map(a => ({ ...a, _type: 'Announcement' }));
        const events = (data.events || []).map(e => ({ ...e, _type: 'Event' }));
        const merged = [...announcements, ...events].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setFeed(merged);
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

  const handleRegister = async (eventId) => {
    try {
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : {};
      const studentId = parsedUser.id || parsedUser.student_id;

      const response = await fetch(`http://localhost:5000/users/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
      });
      
      if (response.ok) {
        setFeed(prev =>
          prev.map(item => item._type === 'Event' && item.id === eventId ? { ...item, is_registered: true } : item)
        );
      }
    } catch (err) {
      console.error('Failed to register for event', err);
    }
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
          ? `http://localhost:5000/api/events/${editingPost.event_id || editingPost.id}` 
          : `http://localhost:5000/api/announcements/${editingPost.announcement_id || editingPost.id}`;

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
          fetchPageAndFeedData();
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
          fetchPageAndFeedData();
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
          fetchPageAndFeedData();
        }
      }

      resetForm();
    } catch (err) {
      console.error('Failed to publish post:', err);
      alert('Network error while publishing post.');
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

      <main className="lg-col-6 no-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
        
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
              className="no-scrollbar"
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '540px',
                borderRadius: '1rem',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
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

        {/* Dynamic Feed Content */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : feed.length === 0 ? (
          <article className="card" style={{ padding: '1.75rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No posts available yet.</p>
          </article>
        ) : (
          feed.map((item, index) => {
            const isEvent = item._type === 'Event';

            if (isEvent) {
              return (
                <article 
                  key={item.id || index} 
                  className="card card-interactive" 
                  style={{ 
                    padding: '1.5rem', 
                    borderRadius: '1.25rem',
                    border: '1px solid var(--slate-200, #e2e8f0)',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                >
                  {/* Header: Icon + Title & Location/Date Meta */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div 
                      style={{ 
                        width: '3.25rem', 
                        height: '3.25rem', 
                        borderRadius: '0.875rem', 
                        backgroundColor: '#fdf0f3', 
                        color: '#8c1030', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0 
                      }}
                    >
                      <i className="fa-regular fa-calendar" style={{ fontSize: '1.35rem' }}></i>
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.3, margin: 0 }}>
                        {item.title}
                      </h4>
                      
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <i className="fa-solid fa-location-dot" style={{ color: '#94a3b8' }}></i>
                          <span>{item.location || 'University Campus'}</span>
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <i className="fa-regular fa-clock" style={{ color: '#94a3b8' }}></i>
                          <span>{item.event_date || item.date ? new Date(item.event_date || item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <p style={{ color: '#475569', fontSize: '0.9375rem', marginTop: '1.25rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    {item.content || item.description}
                  </p>

                  {/* Footer: Organized by + Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #e6ebf0', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>
                      Organized by <strong style={{ color: '#16162b' }}>{item.department_name || item.page_name || pageName}</strong>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {item.is_registered && (
                        <button
                          onClick={() => {
                            const token = prompt("Scan or enter event QR token:");
                            if (token) {
                              const clean = token.trim().split('/').pop();
                              window.location.href = `/student/attendance/check-in/${clean}`;
                            }
                          }}
                          style={{ 
                            backgroundColor: '#ffffff', 
                            color: '#475569', 
                            border: '1px solid #e6ebf0', 
                            padding: '0.55rem 1.125rem', 
                            borderRadius: '0.625rem', 
                            fontSize: '0.875rem', 
                            fontWeight: 600, 
                            cursor: 'pointer', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.5rem'
                          }}
                        >
                          <i className="fa-solid fa-qrcode"></i> Scan Attendance
                        </button>
                      )}

                      <button 
                        onClick={() => !item.is_registered && handleRegister(item.id)}
                        disabled={item.is_registered}
                        style={{
                          padding: '0.55rem 1.25rem',
                          borderRadius: '0.625rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: item.is_registered ? 'default' : 'pointer',
                          backgroundColor: item.is_registered ? '#e6f7ef' : '#8c1030',
                          color: item.is_registered ? '#0f8a5f' : '#ffffff',
                          border: `1px solid ${item.is_registered ? '#a7e3c8' : 'transparent'}`,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {item.is_registered ? 'Registered ✓' : 'Register Now'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            // Standard Announcement Layout (Matching design with Profile Avatar)
            const deptName = item.department_name || item.page_name || pageName;
            const avatarText = item.code || pageCode || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();

            return (
              <article 
                key={item.id || index} 
                className="card card-interactive" 
                style={{ 
                  padding: '1.5rem', 
                  borderRadius: '1.25rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Header: Department Avatar + Name & Creation Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
                  <div 
                    style={{ 
                      width: '3.25rem', 
                      height: '3.25rem', 
                      borderRadius: '50%', 
                      backgroundColor: '#fbe4e8', 
                      color: '#8c1030', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 800, 
                      fontSize: '0.875rem',
                      flexShrink: 0
                    }}
                  >
                    {avatarText}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '1.0625rem', margin: 0, lineHeight: 1.3 }}>
                      {deptName}
                    </h4>
                    <div style={{ fontSize: '0.875rem', color: '#8a97a6', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <i className="fa-regular fa-clock" style={{ fontSize: '0.8125rem', color: '#94a3b8' }}></i>
                      <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div>
                  <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.35, margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                    {item.title}
                  </h3>
                  <p style={{ color: '#475569', fontSize: '0.9375rem', marginTop: '0.75rem', lineHeight: 1.6, margin: '0.75rem 0 0 0' }}>
                    {item.content || item.description}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </main>
    </MyPageDashboardLayout>
  );
}