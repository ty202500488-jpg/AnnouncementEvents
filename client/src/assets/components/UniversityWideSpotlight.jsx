import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.jpg';
import '../../pages/styles/UniversityWideSpotlight.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ROTATION_INTERVAL_MS = 5000;
const REFRESH_INTERVAL_MS = 60000;

let cachedSpotlightPromise = null;
let lastSpotlightFetchAt = 0;

async function fetchSpotlightItemsShared(force = false) {
  const now = Date.now();
  if (!force && cachedSpotlightPromise && now - lastSpotlightFetchAt < 5000) {
    return cachedSpotlightPromise;
  }

  lastSpotlightFetchAt = now;
  const token = localStorage.getItem('token');
  cachedSpotlightPromise = fetch(`${API_BASE}/api/spotlight`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(async (res) => {
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    })
    .catch((err) => {
      console.error('Failed to fetch university-wide spotlight:', err);
      return [];
    });

  return cachedSpotlightPromise;
}

function isItemCurrentlyActive(item, nowMs) {
  if (!item) return false;
  if (!item.expires_at) return true;
  const expiresMs = new Date(item.expires_at).getTime();
  return Number.isNaN(expiresMs) ? true : expiresMs > nowMs;
}

function formatReadableDate(dateStr, includeTime = false) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function SpotlightDetailModal({ item, onClose, onNavigateToPage }) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!item) return null;

  const isEvent = item.post_type === 'event';
  const showPhoto = Boolean(item.image_url) && !heroImgFailed;

  return createPortal(
    <div className="uw-modal-overlay" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
      <div className="uw-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="uw-modal-topbar">
          <div className="uw-modal-badges">
            <span className="uw-modal-badge-primary">
              <i className="fa-solid fa-bullhorn" style={{ marginRight: '0.3rem' }}></i>
              University-Wide
            </span>
            <span className="uw-modal-badge-type">
              {isEvent ? 'Event' : 'Announcement'}
            </span>
          </div>
          <button type="button" className="uw-modal-close" onClick={onClose} aria-label="Close spotlight details">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="uw-modal-scroll">
          {showPhoto ? (
            <div className="uw-modal-hero">
              <img src={item.image_url} alt={item.title} onError={() => setHeroImgFailed(true)} />
            </div>
          ) : (
            <div className="uw-modal-hero-logo">
              <div className="uw-spotlight-logo-ring">
                <img src={logo} alt="WMSU Logo" className="uw-spotlight-logo-img" />
              </div>
              <span className="uw-spotlight-logo-caption">Western Mindanao State University</span>
            </div>
          )}

          <div className="uw-modal-body">
            <h2 className="uw-modal-title">{item.title}</h2>

            <div className="uw-modal-meta-row">
              <span className="uw-modal-meta-item">
                <i className="fa-solid fa-building-columns" style={{ color: '#800020' }}></i>
                <strong>{item.page_name || 'University Office'}</strong>
              </span>
              <span className="uw-modal-meta-item">
                <i className="fa-regular fa-clock" style={{ color: '#64748b' }}></i>
                Posted {formatReadableDate(item.published_at || item.created_at)}
              </span>
              {item.expires_at && (
                <span className="uw-modal-meta-item">
                  <i className="fa-regular fa-hourglass-half" style={{ color: '#800020' }}></i>
                  Active until {formatReadableDate(item.expires_at, true)}
                </span>
              )}
            </div>

            {isEvent && (
              <div className="uw-modal-event-box">
                <div>
                  <strong>Event Date:</strong>
                  <div>{formatReadableDate(item.event_date, true)}</div>
                </div>
                <div>
                  <strong>Location:</strong>
                  <div>{item.location || item.venue || 'WMSU Main Campus'}</div>
                </div>
                <div>
                  <strong>Registration:</strong>
                  <div>
                    {item.registered_count ?? 0} / {item.capacity || 'Unlimited'}
                  </div>
                </div>
              </div>
            )}

            <p className="uw-modal-text">{item.content || item.description}</p>
          </div>
        </div>

        <div className="uw-modal-footer">
          <button type="button" className="uw-modal-btn-secondary" onClick={onClose}>
            Close
          </button>
          {item.page_id && (
            <button type="button" className="uw-modal-btn-primary" onClick={() => onNavigateToPage(item.page_id)}>
              <span>Visit {item.page_name || 'Page'}</span>
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function UniversityWideSpotlight({ role = 'student', variant = 'desktop' }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [brokenImages, setBrokenImages] = useState({});

  const applySpotlightItems = useCallback((fetched) => {
    setItems(fetched);
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchSpotlightItemsShared(false).then((fetched) => {
      if (mounted) applySpotlightItems(fetched);
    });
    const refreshId = setInterval(() => {
      fetchSpotlightItemsShared(true).then((fetched) => {
        if (mounted) applySpotlightItems(fetched);
      });
    }, REFRESH_INTERVAL_MS);
    const onSpotlightRefresh = () => {
      fetchSpotlightItemsShared(true).then((fetched) => {
        if (mounted) applySpotlightItems(fetched);
      });
    };
    window.addEventListener('spotlight:refresh', onSpotlightRefresh);
    return () => {
      mounted = false;
      clearInterval(refreshId);
      window.removeEventListener('spotlight:refresh', onSpotlightRefresh);
    };
  }, [applySpotlightItems]);

  const activeItems = useMemo(
    () => items.filter((item) => isItemCurrentlyActive(item, nowMs)),
    [items, nowMs]
  );

  // 5-second auto rotation & expiration tick
  useEffect(() => {
    if (activeItems.length === 0) return undefined;
    const timer = setInterval(() => {
      setNowMs(Date.now());
      if (!isPaused && !selectedPost && activeItems.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % activeItems.length);
      }
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeItems.length, isPaused, selectedPost]);

  // Dynamically collapse when there are no active University-Wide items
  if (activeItems.length === 0) {
    return selectedPost ? (
      <SpotlightDetailModal
        key={selectedPost.id}
        item={selectedPost}
        onClose={() => setSelectedPost(null)}
        onNavigateToPage={(pageId) => {
          setSelectedPost(null);
          navigate(`/${role === 'staff' ? 'staff' : 'student'}/page/${pageId}`);
        }}
      />
    ) : null;
  }

  const safeIndex = currentIndex % activeItems.length;
  const trackStyle = {
    transform: `translateX(-${safeIndex * 100}%)`,
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeItems.length);
  };

  const handleNavigateToPage = (pageId) => {
    setSelectedPost(null);
    navigate(`/${role === 'staff' ? 'staff' : 'student'}/page/${pageId}`);
  };

  if (variant === 'mobile') {
    return (
      <>
        <div
          className="uw-spotlight-mobile"
          aria-label="University-Wide Announcements and Events Spotlight"
        >
          <div className="uw-mobile-viewport">
            <div className="uw-spotlight-track" style={trackStyle}>
              {activeItems.map((slideItem, idx) => {
                const slideHasPhoto = Boolean(slideItem.image_url) && !brokenImages[slideItem.id];
                return (
                  <div
                    key={slideItem.id || idx}
                    className="uw-mobile-slide"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPost(slideItem)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedPost(slideItem);
                      }
                    }}
                    aria-label={`University-wide spotlight: ${slideItem.title}`}
                  >
                    <div className={`uw-mobile-thumb ${slideHasPhoto ? '' : 'is-logo'}`}>
                      <img
                        src={slideHasPhoto ? slideItem.image_url : logo}
                        alt={slideHasPhoto ? slideItem.title : 'WMSU Logo'}
                        onError={() => setBrokenImages((prev) => ({ ...prev, [slideItem.id]: true }))}
                      />
                    </div>

                    <div className="uw-mobile-info">
                      <div className="uw-mobile-top-row">
                        <span className="uw-mobile-badge">University-Wide</span>
                      </div>
                      <h4 className="uw-mobile-title">{slideItem.title}</h4>
                      <div className="uw-mobile-sub">
                        {slideItem.page_name || 'University Office'} • Tap for details
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {activeItems.length > 1 && (
            <div className="uw-mobile-controls" onClick={(e) => e.stopPropagation()}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#881337' }}>
                {safeIndex + 1}/{activeItems.length}
              </span>
              <div className="uw-mobile-arrow-row">
                <button type="button" className="uw-mobile-arrow-btn" onClick={handlePrev} aria-label="Previous spotlight item">
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <button type="button" className="uw-mobile-arrow-btn" onClick={handleNext} aria-label="Next spotlight item">
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>

        <SpotlightDetailModal
          key={selectedPost?.id || 'mobile-modal'}
          item={selectedPost}
          onClose={() => setSelectedPost(null)}
          onNavigateToPage={handleNavigateToPage}
        />
      </>
    );
  }

  return (
    <>
      <section
        className="uw-spotlight-card"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        aria-label="University-Wide Announcements and Events Spotlight"
      >
        <div className="uw-spotlight-header">
          <div className="uw-spotlight-heading">
            <i className="fa-solid fa-bullhorn"></i>
            <span>University-Wide</span>
          </div>
          {activeItems.length > 1 && (
            <span className="uw-spotlight-counter">
              {safeIndex + 1} / {activeItems.length}
            </span>
          )}
        </div>

        <div className="uw-spotlight-viewport">
          <div className="uw-spotlight-track" style={trackStyle}>
            {activeItems.map((slideItem, idx) => {
              const slideHasPhoto = Boolean(slideItem.image_url) && !brokenImages[slideItem.id];
              return (
                <div
                  key={slideItem.id || idx}
                  className="uw-spotlight-slide"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPost(slideItem)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPost(slideItem);
                    }
                  }}
                >
                  <div className="uw-spotlight-media">
                    {slideHasPhoto ? (
                      <img
                        src={slideItem.image_url}
                        alt={slideItem.title}
                        className="uw-spotlight-img"
                        onError={() => setBrokenImages((prev) => ({ ...prev, [slideItem.id]: true }))}
                      />
                    ) : (
                      <div className="uw-spotlight-logo-fallback">
                        <div className="uw-spotlight-logo-ring">
                          <img src={logo} alt="WMSU Official Logo" className="uw-spotlight-logo-img" />
                        </div>
                      </div>
                    )}

                    <div className="uw-spotlight-title-overlay">
                      <h4 className="uw-spotlight-overlay-title">{slideItem.title}</h4>
                    </div>
                  </div>

                  <div className="uw-spotlight-content">
                    <div className="uw-spotlight-meta">
                      <span className="uw-spotlight-page">{slideItem.page_name || 'University Office'}</span>
                      <span className="uw-spotlight-cta">View Details →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activeItems.length > 1 && (
            <>
              <button type="button" className="uw-nav-arrow prev" onClick={handlePrev} aria-label="Previous spotlight item">
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <button type="button" className="uw-nav-arrow next" onClick={handleNext} aria-label="Next spotlight item">
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </>
          )}
        </div>

        {activeItems.length > 1 && (
          <div className="uw-spotlight-footer">
            <div className="uw-dots" role="tablist" aria-label="Spotlight slides">
              {activeItems.map((item, idx) => (
                <button
                  key={item.id || idx}
                  type="button"
                  className={`uw-dot ${idx === safeIndex ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Show spotlight item ${idx + 1}: ${item.title}`}
                />
              ))}
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>5s auto</span>
          </div>
        )}
      </section>

      <SpotlightDetailModal
        key={selectedPost?.id || 'desktop-modal'}
        item={selectedPost}
        onClose={() => setSelectedPost(null)}
        onNavigateToPage={handleNavigateToPage}
      />
    </>
  );
}
