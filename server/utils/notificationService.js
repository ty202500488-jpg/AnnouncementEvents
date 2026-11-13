const { isEmailConfigured, sendNotificationEmail } = require('./emailService');

const DEFAULT_STUDENT_PREFS = Object.freeze({
    universityAnnouncements: true,
    collegeAnnouncements: true,
    departmentAnnouncements: true,
    followedPages: true,
    upcomingEvents: true,
    eventReminders: true,
    eventUpdates: true,
    registrationUpdates: true
});

const DEFAULT_STAFF_PREFS = Object.freeze({
    universityAnnouncements: true,
    departmentAnnouncements: true,
    pageSubmissions: true,
    eventApprovalAlerts: true,
    attendanceReports: true,
    moderationAlerts: true,
    systemBroadcasts: true
});

const DEFAULT_MYPAGE_PREFS = Object.freeze({
    eventRegistrationAlerts: true,
    publicationStatusUpdates: true,
    emailNotifications: false,
    publicFollowersVisible: true,
    allowStudentComments: true
});

let schemaEnsuredPromise = null;

/**
 * Idempotently ensure notification preference columns and indexes exist in PostgreSQL.
 */
function ensureNotificationSchema(pool) {
    if (!schemaEnsuredPromise) {
        schemaEnsuredPromise = (async () => {
            await pool.query(
                `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb NOT NULL;`
            );
            await pool.query(
                `ALTER TABLE pages ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb NOT NULL;`
            );
            await pool.query(
                `CREATE INDEX IF NOT EXISTS idx_notifications_scope_recipient
                 ON notifications (recipient_user_id, notification_scope, is_archived, created_at DESC);`
            );
            await pool.query(
                `CREATE INDEX IF NOT EXISTS idx_notifications_post_type
                 ON notifications (recipient_user_id, post_id, type);`
            );
        })().catch((err) => {
            schemaEnsuredPromise = null;
            throw err;
        });
    }
    return schemaEnsuredPromise;
}

function parseBool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return fallback;
}

function parseJsonObject(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof raw === 'object' ? raw : {};
}

function isStaffRole(roleName) {
    const r = String(roleName || '').toLowerCase();
    return r === 'staff' || r === 'admin';
}

function normalizeUserPrefs(raw, roleName) {
    const defaults = isStaffRole(roleName) ? DEFAULT_STAFF_PREFS : DEFAULT_STUDENT_PREFS;
    const obj = parseJsonObject(raw);
    const normalized = {};
    for (const [key, defVal] of Object.entries(defaults)) {
        normalized[key] = obj[key] !== undefined ? parseBool(obj[key], defVal) : defVal;
    }
    if (isStaffRole(roleName)) {
        // Matches Staff Settings FAQ: system broadcasts cannot be disabled.
        normalized.systemBroadcasts = true;
    }
    return normalized;
}

function normalizePagePrefs(raw) {
    const obj = parseJsonObject(raw);
    const normalized = {};
    for (const [key, defVal] of Object.entries(DEFAULT_MYPAGE_PREFS)) {
        normalized[key] = obj[key] !== undefined ? parseBool(obj[key], defVal) : defVal;
    }
    return normalized;
}

async function getGlobalNotificationSettings(db) {
    const result = {
        enable_in_app_notifications: true,
        enable_email_notifications: false,
        notify_pending_approval: true,
        notify_student_verification: true
    };
    try {
        const { rows } = await db.query(
            `SELECT setting_key, setting_value
             FROM system_settings
             WHERE setting_key IN (
                'enable_in_app_notifications',
                'enable_email_notifications',
                'notify_pending_approval',
                'notify_student_verification'
             )`
        );
        for (const row of rows) {
            if (row.setting_key in result) {
                result[row.setting_key] = parseBool(row.setting_value, result[row.setting_key]);
            }
        }
    } catch (err) {
        console.warn('Warning: failed to read global notification settings:', err.message);
    }
    return result;
}

async function getUserNotificationPreferences(db, userId, roleName) {
    await ensureNotificationSchema(db);
    const { rows } = await db.query(
        `SELECT u.notification_preferences, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = $1
         LIMIT 1`,
        [userId]
    );
    if (rows.length === 0) {
        return normalizeUserPrefs({}, roleName);
    }
    return normalizeUserPrefs(rows[0].notification_preferences, roleName || rows[0].role_name);
}

