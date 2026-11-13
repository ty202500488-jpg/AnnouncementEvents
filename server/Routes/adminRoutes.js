const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin, logAudit } = require('../middleware/auth');

const DEFAULT_SETTINGS = {
    system_name: 'WMSU Campus Announcements & Events System',
    system_description: 'Official announcements and event management portal for Western Mindanao State University.',
    default_timezone: 'Asia/Manila',
    date_format: 'YYYY-MM-DD',
    maintenance_mode: false,
    default_announcement_category: 'General',
    default_expiration_days: 14,
    require_approval_campus_wide: true,
    max_pinned_announcements: 5,
    allow_urgent_announcements: true,
    default_event_visibility: 'campus-only',
    enable_event_registration_default: true,
    default_registration_capacity: 100,
    registration_closing_lead_hours: 2,
    enable_in_app_notifications: true,
    enable_email_notifications: false,
    notify_pending_approval: true,
    notify_student_verification: true,
    permitted_email_domain: 'wmsu.edu.ph',
    registration_open: true,
    require_student_id_cor_verification: true,
    pending_verification_expire_days: 7,
    session_timeout_minutes: 30,
    max_login_attempts: 5,
    enable_rate_limiting: true
};

// Apply Admin Auth Middleware to all /api/admin routes
router.use(requireAdmin);

// Helper: CSV formula injection sanitizer & quote escaper
function toCsvCell(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/\r?\n|\r/g, ' ').trim();
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
}

// Helper: Fetch currently active academic_year_id
async function getActiveAcademicYearId(db = pool) {
    const res = await db.query(
        `SELECT academic_year_id FROM academic_years WHERE is_active = TRUE ORDER BY academic_year_id DESC LIMIT 1`
    );
    if (res.rows.length > 0) return res.rows[0].academic_year_id;
    const fallback = await db.query(`SELECT academic_year_id FROM academic_years ORDER BY academic_year_id DESC LIMIT 1`);
    return fallback.rows[0]?.academic_year_id || null;
}

// Helper: Ensure admin has a default Campus Administration page for direct admin posts
async function getOrCreateAdminPageId(adminUserId) {
    const existing = await pool.query(`SELECT page_id FROM pages ORDER BY page_id ASC LIMIT 1`);
    if (existing.rows.length > 0) return existing.rows[0].page_id;

    const ins = await pool.query(
        `INSERT INTO pages (page_name, page_code, page_description, page_type, created_by, status)
         VALUES ('Office of the Administration', 'ADMIN', 'Official WMSU Administration Portal', 'office', $1, 'Approved')
         RETURNING page_id`,
        [adminUserId]
    );
    return ins.rows[0].page_id;
}

// ============================================================================
// 1. OVERVIEW DASHBOARD (GET /api/admin/overview & GET /api/admin/overview/search)
// ============================================================================
function computeKpiComparison(currentVal, previousVal, hasBaseline, comparisonLabel) {
    const current = Number(currentVal) || 0;
    const previous = Number(previousVal) || 0;
    const delta = current - previous;

    if (!hasBaseline) {
        return {
            current,
            previous,
            delta,
            percentageChange: null,
            trend: 'neutral',
            comparisonLabel: comparisonLabel || 'No prior period'
        };
    }

    if (previous === 0) {
        return {
            current,
            previous: 0,
            delta,
            percentageChange: current === 0 ? 0 : null,
            trend: current > 0 ? 'up' : 'neutral',
            comparisonLabel: comparisonLabel || 'vs prior period'
        };
    }

    const rawPct = ((current - previous) / previous) * 100;
    const roundedPct = Math.round(rawPct * 10) / 10;
    const trend = roundedPct > 0 ? 'up' : roundedPct < 0 ? 'down' : 'neutral';

    return {
        current,
        previous,
        delta,
        percentageChange: roundedPct,
        trend,
        comparisonLabel
    };
}

function parseIsoDateStrict(str) {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(String(str).trim())) return null;
    const d = new Date(`${String(str).trim()}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : String(str).trim();
}

function addDaysIso(isoStr, days) {
    const d = new Date(`${isoStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function formatShortIsoLabel(isoStr) {
    if (!isoStr) return '';
    const d = new Date(`${isoStr}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

router.get('/overview', async (req, res) => {
    try {
        const {
            academicYearId = 'active',
            startDate = '',
            endDate = '',
            activityPage = 1,
            activityLimit = 10,
            activitySearch = ''
        } = req.query;

        const hasStart = Boolean(String(startDate).trim());
        const hasEnd = Boolean(String(endDate).trim());
        let validStart = null;
        let validEnd = null;

        if (hasStart || hasEnd) {
            if (!hasStart || !hasEnd) {
                return res.status(400).json({ message: 'Please provide both Start Date and End Date.' });
            }
            validStart = parseIsoDateStrict(startDate);
            validEnd = parseIsoDateStrict(endDate);
            if (!validStart || !validEnd) {
                return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD.' });
            }
            if (validStart > validEnd) {
                return res.status(400).json({ message: 'Start Date cannot be later than End Date.' });
            }
        }

        // Load all academic years with timezone-safe YYYY-MM-DD strings
        const academicYearsRes = await pool.query(
            `SELECT academic_year_id AS id,
                    start_year,
                    end_year,
                    semester,
                    to_char(COALESCE(start_date, make_date(start_year::int, 8, 1)), 'YYYY-MM-DD') AS start_date,
                    to_char(COALESCE(end_date, make_date(end_year::int, 5, 31)), 'YYYY-MM-DD') AS end_date,
                    is_active,
                    COALESCE(status, CASE WHEN is_active THEN 'Active' ELSE 'Archived' END) AS status,
                    start_year || '–' || end_year || ' (' || semester || ')' AS label
             FROM academic_years
             ORDER BY start_year DESC, academic_year_id DESC`
        );
        const academicYears = academicYearsRes.rows;
        const activeAcademicYear = academicYears.find(y => y.is_active) || academicYears[0] || null;

        let selectedAcademicYear = activeAcademicYear;
        if (academicYearId && academicYearId !== 'active' && academicYearId !== 'all') {
            const matched = academicYears.find(y => String(y.id) === String(academicYearId));
            if (matched) selectedAcademicYear = matched;
        }

        // Determine preceding academic year for school-year baseline comparisons
        let precedingAcademicYear = null;
        if (selectedAcademicYear) {
            const idx = academicYears.findIndex(y => y.id === selectedAcademicYear.id);
            if (idx >= 0 && idx + 1 < academicYears.length) {
                precedingAcademicYear = academicYears[idx + 1];
            }
        }

        const isCustomDateRange = Boolean(validStart && validEnd);
        const syId = selectedAcademicYear ? selectedAcademicYear.id : null;
        const prevSyId = precedingAcademicYear ? precedingAcademicYear.id : null;
        const isSyActive = Boolean(selectedAcademicYear?.is_active);

        // Resolve unified applied date boundaries (seriesStart .. seriesEnd)
        let seriesStart = isCustomDateRange
            ? validStart
            : (selectedAcademicYear?.start_date || (selectedAcademicYear ? `${selectedAcademicYear.start_year}-08-01` : addDaysIso(new Date().toISOString().slice(0, 10), -180)));
        let seriesEnd = isCustomDateRange
            ? validEnd
            : (selectedAcademicYear?.end_date || (selectedAcademicYear ? `${selectedAcademicYear.end_year}-05-31` : new Date().toISOString().slice(0, 10)));

        if (seriesStart > seriesEnd) {
            const tmp = seriesStart;
            seriesStart = seriesEnd;
            seriesEnd = tmp;
        }

        const sMs = new Date(`${seriesStart}T00:00:00.000Z`).getTime();
        const eMs = new Date(`${seriesEnd}T00:00:00.000Z`).getTime();
        const durationDays = Math.max(1, Math.round((eMs - sMs) / 86400000) + 1);

        // Resolve equivalent preceding period boundaries (prevStart .. prevEnd)
        let prevStart = addDaysIso(seriesStart, -durationDays);
        let prevEnd = addDaysIso(seriesStart, -1);
        let comparisonLabel = '';

        if (isCustomDateRange) {
            comparisonLabel = prevStart === prevEnd
                ? `vs ${formatShortIsoLabel(prevStart)}`
                : `vs ${formatShortIsoLabel(prevStart)} – ${formatShortIsoLabel(prevEnd)}`;
        } else if (precedingAcademicYear) {
            prevStart = precedingAcademicYear.start_date || `${precedingAcademicYear.start_year}-08-01`;
            prevEnd = precedingAcademicYear.end_date || `${precedingAcademicYear.end_year}-05-31`;
            comparisonLabel = `vs SY ${precedingAcademicYear.start_year}–${precedingAcademicYear.end_year}`;
        } else {
            comparisonLabel = `vs prior ${durationDays}d`;
        }

        // Timezone-safe inclusive timestamp filter builder
        const buildTzRange = (col, startParamIdx, endParamIdx) =>
            `${col} >= ($${startParamIdx}::date::timestamp AT TIME ZONE 'Asia/Manila') AND ${col} < (($${endParamIdx}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`;

        // 1. KPI Queries (Current Period vs Equivalent Previous Period)
        const syFilterCur = syId
            ? (isSyActive ? 'AND (p.academic_year_id = $3 OR p.academic_year_id IS NULL)' : 'AND p.academic_year_id = $3')
            : '';
        const curParams = syId ? [seriesStart, seriesEnd, syId] : [seriesStart, seriesEnd];

        const prvSyTarget = (!isCustomDateRange && prevSyId) ? prevSyId : syId;
        const syFilterPrv = prvSyTarget
            ? ((!isCustomDateRange && prevSyId)
                ? 'AND p.academic_year_id = $3'
                : (isSyActive ? 'AND (p.academic_year_id = $3 OR p.academic_year_id IS NULL)' : 'AND p.academic_year_id = $3'))
            : '';
        const prvParams = prvSyTarget ? [prevStart, prevEnd, prvSyTarget] : [prevStart, prevEnd];

        const kpiCurrentPromise = pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM posts p WHERE p.post_type = 'announcement' ${syFilterCur} AND ${buildTzRange('p.created_at', 1, 2)}) AS total_announcements,
                (SELECT COUNT(*)::int FROM posts p WHERE p.post_type = 'announcement' AND p.is_archived = FALSE AND LOWER(p.status) = 'published' AND LOWER(p.moderation_status) = 'approved' ${syFilterCur} AND ${buildTzRange('p.created_at', 1, 2)}) AS published_announcements,
                (SELECT COUNT(*)::int FROM posts p WHERE p.post_type = 'event' ${syFilterCur} AND ${buildTzRange('p.created_at', 1, 2)}) AS total_events,
                (SELECT COUNT(*)::int FROM posts p WHERE p.post_type = 'event' AND p.is_archived = FALSE AND LOWER(p.moderation_status) = 'approved' AND LOWER(p.status) IN ('upcoming', 'published', 'ongoing') ${syFilterCur} AND ${buildTzRange('p.created_at', 1, 2)}) AS upcoming_events,
                (SELECT COUNT(*)::int FROM posts p WHERE p.is_archived = FALSE AND LOWER(p.moderation_status) = 'pending' ${syFilterCur} AND ${buildTzRange('p.created_at', 1, 2)}) AS pending_posts,
                (SELECT COUNT(*)::int FROM pages pg WHERE LOWER(pg.status) = 'pending' AND ${buildTzRange('pg.created_at', 1, 2)}) AS pending_pages,
                (SELECT COUNT(*)::int FROM pages pg WHERE LOWER(pg.status) IN ('approved', 'active') AND ${buildTzRange('pg.created_at', 1, 2)}) AS approved_pages,
                (SELECT COUNT(*)::int FROM pages pg WHERE LOWER(pg.status) IN ('approved', 'active')) AS total_active_pages`,
            curParams
        );

        const kpiPrevPromise = pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM posts p WHERE p.post_type = 'announcement' ${syFilterPrv} AND ${buildTzRange('p.created_at', 1, 2)}) AS total_announcements,
                (SELECT COUNT(*)::int FROM posts p WHERE p.post_type = 'event' ${syFilterPrv} AND ${buildTzRange('p.created_at', 1, 2)}) AS total_events,
                (SELECT COUNT(*)::int FROM posts p WHERE p.is_archived = FALSE AND LOWER(p.moderation_status) = 'pending' ${syFilterPrv} AND ${buildTzRange('p.created_at', 1, 2)}) AS pending_posts,
                (SELECT COUNT(*)::int FROM pages pg WHERE LOWER(pg.status) = 'pending' AND ${buildTzRange('pg.created_at', 1, 2)}) AS pending_pages,
                (SELECT COUNT(*)::int FROM pages pg WHERE LOWER(pg.status) IN ('approved', 'active') AND ${buildTzRange('pg.created_at', 1, 2)}) AS approved_pages`,
            prvParams
        );

        const statusDistPromise = pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE p.is_archived = FALSE AND LOWER(p.status) = 'published' AND LOWER(p.moderation_status) = 'approved')::int AS published,
                COUNT(*) FILTER (WHERE p.is_archived = FALSE AND LOWER(p.moderation_status) = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE p.is_archived = FALSE AND LOWER(p.moderation_status) = 'rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE p.is_archived = TRUE OR LOWER(p.status) = 'archived')::int AS archived
             FROM posts p
             WHERE p.post_type = 'announcement' ${syFilterCur} AND ${buildTzRange('p.created_at', 1, 2)}`,
            curParams
        );

        // 2. Analytics Charts (Auto-grouped: hourly == 1d, daily <= 31d, weekly <= 120d, monthly > 120d)
        let grouping = 'monthly';
        if (durationDays === 1) grouping = 'hourly';
        else if (durationDays <= 31) grouping = 'daily';
        else if (durationDays <= 120) grouping = 'weekly';

        const truncUnit = grouping === 'hourly' ? 'hour' : grouping === 'daily' ? 'day' : grouping === 'weekly' ? 'week' : 'month';
        const stepInterval = grouping === 'hourly' ? '1 hour' : grouping === 'daily' ? '1 day' : grouping === 'weekly' ? '1 week' : '1 month';
        const bucketEndExpr = grouping === 'hourly'
            ? `($2::date::timestamp + INTERVAL '23 hours')`
            : `date_trunc('${truncUnit}', $2::date::timestamp)`;
        const keyFormat = grouping === 'hourly' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';

        const pubParams = syId ? [seriesStart, seriesEnd, syId] : [seriesStart, seriesEnd];
        const pubSyClause = syId
            ? (isSyActive ? 'AND (p.academic_year_id = $3 OR p.academic_year_id IS NULL)' : 'AND p.academic_year_id = $3')
            : '';

        const publishingActivityPromise = pool.query(
            `WITH buckets AS (
                SELECT generate_series(
                    date_trunc('${truncUnit}', $1::date::timestamp),
                    ${bucketEndExpr},
                    '${stepInterval}'::interval
                ) AS bucket_start
            )
            SELECT
                to_char(b.bucket_start, '${keyFormat}') AS key,
                CASE
                    WHEN '${grouping}' = 'hourly' THEN to_char(b.bucket_start, 'FMHH12 AM')
                    WHEN '${grouping}' = 'daily' THEN to_char(b.bucket_start, 'Mon DD')
                    WHEN '${grouping}' = 'weekly' THEN 'Wk of ' || to_char(b.bucket_start, 'Mon DD')
                    ELSE to_char(b.bucket_start, 'Mon YYYY')
                END AS label,
                COUNT(p.post_id) FILTER (
                    WHERE p.post_type = 'announcement'
                      ${pubSyClause}
                )::int AS announcements,
                COUNT(p.post_id) FILTER (
                    WHERE p.post_type = 'event'
                      ${pubSyClause}
                )::int AS events
            FROM buckets b
            LEFT JOIN posts p
              ON date_trunc('${truncUnit}', p.created_at AT TIME ZONE 'Asia/Manila') = b.bucket_start
             AND p.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
             AND p.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')
            GROUP BY b.bucket_start
            ORDER BY b.bucket_start ASC`,
            pubParams
        );

        // 2B. User & Page Activity Chart (Students Registered, Staff Assigned, Pages Created over time)
        const userAndPageActivityPromise = pool.query(
            `WITH buckets AS (
                SELECT generate_series(
                    date_trunc('${truncUnit}', $1::date::timestamp),
                    ${bucketEndExpr},
                    '${stepInterval}'::interval
                ) AS bucket_start
            ),
            student_counts AS (
                SELECT date_trunc('${truncUnit}', u.created_at AT TIME ZONE 'Asia/Manila') AS bucket_start,
                       COUNT(*)::int AS cnt
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE LOWER(r.role_name) = 'student'
                  AND u.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
                  AND u.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')
                GROUP BY 1
            ),
            staff_counts AS (
                SELECT date_trunc('${truncUnit}', pm.assigned_at AT TIME ZONE 'Asia/Manila') AS bucket_start,
                       COUNT(*)::int AS cnt
                FROM page_members pm
                WHERE pm.assigned_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
                  AND pm.assigned_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')
                GROUP BY 1
            ),
            page_counts AS (
                SELECT date_trunc('${truncUnit}', pg.created_at AT TIME ZONE 'Asia/Manila') AS bucket_start,
                       COUNT(*)::int AS cnt
                FROM pages pg
                WHERE pg.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
                  AND pg.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')
                GROUP BY 1
            )
            SELECT
                to_char(b.bucket_start, '${keyFormat}') AS key,
                CASE
                    WHEN '${grouping}' = 'hourly' THEN to_char(b.bucket_start, 'FMHH12 AM')
                    WHEN '${grouping}' = 'daily' THEN to_char(b.bucket_start, 'Mon DD')
                    WHEN '${grouping}' = 'weekly' THEN 'Wk of ' || to_char(b.bucket_start, 'Mon DD')
                    ELSE to_char(b.bucket_start, 'Mon YYYY')
                END AS label,
                COALESCE(sc.cnt, 0)::int AS students,
                COALESCE(stc.cnt, 0)::int AS staff,
                COALESCE(pc.cnt, 0)::int AS pages
            FROM buckets b
            LEFT JOIN student_counts sc ON sc.bucket_start = b.bucket_start
            LEFT JOIN staff_counts stc ON stc.bucket_start = b.bucket_start
            LEFT JOIN page_counts pc ON pc.bucket_start = b.bucket_start
            ORDER BY b.bucket_start ASC`,
            [seriesStart, seriesEnd]
        );

        // 3. Combined Recent Administrative Activity Table (Strictly from audit_logs, filtered by the global date range)
        const actPageNum = Math.max(1, parseInt(activityPage, 10) || 1);
        const actLimitNum = Math.min(100, Math.max(5, parseInt(activityLimit, 10) || 10));
        const actOffset = (actPageNum - 1) * actLimitNum;

        const actParams = [seriesStart, seriesEnd];
        const actClauses = [buildTzRange('l.created_at', 1, 2)];

        if (activitySearch && String(activitySearch).trim()) {
            actParams.push(`%${String(activitySearch).trim()}%`);
            actClauses.push(
                `(l.action ILIKE $${actParams.length}
                  OR l.module ILIKE $${actParams.length}
                  OR COALESCE(l.target_type, '') ILIKE $${actParams.length}
                  OR COALESCE(u.first_name || ' ' || u.last_name, '') ILIKE $${actParams.length}
                  OR COALESCE(l.details->>'title', '') ILIKE $${actParams.length})`
            );
        }

        const actWhere = `WHERE ${actClauses.join(' AND ')}`;
        const actCountPromise = pool.query(
            `SELECT COUNT(*)::int AS total
             FROM audit_logs l
             LEFT JOIN users u ON l.actor_user_id = u.user_id
             ${actWhere}`,
            actParams
        );

        const actDataParams = [...actParams, actLimitNum, actOffset];
        const actDataPromise = pool.query(
            `SELECT l.log_id AS id,
                    l.action,
                    l.module,
                    l.target_type,
                    l.target_id,
                    l.outcome,
                    l.details,
                    l.created_at,
                    COALESCE(u.first_name || ' ' || u.last_name, 'System') AS performed_by,
                    COALESCE(l.actor_role, 'system') AS actor_role,
                    tp.title AS target_post_title,
                    tp.post_type AS target_post_type,
                    tpg.page_name AS target_page_name,
                    tu.first_name || ' ' || tu.last_name AS target_user_name,
                    tu.email AS target_user_email,
                    CASE WHEN tay.academic_year_id IS NOT NULL
                         THEN 'SY ' || tay.start_year || '–' || tay.end_year || ' (' || tay.semester || ')'
                         ELSE NULL
                    END AS target_sy_label
             FROM audit_logs l
             LEFT JOIN users u ON l.actor_user_id = u.user_id
             LEFT JOIN posts tp ON LOWER(COALESCE(l.target_type, '')) IN ('post', 'announcement', 'event')
                               AND l.target_id ~ '^[0-9]+$'
                               AND l.target_id::int = tp.post_id
             LEFT JOIN pages tpg ON LOWER(COALESCE(l.target_type, '')) = 'page'
                                AND l.target_id ~ '^[0-9]+$'
                                AND l.target_id::int = tpg.page_id
             LEFT JOIN users tu ON LOWER(COALESCE(l.target_type, '')) IN ('user', 'student', 'staff')
                               AND l.target_id ~ '^[0-9]+$'
                               AND l.target_id::int = tu.user_id
             LEFT JOIN academic_years tay ON LOWER(COALESCE(l.target_type, '')) = 'academic_year'
                                         AND l.target_id ~ '^[0-9]+$'
                                         AND l.target_id::int = tay.academic_year_id
             ${actWhere}
             ORDER BY l.created_at DESC, l.log_id DESC
             LIMIT $${actDataParams.length - 1} OFFSET $${actDataParams.length}`,
            actDataParams
        );

        const [
            kpiCurRes,
            kpiPrvRes,
            statusDistRes,
            pubActRes,
            userPageActRes,
            actCountRes,
            actDataRes
        ] = await Promise.all([
            kpiCurrentPromise,
            kpiPrevPromise,
            statusDistPromise,
            publishingActivityPromise,
            userAndPageActivityPromise,
            actCountPromise,
            actDataPromise
        ]);

        const cur = kpiCurRes.rows[0] || {};
        const prv = kpiPrvRes.rows[0] || null;
        const hasBaseline = true;

        const curPendingTotal = (cur.pending_posts || 0) + (cur.pending_pages || 0);
        const prvPendingTotal = prv ? ((prv.pending_posts || 0) + (prv.pending_pages || 0)) : 0;

        const kpis = {
            totalAnnouncements: {
                ...computeKpiComparison(cur.total_announcements, prv?.total_announcements, hasBaseline, comparisonLabel),
                publishedCount: cur.published_announcements || 0
            },
            totalEvents: {
                ...computeKpiComparison(cur.total_events, prv?.total_events, hasBaseline, comparisonLabel),
                upcomingCount: cur.upcoming_events || 0
            },
            pendingApprovals: {
                ...computeKpiComparison(curPendingTotal, prvPendingTotal, hasBaseline, comparisonLabel),
                pendingPosts: cur.pending_posts || 0,
                pendingPages: cur.pending_pages || 0
            },
            approvedPages: {
                ...computeKpiComparison(cur.approved_pages, prv?.approved_pages, hasBaseline, comparisonLabel),
                totalActivePages: cur.total_active_pages || 0
            }
        };

        const sd = statusDistRes.rows[0] || { published: 0, pending: 0, rejected: 0, archived: 0 };
        const sdTotal = (sd.published || 0) + (sd.pending || 0) + (sd.rejected || 0) + (sd.archived || 0);
        const announcementStatusDistribution = [
            { status: 'Published', count: sd.published || 0, percentage: sdTotal ? Math.round(((sd.published || 0) / sdTotal) * 1000) / 10 : 0 },
            { status: 'Pending', count: sd.pending || 0, percentage: sdTotal ? Math.round(((sd.pending || 0) / sdTotal) * 1000) / 10 : 0 },
            { status: 'Rejected', count: sd.rejected || 0, percentage: sdTotal ? Math.round(((sd.rejected || 0) / sdTotal) * 1000) / 10 : 0 },
            { status: 'Archived', count: sd.archived || 0, percentage: sdTotal ? Math.round(((sd.archived || 0) / sdTotal) * 1000) / 10 : 0 }
        ];

        const mapActivityCategory = (l) => {
            const tt = String(l.target_type || '').toLowerCase();
            const mod = String(l.module || '').toLowerCase();
            if (mod === 'auth' || l.action.toLowerCase().includes('login')) return 'Authentication';
            if (tt.includes('event') || mod.includes('event') || String(l.target_post_type || '').toLowerCase() === 'event') return 'Event';
            if (tt.includes('post') || tt.includes('announcement') || mod.includes('moderation') || mod.includes('content') || mod.includes('archive')) return 'Announcement';
            if (tt.includes('page') || mod.includes('page')) return 'Page';
            if (tt.includes('user') || tt.includes('student') || mod.includes('user')) return 'User';
            if (tt.includes('academic_year') || mod.includes('setting')) return 'School Year';
            return 'System';
        };

        const mapAffectedResource = (l) => {
            const d = l.details && typeof l.details === 'object' ? l.details : {};
            if (d.title) return d.title;
            if (l.target_post_title) return l.target_post_title;
            if (l.target_page_name) return l.target_page_name;
            if (l.target_sy_label) return l.target_sy_label;
            if (l.target_user_name) {
                return l.target_user_email ? `${l.target_user_name} (${l.target_user_email})` : l.target_user_name;
            }
            if (d.page_name) return d.page_name;
            if (d.email) return `Account (${d.email})`;
            if (l.target_type && l.target_id) {
                const cleanType = String(l.target_type).replace(/_/g, ' ');
                return `${cleanType.charAt(0).toUpperCase() + cleanType.slice(1)} #${l.target_id}`;
            }
            if (l.target_type) {
                const cleanType = String(l.target_type).replace(/_/g, ' ');
                return cleanType.charAt(0).toUpperCase() + cleanType.slice(1);
            }
            return 'System Portal';
        };

        const mapActivityRoute = (category) => {
            switch (category) {
                case 'Announcement':
                case 'Event':
                    return '/admin/content-feed';
                case 'Page':
                    return '/admin/pages';
                case 'User':
                case 'Authentication':
                    return '/admin/users';
                case 'School Year':
                    return '/admin/settings?tab=academic-year';
                default:
                    return '/admin/audit-logs';
            }
        };

        const recentActivityItems = actDataRes.rows.map(l => {
            const category = mapActivityCategory(l);
            const affectedResource = mapAffectedResource(l);
            return {
                id: l.id,
                activity: l.action,
                actor: l.performed_by,
                performedBy: l.performed_by,
                actorRole: l.actor_role,
                category,
                recordType: category,
                affectedResource,
                createdAt: l.created_at,
                status: l.outcome === 'SUCCESS' ? 'Completed' : 'Failed',
                outcome: l.outcome,
                route: mapActivityRoute(category)
            };
        });

        const actTotal = actCountRes.rows[0]?.total || 0;
        const actTotalPages = Math.max(1, Math.ceil(actTotal / actLimitNum));

        return res.json({
            reportingPeriod: {
                isCustomDateRange,
                startDate: seriesStart,
                endDate: seriesEnd,
                durationDays,
                prevStartDate: prevStart,
                prevEndDate: prevEnd,
                comparisonLabel
            },
            kpis,
            counts: {
                totalAnnouncements: kpis.totalAnnouncements.current,
                totalEvents: kpis.totalEvents.current,
                pendingApprovals: kpis.pendingApprovals.current,
                approvedPages: kpis.approvedPages.current
            },
            publishingActivity: {
                grouping,
                timestampSource: 'created_at',
                series: pubActRes.rows
            },
            userAndPageActivity: {
                grouping,
                series: userPageActRes.rows
            },
            announcementStatusDistribution,
            recentActivity: {
                items: recentActivityItems,
                pagination: {
                    page: Math.min(actPageNum, actTotalPages),
                    limit: actLimitNum,
                    total: actTotal,
                    totalPages: actTotalPages
                }
            },
            academicYears,
            activeAcademicYear,
            selectedAcademicYear
        });
    } catch (error) {
        console.error('Admin overview error:', error);
        return res.status(500).json({ message: 'Failed to load dashboard overview.' });
    }
});

