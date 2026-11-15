import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../pages/styles/PortalShell.css';
import logo from '../images/logo.jpg';

const MAX_COLLAPSED_DEPTS = 5;

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
                <span className="dept-badge" aria-hidden="true">
                  {badgeLabel}
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

  return (
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
          <div className="search-wrapper" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder={searchPlaceholder || `Search ${filterCategory === 'all' ? 'Announcements, Events, Departments...' : filterCategory + '...'}`}
              className="search-input"
              style={{ width: '100%', fontSize: '0.8125rem' }}
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => searchQuery.trim() && onSelectSearchResult && onSelectSearchResult(null, true)}
            />
            <button
              type="button"
              className="filter-btn"
              onClick={onToggleFilter}
              title={`Current Filter: ${filterCategory.toUpperCase()}`}
              style={{
                color: filterCategory !== 'all' ? '#881337' : 'inherit',
                fontWeight: filterCategory !== 'all' ? 700 : 400,
                background: 'none',
                border: 'none',
                padding: '0.25rem',
              }}
            >
              <i className="fa-sliders fa-solid" style={{ fontSize: '0.75rem' }}></i>
            </button>
          </div>

          {showSearchDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.5rem',
                backgroundColor: '#ffffff',
                borderRadius: '0.5rem',
                border: '1px solid var(--slate-200, #e2e8f0)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                zIndex: 50,
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '0.5rem',
              }}
            >
              {isSearching ? (
                <p style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center' }}>
                  Searching database...
                </p>
              ) : searchResults.length === 0 ? (
                <p style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--slate-400)', textAlign: 'center' }}>
                  No matching records found in system
                </p>
              ) : (
                searchResults.map((result) => (
                  <a
                    key={result.id}
                    href={result.url}
                    onClick={(e) => {
                      e.preventDefault();
                      if (onSelectSearchResult) onSelectSearchResult(result, false);
                      navigate(result.url);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.375rem',
                      textDecoration: 'none',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--slate-50, #f8fafc)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-800, #1e293b)' }}>
                        {result.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-400, #94a3b8)' }}>
                        {result.type}
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--slate-300)' }}></i>
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
              onClick={() => navigate(qrHref)}
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
              <i className="fa-regular fa-bell" style={{ fontSize: '1.05rem' }}></i>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--slate-100, #f1f5f9)' }}>
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
                      .map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => onNotifClick(notif)}
                          style={{
                            padding: '0.625rem 0.75rem',
                            borderRadius: '0.5rem',
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: !notif.is_read ? 700 : 600, fontSize: '0.8125rem', color: 'var(--slate-800, #1e293b)' }}>
                              {notif.title || notif.page_name || 'Notification'}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--slate-400, #94a3b8)' }}>
                              {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--slate-600, #475569)', margin: 0, lineHeight: 1.3 }}>
                            {notif.message}
                          </p>
                        </div>
                      ))
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
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--slate-100)', marginBottom: '0.25rem' }}>
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

                <div style={{ borderTop: '1px solid var(--slate-100)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
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