async function updateUserNotificationPreferences(db, userId, roleName, incomingUpdates = {}) {
    await ensureNotificationSchema(db);
    const { rows } = await db.query(
        `SELECT u.notification_preferences, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = $1
         LIMIT 1`,
        [userId]
    );
    if (rows.length === 0) {
        return null;
    }
    const effectiveRole = roleName || rows[0].role_name;
    const current = normalizeUserPrefs(rows[0].notification_preferences, effectiveRole);
    const updates = parseJsonObject(incomingUpdates);
    const merged = { ...current };

    for (const key of Object.keys(current)) {
        if (updates[key] !== undefined) {
            merged[key] = parseBool(updates[key], current[key]);
        }
    }
    if (isStaffRole(effectiveRole)) {
        merged.systemBroadcasts = true;
    }

    await db.query(
        `UPDATE users
         SET notification_preferences = $1::jsonb,
             updated_at = NOW()
         WHERE user_id = $2`,
        [JSON.stringify(merged), userId]
    );

    return merged;
}

function resolveNotificationUrl(row = {}) {
    const scope = String(row.notification_scope || '').toLowerCase();
    const type = String(row.type || '').toLowerCase();
    const postType = String(row.post_type || '').toLowerCase();
    const pageId = row.page_id ? Number(row.page_id) : null;
    const postId = row.post_id ? Number(row.post_id) : null;

    if (scope === 'admin') {
        if (type === 'verification') return '/admin/users?tab=verification';
        if (type === 'page' || type === 'page_request') return '/admin/pages/requests';
        return '/admin/post-approval?tab=pending';
    }

    if (scope === 'mypage') {
        if (type === 'registration') return '/staff/mypage/registrations';
        if (type === 'attendance') return '/staff/mypage/attendance';
        if (type === 'page') return '/staff/mypage/dashboard';
        if (type === 'moderation' || postId) {
            if (postType === 'event') return '/staff/mypage/events';
            if (postType === 'announcement') return '/staff/mypage/announcements';
            return '/staff/mypage/dashboard';
        }
        return '/staff/mypage/notifications';
    }

    if (scope === 'staff') {
        if (type === 'registration' || type === 'reminder') return '/staff/my-events';
        if (type === 'attendance') return '/staff/mypage/attendance';
        if (type === 'page') return '/staff/mypage/dashboard';
        if (type === 'moderation') {
            if (postType === 'event') return '/staff/mypage/events';
            return '/staff/mypage/announcements';
        }
        if (postId) {
            if (postType === 'event' || type === 'event' || type === 'event_update') {
                return `/staff/events?postId=${postId}`;
            }
            return `/staff/dashboard?postId=${postId}`;
        }
        if (pageId) return `/staff/page/${pageId}`;
        return '/staff/notifications';
    }

    // Student scope (default)
    if (type === 'verification') return '/student/profile';
    if (type === 'registration' || type === 'reminder') return '/student/my-events';
    if (type === 'event_update') return postId ? `/student/events?postId=${postId}` : '/student/my-events';
    if (postId) {
        if (postType === 'event' || type === 'event') {
            return `/student/events?postId=${postId}`;
        }
        return `/student/dashboard?postId=${postId}`;
    }
    if (pageId) return `/student/page/${pageId}`;
    return '/student/notifications';
}

function formatNotificationRow(row) {
    return {
        id: row.notification_id,
        notification_id: row.notification_id,
        recipient_user_id: row.recipient_user_id,
        actor_user_id: row.actor_user_id || null,
        page_id: row.page_id || null,
        post_id: row.post_id || null,
        post_type: row.post_type || null,
        notification_scope: row.notification_scope,
        type: row.type,
        title: row.title || row.page_name || 'Campus Notification',
        message: row.message,
        page_name: row.page_name || 'Campus System',
        is_read: Boolean(row.is_read),
        read_at: row.read_at || null,
        is_archived: Boolean(row.is_archived),
        created_at: row.created_at,
        url: resolveNotificationUrl(row)
    };
}

