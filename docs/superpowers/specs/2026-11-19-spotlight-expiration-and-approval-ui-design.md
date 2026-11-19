# Spotlight Expiration Adjustment & Post Approval Review Modal Redesign

**Date:** 2026-11-19  
**Status:** Draft (awaiting user approval)

## 1. Intent & Why

Staff members submit University-Wide Spotlight posts with a requested `Active Until` (`expires_at`) timestamp, but administrators currently have no way to adjust that expiration before publishing or while the spotlight is live. When admins need to shorten or extend a spotlight slot (for example, to make room for campus-wide enrollment or align with an event's end time), they need to:

1. Easily adjust the expiration date and time (without fighting a cramped native `datetime-local` input).
2. Provide a mandatory explanation message whenever they change the expiration date.
3. Automatically notify the submitting staff member (and page managers) with the old date, new date, and admin's reason.

At the same time, the **Post Approval Review Modal** currently feels like a stacked database form (detached header title, pink warning-styled event box, aggressively cropped `210px` banner image, raw timestamps with seconds, and mismatched footer buttons). Redesigning it into a clean two-column workspace makes reviewing submissions and adjusting spotlight schedules fast and clear.

## 2. Goals & Non-Goals

### Goals
- Allow admins to adjust `expires_at` for `is_university_wide` posts in **both** Post Approvals (when reviewing pending submissions) and Content Feed (when editing already-approved spotlight posts).
- Replace cramped `datetime-local` spotlight scheduling with a reusable **`SpotlightExpirationPicker`** component featuring quick duration presets (`24h`, `3 Days`, `7 Days`, `14 Days`, plus `Reset`), separate **End Date** and **End Time** controls, a live `Original → New` diff badge/banner, and a conditional required **Message to Staff** field.
- Redesign the **Post Approval Review Modal** using **Option A** (two-column split: live post preview on the left, structured submission metadata + spotlight schedule panel on the right, unified footer buttons).
- Enforce backend validation (future timestamp required, non-empty reason required whenever `expires_at` changes), persist audit/moderation logs, and send in-app (`mypage` scope, visible in both MyPage and Staff notification feeds) + optional email notifications to the staff submitter and active page managers.
- Prevent approving a pending spotlight post whose `expires_at` has already passed unless the admin updates it to a future timestamp.

### Non-Goals
- No database migrations or new tables (`posts.expires_at`, `notifications`, `post_moderation_logs`, and `audit_logs` already exist).
- No changes to the student/staff public feed layouts or how expired spotlights remain in regular feeds.
- No changes to unrelated admin pages (`Reports`, `Archives`, `UserManagement`, etc.).

## 3. Approaches Considered

### Scope (decided: Option 2)
- **Post Approvals only:** Simpler, but admins could not extend or shorten a spotlight once published.
- **Both Post Approvals and Content Feed (Selected):** Covers both pre-publish moderation and live spotlight management consistently.

### Backend & Flow Architecture (selected: Approach 1)
- **Approach 1 — Extend existing endpoints + shared helper (Selected):** Extend `PATCH /api/admin/post-approval/:id/decision` and `PUT /api/admin/content-feed/:id` with shared expiration-change validation (`universityWideHelper.js`) and notification helper (`notificationService.js`). Keeps approve-with-adjustment atomic in a single request and avoids redundant UI modals.
- **Approach 2 — Separate `PATCH /api/admin/posts/:id/spotlight-expiration` endpoint & modal:** Clean separation, but forces admins in Post Approvals to perform two separate modal actions (edit expiration first, then approve) instead of reviewing, adjusting, and approving in one flow.

### Post Approval Modal Layout (decided: Option A)
- **Option A — True two-column split (Selected):** Live, un-cropped post preview on the left (`1.3fr`); compact submission metadata + always-visible Spotlight expiration adjuster & inline reason box on the right (`1fr`); unified footer bar.
- **Option B — Single-column preview + expandable schedule drawer:** Calmer when no edits are needed, but hides the adjustment controls behind an extra click.
- **Option C — Split view with Feed/Spotlight card tab toggle:** Useful for spotlight crop inspection, but adds extra mode-switching chrome not requested.

## 4. Detailed Design

### 4.1 Backend Validation & Helpers (`server/utils/universityWideHelper.js`)
- Add `evaluateSpotlightExpirationChange({ isUniversityWide, currentExpiresAt, incomingExpiresAt, reason, now })`:
  - Compares `currentExpiresAt` and `incomingExpiresAt` at **minute precision** (`Math.floor(ms / 60000)`) so browser date/time formatting without seconds never triggers false "changed" states.
  - If `incomingExpiresAt` is omitted/undefined, treats it as unchanged (`changed: false`).
  - If `isUniversityWide` and `changed === true`:
    - Rejects null/empty/invalid timestamps and timestamps `<= now` (`400` with clear message).
    - Requires non-empty trimmed `reason` (`400`: `"Please provide a message explaining why the spotlight expiration date was changed."`).
    - Returns `{ valid: true, changed: true, previousExpiresAt, nextExpiresAt: parsed.toISOString(), reason: trimmedReason }`.

### 4.2 Admin API Endpoints (`server/Routes/adminRoutes.js`)
1. **`PATCH/POST/PUT /api/admin/post-approval/:id/decision`**
   - Fetch existing post (`moderation_status`, `is_university_wide`, `expires_at`, `creator_user_id`, `page_id`, `post_type`, `title`) before updating.
   - When `decision` is `approve` and `post.is_university_wide` is true:
     - Run `evaluateSpotlightExpirationChange` using `req.body.expires_at` and `req.body.expires_at_reason || req.body.reason`.
     - Also check the effective `expires_at` (either newly supplied or existing): if it is non-null and `<= now`, return `400` prompting the admin to set a future expiration date before approving.
     - Update `posts.expires_at` inside the same transaction if `changed === true`.
     - Store a structured note in `post_moderation_logs.reason` (including the old → new expiration and admin's explanation) and record `previous_expires_at`, `new_expires_at`, and `reason` in `audit_logs`.
     - Call `notifySpotlightExpirationChanged` (with `duringApproval: true`) when the expiration was changed — sending a single combined "Approved (Expiration Adjusted)" notification to the creator + active page managers instead of two separate moderation alerts. When unchanged, keep existing `notifyModerationOrPageDecision` behavior unchanged.
2. **`PUT /api/admin/content-feed/:id`**
   - Fetch existing post (`is_university_wide`, `expires_at`, `creator_user_id`, `page_id`, `post_type`, `title`, `moderation_status`) before updating.
   - If `post.is_university_wide` and `expires_at` was included in the request:
     - Run `evaluateSpotlightExpirationChange` with `req.body.expires_at_reason || req.body.reason`.
     - If invalid, roll back and return `400`.
     - If `changed === true`, update `posts.expires_at`, log `previous_expires_at`, `new_expires_at`, and `reason` in `audit_logs`, and call `notifySpotlightExpirationChanged` (with `duringApproval: false`).

### 4.3 Staff Notification (`server/utils/notificationService.js`)
- Add `notifySpotlightExpirationChanged(db, { creatorUserId, actorUserId, pageId, postId, postType, title, previousExpiresAt, newExpiresAt, reason, duringApproval = false })`:
  - Resolves deduplicated active recipients: `creatorUserId` + `pages.created_by` + active `page_members` for `pageId` (excluding `actorUserId` if the admin edited their own post).
  - Respects global notification toggle and recipient preferences (following the existing moderation alert pattern), inserting notifications with `scope: 'mypage'` (visible in both MyPage and Staff notification feeds) and `type: 'moderation'`.
  - Formats readable date/times (e.g. `Nov 22, 2026, 5:00 PM`):
    - During approval: Title `Post Approved (Expiration Adjusted): <title>`; Message `Your University-Wide Spotlight <type> "<title>" was approved and published. Spotlight expiration was changed from <old> to <new>. Reason: <reason>`.
    - Post-approval edit: Title `Spotlight Expiration Updated: <title>`; Message `An administrator adjusted the spotlight expiration for your <type> "<title>" from <old> to <new>. Reason: <reason>`.
  - Sends transactional email via `sendNotificationEmail` when global email notifications + page email notifications + SMTP are configured.

### 4.4 Frontend Components & UX
1. **New Reusable Component: `client/src/assets/components/SpotlightExpirationPicker.jsx`**
   - Props: `originalExpiresAt`, `value` (ISO or local datetime string), `onChange`, `reason`, `onReasonChange`, `readOnly`, `disabled`, `error`.
   - **Quick preset chips:** `24h`, `3 Days`, `7 Days`, `14 Days` (calculated from now, snapped cleanly to `:00` / current minute or 5:00 PM? **Builder call:** preset buttons compute `now + N hours` at the current minute or clean `:00`, matching existing `MyPageDashboard` presets, plus a `Reset` chip whenever modified to revert back to the staff's original date).
   - **Separate Date & Time controls:** Native `<input type="date">` for the calendar date + a clean time selector (hour 1–12, minute `:00` / `:15` / `:30` / `:45`, AM/PM dropdowns or clean `<input type="time">` — **Builder call:** `<input type="date">` paired with clean Hour/Minute/AM-PM select controls so the admin never fights browser-specific time spinners and can pick any time in 2 clicks).
   - **Diff indicator & Reason box:** Automatically compares against `originalExpiresAt` at minute precision. When modified, displays an amber `Adjusted` badge, a `Staff requested <old> → Changed to <new>` callout, and a required `Message to Staff *` textarea.
2. **Post Approvals Modal Redesign (`client/src/pages/Admin/PostApproval.jsx` + `PostApproval.css`)**
   - Upgrade review modal (`pa-modal-large`, widened to `900px` max-width on desktop) to **Option A**:
     - **Topbar:** Type tag, University-Wide Spotlight pill (if applicable), `#id`, clean formatted submitted date (no seconds), and clean square close button.
     - **Left column (`1.3fr`):** "Live Post Preview" card showing organization avatar/initials, page name, category & audience pill, post title, readable body copy, full-aspect image preview (`max-height: 360px; object-fit: contain` on a subtle neutral frame, click-to-open full image preview so vertical posters are never cut off), and a compact neutral event strip (`Starts`, `Ends`, `Venue`, `Capacity`) for events.
     - **Right column (`1fr`):** Structured 2-column `Submission Details` key-value grid (no duplicated Organizer field, clean formatted timestamps without `:00` seconds) + `SpotlightExpirationPicker` when `selectedItem.is_university_wide` is true (editable when Pending, read-only when Reviewed).
     - **Unified Footer:** Matching rounded (`8px`) buttons — `Close` on left; `Request Corrections`, `Reject`, `Approve & Publish` on right.
     - **Approve Flow:** Clicking `Approve & Publish` validates the adjusted date (future) and required reason (if changed) right inside the review modal before opening `ConfirmationModal` (which shows a clean summary of the adjusted date + admin message and submits `expires_at` and `expires_at_reason` to `/decision`). Also dispatches `window.dispatchEvent(new Event('spotlight:refresh'))` on approval.
3. **Content Feed Edit Modal (`client/src/pages/Admin/ContentFeed.jsx`)**
   - When editing a post with `selectedItem?.is_university_wide`, render `SpotlightExpirationPicker` inside the Edit modal (passing original `selectedItem.expires_at`, current edited value, and `expiresAtReason`).
   - Validate future timestamp + required reason before submitting `PUT /api/admin/content-feed/:id` with `expires_at` and `expires_at_reason`.
   - Dispatch `window.dispatchEvent(new Event('spotlight:refresh'))` on successful update so the live Spotlight carousel updates immediately.

## 5. Testing & Verification Plan
- Unit tests in `server/tests/universityWideHelper.test.js` covering `evaluateSpotlightExpirationChange` (unchanged within same minute, valid change with reason, missing reason rejection, past date rejection, invalid date rejection).
- Unit/integration test for `notifySpotlightExpirationChanged` verifying deduplicated staff recipients (creator + active page managers), `mypage` scope, and formatted old/new dates + reason in the notification message.
- Live API verification + browser visual check of both Post Approvals (Option A modal) and Content Feed Edit modal, plus confirming the staff notification appears in MyPage/Staff notifications.
