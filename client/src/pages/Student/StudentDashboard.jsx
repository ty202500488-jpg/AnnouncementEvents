import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState('all'); // 'all' | 'following'
  const [togglingPageId, setTogglingPageId] = useState(null);

  const token = localStorage.getItem('token');

  const fetchDashboardContent = async () => {
    try {
      const response = await fetch('http://localhost:5000/users/dashboard-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await response.json();
      if (response.ok) {
        // Tag each item with its type then merge + sort followed & pinned first
        const announcements = (data.announcements || []).map(a => ({ ...a, _type: 'Announcement' }));
        const events = (data.events || []).map(e => ({ ...e, _type: 'Event' }));
        const merged = [...announcements, ...events].sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          const aFollowed = a.is_followed ? 1 : 0;
          const bFollowed = b.is_followed ? 1 : 0;
          if (aFollowed !== bFollowed) return bFollowed - aFollowed;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setFeed(merged);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardContent();
  }, []);

  const handleToggleFollow = async (pageId, currentFollowState) => {
    if (!pageId) return;
    if (!token) {
      navigate('/auth');
      return;
    }

    setTogglingPageId(pageId);
    const method = currentFollowState ? 'DELETE' : 'POST';
    const endpoint = `http://localhost:5000/api/pages/${pageId}/follow`;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Update follow state across all feed items belonging to this page
        setFeed(prev => prev.map(item => {
          if (item.page_id === pageId) {
            return { ...item, is_followed: !currentFollowState };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error('Error toggling follow from feed:', err);
    } finally {
      setTogglingPageId(null);
    }
  };

  const displayedFeed = feed.filter(item => {
    if (feedFilter === 'following') return !!item.is_followed;
    return true;
  });

  const followingCount = feed.filter(item => item.is_followed).length;

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
        {/* FEED FILTER TABS (ALL FEED VS FOLLOWING) */}
        <div 
          style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            background: '#ffffff', 
            padding: '0.45rem', 
            borderRadius: '0.85rem', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
          }}
        >
          <button 
            type="button"
            onClick={() => setFeedFilter('all')}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: feedFilter === 'all' ? 700 : 500,
              backgroundColor: feedFilter === 'all' ? '#7B0D1E' : 'transparent',
              color: feedFilter === 'all' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-layer-group"></i>
            <span>All Posts</span>
            <span 
              style={{ 
                fontSize: '0.7rem', 
                padding: '0.1rem 0.45rem', 
                borderRadius: '9999px', 
                background: feedFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#e2e8f0', 
                color: feedFilter === 'all' ? '#ffffff' : '#475569' 
              }}
            >
              {feed.length}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setFeedFilter('following')}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: feedFilter === 'following' ? 700 : 500,
              backgroundColor: feedFilter === 'following' ? '#7B0D1E' : 'transparent',
              color: feedFilter === 'following' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-heart"></i>
            <span>Following Feed</span>
            <span 
              style={{ 
                fontSize: '0.7rem', 
                padding: '0.1rem 0.45rem', 
                borderRadius: '9999px', 
                background: feedFilter === 'following' ? 'rgba(255,255,255,0.25)' : '#e2e8f0', 
                color: feedFilter === 'following' ? '#ffffff' : '#475569' 
              }}
            >
              {followingCount}
            </span>
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
            Loading campus feed...
          </p>
        ) : displayedFeed.length === 0 ? (
          <article className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
            <i className="fa-regular fa-compass" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.75rem' }}></i>
            <h4 style={{ margin: '0 0 0.4rem 0', color: '#0f172a', fontSize: '1rem' }}>
              {feedFilter === 'following' ? 'No posts from followed pages yet' : 'No posts available yet'}
            </h4>
            <p style={{ color: 'var(--slate-600)', fontSize: '0.85rem', margin: 0 }}>
              {feedFilter === 'following' 
                ? 'Follow official department pages in the sidebar to have their announcements appear here.' 
                : 'Campus notices and events will appear here once published.'}
            </p>
          </article>
        ) : (
          displayedFeed.map((item, index) => {
            const isEvent = item._type === 'Event';
            const deptName = item.department_name || item.page_name || 'University Notice';
            const avatarText = item.code || deptName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
            const isFollowed = !!item.is_followed;
            const pageId = item.page_id;

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
                  border: isFollowed ? '1px solid #fecdd3' : '1px solid var(--slate-200, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {/* 1. POST HEADER (CLICKABLE TO OPEN FACEBOOK PAGE VIEW) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem 0.875rem 1rem' }}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1, cursor: pageId ? 'pointer' : 'default' }}
                    onClick={() => pageId && navigate(`/student/page/${pageId}`)}
                    title={pageId ? `View ${deptName} Facebook page` : ''}
                  >
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
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}
                    >
                      {item.page_avatar_url ? (
                        <img src={item.page_avatar_url} alt={deptName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        avatarText
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontWeight: 700, color: '#16162b', fontSize: '0.9375rem', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {deptName}
                        </h4>
                        {isFollowed && (
                          <span style={{ backgroundColor: '#fbe4e8', color: '#7B0D1E', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            Following
                          </span>
                        )}
                      </div>

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

                  {/* FOLLOW BUTTON ON RIGHT */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {pageId && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollow(pageId, isFollowed);
                        }}
                        disabled={togglingPageId === pageId}
                        style={{
                          backgroundColor: isFollowed ? '#f1f5f9' : '#7B0D1E',
                          color: isFollowed ? '#475569' : '#ffffff',
                          border: isFollowed ? '1px solid #cbd5e1' : 'none',
                          borderRadius: '0.5rem',
                          padding: '0.35rem 0.85rem',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.2s ease'
                        }}
                        title={isFollowed ? 'Click to unfollow page' : 'Click to follow page'}
                      >
                        {togglingPageId === pageId ? (
                          <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : isFollowed ? (
                          <>
                            <i className="fa-solid fa-check" style={{ color: '#059669' }}></i>
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-plus"></i>
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => pageId && navigate(`/student/page/${pageId}`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="View Page"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.85rem' }}></i>
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
                        const scanToken = prompt("Scan or enter event QR token:");
                        if (scanToken) {
                          const clean = scanToken.trim().split('/').pop();
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
