import { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';

export default function StaffEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [followedDepts, setFollowedDepts] = useState({});

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/dashboard-data', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok && data.events) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const toggleFollow = (deptKey) => {
    setFollowedDepts(prev => ({
      ...prev,
      [deptKey]: !prev[deptKey]
    }));
  };

  const filteredEvents = events.filter(item => {
    if (filter === 'upcoming') return new Date(item.date) >= new Date();
    if (filter === 'registered') return item.is_registered;
    return true;
  });

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
            <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.0625rem' }}>Campus Events & Activities</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Monitor department events and university schedules.</p>
          </div>
          
          <div className="flex items-center gap-1" style={{ backgroundColor: '#ffffff', padding: '0.2rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            {['all', 'registered'].map((type) => {
              const isActive = filter === type;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
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
            <p style={{ fontSize: '0.875rem' }}>Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No events found for this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((item, index) => {
              const deptName = item.department_name || item.page_name || 'University Office';
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
                  key={item.id || index} 
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
                        <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {deptName}
                        </h4>
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
                </article>
              );
            })}
          </div>
        )}
      </main>
    </StaffDashboardLayout>
  );
}