import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function StudentDashboard() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardContent = async () => {
      try {
        const response = await fetch('http://localhost:5000/users/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
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

  return (
    <DashboardLayout activePage="home">
      {/* ==================== CENTER MAIN CONTENT (DYNAMIC FEED) ==================== */}
      <main className="lg-col-6 space-y-6">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : feed.length === 0 ? (
          <article className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No posts available yet.</p>
          </article>
        ) : (
          feed.map((item, index) => {
            const isEvent = item._type === 'Event';
            return (
              <article key={item.id || index} className="card card-interactive" style={{ padding: '1.5rem' }}>
                {/* Header: avatar + page name + date + type badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: '2.5rem', height: '2.5rem', borderRadius: '5.75rem',
                      backgroundColor: isEvent ? '#e0f2fe' : 'var(--amber-100)',
                      color: isEvent ? '#0369a1' : 'var(--amber-700)',
                      fontWeight: 700, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.75rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {item.department_code || 'WMSU'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>
                          {item.department_name || item.page_name || 'University Notice'}
                        </h3>
                        {/* Type badge */}
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          padding: '0.1rem 0.45rem', borderRadius: '9999px',
                          backgroundColor: isEvent ? '#e0f2fe' : 'var(--rose-50)',
                          color: isEvent ? '#0369a1' : 'var(--color-accent, #7B0D1E)'
                        }}>
                          {isEvent ? 'Event' : 'Announcement'}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem', lineHeight: 1.375 }}>
                    {item.title}
                  </h4>
                  <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.5rem', lineHeight: 1.625 }}>
                    {item.content || item.description}
                  </p>

                  {/* Extra event details */}
                  {isEvent && (item.event_date || item.location) && (
                    <div style={{
                      marginTop: '0.75rem', display: 'flex', gap: '1rem',
                      flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--slate-500)'
                    }}>
                      {item.event_date && (
                        <span>
                          <i className="fa-regular fa-calendar" style={{ marginRight: '0.3rem' }}></i>
                          {new Date(item.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {item.location && (
                        <span>
                          <i className="fa-solid fa-location-dot" style={{ marginRight: '0.3rem' }}></i>
                          {item.location}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>
    </DashboardLayout>
  );
}
