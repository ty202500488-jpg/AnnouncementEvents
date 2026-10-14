import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await fetch('http://localhost:5000/users/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (response.ok && data.announcements) {
          setAnnouncements(data.announcements);
        }
      } catch (err) {
        console.error('Failed to fetch announcements:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const filteredAnnouncements = announcements.filter(item => {
    if (filter === 'university') return item.is_university;
    if (filter === 'followed') return !item.is_university;
    return true;
  });

  return (
    <DashboardLayout activePage="announcements">
      {/* ==================== CENTER MAIN CONTENT (ANNOUNCEMENTS FEED) ==================== */}
      <main className="lg-col-6 space-y-6">
        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Campus Announcements</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Official updates from university offices and followed departments.</p>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setFilter('all')} 
                className={`action-btn ${filter === 'all' ? 'active-filter' : ''}`}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: filter === 'all' ? 'var(--brand-50)' : 'transparent', color: filter === 'all' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem' }}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('university')} 
                className={`action-btn ${filter === 'university' ? 'active-filter' : ''}`}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: filter === 'university' ? 'var(--brand-50)' : 'transparent', color: filter === 'university' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem' }}
              >
                University
              </button>
              <button 
                onClick={() => setFilter('followed')} 
                className={`action-btn ${filter === 'followed' ? 'active-filter' : ''}`}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', backgroundColor: filter === 'followed' ? 'var(--brand-50)' : 'transparent', color: filter === 'followed' ? 'var(--brand-600)' : 'var(--slate-600)', fontWeight: 600, fontSize: '0.75rem' }}
              >
                Followed
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading announcements...</p>
          ) : filteredAnnouncements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)' }}>
              <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--slate-300)' }}></i>
              <p style={{ fontSize: '0.875rem' }}>No announcements available for this filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAnnouncements.map((item, index) => (
                <article key={item.id || index} className="card card-interactive" style={{ padding: '1.25rem', border: '1px solid var(--slate-100)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        WMSU
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>{item.department_name || 'University Notice'}</h4>
                        <p style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.875rem' }}>
                    <h5 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.9375rem', lineHeight: 1.375 }}>
                      {item.title}
                    </h5>
                    <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.375rem', lineHeight: 1.5 }}>
                      {item.content}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}