import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../../pages/styles/PortalShell.css';
import logo from '../images/logo.jpg';
import QRCheckInScanner from './QRCheckInScanner';
import { formatPostTimestamp } from '../../utils/dateUtils';
import { formatNotificationDisplay } from '../../utils/notificationUtils';

const MAX_COLLAPSED_DEPTS = 5;

/**
 * Build standardized profile dropdown items for all non-admin portal views.
 */
export function buildPortalProfileMenuItems({
  role = 'student',
  hasApprovedPage = false,
  swapDashboardHref,
  onSwapDashboard,
  extraItems = [],
} = {}) {
  const isStaff = role === 'staff';
  const items = [
    {
      label: 'Profile',
      href: isStaff ? '/staff/profile' : '/student/profile',
      icon: 'fa-solid fa-user',
    },
    ...extraItems,
  ];

  if (isStaff && hasApprovedPage && (swapDashboardHref || onSwapDashboard)) {
    items.push({
      label: 'Swap Dashboard',
      href: swapDashboardHref || '/staff/mypage/dashboard',
      icon: 'fa-solid fa-repeat',
      iconColor: '#7B0D1E',
      onClick: onSwapDashboard,
    });
  }

  items.push({
    label: 'Settings',
    href: isStaff ? '/staff/settings' : '/student/settings',
    icon: 'fa-solid fa-gear',
  });

  return items;
}

/**
 * Derive a short 2-3 character monogram from a full name or department title.
 */