// Global Administrative Search across Users, Staff, Announcements, Events, Pages, Organizations, and Approvals
router.get('/overview/search', async (req, res) => {
    try {
        const {
            q = '',
            academicYearId = 'active',
            startDate = '',
            endDate = '',
            page = 1,
            limit = 10
        } = req.query;

        const keyword = String(q || '').trim();
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(5, parseInt(limit, 10) || 10));
        const offset = (pageNum - 1) * limitNum;

        if (!keyword) {
            return res.json({
                items: [],
                pagination: { page: 1, limit: limitNum, total: 0, totalPages: 1 }
            });
        }

        const hasStart = Boolean(String(startDate).trim());
        const hasEnd = Boolean(String(endDate).trim());
        let validStart = null;
        let validEnd = null;
        if (hasStart || hasEnd) {
            validStart = parseIsoDateStrict(startDate);
            validEnd = parseIsoDateStrict(endDate);
            if (!validStart || !validEnd || validStart > validEnd) {
                return res.status(400).json({ message: 'Invalid date range for search.' });
            }
        }

        let resolvedSyId = null;
        if (academicYearId === 'active') {
            resolvedSyId = await getActiveAcademicYearId();
        } else if (academicYearId && academicYearId !== 'all') {
            resolvedSyId = Number(academicYearId);
        }

        const params = [`%${keyword}%`]; // $1 = search pattern
        let syClause = '';
        if (resolvedSyId) {
            params.push(resolvedSyId);
            syClause = `AND p.academic_year_id = $${params.length}`;
        }

        let dateClausePosts = '';
        let dateClauseUsers = '';
        let dateClausePages = '';
        let dateClauseOrgs = '';
        if (validStart && validEnd) {
            params.push(validStart, validEnd);
            const sIdx = params.length - 1;
            const eIdx = params.length;
            dateClausePosts = `AND p.created_at >= ($${sIdx}::date::timestamp AT TIME ZONE 'Asia/Manila') AND p.created_at < (($${eIdx}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`;
            dateClauseUsers = `AND u.created_at >= ($${sIdx}::date::timestamp AT TIME ZONE 'Asia/Manila') AND u.created_at < (($${eIdx}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`;
            dateClausePages = `AND pg.created_at >= ($${sIdx}::date::timestamp AT TIME ZONE 'Asia/Manila') AND pg.created_at < (($${eIdx}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`;
            dateClauseOrgs = `AND o.created_at >= ($${sIdx}::date::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < (($${eIdx}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`;
        }

        const unionSql = `
            SELECT * FROM (
                -- 1. Student accounts
                SELECT 'Student' AS category,
                       u.user_id::text AS id,
                       u.first_name || ' ' || u.last_name AS title,
                       COALESCE(sp.student_number, 'No ID') || ' • ' || u.email AS subtitle,
                       COALESCE(sp.verification_status, u.account_status) AS status,
                       u.created_at AS record_date,
                       '/admin/users?tab=all' AS route
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                WHERE LOWER(r.role_name) = 'student'
                  AND ((u.first_name || ' ' || u.last_name) ILIKE $1 OR u.email ILIKE $1 OR COALESCE(sp.student_number, '') ILIKE $1)
                  ${dateClauseUsers}

                UNION ALL

                -- 2. Staff accounts
                SELECT 'Staff' AS category,
                       u.user_id::text AS id,
                       u.first_name || ' ' || u.last_name AS title,
                       u.email || ' • Staff Account' AS subtitle,
                       u.account_status AS status,
                       u.created_at AS record_date,
                       '/admin/users?tab=staff' AS route
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
                WHERE (LOWER(r.role_name) = 'staff' OR EXISTS (SELECT 1 FROM page_members pm WHERE pm.user_id = u.user_id AND LOWER(pm.status) = 'active'))
                  AND ((u.first_name || ' ' || u.last_name) ILIKE $1 OR u.email ILIKE $1)
                  ${dateClauseUsers}

                UNION ALL

                -- 3. Announcements
                SELECT 'Announcement' AS category,
                       p.post_id::text AS id,
                       p.title,
                       COALESCE(pg.page_name, 'Campus Page') || ' • ' || p.audience AS subtitle,
                       CASE WHEN p.is_archived THEN 'Archived' ELSE p.status END AS status,
                       COALESCE(p.published_at, p.created_at) AS record_date,
                       '/admin/content-feed?tab=announcements' AS route
                FROM posts p
                LEFT JOIN pages pg ON p.page_id = pg.page_id
                WHERE p.post_type = 'announcement'
                  AND (p.title ILIKE $1 OR p.content ILIKE $1 OR COALESCE(pg.page_name, '') ILIKE $1)
                  ${syClause} ${dateClausePosts}

                UNION ALL

                -- 4. Events
                SELECT 'Event' AS category,
                       p.post_id::text AS id,
                       p.title,
                       COALESCE(pg.page_name, 'Campus Page') || COALESCE(' • ' || ed.location, '') AS subtitle,
                       CASE WHEN p.is_archived THEN 'Archived' ELSE p.status END AS status,
                       COALESCE(ed.event_date, p.created_at) AS record_date,
                       '/admin/content-feed?tab=events' AS route
                FROM posts p
                LEFT JOIN event_details ed ON p.post_id = ed.post_id
                LEFT JOIN pages pg ON p.page_id = pg.page_id
                WHERE p.post_type = 'event'
                  AND (p.title ILIKE $1 OR p.content ILIKE $1 OR COALESCE(ed.location, '') ILIKE $1 OR COALESCE(pg.page_name, '') ILIKE $1)
                  ${syClause} ${dateClausePosts}

                UNION ALL

                -- 5. Pages
                SELECT 'Page' AS category,
                       pg.page_id::text AS id,
                       pg.page_name AS title,
                       COALESCE(pg.page_code, '') || ' • ' || INITCAP(pg.page_type) AS subtitle,
                       pg.status,
                       pg.created_at AS record_date,
                       '/admin/pages' AS route
                FROM pages pg
                WHERE (pg.page_name ILIKE $1 OR COALESCE(pg.page_code, '') ILIKE $1 OR COALESCE(pg.page_description, '') ILIKE $1)
                  ${dateClausePages}

                UNION ALL

                -- 6. Organizations
                SELECT 'Organization' AS category,
                       o.organization_id::text AS id,
                       o.organization_name AS title,
                       o.org_code || ' • ' || o.org_type AS subtitle,
                       o.status,
                       o.created_at AS record_date,
                       '/admin/pages' AS route
                FROM organizations o
                WHERE (o.organization_name ILIKE $1 OR o.org_code ILIKE $1 OR COALESCE(o.description, '') ILIKE $1)
                  ${dateClauseOrgs}

                UNION ALL

                -- 7. Pending Approvals (Posts awaiting review)
                SELECT 'Approval' AS category,
                       'post-' || p.post_id::text AS id,
                       p.title,
                       'Pending ' || INITCAP(p.post_type) || ' • ' || COALESCE(pg.page_name, 'Campus Page') AS subtitle,
                       p.moderation_status AS status,
                       p.created_at AS record_date,
                       '/admin/post-approval?tab=pending' AS route
                FROM posts p
                LEFT JOIN pages pg ON p.page_id = pg.page_id
                WHERE LOWER(p.moderation_status) IN ('pending', 'correction')
                  AND p.is_archived = FALSE
                  AND (p.title ILIKE $1 OR p.content ILIKE $1 OR COALESCE(pg.page_name, '') ILIKE $1)
                  ${syClause} ${dateClausePosts}
            ) combined_search
        `;

        const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM (${unionSql}) cnt_tbl`, params);
        const total = countRes.rows[0]?.total || 0;

        const pagedParams = [...params, limitNum, offset];
        const itemsRes = await pool.query(
            `${unionSql} ORDER BY record_date DESC NULLS LAST LIMIT $${pagedParams.length - 1} OFFSET $${pagedParams.length}`,
            pagedParams
        );

        return res.json({
            items: itemsRes.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Admin overview search error:', error);
        return res.status(500).json({ message: 'Failed to execute administrative search.' });
    }
});

// ============================================================================
// 2. CONTENT FEED (GET / POST / PUT / PATCH / DELETE /api/admin/content-feed)
// ============================================================================
router.get('/content-feed', async (req, res) => {
    try {
        const {
            tab = 'all',
            search = '',
            category = 'all',
            college = 'all',
            status = 'all',
            academicYearId = 'all',
            eventDate = '',
            organizer = '',
            sort = 'newest',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = [];

        const normTab = String(tab).toLowerCase();
        if (normTab === 'archived') {
            clauses.push(`(p.is_archived = TRUE OR LOWER(p.status) = 'archived')`);
        } else if (normTab === 'takedown') {
            clauses.push(`p.is_archived = FALSE AND (LOWER(p.status) = 'rejected' OR LOWER(p.moderation_status) = 'rejected')`);
        } else if (normTab === 'scheduled') {
            clauses.push(`p.is_archived = FALSE AND (LOWER(p.status) = 'scheduled' OR (p.published_at IS NOT NULL AND p.published_at > NOW()))`);
        } else {
            clauses.push(`p.is_archived = FALSE`);
            if (normTab === 'announcements' || normTab === 'announcement') {
                clauses.push(`p.post_type = 'announcement'`);
            } else if (normTab === 'events' || normTab === 'event') {
                clauses.push(`p.post_type = 'event'`);
            }
        }

        if (category && category !== 'all') {
            params.push(category);
            clauses.push(`LOWER(pc.category_name) = LOWER($${params.length})`);
        }

        if (college && college !== 'all') {
            params.push(college);
            clauses.push(`(LOWER(d.department_name) = LOWER($${params.length}) OR LOWER(d.department_code) = LOWER($${params.length}) OR LOWER(pg.page_name) = LOWER($${params.length}) OR d.department_id::text = $${params.length})`);
        }

        if (status && status !== 'all') {
            params.push(status);
            clauses.push(`(LOWER(p.status) = LOWER($${params.length}) OR LOWER(p.moderation_status) = LOWER($${params.length}))`);
        }

        if (academicYearId && academicYearId !== 'all') {
            params.push(Number(academicYearId));
            clauses.push(`p.academic_year_id = $${params.length}`);
        }

        if (eventDate && String(eventDate).trim()) {
            params.push(String(eventDate).trim());
            clauses.push(`(DATE(ed.event_date) = DATE($${params.length}) OR DATE(p.created_at) = DATE($${params.length}))`);
        }

        if (organizer && String(organizer).trim()) {
            params.push(`%${String(organizer).trim()}%`);
            clauses.push(`(ed.organizer_info ILIKE $${params.length} OR pg.page_name ILIKE $${params.length} OR (u.first_name || ' ' || u.last_name) ILIKE $${params.length})`);
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR p.content ILIKE $${params.length} OR pg.page_name ILIKE $${params.length} OR COALESCE(ed.organizer_info, '') ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? clauses.join(' AND ') : '1=1';
        const orderSql = sort === 'oldest' ? 'p.created_at ASC' : 'p.created_at DESC';

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN users u ON p.creator_user_id = u.user_id
             WHERE ${whereSql}`,
            params
        );
        const total = countRes.rows[0].total;

        params.push(limitNum, offset);
        const dataRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_type AS type,
                    p.title,
                    p.content AS description,
                    p.content AS body,
                    COALESCE(pc.category_name, 'General') AS category,
                    p.audience,
                    p.status,
                    p.moderation_status,
                    p.is_pinned,
                    p.is_archived,
                    p.archive_reason,
                    p.image_url,
                    p.published_at AS scheduled_at,
                    p.expires_at,
                    p.created_at,
                    p.academic_year_id,
                    CASE WHEN ay.academic_year_id IS NOT NULL
                         THEN ay.start_year || '–' || ay.end_year || ' (' || ay.semester || ')'
                         ELSE NULL END AS academic_year_label,
                    pg.page_id,
                    COALESCE(pg.page_name, 'University Administration') AS page_name,
                    COALESCE(pg.page_name, 'University Administration') AS source_page,
                    COALESCE(d.department_name, pg.page_name, 'University-Wide') AS department_name,
                    COALESCE(d.department_code, pg.page_code, 'WMSU') AS department_code,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS author_name,
                    ed.event_date AS event_start,
                    ed.end_date AS event_end,
                    ed.location AS venue,
                    ed.location,
                    COALESCE(ed.organizer_info, pg.page_name, 'University Administration') AS organizer,
                    ed.registration_deadline AS reg_deadline,
                    ed.capacity,
                    (SELECT COUNT(*)::int FROM event_registrations er WHERE er.event_post_id = p.post_id) AS registered_count,
                    (SELECT COUNT(*)::int FROM event_attendance_records ar JOIN event_registrations er2 ON ar.registration_id = er2.registration_id WHERE er2.event_post_id = p.post_id AND UPPER(ar.status) IN ('PRESENT', 'LATE')) AS attended_count
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN users u ON p.creator_user_id = u.user_id
             LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
             WHERE ${whereSql}
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const [collegesRes, yearsRes] = await Promise.all([
            pool.query(`SELECT department_name FROM departments ORDER BY department_name ASC`),
            pool.query(
                `SELECT academic_year_id AS id,
                        start_year || '–' || end_year || ' (' || semester || ')' AS label,
                        is_active,
                        status
                 FROM academic_years
                 ORDER BY is_active DESC, start_year DESC, academic_year_id DESC`
            )
        ]);

        return res.json({
            items: dataRes.rows,
            colleges: collegesRes.rows.map(r => r.department_name),
            academicYears: yearsRes.rows,
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Content feed error:', error);
        return res.status(500).json({ message: 'Failed to load content feed.' });
    }
});

