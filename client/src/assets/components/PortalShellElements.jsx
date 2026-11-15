import { useState } from 'react';
import '../../pages/styles/PortalShell.css';

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
