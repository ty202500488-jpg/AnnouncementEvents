import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import { getHighlightedCardProps, useHighlightedPost } from '../../utils/notificationUtils';
import { formatPostTimestamp, formatScheduledDate } from '../../utils/dateUtils';
import '../styles/StudentDashboard.css';

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const highlightedPostId = useHighlightedPost(!loading && events.length > 0);
  const token = localStorage.getItem('token');

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
          setEvents(data.events);
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

  const filteredEvents = events.filter(item => !!item.is_followed);

  return (
    <DashboardLayout activePage="events">
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
            <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No events from followed pages yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((item, index) => {
              const deptName = item.department_name || 'University Office';
              const avatarText = deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
              const isFollowed = !!item.is_followed;
              const postDate = formatScheduledDate(item.event_date || item.date);
              const postedAt = item.created_at ? formatPostTimestamp(item.created_at) : null;
              const postImage = item.image_url || item.image || null;
              
              const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
              const maxCapacity = item.max_capacity || item.capacity || 'Unlimited';
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deptName}
                          </h4>
                          {item.page_id && (
                            <>
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFollow(item.page_id, isFollowed);
                                }}
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
                          <span><i className="fa-solid fa-users" style={{ color: '#94a3b8' }}></i> {currentRegistered} / {maxCapacity} registered</span>
                          <span>•</span>
                          <span><i className="fa-solid fa-location-dot" style={{ color: '#94a3b8' }}></i> {locationText}</span>
                          <span>•</span>
                          <span><i className="fa-regular fa-calendar" style={{ color: '#94a3b8' }}></i> {postDate}</span>
                          {postedAt && (
                            <>
                              <span>•</span>
                              <span><i className="fa-regular fa-clock" style={{ color: '#94a3b8' }}></i> Posted {postedAt}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>

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

                  {/* Optional Attendance Scan Bar if registered */}
                  {item.is_registered && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', margin: '0.75rem 1rem 0.25rem 1rem', paddingTop: '0.75rem', borderTop: '1px solid #e6ebf0' }}>
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
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}