router.get('/content-feed/:id/engagement', async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const [regRes, sessRes] = await Promise.all([
            pool.query(
                `SELECT er.registration_id AS id,
                        er.status AS registration_status,
                        er.registered_at,
                        u.first_name || ' ' || u.last_name AS student_name,
                        u.email,
                        COALESCE(sp.student_number, 'N/A') AS student_number,
                        COALESCE(d.department_code, 'WMSU') AS college,
                        ar.status AS attendance_status,
                        ar.checkin_time,
                        ar.check_in_method
                 FROM event_registrations er
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 LEFT JOIN departments d ON sp.department_id = d.department_id
                 LEFT JOIN event_attendance_records ar ON er.registration_id = ar.registration_id
                 WHERE er.event_post_id = $1
                 ORDER BY er.registered_at DESC`,
                [postId]
            ),
            pool.query(
                `SELECT session_id, status, open_time AS opened_at, close_time AS closed_at
                 FROM event_attendance_sessions
                 WHERE event_post_id = $1
                 ORDER BY open_time DESC NULLS LAST, session_id DESC LIMIT 1`,
                [postId]
            )
        ]);

        return res.json({
            registrations: regRes.rows,
            session: sessRes.rows[0] || null,
            summary: {
                totalRegistered: regRes.rowCount,
                totalAttended: regRes.rows.filter(r => ['PRESENT', 'LATE'].includes(String(r.attendance_status || '').toUpperCase())).length
            }
        });
    } catch (error) {
        console.error('Event engagement fetch error:', error);
        return res.status(500).json({ message: 'Failed to load event registration and attendance details.' });
    }
});

router.post('/content-feed', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            type = 'announcement',
            title,
            description,
            body,
            category = 'General',
            audience = 'All Campus',
            expires_at,
            event_start,
            event_end,
            venue,
            organizer,
            reg_deadline,
            capacity,
            academic_year_id
        } = req.body;

        const postType = String(type).toLowerCase() === 'event' ? 'event' : 'announcement';
        const contentText = description || body || '';

        if (!title || !contentText) {
            return res.status(400).json({ message: 'Title and description are required.' });
        }

        await client.query('BEGIN');

        const pageId = await getOrCreateAdminPageId(req.user.user_id);
        const activeAyId = academic_year_id ? Number(academic_year_id) : await getActiveAcademicYearId(client);
        const catRes = await client.query(
            `SELECT category_id FROM post_categories WHERE LOWER(category_name) = LOWER($1) LIMIT 1`,
            [category]
        );
        const categoryId = catRes.rows[0]?.category_id || 1;

        const postIns = await client.query(
            `INSERT INTO posts (
                page_id, creator_user_id, category_id, academic_year_id, post_type,
                title, content, audience, expires_at,
                moderation_status, status, published_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Approved', $10, NOW())
             RETURNING *`,
            [
                pageId,
                req.user.user_id,
                categoryId,
                activeAyId,
                postType,
                title.trim(),
                contentText.trim(),
                audience,
                expires_at || null,
                postType === 'event' ? 'Upcoming' : 'Published'
            ]
        );
        const postRow = postIns.rows[0];

        if (postType === 'event') {
            await client.query(
                `INSERT INTO event_details (
                    post_id, event_date, end_date, location, organizer_info, capacity, registration_deadline
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    postRow.post_id,
                    event_start || new Date().toISOString(),
                    event_end || null,
                    venue || 'University Campus',
                    organizer || null,
                    capacity ? Number(capacity) : null,
                    reg_deadline || null
                ]
            );
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Admin Created ${postType}`,
            module: 'posts',
            targetType: postType,
            targetId: postRow.post_id,
            details: { title, academic_year_id: activeAyId }
        });

        return res.status(201).json({ message: 'Post created successfully.', item: postRow });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Admin create content error:', error);
        return res.status(500).json({ message: 'Failed to create content.' });
    } finally {
        client.release();
    }
});

router.put('/content-feed/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const postId = Number(req.params.id);
        const {
            title,
            description,
            body,
            category,
            audience,
            expires_at,
            event_start,
            event_end,
            venue,
            organizer,
            reg_deadline,
            capacity
        } = req.body;

        await client.query('BEGIN');

        let categoryId = null;
        if (category) {
            const catRes = await client.query(
                `SELECT category_id FROM post_categories WHERE LOWER(category_name) = LOWER($1) LIMIT 1`,
                [category]
            );
            categoryId = catRes.rows[0]?.category_id || null;
        }

        const postUpd = await client.query(
            `UPDATE posts
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 category_id = COALESCE($3, category_id),
                 audience = COALESCE($4, audience),
                 expires_at = COALESCE($5, expires_at),
                 updated_at = NOW()
             WHERE post_id = $6
             RETURNING *`,
            [title || null, description || body || null, categoryId, audience || null, expires_at || null, postId]
        );

        if (postUpd.rows[0]?.post_type === 'event') {
            await client.query(
                `UPDATE event_details
                 SET event_date = COALESCE($1, event_date),
                     end_date = COALESCE($2, end_date),
                     location = COALESCE($3, location),
                     organizer_info = COALESCE($4, organizer_info),
                     capacity = COALESCE($5, capacity),
                     registration_deadline = COALESCE($6, registration_deadline)
                 WHERE post_id = $7`,
                [
                    event_start || null,
                    event_end || null,
                    venue || null,
                    organizer || null,
                    capacity ? Number(capacity) : null,
                    reg_deadline || null,
                    postId
                ]
            );
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Admin Edited Post`,
            module: 'posts',
            targetType: 'post',
            targetId: postId,
            details: { title: postUpd.rows[0]?.title }
        });

        return res.json({ message: 'Content updated successfully.', item: postUpd.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Admin update content error:', error);
        return res.status(500).json({ message: 'Failed to update content.' });
    } finally {
        client.release();
    }
});

const handleContentStatus = async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const { status, action, reason } = req.body;
        const targetAction = String(action || status || '').toLowerCase();

        if (targetAction === 'archive' || targetAction === 'archived') {
            await pool.query(
                `UPDATE posts
                 SET previous_status = CASE WHEN status != 'Archived' THEN status ELSE previous_status END,
                     is_archived = TRUE,
                     status = 'Archived',
                     archived_at = NOW(),
                     archived_by = $1,
                     archive_reason = $2,
                     updated_at = NOW()
                 WHERE post_id = $3`,
                [req.user.user_id, reason || 'Administrative Archive', postId]
            );
        } else if (targetAction === 'takedown' || targetAction === 'rejected') {
            await pool.query(
                `UPDATE posts
                 SET previous_status = CASE WHEN status != 'Rejected' THEN status ELSE previous_status END,
                     status = 'Rejected',
                     moderation_status = 'Rejected',
                     archive_reason = COALESCE($1, archive_reason),
                     updated_at = NOW()
                 WHERE post_id = $2`,
                [reason || 'Administrative Takedown', postId]
            );
            await pool.query(
                `INSERT INTO post_moderation_logs (post_id, reviewer_user_id, decision, reason)
                 VALUES ($1, $2, 'takedown', $3)`,
                [postId, req.user.user_id, reason || 'Administrative Takedown']
            );
        } else if (targetAction === 'restore' || targetAction === 'published') {
            await pool.query(
                `UPDATE posts
                 SET is_archived = FALSE,
                     status = COALESCE(NULLIF(previous_status, 'Archived'), CASE WHEN post_type = 'event' THEN 'Upcoming' ELSE 'Published' END),
                     moderation_status = 'Approved',
                     archived_at = NULL,
                     updated_at = NOW()
                 WHERE post_id = $1`,
                [postId]
            );
        } else {
            const newStatus = status || 'Published';
            await pool.query(
                `UPDATE posts SET status = $1, is_archived = FALSE, updated_at = NOW() WHERE post_id = $2`,
                [newStatus, postId]
            );
        }

        await logAudit(req, {
            action: `Updated Post Status (${targetAction || status})`,
            module: 'posts',
            targetType: 'post',
            targetId: postId,
            details: { action: targetAction || status, reason }
        });

        return res.json({ message: 'Content status updated successfully.' });
    } catch (error) {
        console.error('Content status error:', error);
        return res.status(500).json({ message: 'Failed to update content status.' });
    }
};
router.patch('/content-feed/:id/status', handleContentStatus);
router.put('/content-feed/:id/status', handleContentStatus);
router.post('/content-feed/:id/status', handleContentStatus);

router.delete('/content-feed/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const postId = Number(req.params.id);
        const reason = req.body?.reason || req.query?.reason || 'Permanent administrative deletion';

        await client.query('BEGIN');
        const check = await client.query(`SELECT post_id, title, post_type FROM posts WHERE post_id = $1`, [postId]);
        if (check.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found.' });
        }

        const deletedPost = check.rows[0];
        await client.query(`DELETE FROM posts WHERE post_id = $1`, [postId]);
        await client.query('COMMIT');

        await logAudit(req, {
            action: `Permanently Deleted ${deletedPost.post_type}`,
            module: 'posts',
            targetType: deletedPost.post_type,
            targetId: postId,
            details: { title: deletedPost.title, reason }
        });

        return res.json({ message: 'Record permanently deleted.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Delete content error:', error);
        return res.status(500).json({ message: 'Failed to delete content.' });
    } finally {
        client.release();
    }
});

// ============================================================================
// 3. USER MANAGEMENT, STUDENT VERIFICATION & STAFF ACCESS
// ============================================================================
router.get('/users', async (req, res) => {
    try {
        const {
            tab = 'all',
            search = '',
            role = 'all',
            status = 'all',
            college = 'all',
            sort = 'newest',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const collegesRes = await pool.query(
            `SELECT department_id AS id, department_name AS name, department_code AS code
             FROM departments
             WHERE LOWER(status) = 'active'
             ORDER BY department_name ASC`
        );

        if (tab === 'verification') {
            const params = [];
            const clauses = [];

            if (status && status !== 'all') {
                params.push(status);
                clauses.push(`LOWER(sp.verification_status) = LOWER($${params.length})`);
            }
            if (college && college !== 'all') {
                params.push(college);
                clauses.push(`(LOWER(d.department_name) = LOWER($${params.length}) OR LOWER(d.department_code) = LOWER($${params.length}) OR d.department_id::text = $${params.length})`);
            }
            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                clauses.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR sp.student_number ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const countRes = await pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM student_profiles sp
                 JOIN users u ON sp.user_id = u.user_id
                 LEFT JOIN departments d ON sp.department_id = d.department_id
                 ${whereSql}`,
                params
            );
            const total = countRes.rows[0].total;

            params.push(limitNum, offset);
            const rowsRes = await pool.query(
                `SELECT u.user_id AS id,
                        u.first_name,
                        u.last_name,
                        u.first_name || ' ' || u.last_name AS full_name,
                        u.email,
                        sp.student_number AS student_id,
                        d.department_name AS college,
                        d.department_code AS college_code,
                        pr.program_name AS program,
                        sp.year_level,
                        (sp.cor_image IS NOT NULL) AS has_cor_image,
                        (sp.student_id_image IS NOT NULL) AS has_student_id_image,
                        CASE WHEN sp.cor_image IS NOT NULL
                             THEN 'data:' || COALESCE(sp.cor_mime_type, 'image/jpeg') || ';base64,' || encode(sp.cor_image, 'base64')
                             ELSE NULL END AS cor_image_data,
                        CASE WHEN sp.student_id_image IS NOT NULL
                             THEN 'data:' || COALESCE(sp.student_id_mime_type, 'image/jpeg') || ';base64,' || encode(sp.student_id_image, 'base64')
                             ELSE NULL END AS student_id_image_data,
                        sp.verification_status AS status,
                        sp.verification_remarks,
                        sp.verified_at,
                        u.created_at
                 FROM student_profiles sp
                 JOIN users u ON sp.user_id = u.user_id
                 LEFT JOIN departments d ON sp.department_id = d.department_id
                 LEFT JOIN programs pr ON sp.program_id = pr.program_id
                 ${whereSql}
                 ORDER BY ${sort === 'oldest' ? 'u.created_at ASC' : 'u.created_at DESC'}
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            return res.json({
                verifications: rowsRes.rows,
                colleges: collegesRes.rows,
                pagination: {
                    page: pageNum,
                    currentPage: pageNum,
                    limit: limitNum,
                    total,
                    totalRecords: total,
                    totalPages: Math.max(1, Math.ceil(total / limitNum))
                }
            });
        }

        if (tab === 'staff') {
            const staffParams = [];
            const staffClauses = [`LOWER(pm.status) = 'active'`];

            if (search && search.trim()) {
                staffParams.push(`%${search.trim()}%`);
                staffClauses.push(`(u.first_name ILIKE $${staffParams.length} OR u.last_name ILIKE $${staffParams.length} OR u.email ILIKE $${staffParams.length} OR pg.page_name ILIKE $${staffParams.length})`);
            }

            const staffWhere = `WHERE ${staffClauses.join(' AND ')}`;
            const countStaffRes = await pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM page_members pm
                 JOIN users u ON pm.user_id = u.user_id
                 JOIN pages pg ON pm.page_id = pg.page_id
                 ${staffWhere}`,
                staffParams
            );
            const totalStaff = countStaffRes.rows[0].total;

            staffParams.push(limitNum, offset);
            const [staffRes, eligibleRes, pagesRes] = await Promise.all([
                pool.query(
                    `SELECT pm.page_member_id AS id,
                            pm.user_id,
                            pm.page_id,
                            pm.role_on_page AS role_scope,
                            pm.status,
                            pm.assigned_at,
                            u.first_name,
                            u.last_name,
                            u.first_name || ' ' || u.last_name AS full_name,
                            u.email,
                            pg.page_name
                     FROM page_members pm
                     JOIN users u ON pm.user_id = u.user_id
                     JOIN pages pg ON pm.page_id = pg.page_id
                     ${staffWhere}
                     ORDER BY pm.assigned_at DESC
                     LIMIT $${staffParams.length - 1} OFFSET $${staffParams.length}`,
                    staffParams
                ),
                pool.query(
                    `SELECT u.user_id AS id,
                            u.first_name,
                            u.last_name,
                            u.first_name || ' ' || u.last_name AS full_name,
                            u.email,
                            r.role_name,
                            sp.student_number AS student_id
                     FROM users u
                     JOIN roles r ON u.role_id = r.role_id
                     LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                     WHERE LOWER(u.account_status) = 'active'
                     ORDER BY u.first_name ASC`
                ),
                pool.query(
                    `SELECT page_id AS id, page_name AS name FROM pages ORDER BY page_name ASC`
                )
            ]);

            return res.json({
                staff: staffRes.rows,
                eligibleUsers: eligibleRes.rows,
                availablePages: pagesRes.rows,
                colleges: collegesRes.rows,
                pagination: {
                    page: pageNum,
                    currentPage: pageNum,
                    limit: limitNum,
                    total: totalStaff,
                    totalRecords: totalStaff,
                    totalPages: Math.max(1, Math.ceil(totalStaff / limitNum))
                }
            });
        }

        // Default: tab === 'all'
        const params = [];
        const clauses = [];

        if (role && role !== 'all') {
            params.push(role);
            clauses.push(`LOWER(r.role_name) = LOWER($${params.length})`);
        }
        if (status && status !== 'all') {
            params.push(status);
            clauses.push(`(LOWER(u.account_status) = LOWER($${params.length}) OR LOWER(sp.verification_status) = LOWER($${params.length}))`);
        }
        if (college && college !== 'all') {
            params.push(college);
            clauses.push(`(LOWER(d.department_name) = LOWER($${params.length}) OR LOWER(d.department_code) = LOWER($${params.length}) OR d.department_id::text = $${params.length})`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR sp.student_number ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const orderSql = sort === 'oldest' ? 'u.created_at ASC' : 'u.created_at DESC';

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             ${whereSql}`,
            params
        );
        const total = countRes.rows[0].total;

        params.push(limitNum, offset);
        const usersRes = await pool.query(
            `SELECT u.user_id AS id,
                    u.user_id,
                    u.first_name,
                    u.last_name,
                    u.first_name || ' ' || u.last_name AS full_name,
                    u.email,
                    u.account_status AS status,
                    u.account_status,
                    u.is_email_verified,
                    u.created_at,
                    r.role_id,
                    r.role_name AS role,
                    sp.student_number AS student_id,
                    sp.year_level,
                    sp.verification_status,
                    (sp.cor_image IS NOT NULL) AS has_cor_image,
                    (sp.student_id_image IS NOT NULL) AS has_student_id_image,
                    CASE WHEN sp.cor_image IS NOT NULL
                         THEN 'data:' || COALESCE(sp.cor_mime_type, 'image/jpeg') || ';base64,' || encode(sp.cor_image, 'base64')
                         ELSE NULL END AS cor_image_data,
                    CASE WHEN sp.student_id_image IS NOT NULL
                         THEN 'data:' || COALESCE(sp.student_id_mime_type, 'image/jpeg') || ';base64,' || encode(sp.student_id_image, 'base64')
                         ELSE NULL END AS student_id_image_data,
                    d.department_name AS college,
                    d.department_code AS college_code,
                    pr.program_name AS program
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             LEFT JOIN departments d ON sp.department_id = d.department_id
             LEFT JOIN programs pr ON sp.program_id = pr.program_id
             ${whereSql}
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            users: usersRes.rows,
            colleges: collegesRes.rows,
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Admin users error:', error);
        return res.status(500).json({ message: 'Failed to fetch user management records.' });
    }
});

