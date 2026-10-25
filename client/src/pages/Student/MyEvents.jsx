import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function MyEvents() {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

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
                    backgroundColor: isActive ? 'var(--brand-600, #2563eb)' : 'transparent',
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
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--brand-600)' }}></i>
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
                color: 'var(--brand-600)', 
                fontWeight: 600, 
                textDecoration: 'none',
                padding: '0.4rem 0.875rem',
                borderRadius: '0.375rem',
                backgroundColor: 'var(--brand-50, #eff6ff)',
                border: '1px solid var(--brand-100, #dbeafe)'
              }}
            >
              Browse Campus Events <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((item) => {
              const isUpcoming = new Date(item.date) >= new Date();
              return (
                <article 
                  key={item.id} 
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
                        backgroundColor: isUpcoming ? '#fdf0f3' : '#f1f5f9', 
                        color: isUpcoming ? '#8c1030' : '#64748b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0 
                      }}
                    >
                      <i className="fa-regular fa-calendar-check" style={{ fontSize: '1.35rem' }}></i>
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '1.125rem', lineHeight: 1.3, margin: 0 }}>
                          {item.title}
                        </h4>
                        <span 
                          style={{ 
                            fontSize: '0.6875rem', 
                            fontWeight: 600, 
                            padding: '0.125rem 0.5rem', 
                            borderRadius: '9999px', 
                            backgroundColor: isUpcoming ? '#e6f7ef' : '#f1f5f9', 
                            color: isUpcoming ? '#0f8a5f' : '#475569',
                            border: `1px solid ${isUpcoming ? '#a7e3c8' : '#e2e8f0'}`
                          }}
                        >
                          {isUpcoming ? 'Confirmed' : 'Ended'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <i className="fa-solid fa-location-dot" style={{ color: '#94a3b8' }}></i>
                          <span>{item.location || 'University Campus'}</span>
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <i className="fa-regular fa-clock" style={{ color: '#94a3b8' }}></i>
                          <span>{item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <p style={{ color: '#475569', fontSize: '0.9375rem', marginTop: '1.25rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    {item.description}
                  </p>

                  {/* Footer: Organized by + Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #e6ebf0', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>
                      Organized by <strong style={{ color: '#16162b' }}>{item.department_name || 'University Office'}</strong>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

                      {isUpcoming && (
                        <button 
                          onClick={() => handleCancelRegistration(item.id)}
                          style={{ 
                            background: 'transparent', 
                            border: '1px solid #fecdd3', 
                            color: '#e11d48', 
                            fontSize: '0.875rem', 
                            fontWeight: 600, 
                            cursor: 'pointer', 
                            padding: '0.55rem 1rem', 
                            borderRadius: '0.625rem',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          Cancel Registration
                        </button>
                      )}
                    </div>
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