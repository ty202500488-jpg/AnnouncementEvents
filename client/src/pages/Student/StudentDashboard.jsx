import { useState, useEffect } from 'react';
import DashboardLayout from '../../assets/components/DashboardLayout';
import '../styles/StudentDashboard.css';

export default function StudentDashboard() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardContent = async () => {
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
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardContent();

    // Interactive Like/View button toggles
    const likeBtns = document.querySelectorAll('.like-btn');
    const handleLikeClick = (e) => {
      const btn = e.currentTarget;
      const icon = btn.querySelector('i');
      const countSpan = btn.querySelector('.like-count');
      let currentCount = parseInt(countSpan.textContent) || 0;

      if (icon.classList.contains('fa-regular')) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'liked-btn');
        countSpan.textContent = `${currentCount + 1} Likes`;
      } else {
        icon.classList.remove('fa-solid', 'liked-btn');
        icon.classList.add('fa-regular');
        countSpan.textContent = `${currentCount - 1} Likes`;
      }
    };
    likeBtns.forEach(btn => btn.addEventListener('click', handleLikeClick));

    // Bookmark button toggles
    const bookmarkBtns = document.querySelectorAll('.bookmark-btn');
    const handleBookmarkClick = (e) => {
      const btn = e.currentTarget;
      const icon = btn.querySelector('i');
      if (icon.classList.contains('fa-regular')) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid', 'bookmarked-btn');
      } else {
        icon.classList.remove('fa-solid', 'bookmarked-btn');
        icon.classList.add('fa-regular');
      }
    };
    bookmarkBtns.forEach(btn => btn.addEventListener('click', handleBookmarkClick));

    return () => {
      likeBtns.forEach(btn => btn.removeEventListener('click', handleLikeClick));
      bookmarkBtns.forEach(btn => btn.removeEventListener('click', handleBookmarkClick));
    };
  }, []);

  return (
    <DashboardLayout activePage="home">
      {/* ==================== CENTER MAIN CONTENT (DYNAMIC FEED) ==================== */}
      <main className="lg-col-6 space-y-6">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', padding: '2rem' }}>Loading database feeds...</p>
        ) : announcements.length === 0 ? (
          <article className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--slate-600)' }}>No database announcements available yet.</p>
          </article>
        ) : (
          announcements.map((item, index) => (
            <article key={item.id || index} className="card card-interactive" style={{ padding: '1.5rem' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '5.75rem', backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    WMSU
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>{item.department_name || 'University Notice'}</h3>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '0.125rem' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="bookmark-btn action-btn" style={{ padding: '0.25rem' }}>
                    <i className="fa-regular fa-bookmark" style={{ fontSize: '1rem' }}></i>
                  </button>
                  <button className="action-btn" style={{ padding: '0.25rem' }}>
                    <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '1rem', color: 'var(--slate-400)' }}></i>
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '1rem', lineHeight: 1.375 }}>
                  {item.title}
                </h4>
                <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', marginTop: '0.5rem', lineHeight: 1.625 }}>
                  {item.content}
                </p>
              </div>

              <div className="flex items-center justify-between" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-100)', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                <div className="flex items-center gap-6">
                  <button className="like-btn action-btn">
                    <i className="fa-regular fa-eye" style={{ fontSize: '0.875rem' }}></i>
                    <span className="like-count">View Details</span>
                  </button>
                </div>
                <button className="action-btn">
                  <i className="fa-solid fa-user-plus" style={{ fontSize: '0.875rem' }}></i>
                  <span>Register</span>
                </button>
              </div>
            </article>
          ))
        )}
      </main>
    </DashboardLayout>
  );
}