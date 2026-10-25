import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('http://localhost:5000/users/events-data', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
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
        setEvents(prev =>
          prev.map(ev => ev.id === eventId ? { ...ev, is_registered: true } : ev)
        );
      }
    } catch (err) {
      console.error('Failed to register for event', err);
    }
  };

  const filteredEvents = events.filter(item => {
    if (filter === 'upcoming') return new Date(item.date) >= new Date();
    if (filter === 'registered') return item.is_registered;
    return true;
  });

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
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Explore upcoming university events, register, and scan attendance QR codes.</p>
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
            <p style={{ fontSize: '0.875rem' }}>Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No events found for this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((item, index) => (
              <article 
                key={item.id || index} 
                className="card card-interactive" 
                style={{ 
                  padding: '1.125rem', 
                  borderRadius: '0.625rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      style={{ 
                        width: '2.5rem', 
                        height: '2.5rem', 
                        borderRadius: '0.5rem', 
                        backgroundColor: 'var(--brand-50, #eff6ff)', 
                        color: 'var(--brand-600, #2563eb)', 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        border: '1px solid var(--brand-100, #dbeafe)' 
                      }}
                    >
                      <i className="fa-regular fa-calendar" style={{ fontSize: '1rem' }}></i>
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.9375rem' }}>{item.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <i className="fa-solid fa-location-dot" style={{ color: 'var(--slate-400)' }}></i>
                        <span>{item.location || 'University Campus'}</span>
                        <span>•</span>
                        <i className="fa-regular fa-clock" style={{ color: 'var(--slate-400)' }}></i>
                        <span>{item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
                  {item.description}
                </p>

                <div className="flex items-center justify-between" style={{ marginTop: '0.875rem', paddingTop: '0.625rem', borderTop: '1px solid var(--slate-100)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                    Organized by <strong style={{ color: 'var(--slate-700)' }}>{item.department_name || 'University Office'}</strong>
                  </span>

                  <div className="flex items-center gap-2">
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
                          backgroundColor: 'var(--brand-600, #2563eb)', 
                          color: '#ffffff', 
                          border: 'none', 
                          padding: '0.375rem 0.75rem', 
                          borderRadius: '0.375rem', 
                          fontSize: '0.75rem', 
                          fontWeight: 600, 
                          cursor: 'pointer', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.375rem',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        <i className="fa-solid fa-qrcode"></i> Scan Attendance
                      </button>
                    )}

                    <button 
                      onClick={() => !item.is_registered && handleRegister(item.id)}
                      disabled={item.is_registered}
                      style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: item.is_registered ? 'default' : 'pointer',
                        backgroundColor: item.is_registered ? 'var(--emerald-50, #ecfdf5)' : 'var(--brand-600, #2563eb)',
                        color: item.is_registered ? 'var(--emerald-700, #047857)' : '#ffffff',
                        border: `1px solid ${item.is_registered ? 'var(--emerald-200, #a7f3d0)' : 'transparent'}`,
                        boxShadow: item.is_registered ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.is_registered ? 'Registered ✓' : 'Register Now'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}