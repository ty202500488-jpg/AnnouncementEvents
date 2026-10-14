import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function MyEvents() {
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
      {/* ==================== CENTER MAIN CONTENT (MY EVENTS FEED) ==================== */}
      <main className="lg-col-6 space-y-6">
        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>My Registered Events</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Track your upcoming schedule and event registration statuses.</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setStatusFilter('all')} 
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: statusFilter === 'all' ? 'var(--brand-50)' : 'transparent', color: statusFilter === 'all' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
              >
                All
              </button>
              <button 
                onClick={() => setStatusFilter('upcoming')} 
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: statusFilter === 'upcoming' ? 'var(--brand-50)' : 'transparent', color: statusFilter === 'upcoming' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
              >
                Upcoming
              </button>
              <button 
                onClick={() => setStatusFilter('completed')} 
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: statusFilter === 'completed' ? 'var(--brand-50)' : 'transparent', color: statusFilter === 'completed' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
              >
                Completed
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading your events...</p>
          ) : filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)' }}>
              <i className="fa-solid fa-calendar-check" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: 'var(--slate-300)' }}></i>
              <p style={{ fontSize: '0.875rem' }}>You have not registered for any events yet.</p>
              <a href="/student/events" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--brand-600)', fontWeight: 700, textDecoration: 'none' }}>
                Browse Campus Events →
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((item) => {
                const isUpcoming = new Date(item.date) >= new Date();
                return (
                  <article key={item.id} className="card card-interactive" style={{ padding: '1.25rem', border: '1px solid var(--slate-100)' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', backgroundColor: isUpcoming ? 'var(--brand-50)' : 'var(--slate-100)', color: isUpcoming ? 'var(--brand-600)' : 'var(--slate-500)', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', border: '1px solid var(--slate-200)' }}>
                          <i className="fa-regular fa-calendar-check" style={{ fontSize: '0.875rem' }}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.9375rem' }}>{item.title}</h4>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '9999px', backgroundColor: isUpcoming ? '#ecfdf5' : '#f1f5f9', color: isUpcoming ? '#047857' : '#64748b' }}>
                              {isUpcoming ? 'Confirmed' : 'Ended'}
                            </span>
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '0.125rem' }}>
                            <i className="fa-solid fa-location-dot" style={{ marginRight: '0.25rem', color: 'var(--slate-400)' }}></i>
                            {item.location || 'University Campus'} • {item.date ? new Date(item.date).toLocaleDateString() : 'TBA'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 500 }}>
                        Organized by {item.department_name || 'University Office'}
                      </span>
                      {isUpcoming && (
                        <button 
                          onClick={() => handleCancelRegistration(item.id)}
                          style={{ background: 'transparent', border: 'none', color: '#e11d48', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}
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
        </div>
      </main>
    </DashboardLayout>
  );
}