import { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/MyPageDashboard.css';

export default function MyPageAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/dashboard-data', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok && data.announcements) {
          setAnnouncements(data.announcements);
        }
      } catch (err) {
        console.error('Failed to fetch page announcements:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const filteredAnnouncements = announcements.filter(item => {
    if (filter === 'university') return item.is_university;
    if (filter === 'department') return !item.is_university;
    return true;
  });

  return (
    <MyPageDashboardLayout activeTab="announcements">
      <main className="lg-col-6 space-y-6">
        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem' }}>Campus Announcements</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Review department updates and campus announcements.</p>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setFilter('all')} 
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: filter === 'all' ? '#fff1f2' : 'transparent',
                  color: filter === 'all' ? '#881337' : 'var(--slate-600)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button 
                type="button"
                onClick={() => setFilter('department')} 
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: filter === 'department' ? '#fff1f2' : 'transparent',
                  color: filter === 'department' ? '#881337' : 'var(--slate-600)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Department
              </button>
              <button 
                type="button"
                onClick={() => setFilter('university')} 
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: filter === 'university' ? '#fff1f2' : 'transparent',
                  color: filter === 'university' ? '#881337' : 'var(--slate-600)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                University
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading announcements...</p>
          ) : filteredAnnouncements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)' }}>
              <i className="fa-solid fa-bullhorn" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--slate-300)' }}></i>
              <p style={{ fontSize: '0.875rem' }}>No announcements found for this filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAnnouncements.map((item, index) => (
                <article key={item.id || index} className="card card-interactive" style={{ padding: '1.25rem', border: '1px solid var(--slate-100)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: '2.25rem',
                        height: '2.25rem',
                        borderRadius: '50%',
                        backgroundColor: '#fff1f2',
                        color: '#881337',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        border: '1px solid #fecdd3'
                      }}>
                        {item.department_code || 'CCS'}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>
                          {item.department_name || 'College of Computing Studies'}
                        </h4>
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
    </MyPageDashboardLayout>
  );
}