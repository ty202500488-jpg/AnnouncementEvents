# Static Shareable QR & Geofenced Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace rotating 30-second attendance QR codes and raw `prompt()` scan inputs with a static, screenshot-safe event QR code controlled manually or by schedule, enforced by a fixed WMSU campus geofence and a gated **Attendance** button + camera scanner in **My Events**.

**Architecture:** Extend `event_attendance_sessions` with a persistent `qr_token`, schedule timestamps (`scheduled_open_time`, `scheduled_close_time`), and `closed_manually_at` via an idempotent schema migration helper. A shared backend helper evaluates exact-second window state (`ACTIVE`, `SCHEDULED`, `CLOSED`) and Haversine campus geofence distance for both routes and a 30-second background worker (`attendanceWorker.js`). On the frontend, staff render/download/regenerate the local `CRIMSON-ATT:<token>` QR using `qrcode`, while **My Events** gates the **Attendance** button by live session status and runs a campus GPS check before opening `QRCheckInScanner`.

**Tech Stack:** Node.js + Express + PostgreSQL (`pg`), React 19 + Vite, `qrcode` (client local QR PNG/canvas rendering), `jsqr` + `BarcodeDetector`, `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-11-22-static-qr-geofenced-attendance-design.md`

## Global Constraints

- Update `server/index.js` security header from `Permissions-Policy: geolocation=(), microphone=()` to `Permissions-Policy: geolocation=(self), microphone=()`.
- Fixed campus geofence defaults: `CAMPUS_GEOFENCE_ENABLED=true`, `CAMPUS_GEOFENCE_NAME='WMSU Main Campus'`, `CAMPUS_GEOFENCE_LAT=6.9135`, `CAMPUS_GEOFENCE_LNG=122.0615`, `CAMPUS_GEOFENCE_RADIUS_METERS=450` (all overridable via `server/.env`).
- Never send raw QR tokens to `api.qrserver.com` or any third-party image API; render locally via `qrcode`.
- Encode QR payloads strictly as `CRIMSON-ATT:<qr_token>` (in-app scanning only; never an external URL).
- Preserve `event_attendance_sessions.status CHECK (status IN ('OPEN', 'CLOSED'))` and existing admin/audit/CSV queries.
- Apply DB column additions idempotently (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) via `ensureAttendanceSchema(pool)` and mirror them in `server/database.sql`.
- Never stage, modify, or commit `server/.env`.

## Review Focus

- **Malformed or spoofed-empty GPS coordinates (`NaN`, `null`, `""`, `lat: 999`, `lng: -200`)** -> Geofence evaluator must fail closed (`allowed: false`, `reason: 'INVALID_COORDINATES'`), never coercing `""`/`null` to `0` or letting `NaN <= radius` pass. *(Pinned in Task 1 `server/tests/attendanceHelper.test.js`)*
- **Manual deactivation during an active scheduled window** -> Setting `closed_manually_at` must keep effective state `CLOSED` for the remainder of that schedule and prevent `attendanceWorker.js` from re-opening it until staff manually re-opens or saves a new schedule. *(Pinned in Task 1 `server/tests/attendanceHelper.test.js` & Task 2 `server/tests/attendanceWorker.test.js`)*
- **Reopening/rescheduling after auto-absent close when `manual_staff` overrides exist** -> Auto-marked `ABSENT` rows (`check_in_method IS DISTINCT FROM 'manual_staff'`) reset to `NOT_MARKED` on reopen so late arrivals can check in, while `manual_staff` `ABSENT`/`EXCUSED` rows stay untouched and reject QR overwrite with `409`. *(Pinned in Task 2 `server/tests/attendanceWorker.test.js` & `server/tests/attendanceCheckIn.test.js`)*
- **Pending/rejected registration or wrong-event QR scan** -> `POST /api/mypage/attendance/check-in` rejects non-confirmed registrations (`403`) and mismatched `eventId` (`400`, `"This QR code belongs to a different event."`). *(Pinned in Task 2 `server/tests/attendanceCheckIn.test.js`)*
- **Already-checked-in student (`registration_status: 'Attended'`) reloading My Events** -> `/users/my-events` preserves `is_registered: true` and `user_attendance_status: 'PRESENT'`; UI renders `Present ✓` badge and hides Cancel Registration. *(Pinned in Task 3 `server/tests/myEventsAttendanceMapping.test.js` & Task 4 `client/src/utils/attendanceUtils.test.js`)*

---

### Task 1: Shared Attendance Helper, Schema Migration & Permissions-Policy

**Files:**
- Create: `server/utils/attendanceHelper.js`
- Modify: `server/database.sql:289-297`
- Modify: `server/index.js:19-25`
- Test: `server/tests/attendanceHelper.test.js`

**Interfaces:**
- Consumes: Node built-in `crypto`, `process.env`
- Produces (`server/utils/attendanceHelper.js`):
  - `ensureAttendanceSchema(pool) -> Promise<void>` (idempotent `ALTER TABLE event_attendance_sessions ADD COLUMN IF NOT EXISTS qr_token VARCHAR(128) UNIQUE, qr_token_created_at TIMESTAMPTZ, scheduled_open_time TIMESTAMPTZ, scheduled_close_time TIMESTAMPTZ, closed_manually_at TIMESTAMPTZ`)
  - `getCampusGeofenceConfig(env = process.env) -> { enabled: boolean, campusName: string, lat: number, lng: number, radiusMeters: number }`
  - `calculateDistanceMeters(lat1, lng1, lat2, lng2) -> number`
  - `evaluateCampusGeofence({ latitude, longitude }, config?) -> { allowed: boolean, distanceMeters: number|null, radiusMeters: number, campusName: string, reason: 'DISABLED'|'INSIDE'|'OUTSIDE'|'INVALID_COORDINATES' }`
  - `evaluateAttendanceSession(sessionRow, now = new Date()) -> { effectiveStatus: 'ACTIVE'|'SCHEDULED'|'CLOSED', isActive: boolean, openTime: string|null, closeTime: string|null, scheduledOpenTime: string|null, scheduledCloseTime: string|null, shouldAutoClose: boolean, shouldAutoOpen: boolean }`
  - `validateAttendanceSchedule({ scheduledOpenTime, scheduledCloseTime }) -> { valid: boolean, error?: string, openDate?: Date, closeDate?: Date }`
  - `generateStaticQrToken() -> string` (64-char hex)
  - `buildAttendanceQrPayload(token) -> string` (`CRIMSON-ATT:${token}`)
  - `extractAttendanceQrToken(rawValue) -> string`

