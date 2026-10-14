import { useState, useEffect } from 'react';
import StaffDashboardLayout from '../../assets/components/StaffDashboardLayout';
import '../styles/StaffDashboard.css';

export default function StaffEvents() {
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
      const staffId = parsedUser.id || parsedUser.staff_id;

      const response = await fetch(`http://localhost:5000/users/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId })
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
    <StaffDashboardLayout activePage="events">
      <main className="lg-col-6 space-y-6">
        <div className="card" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Staff Events & Activities</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Monitor department events and university schedules.</p>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setFilter('all')} 
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: filter === 'all' ? 'var(--brand-50)' : 'transparent', color: filter === 'all' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('registered')} 
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: filter === 'registered' ? 'var(--brand-50)' : 'transparent', color: filter === 'registered' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
              >
                Registered
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading events...</p>
          ) : filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)' }}>
              <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--slate-300)' }}></i>
              <p style={{ fontSize: '0.875rem' }}>No events found for this filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((item, index) => (
                <article key={item.id || index} className="card card-interactive" style={{ padding: '1.25rem', border: '1px solid var(--slate-100)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', backgroundColor: 'var(--brand-50)', color: 'var(--brand-600)', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', border: '1px solid var(--brand-100)' }}>
                        <i className="fa-regular fa-calendar" style={{ fontSize: '0.875rem', marginBottom: '1px' }}></i>
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.9375rem' }}>{item.title}</h4>
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
                    <button 
                      onClick={() => !item.is_registered && handleRegister(item.id)}
                      disabled={item.is_registered}
                      className={item.is_registered ? '' : 'save-profile-btn'}
                      style={item.is_registered ? { backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #d1fae5', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'default' } : { padding: '0.375rem 0.875rem', fontSize: '0.75rem' }}
                    >
                      {item.is_registered ? 'Registered ✓' : 'Register Now'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </StaffDashboardLayout>
  );
}