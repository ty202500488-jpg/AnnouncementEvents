# Static Shareable QR & Geofenced Attendance Design

**Date:** 2026-11-22
**Status:** Ready for user approval (builder-checked)

---

## 1. Intent & Why

Page staff frequently delegate on-site event attendance checking to helpers ("assistants") who do not have Crimson staff accounts. Today's attendance system rotates the QR code every 30 seconds and only displays it while the window is manually open, making it impossible to screenshot and hand off to an assistant. Meanwhile, students viewing **My Events** currently see a "Scan Attendance" button that triggers a raw browser `prompt()` regardless of whether attendance has started.

This design replaces the 30-second rotating QR with a **static, screenshot-safe event QR code** controlled by staff via **manual Activate/Deactivate** or a **scheduled time window** (e.g., 8:30 AM – 9:30 AM), paired with a **fixed WMSU campus geofence** and an in-app **Attendance** button in **My Events** that only opens Crimson's camera scanner while attendance is active and the student is on campus.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **One static shareable QR per event:** Staff can generate, view, screenshot, and download the event's QR code at any time — including *before* the attendance window starts — so they can send it to offline assistants ahead of time.
- **Revocable QR:** Staff can click **Regenerate QR** to immediately replace the QR token and invalidate any previously shared screenshot.
- **Manual and scheduled window controls:**
  - Staff can manually **Activate** or **Deactivate** attendance immediately.
  - Staff can schedule a **Start Time** and **End Time** (e.g., `8:30 AM – 9:30 AM`). The QR automatically becomes active at start time and deactivates at end time, with exact-second enforcement.
  - Manual controls can override a schedule early (e.g., activate before start or deactivate before end).
- **Auto-absent on close:** When an attendance window closes (either manually or when a scheduled end time passes), any registered student still `NOT_MARKED` is automatically marked `ABSENT`. Staff can still manually correct records afterward.
- **Gated student scanner in My Events:**
  - In **My Events** (both student `MyEvents.jsx` and staff `StaffMyEvents.jsx`), registered event cards show an **Attendance** button.
  - The button is only clickable while attendance is currently active for that event and the user has not yet checked in. Otherwise it reflects the current state (`Attendance Opens <time>`, `Attendance Closed`, `Attendance Not Started`, or `Present ✓`).
  - Clicking **Attendance** checks the user's GPS location against the fixed WMSU campus geofence before opening Crimson's built-in `QRCheckInScanner` camera modal.
- **Server-enforced campus geofence:** Every QR check-in submission includes the user's coordinates and is re-validated on the backend using the Haversine distance formula against the fixed WMSU Main Campus center and radius (configurable via `server/.env`).

### Non-Goals
- **Assistant accounts or roles inside Crimson:** Assistants remain completely outside the system; they simply display the screenshot/downloaded QR image.
- **Multiple attendance sessions per event:** Each event has a single attendance session/QR (no Morning In / Afternoon Out or multi-day split sessions).
- **Per-event custom venue coordinates or interactive map picker:** Location checking uses one fixed WMSU campus geofence for all events (zero staff setup).
- **Walk-in / unregistered check-ins:** Only registered (non-cancelled, non-pending, non-rejected) attendees can check in, matching existing behavior.

### Anti-Goals
- **Breaking screenshots with short-lived rotating tokens:** Static QR tokens must never silently rotate on a timer.
- **Leaking secret QR tokens to external image APIs:** Do not send the raw check-in token to `api.qrserver.com`; render the QR locally in the browser.
- **Client-only geofence or window checks:** Never trust the UI alone to block off-campus or out-of-window scans; the backend must enforce both on `POST /api/mypage/attendance/check-in`.
- **Breaking existing manual corrections, CSV exports, or admin attendance reports.**

---

## 3. Constraints