- [ ] **Step 1: Write the failing unit tests in `server/tests/attendanceHelper.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getCampusGeofenceConfig,
  calculateDistanceMeters,
  evaluateCampusGeofence,
  evaluateAttendanceSession,
  validateAttendanceSchedule,
  buildAttendanceQrPayload,
  extractAttendanceQrToken,
  generateStaticQrToken,
} = require('../utils/attendanceHelper');

const NOW = new Date('2026-11-22T09:00:00.000Z');

test('getCampusGeofenceConfig returns WMSU defaults and respects env overrides', () => {
  const def = getCampusGeofenceConfig({});
  assert.deepEqual(def, {
    enabled: true,
    campusName: 'WMSU Main Campus',
    lat: 6.9135,
    lng: 122.0615,
    radiusMeters: 450,
  });

  const disabled = getCampusGeofenceConfig({
    CAMPUS_GEOFENCE_ENABLED: 'false',
    CAMPUS_GEOFENCE_RADIUS_METERS: '300',
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.radiusMeters, 300);
});

test('evaluateCampusGeofence allows inside-campus coordinates and blocks outside or malformed inputs', () => {
  const cfg = getCampusGeofenceConfig({});
  assert.equal(calculateDistanceMeters(6.9135, 122.0615, 6.9135, 122.0615), 0);

  const inside = evaluateCampusGeofence({ latitude: 6.9145, longitude: 122.0618 }, cfg);
  assert.equal(inside.allowed, true);
  assert.equal(inside.reason, 'INSIDE');
  assert.ok(inside.distanceMeters < 450);

  const outside = evaluateCampusGeofence({ latitude: 6.9300, longitude: 122.0800 }, cfg);
  assert.equal(outside.allowed, false);
  assert.equal(outside.reason, 'OUTSIDE');
  assert.ok(outside.distanceMeters > 450);

  for (const bad of [
    { latitude: null, longitude: 122.0615 },
    { latitude: '', longitude: '' },
    { latitude: NaN, longitude: 122.0615 },
    { latitude: 95, longitude: 122.0615 },
    { latitude: 6.9135, longitude: -200 },
  ]) {
    const res = evaluateCampusGeofence(bad, cfg);
    assert.equal(res.allowed, false);
    assert.equal(res.reason, 'INVALID_COORDINATES');
  }

  const offCfg = getCampusGeofenceConfig({ CAMPUS_GEOFENCE_ENABLED: 'false' });
  assert.equal(evaluateCampusGeofence({ latitude: null, longitude: null }, offCfg).allowed, true);
});

test('evaluateAttendanceSession handles manual, scheduled, expired, and manual-override-mid-schedule states', () => {
  assert.equal(evaluateAttendanceSession(null, NOW).effectiveStatus, 'CLOSED');

  const manualOpen = evaluateAttendanceSession({ status: 'OPEN', open_time: '2026-11-22T08:00:00.000Z' }, NOW);
  assert.equal(manualOpen.effectiveStatus, 'ACTIVE');
  assert.equal(manualOpen.isActive, true);

  const upcoming = evaluateAttendanceSession({
    status: 'CLOSED',
    scheduled_open_time: '2026-11-22T09:30:00.000Z',
    scheduled_close_time: '2026-11-22T10:30:00.000Z',
  }, NOW);
  assert.equal(upcoming.effectiveStatus, 'SCHEDULED');
  assert.equal(upcoming.isActive, false);

  const activeWindow = evaluateAttendanceSession({
    status: 'CLOSED',
    scheduled_open_time: '2026-11-22T08:30:00.000Z',
    scheduled_close_time: '2026-11-22T09:30:00.000Z',
  }, NOW);
  assert.equal(activeWindow.effectiveStatus, 'ACTIVE');
  assert.equal(activeWindow.shouldAutoOpen, true);

  const manuallyClosedMidSchedule = evaluateAttendanceSession({
    status: 'CLOSED',
    scheduled_open_time: '2026-11-22T08:30:00.000Z',
    scheduled_close_time: '2026-11-22T09:30:00.000Z',
    closed_manually_at: '2026-11-22T08:45:00.000Z',
  }, NOW);
  assert.equal(manuallyClosedMidSchedule.effectiveStatus, 'CLOSED');
  assert.equal(manuallyClosedMidSchedule.isActive, false);
  assert.equal(manuallyClosedMidSchedule.shouldAutoOpen, false);

  const expiredOpen = evaluateAttendanceSession({
    status: 'OPEN',
    scheduled_open_time: '2026-11-22T07:30:00.000Z',
    scheduled_close_time: '2026-11-22T09:00:00.000Z',
  }, NOW);
  assert.equal(expiredOpen.effectiveStatus, 'CLOSED');
  assert.equal(expiredOpen.shouldAutoClose, true);
});

test('validateAttendanceSchedule and static QR payload helpers work accurately', () => {
  assert.equal(validateAttendanceSchedule({
    scheduledOpenTime: '2026-11-22T08:30:00.000Z',
    scheduledCloseTime: '2026-11-22T09:30:00.000Z',
  }).valid, true);

  assert.equal(validateAttendanceSchedule({
    scheduledOpenTime: '2026-11-22T09:30:00.000Z',
    scheduledCloseTime: '2026-11-22T08:30:00.000Z',
  }).valid, false);

  const tok = generateStaticQrToken();
  assert.equal(tok.length, 64);
  const payload = buildAttendanceQrPayload(tok);
  assert.equal(payload, `CRIMSON-ATT:${tok}`);
  assert.equal(extractAttendanceQrToken(payload), tok);
  assert.equal(extractAttendanceQrToken(`http://localhost:5173/student/attendance/check-in/${tok}`), tok);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/tests/attendanceHelper.test.js`