async function insertBatchNotifications(db, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;

    const recipients = [];
    const actors = [];
    const pages = [];
    const posts = [];
    const scopes = [];
    const types = [];
    const titles = [];
    const messages = [];

    for (const r of rows) {
        if (!r.recipientUserId) continue;
        recipients.push(Number(r.recipientUserId));
        actors.push(r.actorUserId ? Number(r.actorUserId) : null);
        pages.push(r.pageId ? Number(r.pageId) : null);
        posts.push(r.postId ? Number(r.postId) : null);
        scopes.push(r.scope);
        types.push(r.type);
        titles.push(String(r.title || 'Notification').slice(0, 200));
        messages.push(String(r.message || ''));
    }

    if (recipients.length === 0) return 0;

    const res = await db.query(
        `INSERT INTO notifications (
            recipient_user_id, actor_user_id, page_id, post_id,
            notification_scope, type, title, message
         )
         SELECT * FROM UNNEST(
            $1::int[], $2::int[], $3::int[], $4::int[],
            $5::varchar[], $6::varchar[], $7::varchar[], $8::text[]
         )`,
        [recipients, actors, pages, posts, scopes, types, titles, messages]
    );
    return res.rowCount || 0;
}

/**
 * Notify active admins when content or a page submission enters the approval queue.
 */
async function notifyAdminsPendingContent(db, { actorUserId = null, pageId = null, postId = null, targetType = 'announcement', title = '', expiresAt = null, pageName = '' }) {
    try {
        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications || !globalSettings.notify_pending_approval) {
            return 0;
        }

        const kind = String(targetType || 'announcement').toLowerCase();
        let notifType = 'moderation';
        let notifTitle;
        let notifMsg;

        if (kind === 'page' || kind === 'page_request') {
            notifType = 'page';
            notifTitle = `New Page Approval Request: ${title}`;
            notifMsg = `Staff submitted "${title}" for campus page approval.`;
        } else {
            const label = kind === 'event' ? 'Event' : 'Announcement';
            if (expiresAt) {
                const expiryLabel = new Date(expiresAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
                notifTitle = `University-Wide ${label} Request: ${title}`;
                notifMsg = `A staff member requested University-Wide Spotlight approval for "${title}" (Active until ${expiryLabel}).`;
            } else {
                notifTitle = `Pending ${label} Review: ${title}`;
                notifMsg = `${pageName ? `${pageName} submitted` : 'A staff member submitted'} "${title}" for administrator review.`;
            }
        }

        const res = await db.query(
            `INSERT INTO notifications (recipient_user_id, actor_user_id, page_id, post_id, notification_scope, type, title, message)
             SELECT u.user_id, $1, $2, $3, 'admin', $4, $5, $6
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE LOWER(r.role_name) = 'admin'
               AND LOWER(u.account_status) = 'active'`,
            [actorUserId || null, pageId || null, postId || null, notifType, notifTitle.slice(0, 200), notifMsg]
        );
        return res.rowCount || 0;
    } catch (err) {
        console.warn('Warning: notifyAdminsPendingContent failed:', err.message);
        return 0;
    }
}

/**
 * Notify active admins when a student enters or re-enters the COR & ID verification queue.
 */
async function notifyAdminsStudentVerification(db, { studentUserId, studentName, studentNumber = '', isResubmission = false }) {
    try {
        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications || !globalSettings.notify_student_verification) {
            return 0;
        }

        const displayName = studentName || 'A student';
        const idTag = studentNumber ? ` (${studentNumber})` : '';
        const notifTitle = isResubmission
            ? `COR & ID Resubmitted: ${displayName}`
            : `New Student Verification Pending: ${displayName}`;
        const notifMsg = isResubmission
            ? `${displayName}${idTag} resubmitted updated COR and Student ID photos for verification.`
            : `${displayName}${idTag} confirmed their email and is awaiting COR & Student ID verification.`;

        const res = await db.query(
            `INSERT INTO notifications (recipient_user_id, actor_user_id, notification_scope, type, title, message)
             SELECT u.user_id, $1, 'admin', 'verification', $2, $3
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE LOWER(r.role_name) = 'admin'
               AND LOWER(u.account_status) = 'active'`,
            [studentUserId || null, notifTitle.slice(0, 200), notifMsg]
        );
        return res.rowCount || 0;
    } catch (err) {
        console.warn('Warning: notifyAdminsStudentVerification failed:', err.message);
        return 0;
    }
}

