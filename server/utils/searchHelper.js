/**
 * Shared portal search helper for Announcements, Events, and Approved Pages.
 */

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

/**
 * Normalize client filter category / type parameter into a canonical search scope.
 * @param {string} rawType
 * @returns {'all' | 'announcements' | 'events' | 'pages'}
 */
function normalizeSearchFilter(rawType) {
  const value = String(rawType || 'all').trim().toLowerCase();
  if (value === 'announcement' || value === 'announcements') return 'announcements';
  if (value === 'event' || value === 'events') return 'events';
  if (value === 'department' || value === 'departments' || value === 'page' || value === 'pages') {
    return 'pages';
  }
  return 'all';
}

/**
 * Convert a page_type enum value into a display label.
 * @param {string} pageType
 * @returns {string}
 */
function formatPageTypeLabel(pageType) {
  const normalized = String(pageType || 'department').trim().toLowerCase();
  if (normalized === 'organization') return 'Organization Page';
  if (normalized === 'office') return 'Office Page';
  return 'Department Page';
}

/**
 * Clamp and normalize the search result limit.
 * @param {unknown} rawLimit
 * @returns {number}
 */
function normalizeLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

/**
 * Search approved pages, announcements, and events in PostgreSQL.
 * @param {import('pg').Pool} db
 * @param {{ query?: string, type?: string, userId?: number | null, limit?: number }} options
 */
async function searchPortalContent(db, { query = '', type = 'all', userId = null, limit = DEFAULT_LIMIT } = {}) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) {
    return [];
  }

  const filter = normalizeSearchFilter(type);
  const safeLimit = normalizeLimit(limit);
  const likePattern = `%${trimmedQuery}%`;
  const prefixPattern = `${trimmedQuery}%`;
  const safeUserId = Number.isSafeInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null;

  const includePages = filter === 'all' || filter === 'pages';
  const includePosts = filter === 'all' || filter === 'announcements' || filter === 'events';
  const postTypeFilter = filter === 'announcements' ? 'announcement' : filter === 'events' ? 'event' : null;

  const [pageRes, postRes] = await Promise.all([
    includePages
      ? db.query(
          `SELECT p.page_id AS id,
                  p.page_name AS title,
                  p.page_code AS code,
                  p.page_type,
                  p.page_description AS description,
                  p.avatar_url
           FROM pages p
           WHERE LOWER(p.status) IN ('approved', 'active')
             AND (
               p.page_name ILIKE $1
               OR COALESCE(p.page_code, '') ILIKE $1
               OR COALESCE(p.page_description, '') ILIKE $1
             )
           ORDER BY
             CASE WHEN LOWER(p.page_name) LIKE LOWER($2) THEN 0 ELSE 1 END,
             p.page_name ASC
           LIMIT $3`,
          [likePattern, prefixPattern, safeLimit]
        )
      : Promise.resolve({ rows: [] }),
    includePosts
      ? db.query(
          `SELECT p.post_id AS id,
                  p.post_type,
                  p.title,
                  p.content,
                  p.page_id,
                  p.created_at,
                  pg.page_name,
                  pg.page_code,
                  pc.category_name,
                  ed.event_date,
                  ed.location
           FROM posts p
           LEFT JOIN pages pg ON p.page_id = pg.page_id
           LEFT JOIN post_categories pc ON p.category_id = pc.category_id
           LEFT JOIN event_details ed ON p.post_id = ed.post_id
           WHERE p.is_archived = FALSE
             AND LOWER(p.moderation_status) = 'approved'
             AND LOWER(COALESCE(p.status, 'published')) NOT IN ('draft', 'rejected', 'archived')
             AND (pg.page_id IS NULL OR LOWER(pg.status) IN ('approved', 'active'))
             AND ($4::text IS NULL OR p.post_type = $4)
             AND (
               TRIM(LOWER(COALESCE(p.audience, 'All Campus'))) IN ('all campus', 'public', 'everyone', 'campus', '')
               OR (
                 $3::int IS NOT NULL
                 AND TRIM(LOWER(COALESCE(p.audience, 'All Campus'))) != 'private'
                 AND EXISTS (
                   SELECT 1 FROM page_follows pf
                   WHERE pf.page_id = p.page_id AND pf.follower_user_id = $3
                 )
               )
             )
             AND (
               p.title ILIKE $1
               OR p.content ILIKE $1
               OR COALESCE(pg.page_name, '') ILIKE $1
               OR COALESCE(pg.page_code, '') ILIKE $1
               OR COALESCE(pc.category_name, '') ILIKE $1
               OR COALESCE(ed.location, '') ILIKE $1
             )
           ORDER BY
             CASE WHEN LOWER(p.title) LIKE LOWER($2) THEN 0 ELSE 1 END,
             p.is_pinned DESC,
             p.created_at DESC
           LIMIT $5`,
          [likePattern, prefixPattern, safeUserId, postTypeFilter, safeLimit]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const pageResults = (pageRes.rows || []).map((row) => ({
    id: row.id,
    key: `page-${row.id}`,
    title: row.title,
    type: 'page',
    typeLabel: formatPageTypeLabel(row.page_type),
    category: 'departments',
    subtitle: row.code || null,
    page_id: row.id,
    page_code: row.code || null,
  }));

  const postResults = (postRes.rows || []).map((row) => {
    const isEvent = row.post_type === 'event';
    const sourceLabel = row.page_code || row.page_name || null;
    const subtitleParts = [sourceLabel, isEvent ? row.location : row.category_name].filter(Boolean);
    return {
      id: row.id,
      key: `${row.post_type}-${row.id}`,
      title: row.title,
      type: isEvent ? 'event' : 'announcement',
      typeLabel: isEvent ? 'Event' : 'Announcement',
      category: isEvent ? 'events' : 'announcements',
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : null,
      page_id: row.page_id || null,
      page_name: row.page_name || null,
      event_date: row.event_date || null,
      location: row.location || null,
      created_at: row.created_at || null,
    };
  });

  const combined = [...pageResults, ...postResults];
  const lowerQuery = trimmedQuery.toLowerCase();
  combined.sort((a, b) => {
    const aStarts = String(a.title || '').toLowerCase().startsWith(lowerQuery) ? 0 : 1;
    const bStarts = String(b.title || '').toLowerCase().startsWith(lowerQuery) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return 0;
  });

  return combined.slice(0, safeLimit);
}

module.exports = {
  normalizeSearchFilter,
  formatPageTypeLabel,
  normalizeLimit,
  searchPortalContent,
};