Expected: FAIL (`Cannot find module '../utils/attendanceHelper'`)

- [ ] **Step 3: Implement `server/utils/attendanceHelper.js`, update `server/database.sql`, and update `Permissions-Policy` in `server/index.js`**

- Create `server/utils/attendanceHelper.js` implementing all functions in the Interfaces block above. Use the exact `schemaPromise` caching pattern from `server/utils/eventRegistrationHelper.js` for `ensureAttendanceSchema(pool)`. Reject empty strings / `null` / `undefined` / non-finite / out-of-range (`|lat| > 90`, `|lng| > 180`) in `evaluateCampusGeofence`. Use Haversine with Earth radius `6371000` meters rounded to nearest integer.
- Update `server/database.sql` lines 289–297 to include `qr_token VARCHAR(128) UNIQUE`, `qr_token_created_at TIMESTAMPTZ`, `scheduled_open_time TIMESTAMPTZ`, `scheduled_close_time TIMESTAMPTZ`, and `closed_manually_at TIMESTAMPTZ` on `event_attendance_sessions`.
- Update `server/index.js:23` from `Permissions-Policy: geolocation=(), microphone=()` to `Permissions-Policy: geolocation=(self), microphone=()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/tests/attendanceHelper.test.js`
Expected: PASS (4/4 tests passing)

- [ ] **Step 5: Commit**

```bash
git add server/utils/attendanceHelper.js server/database.sql server/index.js server/tests/attendanceHelper.test.js
git commit -m "feat: add attendance schedule/geofence helper, schema columns, and geolocation header"
```

---

### Task 2: Staff & Student Attendance Routes + 30-Second Background Worker

**Files:**
- Modify: `server/Routes/mypageAttendance.js:1-435`
- Modify: `server/Routes/attendanceWorker.js:1-19`
- Test: `server/tests/attendanceWorker.test.js`
- Test: `server/tests/attendanceCheckIn.test.js`

**Interfaces:**
- Consumes: all exports from `server/utils/attendanceHelper.js` (Task 1), `notifyAttendanceWindowChange` from `server/utils/notificationService.js`.
- Produces:
  - `GET /api/mypage/attendance/geofence-config` (`authenticateToken`) -> `{ enabled, campusName, lat, lng, radiusMeters }`
  - `GET /api/mypage/attendance/events/:eventId` -> `{ event, session: { id, event_id, status, effective_status, open_time, close_time, scheduled_open_time, scheduled_close_time, closed_manually_at, qr_token_created_at, has_qr_token }, records, summary }`
  - `POST /api/mypage/attendance/events/:eventId/window` (`{ action: 'OPEN'|'CLOSE', closeTime? }`) -> `{ message, session }`
  - `POST /api/mypage/attendance/events/:eventId/schedule` (`{ scheduledOpenTime, scheduledCloseTime, clear?: boolean }`) -> `{ message, session }`
  - `GET /api/mypage/attendance/events/:eventId/qr-credential` -> `{ qrToken, qrPayload, qrCreatedAt, effectiveStatus, scheduledOpenTime, scheduledCloseTime }`
  - `POST /api/mypage/attendance/events/:eventId/qr-credential/regenerate` -> `{ message, qrToken, qrPayload, qrCreatedAt }`
  - `POST /api/mypage/attendance/check-in` (`{ token, eventId?, latitude, longitude }`) -> `200` `{ message, eventId, status: 'PRESENT', checkinTime, alreadyCheckedIn? }` or `400`/`403`/`409` with specific reason
  - Exported pure check-in handler helper `processQrCheckIn(pool, { userId, token, eventId, latitude, longitude, now?, geofenceConfig? }) -> Promise<{ httpStatus, body }>` for direct unit testing without live DB
  - `processAttendanceSessions(poolArg = pool, notifyFn = notifyAttendanceWindowChange)` in `server/Routes/attendanceWorker.js`, scheduled every 30s in `startAttendanceWorker()`

- [ ] **Step 1: Write the failing tests in `server/tests/attendanceWorker.test.js` and `server/tests/attendanceCheckIn.test.js`**

In `server/tests/attendanceWorker.test.js`:
- `test('processAttendanceSessions auto-activates due scheduled session and resets only non-manual ABSENT records')` — mock pool returns 1 due scheduled session (`status: 'CLOSED'`, `scheduled_open_time <= NOW()`, `scheduled_close_time > NOW()`, `closed_manually_at: null`); assert SQL updates session to `'OPEN'`, inserts missing `NOT_MARKED`, resets `ABSENT` with `check_in_method IS DISTINCT FROM 'manual_staff'`, and calls `notifyFn` with `action: 'OPEN'`.
- `test('processAttendanceSessions auto-closes expired scheduled session and marks NOT_MARKED as ABSENT')` — mock pool returns 1 expired session; assert SQL updates session to `'CLOSED'`, updates `NOT_MARKED` → `ABSENT`, and calls `notifyFn` with `action: 'CLOSE'`.
- `test('processAttendanceSessions skips sessions manually closed during their schedule')` — assert the due-to-open SQL filters `(closed_manually_at IS NULL OR closed_manually_at < scheduled_open_time)`.