const handleVerifyStudent = async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const { decision, status, reason, remarks } = req.body;
        const normalizedDecision = String(decision || status || 'Verified').toLowerCase();

        let finalVerifStatus = 'Verified';
        if (normalizedDecision.startsWith('reject')) {
            finalVerifStatus = 'Rejected';
        } else if (normalizedDecision.includes('correction') || normalizedDecision === 'pending') {
            finalVerifStatus = 'Pending';
        }

        await pool.query(
            `UPDATE student_profiles
             SET verification_status = $1,
                 verified_by = $2,
                 verified_at = NOW(),
                 verification_remarks = $3,
                 updated_at = NOW()
             WHERE user_id = $4`,
            [finalVerifStatus, req.user.user_id, reason || remarks || null, targetUserId]
        );

        if (finalVerifStatus === 'Verified') {
            await pool.query(
                `UPDATE users SET account_status = 'Active', is_email_verified = TRUE, updated_at = NOW() WHERE user_id = $1`,
                [targetUserId]
            );
        }

        const notifTitle =
            finalVerifStatus === 'Verified'
                ? 'Student Verification Approved'
                : finalVerifStatus === 'Rejected'
                ? 'Student Verification Rejected'
                : 'Student Verification Requires Correction';
        const notifMsg =
            finalVerifStatus === 'Verified'
                ? 'Your student profile has been verified by the administration.'
                : `Your student verification status was updated: ${reason || remarks || 'Please re-check your uploaded COR and Student ID documents.'}`;

        await pool.query(
            `INSERT INTO notifications (recipient_user_id, actor_user_id, notification_scope, type, title, message)
             VALUES ($1, $2, 'student', 'verification', $3, $4)`,
            [targetUserId, req.user.user_id, notifTitle, notifMsg]
        );

        await logAudit(req, {
            action: `Student Verification ${finalVerifStatus}`,
            module: 'users',
            targetType: 'user',
            targetId: targetUserId,
            details: { status: finalVerifStatus, reason: reason || remarks }
        });

        return res.json({ message: `Student verification marked as ${finalVerifStatus}.`, status: finalVerifStatus });
    } catch (error) {
        console.error('Verify student error:', error);
        return res.status(500).json({ message: 'Failed to verify student.' });
    }
};
router.post('/users/:id/verify', handleVerifyStudent);
router.put('/users/:id/verify', handleVerifyStudent);
router.patch('/users/:id/verify', handleVerifyStudent);

const handleUserAccountStatus = async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const { status, action, role, reason } = req.body;

        if (targetUserId === req.user.user_id && String(status || action || '').toLowerCase() === 'suspended') {
            return res.status(400).json({ message: 'You cannot suspend your own administrator account.' });
        }

        const norm = String(status || action || 'Active').toLowerCase();
        let nextAccountStatus = 'Active';
        if (norm.includes('suspend') || norm.includes('deactivate')) nextAccountStatus = 'Suspended';
        else if (norm.includes('archive')) nextAccountStatus = 'Archived';
        else if (norm.includes('pend')) nextAccountStatus = 'Pending';

        await pool.query(
            `UPDATE users SET account_status = $1, updated_at = NOW() WHERE user_id = $2`,
            [nextAccountStatus, targetUserId]
        );

        if (role && ['student', 'staff', 'admin'].includes(String(role).toLowerCase())) {
            await pool.query(
                `UPDATE users
                 SET role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = LOWER($1) LIMIT 1)
                 WHERE user_id = $2`,
                [String(role).toLowerCase(), targetUserId]
            );
        }

        await logAudit(req, {
            action: `Updated User Account Status (${nextAccountStatus})`,
            module: 'users',
            targetType: 'user',
            targetId: targetUserId,
            details: { status: nextAccountStatus, role, reason }
        });

        return res.json({ message: `User account marked as ${nextAccountStatus}.`, status: nextAccountStatus });
    } catch (error) {
        console.error('Update user account status error:', error);
        return res.status(500).json({ message: 'Failed to update user account status.' });
    }
};
router.patch('/users/:id/status', handleUserAccountStatus);
router.put('/users/:id/status', handleUserAccountStatus);
router.post('/users/:id/status', handleUserAccountStatus);

router.post('/staff-access', async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId, pageId, roleScope = 'Editor' } = req.body;
        if (!userId || !pageId) {
            return res.status(400).json({ message: 'userId and pageId are required.' });
        }

        await client.query('BEGIN');

        await client.query(
            `UPDATE users
             SET role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1)
             WHERE user_id = $1 AND role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1)`,
            [Number(userId)]
        );

        const ins = await client.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'Active')
             ON CONFLICT (page_id, user_id)
             DO UPDATE SET role_on_page = EXCLUDED.role_on_page, status = 'Active', assigned_at = NOW()
             RETURNING *`,
            [Number(pageId), Number(userId), roleScope, req.user.user_id]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: 'Granted Page Staff Access',
            module: 'users',
            targetType: 'page_member',
            targetId: ins.rows[0].page_member_id,
            details: { userId, pageId, roleScope }
        });

        return res.status(201).json({ message: 'Staff access granted successfully.', assignment: ins.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Grant staff access error:', error);
        return res.status(500).json({ message: 'Failed to grant staff access.' });
    } finally {
        client.release();
    }
});

router.delete('/staff-access/:id', async (req, res) => {
    try {
        const memberId = Number(req.params.id);
        await pool.query(`DELETE FROM page_members WHERE page_member_id = $1`, [memberId]);

        await logAudit(req, {
            action: 'Revoked Page Staff Access',
            module: 'users',
            targetType: 'page_member',
            targetId: memberId
        });

        return res.json({ message: 'Staff access revoked successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to revoke staff access.' });
    }
});

router.get('/documents/view', async (req, res) => {
    try {
        const userId = Number(req.query.userId);
        const docType = String(req.query.type || '').toLowerCase();
        if (!userId || !['cor', 'id'].includes(docType)) {
            return res.status(400).send('Valid userId and type (cor or id) are required.');
        }

        const colImage = docType === 'cor' ? 'cor_image' : 'student_id_image';
        const colMime = docType === 'cor' ? 'cor_mime_type' : 'student_id_mime_type';
        const result = await pool.query(
            `SELECT ${colImage} AS img, ${colMime} AS mime FROM student_profiles WHERE user_id = $1 LIMIT 1`,
            [userId]
        );

        if (result.rowCount === 0 || !result.rows[0].img) {
            return res.status(404).send('Document image not found in database.');
        }

        res.setHeader('Content-Type', result.rows[0].mime || 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(result.rows[0].img);
    } catch (error) {
        console.error('Admin document view error:', error);
        return res.status(500).send('Failed to load document from database.');
    }
});

// ============================================================================
// 4. PAGE MANAGEMENT (/api/admin/pages)
// ============================================================================
router.get('/pages', async (req, res) => {
    try {
        const {
            tab = 'all',
            search = '',
            category = 'all',
            department = 'all',
            sort = 'newest',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = [];

        if (tab && tab !== 'all') {
            const normTab = String(tab).toLowerCase();
            if (normTab === 'active' || normTab === 'approved') {
                clauses.push(`LOWER(p.status) IN ('approved', 'active')`);
            } else {
                params.push(normTab);
                clauses.push(`LOWER(p.status) = LOWER($${params.length})`);
            }
        }
        if (category && category !== 'all') {
            params.push(category);
            clauses.push(`LOWER(p.page_type) = LOWER($${params.length})`);
        }
        if (department && department !== 'all') {
            params.push(department);
            clauses.push(`(LOWER(d.department_name) = LOWER($${params.length}) OR LOWER(d.department_code) = LOWER($${params.length}) OR d.department_id::text = $${params.length})`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.page_name ILIKE $${params.length} OR p.page_code ILIKE $${params.length} OR COALESCE(d.department_name, '') ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const orderSql = sort === 'oldest' ? 'p.created_at ASC' : 'p.created_at DESC';

        const [countRes, summaryRes, deptsRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM pages p
                 LEFT JOIN departments d ON p.department_id = d.department_id
                 ${whereSql}`,
                params
            ),
            pool.query(
                `SELECT COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE LOWER(status) = 'pending')::int AS pending,
                        COUNT(*) FILTER (WHERE LOWER(status) IN ('approved', 'active'))::int AS approved,
                        COUNT(*) FILTER (WHERE LOWER(status) IN ('approved', 'active'))::int AS active,
                        COUNT(*) FILTER (WHERE LOWER(status) = 'suspended')::int AS suspended,
                        COUNT(*) FILTER (WHERE LOWER(status) = 'archived')::int AS archived,
                        COUNT(*) FILTER (WHERE LOWER(status) = 'rejected')::int AS rejected
                 FROM pages`
            ),
            pool.query(
                `SELECT department_id AS id, department_name AS name, department_code AS code
                 FROM departments
                 WHERE LOWER(status) = 'active'
                 ORDER BY department_name ASC`
            )
        ]);

        const total = countRes.rows[0].total;
        params.push(limitNum, offset);

        const pagesRes = await pool.query(
            `SELECT p.page_id AS id,
                    p.page_id,
                    p.page_name AS name,
                    p.page_name,
                    p.page_code AS code,
                    p.page_description AS description,
                    p.page_type AS category,
                    p.status,
                    p.created_at,
                    p.department_id,
                    d.department_name AS college,
                    d.department_name AS department,
                    COALESCE(d.department_name, o.organization_name, 'University Unit') AS unit_name,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS creator_name,
                    COALESCE(u.email, 'admin@wmsu.edu.ph') AS creator_email,
                    COUNT(DISTINCT pm.page_member_id) FILTER (WHERE LOWER(pm.status) = 'active')::int AS staff_count,
                    COUNT(DISTINCT pf.follow_id)::int AS followers_count
             FROM pages p
             LEFT JOIN departments d ON p.department_id = d.department_id
             LEFT JOIN organizations o ON p.organization_id = o.organization_id
             LEFT JOIN users u ON p.created_by = u.user_id
             LEFT JOIN page_members pm ON p.page_id = pm.page_id
             LEFT JOIN page_follows pf ON p.page_id = pf.page_id
             ${whereSql}
             GROUP BY p.page_id, d.department_id, o.organization_id, u.user_id
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            pages: pagesRes.rows,
            counts: summaryRes.rows[0],
            departments: deptsRes.rows,
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Admin pages error:', error);
        return res.status(500).json({ message: 'Failed to fetch campus pages.' });
    }
});

router.post('/pages', async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, page_name, code, page_code, description, category, department_id, organization_id } = req.body;
        const pName = (name || page_name || '').trim();
        if (!pName) return res.status(400).json({ message: 'Page name is required.' });

        const pCode = (code || page_code || pName.split(' ').map(w => w[0]).join('')).slice(0, 12).toUpperCase();
        const pType = department_id ? 'department' : (category === 'office' ? 'office' : 'organization');

        await client.query('BEGIN');

        const ins = await client.query(
            `INSERT INTO pages (page_name, page_code, page_description, page_type, department_id, organization_id, created_by, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'Approved')
             RETURNING *, page_id AS id`,
            [
                pName,
                pCode,
                description || '',
                pType,
                department_id ? Number(department_id) : null,
                organization_id ? Number(organization_id) : null,
                req.user.user_id
            ]
        );

        await client.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, 'Admin', $2, 'Active')
             ON CONFLICT DO NOTHING`,
            [ins.rows[0].page_id, req.user.user_id]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Created Campus Page (${pName})`,
            module: 'pages',
            targetType: 'page',
            targetId: ins.rows[0].page_id,
            details: { page_name: pName, page_code: pCode }
        });

        return res.status(201).json({ message: 'Page created successfully.', page: ins.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Admin create page error:', error);
        return res.status(500).json({ message: 'Failed to create page: ' + error.message });
    } finally {
        client.release();
    }
});

const handlePageStatus = async (req, res) => {
    const client = await pool.connect();
    try {
        const pageId = Number(req.params.id);
        const { status, decision, action, remarks, reason } = req.body;
        const rawInput = String(action || status || decision || 'Approved').toLowerCase();

        let newStatus = 'Approved';
        if (rawInput.startsWith('reject')) newStatus = 'Rejected';
        else if (rawInput.startsWith('suspend')) newStatus = 'Suspended';
        else if (rawInput.startsWith('archiv')) newStatus = 'Archived';
        else if (rawInput.startsWith('pend')) newStatus = 'Pending';
        else if (rawInput.startsWith('approv') || rawInput.startsWith('reactivat') || rawInput === 'active') newStatus = 'Approved';

        await client.query('BEGIN');

        const upd = await client.query(
            `UPDATE pages SET status = $1, updated_at = NOW() WHERE page_id = $2 RETURNING *`,
            [newStatus, pageId]
        );

        if (['Approved', 'Rejected', 'Suspended'].includes(newStatus)) {
            await client.query(
                `INSERT INTO page_reviews (page_id, reviewed_by, decision, remarks)
                 VALUES ($1, $2, $3, $4)`,
                [pageId, req.user.user_id, newStatus, remarks || reason || null]
            );
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Page Status Updated to ${newStatus}`,
            module: 'pages',
            targetType: 'page',
            targetId: pageId,
            details: { status: newStatus, remarks: remarks || reason }
        });

        return res.json({ message: `Page status updated to ${newStatus}.`, page: upd.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Update page status error:', error);
        return res.status(500).json({ message: 'Failed to update page status.' });
    } finally {
        client.release();
    }
};
router.patch('/pages/:id/status', handlePageStatus);
router.put('/pages/:id/status', handlePageStatus);
router.post('/pages/:id/status', handlePageStatus);

router.get('/pages/:pageId/staff', async (req, res) => {
    try {
        const pageId = Number(req.params.pageId);
        const [staffRes, eligibleRes] = await Promise.all([
            pool.query(
                `SELECT pm.page_member_id AS id,
                        pm.user_id,
                        pm.role_on_page AS role,
                        pm.role_on_page AS role_scope,
                        pm.status,
                        pm.assigned_at,
                        pm.assigned_at AS created_at,
                        u.first_name,
                        u.last_name,
                        u.first_name || ' ' || u.last_name AS full_name,
                        u.email
                 FROM page_members pm
                 JOIN users u ON pm.user_id = u.user_id
                 WHERE pm.page_id = $1 AND LOWER(pm.status) = 'active'
                 ORDER BY pm.assigned_at DESC`,
                [pageId]
            ),
            pool.query(
                `SELECT u.user_id AS id,
                        u.first_name,
                        u.last_name,
                        u.first_name || ' ' || u.last_name AS full_name,
                        u.email,
                        r.role_name,
                        sp.student_number AS student_id
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 WHERE LOWER(u.account_status) = 'active'
                 ORDER BY u.first_name ASC`
            )
        ]);

        return res.json({ staff: staffRes.rows, eligibleUsers: eligibleRes.rows });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch page staff.' });
    }
});

router.post('/pages/:pageId/staff', async (req, res) => {
    try {
        const pageId = Number(req.params.pageId);
        const { userId, user_id, role = 'Editor' } = req.body;
        const targetUserId = Number(userId || user_id);

        await pool.query(
            `UPDATE users
             SET role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1)
             WHERE user_id = $1 AND role_id = (SELECT role_id FROM roles WHERE LOWER(role_name) = 'student' LIMIT 1)`,
            [targetUserId]
        );

        const ins = await pool.query(
            `INSERT INTO page_members (page_id, user_id, role_on_page, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'Active')
             ON CONFLICT (page_id, user_id)
             DO UPDATE SET role_on_page = EXCLUDED.role_on_page, status = 'Active'
             RETURNING *`,
            [pageId, targetUserId, role, req.user.user_id]
        );

        await logAudit(req, {
            action: 'Assigned Staff to Page',
            module: 'pages',
            targetType: 'page_member',
            targetId: ins.rows[0].page_member_id,
            details: { pageId, userId: targetUserId, role }
        });

        return res.status(201).json({ message: 'Staff assigned to page.', staff: ins.rows[0] });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to assign staff to page.' });
    }
});