/**
 * Fan out notifications when a post is published or approved for students and staff,
 * honoring Admin global switches and each recipient's saved category preferences.
 */
async function notifyPublishedPost(db, { post, page = null, actorUserId = null }) {
    try {
        if (!post || !post.post_id) return 0;
        if (post.is_archived) return 0;
        if (String(post.moderation_status || '').toLowerCase() !== 'approved') return 0;

        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications) {
            return 0;
        }

        let pageInfo = page;
        if (!pageInfo || !pageInfo.page_name || pageInfo.page_type === undefined) {
            const pgRes = await db.query(
                `SELECT pg.page_id, pg.page_name, pg.page_type, pg.department_id, pg.organization_id,
                        org.department_id AS org_department_id
                 FROM pages pg
                 LEFT JOIN organizations org ON pg.organization_id = org.organization_id
                 WHERE pg.page_id = $1
                 LIMIT 1`,
                [post.page_id]
            );
            pageInfo = pgRes.rows[0] || {
                page_id: post.page_id,
                page_name: 'WMSU Campus Hub',
                page_type: 'office',
                department_id: null,
                org_department_id: null
            };
        }

        const postType = String(post.post_type || 'announcement').toLowerCase();
        const isEvent = postType === 'event';
        const audienceNorm = String(post.audience || 'All Campus').toLowerCase();
        const isStudentsOnly = audienceNorm === 'students only' || audienceNorm === 'all students';
        const isStaffOnly = audienceNorm.includes('faculty') || audienceNorm.includes('staff');
        const studentsAllowed = !isStaffOnly;
        const staffAllowed = !isStudentsOnly;

        const pageDeptId = pageInfo.department_id ? Number(pageInfo.department_id) : null;
        const orgDeptId = pageInfo.org_department_id ? Number(pageInfo.org_department_id) : null;
        const effectiveDeptId = pageDeptId || orgDeptId;
        const pageTypeLower = String(pageInfo.page_type || '').toLowerCase();
        const isSpotlightPost = Boolean(post.is_university_wide);
        const isUniversityAnnouncement = !isEvent && (
            isSpotlightPost ||
            audienceNorm === 'university-wide' ||
            pageTypeLower === 'office'
        );

        const { rows: candidates } = await db.query(
            `SELECT u.user_id,
                    u.notification_preferences,
                    r.role_name,
                    sp.department_id AS student_department_id,
                    EXISTS(
                        SELECT 1 FROM page_follows pf
                        WHERE pf.page_id = $1 AND pf.follower_user_id = u.user_id
                    ) AS is_following,
                    EXISTS(
                        SELECT 1
                        FROM pages mp
                        LEFT JOIN organizations mo ON mp.organization_id = mo.organization_id
                        LEFT JOIN page_members pm ON mp.page_id = pm.page_id AND pm.user_id = u.user_id AND LOWER(pm.status) = 'active'
                        WHERE (mp.created_by = u.user_id OR pm.user_id = u.user_id)
                          AND $2::int IS NOT NULL
                          AND COALESCE(mp.department_id, mo.department_id) = $2::int
                    ) AS staff_same_dept
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
             WHERE LOWER(u.account_status) = 'active'
               AND LOWER(r.role_name) IN ('student', 'staff')
               AND NOT EXISTS (
                   SELECT 1 FROM notifications existing
                   WHERE existing.recipient_user_id = u.user_id
                     AND existing.post_id = $3
                     AND existing.type IN ('announcement', 'event')
               )`,
            [pageInfo.page_id, effectiveDeptId, post.post_id]
        );

        const notifType = isEvent ? 'event' : 'announcement';
        const titlePrefix = isSpotlightPost
            ? (isEvent ? 'University-Wide Event' : 'University-Wide Announcement')
            : (isEvent ? 'New Campus Event' : 'New Announcement');
        const notifTitle = `${titlePrefix}: ${post.title}`;
        const notifMsg = isEvent
            ? `${pageInfo.page_name} published a new event: "${post.title}".`
            : `${pageInfo.page_name} posted: "${post.title}".`;

        const toInsert = [];

        for (const c of candidates) {
            const uid = Number(c.user_id);
            if (actorUserId && uid === Number(actorUserId)) continue;
            if (post.creator_user_id && uid === Number(post.creator_user_id)) continue;

            const role = String(c.role_name || '').toLowerCase();
            const prefs = normalizeUserPrefs(c.notification_preferences, role);
            const isFollower = Boolean(c.is_following);
            const userDeptId = c.student_department_id ? Number(c.student_department_id) : null;

            if (role === 'student') {
                if (!studentsAllowed) continue;

                let allow = false;
                if (isEvent) {
                    allow = Boolean(prefs.upcomingEvents || (isFollower && prefs.followedPages));
                } else if (isSpotlightPost) {
                    // Explicit user decision: students can mute university-wide announcements.
                    allow = Boolean(prefs.universityAnnouncements);
                } else {
                    const matchesCollege = Boolean(pageDeptId && userDeptId && pageDeptId === userDeptId && prefs.collegeAnnouncements);
                    const matchesDeptOrg = Boolean(orgDeptId && userDeptId && orgDeptId === userDeptId && prefs.departmentAnnouncements);
                    const matchesOffice = Boolean(pageTypeLower === 'office' && prefs.universityAnnouncements);
                    const matchesFollow = Boolean(isFollower && prefs.followedPages);
                    allow = matchesCollege || matchesDeptOrg || matchesOffice || matchesFollow;
                }

                if (allow) {
                    toInsert.push({
                        recipientUserId: uid,
                        actorUserId: actorUserId || post.creator_user_id || null,
                        pageId: pageInfo.page_id,
                        postId: post.post_id,
                        scope: 'student',
                        type: notifType,
                        title: notifTitle,
                        message: notifMsg
                    });
                }
            } else if (role === 'staff') {
                if (!staffAllowed) continue;

                let allow = false;
                if (isEvent) {
                    allow = Boolean(prefs.eventApprovalAlerts || (isFollower && prefs.departmentAnnouncements));
                } else if (isSpotlightPost || isUniversityAnnouncement) {
                    allow = Boolean(prefs.universityAnnouncements);
                } else {
                    const sameDept = Boolean(c.staff_same_dept || (effectiveDeptId && userDeptId && effectiveDeptId === userDeptId));
                    allow = Boolean((sameDept || isFollower) && prefs.departmentAnnouncements);
                }

                if (allow) {
                    toInsert.push({
                        recipientUserId: uid,
                        actorUserId: actorUserId || post.creator_user_id || null,
                        pageId: pageInfo.page_id,
                        postId: post.post_id,
                        scope: 'staff',
                        type: notifType,
                        title: notifTitle,
                        message: notifMsg
                    });
                }
            }
        }

        return await insertBatchNotifications(db, toInsert);
    } catch (err) {
        console.warn('Warning: notifyPublishedPost failed:', err.message);
        return 0;
    }
}