In `server/tests/attendanceCheckIn.test.js`:
- `test('processQrCheckIn rejects mismatched eventId with 400')` — scanned token belongs to event 10, request sends `eventId: 20` -> `400`, `/different event/i`.
- `test('processQrCheckIn rejects scheduled-not-started and closed sessions with 400')` — verify distinct `"Attendance has not started yet."` vs `"Attendance window is closed for this event."` messages.
- `test('processQrCheckIn rejects off-campus coordinates with 403 OUTSIDE_GEOFENCE')` — verify `httpStatus === 403`, `body.code === 'OUTSIDE_GEOFENCE'`, `distanceMeters > 450`.
- `test('processQrCheckIn rejects pending/rejected/unregistered attendee with 403')` — verify `httpStatus === 403`.
- `test('processQrCheckIn is idempotent for already PRESENT attendee and blocks overwriting manual_staff ABSENT/EXCUSED with 409')` — verify `200` with `alreadyCheckedIn: true` for `PRESENT`, and `409` for `manual_staff` `ABSENT` or `EXCUSED`.
- `test('processQrCheckIn records PRESENT for valid in-window on-campus confirmed registrant and audits real previous_status')` — verify `200`, `body.status === 'PRESENT'`, and audit insert uses previous status (`'ABSENT'` or `'NOT_MARKED'`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test server/tests/attendanceWorker.test.js server/tests/attendanceCheckIn.test.js`
Expected: FAIL (`processQrCheckIn` not exported / worker does not auto-open or auto-close)

- [ ] **Step 3: Implement route updates in `server/Routes/mypageAttendance.js` and worker updates in `server/Routes/attendanceWorker.js`**

- In `server/Routes/mypageAttendance.js`:
  - Call `await ensureAttendanceSchema(pool)` at the start of attendance routes.
  - Add `GET /geofence-config` returning `getCampusGeofenceConfig()`.
  - Update `GET /events/:eventId` to select the new columns on `event_attendance_sessions`, attach `effective_status` via `evaluateAttendanceSession()`, and set `has_qr_token: Boolean(row?.qr_token)` (never leaking raw `qr_token` in the overview payload).
  - Update `POST /events/:eventId/window`:
    - On `'OPEN'`: accept optional `closeTime` (validate ISO future date if provided), upsert `status = 'OPEN'`, `open_time = NOW()`, `closed_manually_at = NULL`, `scheduled_close_time = closeTime || NULL`, `close_time = closeTime || NULL`, `qr_token = COALESCE(event_attendance_sessions.qr_token, $newToken)`, `qr_token_created_at = COALESCE(event_attendance_sessions.qr_token_created_at, NOW())`. Ensure `NOT_MARKED` rows exist for confirmed registrations (`LOWER(status) IN ('registered', 'attended')`), and reset auto-marked `ABSENT` rows (`check_in_method IS DISTINCT FROM 'manual_staff'`) to `NOT_MARKED`.
    - On `'CLOSE'`: update `status = 'CLOSED'`, `close_time = NOW()`, `closed_manually_at = NOW()`; update `NOT_MARKED` rows for this event to `ABSENT` with `check_in_method = 'qr_scan'`.
  - Add `POST /events/:eventId/schedule`:
    - If `req.body.clear === true`: clear `scheduled_open_time = NULL, scheduled_close_time = NULL` (keeping manual status if open).
    - Otherwise validate with `validateAttendanceSchedule()`, upsert session with `scheduled_open_time`, `scheduled_close_time`, `open_time = scheduledOpenTime`, `close_time = scheduledCloseTime`, `closed_manually_at = NULL`, `qr_token = COALESCE(..., $newToken)`. Set `status = 'OPEN'` if `now >= openDate && now < closeDate` (ensuring `NOT_MARKED` rows and resetting non-manual `ABSENT`), else `'CLOSED'`.
  - Update `GET /events/:eventId/qr-credential` to upsert/ensure a static `qr_token` (even when `CLOSED` or `SCHEDULED`) and return `{ qrToken, qrPayload: buildAttendanceQrPayload(qrToken), qrCreatedAt, effectiveStatus, scheduledOpenTime, scheduledCloseTime }`.
  - Add `POST /events/:eventId/qr-credential/regenerate` to replace `qr_token` with `generateStaticQrToken()` and `qr_token_created_at = NOW()`.
  - Implement and export `processQrCheckIn(pool, params)` (also attached to `router.processQrCheckIn = processQrCheckIn` so `module.exports = router` preserves Express mounting) and wire `POST /check-in` to it. Note: `extractAttendanceQrToken(token)` cleans `CRIMSON-ATT:` before querying `event_attendance_sessions WHERE qr_token = $1`.
- In `server/Routes/attendanceWorker.js`:
  - Call `await ensureAttendanceSchema(poolArg)` before querying.
  - Auto-activate due scheduled sessions, ensure `NOT_MARKED`, reset non-manual `ABSENT`, notify `'OPEN'`.
  - Auto-close expired scheduled sessions (`scheduled_close_time <= NOW()` and `status = 'OPEN'` or unfinalized schedule), insert missing `NOT_MARKED`, mark `NOT_MARKED` → `ABSENT`, notify `'CLOSE'`.
  - Keep legacy `event_qr_tokens` cleanup. Change `setInterval` from `60 * 1000` to `30 * 1000`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test server/tests/attendanceHelper.test.js server/tests/attendanceWorker.test.js server/tests/attendanceCheckIn.test.js`
Expected: PASS (all tests passing)

- [ ] **Step 5: Commit**

```bash
git add server/Routes/mypageAttendance.js server/Routes/attendanceWorker.js server/tests/attendanceWorker.test.js server/tests/attendanceCheckIn.test.js
git commit -m "feat: support static QR, scheduled windows, and server geofence check-in"
```

---

### Task 3: `/users/my-events` Attendance Metadata & `'Attended'` Registration Fix

**Files:**
- Modify: `server/Routes/userRoutes.js:2340-2412`
- Test: `server/tests/myEventsAttendanceMapping.test.js`

**Interfaces:**
- Consumes: `ensureAttendanceSchema`, `evaluateAttendanceSession` from `server/utils/attendanceHelper.js` (Task 1).
- Produces:
  - Exported pure helper `mapMyEventRowWithAttendance(row, now = new Date())` (e.g., on `server/utils/attendanceHelper.js` and used by `GET /users/my-events`) returning the row with:
    - `date`: `row.event_date` (preserving existing date field expected by `MyEvents.jsx`!)
    - `is_registered`: `Boolean(['registered', 'attended'].includes(String(row.registration_status || '').toLowerCase()))`
    - `attendance_status`: `'ACTIVE' | 'SCHEDULED' | 'CLOSED'`
    - `attendance_open_time`: `string | null`
    - `attendance_close_time`: `string | null`
    - `user_attendance_status`: `'PRESENT' | 'ABSENT' | 'NOT_MARKED' | 'EXCUSED' | null`
    - `user_checkin_time`: `string | null`

- [ ] **Step 1: Write the failing test in `server/tests/myEventsAttendanceMapping.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { mapMyEventRowWithAttendance } = require('../utils/attendanceHelper');

const NOW = new Date('2026-11-22T09:00:00.000Z');

test('mapMyEventRowWithAttendance preserves is_registered for Attended status and exposes effective window state', () => {
  const row = mapMyEventRowWithAttendance({
    id: 5,
    event_date: '2026-11-22T08:00:00.000Z',
    registration_status: 'Attended',
    session_status: 'OPEN',
    session_open_time: '2026-11-22T08:30:00.000Z',
    session_close_time: '2026-11-22T09:30:00.000Z',
    session_scheduled_open_time: '2026-11-22T08:30:00.000Z',
    session_scheduled_close_time: '2026-11-22T09:30:00.000Z',
    session_closed_manually_at: null,
    user_attendance_status: 'PRESENT',
    user_checkin_time: '2026-11-22T08:42:00.000Z',
  }, NOW);

  assert.equal(row.is_registered, true);
  assert.equal(row.date, '2026-11-22T08:00:00.000Z');
  assert.equal(row.attendance_status, 'ACTIVE');
  assert.equal(row.user_attendance_status, 'PRESENT');
  assert.equal(row.user_checkin_time, '2026-11-22T08:42:00.000Z');
});

test('mapMyEventRowWithAttendance marks pending/rejected as not registered and exposes SCHEDULED window', () => {
  const pendingRow = mapMyEventRowWithAttendance({
    id: 6,
    event_date: '2026-11-22T10:00:00.000Z',
    registration_status: 'Pending',
    session_status: 'CLOSED',
    session_scheduled_open_time: '2026-11-22T09:30:00.000Z',
    session_scheduled_close_time: '2026-11-22T10:30:00.000Z',
    user_attendance_status: null,
  }, NOW);

  assert.equal(pendingRow.is_registered, false);
  assert.equal(pendingRow.attendance_status, 'SCHEDULED');
  assert.equal(pendingRow.attendance_open_time, '2026-11-22T09:30:00.000Z');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/tests/myEventsAttendanceMapping.test.js`
Expected: FAIL (`mapMyEventRowWithAttendance is not a function`)

- [ ] **Step 3: Implement `mapMyEventRowWithAttendance` in `server/utils/attendanceHelper.js` and wire `GET /my-events` in `server/Routes/userRoutes.js`**

- Add `mapMyEventRowWithAttendance(row, now = new Date())` to `server/utils/attendanceHelper.js` and export it. Strip internal `session_*` raw columns from the returned object so responses stay tidy.
- In `server/Routes/userRoutes.js` (`GET /my-events`):
  - Call `await ensureAttendanceSchema(pool)`.
  - Include `ed.event_date AS date`, update `is_registered` to `CASE WHEN LOWER(er.status) IN ('registered', 'attended') THEN TRUE ELSE FALSE END AS is_registered`, and `LEFT JOIN event_attendance_sessions eas ON eas.event_post_id = p.post_id` + `LEFT JOIN event_attendance_records ar ON ar.registration_id = er.registration_id` selecting `eas.status AS session_status`, `eas.open_time AS session_open_time`, `eas.close_time AS session_close_time`, `eas.scheduled_open_time AS session_scheduled_open_time`, `eas.scheduled_close_time AS session_scheduled_close_time`, `eas.closed_manually_at AS session_closed_manually_at`, `ar.status AS user_attendance_status`, `ar.checkin_time AS user_checkin_time`.
  - Map `result.rows` through `mapMyEventRowWithAttendance`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/tests/myEventsAttendanceMapping.test.js`
Expected: PASS (2/2 tests passing)

- [ ] **Step 5: Commit**

```bash
git add server/utils/attendanceHelper.js server/Routes/userRoutes.js server/tests/myEventsAttendanceMapping.test.js
git commit -m "feat: include live attendance state and preserve Attended status in /users/my-events"
```

---

### Task 4: Client Attendance Utilities + Staff `MyPageAttendance` Static QR & Schedule UI

**Files:**
- Modify: `client/package.json` (install `qrcode`)
- Create: `client/src/utils/attendanceUtils.js`
- Create: `client/src/utils/attendanceUtils.test.js`
- Modify: `client/src/pages/Staff/MyPageDashboard/MyPageAttendance.jsx:1-580`
- Modify: `client/src/pages/styles/MyPageAttendance.css`

**Interfaces:**
- Consumes: Task 2 endpoints (`GET /events/:eventId`, `POST /events/:eventId/window`, `POST /events/:eventId/schedule`, `GET /events/:eventId/qr-credential`, `POST /events/:eventId/qr-credential/regenerate`).
- Produces (`client/src/utils/attendanceUtils.js`):
  - `extractAttendanceToken(rawValue) -> string` (handles `CRIMSON-ATT:<token>`, URLs, raw tokens)
  - `calculateClientDistanceMeters(lat1, lng1, lat2, lng2) -> number`
  - `evaluateClientGeofence({ latitude, longitude }, config) -> { allowed: boolean, distanceMeters: number|null, radiusMeters: number, campusName: string }`
  - `getAttendanceButtonState({ attendanceStatus, attendanceOpenTime, attendanceCloseTime, userAttendanceStatus, registrationStatus }) -> { visible: boolean, mode: 'PRESENT'|'ACTIVE'|'SCHEDULED'|'CLOSED'|'MANUAL_LOCKED', clickable: boolean, label: string, tooltip: string }`
  - `toLocalDateTimeInputValue(isoString) -> string` (`YYYY-MM-DDTHH:mm` in local time for `<input type="datetime-local">`)

- [ ] **Step 1: Install `qrcode` in `client` and write failing unit tests in `client/src/utils/attendanceUtils.test.js`**

Run: `Set-Location client; npm install qrcode`

Write `client/src/utils/attendanceUtils.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAttendanceToken,
  evaluateClientGeofence,
  getAttendanceButtonState,
} from './attendanceUtils.js';