router.delete('/pages/staff/:staffId', async (req, res) => {
    try {
        const staffId = Number(req.params.staffId);
        await pool.query(`DELETE FROM page_members WHERE page_member_id = $1`, [staffId]);

        await logAudit(req, {
            action: 'Removed Staff from Page',
            module: 'pages',
            targetType: 'page_member',
            targetId: staffId
        });

        return res.json({ message: 'Staff member removed from page.' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to remove staff member.' });
    }
});

// ============================================================================
// 5. POST APPROVAL (/api/admin/post-approval)
// ============================================================================
router.get('/post-approval', async (req, res) => {
    try {
        const {
            tab = 'pending',
            type = 'all',
            status = 'all',
            submissionDate = '',
            search = '',
            sort = 'oldest',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = ['p.is_archived = FALSE'];

        const normTab = String(tab).toLowerCase();
        if (status && status !== 'all') {
            params.push(status);
            clauses.push(`LOWER(p.moderation_status) = LOWER($${params.length})`);
        } else if (normTab === 'reviewed') {
            clauses.push(`LOWER(p.moderation_status) IN ('approved', 'rejected')`);
        } else if (normTab && normTab !== 'all') {
            params.push(normTab);
            clauses.push(`LOWER(p.moderation_status) = LOWER($${params.length})`);
        }

        if (type && type !== 'all') {
            params.push(type);
            clauses.push(`LOWER(p.post_type) = LOWER($${params.length})`);
        }

        if (submissionDate && String(submissionDate).trim()) {
            params.push(String(submissionDate).trim());
            clauses.push(`DATE(p.created_at) = DATE($${params.length})`);
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR pg.page_name ILIKE $${params.length} OR (u.first_name || ' ' || u.last_name) ILIKE $${params.length})`);
        }

        const whereSql = clauses.join(' AND ');
        const orderSql = sort === 'newest' ? 'p.created_at DESC' : 'p.created_at ASC';

        const [countRes, summaryRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM posts p
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN users u ON p.creator_user_id = u.user_id
                 WHERE ${whereSql}`,
                params
            ),
            pool.query(
                `SELECT COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND post_type = 'announcement' AND is_archived = FALSE)::int AS "pendingAnnouncements",
                        COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND post_type = 'event' AND is_archived = FALSE)::int AS "pendingEvents",
                        COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND is_archived = FALSE)::int AS "totalPending",
                        COUNT(*) FILTER (WHERE LOWER(moderation_status) IN ('approved', 'rejected') AND is_archived = FALSE)::int AS "totalReviewed"
                 FROM posts`
            )
        ]);

        const total = countRes.rows[0].total;
        params.push(limitNum, offset);

        const itemsRes = await pool.query(
            `SELECT p.post_id AS id,
                    p.post_type AS type,
                    p.title,
                    p.content AS description,
                    p.content AS body,
                    p.image_url,
                    p.audience,
                    p.moderation_status AS status,
                    p.moderation_status,
                    p.created_at,
                    COALESCE(pc.category_name, 'General') AS category,
                    COALESCE(pg.page_name, 'Campus Page') AS page_name,
                    COALESCE(d.department_name, pg.page_name, 'University-Wide') AS department_name,
                    COALESCE(u.first_name || ' ' || u.last_name, 'Staff') AS author_name,
                    ed.event_date,
                    ed.event_date AS event_start,
                    ed.end_date AS event_end,
                    ed.location,
                    ed.location AS venue,
                    COALESCE(ed.organizer_info, pg.page_name, 'Campus Page') AS organizer,
                    ed.capacity,
                    ed.registration_deadline AS reg_deadline
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN users u ON p.creator_user_id = u.user_id
             WHERE ${whereSql}
             ORDER BY ${orderSql}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            items: itemsRes.rows,
            counts: summaryRes.rows[0],
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Post approval fetch error:', error);
        return res.status(500).json({ message: 'Failed to fetch post approval queue.' });
    }
});

const handlePostDecision = async (req, res) => {
    const client = await pool.connect();
    try {
        const postId = Number(req.params.id);
        const { decision, reason } = req.body;
        const norm = String(decision || 'approve').toLowerCase();

        let modStatus = 'Approved';
        let postStatus = 'Published';
        let logDecision = 'approve';

        if (norm.startsWith('reject')) {
            modStatus = 'Rejected';
            postStatus = 'Rejected';
            logDecision = 'reject';
        } else if (norm.includes('correction')) {
            modStatus = 'Pending';
            postStatus = 'Pending';
            logDecision = 'correction';
        }

        await client.query('BEGIN');

        const upd = await client.query(
            `UPDATE posts
             SET moderation_status = $1,
                 status = CASE WHEN post_type = 'event' AND $2 = 'Published' THEN 'Upcoming' ELSE $2 END,
                 published_at = CASE WHEN $1 = 'Approved' THEN COALESCE(published_at, NOW()) ELSE published_at END,
                 updated_at = NOW()
             WHERE post_id = $3
             RETURNING *`,
            [modStatus, postStatus, postId]
        );

        if (upd.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found.' });
        }

        const post = upd.rows[0];

        await client.query(
            `INSERT INTO post_moderation_logs (post_id, reviewer_user_id, decision, reason)
             VALUES ($1, $2, $3, $4)`,
            [postId, req.user.user_id, logDecision, reason || null]
        );

        const notifLabel = logDecision === 'correction' ? 'Correction Requested' : modStatus;
        await client.query(
            `INSERT INTO notifications (recipient_user_id, actor_user_id, page_id, post_id, notification_scope, type, title, message)
             VALUES ($1, $2, $3, $4, 'mypage', 'moderation', $5, $6)`,
            [
                post.creator_user_id,
                req.user.user_id,
                post.page_id,
                postId,
                `Post ${notifLabel}: ${post.title}`,
                reason || `Your ${post.post_type} "${post.title}" was marked as ${notifLabel}.`
            ]
        );

        await client.query('COMMIT');

        await logAudit(req, {
            action: `Post Moderation Decision (${notifLabel})`,
            module: 'posts',
            targetType: 'post',
            targetId: postId,
            details: { decision: notifLabel, reason }
        });

        return res.json({ message: `Post marked as ${notifLabel}.`, item: post });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Post decision error:', error);
        return res.status(500).json({ message: 'Failed to record post moderation decision.' });
    } finally {
        client.release();
    }
};
router.post('/post-approval/:id/decision', handlePostDecision);
router.put('/post-approval/:id/decision', handlePostDecision);
router.patch('/post-approval/:id/decision', handlePostDecision);

// ============================================================================
// 6. ARCHIVES (/api/admin/archives)
// ============================================================================
router.get('/archives/summary', async (req, res) => {
    try {
        const { academicYearId = 'all' } = req.query;
        const params = [];
        let yearClause = '';
        if (academicYearId && academicYearId !== 'all') {
            params.push(Number(academicYearId));
            yearClause = `AND academic_year_id = $1`;
        }

        const [postsRes, pagesRes, modRes, aysRes] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE is_archived = TRUE ${yearClause})::int AS "totalPostsArchived",
                    COUNT(*) FILTER (WHERE is_archived = TRUE AND post_type = 'announcement' ${yearClause})::int AS announcements,
                    COUNT(*) FILTER (WHERE is_archived = TRUE AND post_type = 'event' ${yearClause})::int AS events,
                    COUNT(*) FILTER (WHERE is_archived = TRUE AND archived_at >= date_trunc('month', NOW()) ${yearClause})::int AS "thisMonth"
                 FROM posts`,
                params
            ),
            pool.query(`SELECT COUNT(*)::int AS cnt FROM pages WHERE LOWER(status) IN ('archived', 'suspended', 'rejected')`),
            pool.query(`SELECT COUNT(*)::int AS cnt FROM post_moderation_logs WHERE LOWER(decision) IN ('reject', 'takedown')`),
            pool.query(
                `SELECT academic_year_id AS id,
                        start_year, end_year, semester, is_active, status, start_date, end_date, archived_at,
                        start_year || '–' || end_year || ' (' || semester || ') — ' || COALESCE(status, CASE WHEN is_active THEN 'Active' ELSE 'Archived' END) AS label
                 FROM academic_years
                 ORDER BY is_active DESC, start_year DESC, academic_year_id DESC`
            )
        ]);

        const p = postsRes.rows[0] || {};
        const otherCount = (pagesRes.rows[0]?.cnt || 0) + (modRes.rows[0]?.cnt || 0);

        return res.json({
            totalArchived: (p.totalPostsArchived || 0) + otherCount,
            announcements: p.announcements || 0,
            events: p.events || 0,
            other: otherCount,
            thisMonth: p.thisMonth || 0,
            academicYears: aysRes.rows
        });
    } catch (error) {
        console.error('Archive summary error:', error);
        return res.status(500).json({ message: 'Failed to fetch archive summary.' });
    }
});

router.get('/archives', async (req, res) => {
    try {
        const {
            category = 'ALL',
            recordType = 'ALL',
            type = 'ALL',
            search = '',
            startDate = '',
            endDate = '',
            dateFrom = '',
            dateTo = '',
            reason = 'ALL',
            sort = 'newest',
            academicYearId = 'all',
            includeAllYearRecords = 'false',
            page = 1,
            limit = 10
        } = req.query;

        const effStartDate = (startDate || dateFrom || '').trim();
        const effEndDate = (endDate || dateTo || '').trim();
        const effReason = String(reason || 'ALL').toUpperCase();
        const effSort = String(sort || 'newest').toLowerCase();

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const rawType = recordType !== 'ALL' ? recordType : (type !== 'ALL' ? type : category);
        const typeFilter = String(rawType || 'ALL').toUpperCase();

        // Branch A: Historical Event Registrations
        if (typeFilter === 'REGISTRATION' || typeFilter === 'REGISTRATIONS') {
            const params = [];
            const clauses = [];

            if (academicYearId && academicYearId !== 'all') {
                params.push(Number(academicYearId));
                clauses.push(`p.academic_year_id = $${params.length}`);
            } else {
                clauses.push(`(p.is_archived = TRUE OR ay.is_active = FALSE)`);
            }
            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                clauses.push(`(p.title ILIKE $${params.length} OR (u.first_name || ' ' || u.last_name) ILIKE $${params.length} OR COALESCE(sp.student_number, '') ILIKE $${params.length})`);
            }
            if (effStartDate) {
                params.push(effStartDate);
                clauses.push(`DATE(er.registered_at) >= DATE($${params.length})`);
            }
            if (effEndDate) {
                params.push(effEndDate);
                clauses.push(`DATE(er.registered_at) <= DATE($${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const countRes = await pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM event_registrations er
                 JOIN posts p ON er.event_post_id = p.post_id
                 LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 ${whereSql}`,
                params
            );
            const totalRecords = countRes.rows[0].total;
            params.push(limitNum, offset);

            const regOrderBy = effSort === 'oldest'
                ? 'er.registered_at ASC, er.registration_id ASC'
                : effSort === 'alphabetical'
                    ? 'p.title ASC, er.registration_id DESC'
                    : 'er.registered_at DESC, er.registration_id DESC';

            const rowsRes = await pool.query(
                `SELECT er.registration_id AS id,
                        'REGISTRATION-' || er.registration_id AS uid,
                        p.post_id AS post_id,
                        p.title,
                        'REGISTRATION' AS type,
                        'REGISTRATION' AS record_type,
                        u.first_name || ' ' || u.last_name AS author,
                        COALESCE(sp.student_number, u.email) AS office,
                        COALESCE(pg.page_name, 'University Event') AS source_department,
                        'System Archive' AS "archivedBy",
                        'System Archive' AS archived_by_name,
                        'Event Registration (' || er.status || ')' AS "archiveReason",
                        'Event Registration (' || er.status || ')' AS reason,
                        er.registered_at AS "archivedAt",
                        er.registered_at AS archived_at,
                        er.registered_at AS "publishedAt",
                        er.status AS "previousStatus",
                        'Student: ' || (u.first_name || ' ' || u.last_name) || ' (' || COALESCE(sp.student_number, 'N/A') || ') — Event: ' || p.title AS content,
                        CASE WHEN ay.academic_year_id IS NOT NULL
                             THEN ay.start_year || '–' || ay.end_year || ' (' || ay.semester || ')'
                             ELSE 'N/A' END AS academic_year_label
                 FROM event_registrations er
                 JOIN posts p ON er.event_post_id = p.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 ${whereSql}
                 ORDER BY ${regOrderBy}
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));
            return res.json({
                records: rowsRes.rows,
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum,
                pagination: { currentPage: pageNum, totalPages, totalRecords, limit: limitNum }
            });
        }

        // Branch B: Historical Event Attendance Records
        if (typeFilter === 'ATTENDANCE') {
            const params = [];
            const clauses = [];

            if (academicYearId && academicYearId !== 'all') {
                params.push(Number(academicYearId));
                clauses.push(`p.academic_year_id = $${params.length}`);
            } else {
                clauses.push(`(p.is_archived = TRUE OR ay.is_active = FALSE)`);
            }
            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                clauses.push(`(p.title ILIKE $${params.length} OR (u.first_name || ' ' || u.last_name) ILIKE $${params.length} OR COALESCE(sp.student_number, '') ILIKE $${params.length})`);
            }
            if (effStartDate) {
                params.push(effStartDate);
                clauses.push(`DATE(ar.updated_at) >= DATE($${params.length})`);
            }
            if (effEndDate) {
                params.push(effEndDate);
                clauses.push(`DATE(ar.updated_at) <= DATE($${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const countRes = await pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM event_attendance_records ar
                 JOIN event_registrations er ON ar.registration_id = er.registration_id
                 JOIN posts p ON er.event_post_id = p.post_id
                 LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 ${whereSql}`,
                params
            );
            const totalRecords = countRes.rows[0].total;
            params.push(limitNum, offset);

            const attOrderBy = effSort === 'oldest'
                ? 'COALESCE(ar.checkin_time, ar.updated_at) ASC, ar.attendance_id ASC'
                : effSort === 'alphabetical'
                    ? 'p.title ASC, ar.attendance_id DESC'
                    : 'COALESCE(ar.checkin_time, ar.updated_at) DESC, ar.attendance_id DESC';

            const rowsRes = await pool.query(
                `SELECT ar.attendance_id AS id,
                        'ATTENDANCE-' || ar.attendance_id AS uid,
                        p.post_id AS post_id,
                        p.title,
                        'ATTENDANCE' AS type,
                        'ATTENDANCE' AS record_type,
                        u.first_name || ' ' || u.last_name AS author,
                        COALESCE(sp.student_number, u.email) AS office,
                        COALESCE(pg.page_name, 'University Event') AS source_department,
                        'QR / Attendance System' AS "archivedBy",
                        'QR / Attendance System' AS archived_by_name,
                        'Attendance: ' || ar.status || ' (' || COALESCE(ar.check_in_method, 'QR') || ')' AS "archiveReason",
                        'Attendance: ' || ar.status || ' (' || COALESCE(ar.check_in_method, 'QR') || ')' AS reason,
                        COALESCE(ar.checkin_time, ar.updated_at) AS "archivedAt",
                        COALESCE(ar.checkin_time, ar.updated_at) AS archived_at,
                        ar.checkin_time AS "publishedAt",
                        ar.status AS "previousStatus",
                        'Student: ' || (u.first_name || ' ' || u.last_name) || ' — Status: ' || ar.status || ' — Method: ' || COALESCE(ar.check_in_method, 'QR') AS content,
                        CASE WHEN ay.academic_year_id IS NOT NULL
                             THEN ay.start_year || '–' || ay.end_year || ' (' || ay.semester || ')'
                             ELSE 'N/A' END AS academic_year_label
                 FROM event_attendance_records ar
                 JOIN event_registrations er ON ar.registration_id = er.registration_id
                 JOIN posts p ON er.event_post_id = p.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 ${whereSql}
                 ORDER BY ${attOrderBy}
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));
            return res.json({
                records: rowsRes.rows,
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum,
                pagination: { currentPage: pageNum, totalPages, totalRecords, limit: limitNum }
            });
        }

        // Branch C: Archived / Suspended Pages
        if (typeFilter === 'PAGE') {
            const params = [];
            const clauses = [`LOWER(pg.status) IN ('archived', 'suspended', 'rejected')`];

            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                clauses.push(`(pg.page_name ILIKE $${params.length} OR pg.page_code ILIKE $${params.length})`);
            }
            if (effStartDate) {
                params.push(effStartDate);
                clauses.push(`DATE(pg.updated_at) >= DATE($${params.length})`);
            }
            if (effEndDate) {
                params.push(effEndDate);
                clauses.push(`DATE(pg.updated_at) <= DATE($${params.length})`);
            }
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM pages pg ${whereSql}`, params);
            const totalRecords = countRes.rows[0].total;
            params.push(limitNum, offset);

            const pageOrderBy = effSort === 'oldest'
                ? 'pg.updated_at ASC, pg.page_id ASC'
                : effSort === 'alphabetical'
                    ? 'pg.page_name ASC, pg.page_id DESC'
                    : 'pg.updated_at DESC, pg.page_id DESC';

            const rowsRes = await pool.query(
                `SELECT pg.page_id AS id,
                        'PAGE-' || pg.page_id AS uid,
                        pg.page_name AS title,
                        'PAGE' AS type,
                        'PAGE' AS record_type,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS author,
                        COALESCE(d.department_name, pg.page_code, 'Campus Unit') AS office,
                        COALESCE(d.department_name, pg.page_code, 'Campus Unit') AS source_department,
                        'Admin' AS "archivedBy",
                        'Admin' AS archived_by_name,
                        'Page Status: ' || pg.status AS "archiveReason",
                        'Page Status: ' || pg.status AS reason,
                        pg.updated_at AS "archivedAt",
                        pg.updated_at AS archived_at,
                        pg.created_at AS "publishedAt",
                        pg.status AS "previousStatus",
                        COALESCE(pg.page_description, 'No description provided.') AS content
                 FROM pages pg
                 LEFT JOIN departments d ON pg.department_id = d.department_id
                 LEFT JOIN users u ON pg.created_by = u.user_id
                 ${whereSql}
                 ORDER BY ${pageOrderBy}
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));
            return res.json({
                records: rowsRes.rows,
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum,
                pagination: { currentPage: pageNum, totalPages, totalRecords, limit: limitNum }
            });
        }

        // Branch D: Moderation Logs
        if (typeFilter === 'MODERATION') {
            const params = [];
            const clauses = [`LOWER(m.decision) IN ('reject', 'takedown', 'correction')`];

            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                clauses.push(`(p.title ILIKE $${params.length} OR COALESCE(m.reason, '') ILIKE $${params.length})`);
            }
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const countRes = await pool.query(
                `SELECT COUNT(*)::int AS total FROM post_moderation_logs m JOIN posts p ON m.post_id = p.post_id ${whereSql}`,
                params
            );
            const totalRecords = countRes.rows[0].total;
            params.push(limitNum, offset);

            const rowsRes = await pool.query(
                `SELECT m.moderation_id AS id,
                        p.post_id,
                        p.title,
                        'MODERATION' AS type,
                        'MODERATION' AS record_type,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Reviewer') AS author,
                        COALESCE(pg.page_name, 'Campus Page') AS office,
                        COALESCE(pg.page_name, 'Campus Page') AS source_department,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS "archivedBy",
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS archived_by_name,
                        COALESCE(m.reason, 'Moderation Action: ' || m.decision) AS "archiveReason",
                        COALESCE(m.reason, 'Moderation Action: ' || m.decision) AS reason,
                        m.created_at AS "archivedAt",
                        m.created_at AS archived_at,
                        p.created_at AS "publishedAt",
                        m.decision AS "previousStatus",
                        p.content
                 FROM post_moderation_logs m
                 JOIN posts p ON m.post_id = p.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN users u ON m.reviewer_user_id = u.user_id
                 ${whereSql}
                 ORDER BY m.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );

            const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));
            return res.json({
                records: rowsRes.rows,
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum,
                pagination: { currentPage: pageNum, totalPages, totalRecords, limit: limitNum }
            });
        }

        // Default Branch: Posts (Announcements & Events)
        const params = [];
        const clauses = [];

        if (academicYearId && academicYearId !== 'all') {
            params.push(Number(academicYearId));
            clauses.push(`p.academic_year_id = $${params.length}`);
            if (String(includeAllYearRecords) !== 'true') {
                clauses.push(`(p.is_archived = TRUE OR ay.is_active = FALSE)`);
            }
        } else {
            clauses.push(`p.is_archived = TRUE`);
        }

        if (typeFilter && typeFilter !== 'ALL') {
            if (typeFilter.includes('ANNOUNCEMENT')) {
                clauses.push(`p.post_type = 'announcement'`);
            } else if (typeFilter.includes('EVENT')) {
                clauses.push(`p.post_type = 'event'`);
            }
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR pg.page_name ILIKE $${params.length} OR COALESCE(p.archive_reason, '') ILIKE $${params.length} OR COALESCE(d.department_name, '') ILIKE $${params.length})`);
        }

        if (effStartDate) {
            params.push(effStartDate);
            clauses.push(`DATE(COALESCE(p.archived_at, p.created_at)) >= DATE($${params.length})`);
        }

        if (effEndDate) {
            params.push(effEndDate);
            clauses.push(`DATE(COALESCE(p.archived_at, p.created_at)) <= DATE($${params.length})`);
        }

        if (effReason && effReason !== 'ALL') {
            if (effReason === 'EXPIRED') {
                clauses.push(`(COALESCE(p.archive_reason, '') ILIKE '%expir%' OR COALESCE(p.archive_reason, '') ILIKE '%transition%' OR ay.is_active = FALSE)`);
            } else if (effReason === 'MANUAL') {
                clauses.push(`(COALESCE(p.archive_reason, '') ILIKE '%manual%' OR COALESCE(p.archive_reason, '') ILIKE '%admin%')`);
            } else if (effReason === 'TAKEN_DOWN') {
                clauses.push(`(COALESCE(p.archive_reason, '') ILIKE '%takedown%' OR COALESCE(p.archive_reason, '') ILIKE '%taken%' OR COALESCE(p.archive_reason, '') ILIKE '%moderation%' OR COALESCE(p.archive_reason, '') ILIKE '%reject%')`);
            } else if (effReason === 'COMPLETED') {
                clauses.push(`(COALESCE(p.archive_reason, '') ILIKE '%complet%' OR p.post_type = 'event')`);
            }
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
             ${whereSql}`,
            params
        );
        const totalRecords = countRes.rows[0].total;
        const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));

        const postOrderBy = effSort === 'oldest'
            ? 'COALESCE(p.archived_at, p.updated_at, p.created_at) ASC, p.post_id ASC'
            : effSort === 'alphabetical'
                ? 'p.title ASC, p.post_id DESC'
                : 'COALESCE(p.archived_at, p.updated_at, p.created_at) DESC, p.post_id DESC';

        params.push(limitNum, offset);
        const rowsRes = await pool.query(
            `SELECT p.post_id AS id,
                    UPPER(p.post_type) || '-' || p.post_id AS uid,
                    p.post_id,
                    p.title,
                    UPPER(p.post_type) AS type,
                    p.post_type AS record_type,
                    COALESCE(pc.category_name, 'General') AS category,
                    COALESCE(creator.first_name || ' ' || creator.last_name, 'Campus Staff') AS author,
                    COALESCE(d.department_name, pg.page_name, 'University Page') AS office,
                    COALESCE(pg.page_name, 'University Page') AS source_department,
                    COALESCE(archiver.first_name || ' ' || archiver.last_name, 'System / Admin') AS "archivedBy",
                    COALESCE(archiver.first_name || ' ' || archiver.last_name, 'System / Admin') AS archived_by_name,
                    COALESCE(p.archive_reason, CASE WHEN ay.is_active = FALSE THEN 'School Year Transition' ELSE 'Administrative Archive' END) AS "archiveReason",
                    COALESCE(p.archive_reason, CASE WHEN ay.is_active = FALSE THEN 'School Year Transition' ELSE 'Administrative Archive' END) AS reason,
                    COALESCE(p.archived_at, p.updated_at, p.created_at) AS "archivedAt",
                    COALESCE(p.archived_at, p.updated_at, p.created_at) AS archived_at,
                    COALESCE(p.published_at, p.created_at) AS "publishedAt",
                    COALESCE(p.previous_status, p.status, 'Published') AS "previousStatus",
                    p.content,
                    p.audience,
                    p.is_archived,
                    p.academic_year_id,
                    CASE WHEN ay.academic_year_id IS NOT NULL
                         THEN ay.start_year || '–' || ay.end_year || ' (' || ay.semester || ')'
                         ELSE 'N/A' END AS academic_year_label,
                    ed.event_date,
                    ed.end_date,
                    ed.location,
                    (SELECT COUNT(*)::int FROM event_registrations er WHERE er.event_post_id = p.post_id) AS registered_count,
                    (SELECT COUNT(*)::int FROM event_attendance_records ar JOIN event_registrations er2 ON ar.registration_id = er2.registration_id WHERE er2.event_post_id = p.post_id AND UPPER(ar.status) IN ('PRESENT', 'LATE')) AS attended_count
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN departments d ON pg.department_id = d.department_id
             LEFT JOIN post_categories pc ON p.category_id = pc.category_id
             LEFT JOIN users creator ON p.creator_user_id = creator.user_id
             LEFT JOIN users archiver ON p.archived_by = archiver.user_id
             LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
             ${whereSql}
             ORDER BY ${postOrderBy}
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            records: rowsRes.rows,
            currentPage: pageNum,
            totalPages,
            totalRecords,
            limit: limitNum,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Archives fetch error:', error);
        return res.status(500).json({ message: 'Failed to fetch archived records.' });
    }
});