/**
 * Notify both the registrant and MyPage staff when a registration is created or cancelled.
 */
async function notifyEventRegistrationChange(db, { postId, eventTitle, pageId, registrantUserId, registrantName = 'A student', action = 'registered' }) {
    try {
        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications) return 0;

        const isCancel = String(action).toLowerCase().includes('cancel');
        const toInsert = [];

        // 1. Registrant confirmation / cancellation notice
        if (registrantUserId) {
            const regRes = await db.query(
                `SELECT u.notification_preferences, r.role_name
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE u.user_id = $1
                 LIMIT 1`,
                [registrantUserId]
            );
            if (regRes.rows.length > 0) {
                const role = String(regRes.rows[0].role_name || '').toLowerCase();
                const prefs = normalizeUserPrefs(regRes.rows[0].notification_preferences, role);
                const wantsReg = role === 'student' ? prefs.registrationUpdates : prefs.eventApprovalAlerts;

                if (wantsReg && (role === 'student' || role === 'staff')) {
                    toInsert.push({
                        recipientUserId: registrantUserId,
                        actorUserId: registrantUserId,
                        pageId,
                        postId,
                        scope: role,
                        type: 'registration',
                        title: isCancel ? `Registration Cancelled: ${eventTitle}` : `Registration Confirmed: ${eventTitle}`,
                        message: isCancel
                            ? `You cancelled your registration for "${eventTitle}".`
                            : `Your seat is confirmed for "${eventTitle}".`
                    });
                }
            }
        }

        // 2. Page managers (created_by + active page_members) honoring page eventRegistrationAlerts
        if (pageId) {
            const pageRes = await db.query(
                `SELECT page_name, notification_settings FROM pages WHERE page_id = $1 LIMIT 1`,
                [pageId]
            );
            const pageRow = pageRes.rows[0];
            const pagePrefs = normalizePagePrefs(pageRow?.notification_settings);

            if (pagePrefs.eventRegistrationAlerts) {
                const { rows: managers } = await db.query(
                    `SELECT DISTINCT u.user_id
                     FROM users u
                     WHERE u.user_id IN (
                        SELECT pg.created_by FROM pages pg WHERE pg.page_id = $1
                        UNION
                        SELECT pm.user_id FROM page_members pm WHERE pm.page_id = $1 AND LOWER(pm.status) = 'active'
                     )
                     AND LOWER(u.account_status) = 'active'`,
                    [pageId]
                );

                for (const m of managers) {
                    if (Number(m.user_id) === Number(registrantUserId)) continue;
                    toInsert.push({
                        recipientUserId: m.user_id,
                        actorUserId: registrantUserId,
                        pageId,
                        postId,
                        scope: 'mypage',
                        type: 'registration',
                        title: isCancel ? `Event Cancellation: ${eventTitle}` : `New Event Registration: ${eventTitle}`,
                        message: isCancel
                            ? `${registrantName} cancelled their registration for "${eventTitle}".`
                            : `${registrantName} registered for "${eventTitle}".`
                    });
                }
            }
        }

        return await insertBatchNotifications(db, toInsert);
    } catch (err) {
        console.warn('Warning: notifyEventRegistrationChange failed:', err.message);
        return 0;
    }
}

