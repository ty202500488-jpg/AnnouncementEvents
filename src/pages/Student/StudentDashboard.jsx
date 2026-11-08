import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followedDepts, setFollowedDepts] = useState({});

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

  const toggleFollow = (deptKey) => {
    setFollowedDepts(prev => ({
      ...prev,
      [deptKey]: !prev[deptKey]
    }));
  };

  return (
    <DashboardLayout activePage="home">
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
      <main 
        className="lg-col-6 no-scrollbar" 
        style={{ 
          overflowY: 'auto', 
          maxHeight: '100%',
          minHeight: 0, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem', 
          paddingBottom: '2rem' 
        }}
      >
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : feed.length === 0 ? (
          <article className="card" style={{ padding: '1.75rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No posts available yet.</p>
          </article>
        ) : (
          feed.map((item, index) => {
            const isEvent = item._type === 'Event';
            const deptName = item.department_name || item.page_name || 'University Notice';
            const avatarText = item.code || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
            
            // Unique identifier for follow state per department/page
            const deptKey = item.department_id || item.page_id || deptName;
            const isFollowed = !!followedDepts[deptKey];
            
            // Format Timestamp / Date
            const postDate = item.created_at || item.date ? new Date(item.created_at || item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
            const postImage = item.image_url || item.image || null;

            // Event-specific details
            const currentRegistered = item.registered_count ?? item.current_registered ?? 0;
            const maxCapacity = item.max_capacity || item.capacity || 'Unlimited';
            const locationText = item.location || 'University Campus';

            return (
              <article 
                key={item.id || index} 
                className="card card-interactive" 
                style={{ 
                  padding: '1rem 0', 
                  borderRadius: '1.25rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {/* 1. POST HEADER */}
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
                      <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {deptName}
                      </h4>
                      <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {isEvent ? (
                          <>
                            <span><i className="fa-solid fa-users" style={{ color: '#94a3b8' }}></i> {currentRegistered} / {maxCapacity} registered</span>
                            <span>•</span>
                            <span><i className="fa-solid fa-location-dot" style={{ color: '#94a3b8' }}></i> {locationText}</span>
                            <span>•</span>
                            <span><i className="fa-regular fa-clock" style={{ color: '#94a3b8' }}></i> {postDate}</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-regular fa-clock" style={{ fontSize: '0.75rem', color: '#94a3b8' }}></i>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Announcement • {postDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    {!isFollowed && (
                      <button 
                        onClick={() => toggleFollow(deptKey)}
                        style={{
                          backgroundColor: '#8c1030',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          padding: '0.4rem 1rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'opacity 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
                      >
                        Follow
                      </button>
                    )}

                    {isFollowed && (
                      <button 
                        onClick={() => toggleFollow(deptKey)}
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.5rem',
                          padding: '0.4rem 1rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        title="Click to unfollow"
                      >
                        Following ✓
                      </button>
                    )}

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

                {/* 2. POST MEDIA / CONTENT CONTAINER */}
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
                      {item.content || item.description}
                    </p>
                  </div>
                )}

                {/* Caption / Title for Image Posts */}
                {postImage && (
                  <div style={{ padding: '0.875rem 1rem 0.5rem 1rem' }}>
                    <h3 style={{ fontWeight: 800, color: '#16162b', fontSize: '1.0625rem', margin: 0 }}>
                      {item.title}
                    </h3>
                    <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.5, margin: '0.4rem 0 0 0' }}>
                      {item.content || item.description}
                    </p>
                  </div>
                )}

                {/* 3. OPTIONAL ATTENDANCE SCAN BAR FOR REGISTERED EVENTS */}
                {isEvent && item.is_registered && (
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
          })
        )}
      </main>
    </DashboardLayout>
  );
}