const handleRestoreArchive = async (req, res) => {
    try {
        const recordId = Number(req.params.id);
        const recordType = String(req.body?.type || req.query?.type || 'POST').toUpperCase();

        if (recordType === 'PAGE') {
            await pool.query(`UPDATE pages SET status = 'Approved', updated_at = NOW() WHERE page_id = $1`, [recordId]);
            await logAudit(req, {
                action: 'Restored Archived Page',
                module: 'archives',
                targetType: 'page',
                targetId: recordId
            });
            return res.json({ message: 'Page restored to Approved status.' });
        }

        await pool.query(
            `UPDATE posts
             SET is_archived = FALSE,
                 status = COALESCE(NULLIF(previous_status, 'Archived'), CASE WHEN post_type = 'event' THEN 'Upcoming' ELSE 'Published' END),
                 archived_at = NULL,
                 updated_at = NOW()
             WHERE post_id = $1`,
            [recordId]
        );

        await logAudit(req, {
            action: 'Restored Archived Record',
            module: 'archives',
            targetType: 'post',
            targetId: recordId
        });

        return res.json({ message: 'Record restored successfully.' });
    } catch (error) {
        console.error('Restore archive error:', error);
        return res.status(500).json({ message: 'Failed to restore record.' });
    }
};
router.post('/archives/:id/restore', handleRestoreArchive);
router.put('/archives/:id/restore', handleRestoreArchive);
router.patch('/archives/:id/restore', handleRestoreArchive);