/**
 * Notify active registered attendees when an event's details, schedule, or status change.
 */
async function notifyEventUpdated(db, { postId, title, pageId = null, actorUserId = null, isCancelled = false, changeReason = '' }) {
    try {
        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications) return 0;

        const { rows: registrants } = await db.query(
            `SELECT u.user_id, u.notification_preferences, r.role_name
             FROM event_registrations er
             JOIN users u ON er.registrant_user_id = u.user_id
             JOIN roles r ON u.role_id = r.role_id
             WHERE er.event_post_id = $1
               AND LOWER(er.status) != 'cancelled'
               AND LOWER(u.account_status) = 'active'
               AND LOWER(r.role_name) IN ('student', 'staff')`,
            [postId]
        );

        const toInsert = [];
        for (const reg of registrants) {
            if (actorUserId && Number(reg.user_id) === Number(actorUserId)) continue;
            const role = String(reg.role_name || '').toLowerCase();
            const prefs = normalizeUserPrefs(reg.notification_preferences, role);
            const allow = role === 'student' ? prefs.eventUpdates : prefs.eventApprovalAlerts;
            if (!allow) continue;

            toInsert.push({
                recipientUserId: reg.user_id,
                actorUserId,
                pageId,
                postId,
                scope: role,
                type: 'event_update',
                title: isCancelled ? `Event Cancelled / Removed: ${title}` : `Event Updated: ${title}`,
                message: changeReason
                    ? `${changeReason} ("${title}")`
                    : (isCancelled
                        ? `An event you registered for ("${title}") was cancelled or archived.`
                        : `Schedule, venue, or event details were updated for "${title}".`)
            });
        }

        return await insertBatchNotifications(db, toInsert);
    } catch (err) {
        console.warn('Warning: notifyEventUpdated failed:', err.message);
        return 0;
    }
}

/**
 * Notify a page manager/creator when Admin reviews a post or updates page status,
 * honoring personal & MyPage preferences plus optional transactional email.
 */
