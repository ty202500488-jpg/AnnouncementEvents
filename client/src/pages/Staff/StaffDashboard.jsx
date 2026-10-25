import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardContent = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/dashboard-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        const data = await response.json();
        if (response.ok) {
          // Tag each item with its type then merge + sort newest first
          const announcements = (data.announcements || []).map(a => ({ ...a, _type: 'Announcement' }));
          const events = (data.events || []).map(e => ({ ...e, _type: 'Event' }));
          const merged = [...announcements, ...events].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          setFeed(merged);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardContent();
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
      <main className="lg-col-6 no-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
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
                      Organized by <strong style={{ color: '#16162b' }}>{item.department_name || item.page_name || 'University Office'}</strong>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {item.is_registered && (
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
            const deptName = item.department_name || item.page_name || 'University Notice';
            const avatarText = item.code || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();

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
    </StaffDashboardLayout>
  );
}