router.get('/archives/export', async (req, res) => {
    try {
        const { category = 'ALL', search = '', startDate = '', endDate = '', academicYearId = 'all' } = req.query;
        const params = [];
        const clauses = [];

        if (academicYearId && academicYearId !== 'all') {
            params.push(Number(academicYearId));
            clauses.push(`p.academic_year_id = $${params.length}`);
        } else {
            clauses.push(`p.is_archived = TRUE`);
        }

        if (category && category !== 'ALL') {
            if (String(category).toLowerCase().includes('announcement')) {
                clauses.push(`p.post_type = 'announcement'`);
            } else if (String(category).toLowerCase().includes('event')) {
                clauses.push(`p.post_type = 'event'`);
            }
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`(p.title ILIKE $${params.length} OR pg.page_name ILIKE $${params.length})`);
        }
        if (startDate) {
            params.push(startDate);
            clauses.push(`DATE(COALESCE(p.archived_at, p.created_at)) >= DATE($${params.length})`);
        }
        if (endDate) {
            params.push(endDate);
            clauses.push(`DATE(COALESCE(p.archived_at, p.created_at)) <= DATE($${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const { rows } = await pool.query(
            `SELECT p.post_id AS id,
                    p.title,
                    p.post_type,
                    COALESCE(pg.page_name, 'University Page') AS page_name,
                    COALESCE(ay.start_year || '-' || ay.end_year || ' ' || ay.semester, 'N/A') AS school_year,
                    COALESCE(p.archive_reason, 'Archived') AS archive_reason,
                    COALESCE(p.archived_at, p.updated_at) AS archived_at
             FROM posts p
             LEFT JOIN pages pg ON p.page_id = pg.page_id
             LEFT JOIN academic_years ay ON p.academic_year_id = ay.academic_year_id
             ${whereSql}
             ORDER BY COALESCE(p.archived_at, p.updated_at) DESC`,
            params
        );

        let csv = 'ID,Title,Type,Source Page,School Year,Reason,Archived Date\n';
        for (const r of rows) {
            csv += [
                toCsvCell(r.id),
                toCsvCell(r.title),
                toCsvCell(r.post_type),
                toCsvCell(r.page_name),
                toCsvCell(r.school_year),
                toCsvCell(r.archive_reason),
                toCsvCell(r.archived_at ? new Date(r.archived_at).toISOString() : '')
            ].join(',') + '\n';
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="archives_export.csv"');
        return res.send(csv);
    } catch (error) {
        console.error('Archive export error:', error);
        return res.status(500).send('Export failed');
    }
});

// ============================================================================
// 7. REPORTS & STATISTICS (/api/admin/reports)
// ============================================================================
router.get('/reports/summary', async (req, res) => {
    try {
        const { academicYearId = 'all' } = req.query;
        const postParams = [];
        let postYearClause = '';
        if (academicYearId && academicYearId !== 'all') {
            postParams.push(Number(academicYearId));
            postYearClause = `AND academic_year_id = $1`;
        }

        const [students, posts, attendance, pages] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE LOWER(verification_status) = 'verified')::int AS verified
                 FROM student_profiles`
            ),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE post_type = 'announcement' AND is_archived = FALSE AND LOWER(status) = 'published' AND LOWER(moderation_status) = 'approved' ${postYearClause})::int AS announcements,
                    COUNT(*) FILTER (WHERE post_type = 'event' AND is_archived = FALSE AND LOWER(moderation_status) = 'approved' ${postYearClause})::int AS events,
                    COUNT(*) FILTER (WHERE LOWER(moderation_status) = 'pending' AND is_archived = FALSE ${postYearClause})::int AS pending_moderation
                 FROM posts`,
                postParams
            ),
            pool.query(
                `SELECT COUNT(*)::int AS total_registrations,
                        COUNT(*) FILTER (WHERE LOWER(status) IN ('attended', 'present'))::int AS attended
                 FROM event_registrations`
            ),
            pool.query(`SELECT COUNT(*)::int AS total_pages FROM pages WHERE LOWER(status) IN ('approved', 'active')`)
        ]);

        const sRow = students.rows[0] || {};
        const pRow = posts.rows[0] || {};
        const aRow = attendance.rows[0] || {};

        return res.json({
            totalStudents: sRow.total || 0,
            totalRegisteredStudents: sRow.total || 0,
            verifiedStudents: sRow.verified || 0,
            totalAnnouncements: pRow.announcements || 0,
            totalAnnouncementsPublished: pRow.announcements || 0,
            totalEvents: pRow.events || 0,
            totalEventsCreated: pRow.events || 0,
            pendingModeration: pRow.pending_moderation || 0,
            totalRegistrations: aRow.total_registrations || 0,
            totalEventRegistrations: aRow.total_registrations || 0,
            totalAttended: aRow.attended || 0,
            activePages: pages.rows[0]?.total_pages || 0
        });
    } catch (error) {
        console.error('Reports summary error:', error);
        return res.status(500).json({ message: 'Failed to fetch reports summary.' });
    }
});

router.get('/reports/metadata', async (req, res) => {
    try {
        const [depts, progs, pages, cats, ays] = await Promise.all([
            pool.query(`SELECT department_id AS id, department_name AS name, department_code AS code FROM departments ORDER BY department_name ASC`),
            pool.query(`SELECT program_id AS id, program_name AS name, department_id FROM programs ORDER BY program_name ASC`),
            pool.query(`SELECT page_id AS id, page_name AS name FROM pages ORDER BY page_name ASC`),
            pool.query(`SELECT category_id AS id, category_name AS name FROM post_categories ORDER BY category_name ASC`),
            pool.query(
                `SELECT academic_year_id AS id,
                        start_year || '–' || end_year || ' (' || semester || ')' AS label,
                        is_active,
                        status
                 FROM academic_years
                 ORDER BY is_active DESC, start_year DESC`
            )
        ]);

        return res.json({
            colleges: depts.rows,
            departments: depts.rows,
            programs: progs.rows,
            pages: pages.rows,
            categories: cats.rows,
            academicYears: ays.rows
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load report metadata.' });
    }
});

router.get('/reports/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const {
            page = 1,
            limit = 10,
            startDate = '',
            endDate = '',
            collegeId = '',
            departmentId = '',
            programId = '',
            category: catFilter = '',
            status = '',
            academicYearId = '',
            exportAll = 'false'
        } = req.query;

        const isExport = String(exportAll) === 'true';
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = isExport ? 10000 : Math.max(1, parseInt(limit, 10) || 10);
        const offset = isExport ? 0 : (pageNum - 1) * limitNum;

        let rows = [];
        let total = 0;
        let analytics = { summaryPills: {}, distribution: [] };

        const unitId = collegeId || departmentId;

        if (category === 'students') {
            const params = [];
            const clauses = [];

            if (unitId) {
                params.push(unitId);
                clauses.push(`(sp.department_id::text = $${params.length} OR LOWER(d.department_name) = LOWER($${params.length}))`);
            }
            if (programId) {
                params.push(programId);
                clauses.push(`(sp.program_id::text = $${params.length} OR LOWER(pr.program_name) = LOWER($${params.length}))`);
            }
            if (status) {
                params.push(status);
                clauses.push(`(LOWER(sp.verification_status) = LOWER($${params.length}) OR LOWER(u.account_status) = LOWER($${params.length}))`);
            }
            if (startDate) {
                params.push(startDate);
                clauses.push(`DATE(u.created_at) >= DATE($${params.length})`);
            }
            if (endDate) {
                params.push(endDate);
                clauses.push(`DATE(u.created_at) <= DATE($${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

            const [cRes, distRes, pillsRes] = await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS cnt
                     FROM student_profiles sp
                     JOIN users u ON sp.user_id = u.user_id
                     LEFT JOIN departments d ON sp.department_id = d.department_id
                     LEFT JOIN programs pr ON sp.program_id = pr.program_id
                     ${whereSql}`,
                    params
                ),
                pool.query(
                    `SELECT COALESCE(d.department_code, 'Unassigned') AS label, COUNT(*)::int AS count
                     FROM student_profiles sp
                     JOIN users u ON sp.user_id = u.user_id
                     LEFT JOIN departments d ON sp.department_id = d.department_id
                     LEFT JOIN programs pr ON sp.program_id = pr.program_id
                     ${whereSql}
                     GROUP BY COALESCE(d.department_code, 'Unassigned')
                     ORDER BY count DESC LIMIT 8`,
                    params
                ),
                pool.query(
                    `SELECT
                        COUNT(*)::int AS total_students,
                        COUNT(*) FILTER (WHERE LOWER(sp.verification_status) = 'verified')::int AS verified_students,
                        COUNT(*) FILTER (WHERE LOWER(sp.verification_status) = 'pending')::int AS pending_verification
                     FROM student_profiles sp
                     JOIN users u ON sp.user_id = u.user_id
                     LEFT JOIN departments d ON sp.department_id = d.department_id
                     LEFT JOIN programs pr ON sp.program_id = pr.program_id
                     ${whereSql}`,
                    params
                )
            ]);

            total = cRes.rows[0].cnt;
            analytics = {
                summaryPills: pillsRes.rows[0] || {},
                distribution: distRes.rows
            };

            params.push(limitNum, offset);
            const r = await pool.query(
                `SELECT u.user_id AS id,
                        sp.student_number,
                        sp.student_number AS student_id,
                        u.first_name,
                        '' AS middle_name,
                        u.last_name,
                        u.first_name || ' ' || u.last_name AS full_name,
                        u.first_name || ' ' || u.last_name AS student_name,
                        u.email,
                        COALESCE(d.department_name, 'Unassigned') AS college,
                        COALESCE(d.department_name, 'Unassigned') AS college_name,
                        COALESCE(d.department_code, 'N/A') AS department,
                        COALESCE(d.department_code, 'N/A') AS department_name,
                        COALESCE(pr.program_name, 'Unassigned') AS program,
                        COALESCE(pr.program_name, 'Unassigned') AS program_name,
                        sp.year_level,
                        sp.verification_status,
                        sp.verification_status AS status,
                        u.account_status,
                        u.created_at
                 FROM student_profiles sp
                 JOIN users u ON sp.user_id = u.user_id
                 LEFT JOIN departments d ON sp.department_id = d.department_id
                 LEFT JOIN programs pr ON sp.program_id = pr.program_id
                 ${whereSql}
                 ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            rows = r.rows;
        } else if (category === 'announcements') {
            const params = [];
            const clauses = [`p.post_type = 'announcement'`];

            if (academicYearId && academicYearId !== 'all') {
                params.push(Number(academicYearId));
                clauses.push(`p.academic_year_id = $${params.length}`);
            }
            if (unitId) {
                params.push(unitId);
                clauses.push(`(pg.department_id::text = $${params.length} OR LOWER(d.department_name) = LOWER($${params.length}))`);
            }
            if (catFilter) {
                params.push(catFilter);
                clauses.push(`(pc.category_id::text = $${params.length} OR LOWER(pc.category_name) = LOWER($${params.length}))`);
            }
            if (status) {
                params.push(status);
                clauses.push(`(LOWER(p.status) = LOWER($${params.length}) OR LOWER(p.moderation_status) = LOWER($${params.length}))`);
            }
            if (startDate) {
                params.push(startDate);
                clauses.push(`DATE(p.created_at) >= DATE($${params.length})`);
            }
            if (endDate) {
                params.push(endDate);
                clauses.push(`DATE(p.created_at) <= DATE($${params.length})`);
            }

            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const [cRes, distRes, pillsRes] = await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS cnt
                     FROM posts p
                     LEFT JOIN pages pg ON p.page_id = pg.page_id
                     LEFT JOIN departments d ON pg.department_id = d.department_id
                     LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                     ${whereSql}`,
                    params
                ),
                pool.query(
                    `SELECT COALESCE(pc.category_name, 'General') AS label, COUNT(*)::int AS count
                     FROM posts p
                     LEFT JOIN pages pg ON p.page_id = pg.page_id
                     LEFT JOIN departments d ON pg.department_id = d.department_id
                     LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                     ${whereSql}
                     GROUP BY COALESCE(pc.category_name, 'General')
                     ORDER BY count DESC`,
                    params
                ),
                pool.query(
                    `SELECT
                        COUNT(*)::int AS total_announcements,
                        COUNT(*) FILTER (WHERE LOWER(p.status) = 'published' AND p.is_archived = FALSE)::int AS published,
                        COUNT(*) FILTER (WHERE p.is_archived = TRUE)::int AS archived
                     FROM posts p
                     LEFT JOIN pages pg ON p.page_id = pg.page_id
                     LEFT JOIN departments d ON pg.department_id = d.department_id
                     LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                     ${whereSql}`,
                    params
                )
            ]);

            total = cRes.rows[0].cnt;
            analytics = {
                summaryPills: pillsRes.rows[0] || {},
                distribution: distRes.rows
            };

            params.push(limitNum, offset);
            const r = await pool.query(
                `SELECT p.post_id,
                        p.post_id AS id,
                        p.title,
                        COALESCE(pc.category_name, 'General') AS category,
                        COALESCE(pg.page_name, 'Campus Page') AS source_page,
                        COALESCE(pg.page_name, 'Campus Page') AS page_name,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS author_name,
                        p.audience AS target_scope,
                        p.audience AS target_audience,
                        p.audience,
                        COALESCE(d.department_name, 'University-Wide') AS unit_name,
                        p.status,
                        p.moderation_status AS approval_status,
                        p.created_at AS submitted_at,
                        COALESCE(p.published_at, p.created_at) AS published_at,
                        p.expires_at,
                        p.created_at
                 FROM posts p
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN departments d ON pg.department_id = d.department_id
                 LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                 LEFT JOIN users u ON p.creator_user_id = u.user_id
                 ${whereSql}
                 ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            rows = r.rows;
        } else if (category === 'events') {
            const params = [];
            const clauses = [`p.post_type = 'event'`];

            if (academicYearId && academicYearId !== 'all') {
                params.push(Number(academicYearId));
                clauses.push(`p.academic_year_id = $${params.length}`);
            }
            if (unitId) {
                params.push(unitId);
                clauses.push(`(pg.department_id::text = $${params.length} OR LOWER(d.department_name) = LOWER($${params.length}))`);
            }
            if (catFilter) {
                params.push(catFilter);
                clauses.push(`(pc.category_id::text = $${params.length} OR LOWER(pc.category_name) = LOWER($${params.length}))`);
            }
            if (status) {
                params.push(status);
                clauses.push(`LOWER(p.status) = LOWER($${params.length})`);
            }
            if (startDate) {
                params.push(startDate);
                clauses.push(`DATE(COALESCE(ed.event_date, p.created_at)) >= DATE($${params.length})`);
            }
            if (endDate) {
                params.push(endDate);
                clauses.push(`DATE(COALESCE(ed.event_date, p.created_at)) <= DATE($${params.length})`);
            }

            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const [cRes, distRes, pillsRes] = await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS cnt
                     FROM posts p
                     JOIN event_details ed ON p.post_id = ed.post_id
                     LEFT JOIN pages pg ON p.page_id = pg.page_id
                     LEFT JOIN departments d ON pg.department_id = d.department_id
                     LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                     ${whereSql}`,
                    params
                ),
                pool.query(
                    `SELECT COALESCE(p.status, 'Upcoming') AS label, COUNT(*)::int AS count
                     FROM posts p
                     JOIN event_details ed ON p.post_id = ed.post_id
                     LEFT JOIN pages pg ON p.page_id = pg.page_id
                     LEFT JOIN departments d ON pg.department_id = d.department_id
                     LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                     ${whereSql}
                     GROUP BY COALESCE(p.status, 'Upcoming')
                     ORDER BY count DESC`,
                    params
                ),
                pool.query(
                    `SELECT
                        COUNT(*)::int AS total_events,
                        COUNT(*) FILTER (WHERE LOWER(p.status) = 'upcoming' AND p.is_archived = FALSE)::int AS upcoming,
                        COUNT(*) FILTER (WHERE p.is_archived = TRUE)::int AS archived
                     FROM posts p
                     JOIN event_details ed ON p.post_id = ed.post_id
                     LEFT JOIN pages pg ON p.page_id = pg.page_id
                     LEFT JOIN departments d ON pg.department_id = d.department_id
                     LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                     ${whereSql}`,
                    params
                )
            ]);

            total = cRes.rows[0].cnt;
            analytics = {
                summaryPills: pillsRes.rows[0] || {},
                distribution: distRes.rows
            };

            params.push(limitNum, offset);
            const r = await pool.query(
                `SELECT p.post_id AS event_id,
                        p.post_id AS id,
                        p.title,
                        COALESCE(pc.category_name, 'Campus Event') AS category,
                        COALESCE(ed.organizer_info, pg.page_name, 'Campus Page') AS organizer,
                        COALESCE(ed.organizer_info, pg.page_name, 'Campus Page') AS organizer_name,
                        COALESCE(pg.page_name, 'Campus Page') AS page_name,
                        ed.location AS venue,
                        ed.location,
                        ed.event_date AS start_date,
                        ed.event_date,
                        ed.end_date,
                        ed.capacity,
                        COUNT(DISTINCT er.registration_id)::int AS registered_count,
                        COUNT(DISTINCT er.registration_id)::int AS registration_count,
                        COUNT(DISTINCT ar.attendance_id) FILTER (WHERE UPPER(ar.status) IN ('PRESENT', 'LATE'))::int AS attended_count,
                        p.status,
                        p.created_at
                 FROM posts p
                 JOIN event_details ed ON p.post_id = ed.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN departments d ON pg.department_id = d.department_id
                 LEFT JOIN post_categories pc ON p.category_id = pc.category_id
                 LEFT JOIN event_registrations er ON ed.post_id = er.event_post_id
                 LEFT JOIN event_attendance_records ar ON er.registration_id = ar.registration_id
                 ${whereSql}
                 GROUP BY p.post_id, ed.post_id, pg.page_id, pc.category_id
                 ORDER BY ed.event_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            rows = r.rows;
        } else if (category === 'attendance') {
            const params = [];
            const clauses = [`p.post_type = 'event'`];

            if (academicYearId && academicYearId !== 'all') {
                params.push(Number(academicYearId));
                clauses.push(`p.academic_year_id = $${params.length}`);
            }
            if (unitId) {
                params.push(unitId);
                clauses.push(`(pg.department_id::text = $${params.length} OR LOWER(d.department_name) = LOWER($${params.length}))`);
            }
            if (status) {
                params.push(status);
                clauses.push(`LOWER(COALESCE(ar.status, 'NOT_MARKED')) = LOWER(REPLACE($${params.length}, ' ', '_'))`);
            }
            if (startDate) {
                params.push(startDate);
                clauses.push(`DATE(COALESCE(ar.checkin_time, er.registered_at, ed.event_date)) >= DATE($${params.length})`);
            }
            if (endDate) {
                params.push(endDate);
                clauses.push(`DATE(COALESCE(ar.checkin_time, er.registered_at, ed.event_date)) <= DATE($${params.length})`);
            }

            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const cRes = await pool.query(
                `SELECT COUNT(*)::int AS cnt
                 FROM event_registrations er
                 JOIN posts p ON er.event_post_id = p.post_id
                 JOIN event_details ed ON p.post_id = ed.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN departments d ON pg.department_id = d.department_id
                 LEFT JOIN event_attendance_records ar ON er.registration_id = ar.registration_id
                 ${whereSql}`,
                params
            );
            total = cRes.rows[0].cnt;

            params.push(limitNum, offset);
            const r = await pool.query(
                `SELECT COALESCE(ar.attendance_id, er.registration_id) AS id,
                        COALESCE(ar.attendance_id, er.registration_id) AS attendance_id,
                        p.post_id AS event_id,
                        p.title AS event_title,
                        COALESCE(sp.student_number, 'N/A') AS student_id,
                        u.first_name || ' ' || u.last_name AS student_name,
                        u.email,
                        er.status AS reg_status,
                        COALESCE(ar.status, 'NOT_MARKED') AS attendance_status,
                        COALESCE(ar.checkin_time, er.registered_at) AS marked_at,
                        COALESCE(ar.check_in_method, 'QR / Staff') AS marked_by_name,
                        COALESCE((SELECT eas.status FROM event_attendance_sessions eas WHERE eas.event_post_id = p.post_id ORDER BY eas.open_time DESC NULLS LAST, eas.session_id DESC LIMIT 1), 'CLOSED') AS session_status
                 FROM event_registrations er
                 JOIN posts p ON er.event_post_id = p.post_id
                 JOIN event_details ed ON p.post_id = ed.post_id
                 JOIN users u ON er.registrant_user_id = u.user_id
                 LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN departments d ON pg.department_id = d.department_id
                 LEFT JOIN event_attendance_records ar ON er.registration_id = ar.registration_id
                 ${whereSql}
                 ORDER BY COALESCE(ar.checkin_time, er.registered_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            rows = r.rows;

            const totalPresent = rows.filter(x => ['PRESENT', 'LATE'].includes(String(x.attendance_status || '').toUpperCase())).length;
            analytics = {
                summaryPills: {
                    total_registrations: total,
                    verified_attendance: totalPresent,
                    absent_or_unmarked: Math.max(0, total - totalPresent)
                },
                distribution: [
                    { label: 'Present', count: totalPresent },
                    { label: 'Absent / Not Marked', count: Math.max(0, total - totalPresent) }
                ]
            };
        } else if (category === 'pages') {
            const params = [];
            const clauses = [];

            if (unitId) {
                params.push(unitId);
                clauses.push(`(p.department_id::text = $${params.length} OR LOWER(d.department_name) = LOWER($${params.length}))`);
            }
            if (catFilter) {
                params.push(catFilter);
                clauses.push(`LOWER(p.page_type) = LOWER($${params.length})`);
            }
            if (status) {
                params.push(status);
                clauses.push(`LOWER(p.status) = LOWER($${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM pages p LEFT JOIN departments d ON p.department_id = d.department_id ${whereSql}`, params);
            total = c.rows[0].cnt;

            params.push(limitNum, offset);
            const r = await pool.query(
                `SELECT p.page_id,
                        p.page_id AS id,
                        p.page_name,
                        p.page_name AS name,
                        p.page_code,
                        p.page_type AS category,
                        p.page_type,
                        COALESCE(d.department_name, 'University-Wide') AS college,
                        COALESCE(d.department_name, 'University-Wide') AS unit_name,
                        COALESCE(d.department_code, 'WMSU') AS department,
                        p.status,
                        COALESCE((SELECT u2.first_name || ' ' || u2.last_name FROM page_members pm2 JOIN users u2 ON pm2.user_id = u2.user_id WHERE pm2.page_id = p.page_id AND LOWER(pm2.status) = 'active' LIMIT 1), 'Assigned Staff') AS staff_name,
                        COUNT(DISTINCT pm.page_member_id) FILTER (WHERE LOWER(pm.status) = 'active')::int AS assigned_staff_count,
                        COUNT(DISTINCT po.post_id) FILTER (WHERE po.post_type = 'announcement')::int AS total_announcements,
                        COUNT(DISTINCT po.post_id) FILTER (WHERE po.post_type = 'event')::int AS total_events,
                        COUNT(DISTINCT po.post_id)::int AS total_posts,
                        COUNT(DISTINCT pf.follow_id)::int AS followers_count,
                        p.created_at,
                        COALESCE(MAX(po.created_at), p.updated_at, p.created_at) AS last_activity
                 FROM pages p
                 LEFT JOIN departments d ON p.department_id = d.department_id
                 LEFT JOIN page_members pm ON p.page_id = pm.page_id
                 LEFT JOIN posts po ON p.page_id = po.page_id
                 LEFT JOIN page_follows pf ON p.page_id = pf.page_id
                 ${whereSql}
                 GROUP BY p.page_id, d.department_id
                 ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            rows = r.rows;
            analytics = {
                summaryPills: {
                    total_pages: total,
                    active_pages: rows.filter(x => ['approved', 'active'].includes(String(x.status).toLowerCase())).length
                },
                distribution: rows.slice(0, 6).map(x => ({ label: x.page_name, count: x.total_posts || 0 }))
            };
        } else if (category === 'moderation') {
            const params = [];
            const clauses = [];

            if (status) {
                params.push(status);
                clauses.push(`LOWER(m.decision) = LOWER($${params.length})`);
            }
            if (startDate) {
                params.push(startDate);
                clauses.push(`DATE(m.created_at) >= DATE($${params.length})`);
            }
            if (endDate) {
                params.push(endDate);
                clauses.push(`DATE(m.created_at) <= DATE($${params.length})`);
            }

            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM post_moderation_logs m ${whereSql}`, params);
            total = c.rows[0].cnt;

            params.push(limitNum, offset);
            const r = await pool.query(
                `SELECT m.moderation_id AS item_id,
                        m.moderation_id AS id,
                        p.post_type AS item_type,
                        p.post_type,
                        p.title,
                        COALESCE(creator.first_name || ' ' || creator.last_name, 'Staff') AS submitted_by,
                        COALESCE(creator.first_name || ' ' || creator.last_name, 'Staff') AS submitted_by_name,
                        COALESCE(pg.page_name, 'Campus Page') AS source_page,
                        COALESCE(pg.page_name, 'Campus Page') AS page_name,
                        p.created_at AS submitted_at,
                        m.decision AS current_status,
                        m.decision AS review_status,
                        m.decision,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS reviewed_by,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS reviewed_by_name,
                        COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS reviewer_name,
                        m.created_at AS reviewed_at,
                        m.created_at,
                        COALESCE(m.reason, 'Standard review') AS remarks,
                        COALESCE(m.reason, 'Standard review') AS decision_reason,
                        m.reason
                 FROM post_moderation_logs m
                 JOIN posts p ON m.post_id = p.post_id
                 LEFT JOIN pages pg ON p.page_id = pg.page_id
                 LEFT JOIN users creator ON p.creator_user_id = creator.user_id
                 LEFT JOIN users u ON m.reviewer_user_id = u.user_id
                 ${whereSql}
                 ORDER BY m.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            rows = r.rows;
            analytics = {
                summaryPills: {
                    total_reviews: total,
                    approved: rows.filter(x => String(x.decision).toLowerCase().includes('approv')).length,
                    rejected: rows.filter(x => String(x.decision).toLowerCase().includes('reject')).length
                },
                distribution: [
                    { label: 'Approved', count: rows.filter(x => String(x.decision).toLowerCase().includes('approv')).length },
                    { label: 'Rejected', count: rows.filter(x => String(x.decision).toLowerCase().includes('reject')).length },
                    { label: 'Correction', count: rows.filter(x => String(x.decision).toLowerCase().includes('correction')).length }
                ]
            };
        }

        if (analytics && analytics.summaryPills && !Array.isArray(analytics.summaryPills)) {
            analytics.summaryPills = Object.entries(analytics.summaryPills).map(([k, v]) => ({
                label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                value: v
            }));
        }

        return res.json({
            rows,
            records: rows,
            data: rows,
            analytics,
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Report category error:', error);
        return res.status(500).json({ message: 'Failed to load report data.' });
    }
});

// ============================================================================
// 8. AUDIT LOGS (/api/admin/audit-logs)
// ============================================================================
router.get('/audit-logs/summary', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*)::int AS "totalActions",
                    COUNT(*) FILTER (WHERE UPPER(outcome) = 'SUCCESS')::int AS "successfulActions",
                    COUNT(*) FILTER (WHERE UPPER(outcome) = 'FAILURE')::int AS "failedActions",
                    COUNT(*) FILTER (WHERE is_security_event = TRUE)::int AS "securityEvents"
             FROM audit_logs`
        );
        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch audit log summary.' });
    }
});

function buildAuditFilterClauses(query) {
    const {
        search = '',
        role = '',
        module = '',
        outcome = '',
        securityOnly = 'false',
        startDate = '',
        endDate = '',
        actor = ''
    } = query;

    const params = [];
    const clauses = [];

    if (role && role !== 'ALL') {
        const normRole = String(role).toLowerCase();
        if (normRole.includes('admin')) {
            clauses.push(`LOWER(l.actor_role) IN ('admin', 'administrator')`);
        } else if (normRole.includes('staff')) {
            clauses.push(`LOWER(l.actor_role) IN ('staff', 'page staff')`);
        } else {
            params.push(normRole);
            clauses.push(`LOWER(l.actor_role) = LOWER($${params.length})`);
        }
    }

    if (module && module !== 'ALL') {
        const normMod = String(module).toLowerCase();
        if (normMod.includes('post') || normMod.includes('content') || normMod.includes('approval')) {
            clauses.push(`LOWER(l.module) IN ('posts', 'post approval', 'content feed')`);
        } else if (normMod.includes('page')) {
            clauses.push(`LOWER(l.module) IN ('pages', 'page management')`);
        } else if (normMod.includes('user')) {
            clauses.push(`LOWER(l.module) IN ('users', 'user management')`);
        } else if (normMod.includes('setting') || normMod.includes('academic') || normMod.includes('school')) {
            clauses.push(`LOWER(l.module) IN ('settings', 'system settings')`);
        } else if (normMod.includes('archiv')) {
            clauses.push(`LOWER(l.module) IN ('archives', 'archive')`);
        } else if (normMod.includes('auth') || normMod.includes('security')) {
            clauses.push(`(LOWER(l.module) IN ('auth', 'authentication & security') OR l.is_security_event = TRUE)`);
        } else {
            params.push(normMod);
            clauses.push(`LOWER(l.module) = LOWER($${params.length})`);
        }
    }

    if (outcome && outcome !== 'ALL') {
        params.push(outcome);
        clauses.push(`LOWER(l.outcome) = LOWER($${params.length})`);
    }

    if (String(securityOnly) === 'true') {
        clauses.push(`l.is_security_event = TRUE`);
    }

    if (actor && String(actor).trim()) {
        params.push(`%${String(actor).trim()}%`);
        clauses.push(`((u.first_name || ' ' || u.last_name) ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    if (startDate && String(startDate).trim()) {
        params.push(String(startDate).trim());
        clauses.push(`DATE(l.created_at) >= DATE($${params.length})`);
    }

    if (endDate && String(endDate).trim()) {
        params.push(String(endDate).trim());
        clauses.push(`DATE(l.created_at) <= DATE($${params.length})`);
    }

    if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        clauses.push(`(l.action ILIKE $${params.length} OR l.module ILIKE $${params.length} OR COALESCE(u.email, '') ILIKE $${params.length} OR COALESCE(u.first_name || ' ' || u.last_name, '') ILIKE $${params.length} OR COALESCE(l.target_type, '') ILIKE $${params.length})`);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return { params, whereSql };
}

router.get('/audit-logs', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const { params, whereSql } = buildAuditFilterClauses(req.query);

        const countRes = await pool.query(
            `SELECT COUNT(*)::int AS total FROM audit_logs l LEFT JOIN users u ON l.actor_user_id = u.user_id ${whereSql}`,
            params
        );
        const totalRecords = countRes.rows[0].total;
        const totalPages = Math.max(1, Math.ceil(totalRecords / limitNum));

        params.push(limitNum, offset);
        const logsRes = await pool.query(
            `SELECT l.log_id AS id,
                    l.actor_user_id,
                    l.action,
                    l.module,
                    l.target_type,
                    l.target_type AS resource_type,
                    l.target_id,
                    l.target_id AS resource_id,
                    l.outcome,
                    l.is_security_event,
                    l.ip_address,
                    l.details,
                    l.details AS metadata,
                    COALESCE(l.details->>'title', l.details->>'page_name', CASE WHEN l.target_type IS NOT NULL THEN l.target_type || ' #' || COALESCE(l.target_id::text, '') ELSE l.module END) AS resource_title,
                    COALESCE(l.details->>'reason', l.details->>'remarks', NULL) AS reason,
                    l.created_at,
                    COALESCE(u.first_name || ' ' || u.last_name, 'System') AS actor_name,
                    COALESCE(u.first_name || ' ' || u.last_name, 'System') AS actor_label,
                    COALESCE(u.email, 'system@wmsu.edu.ph') AS actor_email,
                    COALESCE(l.actor_role, 'admin') AS actor_role
             FROM audit_logs l
             LEFT JOIN users u ON l.actor_user_id = u.user_id
             ${whereSql}
             ORDER BY l.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        return res.json({
            logs: logsRes.rows,
            totalRecords,
            totalPages,
            currentPage: pageNum,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Audit logs error:', error);
        return res.status(500).json({ message: 'Failed to load audit logs.' });
    }
});

router.get('/audit-logs/export', async (req, res) => {
    try {
        const { params, whereSql } = buildAuditFilterClauses(req.query);
        const { rows } = await pool.query(
            `SELECT l.log_id,
                    l.created_at,
                    COALESCE(u.first_name || ' ' || u.last_name, 'System') AS actor_name,
                    COALESCE(u.email, 'system@wmsu.edu.ph') AS actor_email,
                    l.actor_role,
                    l.action,
                    l.module,
                    l.target_type,
                    l.target_id,
                    l.outcome,
                    l.ip_address
             FROM audit_logs l
             LEFT JOIN users u ON l.actor_user_id = u.user_id
             ${whereSql}
             ORDER BY l.created_at DESC LIMIT 2500`,
            params
        );

        let csv = 'Log ID,Timestamp,Actor Name,Actor Email,Role,Action,Module,Target Type,Target ID,Outcome,IP Address\n';
        for (const r of rows) {
            csv += [
                toCsvCell(r.log_id),
                toCsvCell(r.created_at ? new Date(r.created_at).toISOString() : ''),
                toCsvCell(r.actor_name),
                toCsvCell(r.actor_email),
                toCsvCell(r.actor_role),
                toCsvCell(r.action),
                toCsvCell(r.module),
                toCsvCell(r.target_type),
                toCsvCell(r.target_id),
                toCsvCell(r.outcome),
                toCsvCell(r.ip_address)
            ].join(',') + '\n';
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
        return res.send(csv);
    } catch (error) {
        console.error('Audit log export error:', error);
        return res.status(500).send('Export failed');
    }
});

// ============================================================================
// 9. SYSTEM SETTINGS & SCHOOL YEAR MANAGEMENT (/api/admin/settings, /academic-years)
// ============================================================================
router.get('/settings', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT s.setting_key, s.setting_value, s.updated_at,
                    u.first_name || ' ' || u.last_name AS updated_by_name
             FROM system_settings s
             LEFT JOIN users u ON s.updated_by = u.user_id`
        );

        const merged = { ...DEFAULT_SETTINGS };
        let latestAt = null;
        let latestBy = null;

        for (const row of rows) {
            merged[row.setting_key] = row.setting_value;
            if (!latestAt || new Date(row.updated_at) > new Date(latestAt)) {
                latestAt = row.updated_at;
                latestBy = row.updated_by_name;
            }
        }

        return res.json({
            settings: merged,
            metadata: { updatedAt: latestAt, updatedBy: latestBy }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load system settings.' });
    }
});

const saveSystemSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        const incoming = req.body.settings || req.body || {};
        await client.query('BEGIN');

        for (const [key, value] of Object.entries(incoming)) {
            if (key in DEFAULT_SETTINGS) {
                await client.query(
                    `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
                     VALUES ($1, $2::jsonb, $3, NOW())
                     ON CONFLICT (setting_key)
                     DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
                    [key, JSON.stringify(value), req.user.user_id]
                );
            }
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: 'Updated System Settings',
            module: 'settings',
            targetType: 'system_settings'
        });

        return res.json({ message: 'System settings saved successfully.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Save settings error:', error);
        return res.status(500).json({ message: 'Failed to save system settings.' });
    } finally {
        client.release();
    }
};
router.put('/settings', saveSystemSettings);
router.post('/settings', saveSystemSettings);

/**
 * Helper: Execute a PostgreSQL transactional School Year Switch & Automatic Data Archiving.
 * - Locks academic_years rows with FOR UPDATE
 * - Archives previous active school year (status = 'Archived', is_active = FALSE, archived_at = NOW())
 * - Activates target school year (status = 'Active', is_active = TRUE)
 * - Archives previous school year's announcements and completed/past events
 * - Preserves ongoing/upcoming events crossing school-year boundaries (and open attendance sessions)
 */
async function executeSchoolYearActivationTransaction(client, targetId, adminUserId, reasonText) {
    // 1. Lock academic_years rows to prevent race conditions
    const allYearsRes = await client.query(
        `SELECT * FROM academic_years ORDER BY academic_year_id ASC FOR UPDATE`
    );
    const targetYear = allYearsRes.rows.find(y => Number(y.academic_year_id) === Number(targetId));
    if (!targetYear) {
        const err = new Error('Selected school year does not exist.');
        err.statusCode = 404;
        throw err;
    }

    const previousActiveYears = allYearsRes.rows.filter(
        y => y.is_active && Number(y.academic_year_id) !== Number(targetId)
    );

    let archivedAnnouncementsCount = 0;
    let archivedEventsCount = 0;
    let preservedCrossYearEventsCount = 0;
    const archivedYearLabels = [];

    for (const prevYear of previousActiveYears) {
        const prevLabel = `${prevYear.start_year}–${prevYear.end_year} (${prevYear.semester})`;
        archivedYearLabels.push(prevLabel);
        const autoArchiveReason = reasonText || `School Year Transition: ${prevLabel} archived upon activating ${targetYear.start_year}–${targetYear.end_year} (${targetYear.semester})`;

        // Associate any legacy unassigned posts created before this transition with the previous active school year
        await client.query(
            `UPDATE posts SET academic_year_id = $1 WHERE academic_year_id IS NULL`,
            [prevYear.academic_year_id]
        );

        // Archive previous school year's non-archived announcements
        const archAnnRes = await client.query(
            `UPDATE posts
             SET previous_status = CASE WHEN status != 'Archived' THEN status ELSE previous_status END,
                 is_archived = TRUE,
                 status = 'Archived',
                 archived_at = NOW(),
                 archived_by = $1,
                 archive_reason = $2,
                 updated_at = NOW()
             WHERE academic_year_id = $3
               AND post_type = 'announcement'
               AND is_archived = FALSE`,
            [adminUserId, autoArchiveReason, prevYear.academic_year_id]
        );
        archivedAnnouncementsCount += archAnnRes.rowCount;

        // Count cross-year ongoing/upcoming events (or events with open attendance sessions) that must remain operational
        const crossEventsRes = await client.query(
            `SELECT COUNT(*)::int AS cnt
             FROM posts p
             LEFT JOIN event_details ed ON p.post_id = ed.post_id
             WHERE p.academic_year_id = $1
               AND p.post_type = 'event'
               AND p.is_archived = FALSE
               AND (
                   LOWER(p.status) = 'ongoing'
                   OR COALESCE(ed.end_date, ed.event_date) >= NOW()
                   OR EXISTS (
                       SELECT 1 FROM event_attendance_sessions eas
                       WHERE eas.event_post_id = p.post_id AND UPPER(eas.status) = 'OPEN'
                   )
               )`,
            [prevYear.academic_year_id]
        );
        preservedCrossYearEventsCount += (crossEventsRes.rows[0]?.cnt || 0);

        // Archive previous school year's completed/past events (without interrupting ongoing/upcoming events or open attendance sessions)
        const archEvtRes = await client.query(
            `UPDATE posts p
             SET previous_status = CASE WHEN p.status != 'Archived' THEN p.status ELSE p.previous_status END,
                 is_archived = TRUE,
                 status = 'Archived',
                 archived_at = NOW(),
                 archived_by = $1,
                 archive_reason = $2,
                 updated_at = NOW()
             FROM event_details ed
             WHERE p.post_id = ed.post_id
               AND p.academic_year_id = $3
               AND p.post_type = 'event'
               AND p.is_archived = FALSE
               AND LOWER(p.status) != 'ongoing'
               AND COALESCE(ed.end_date, ed.event_date) < NOW()
               AND NOT EXISTS (
                   SELECT 1 FROM event_attendance_sessions eas
                   WHERE eas.event_post_id = p.post_id AND UPPER(eas.status) = 'OPEN'
               )`,
            [adminUserId, autoArchiveReason, prevYear.academic_year_id]
        );
        archivedEventsCount += archEvtRes.rowCount;

        // Mark previous active school year as Archived
        await client.query(
            `UPDATE academic_years
             SET is_active = FALSE,
                 status = 'Archived',
                 archived_at = NOW(),
                 updated_by = $1,
                 updated_at = NOW()
             WHERE academic_year_id = $2`,
            [adminUserId, prevYear.academic_year_id]
        );
    }

    // Activate the selected school year
    const activeUpdRes = await client.query(
        `UPDATE academic_years
         SET is_active = TRUE,
             status = 'Active',
             archived_at = NULL,
             updated_by = $1,
             updated_at = NOW()
         WHERE academic_year_id = $2
         RETURNING academic_year_id AS id, academic_year_id, start_year, end_year, semester, start_date, end_date, status, is_active, archived_at, created_at, updated_at`,
        [adminUserId, targetId]
    );

    return {
        activatedYear: activeUpdRes.rows[0],
        previousArchivedYears: archivedYearLabels,
        archivedAnnouncementsCount,
        archivedEventsCount,
        preservedCrossYearEventsCount
    };
}

router.get('/academic-years', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const params = [];
        const clauses = [];

        if (status && status !== 'all') {
            params.push(status);
            clauses.push(`LOWER(ay.status) = LOWER($${params.length})`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            clauses.push(`((ay.start_year || '-' || ay.end_year) ILIKE $${params.length} OR (ay.start_year || '–' || ay.end_year) ILIKE $${params.length} OR ay.semester ILIKE $${params.length} OR ay.status ILIKE $${params.length})`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const [allRes, countRes] = await Promise.all([
            pool.query(
                `SELECT ay.academic_year_id AS id,
                        ay.academic_year_id,
                        ay.start_year,
                        ay.end_year,
                        ay.semester,
                        ay.start_date,
                        ay.end_date,
                        COALESCE(ay.status, CASE WHEN ay.is_active THEN 'Active' ELSE 'Archived' END) AS status,
                        ay.is_active,
                        ay.archived_at,
                        ay.created_at,
                        ay.updated_at,
                        COALESCE(u.first_name || ' ' || u.last_name, 'System Admin') AS updated_by_name,
                        COUNT(p.post_id) FILTER (WHERE p.post_type = 'announcement')::int AS announcements_count,
                        COUNT(p.post_id) FILTER (WHERE p.post_type = 'event')::int AS events_count,
                        COUNT(p.post_id) FILTER (WHERE p.is_archived = TRUE)::int AS archived_posts_count
                 FROM academic_years ay
                 LEFT JOIN users u ON ay.updated_by = u.user_id
                 LEFT JOIN posts p ON ay.academic_year_id = p.academic_year_id
                 ${whereSql}
                 GROUP BY ay.academic_year_id, u.user_id
                 ORDER BY ay.is_active DESC, ay.start_year DESC, ay.academic_year_id DESC`
            , params),
            pool.query(`SELECT COUNT(*)::int AS total FROM academic_years ay ${whereSql}`, params)
        ]);

        const total = countRes.rows[0]?.total || 0;
        const pagedRows = allRes.rows.slice(offset, offset + limitNum);

        // Always fetch the active school year even if filtered out in table
        const activeRes = await pool.query(
            `SELECT academic_year_id AS id, academic_year_id, start_year, end_year, semester, start_date, end_date,
                    COALESCE(status, CASE WHEN is_active THEN 'Active' ELSE 'Archived' END) AS status,
                    is_active, archived_at, created_at, updated_at
             FROM academic_years
             WHERE is_active = TRUE
             ORDER BY academic_year_id DESC LIMIT 1`
        );

        const active = activeRes.rows[0] || allRes.rows[0] || {
            start_year: 2026,
            end_year: 2027,
            semester: '1st Semester',
            status: 'Active',
            is_active: true
        };

        return res.json({
            current: active,
            activePeriod: active,
            history: allRes.rows,
            items: pagedRows,
            pagination: {
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                total,
                totalRecords: total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (error) {
        console.error('Fetch academic years error:', error);
        return res.status(500).json({ message: 'Failed to load academic years.' });
    }
});

const saveAcademicYear = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            start_year,
            end_year,
            semester = '1st Semester',
            start_date,
            end_date,
            status,
            is_active = false,
            set_active = false,
            reason
        } = req.body;

        const sYear = Number(start_year);
        const eYear = Number(end_year);

        if (!sYear || !eYear || sYear < 2000 || sYear > 2100) {
            return res.status(400).json({ message: 'Please provide a valid start year and end year.' });
        }
        if (eYear !== sYear + 1) {
            return res.status(400).json({ message: 'End year must be exactly Start Year + 1 (e.g., 2026–2027).' });
        }

        const effectiveStartDate = start_date || `${sYear}-08-01`;
        const effectiveEndDate = end_date || `${eYear}-05-31`;

        if (new Date(effectiveStartDate) >= new Date(effectiveEndDate)) {
            return res.status(400).json({ message: 'Start date must be earlier than end date.' });
        }

        const shouldActivate = Boolean(is_active || set_active || String(status).toLowerCase() === 'active');
        const initialStatus = shouldActivate
            ? 'Upcoming'
            : (['Archived', 'Upcoming', 'Inactive'].includes(status) ? status : 'Upcoming');

        await client.query('BEGIN');

        // Check duplicate (start_year, end_year, semester)
        const dupRes = await client.query(
            `SELECT academic_year_id, is_active FROM academic_years
             WHERE start_year = $1 AND end_year = $2 AND LOWER(semester) = LOWER($3)
             LIMIT 1`,
            [sYear, eYear, semester.trim()]
        );

        let targetAcademicYearId = null;
        let createdNew = false;

        if (dupRes.rowCount > 0) {
            if (!shouldActivate) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    message: `School Year ${sYear}–${eYear} (${semester}) already exists.`
                });
            }
            targetAcademicYearId = dupRes.rows[0].academic_year_id;
            await client.query(
                `UPDATE academic_years
                 SET start_date = COALESCE($1, start_date),
                     end_date = COALESCE($2, end_date),
                     updated_by = $3,
                     updated_at = NOW()
                 WHERE academic_year_id = $4`,
                [effectiveStartDate, effectiveEndDate, req.user.user_id, targetAcademicYearId]
            );
        } else {
            const ins = await client.query(
                `INSERT INTO academic_years (start_year, end_year, semester, start_date, end_date, status, is_active, updated_by)
                 VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
                 RETURNING academic_year_id AS id, academic_year_id, start_year, end_year, semester, start_date, end_date, status, is_active, created_at`,
                [sYear, eYear, semester.trim(), effectiveStartDate, effectiveEndDate, initialStatus, req.user.user_id]
            );
            targetAcademicYearId = ins.rows[0].academic_year_id;
            createdNew = true;
        }

        let transitionSummary = null;
        let resultRow = null;

        if (shouldActivate) {
            transitionSummary = await executeSchoolYearActivationTransaction(
                client,
                targetAcademicYearId,
                req.user.user_id,
                reason
            );
            resultRow = transitionSummary.activatedYear;
        } else {
            const fetched = await client.query(
                `SELECT academic_year_id AS id, academic_year_id, start_year, end_year, semester, start_date, end_date, status, is_active, created_at
                 FROM academic_years WHERE academic_year_id = $1`,
                [targetAcademicYearId]
            );
            resultRow = fetched.rows[0];
        }

        await client.query('COMMIT');

        await logAudit(req, {
            action: shouldActivate
                ? `Activated School Year ${sYear}–${eYear} (${semester}) & Archived Previous Year`
                : `Created School Year ${sYear}–${eYear} (${semester})`,
            module: 'settings',
            targetType: 'academic_year',
            targetId: targetAcademicYearId,
            details: transitionSummary || { start_year: sYear, end_year: eYear, semester, status: resultRow.status }
        });

        return res.status(createdNew ? 201 : 200).json({
            message: shouldActivate
                ? `School Year ${sYear}–${eYear} (${semester}) is now Active. Previous school year data has been archived.`
                : `School Year ${sYear}–${eYear} (${semester}) created successfully.`,
            current: resultRow,
            activePeriod: resultRow,
            transitionSummary
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Save academic year error:', error);
        return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to save school year.' });
    } finally {
        client.release();
    }
};
router.post('/academic-years', saveAcademicYear);
router.put('/academic-years', saveAcademicYear);

router.put('/academic-years/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const ayId = Number(req.params.id);
        const { start_year, end_year, semester, start_date, end_date, status } = req.body;

        const existingRes = await client.query(`SELECT * FROM academic_years WHERE academic_year_id = $1`, [ayId]);
        if (existingRes.rowCount === 0) {
            return res.status(404).json({ message: 'School year not found.' });
        }
        const existing = existingRes.rows[0];

        const sYear = start_year ? Number(start_year) : existing.start_year;
        const eYear = end_year ? Number(end_year) : existing.end_year;
        const sem = semester ? semester.trim() : existing.semester;
        const sDate = start_date || existing.start_date || `${sYear}-08-01`;
        const eDate = end_date || existing.end_date || `${eYear}-05-31`;

        if (eYear !== sYear + 1) {
            return res.status(400).json({ message: 'End year must be Start Year + 1.' });
        }
        if (new Date(sDate) >= new Date(eDate)) {
            return res.status(400).json({ message: 'Start date must be earlier than end date.' });
        }

        // Check duplicate against other rows
        const dupCheck = await client.query(
            `SELECT academic_year_id FROM academic_years
             WHERE start_year = $1 AND end_year = $2 AND LOWER(semester) = LOWER($3) AND academic_year_id != $4`,
            [sYear, eYear, sem, ayId]
        );
        if (dupCheck.rowCount > 0) {
            return res.status(409).json({ message: `School Year ${sYear}–${eYear} (${sem}) already exists.` });
        }

        const nextStatus = existing.is_active
            ? 'Active'
            : (['Archived', 'Upcoming', 'Inactive'].includes(status) ? status : existing.status);

        const upd = await client.query(
            `UPDATE academic_years
             SET start_year = $1,
                 end_year = $2,
                 semester = $3,
                 start_date = $4,
                 end_date = $5,
                 status = $6,
                 updated_by = $7,
                 updated_at = NOW()
             WHERE academic_year_id = $8
             RETURNING academic_year_id AS id, academic_year_id, start_year, end_year, semester, start_date, end_date, status, is_active, archived_at, created_at, updated_at`,
            [sYear, eYear, sem, sDate, eDate, nextStatus, req.user.user_id, ayId]
        );

        await logAudit(req, {
            action: `Edited School Year ${sYear}–${eYear} (${sem})`,
            module: 'settings',
            targetType: 'academic_year',
            targetId: ayId,
            details: { start_year: sYear, end_year: eYear, semester: sem, start_date: sDate, end_date: eDate }
        });

        return res.json({ message: 'School year updated successfully.', item: upd.rows[0] });
    } catch (error) {
        console.error('Update academic year error:', error);
        return res.status(500).json({ message: 'Failed to update school year.' });
    } finally {
        client.release();
    }
});

const handleActivateAcademicYear = async (req, res) => {
    const client = await pool.connect();
    try {
        const targetId = Number(req.params.id);
        const { reason } = req.body || {};

        await client.query('BEGIN');

        const checkRes = await client.query(
            `SELECT * FROM academic_years WHERE academic_year_id = $1 FOR UPDATE`,
            [targetId]
        );
        if (checkRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'School year not found.' });
        }
        if (checkRes.rows[0].is_active) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'This school year is already active.' });
        }

        const transitionSummary = await executeSchoolYearActivationTransaction(
            client,
            targetId,
            req.user.user_id,
            reason
        );

        await client.query('COMMIT');

        const active = transitionSummary.activatedYear;
        await logAudit(req, {
            action: `Switched Active School Year to ${active.start_year}–${active.end_year} (${active.semester})`,
            module: 'settings',
            targetType: 'academic_year',
            targetId: targetId,
            details: transitionSummary
        });

        return res.json({
            message: `Activated School Year ${active.start_year}–${active.end_year} (${active.semester}). Previous school year data (${transitionSummary.archivedAnnouncementsCount} announcements, ${transitionSummary.archivedEventsCount} completed events) has been archived.`,
            current: active,
            activePeriod: active,
            transitionSummary
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Activate academic year error:', error);
        return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to activate school year.' });
    } finally {
        client.release();
    }
};
router.post('/academic-years/:id/activate', handleActivateAcademicYear);
router.put('/academic-years/:id/activate', handleActivateAcademicYear);
router.patch('/academic-years/:id/activate', handleActivateAcademicYear);

// Categories & Colleges/Departments Management in System Settings
router.get('/categories', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT pc.category_id AS id,
                    pc.category_name AS name,
                    pc.description,
                    COUNT(p.post_id)::int AS posts_count
             FROM post_categories pc
             LEFT JOIN posts p ON pc.category_id = p.category_id
             GROUP BY pc.category_id
             ORDER BY pc.category_id ASC`
        );
        return res.json({ categories: rows });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load categories.' });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ message: 'Category name is required.' });
        }
        const ins = await pool.query(
            `INSERT INTO post_categories (category_name, description)
             VALUES ($1, $2)
             RETURNING category_id AS id, category_name AS name, description`,
            [String(name).trim(), description || '']
        );
        await logAudit(req, {
            action: `Created Category (${name})`,
            module: 'settings',
            targetType: 'category',
            targetId: ins.rows[0].id
        });
        return res.status(201).json({ message: 'Category created.', category: ins.rows[0] });
    } catch (error) {
        return res.status(400).json({ message: 'Category already exists or invalid input.' });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const catId = Number(req.params.id);
        const { name, description } = req.body;
        const upd = await pool.query(
            `UPDATE post_categories
             SET category_name = COALESCE($1, category_name),
                 description = COALESCE($2, description)
             WHERE category_id = $3
             RETURNING category_id AS id, category_name AS name, description`,
            [name ? String(name).trim() : null, description !== undefined ? description : null, catId]
        );
        await logAudit(req, {
            action: `Updated Category #${catId}`,
            module: 'settings',
            targetType: 'category',
            targetId: catId
        });
        return res.json({ message: 'Category updated.', category: upd.rows[0] });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update category.' });
    }
});

router.get('/departments', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT d.department_id AS id,
                    d.department_code AS code,
                    d.department_name AS name,
                    d.status,
                    COUNT(DISTINCT sp.user_id)::int AS students_count,
                    COUNT(DISTINCT pr.program_id)::int AS programs_count
             FROM departments d
             LEFT JOIN student_profiles sp ON d.department_id = sp.department_id
             LEFT JOIN programs pr ON d.department_id = pr.department_id
             GROUP BY d.department_id
             ORDER BY d.department_name ASC`
        );
        return res.json({ departments: rows });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load colleges/departments.' });
    }
});

router.post('/departments', async (req, res) => {
    try {
        const { code, name, status = 'Active' } = req.body;
        if (!code || !name) {
            return res.status(400).json({ message: 'Department code and name are required.' });
        }
        const ins = await pool.query(
            `INSERT INTO departments (department_code, department_name, status)
             VALUES ($1, $2, $3)
             RETURNING department_id AS id, department_code AS code, department_name AS name, status`,
            [String(code).trim().toUpperCase(), String(name).trim(), status]
        );
        await logAudit(req, {
            action: `Created College/Department (${code})`,
            module: 'settings',
            targetType: 'department',
            targetId: ins.rows[0].id
        });
        return res.status(201).json({ message: 'College/Department created.', department: ins.rows[0] });
    } catch (error) {
        return res.status(400).json({ message: 'College/Department code or name already exists.' });
    }
});

router.put('/departments/:id', async (req, res) => {
    try {
        const deptId = Number(req.params.id);
        const { code, name, status } = req.body;
        const upd = await pool.query(
            `UPDATE departments
             SET department_code = COALESCE($1, department_code),
                 department_name = COALESCE($2, department_name),
                 status = COALESCE($3, status)
             WHERE department_id = $4
             RETURNING department_id AS id, department_code AS code, department_name AS name, status`,
            [code ? String(code).trim().toUpperCase() : null, name ? String(name).trim() : null, status || null, deptId]
        );
        await logAudit(req, {
            action: `Updated College/Department #${deptId}`,
            module: 'settings',
            targetType: 'department',
            targetId: deptId
        });
        return res.json({ message: 'College/Department updated.', department: upd.rows[0] });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update college/department.' });
    }
});

module.exports = router;