async function notifyModerationOrPageDecision(db, {
    recipientUserId,
    actorUserId = null,
    pageId = null,
    postId = null,
    postType = 'announcement',
    targetKind = 'post',
    title = '',
    decisionLabel = 'Approved',
    reason = null
}) {
    try {
        if (!recipientUserId) return 0;
        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);

        const [userRes, pageRes] = await Promise.all([
            db.query(
                `SELECT u.email, u.first_name, u.notification_preferences, r.role_name
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE u.user_id = $1
                 LIMIT 1`,
                [recipientUserId]
            ),
            pageId
                ? db.query(`SELECT page_name, notification_settings FROM pages WHERE page_id = $1 LIMIT 1`, [pageId])
                : Promise.resolve({ rows: [] })
        ]);

        const userRow = userRes.rows[0];
        if (!userRow) return 0;

        const role = String(userRow.role_name || 'staff').toLowerCase();
        const userPrefs = normalizeUserPrefs(userRow.notification_preferences, role);
        const pageRow = pageRes.rows[0] || null;
        const pagePrefs = normalizePagePrefs(pageRow?.notification_settings);

        const isPageTarget = targetKind === 'page';
        const userWantsAlert = isPageTarget
            ? userPrefs.pageSubmissions
            : (String(postType).toLowerCase() === 'event' ? (userPrefs.eventApprovalAlerts || userPrefs.moderationAlerts) : userPrefs.moderationAlerts);
        const pageWantsAlert = pageRow ? pagePrefs.publicationStatusUpdates : true;

        const notifType = isPageTarget ? 'page' : 'moderation';
        const notifTitle = isPageTarget
            ? `Page ${decisionLabel}: ${title || pageRow?.page_name || 'Your Page'}`
            : `Post ${decisionLabel}: ${title}`;
        const notifMsg = reason
            ? reason
            : (isPageTarget
                ? `Your campus page "${title || pageRow?.page_name || 'Page'}" status was updated to ${decisionLabel}.`
                : `Your ${postType} "${title}" was marked as ${decisionLabel}.`);

        let inserted = 0;
        if (globalSettings.enable_in_app_notifications && userWantsAlert && pageWantsAlert) {
            inserted = await insertBatchNotifications(db, [{
                recipientUserId,
                actorUserId,
                pageId,
                postId,
                scope: 'mypage',
                type: notifType,
                title: notifTitle,
                message: notifMsg
            }]);
        }

        // Optional transactional Gmail alert if BOTH Admin email toggle & MyPage email toggle are enabled
        if (
            globalSettings.enable_email_notifications &&
            pagePrefs.emailNotifications &&
            isEmailConfigured() &&
            userRow.email
        ) {
            const actionUrl = isPageTarget ? '/staff/mypage/dashboard' : (String(postType).toLowerCase() === 'event' ? '/staff/mypage/events' : '/staff/mypage/announcements');
            await sendNotificationEmail({
                toEmail: userRow.email,
                firstName: userRow.first_name,
                subject: `CRIMSON - ${notifTitle}`,
                heading: notifTitle,
                message: notifMsg,
                actionUrl,
                actionLabel: 'Open My Page'
            });
        }

        return inserted;
    } catch (err) {
        console.warn('Warning: notifyModerationOrPageDecision failed:', err.message);
        return 0;
    }
}

/**
 * Notify page managers when attendance session opens or closes with summary stats.
 */