test('extractAttendanceToken parses CRIMSON-ATT payloads and legacy URLs', () => {
  const tok = 'a'.repeat(64);
  assert.equal(extractAttendanceToken(`CRIMSON-ATT:${tok}`), tok);
  assert.equal(extractAttendanceToken(`http://localhost:5173/student/attendance/check-in/${tok}`), tok);
  assert.equal(extractAttendanceToken(`  ${tok}  `), tok);
});

test('evaluateClientGeofence checks campus distance accurately', () => {
  const cfg = { enabled: true, campusName: 'WMSU Main Campus', lat: 6.9135, lng: 122.0615, radiusMeters: 450 };
  assert.equal(evaluateClientGeofence({ latitude: 6.9138, longitude: 122.0616 }, cfg).allowed, true);
  assert.equal(evaluateClientGeofence({ latitude: 6.9400, longitude: 122.0900 }, cfg).allowed, false);
  assert.equal(evaluateClientGeofence({ latitude: NaN, longitude: 122.0615 }, cfg).allowed, false);
});

test('getAttendanceButtonState gates scanning strictly to ACTIVE sessions and shows Present badge for Attended users', () => {
  const present = getAttendanceButtonState({
    attendanceStatus: 'CLOSED',
    userAttendanceStatus: 'PRESENT',
    registrationStatus: 'Attended',
  });
  assert.equal(present.mode, 'PRESENT');
  assert.equal(present.clickable, false);

  const active = getAttendanceButtonState({
    attendanceStatus: 'ACTIVE',
    userAttendanceStatus: 'NOT_MARKED',
    registrationStatus: 'Registered',
  });
  assert.equal(active.mode, 'ACTIVE');
  assert.equal(active.clickable, true);
  assert.equal(active.label, 'Attendance');

  const scheduled = getAttendanceButtonState({
    attendanceStatus: 'SCHEDULED',
    attendanceOpenTime: '2026-11-22T00:30:00.000Z',
    userAttendanceStatus: null,
    registrationStatus: 'Registered',
  });
  assert.equal(scheduled.mode, 'SCHEDULED');
  assert.equal(scheduled.clickable, false);
  assert.match(scheduled.label, /Opens/i);

  const closed = getAttendanceButtonState({
    attendanceStatus: 'CLOSED',
    userAttendanceStatus: null,
    registrationStatus: 'Registered',
  });
  assert.equal(closed.mode, 'CLOSED');
  assert.equal(closed.clickable, false);

  const pending = getAttendanceButtonState({
    attendanceStatus: 'ACTIVE',
    registrationStatus: 'Pending',
  });
  assert.equal(pending.visible, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test client/src/utils/attendanceUtils.test.js`
Expected: FAIL (`Cannot find module './attendanceUtils.js'`)

- [ ] **Step 3: Implement `client/src/utils/attendanceUtils.js` and update `MyPageAttendance.jsx` + `MyPageAttendance.css`**

- Create `client/src/utils/attendanceUtils.js` implementing all 5 functions in the Interfaces block.
- Update `client/src/pages/Staff/MyPageDashboard/MyPageAttendance.jsx`:
  - Remove the 30-second `qrCountdown` interval and `api.qrserver.com` `<img>` URL.
  - Fetch static QR via `GET /api/mypage/attendance/events/:eventId/qr-credential` whenever an event is selected (regardless of whether status is `CLOSED`, `SCHEDULED`, or `ACTIVE`), and render it locally using `QRCode.toDataURL(qrPayload, { width: 320, margin: 2 })`.
  - Rename the tab label from `"Live QR Display"` to `"Attendance QR"`.
  - In the **Attendance QR** tab:
    - Show a clear status banner (`Inactive — safe to screenshot & share with assistants now; students cannot scan until activated`, `Scheduled: <start> – <end>`, or `Active — accepting on-campus scans`).
    - Show the static QR image + note that scans require being within **WMSU Main Campus**.
    - Add **Download QR** button (draws a clean white card canvas with event title + QR image and downloads `attendance_qr_event_<id>.png`) and **Regenerate QR** button (with `window.confirm` warning that previous screenshots will stop working, calling `POST /api/mypage/attendance/events/:eventId/qr-credential/regenerate`).
  - In the **Controls Card**:
    - Display effective status badge (`ACTIVE` / `SCHEDULED` / `CLOSED`) using `eventData.session?.effective_status || eventData.session?.status`.
    - Manual **Activate Attendance** / **Deactivate Attendance** button (`POST /window`).
    - **Schedule Window** form with Start (`datetime-local`), End (`datetime-local`), **Save Schedule** (`POST /schedule`), and **Clear Schedule** (`POST /schedule` with `{ clear: true }`). Pre-populate inputs from `session.scheduled_open_time` / `session.scheduled_close_time` when available.
- Update `client/src/pages/styles/MyPageAttendance.css` with clean responsive styling for the schedule form, status badges (`scheduled`, `active`, `closed`), QR status banner, and Download/Regenerate action row.

- [ ] **Step 4: Run tests and client build**

Run: `node --test client/src/utils/attendanceUtils.test.js`
Run: `Set-Location client; npm run build`
Expected: Unit tests PASS; Vite production build succeeds with zero errors.

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/package-lock.json client/src/utils/attendanceUtils.js client/src/utils/attendanceUtils.test.js client/src/pages/Staff/MyPageDashboard/MyPageAttendance.jsx client/src/pages/styles/MyPageAttendance.css
git commit -m "feat: add static shareable QR, download/regenerate, and schedule controls to staff attendance UI"
```

---

### Task 5: Geofenced `QRCheckInScanner`, Gated **My Events** Attendance Button & Legacy Entry-Point Cleanup

**Files:**
- Modify: `client/src/assets/components/QRCheckInScanner.jsx:1-512`
- Modify: `client/src/assets/components/PortalShellElements.jsx:1240-1425`
- Modify: `client/src/pages/Student/MyEvents.jsx`
- Modify: `client/src/pages/Staff/StaffMyEvents.jsx`
- Modify (remove legacy `prompt()` `onScanAttendance` handlers):
  - `client/src/pages/Student/StudentDashboard.jsx`
  - `client/src/pages/Student/Events.jsx`
  - `client/src/pages/Staff/StaffDashboard.jsx`
  - `client/src/pages/Staff/StaffEvents.jsx`
  - `client/src/pages/Common/PageView.jsx`
  - `client/src/pages/Staff/MyPageDashboard/MyPageDashboard.jsx`
  - `client/src/pages/Staff/MyPageDashboard/MyPageEvents.jsx`
- Modify (set `showQrButton={false}` per Spec 5.7):
  - `client/src/assets/components/DashboardLayout.jsx`
  - `client/src/assets/components/StaffDashboardLayout.jsx`
  - `client/src/assets/components/MyPageDashboardLayout.jsx`
  - `client/src/pages/Staff/MyPageDashboard/MyPageProfile.jsx`
  - `client/src/pages/Common/PageView.jsx`

**Interfaces:**
- Consumes: `GET /api/mypage/attendance/geofence-config`, `POST /api/mypage/attendance/check-in` (Task 2); `/users/my-events` attendance fields (Task 3); `extractAttendanceToken`, `evaluateClientGeofence`, `getAttendanceButtonState` from `client/src/utils/attendanceUtils.js` (Task 4).
- Produces:
  - `QRCheckInScanner({ role = 'student', isModal = false, expectedEventId = null, eventTitle = '', onClose, onCheckInSuccess })`
  - `EventPostActionBar` extended props: `attendanceStatus`, `attendanceOpenTime`, `attendanceCloseTime`, `userAttendanceStatus`, `userCheckinTime`

- [ ] **Step 1: Update `QRCheckInScanner.jsx` with the Campus Location Gate & `CRIMSON-ATT:` parsing**

- Import `extractAttendanceToken` and `evaluateClientGeofence` from `../../utils/attendanceUtils`.
- Add props `expectedEventId = null`, `eventTitle = ''`, `onCheckInSuccess = null`.
- On mount (for both modal mode and direct-route mode), run a `verifyLocation()` check:
  - Fetch `GET http://localhost:5000/api/mypage/attendance/geofence-config` with Bearer token.
  - If `config.enabled` is `false`, mark location verified (`locationState = 'verified'`) immediately.
  - Otherwise set `locationState = 'checking'`, request `navigator.geolocation.getCurrentPosition(..., { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })`:
    - Evaluate with `evaluateClientGeofence`.
    - If `allowed`: save `{ latitude, longitude, checkedAt: Date.now() }` in a ref, set `locationState = 'verified'`, and either auto-start camera (in modal scan mode) or proceed to `submitTokenCheckIn(token)` (in direct-route mode).
    - If outside campus: set `locationState = 'blocked_outside'` with distance/radius details; render an **Outside Campus Area** view with a **Retry Location Check** button (camera stays off).
    - If denied/unavailable/timeout: set `locationState = 'blocked_error'` with clear instructions to enable Location Services (noting staff can manually mark attendance if GPS is unavailable) + **Retry Location Check** button.
- In `submitTokenCheckIn(rawToken)`:
  - Extract token via `extractAttendanceToken(rawToken)`.
  - Attach `{ token: cleanToken, ...(expectedEventId ? { eventId: expectedEventId } : {}), ...(coordsRef.current ? { latitude: coordsRef.current.latitude, longitude: coordsRef.current.longitude } : {}) }` to `POST http://localhost:5000/api/mypage/attendance/check-in`.
  - On `response.ok`, call `onCheckInSuccess?.(data)`.
- Show `eventTitle` cleanly in the modal header/subtitle when provided, and hide `"Scan Another"` when `expectedEventId` is set (since the student just finished checking in for that specific event).

- [ ] **Step 2: Update `EventPostActionBar` in `PortalShellElements.jsx`**

- Recognize `'attended'` in `isConfirmed`: `const isConfirmed = normStatus === 'registered' || normStatus === 'attended';` and `const isAttended = normStatus === 'attended' || String(userAttendanceStatus || '').toUpperCase() === 'PRESENT';`.
- When `attendanceStatus !== undefined` (passed by My Events):
  - Compute state via `getAttendanceButtonState(...)`.
  - Render:
    - `mode === 'PRESENT'`: non-clickable green badge `<i className="fa-solid fa-circle-check" /> Present` (with check-in time tooltip).
    - `mode === 'ACTIVE'`: clickable crimson button `<i className="fa-solid fa-qrcode" /> Attendance` triggering `onScanAttendance`.
    - `mode === 'SCHEDULED'` or `mode === 'CLOSED'`: disabled muted button showing `label` (e.g. `Attendance · Opens 8:30 AM` or `Attendance Closed`) with `tooltip`.
- Hide the "Cancel Registration" button when `isAttended` is true (keep showing the green `Attended` status pill instead of `Registered`).

- [ ] **Step 3: Wire `MyEvents.jsx` and `StaffMyEvents.jsx` to the gated `QRCheckInScanner` modal**

- In both `client/src/pages/Student/MyEvents.jsx` and `client/src/pages/Staff/StaffMyEvents.jsx`:
  - Add `const [scannerEvent, setScannerEvent] = useState(null);`.
  - Refetch `/users/my-events` on window `focus` (so an open tab unlocks the **Attendance** button automatically when 8:30 AM arrives).
  - Do **not** gate attendance visibility or clickability on `isUpcoming` (`new Date(item.date) >= new Date()`), because events already underway (e.g., an 8:00 AM event with an 8:30 AM – 9:30 AM attendance window) have `item.date < now`. Gate strictly on `item.is_registered` and the live `attendance_status` (`ACTIVE` / `SCHEDULED` / `CLOSED` / `PRESENT`).
  - Show `'Attended'` on the card header pill when `registration_status` is `'Attended'` or `user_attendance_status === 'PRESENT'`.
  - Pass `attendanceStatus={item.attendance_status}`, `attendanceOpenTime={item.attendance_open_time}`, `attendanceCloseTime={item.attendance_close_time}`, `userAttendanceStatus={item.user_attendance_status}`, `userCheckinTime={item.user_checkin_time}` to `<EventPostActionBar />`.
  - Replace the `prompt(...)` `onScanAttendance` callback with `() => setScannerEvent(item)` (whenever `item.attendance_status === 'ACTIVE' && item.is_registered`).
  - Render `<QRCheckInScanner role="student"|"staff" isModal={true} expectedEventId={scannerEvent.id} eventTitle={scannerEvent.title} onClose={() => setScannerEvent(null)} onCheckInSuccess={...} />` inside a modal backdrop portal when `scannerEvent` is set, updating the matching event's `user_attendance_status: 'PRESENT'` and `registration_status: 'Attended'` immediately on success.

- [ ] **Step 4: Remove legacy `prompt()` attendance buttons and hide unscoped top-navbar QR button**

- Remove `onScanAttendance={...prompt(...)}` props from:
  - `client/src/pages/Student/StudentDashboard.jsx`
  - `client/src/pages/Student/Events.jsx`
  - `client/src/pages/Staff/StaffDashboard.jsx`
  - `client/src/pages/Staff/StaffEvents.jsx`
  - `client/src/pages/Common/PageView.jsx`
  - `client/src/pages/Staff/MyPageDashboard/MyPageDashboard.jsx`
  - `client/src/pages/Staff/MyPageDashboard/MyPageEvents.jsx`
- Set `showQrButton={false}` on:
  - `client/src/assets/components/DashboardLayout.jsx`
  - `client/src/assets/components/StaffDashboardLayout.jsx`
  - `client/src/assets/components/MyPageDashboardLayout.jsx`
  - `client/src/pages/Staff/MyPageDashboard/MyPageProfile.jsx`
  - `client/src/pages/Common/PageView.jsx`

- [ ] **Step 5: Run full verification suite**

Run:
1. `node --test server/tests/attendanceHelper.test.js server/tests/attendanceWorker.test.js server/tests/attendanceCheckIn.test.js server/tests/myEventsAttendanceMapping.test.js client/src/utils/attendanceUtils.test.js`
2. `Set-Location client; npm run build`
3. Verify zero remaining `prompt("Scan or enter event QR token:")` occurrences across `client/src`.
4. Confirm `git status` shows `server/.env` untouched and unstaged.

Expected: All unit tests pass, Vite build passes cleanly, zero remaining `prompt()` scan triggers.

- [ ] **Step 6: Commit**

```bash
git add client/src/assets/components/QRCheckInScanner.jsx client/src/assets/components/PortalShellElements.jsx client/src/pages/Student/MyEvents.jsx client/src/pages/Staff/StaffMyEvents.jsx client/src/pages/Student/StudentDashboard.jsx client/src/pages/Student/Events.jsx client/src/pages/Staff/StaffDashboard.jsx client/src/pages/Staff/StaffEvents.jsx client/src/pages/Common/PageView.jsx client/src/pages/Staff/MyPageDashboard/MyPageDashboard.jsx client/src/pages/Staff/MyPageDashboard/MyPageEvents.jsx client/src/assets/components/DashboardLayout.jsx client/src/assets/components/StaffDashboardLayout.jsx client/src/assets/components/MyPageDashboardLayout.jsx client/src/pages/Staff/MyPageDashboard/MyPageProfile.jsx
git commit -m "feat: gate My Events attendance scanner with campus geofence and remove legacy prompt triggers"
```
