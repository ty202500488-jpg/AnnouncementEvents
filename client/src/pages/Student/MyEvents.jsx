import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function MyEvents() {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [followedDepts, setFollowedDepts] = useState({});

  useEffect(() => {
    const fetchMyEvents = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        const studentId = parsedUser.id || parsedUser.student_id;

        const response = await fetch(`http://localhost:5000/users/my-events?student_id=${studentId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
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

  const toggleFollow = (deptKey) => {
    setFollowedDepts(prev => ({
      ...prev,
      [deptKey]: !prev[deptKey]
    }));
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

        {/* Compact Title & Filter Header */}
        <div 
          className="flex items-center justify-between" 
          style={{ 
            marginBottom: '1.25rem', 
            paddingBottom: '0.625rem', 
            borderBottom: '1px solid var(--slate-200, #e2e8f0)' 
          }}
        >
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.0625rem' }}>My Registered Events</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>
              Track your upcoming schedule, event registration statuses, and scan attendance QR codes.
            </p>
          </div>

          <div className="flex items-center gap-1" style={{ backgroundColor: '#ffffff', padding: '0.2rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            {['all', 'completed'].map((type) => {
              const isActive = statusFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setStatusFilter(type)}
                  style={{
                    padding: '0.3rem 0.625rem',
                    borderRadius: '0.375rem',
                    backgroundColor: isActive ? '#8c1030' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--slate-600)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

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
              const deptKey = item.department_id || deptName;
              const isFollowed = !!followedDepts[deptKey];
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
                          backgroundColor: '#fbe4e8', 
                          color: '#8c1030', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 800, 
                          fontSize: '0.8rem',
                          flexShrink: 0
                        }}
                      >
                        {avatarText}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deptName}
                          </h4>
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
                          <span><i className="fa-solid fa-users" style={{ color: '#94a3b8' }}></i> {currentRegistered} / {maxCapacity} registered</span>
                          <span>•</span>
                          <span><i className="fa-solid fa-location-dot" style={{ color: '#94a3b8' }}></i> {locationText}</span>
                          <span>•</span>
                          <span><i className="fa-regular fa-clock" style={{ color: '#94a3b8' }}></i> {postDate}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      {!isFollowed && (
                        <button 
                          onClick={() => toggleFollow(deptKey)}
                          style={{
                            backgroundColor: '#8c1030',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 1rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                          onMouseLeave={(e) => e.target.style.opacity = '1'}
                        >
                          Follow
                        </button>
                      )}

                      {isFollowed && (
                        <button 
                          onClick={() => toggleFollow(deptKey)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 1rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title="Click to unfollow"
                        >
                          Following ✓
                        </button>
                      )}

                      <button 
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#16162b',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="More options"
                      >
                        <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1rem' }}></i>
                      </button>
                    </div>
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

                  {/* Inline Action Bar (Scan / Cancel Registration) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', margin: '0.75rem 1rem 0.25rem 1rem', paddingTop: '0.75rem', borderTop: '1px solid #e6ebf0', gap: '0.75rem' }}>
                    {isUpcoming && (
                      <button
                        onClick={() => {
                          const token = prompt("Scan or enter event QR token:");
                          if (token) {
                            const clean = token.trim().split('/').pop();
                            navigate(`/student/attendance/check-in/${clean}`);
                          }
                        }}
                        style={{ 
                          backgroundColor: '#ffffff', 
                          color: '#475569', 
                          border: '1px solid #e2e8f0', 
                          padding: '0.4rem 0.875rem', 
                          borderRadius: '0.5rem', 
                          fontSize: '0.8125rem', 
                          fontWeight: 600, 
                          cursor: 'pointer', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.4rem'
                        }}
                      >
                        <i className="fa-solid fa-qrcode"></i> Scan Attendance
                      </button>
                    )}

                    {isUpcoming && (
                      <button 
                        onClick={() => handleCancelRegistration(item.id)}
                        style={{ 
                          background: 'transparent', 
                          border: '1px solid #fecdd3', 
                          color: '#e11d48', 
                          fontSize: '0.8125rem', 
                          fontWeight: 600, 
                          cursor: 'pointer', 
                          padding: '0.4rem 0.875rem', 
                          borderRadius: '0.5rem',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        Cancel Registration
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}