export function getInitials(label, fallback = 'WM') {
  if (!label || typeof label !== 'string') return fallback;
  const words = label
    .trim()
    .split(/\s+/)
    .filter((word) => word && !['of', 'and', 'for', 'the'].includes(word.toLowerCase()));
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

/**
 * Desktop Facebook-style centered icon navigation tabs rendered inside the 56px top bar.
 */
export function PortalHeaderCenterTabs({ tabs, activePage }) {
  return (
    <nav className="fb-header-tabs" aria-label="Primary portal navigation">
      {tabs.map((tab) => {
        const isActive = activePage === tab.id;
        return (
          <a
            key={tab.id}
            href={tab.href}
            title={tab.label}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={`fb-header-tab ${isActive ? 'is-active' : ''}`}
          >
            <span className="fb-header-tab-pill">
              <i className={tab.icon} aria-hidden="true"></i>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Borderless right-rail Department Pages list rendered directly on the page canvas.
 */
export function DepartmentPagesSidebarList({
  departments = [],
  loadingDepts = false,
  pageBasePath = '/student/page',
}) {
  const [showAll, setShowAll] = useState(false);
  const hasOverflow = departments.length > MAX_COLLAPSED_DEPTS;
  const visibleDepartments =
    hasOverflow && !showAll ? departments.slice(0, MAX_COLLAPSED_DEPTS) : departments;

  return (
    <div className="card dept-pages-card">
      <div className="dept-section-header">
        <h3>Department Pages</h3>
        {hasOverflow && (
          <button
            type="button"
            className="dept-toggle-link"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? 'Show Less' : `View All (${departments.length})`}
          </button>
        )}
      </div>

      <div className="dept-list">
        {loadingDepts ? (
          <p className="dept-empty-state">Loading pages...</p>
        ) : departments.length === 0 ? (
          <p className="dept-empty-state">No approved pages found.</p>
        ) : (
          visibleDepartments.map((dept, index) => {
            const badgeLabel = (dept.code || getInitials(dept.name, 'DP')).slice(0, 3).toUpperCase();
            return (
              <a
                key={dept.id || index}
                href={dept.url || `${pageBasePath}/${dept.id}`}
                className="dept-item"
              >
                <span className="dept-badge" aria-hidden="true" style={{ overflow: 'hidden' }}>
                  {dept.avatar_url ? (
                    <img
                      src={dept.avatar_url}
                      alt={dept.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    badgeLabel
                  )}
                </span>
                <div className="dept-info">
                  <span className="dept-title">{dept.name}</span>
                  <span className="dept-sub">
                    {dept.category || dept.subtitle || 'Official Page'}
                  </span>
                </div>
              </a>
            );
          })
        )}

        {hasOverflow && (
          <button
            type="button"
            className="see-more-btn"
            onClick={() => setShowAll((prev) => !prev)}
          >
            <span>{showAll ? 'Show Less' : 'See More'}</span>
            <i
              className={`fa-solid ${showAll ? 'fa-chevron-up' : 'fa-chevron-down'}`}
              aria-hidden="true"
            ></i>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Standardized MyPage-reference Top Navbar shared by Student, Staff, and MyPage dashboards.
 */
export function PortalNavbar({
  homeHref = '/',
  homeAriaLabel = 'CRIMSON Home',
  isMobileMenuOpen,
  onToggleMobileMenu,
  searchQuery,
  onSearchChange,
  filterCategory,
  onToggleFilter,
  searchPlaceholder,
  searchResults = [],
  isSearching = false,
  showSearchDropdown = false,
  onSelectSearchResult,
  searchContainerRef,
  showQrButton = false,
  qrHref = '/student/attendance/check-in/scan',
  notifications = [],
  loadingNotifs = false,
  unreadNotifCount = 0,
  showNotifDropdown = false,
  onToggleNotifDropdown,
  onMarkAllAsRead,
  onNotifClick,
  notifDropdownRef,
  profileTitle,
  profileSubtitle,
  profileInitials = 'WM',
  showProfileDropdown = false,
  onToggleProfileDropdown,
  onCloseProfileDropdown,
  profileDropdownRef,
  profileMenuItems = [],
  onLogout,
}) {
  const navigate = useNavigate();
  const [showQrModal, setShowQrModal] = useState(false);
  const qrRole = String(qrHref || '').includes('/staff/') ? 'staff' : 'student';

  useEffect(() => {
    if (!showQrModal) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowQrModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showQrModal]);

  return (
    <>
    <header className="header">
      <div className="header-container">
        {/* Left: Mobile Hamburger + Brand Logo */}
        <div className="fb-header-brand">
          <button
            type="button"
            className="mobile-menu-btn icon-btn"
            onClick={onToggleMobileMenu}
            style={{ color: 'var(--slate-600)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Toggle Menu"
          >
            <i className="fa-solid fa-bars" style={{ fontSize: '1.25rem' }}></i>
          </button>
          <a
            href={homeHref}
            onClick={(e) => {
              e.preventDefault();
              navigate(homeHref);
            }}
            className="fb-brand-link"
            aria-label={homeAriaLabel}
          >
            <img
              src={logo}
              alt="CRIMSON Logo"
              style={{ height: '48px', width: '48px', objectFit: 'contain', borderRadius: '50%' }}
            />
          </a>
        </div>

        {/* Center: Search Bar */}
        <div className="search-container" ref={searchContainerRef}>
          <div className="search-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
            <input
              type="text"
              placeholder={searchPlaceholder || `Search ${filterCategory === 'all' ? 'Announcements, Events, Departments...' : filterCategory + '...'}`}
              className="search-input"
              aria-label="Search portal"
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => searchQuery.trim() && onSelectSearchResult && onSelectSearchResult(null, true)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => onSearchChange({ target: { value: '' } })}
                title="Clear search"
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            )}
            <button
              type="button"
              className={`filter-btn ${filterCategory !== 'all' ? 'is-filtered' : ''}`}
              onClick={onToggleFilter}
              title={`Filter: ${filterCategory.toUpperCase()} (click to switch)`}
              aria-label={`Filter search by category: ${filterCategory}`}
            >
              <i className="fa-solid fa-sliders" aria-hidden="true"></i>
              <span className="filter-btn-label">
                {filterCategory === 'all' ? 'All' : filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)}
              </span>
            </button>
          </div>

          {showSearchDropdown && (
            <div className="search-dropdown">
              {isSearching ? (
                <p style={{ padding: '0.875rem', fontSize: '0.8125rem', color: '#64748b', textAlign: 'center', margin: 0 }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem', color: '#881337' }} aria-hidden="true"></i>
                  Searching...
                </p>
              ) : searchResults.length === 0 ? (
                <p style={{ padding: '0.875rem', fontSize: '0.8125rem', color: '#64748b', textAlign: 'center', margin: 0 }}>
                  <i className="fa-regular fa-folder-open" style={{ marginRight: '0.5rem', color: '#94a3b8' }} aria-hidden="true"></i>
                  No matching announcements, events, or pages found
                </p>
              ) : (
                searchResults.map((result) => (
                  <a
                    key={result.key || `${result.type || 'item'}-${result.id}`}
                    href={result.url || '#'}
                    className="search-result-item"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onSelectSearchResult) onSelectSearchResult(result, false);
                      if (result.url) navigate(result.url);
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1e293b' }}>
                        {result.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '0.1rem' }}>
                        {result.typeLabel || result.type}
                        {result.subtitle ? ` • ${result.subtitle}` : ''}
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: '#94a3b8' }} aria-hidden="true"></i>
                  </a>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: Actions & Profile Dropdown */}
        <div className="fb-header-actions">
          {showQrButton && (
            <button
              type="button"
              className="icon-btn fb-header-circle-btn fb-qr-btn"
              onClick={() => setShowQrModal(true)}
              title="Scan QR Attendance with Camera"
              aria-label="Scan QR Attendance with Camera"
            >
              <i className="fa-solid fa-qrcode" style={{ fontSize: '0.95rem' }}></i>
            </button>
          )}

          {/* Notifications Dropdown */}
          <div ref={notifDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              className="icon-btn fb-header-circle-btn"
              onClick={onToggleNotifDropdown}
              aria-label="Notifications"
            >
              <i className="fa-solid fa-bell" style={{ fontSize: '1.05rem' }}></i>
              {unreadNotifCount > 0 && <span className="badge-dot"></span>}
            </button>

            {showNotifDropdown && (
              <div
                className="notif-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  width: 'clamp(270px, 82vw, 320px)',
                  backgroundColor: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #cbd5e1' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900, #0f172a)' }}>Notifications</div>
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllAsRead}
                      style={{ background: 'none', border: 'none', color: '#881337', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {loadingNotifs ? (
                    <p style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center' }}>Loading notifications...</p>
                  ) : notifications.filter((n) => !n.is_archived).length === 0 ? (
                    <p style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center' }}>No new notifications</p>
                  ) : (
                    notifications
                      .filter((n) => !n.is_archived)
                      .map((notif) => {
                        const { pageName, title: displayTitle, summary } = formatNotificationDisplay(notif);
                        return (
                        <div
                          key={notif.id}
                          onClick={() => onNotifClick(notif)}
                          style={{
                            padding: '0.625rem 0.75rem',
                            borderRadius: '0.5rem',
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: !notif.is_read ? '#fff5f6' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem',
                          }}
                          onMouseEnter={(e) => {
                            if (notif.is_read) e.currentTarget.style.backgroundColor = 'var(--slate-50, #f8fafc)';
                          }}
                          onMouseLeave={(e) => {
                            if (notif.is_read) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                            <PostPageAvatar
                              avatarUrl={notif.page_avatar_url}
                              label={pageName}
                              fallbackCode={notif.page_code}
                              size="2rem"
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: !notif.is_read ? 700 : 600, fontSize: '0.8125rem', color: 'var(--slate-800, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {pageName}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--slate-400, #94a3b8)', flexShrink: 0 }}>
                                  {formatPostTimestamp(notif.created_at)}
                                </span>
                              </div>
                              {displayTitle && (
                                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {displayTitle}
                                </div>
                              )}
                              {summary && (
                                <p style={{ fontSize: '0.725rem', color: 'var(--slate-600, #475569)', margin: '0.1rem 0 0 0', lineHeight: 1.3 }}>
                                  {summary}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div ref={profileDropdownRef} style={{ position: 'relative', flexShrink: 0, minWidth: 0 }}>
            <button
              type="button"
              className="profile-btn fb-profile-trigger"
              onClick={onToggleProfileDropdown}
              aria-expanded={showProfileDropdown}
              aria-label="Account menu"
            >
              <span className="fb-avatar-badge" aria-hidden="true">{profileInitials}</span>
              <div className="profile-details-text" style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.8125rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profileTitle}
                </div>
                <div className="user-program" style={{ fontSize: '10px', color: 'var(--slate-500)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profileSubtitle}
                </div>
              </div>
              <i className="fa-solid fa-chevron-down" style={{ color: 'var(--slate-400)', fontSize: '10px', flexShrink: 0 }}></i>
            </button>

            {showProfileDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  width: '210px',
                  backgroundColor: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--slate-200, #e2e8f0)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #cbd5e1', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profileTitle}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {profileSubtitle}
                  </div>
                </div>

                {profileMenuItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href || '#'}
                    onClick={(e) => {
                      e.preventDefault();
                      if (onCloseProfileDropdown) onCloseProfileDropdown();
                      if (item.onClick) {
                        item.onClick();
                      } else if (item.href) {
                        navigate(item.href);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8125rem',
                      color: 'var(--slate-700)',
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--slate-50)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <i className={item.icon} style={{ width: '16px', color: item.iconColor || 'var(--slate-500)' }}></i> {item.label}
                  </a>
                ))}

                <div style={{ borderTop: '1px solid #cbd5e1', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCloseProfileDropdown) onCloseProfileDropdown();
                      if (onLogout) onLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8125rem',
                      color: 'var(--rose-600)',
                      background: 'none',
                      border: 'none',
                      width: '100%',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--rose-50)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <i className="fa-solid fa-right-from-bracket" style={{ width: '16px' }}></i> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    {showQrModal &&
      createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QR Attendance Check-In"
          onClick={() => setShowQrModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(0.625rem, 2.5vw, 1.25rem)',
            boxSizing: 'border-box',
          }}
        >
          <QRCheckInScanner
            role={qrRole}
            isModal={true}
            onClose={() => setShowQrModal(false)}
          />
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Shared Page Profile Header Card used by both MyPageProfile (owner) and PageView (visitor).
 */
export function PageProfileHeader({
  name,
  category,
  description,
  profileImage,
  avatarFallback,
  badges = null,
  actions = null,
}) {
  return (
    <div className="page-profile-card">
      <div className="page-profile-header-row">
        <div className="page-profile-identity">
          <div className="page-profile-avatar">
            {profileImage ? (
              <img src={profileImage} alt={name} />
            ) : (
              avatarFallback
            )}
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900, #0f172a)', margin: '0 0 0.25rem 0', lineHeight: 1.2 }}>
              {name}
            </h1>
            <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-accent, #881337)', margin: '0 0 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {category}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--slate-600, #475569)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
              {description || 'No description provided.'}
            </p>
            {badges && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                {badges}
              </div>
            )}
          </div>
        </div>

        {actions && <div className="page-profile-actions">{actions}</div>}
      </div>
    </div>
  );
}

const PORTAL_STAR_TONES = ['white', 'slate', 'maroon'];

// Deterministic pseudo-random stars so each dot twinkles on its own phase & cadence
const PORTAL_STARS = Array.from({ length: 42 }, (_, index) => {
  const x = ((index * 37 + 11) % 96) + 2;
  const y = ((index * 53 + 7) % 94) + 3;
  const size = 3.5 + ((index * 17) % 4) * 0.5;
  const tone = PORTAL_STAR_TONES[index % PORTAL_STAR_TONES.length];
  const duration = (3.1 + ((index * 13) % 9) * 0.48).toFixed(2);
  const delay = (-(((index * 19) % 17) * 0.43)).toFixed(2);
  return { id: index, x, y, size, tone, duration, delay };
});

/**
 * Ambient twinkling background dots for `.fb-shell-layout` with staggered timings.
 */
export function PortalShellBackdrop() {
  return (
    <div className="fb-shell-backdrop" aria-hidden="true">
      {PORTAL_STARS.map((star) => (
        <span
          key={star.id}
          className={`fb-shell-star fb-shell-star--${star.tone}`}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Consistent circular page avatar used across post cards and post composers.
 */
export function PostPageAvatar({ avatarUrl, label = 'University Office', fallbackCode = null, size = '2.5rem' }) {
  const initials = (fallbackCode || getInitials(label, 'WM')).slice(0, 3).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #9f1239 0%, #881337 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '0.8rem',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials
      )}
    </div>
  );
}

/**
 * Normalize a post's audience into 'private', 'followers', or 'public'.
 */
export function normalizePostAudience(audience) {
  const normalized = String(audience || '').trim().toLowerCase();
  if (normalized === 'private') return 'private';
  if (normalized === 'followers' || normalized === 'followers only' || normalized === 'only followers') {
    return 'followers';
  }
  return 'public';
}

/**
 * Display whether a post is Public, Followers, or Private (icon-only by default like Facebook).
 */
export function PostAudienceBadge({ audience, showLabel = false }) {
  const kind = normalizePostAudience(audience);
  const meta =
    kind === 'private'
      ? { label: 'Private', icon: 'fa-solid fa-lock', color: '#64748b', title: 'Private — Visible to page admins/owners only' }
      : kind === 'followers'
        ? { label: 'Followers', icon: 'fa-solid fa-user-group', color: '#64748b', title: 'Followers — Visible to page followers only' }
        : { label: 'Public', icon: 'fa-solid fa-earth-americas', color: '#64748b', title: 'Public — Visible to everyone' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        color: meta.color,
        fontWeight: 500,
      }}
      title={meta.title}
      aria-label={meta.label}
    >
      <i
        className={meta.icon}
        style={{ fontSize: '0.72rem', color: '#94a3b8' }}
      ></i>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}

/**
 * Consistent metadata line for event posts across all portal feeds and pages.
 */
export function EventPostMeta({
  registeredCount = 0,
  capacity,
  createdAt,
  audience,
}) {
  const maxCapacity = capacity || 'Unlimited';
  const postedAt = createdAt ? formatPostTimestamp(createdAt) : null;

  return (
    <>
      <span>
        <i className="fa-solid fa-users" style={{ color: '#94a3b8' }}></i> {registeredCount} / {maxCapacity}
      </span>
      {postedAt && (
        <>
          <span>•</span>
          <span>{postedAt}</span>
        </>
      )}
      <span>•</span>
      <PostAudienceBadge audience={audience} />
    </>
  );
}

/**
 * Toggle event registration via the shared user events API.
 */
export async function toggleEventRegistrationRequest(eventId, isAlreadyRegistered) {
  const token = localStorage.getItem('token');
  if (!token) {
    return { ok: false, unauthenticated: true, message: 'Please sign in first.' };
  }

  const method = isAlreadyRegistered ? 'DELETE' : 'POST';
  const endpoint = isAlreadyRegistered
    ? `http://localhost:5000/api/users/events/${eventId}/cancel`
    : `http://localhost:5000/api/users/events/${eventId}/register`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data, message: data.message };
}

/**
 * Update an item list's `is_registered` and `registered_count` after registering/unregistering.
 */
export function applyEventRegistrationUpdate(items, eventId, nextRegistered) {
  const delta = nextRegistered ? 1 : -1;
  return items.map((item) => {
    const itemId = item.id ?? item.post_id;
    const isEventItem =
      item.post_type === 'event' || item.type === 'event' || item.event_date !== undefined;
    if (!isEventItem || itemId !== eventId) return item;
    const currentCount = item.registered_count ?? item.current_registered ?? 0;
    const nextCount = Math.max(0, currentCount + delta);
    return {
      ...item,
      is_registered: nextRegistered,
      registered_count: nextCount,
      current_registered: nextCount,
    };
  });
}

/**
 * Consistent action bar for event posts (Register Now / Unregister + Scan Attendance).
 */
export function EventPostActionBar({
  isRegistered = false,
  isRegistering = false,
  onToggleRegister = null,
  onScanAttendance = null,
}) {
  if (!onToggleRegister && !(onScanAttendance && isRegistered)) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        flexWrap: 'wrap',
        margin: '0.75rem 1rem 0.25rem 1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #e6ebf0',
      }}
    >
      {onScanAttendance && isRegistered && (
        <button
          type="button"
          onClick={onScanAttendance}
          style={{
            backgroundColor: '#ffffff',
            color: '#475569',
            border: '1px solid #e2e8f0',
            padding: '0.45rem 0.875rem',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <i className="fa-solid fa-qrcode"></i> Scan Attendance
        </button>
      )}
      {onToggleRegister && (
        isRegistered ? (
          <>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>Registered</span>
            </span>
            <button
              type="button"
              onClick={onToggleRegister}
              disabled={isRegistering}
              style={{
                background: 'transparent',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                padding: '0.45rem 0.875rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isRegistering ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {isRegistering ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <>
                  <i className="fa-solid fa-circle-xmark"></i>
                  <span>Unregister</span>
                </>
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleRegister}
            disabled={isRegistering}
            className="btn-fb btn-fb-primary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
          >
            {isRegistering ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <>
                <i className="fa-solid fa-ticket"></i>
                <span>Register Now</span>
              </>
            )}
          </button>
        )
      )}
    </div>
  );
}

function resolvePostKindAndId(post) {
  const isEvent =
    post?._type === 'Event' ||
    post?.post_type === 'event' ||
    post?.type === 'Event' ||
    Boolean(post?.event_id || post?.event_title || post?.event_date);
  const id = isEvent
    ? post?.event_id || post?.id || post?.post_id
    : post?.announcement_id || post?.id || post?.post_id;
  return { isEvent, id };
}

/**
 * Update an announcement or event post via the shared backend endpoint.
 */
export async function updatePostRequest(post, { title, content, audience }) {
  const token = localStorage.getItem('token');
  if (!token || !post) {
    return { ok: false, message: 'Not authenticated.' };
  }
  const { isEvent, id } = resolvePostKindAndId(post);
  const endpoint = isEvent
    ? `http://localhost:5000/api/events/${id}`
    : `http://localhost:5000/api/announcements/${id}`;
  const body = isEvent
    ? { event_title: title, event_description: content, ...(audience ? { audience } : {}) }
    : { title, content, ...(audience ? { audience } : {}) };

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, message: data.message, isEvent, id };
}

/**
 * Delete an announcement or event post via the shared backend endpoint.
 */
export async function deletePostRequest(post) {
  const token = localStorage.getItem('token');
  if (!token || !post) {
    return { ok: false, message: 'Not authenticated.' };
  }
  const { isEvent, id } = resolvePostKindAndId(post);
  const endpoint = isEvent
    ? `http://localhost:5000/api/events/${id}`
    : `http://localhost:5000/api/announcements/${id}`;

  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, message: data.message, isEvent, id };
}

/**
 * Shared 3-dots owner action menu (Edit / Delete) for feed and list cards.
 */
export function PostOwnerActionMenu({ isOpen, onToggle, onEdit, onDelete }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '0.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '9999px',
        }}
        title="Manage post"
      >
        <i className="fa-solid fa-ellipsis-vertical" style={{ fontSize: '0.95rem' }}></i>
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.25rem',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.625rem',
            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
            minWidth: '130px',
            zIndex: 30,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={onEdit}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#1e293b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <i className="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'left',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#b91c1c',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <i className="fa-solid fa-trash-can"></i> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Shared Edit & Delete confirmation modals for post owners.
 */
export function PostEditDeleteModals({
  editingPost,
  postTitle,
  postContent,
  postAudience,
  onChangeTitle,
  onChangeContent,
  onChangeAudience,
  onCloseEdit,
  onSubmitEdit,
  submitting,
  deletingPost,
  onCloseDelete,
  onConfirmDelete,
}) {
  return (
    <>
      {editingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem',
          }}
          onClick={onCloseEdit}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '480px',
              padding: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Edit Post</h3>
              <button
                type="button"
                onClick={onCloseEdit}
                style={{ background: 'none', border: 'none', fontSize: '1.125rem', color: '#64748b', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={onSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Title
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => onChangeTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Content
                </label>
                <textarea
                  rows="5"
                  value={postContent}
                  onChange={(e) => onChangeContent(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              {onChangeAudience && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Audience
                  </label>
                  <select
                    value={postAudience || 'All Campus'}
                    onChange={(e) => onChangeAudience(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="All Campus">Public</option>
                    <option value="Followers Only">Followers</option>
                    <option value="Private">Private</option>
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={onCloseEdit}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#881337', color: '#ffffff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '1rem',
          }}
          onClick={onCloseDelete}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '400px',
              padding: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a' }}>Delete Post?</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onCloseDelete}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#dc2626', color: '#ffffff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