async function notifyAttendanceWindowChange(db, { eventId, title, pageId, actorUserId = null, action = 'OPEN', summary = null }) {
    try {
        if (!pageId) return 0;
        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications) return 0;

        const normAction = String(action || '').toUpperCase();
        const isClose = normAction === 'CLOSE';

        const { rows: managers } = await db.query(
            `SELECT DISTINCT u.user_id, u.notification_preferences, r.role_name
             FROM users u
             JOIN roles r ON u.role_id = r.role_id
             WHERE u.user_id IN (
                SELECT pg.created_by FROM pages pg WHERE pg.page_id = $1
                UNION
                SELECT pm.user_id FROM page_members pm WHERE pm.page_id = $1 AND LOWER(pm.status) = 'active'
             )
             AND LOWER(u.account_status) = 'active'`,
            [pageId]
        );

        const toInsert = [];
        const notifTitle = isClose
            ? `Attendance Closed & Report Ready: ${title}`
            : `Attendance Check-In Opened: ${title}`;
        const notifMsg = isClose && summary
            ? `Attendance closed for "${title}". Summary: ${summary.present} Present, ${summary.absent} Absent (${summary.totalEligible} eligible).`
            : `QR attendance check-in is now ${isClose ? 'closed' : 'open'} for "${title}".`;

        for (const m of managers) {
            const prefs = normalizeUserPrefs(m.notification_preferences, m.role_name);
            if (!prefs.attendanceReports) continue;

            toInsert.push({
                recipientUserId: m.user_id,
                actorUserId,
                pageId,
                postId: eventId,
                scope: 'mypage',
                type: 'attendance',
                title: notifTitle,
                message: notifMsg
            });
        }

        return await insertBatchNotifications(db, toInsert);
    } catch (err) {
        console.warn('Warning: notifyAttendanceWindowChange failed:', err.message);
        return 0;
    }
}

/**
 * Idempotently generate reminders for events a user registered for starting within 24 hours.
 */
async function ensureUpcomingEventReminders(db, userId, roleName) {
    try {
        if (!userId) return 0;
        const role = String(roleName || '').toLowerCase();
        if (role !== 'student' && role !== 'staff') return 0;

        await ensureNotificationSchema(db);
        const globalSettings = await getGlobalNotificationSettings(db);
        if (!globalSettings.enable_in_app_notifications) return 0;

        const prefs = await getUserNotificationPreferences(db, userId, role);
        const wantsReminders = role === 'student' ? prefs.eventReminders : prefs.eventApprovalAlerts;
        if (!wantsReminders) return 0;

        const { rows: upcoming } = await db.query(
            `SELECT p.post_id, p.page_id, p.title, ed.event_date, ed.location
             FROM event_registrations er
             JOIN posts p ON er.event_post_id = p.post_id
             JOIN event_details ed ON p.post_id = ed.post_id
             WHERE er.registrant_user_id = $1
               AND LOWER(er.status) = 'registered'
               AND p.is_archived = FALSE
               AND LOWER(p.moderation_status) = 'approved'
               AND ed.event_date >= NOW()
               AND ed.event_date <= NOW() + INTERVAL '24 hours'
               AND NOT EXISTS (
                   SELECT 1 FROM notifications existing
                   WHERE existing.recipient_user_id = $1
                     AND existing.post_id = p.post_id
                     AND existing.type = 'reminder'
               )`,
            [userId]
        );

        if (upcoming.length === 0) return 0;

        const toInsert = upcoming.map((ev) => {
            const timeStr = new Date(ev.event_date).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
            return {
                recipientUserId: userId,
                actorUserId: null,
                pageId: ev.page_id,
                postId: ev.post_id,
                scope: role,
                type: 'reminder',
                title: `Upcoming Event Reminder: ${ev.title}`,
                message: `"${ev.title}" starts on ${timeStr}${ev.location ? ` at ${ev.location}` : ''}.`
            };
        });

        return await insertBatchNotifications(db, toInsert);
    } catch (err) {
        console.warn('Warning: ensureUpcomingEventReminders failed:', err.message);
        return 0;
    }
}

module.exports = {
    DEFAULT_STUDENT_PREFS,
    DEFAULT_STAFF_PREFS,
    DEFAULT_MYPAGE_PREFS,
    ensureNotificationSchema,
    normalizeUserPrefs,
    normalizePagePrefs,
    getGlobalNotificationSettings,
    getUserNotificationPreferences,
    updateUserNotificationPreferences,
    resolveNotificationUrl,
    formatNotificationRow,
    insertBatchNotifications,
    notifyAdminsPendingContent,
    notifyAdminsStudentVerification,
    notifyPublishedPost,
    notifyEventRegistrationChange,
    notifyEventUpdated,
    notifyModerationOrPageDecision,
    notifyAttendanceWindowChange,
    ensureUpcomingEventReminders
};
