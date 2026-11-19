# Spotlight Expiration Adjustment & Post Approval Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable administrators to adjust University-Wide Spotlight expiration dates with a mandatory reason and staff notification in both Post Approvals and Content Feed, while redesigning the Post Approval review modal into the Option A two-column workspace with an effortless date/time picker.

**Architecture:** Extend `server/utils/universityWideHelper.js` and `server/utils/notificationService.js` with shared expiration-change validation and staff notification helpers, wire them into `PATCH /api/admin/post-approval/:id/decision` and `PUT /api/admin/content-feed/:id`, and build a reusable `SpotlightExpirationPicker` component shared by the redesigned `PostApproval.jsx` modal and `ContentFeed.jsx` edit modal.

**Tech Stack:** Node.js, Express 5, PostgreSQL (`pg`), Node built-in test runner (`node --test`), React 19, Vite, plain scoped CSS.

**Spec:** [2026-11-19-spotlight-expiration-and-approval-ui-design.md](file:///c:/Users/User/Desktop/RS/docs/superpowers/specs/2026-11-19-spotlight-expiration-and-approval-ui-design.md)

## Global Constraints

- No database schema migrations (`posts.expires_at`, `notifications`, `post_moderation_logs`, `audit_logs` already exist).
- Never commit `server/.env` or `.superpowers/`; add `.superpowers/` to `.gitignore`.
- Require a future timestamp and a non-empty trimmed reason whenever an admin modifies a spotlight post's `expires_at`.
- Compare timestamps at minute precision so UI formatting without seconds never triggers false change detection.
- Notifications use `scope: 'mypage'` and `type: 'moderation'` so they surface in both MyPage and Staff notification feeds.

## Review Focus

- Submitting an unchanged expiration timestamp (differing only in seconds/milliseconds) must NOT require a reason or send a "changed" notification.
- Attempting to approve a pending spotlight post whose originally requested `expires_at` has already passed must fail with `400` unless the admin adjusts `expires_at` to a future time.
- Editing a non-spotlight post in Content Feed (or editing title/body of a spotlight post without touching `expires_at`) must succeed without requiring an expiration reason.
- Clearing `expires_at` to `null` or empty on a spotlight post must be rejected with `400` (not silently turned into a non-expiring spotlight).
- If the admin adjusts their own spotlight post, deduplicated notification logic must not crash when recipient list is empty.

---

### Task 1: `.gitignore` & Expiration Adjustment Helper (`universityWideHelper.js`)

**Files:**
- Modify: `.gitignore`
- Modify: `server/utils/universityWideHelper.js`
- Test: `server/tests/universityWideHelper.test.js`

**Interfaces:**
- Produces: `evaluateSpotlightExpirationChange({ isUniversityWide, currentExpiresAt, incomingExpiresAt, reason, now = new Date() })` returning `{ valid, changed, error?, previousExpiresAt, nextExpiresAt, reason }`

- [ ] **Step 1:** Add `.superpowers/` to `.gitignore`.
- [ ] **Step 2:** Write failing unit tests in `server/tests/universityWideHelper.test.js` for `evaluateSpotlightExpirationChange` (unchanged within same minute, valid future change with reason, missing reason rejected, past/invalid/null date rejected on spotlight, non-spotlight unchanged).
- [ ] **Step 3:** Run `node --test server/tests/universityWideHelper.test.js` and verify new tests fail.
- [ ] **Step 4:** Implement `evaluateSpotlightExpirationChange` in `server/utils/universityWideHelper.js`.
- [ ] **Step 5:** Re-run `node --test server/tests/universityWideHelper.test.js` and verify all tests pass.

---

### Task 2: Staff Expiration-Change Notification Helper (`notificationService.js`)

**Files:**
- Modify: `server/utils/notificationService.js`
- Test: `server/tests/spotlightExpirationNotification.test.js`

**Interfaces:**
- Produces: `notifySpotlightExpirationChanged(db, { creatorUserId, actorUserId, pageId, postId, postType, title, previousExpiresAt, newExpiresAt, reason, duringApproval = false })` returning count of inserted notifications.

- [ ] **Step 1:** Write failing unit tests in `server/tests/spotlightExpirationNotification.test.js` covering deduplicated recipients (creator + page owner + active page members, excluding `actorUserId`), `duringApproval: true` vs `false` copy containing old date, new date, and reason, and empty-recipient safety.
- [ ] **Step 2:** Run `node --test server/tests/spotlightExpirationNotification.test.js` and verify failure.
- [ ] **Step 3:** Implement and export `notifySpotlightExpirationChanged` in `server/utils/notificationService.js`.
- [ ] **Step 4:** Re-run `node --test server/tests/spotlightExpirationNotification.test.js` and verify pass.

---

### Task 3: Admin Routes Integration (`adminRoutes.js`)

**Files:**
- Modify: `server/Routes/adminRoutes.js:1-17`, `server/Routes/adminRoutes.js:1283-1378`, `server/Routes/adminRoutes.js:2693-2845`

**Interfaces:**
- Consumes: `evaluateSpotlightExpirationChange` from `server/utils/universityWideHelper.js`, `notifySpotlightExpirationChanged` from `server/utils/notificationService.js`.

- [ ] **Step 1:** Add `page_avatar_url` and `page_code` to `GET /api/admin/post-approval` select list.
- [ ] **Step 2:** Update `handlePostDecision` to fetch existing post spotlight fields, validate `expires_at` / `expires_at_reason` on `approve` (including blocking already-expired spotlights unless adjusted to a future time), update `posts.expires_at` inside the transaction, enrich `post_moderation_logs` + `audit_logs`, and call `notifySpotlightExpirationChanged(..., { duringApproval: true })` when changed.
- [ ] **Step 3:** Update `PUT /api/admin/content-feed/:id` to fetch existing post spotlight fields, validate `expires_at` / `expires_at_reason` when `is_university_wide`, persist updated `expires_at`, log audit details, and call `notifySpotlightExpirationChanged(..., { duringApproval: false })` when changed.
- [ ] **Step 4:** Run all backend tests (`node --test server/tests/universityWideHelper.test.js server/tests/spotlightExpirationNotification.test.js server/tests/securityAuditMatrix.test.js`) and verify pass.

---

### Task 4: Reusable `SpotlightExpirationPicker` Component

**Files:**
- Create: `client/src/assets/components/SpotlightExpirationPicker.jsx`
- Create: `client/src/assets/components/SpotlightExpirationPicker.css`

**Interfaces:**
- Produces: default export `SpotlightExpirationPicker`, named exports `hasSpotlightExpirationChanged(originalIso, nextIso)` and `validateSpotlightExpirationAdjustment({ originalExpiresAt, nextExpiresAt, reason, requireFuture = true })`.

- [ ] **Step 1:** Build `SpotlightExpirationPicker.jsx` with quick duration presets (`24h`, `3 Days`, `7 Days`, `14 Days`, `Reset`), separate native Date input + clean 12-hour Hour / Minute / AM-PM select controls (preserving exact original minute when unmodified), minute-precision change detection, `Original → New` diff callout, required `Message to Staff *` textarea when changed, expired-date warning badge when original date already passed, and read-only view for reviewed items.
- [ ] **Step 2:** Style `SpotlightExpirationPicker.css` adhering to CRIMSON palette (`#881337`, warm slate neutrals, accessible contrast >= 4.5:1, tabular numerals, clean focus rings).

---

### Task 5: Post Approvals Option A Modal Redesign & Content Feed Integration

**Files:**
- Modify: `client/src/pages/Admin/PostApproval.jsx`
- Modify: `client/src/pages/styles/PostApproval.css`
- Modify: `client/src/pages/Admin/ContentFeed.jsx`

**Interfaces:**
- Consumes: `SpotlightExpirationPicker`, `hasSpotlightExpirationChanged`, `validateSpotlightExpirationAdjustment`.

- [ ] **Step 1:** Redesign the Review Modal in `PostApproval.jsx` + `PostApproval.css` to Option A:
  - 900px max-width two-column split (`1.3fr 1fr` on desktop, stacked on mobile).
  - Left column: Live post preview card (`PostPageAvatar`, page name, category & audience pill, post title, readable body, un-cropped poster image with click-to-zoom lightbox, clean neutral event strip).
  - Right column: Compact 2-column Submission Details card (no duplicate Organizer field, readable dates without seconds) + `SpotlightExpirationPicker` when `selectedItem.is_university_wide` is true.
  - Unified footer buttons (consistent `8px` radius).
  - Inline validation when clicking `Approve & Publish`, adjustment summary in `ConfirmationModal`, passing `expires_at` + `expires_at_reason` to `PATCH /api/admin/post-approval/:id/decision`, and dispatching `spotlight:refresh`.
- [ ] **Step 2:** Integrate `SpotlightExpirationPicker` into `ContentFeed.jsx` Edit modal when `selectedItem?.is_university_wide` is true, validating and sending `expires_at` + `expires_at_reason` to `PUT /api/admin/content-feed/:id`.
- [ ] **Step 3:** Run `npm run build` and `npm run lint` in `client` and fix any warnings/errors.

---

### Task 6: Live Verification, Commit & Push

- [ ] **Step 1:** Restart backend and frontend servers (`server` on `:5000`, `client` on `:5173`).
- [ ] **Step 2:** Run end-to-end verification (unit tests, client build, live API smoke test against running server).
- [ ] **Step 3:** Stage all intentional files (excluding `server/.env` and `.superpowers/`), verify `git status` & `git diff --cached --stat`, commit, and push to `origin/main`.
