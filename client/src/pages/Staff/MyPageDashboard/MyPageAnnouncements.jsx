import { useState, useEffect } from 'react';
import MyPageDashboardLayout from '../../../assets/components/MyPageDashboardLayout';
import '../../styles/MyPageDashboard.css';

export default function MyPageAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // Step 1: get this staff member's page ID
        const statusRes = await fetch('http://localhost:5000/api/my-page-status', { headers });
        if (!statusRes.ok) {
          setError('Could not load page status.');
          return;
        }
        const statusData = await statusRes.json();
        if (!statusData.exists || !statusData.pageId) {
          // No page yet — show empty state
          setAnnouncements([]);
          return;
        }

        // Step 2: fetch only this page's announcements
        const res = await fetch(
          `http://localhost:5000/api/mypage/posts?pageId=${statusData.pageId}`,
          { headers }
        );
        if (!res.ok) {
          setError('Failed to load announcements.');
          return;
        }
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      } catch (err) {
        console.error('Failed to fetch page announcements:', err);
        setError('Unable to reach the server.');
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
      <main 
        className="lg-col-6 hide-scrollbar" 
        style={{ 
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
            <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1.0625rem' }}>Campus Announcements</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>Review department updates and campus announcements.</p>
          </div>
          
          <div className="flex items-center gap-1" style={{ backgroundColor: '#ffffff', padding: '0.2rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            {['all', 'university'].map((type) => {
              const isActive = filter === type;
              return (
                <button
                  key={type}
                  type="button"
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
            <p style={{ fontSize: '0.875rem' }}>Loading announcements...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#991b1b', background: '#fef2f2', borderRadius: '0.625rem', border: '1px solid #fecdd3' }}>
            {error}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-500)', backgroundColor: '#ffffff', borderRadius: '0.625rem', border: '1px solid var(--slate-200)' }}>
            <i className="fa-solid fa-bullhorn" style={{ fontSize: '2.25rem', marginBottom: '0.625rem', color: 'var(--slate-300)' }}></i>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No announcements available for this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredAnnouncements.map((item, index) => (
              <article 
                key={item.announcement_id || item.id || index} 
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
                        width: '2.25rem', 
                        height: '2.25rem', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--brand-50, #eff6ff)', 
                        color: 'var(--brand-600, #2563eb)', 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '0.75rem',
                        border: '1px solid var(--brand-100, #dbeafe)'
                      }}
                    >
                      {item.department_code || item.page_name?.slice(0, 3).toUpperCase() || 'PG'}
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>
                        {item.page_name || item.department_name || 'My Page'}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.125rem' }}>
                        <i className="fa-regular fa-clock" style={{ marginRight: '0.25rem' }}></i>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <h5 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.9375rem', lineHeight: 1.375 }}>
                    {item.title}
                  </h5>
                  <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
                    {item.content || item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </MyPageDashboardLayout>
  );
}