- **Browser `Permissions-Policy`:** `server/index.js` currently sends `Permissions-Policy: geolocation=(), microphone=()`. This must be updated to `geolocation=(self), microphone=()` so Crimson can request GPS access.
- **HTTPS / `localhost` browser requirement:** Browsers only expose `navigator.geolocation` and `navigator.mediaDevices.getUserMedia` in secure contexts (`https://` or `http://localhost`). Error states must clearly explain permission/context issues so staff can fall back to manual correction if needed.
- **Indoor GPS accuracy:** Campus buildings introduce 30–100m GPS drift. The fixed campus geofence defaults to **WMSU Main Campus (Normal Road, covering Campus A & B)** centered at `6.9135, 122.0615` with a **450m** default radius, overridable via `server/.env` (`CAMPUS_GEOFENCE_LAT`, `CAMPUS_GEOFENCE_LNG`, `CAMPUS_GEOFENCE_RADIUS_METERS`, and optional `CAMPUS_GEOFENCE_ENABLED=true|false` for local non-campus dev/testing).
- **PostgreSQL 3NF schema compatibility:** Keep `event_attendance_sessions` 1:1 with `event_details(post_id)` and `event_attendance_records` 1:1 with `event_registrations(registration_id)`. Apply schema additions idempotently (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) via an automatic migration helper (matching the repo's `ensureEventRegistrationSchema` pattern) and mirror them in `server/database.sql`.
- **Keep `server/.env` untracked/uncommitted:** Never stage or commit `server/.env`.

---

## 4. Approaches Considered

### Approach A — Session-owned static QR + exact-time schedule + local QR rendering *(Selected)*
- Extend `event_attendance_sessions` with `qr_token`, `qr_token_created_at`, `scheduled_open_time`, and `scheduled_close_time` (plus `status` supporting `'OPEN'`, `'CLOSED'`, `'SCHEDULED'` or computing effective active state from `status` + timestamps).
- Storing the static `qr_token` on the session allows staff to leave `MyPageAttendance` and return anytime to view, screenshot, or download the **same** QR code; **Regenerate QR** atomically replaces `qr_token` and invalidates prior screenshots.
- A shared helper (`server/utils/attendanceHelper.js`) computes the **effective session state** at exact second precision (`ACTIVE`, `SCHEDULED`, `CLOSED`) for every read and check-in, while `attendanceWorker.js` finalizes expired scheduled windows (transitioning `status` to `CLOSED`, setting `close_time`, creating missing attendance rows, and marking `NOT_MARKED` → `ABSENT`).
- Render QR codes locally on the client using the `qrcode` package (canvas/data URL), eliminating third-party URL leakage and enabling one-click **Download QR PNG**.
- **Trade-off:** Adds columns to `event_attendance_sessions` (auto-migrated cleanly) and adds one small frontend dependency (`qrcode`).

### Approach B — Reuse `event_qr_tokens` (hash-only) + 60-second worker toggle *(Rejected)*
- Store a long-lived token hash in `event_qr_tokens` and let the 60-second background worker toggle `event_attendance_sessions.status` between `OPEN` and `CLOSED`.
- **Why rejected:** Because `event_qr_tokens` only stores SHA-256 hashes, staff could not leave the page and come back to screenshot the same QR code again. Additionally, scheduled start/end times would drift by up to 60 seconds between worker ticks.

---

## 5. Detailed Design

### 5.1 Database Schema Changes (`event_attendance_sessions`)

Add the following columns to `event_attendance_sessions` (in `server/database.sql` and via `ensureAttendanceSchema(pool)`):
- `qr_token VARCHAR(128) UNIQUE` — active static secret token for this event (64-char hex via `crypto.randomBytes(32).toString('hex')`). Nullable until staff generates a QR (or auto-generated on first open/schedule/QR view).
- `qr_token_created_at TIMESTAMPTZ` — timestamp when the current static QR was created or last regenerated.
- `scheduled_open_time TIMESTAMPTZ` — optional scheduled activation timestamp.
- `scheduled_close_time TIMESTAMPTZ` — optional scheduled deactivation timestamp.
- `closed_manually_at TIMESTAMPTZ` — optional timestamp recording an explicit manual deactivation so a manual close during a scheduled window overrides the schedule rather than immediately re-activating on the next request.

Keep `status VARCHAR(20) DEFAULT 'CLOSED' NOT NULL CHECK (status IN ('OPEN', 'CLOSED'))` unchanged so existing admin queries checking `eas.status` continue working without breaking constraints.

### 5.2 Exact-Second Window State Machine (`server/utils/attendanceHelper.js`)

Given a session row and `now = new Date()`:
1. **Manual override (`status === 'OPEN'`):**
   - If `scheduled_close_time` is set and `now >= scheduled_close_time`: effective state is **`CLOSED`** (window expired; ready to finalize).
   - Otherwise: effective state is **`ACTIVE`** (students can scan).
2. **Scheduled window (`status === 'CLOSED'` and `scheduled_open_time` & `scheduled_close_time` are set):**
   - If `closed_manually_at` is set and `closed_manually_at >= scheduled_open_time`: effective state is **`CLOSED`** (staff explicitly deactivated this schedule).
   - Else if `now < scheduled_open_time`: effective state is **`SCHEDULED`** (upcoming; button disabled showing opening time).
   - Else if `now >= scheduled_open_time && now < scheduled_close_time`: effective state is **`ACTIVE`** (auto-active on the exact second).
   - Else (`now >= scheduled_close_time`): effective state is **`CLOSED`** (expired; ready to finalize).
3. **Default (no session row or `status === 'CLOSED'` with no active/upcoming schedule):**
   - Effective state is **`CLOSED`**.

**Staff control transitions:**
- **Save Schedule (`POST /api/mypage/attendance/events/:eventId/schedule`):**
  - Validates `scheduledOpenTime` and `scheduledCloseTime` (both valid ISO dates, `scheduledCloseTime > scheduledOpenTime`).
  - Upserts `event_attendance_sessions`: sets `scheduled_open_time`, `scheduled_close_time`, clears `closed_manually_at = NULL`, sets `open_time = scheduledOpenTime`, `close_time = scheduledCloseTime`. If `now` is already inside `[scheduledOpenTime, scheduledCloseTime)`, sets `status = 'OPEN'`, ensures `NOT_MARKED` rows exist for all confirmed registrations, and resets previously auto-marked `ABSENT` rows (`check_in_method IS DISTINCT FROM 'manual_staff'`) back to `NOT_MARKED`; otherwise sets `status = 'CLOSED'`.
  - Auto-generates `qr_token` if the session does not have one yet.
- **Clear Schedule:** Allows clearing scheduled times (sets `scheduled_open_time = NULL`, `scheduled_close_time = NULL`).
- **Manual Activate (`POST /api/mypage/attendance/events/:eventId/window` with `{ action: 'OPEN', closeTime? }`):**
  - Allowed even after a previous close (reopening a session).
  - Upserts `event_attendance_sessions` with `status = 'OPEN'`, `open_time = NOW()`, `closed_manually_at = NULL`.
  - If an optional `closeTime` (in the future) is provided, stores it as `scheduled_close_time` and `close_time`; otherwise clears any past `scheduled_close_time` (sets `scheduled_close_time = NULL`, `close_time = NULL`) so it stays open until manually closed.
  - Auto-generates `qr_token` if none exists yet.
  - Ensures `event_attendance_records` has `NOT_MARKED` rows for all confirmed registered students (`LOWER(status) IN ('registered', 'attended')`), and resets previously auto-marked `ABSENT` rows (`check_in_method IS DISTINCT FROM 'manual_staff'`) back to `NOT_MARKED` while leaving `manual_staff` overrides untouched *(our call)*.
- **Manual Deactivate (`POST /api/mypage/attendance/events/:eventId/window` with `{ action: 'CLOSE' }`):**
  - Sets `status = 'CLOSED'`, `close_time = NOW()`, `closed_manually_at = NOW()`.
  - Marks all `NOT_MARKED` attendance records for this event as `ABSENT` (keeping `check_in_method = 'qr_scan'` / non-manual so they remain distinguishable from explicit `manual_staff` corrections).
- **Generate / Fetch Static QR (`GET /api/mypage/attendance/events/:eventId/qr-credential`):**
  - Works regardless of whether the session is `CLOSED`, `SCHEDULED`, or `ACTIVE`!
  - If the event has no `event_attendance_sessions` row or `qr_token IS NULL`, creates/updates the session row (keeping `status = 'CLOSED'` if new) with a freshly generated `qr_token` and `qr_token_created_at = NOW()`.
  - Encodes an **in-app-only opaque QR payload** `CRIMSON-ATT:<qr_token>` (not a browser URL) so scanning with a phone's native camera does not open an external link, enforcing that check-ins happen inside Crimson's scanner.
  - Returns `{ qrToken, qrPayload, qrCreatedAt, effectiveStatus, scheduledOpenTime, scheduledCloseTime }`.
- **Regenerate Static QR (`POST /api/mypage/attendance/events/:eventId/qr-credential/regenerate`):**
  - Replaces `qr_token` with a new random 32-byte hex token and updates `qr_token_created_at = NOW()`.
  - Immediately invalidates all prior screenshots.

### 5.3 Background Worker (`server/Routes/attendanceWorker.js`)

Runs every 30 seconds (and can be triggered cleanly in tests):
1. **Auto-activate scheduled sessions:** For any session where `status = 'CLOSED'`, `scheduled_open_time IS NOT NULL`, `scheduled_open_time <= NOW()`, `(scheduled_close_time IS NULL OR scheduled_close_time > NOW())`, and `(closed_manually_at IS NULL OR closed_manually_at < scheduled_open_time)`:
   - Updates `status = 'OPEN'`, `open_time = scheduled_open_time`.
   - Inserts missing `NOT_MARKED` rows in `event_attendance_records` for confirmed registrations (`LOWER(status) IN ('registered', 'attended')`), and resets previously auto-marked `ABSENT` rows (`check_in_method IS DISTINCT FROM 'manual_staff'`) back to `NOT_MARKED`.
   - Sends the attendance-window-opened notification (`notifyAttendanceWindowChange`).
2. **Auto-close expired scheduled sessions:** For any session where `scheduled_close_time IS NOT NULL`, `scheduled_close_time <= NOW()`, and either `status = 'OPEN'` OR there remain `NOT_MARKED` records for a session whose schedule ran (i.e. `closed_manually_at IS NULL OR closed_manually_at < scheduled_open_time`):
   - Updates `status = 'CLOSED'`, `close_time = scheduled_close_time`.
   - Inserts missing `event_attendance_records` for confirmed registrations (in case a session opened and closed between ticks) and updates all `NOT_MARKED` records for that event to `ABSENT`.
   - Sends the attendance-window-closed notification (`notifyAttendanceWindowChange`) once per close.
3. Keeps legacy `event_qr_tokens` cleanup harmlessly intact.

### 5.4 Fixed Campus Geofence

**Configuration (`server/utils/attendanceHelper.js`):**
- `CAMPUS_GEOFENCE_ENABLED`: defaults to `true` (only disabled if explicitly set to `'false'`).
- `CAMPUS_GEOFENCE_NAME`: defaults to `'WMSU Main Campus'`.
- `CAMPUS_GEOFENCE_LAT`: defaults to `6.9135`.
- `CAMPUS_GEOFENCE_LNG`: defaults to `122.0615`.
- `CAMPUS_GEOFENCE_RADIUS_METERS`: defaults to `450`.
- Haversine formula computes exact meter distance between `(userLat, userLng)` and `(campusLat, campusLng)`.
- Also account for reasonable GPS accuracy? No blind grace buffer that could be abused by fake large accuracy values — check raw distance `<= radiusMeters` (450m already comfortably absorbs indoor GPS drift across Campus A & B).

**Public authenticated config endpoint:**
- `GET /api/mypage/attendance/geofence-config` (requires `authenticateToken`): returns `{ enabled, campusName, lat, lng, radiusMeters }` so the client always matches the server's configured geofence.

**Check-in verification (`POST /api/mypage/attendance/check-in`):**
- Accepts `{ token, eventId?, latitude, longitude }`.
- Validates:
  1. `token` matches an active `event_attendance_sessions.qr_token` (using timing-safe comparison or indexed lookup). If `eventId` is supplied (from My Events), also verifies the scanned QR belongs to that specific event — returning a clear `"This QR code belongs to a different event."` error if mismatched.
  2. Effective session state at `NOW()` is `ACTIVE` (if `SCHEDULED` before start, returns `"Attendance has not started yet."`; if `CLOSED`, returns `"Attendance window is closed for this event."`).
  3. If `CAMPUS_GEOFENCE_ENABLED` is `true`: requires finite `latitude` and `longitude` numbers and verifies Haversine distance `<= radiusMeters`; otherwise returns `403` with `{ message: "You must be within WMSU Main Campus to record attendance.", code: "OUTSIDE_GEOFENCE", distanceMeters, radiusMeters }`.
  4. User has a confirmed registration (`LOWER(status) IN ('registered', 'attended')`) for that event (blocks `pending`, `rejected`, `cancelled`, or unregistered users).
  5. Idempotency & manual-correction guard:
     - Look up any existing `event_attendance_records` row for `regId`.
     - If already `PRESENT`: return `200` with `{ message: 'You have already checked in for this event.', alreadyCheckedIn: true }` without overwriting `checkin_time`.
     - If `check_in_method = 'manual_staff'` and `status IN ('ABSENT', 'EXCUSED')`: return `409` with `{ message: 'Your attendance status was manually set by staff and cannot be overwritten by QR scan.' }` *(our call)*.
  6. Otherwise capture `previousStatus = existingRecord?.status || 'NOT_MARKED'`, upsert `event_attendance_records` (`PRESENT`, `NOW()`, `'qr_scan'`), update `event_registrations.status = 'Attended'`, write `event_attendance_audits` using the real `previousStatus`, and return `{ message: 'Attendance recorded successfully!', eventId, status: 'PRESENT', checkinTime }`.

### 5.5 My Events Query & Registration Status Fix (`server/Routes/userRoutes.js`)

In `GET /users/my-events`:
- Join `event_attendance_sessions eas ON eas.event_post_id = p.post_id` and `event_attendance_records ar ON ar.registration_id = er.registration_id`.
- Fix `is_registered`: treat both `'registered'` AND `'attended'` as confirmed (`CASE WHEN LOWER(er.status) IN ('registered', 'attended') THEN TRUE ELSE FALSE END AS is_registered`).
- Return attendance metadata on each event row:
  - `attendance_status`: effective status (`'ACTIVE' | 'SCHEDULED' | 'CLOSED'`) computed via `attendanceHelper`.
  - `attendance_open_time`: `eas.scheduled_open_time || eas.open_time`
  - `attendance_close_time`: `eas.scheduled_close_time || eas.close_time`
  - `user_attendance_status`: `ar.status || null` (`'PRESENT'`, `'ABSENT'`, `'NOT_MARKED'`, or `null`).
  - `user_checkin_time`: `ar.checkin_time || null`.
- Also include `ed.event_date AS date` (verify existing field mapping so `MyEvents.jsx` upcoming/ended check stays consistent).

### 5.6 Staff UI (`client/src/pages/Staff/MyPageDashboard/MyPageAttendance.jsx`)

- **Controls Card:**
  - Shows current effective status badge: **Active (Open)**, **Scheduled**, or **Inactive (Closed)** with start/end times.
  - **Manual toggle:** **Activate Attendance** / **Deactivate Attendance** button.
  - **Schedule Window section:** Start date/time and End date/time inputs (defaulting date to the event's date for convenience) + **Save Schedule** (and **Clear Schedule** when set).
- **QR Code Tab (renamed from "Live QR Display" to "Attendance QR"):**
  - Always displays the event's **static QR code** (rendered locally onto a crisp canvas/data URL via `qrcode` library), even when attendance is **Inactive** or **Scheduled**, with a clear status banner (`Inactive — safe to screenshot & share now; students cannot scan until activated` / `Scheduled: 8:30 AM – 9:30 AM` / `Active — accepting on-campus scans`).
  - Removes the 30-second countdown timer and auto-refresh loop completely.
  - Provides **Download QR** (saves PNG with event title/clean border for easy sharing to assistants) and **Regenerate QR** (with confirmation warning that previous screenshots will stop working).
  - Notes plainly that scans are restricted to **WMSU Main Campus**.

### 5.7 Student & Staff "My Events" + Scanner UI

- **Single Gated Entry Point *(our call)*:**
  - **My Events** (`client/src/pages/Student/MyEvents.jsx` and `client/src/pages/Staff/StaffMyEvents.jsx`) is the single place where attendees open event attendance scanning.
  - Remove the 7 legacy `prompt("Scan or enter event QR token:")` `onScanAttendance` handlers from non-MyEvents feed views (`StudentDashboard.jsx`, `Events.jsx`, `StaffDashboard.jsx`, `StaffEvents.jsx`, `PageView.jsx`, `MyPageDashboard.jsx`, `MyPageEvents.jsx`) so raw prompts never appear and students are guided to **My Events**.
  - Hide the unscoped global top-navbar QR button (`showQrButton={false}` on `DashboardLayout.jsx`, `StaffDashboardLayout.jsx`, `MyPageDashboardLayout.jsx`, `MyPageProfile.jsx`, `PageView.jsx`) so the scanner can only be opened through an active event's **Attendance** button in **My Events**.
- **`EventPostActionBar` (`client/src/assets/components/PortalShellElements.jsx`):**
  - Replace the generic "Scan Attendance" behavior when attendance state props are passed with a clear **Attendance** button:
    - If `userAttendanceStatus === 'PRESENT'`: displays a green non-clickable badge **`Present ✓`** (with check-in time tooltip).
    - Else if `attendanceStatus === 'ACTIVE'`: displays a clickable crimson **`Attendance`** button (with QR icon).
    - Else if `attendanceStatus === 'SCHEDULED'`: displays a disabled button showing **`Attendance · Opens <time>`**.
    - Else (`CLOSED` / not started): displays a disabled **`Attendance Closed`** (or **`Attendance`** disabled with tooltip `"Attendance has not been started by the organizer"`).
  - Also ensure `isConfirmed` recognizes `'attended'` in addition to `'registered'` so attended events don't break action bar rendering, and hide the "Cancel Registration" action once already `'Attended'`.
- **`MyEvents.jsx` & `StaffMyEvents.jsx`:**
  - Remove the `prompt("Scan or enter event QR token:")` hack completely.
  - Clicking the active **Attendance** button opens the `QRCheckInScanner` modal scoped to that event (`expectedEventId={item.id}`, `eventTitle={item.title}`).
  - On successful check-in, immediately updates that event's local state (`user_attendance_status: 'PRESENT'`, `registration_status: 'Attended'`) without needing a page reload.
- **`QRCheckInScanner.jsx`:**
  - Supports optional props `expectedEventId`, `eventTitle`, and `onCheckInSuccess`.
  - Updates `extractCheckInToken()` to parse the in-app `CRIMSON-ATT:<token>` format (while remaining backward-compatible with raw tokens or legacy URLs).
  - **Location Gate before scanning (both modal and direct-route mode):** When the scanner opens, it fetches `/api/mypage/attendance/geofence-config`. If enabled:
    - Displays a `"Checking campus location..."` state while calling `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })`.
    - If coordinates are outside the campus radius, shows a clear **Outside Campus Area** state (with approximate distance and a **Retry Location Check** button) and **does not open the camera** (and does not auto-submit in direct-route mode).
    - If GPS permission is denied or unavailable, shows a clear instruction to enable Location Services + **Retry** button (and notes staff can mark attendance manually).
    - Once verified on campus, transitions into the camera scanner (or proceeds with check-in in direct-route mode) and attaches `{ latitude, longitude, eventId: expectedEventId }` to `POST /api/mypage/attendance/check-in`.
  - Reuses the freshly verified position (or refreshes if stale >60s) on submit so check-in is fast while ensuring the backend always receives valid coordinates.

---

## 6. What's Left to the Builder

- Exact visual styling, icons, and responsive CSS adjustments for the Schedule inputs, Attendance QR card, and Geofence blocked/verifying states (matching existing Crimson maroon/slate design tokens).
- Unit and integration test structure (using Node's built-in `node --test` runner, matching `server/tests/`).
- Whether the downloaded PNG QR includes a small caption header (event title) or clean white-bordered QR canvas.
- Checking `StaffMyEvents.jsx` and `MyEvents.jsx` polling/focus refresh behavior (e.g., re-fetching `/users/my-events` on window focus so a student who left the tab open sees the **Attendance** button unlock at 8:30 AM without manual refresh).
