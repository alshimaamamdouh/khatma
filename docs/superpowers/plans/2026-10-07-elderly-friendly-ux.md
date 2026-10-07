# Elderly-Friendly Khatma UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the khatma site so people aged 68–80 can open a WhatsApp link, see their juz, and mark it finished — and organizers can create/manage a khatma — without help.

**Architecture:** Keep the existing React (Vite) client and Express/Mongoose server. The server gains a per-participant token (ownership enforcement), idempotent completions, an optional organizer phone, and a `nextChangeDate`. The client is rebuilt around link-based entry (`/k/<code>`, `/m/<code>#<password>`), per-khatma phone storage, one big "my juz" screen, and a tile-based organizer menu. Old khatmas, codes and passwords keep working.

**Tech Stack:** Node 22, Express 4, Mongoose 9, React 18, react-router-dom 6, Vite 6. Tests: `node:test` + `mongodb-memory-server` (server), `node:test` (client pure utils), Playwright (`@playwright/test`, Chromium, iPhone 13 viewport 390×844).

**Spec:** `docs/superpowers/specs/2026-10-07-elderly-friendly-ux-design.md` — read it before starting.

## Global Constraints

- Body text ≥ 20px (`html { font-size: 125% }` → 1rem = 20px). Juz number ~3rem. Buttons ≥ 56px tall; primary action full width.
- One primary action per screen; secondary actions are `.link-button` (quiet).
- Status never color-only: always text + icon — `✅ أنهى` / `⏳ لم ينته بعد`.
- Every button has a text label.
- Banned UI words outside the legacy code entry / legacy login: CSV, شاغر, التكرار, رمز, كلمة مرور.
- Arabic-Indic digits for juz numbers and counts via `ar(n)`.
- Destructive or reversing actions use `ConfirmDialog` ("هل …؟ [نعم، …] [لا]").
- Every action that changes state disables its button while in flight AND is guarded by a `useRef` flag (a second tap in the same tick must do nothing).
- The admin password never appears in logs, analytics, error reports, or any URL sent to the backend. It travels only in the `x-admin-password` header. Do not add request-logging middleware. Do not `console.log` headers or bodies.
- Never point tests or dev runs at the production database. All tests use `mongodb-memory-server`. Playwright's `webServer` must have `reuseExistingServer: false`.
- Do not push or deploy before Task 9 (Release). Between Task 3 and Task 8 the old pages (`Dashboard`, `ManageKhatma`, …) are not functional; that is expected.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File Map

**Server**
| File | Change | Responsibility |
|---|---|---|
| `server/package.json` | modify | `test`, `dev:memory` scripts; `mongodb-memory-server` devDependency |
| `server/test/helpers.js` | create | start in-memory DB + app, HTTP helper, khatma factory |
| `server/test/*.test.js` | create | server tests |
| `server/scripts/dev-memory.js` | create | API on :3000 backed by an in-memory DB (for Playwright) |
| `server/utils/rotation.js` | modify | add `getNextChangeDate` |
| `server/utils/phone.js` | create | `normalizePhone` |
| `server/utils/token.js` | create | `newToken` |
| `server/models/Khatma.js` | modify | `organizer_phone` |
| `server/models/Participant.js` | modify | `token` (`select: false`) |
| `server/middleware/auth.js` | modify | `canActFor(req, participantId)` |
| `server/routes/khatma.js` | modify | phone on create/update/admin-login/dashboard; `nextChangeDate`; join returns token; delete removes completions |
| `server/routes/participants.js` | modify | `POST /:pid/claim` |
| `server/routes/completions.js` | modify | ownership check; idempotent mark/undo |

**Client**
| File | Change | Responsibility |
|---|---|---|
| `client/package.json` | modify | `test:unit`, `test:e2e`; `@playwright/test` |
| `client/playwright.config.js` | create | phone viewport, starts in-memory API + Vite |
| `client/e2e/api.js` | create | API helpers for e2e setup/assertions |
| `client/e2e/*.spec.js` | create | flows |
| `client/src/utils/arabicNumbers.js` | create | `ar(n)` |
| `client/src/utils/links.js` | create | codes/passwords, links, WhatsApp messages |
| `client/src/utils/storage.js` | create | all localStorage access, per-khatma records, legacy migration |
| `client/src/api/client.js` | modify | headers from storage, `err.status`, network error, `claimParticipant` |
| `client/src/main.jsx` | modify | run migration, import `elderly.css` |
| `client/src/elderly.css` | create | all new large-UI styles |
| `client/src/components/Header.jsx` | modify | title only |
| `client/src/components/ConfirmDialog.jsx` | create | shared confirmation |
| `client/src/components/BackButton.jsx` | create | big "رجوع" |
| `client/src/components/ShareButtons.jsx` | create | WhatsApp family + manage-link buttons |
| `client/src/components/WhoAreYou.jsx` | create | name list + "هل أنت…؟" |
| `client/src/components/QuickJuzPicker.jsx` | create | free juz rows + name entry |
| `client/src/components/MyJuzCard.jsx` | create | juz hero + read/finish/undo |
| `client/src/components/ParticipantsList.jsx` | create | collapsed view-only list |
| `client/src/components/DedicationLine.jsx` | create | one-sentence dedication |
| `client/src/pages/KhatmaPage.jsx` | create | `/k/:code` |
| `client/src/pages/ManageEntry.jsx` | create | `/m/:code#pw` |
| `client/src/pages/LegacyLogin.jsx` | create | `/manage-login` |
| `client/src/pages/LegacyRedirects.jsx` | create | old URLs → new |
| `client/src/pages/manage/*` | create | layout, menu, one screen per tile |
| `client/src/pages/HistoryPage.jsx`, `StatsPage.jsx` | modify | use manage outlet context + BackButton |
| `client/src/pages/HomePage.jsx`, `CreateKhatma.jsx` | rewrite | |
| `client/src/App.jsx` | modify | routes |
| `Dashboard.jsx`, `SelectParticipant.jsx`, `ManageKhatma.jsx`, `AdminPage.jsx`, `KhatmaGrid.jsx`, `DeceasedInfo.jsx`, `utils/juzNames.js` | delete (Task 9) | |

---

### Task 1: Server test harness, organizer phone, next change date

**Files:**
- Modify: `server/package.json`
- Create: `server/test/helpers.js`, `server/test/rotation.test.js`, `server/test/khatma-fields.test.js`, `server/scripts/dev-memory.js`, `server/utils/phone.js`
- Modify: `server/utils/rotation.js`, `server/models/Khatma.js`, `server/routes/khatma.js`

**Interfaces:**
- Produces: `getNextChangeDate(startDate: string, rotationType: string, customDays: number|null, currentDate?: Date) => 'YYYY-MM-DD' | null`; `normalizePhone(value: any) => string|null`; dashboard JSON gains `khatma.organizer_phone` and top-level `nextChangeDate`; admin-login JSON gains `khatma.organizer_phone`; `POST /khatma` and `PUT /khatma/:id` accept `organizerPhone`.
- Produces (test infra): `server/test/helpers.js` exports `start()`, `stop()`, `call(method, path, { body, headers })`, `createKhatma(overrides)`.

- [ ] **Step 1: Install the in-memory database and add scripts**

Run: `cd server && npm install --save-dev mongodb-memory-server@^10`

Then edit `server/package.json` `scripts` to:

```json
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "dev:memory": "node scripts/dev-memory.js",
    "test": "node --test test/*.test.js"
  },
```

- [ ] **Step 2: Create the test helpers**

`server/test/helpers.js`:

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;
let server;
let baseUrl;

// Starts an in-memory MongoDB and the API on a random port. Never touches a real database.
async function start() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  const app = require('../index');
  await new Promise(resolve => { server = app.listen(0, resolve); });
  baseUrl = `http://localhost:${server.address().port}/api`;
}

async function stop() {
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
}

async function call(method, path, { body, headers = {} } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function createKhatma(overrides = {}) {
  const body = {
    name: 'ختمة تجربة',
    accessCode: 'code' + Math.random().toString(36).slice(2, 10),
    adminPassword: 'secret-pass',
    startDate: '2026-01-04',
    rotationType: 'weekly',
    ...overrides
  };
  const res = await call('POST', '/khatma', { body });
  return { id: res.data.id, code: body.accessCode, password: body.adminPassword, res };
}

module.exports = { start, stop, call, createKhatma };
```

- [ ] **Step 3: Write failing tests for `getNextChangeDate`**

`server/test/rotation.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { getNextChangeDate } = require('../utils/rotation');

test('weekly: next change is the next 7-day boundary after the start', () => {
  assert.strictEqual(getNextChangeDate('2026-01-04', 'weekly', null, new Date('2026-01-06T10:00:00')), '2026-01-11');
});

test('on a boundary day, the next change is one full cycle later', () => {
  assert.strictEqual(getNextChangeDate('2026-01-04', 'weekly', null, new Date('2026-01-11T10:00:00')), '2026-01-18');
});

test('custom days are respected', () => {
  assert.strictEqual(getNextChangeDate('2026-01-01', 'custom', 10, new Date('2026-01-05T10:00:00')), '2026-01-11');
});

test('before the start date, the first cycle ends one cycle after the start', () => {
  assert.strictEqual(getNextChangeDate('2026-02-01', 'weekly', null, new Date('2026-01-20T10:00:00')), '2026-02-08');
});

test('daily returns null (the line is not shown)', () => {
  assert.strictEqual(getNextChangeDate('2026-01-04', 'daily', null, new Date('2026-01-06T10:00:00')), null);
});
```

- [ ] **Step 4: Run and verify failure**

Run: `cd server && node --test test/rotation.test.js`
Expected: FAIL — `getNextChangeDate is not a function`.

- [ ] **Step 5: Implement `getNextChangeDate`**

In `server/utils/rotation.js`, add above `module.exports`:

```js
function toDateString(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Date (YYYY-MM-DD) when the participants' juz next changes, or null for daily khatmas.
 * Cycle boundaries are always start + k * cycleDays (pauses skip whole cycles, they don't move boundaries).
 */
function getNextChangeDate(startDate, rotationType, customDays, currentDate = new Date()) {
  if (rotationType === 'daily') return null;
  const cycleDays = getCycleDays(rotationType, customDays);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((now - start) / (1000 * 60 * 60 * 24));
  const cyclesDone = Math.max(0, Math.floor(diffDays / cycleDays));
  const next = new Date(start);
  next.setDate(next.getDate() + (cyclesDone + 1) * cycleDays);
  return toDateString(next);
}
```

and change the export line to:

```js
module.exports = { getCycleNumber, getCurrentJuz, getCycleDedication, isPaused, getRotationLabel, getCycleDays, getNextChangeDate };
```

- [ ] **Step 6: Run and verify pass**

Run: `cd server && node --test test/rotation.test.js`
Expected: 5 passing.

- [ ] **Step 7: Write failing tests for the phone and dashboard fields**

`server/test/khatma-fields.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');
const { normalizePhone } = require('../utils/phone');

test.before(start);
test.after(stop);

const codeHeader = k => ({ 'x-khatma-code': encodeURIComponent(k.code) });
const adminHeader = k => ({ 'x-admin-password': encodeURIComponent(k.password) });

test('normalizePhone keeps digits and drops + and leading 00', () => {
  assert.strictEqual(normalizePhone('+973 3612-3456'), '97336123456');
  assert.strictEqual(normalizePhone('0097336123456'), '97336123456');
  assert.strictEqual(normalizePhone(''), null);
  assert.strictEqual(normalizePhone(null), null);
  assert.strictEqual(normalizePhone('12'), null);
});

test('organizer phone is saved on create and returned by the dashboard', async () => {
  const k = await createKhatma({ organizerPhone: '+973 3612 3456' });
  const res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: codeHeader(k) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.khatma.organizer_phone, '97336123456');
});

test('organizer phone can be changed and cleared by the organizer', async () => {
  const k = await createKhatma();
  await call('PUT', `/khatma/${k.id}`, { body: { organizerPhone: '201001234567' }, headers: adminHeader(k) });
  let res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: codeHeader(k) });
  assert.strictEqual(res.data.khatma.organizer_phone, '201001234567');

  await call('PUT', `/khatma/${k.id}`, { body: { organizerPhone: '' }, headers: adminHeader(k) });
  res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: codeHeader(k) });
  assert.strictEqual(res.data.khatma.organizer_phone, null);
});

test('admin login returns the organizer phone', async () => {
  const k = await createKhatma({ organizerPhone: '97336123456' });
  const res = await call('POST', '/khatma/admin-login', { body: { code: k.code, adminPassword: k.password } });
  assert.strictEqual(res.data.khatma.organizer_phone, '97336123456');
});

test('dashboard returns nextChangeDate for weekly and null for quick and daily', async () => {
  const weekly = await createKhatma();
  let res = await call('GET', `/khatma/${weekly.id}/dashboard`, { headers: codeHeader(weekly) });
  assert.match(res.data.nextChangeDate, /^\d{4}-\d{2}-\d{2}$/);

  const quick = await createKhatma({ isQuick: true });
  res = await call('GET', `/khatma/${quick.id}/dashboard`, { headers: codeHeader(quick) });
  assert.strictEqual(res.data.nextChangeDate, null);

  const daily = await createKhatma({ rotationType: 'daily' });
  res = await call('GET', `/khatma/${daily.id}/dashboard`, { headers: codeHeader(daily) });
  assert.strictEqual(res.data.nextChangeDate, null);
});

test('dashboard returns null nextChangeDate while paused', async () => {
  const k = await createKhatma();
  const today = new Date().toISOString().slice(0, 10);
  await call('PUT', `/khatma/${k.id}`, { body: { pausedFrom: '2020-01-01', pausedTo: '2099-01-01' }, headers: adminHeader(k) });
  const res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: codeHeader(k) });
  assert.strictEqual(res.data.paused, true, `expected paused on ${today}`);
  assert.strictEqual(res.data.nextChangeDate, null);
});
```

- [ ] **Step 8: Run and verify failure**

Run: `cd server && node --test test/khatma-fields.test.js`
Expected: FAIL — `Cannot find module '../utils/phone'`.

- [ ] **Step 9: Implement phone + fields**

`server/utils/phone.js`:

```js
// Stores phone numbers as international digits only (e.g. 97336123456) for wa.me links.
function normalizePhone(value) {
  if (!value) return null;
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits.length >= 8 ? digits : null;
}

module.exports = { normalizePhone };
```

`server/models/Khatma.js` — add after `use_hijri`:

```js
  organizer_phone: { type: String, default: null },
```

`server/routes/khatma.js`:

1. Imports — replace the rotation import line and add phone:

```js
const { getCycleNumber, getCurrentJuz, getCycleDedication, isPaused, getRotationLabel, getCycleDays, getNextChangeDate } = require('../utils/rotation');
const { normalizePhone } = require('../utils/phone');
```

2. In `POST /admin-login`, inside the returned `khatma` object, add after `khatma_number: khatma.khatma_number,`:

```js
        organizer_phone: khatma.organizer_phone || null,
```

3. In `POST /` (create): add `organizerPhone` to the destructuring:

```js
  const { name, accessCode, adminPassword, startDate, rotationType, customDays, useHijri, khatmaNumber, isQuick, organizerPhone, participants, deceased } = req.body;
```

and in `Khatma.create({...})` add after `khatma_number: khatmaNumber || 1`:

```js
      khatma_number: khatmaNumber || 1,
      organizer_phone: normalizePhone(organizerPhone)
```

4. In `GET /:id/dashboard`, after `const rotationLabel = ...` add:

```js
    const nextChangeDate = (khatma.is_quick || paused)
      ? null
      : getNextChangeDate(khatma.start_date, khatma.rotation_type, khatma.custom_days);
```

in the response's `khatma` object add after `khatma_number: khatma.khatma_number`:

```js
        khatma_number: khatma.khatma_number,
        organizer_phone: khatma.organizer_phone || null
```

and add `nextChangeDate,` after `rotationLabel,` in the top-level response.

5. In `PUT /:id`, add `organizerPhone` to the destructuring and, after the `useHijri` line:

```js
  if (organizerPhone !== undefined) update.organizer_phone = normalizePhone(organizerPhone);
```

- [ ] **Step 10: Create the in-memory dev server (used by Playwright later)**

`server/scripts/dev-memory.js`:

```js
// Runs the API on :3000 against a throwaway in-memory MongoDB. Used by Playwright; never uses a real database.
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  const app = require('../index');
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Test API (in-memory DB) on http://localhost:${port}`));
})();
```

- [ ] **Step 11: Run all server tests**

Run: `cd server && npm test`
Expected: all tests in `rotation.test.js` and `khatma-fields.test.js` pass.

- [ ] **Step 12: Commit**

```bash
git add server/package.json server/package-lock.json server/test server/scripts server/utils/phone.js server/utils/rotation.js server/models/Khatma.js server/routes/khatma.js
git commit -m "Server: organizer phone, next change date, in-memory test harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Participant ownership and idempotent completions

**Files:**
- Create: `server/utils/token.js`, `server/test/ownership.test.js`
- Modify: `server/models/Participant.js`, `server/middleware/auth.js`, `server/routes/participants.js`, `server/routes/completions.js`, `server/routes/khatma.js`

**Interfaces:**
- Consumes: Task 1 test helpers.
- Produces:
  - `POST /api/khatma/:id/participants/:pid/claim` (header `x-khatma-code`) → `200 { participantId, token }`; `404` for unknown participant.
  - `POST /api/khatma/:id/join` → `201 { message, participant: { _id, name, slot_number }, token }`.
  - `POST` / `DELETE /api/khatma/:id/completions` body `{ participantId, cycleNumber }` require header `x-participant-token` (that participant's token) or `x-admin-password`; else `403`. Both always return `200` on success (no 409 on repeat).
  - Tokens never appear in any participant list, dashboard, or admin-login response.

- [ ] **Step 1: Write failing tests**

`server/test/ownership.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');

test.before(start);
test.after(stop);

const enc = encodeURIComponent;

async function setup() {
  const k = await createKhatma();
  const admin = { 'x-admin-password': enc(k.password) };
  const code = { 'x-khatma-code': enc(k.code) };
  const a = (await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'محمد', slotNumber: 1 }, headers: admin })).data.participant;
  const b = (await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'فاطمة', slotNumber: 2 }, headers: admin })).data.participant;
  const dash = await call('GET', `/khatma/${k.id}/dashboard`, { headers: code });
  return { k, admin, code, a, b, cycle: dash.data.cycleNumber };
}

async function claim(s, participantId) {
  const res = await call('POST', `/khatma/${s.k.id}/participants/${participantId}/claim`, { headers: s.code });
  assert.strictEqual(res.status, 200);
  return res.data.token;
}

async function count(s) {
  return (await call('GET', `/khatma/${s.k.id}/completions/${s.cycle}`, { headers: s.code })).data.completedCount;
}

test('claim returns a token, and the same token on a second claim', async () => {
  const s = await setup();
  const t1 = await claim(s, s.a._id);
  const t2 = await claim(s, s.a._id);
  assert.match(t1, /^[0-9a-f]{48}$/);
  assert.strictEqual(t1, t2);
});

test('claim of an unknown participant is 404', async () => {
  const s = await setup();
  const res = await call('POST', `/khatma/${s.k.id}/participants/000000000000000000000000/claim`, { headers: s.code });
  assert.strictEqual(res.status, 404);
});

test('participant can mark and undo their own juz', async () => {
  const s = await setup();
  const token = await claim(s, s.a._id);
  const headers = { ...s.code, 'x-participant-token': token };
  const body = { participantId: s.a._id, cycleNumber: s.cycle };
  assert.strictEqual((await call('POST', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
  assert.strictEqual(await count(s), 1);
  assert.strictEqual((await call('DELETE', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
  assert.strictEqual(await count(s), 0);
});

test('participant cannot mark or undo another participant', async () => {
  const s = await setup();
  const tokenA = await claim(s, s.a._id);
  const headers = { ...s.code, 'x-participant-token': tokenA };
  const body = { participantId: s.b._id, cycleNumber: s.cycle };
  assert.strictEqual((await call('POST', `/khatma/${s.k.id}/completions`, { body, headers })).status, 403);
  assert.strictEqual((await call('DELETE', `/khatma/${s.k.id}/completions`, { body, headers })).status, 403);
  assert.strictEqual(await count(s), 0);
});

test('marking without a token or admin password is rejected', async () => {
  const s = await setup();
  const body = { participantId: s.a._id, cycleNumber: s.cycle };
  assert.strictEqual((await call('POST', `/khatma/${s.k.id}/completions`, { body, headers: s.code })).status, 403);
});

test('organizer can mark and undo anyone', async () => {
  const s = await setup();
  const headers = { ...s.code, ...s.admin };
  const body = { participantId: s.b._id, cycleNumber: s.cycle };
  assert.strictEqual((await call('POST', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
  assert.strictEqual(await count(s), 1);
  assert.strictEqual((await call('DELETE', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
  assert.strictEqual(await count(s), 0);
});

test('marking repeatedly (even concurrently) creates one record and always succeeds', async () => {
  const s = await setup();
  const token = await claim(s, s.a._id);
  const headers = { ...s.code, 'x-participant-token': token };
  const body = { participantId: s.a._id, cycleNumber: s.cycle };
  const results = await Promise.all([1, 2, 3].map(() => call('POST', `/khatma/${s.k.id}/completions`, { body, headers })));
  assert.deepStrictEqual(results.map(r => r.status), [200, 200, 200]);
  assert.strictEqual((await call('POST', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
  assert.strictEqual(await count(s), 1);
});

test('undoing twice succeeds both times', async () => {
  const s = await setup();
  const token = await claim(s, s.a._id);
  const headers = { ...s.code, 'x-participant-token': token };
  const body = { participantId: s.a._id, cycleNumber: s.cycle };
  await call('POST', `/khatma/${s.k.id}/completions`, { body, headers });
  assert.strictEqual((await call('DELETE', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
  assert.strictEqual((await call('DELETE', `/khatma/${s.k.id}/completions`, { body, headers })).status, 200);
});

test('tokens never appear in participant lists, dashboard or admin login', async () => {
  const s = await setup();
  const token = await claim(s, s.a._id);
  const responses = [
    await call('GET', `/khatma/${s.k.id}/participants`, { headers: s.code }),
    await call('GET', `/khatma/${s.k.id}/dashboard`, { headers: s.code }),
    await call('POST', '/khatma/admin-login', { body: { code: s.k.code, adminPassword: s.k.password } }),
    await call('POST', '/khatma/access', { body: { code: s.k.code } })
  ];
  for (const r of responses) {
    assert.ok(!JSON.stringify(r.data).includes(token), 'token leaked');
    assert.ok(!JSON.stringify(r.data).includes('"token"'), 'token field leaked');
  }
});

test('joining a quick khatma returns a token that can mark that juz', async () => {
  const k = await createKhatma({ isQuick: true });
  const code = { 'x-khatma-code': enc(k.code) };
  const join = await call('POST', `/khatma/${k.id}/join`, { body: { name: 'علي', slotNumber: 5 }, headers: code });
  assert.strictEqual(join.status, 201);
  assert.match(join.data.token, /^[0-9a-f]{48}$/);
  assert.strictEqual(join.data.participant.token, undefined);
  const dash = await call('GET', `/khatma/${k.id}/dashboard`, { headers: code });
  const mark = await call('POST', `/khatma/${k.id}/completions`, {
    body: { participantId: join.data.participant._id, cycleNumber: dash.data.cycleNumber },
    headers: { ...code, 'x-participant-token': join.data.token }
  });
  assert.strictEqual(mark.status, 200);
});

test('deleting a khatma also deletes its completions', async () => {
  const s = await setup();
  const Completion = require('../models/Completion');
  await call('POST', `/khatma/${s.k.id}/completions`, { body: { participantId: s.a._id, cycleNumber: s.cycle }, headers: { ...s.code, ...s.admin } });
  assert.strictEqual(await Completion.countDocuments({ khatma_id: s.k.id }), 1);
  await call('DELETE', `/khatma/${s.k.id}`, { headers: s.admin });
  assert.strictEqual(await Completion.countDocuments({ khatma_id: s.k.id }), 0);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd server && node --test test/ownership.test.js`
Expected: FAIL — claim returns 404 (route missing), marks without token return 201, etc.

- [ ] **Step 3: Token utility and model field**

`server/utils/token.js`:

```js
const crypto = require('crypto');

// Random secret that proves "this phone confirmed this participant's name".
function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { newToken };
```

`server/models/Participant.js` — add after `slot_number`:

```js
  slot_number: { type: Number, required: true },
  // Never returned unless explicitly selected with .select('+token')
  token: { type: String, default: null, select: false }
```

- [ ] **Step 4: `canActFor` in the auth middleware**

In `server/middleware/auth.js`, add `const Participant = require('../models/Participant');` under the Khatma import, add this function above `module.exports`, and export it:

```js
// True when the request may change this participant's reading status:
// the organizer (admin password) or the phone that claimed this participant (token).
async function canActFor(req, participantId) {
  const adminPassword = decodeHeader(req.headers['x-admin-password']);
  if (adminPassword && adminPassword === req.khatma.admin_password) return true;

  const token = req.headers['x-participant-token'];
  if (!token) return false;

  const participant = await Participant.findOne({ _id: participantId, khatma_id: req.khatma._id }).select('+token');
  return !!participant && !!participant.token && participant.token === token;
}

module.exports = { authMiddleware, adminMiddleware, canActFor };
```

(Remove the old `module.exports` line.)

- [ ] **Step 5: Claim route**

In `server/routes/participants.js`, add `const mongoose = require('mongoose');` and `const { newToken } = require('../utils/token');` at the top, and add before `module.exports`:

```js
// Claim a name on this phone (any participant with the khatma link). Returns that participant's token.
router.post('/:pid/claim', authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.pid)) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }

  try {
    // Only set a token if none exists, so two phones claiming at once get the same token
    await Participant.updateOne(
      { _id: req.params.pid, khatma_id: req.khatma._id, token: null },
      { token: newToken() }
    );
    const participant = await Participant.findOne({ _id: req.params.pid, khatma_id: req.khatma._id }).select('+token');

    if (!participant) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }
    res.json({ participantId: participant._id, token: participant.token });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});
```

- [ ] **Step 6: Join returns a token; delete removes completions**

In `server/routes/khatma.js`, add `const { newToken } = require('../utils/token');` under the other requires.

Replace the body of the `try` in `POST /:id/join` from `const participant = await Participant.create({` through the `res.status(201)...` line with:

```js
    const token = newToken();
    const participant = await Participant.create({
      khatma_id: khatma._id,
      name,
      slot_number: slotNumber,
      token
    });

    res.status(201).json({
      message: 'تم التسجيل بنجاح',
      participant: { _id: participant._id, name: participant.name, slot_number: participant.slot_number },
      token
    });
```

In `DELETE /:id`, add before `await Khatma.findByIdAndDelete(...)`:

```js
    await Completion.deleteMany({ khatma_id: req.khatma._id });
```

- [ ] **Step 7: Ownership + idempotency in completions**

Replace `server/routes/completions.js` POST and DELETE handlers (keep the GET handler and the top of the file; add `const mongoose = require('mongoose');` and change the auth import):

```js
const mongoose = require('mongoose');
const { authMiddleware, canActFor } = require('../middleware/auth');
```

```js
// Mark juz as completed (own juz with participant token, or anyone as organizer). Safe to repeat.
router.post('/', async (req, res) => {
  const { participantId, cycleNumber } = req.body;

  if (!participantId || !cycleNumber || !mongoose.Types.ObjectId.isValid(participantId)) {
    return res.status(400).json({ error: 'بيانات غير مكتملة' });
  }

  try {
    const participant = await Participant.findOne({ _id: participantId, khatma_id: req.khatma._id });
    if (!participant) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }

    if (!(await canActFor(req, participantId))) {
      return res.status(403).json({ error: 'يمكنك تسجيل قراءتك أنت فقط' });
    }

    try {
      await Completion.updateOne(
        { khatma_id: req.khatma._id, participant_id: participantId, cycle_number: cycleNumber },
        { $setOnInsert: { completed_at: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      // A simultaneous identical request already inserted it — same end state
      if (err.code !== 11000) throw err;
    }

    const totalParticipants = await Participant.countDocuments({ khatma_id: req.khatma._id });
    const completedCount = await Completion.countDocuments({ khatma_id: req.khatma._id, cycle_number: cycleNumber });

    res.json({
      message: 'تم تسجيل الإنجاز',
      completedCount,
      totalParticipants,
      allCompleted: completedCount >= totalParticipants
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Undo completion (same permissions as marking). Safe to repeat.
router.delete('/', async (req, res) => {
  const { participantId, cycleNumber } = req.body;

  if (!participantId || !cycleNumber || !mongoose.Types.ObjectId.isValid(participantId)) {
    return res.status(400).json({ error: 'بيانات غير مكتملة' });
  }

  try {
    if (!(await canActFor(req, participantId))) {
      return res.status(403).json({ error: 'يمكنك تعديل قراءتك أنت فقط' });
    }

    await Completion.deleteOne({
      khatma_id: req.khatma._id,
      participant_id: participantId,
      cycle_number: cycleNumber
    });
    res.json({ message: 'تم إلغاء الإنجاز' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});
```

- [ ] **Step 8: Run all server tests**

Run: `cd server && npm test`
Expected: all pass (rotation, khatma-fields, ownership).

- [ ] **Step 9: Commit**

```bash
git add server
git commit -m "Server: enforce own-juz marking with participant tokens, idempotent completions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client foundation — utils, storage, API client, base styles, Playwright

**Files:**
- Modify: `client/package.json`, `client/src/api/client.js`, `client/src/main.jsx`, `client/src/components/Header.jsx`
- Create: `client/src/utils/arabicNumbers.js`, `client/src/utils/links.js`, `client/src/utils/storage.js`, `client/src/utils/links.test.js`, `client/src/elderly.css`, `client/src/components/ConfirmDialog.jsx`, `client/src/components/BackButton.jsx`, `client/playwright.config.js`, `client/e2e/api.js`, `client/e2e/smoke.spec.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `ar(n: number|string) => string` (Arabic-Indic digits, no grouping).
  - `links.js`: `generateCode() => string(8)`, `generatePassword() => string(24)`, `khatmaPath(code) => '/k/<enc>'`, `shareLink(code, origin?)`, `manageLink(code, password, origin?)`, `readPasswordFromHash(hash) => string|null`, `whatsappUrl(text, phone?)`, `familyMessage(name, code, origin?)`, `manageMessage(name, code, password, origin?)`, `reminderMessage(name, code, people:[{name,juz}], origin?)`, `distributionMessage({ name, code, isQuick, khatmaNumber, dedicatedNames, rows:[{juz,name,done}], completedCount, total }, origin?)`.
  - `storage.js`: `getKhatma(id)`, `saveKhatma(id, patch)`, `removeKhatma(id)`, `forgetParticipant(id)`, `findIdByCode(code)`, `setActive(id)`, `getActive() => { id, code, name?, adminPassword?, participantId?, participantToken? } | null`, `migrateLegacyStorage()`.
  - `api` (client.js): all existing methods plus `claimParticipant(khatmaId, pid) => { participantId, token }`. Errors carry `err.status`.
  - `<ConfirmDialog message confirmLabel onConfirm onCancel danger? />`, `<BackButton to label? />`.
  - CSS classes listed in `elderly.css` below.
  - e2e helpers in `client/e2e/api.js`.

- [ ] **Step 1: Write failing unit tests for the pure utils**

`client/src/utils/links.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert';
import { ar } from './arabicNumbers.js';
import {
  generateCode, generatePassword, khatmaPath, shareLink, manageLink, readPasswordFromHash,
  whatsappUrl, familyMessage, manageMessage, reminderMessage, distributionMessage
} from './links.js';

const ORIGIN = 'https://khatma-quran.vercel.app';

test('ar uses Arabic-Indic digits without grouping', () => {
  assert.strictEqual(ar(12), '١٢');
  assert.strictEqual(ar(1030), '١٠٣٠');
});

test('generated codes are 8 chars from an unambiguous alphabet', () => {
  for (let i = 0; i < 50; i++) assert.match(generateCode(), /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
});

test('generated passwords are 24 chars and differ', () => {
  const a = generatePassword();
  assert.strictEqual(a.length, 24);
  assert.notStrictEqual(a, generatePassword());
});

test('links encode Arabic codes', () => {
  assert.strictEqual(khatmaPath('ختمة'), '/k/%D8%AE%D8%AA%D9%85%D8%A9');
  assert.strictEqual(shareLink('abc', ORIGIN), `${ORIGIN}/k/abc`);
});

test('manage link keeps the password in the fragment and round-trips', () => {
  const link = manageLink('abc', 'p#ss/ word', ORIGIN);
  assert.ok(link.startsWith(`${ORIGIN}/m/abc#`));
  assert.strictEqual(readPasswordFromHash(new URL(link).hash), 'p#ss/ word');
  assert.strictEqual(readPasswordFromHash(''), null);
  assert.strictEqual(readPasswordFromHash('#'), null);
});

test('whatsappUrl targets a phone when given', () => {
  assert.strictEqual(whatsappUrl('مرحبا'), 'https://wa.me/?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7');
  assert.ok(whatsappUrl('x', '97336123456').startsWith('https://wa.me/97336123456?text='));
});

test('messages contain the right links and warnings', () => {
  assert.ok(familyMessage('ختمة العائلة', 'abc', ORIGIN).includes(`${ORIGIN}/k/abc`));
  const m = manageMessage('ختمة العائلة', 'abc', 'secret', ORIGIN);
  assert.ok(m.includes(`${ORIGIN}/m/abc#secret`));
  assert.ok(m.includes('احتفظ بهذه الرسالة، ولا ترسلها لأحد'));
  const r = reminderMessage('ختمة', 'abc', [{ name: 'محمد', juz: 12 }], ORIGIN);
  assert.ok(r.includes('محمد (الجزء ١٢)'));
});

test('distribution message lists rows, done marks and free parts', () => {
  const text = distributionMessage({
    name: 'ختمة', code: 'abc', isQuick: false, khatmaNumber: 3, dedicatedNames: ['أحمد'],
    rows: [{ juz: 1, name: 'محمد', done: true }, { juz: 2, name: 'فاطمة', done: false }],
    completedCount: 1, total: 2
  }, ORIGIN);
  assert.ok(text.includes('الجزء ١ ← محمد ✅'));
  assert.ok(text.includes('الجزء ٢ ← فاطمة'));
  assert.ok(text.includes('أجزاء متاحة'));
  assert.ok(text.includes('الإهداء'));
});
```

- [ ] **Step 2: Add test scripts and run to see failure**

Edit `client/package.json` `scripts`:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test:unit": "node --test src/utils/*.test.js",
    "test:e2e": "playwright test"
  },
```

Run: `cd client && npm run test:unit`
Expected: FAIL — cannot find `./arabicNumbers.js`.

- [ ] **Step 3: Implement `arabicNumbers.js` and `links.js`**

`client/src/utils/arabicNumbers.js`:

```js
// Arabic-Indic digits (١٢) — what older Arabic readers expect.
export function ar(n) {
  return Number(n).toLocaleString('ar-EG', { useGrouping: false });
}
```

`client/src/utils/links.js`:

```js
import { ar } from './arabicNumbers.js';

// No look-alike characters (0/o, 1/l/i) so a code can still be read aloud if needed
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function randomString(chars, length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export const generateCode = () => randomString(CODE_CHARS, 8);
export const generatePassword = () => randomString(PASSWORD_CHARS, 24);

export function khatmaPath(code) {
  return `/k/${encodeURIComponent(code)}`;
}

export function shareLink(code, origin = window.location.origin) {
  return origin + khatmaPath(code);
}

// The password goes in the fragment (#) so browsers never send it to any server
export function manageLink(code, password, origin = window.location.origin) {
  return `${origin}/m/${encodeURIComponent(code)}#${encodeURIComponent(password)}`;
}

export function readPasswordFromHash(hash) {
  if (!hash || hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

export function whatsappUrl(text, phone) {
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function familyMessage(name, code, origin) {
  return `السلام عليكم ورحمة الله 🌷\n\nندعوكم للمشاركة في: *${name}*\n\nاضغط على الرابط لترى جزءك:\n${shareLink(code, origin)}\n\nجزاكم الله خيرًا`;
}

export function manageMessage(name, code, password, origin) {
  return `🔒 رابط إدارة: *${name}*\n\n${manageLink(code, password, origin)}\n\nاحتفظ بهذه الرسالة، ولا ترسلها لأحد`;
}

export function reminderMessage(name, code, people, origin) {
  const lines = people.map(p => `• ${p.name} (الجزء ${ar(p.juz)})`).join('\n');
  return `تذكير 🌷 — *${name}*\n\nلم يُسجَّل بعد إنهاء قراءة:\n${lines}\n\nللتسجيل اضغط هنا:\n${shareLink(code, origin)}\n\nجزاكم الله خيرًا`;
}

export function distributionMessage({ name, code, isQuick, khatmaNumber, dedicatedNames, rows, completedCount, total }, origin) {
  let text = `بسم الله الرحمن الرحيم\n\n📖 *${name}*`;
  if (!isQuick) text += `\nالختمة رقم: *${ar(khatmaNumber)}*`;
  text += '\n';
  if (!isQuick && dedicatedNames?.length > 0) {
    text += `\n🤲 *الإهداء:* ${dedicatedNames.join(' و ')}\n`;
  }
  text += '\n📋 *توزيع الأجزاء:*\n';
  const sorted = [...rows].sort((a, b) => a.juz - b.juz);
  sorted.forEach(r => {
    text += `الجزء ${ar(r.juz)} ← ${r.name}${r.done ? ' ✅' : ''}\n`;
  });
  const taken = new Set(sorted.map(r => r.juz));
  const free = [];
  for (let i = 1; i <= 30; i++) if (!taken.has(i)) free.push(ar(i));
  if (free.length > 0) text += `\n📗 *أجزاء متاحة:* ${free.join('، ')}\n`;
  if (total > 0) {
    text += `\n📊 ${ar(completedCount)} من ${ar(total)} أنهوا القراءة`;
    if (completedCount >= total) text += '\n\n🎉 *تمت الختمة بحمد الله*';
  }
  text += `\n\n${shareLink(code, origin)}\n\nجزاكم الله خيرًا`;
  return text;
}
```

- [ ] **Step 4: Run unit tests**

Run: `cd client && npm run test:unit`
Expected: all pass.

- [ ] **Step 5: Storage module**

`client/src/utils/storage.js`:

```js
// All phone storage lives here. One record per khatma:
// { code, name?, adminPassword?, participantId?, participantToken? }
const KHATMAS_KEY = 'khatmas';
const ACTIVE_KEY = 'activeKhatmaId';

// Private browsing / blocked storage must never crash the page
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function readAll() {
  try { return JSON.parse(safeGet(KHATMAS_KEY)) || {}; } catch { return {}; }
}
function writeAll(all) {
  safeSet(KHATMAS_KEY, JSON.stringify(all));
}

export function getKhatma(id) {
  return readAll()[id] || null;
}

export function saveKhatma(id, patch) {
  const all = readAll();
  all[id] = { ...all[id], ...patch };
  writeAll(all);
}

export function removeKhatma(id) {
  const all = readAll();
  delete all[id];
  writeAll(all);
  if (safeGet(ACTIVE_KEY) === id) safeRemove(ACTIVE_KEY);
}

export function forgetParticipant(id) {
  const all = readAll();
  if (!all[id]) return;
  delete all[id].participantId;
  delete all[id].participantToken;
  writeAll(all);
}

export function findIdByCode(code) {
  const all = readAll();
  return Object.keys(all).find(id => all[id].code === code) || null;
}

export function setActive(id) {
  safeSet(ACTIVE_KEY, id);
}

export function getActive() {
  const id = safeGet(ACTIVE_KEY);
  if (!id) return null;
  const record = getKhatma(id);
  return record ? { id, ...record } : null;
}

// Move the old single-khatma keys into the new format, once.
// The old participantId is dropped on purpose: it has no token, so the person
// is asked "مَن أنت؟" once more and claims their name properly.
export function migrateLegacyStorage() {
  const code = safeGet('khatmaCode');
  const id = safeGet('khatmaId');
  const adminPassword = safeGet('adminPassword');
  if (code && id && !getKhatma(id)) {
    saveKhatma(id, adminPassword ? { code, adminPassword } : { code });
    setActive(id);
  }
  ['khatmaCode', 'khatmaId', 'khatmaName', 'adminPassword', 'participantId',
    'participantName', 'participantSlot', 'darkMode'].forEach(safeRemove);
  document.documentElement.removeAttribute('data-theme');
}
```

- [ ] **Step 6: API client**

Replace the top of `client/src/api/client.js` (everything above `export const api = {`) with:

```js
import { getActive } from '../utils/storage';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const NETWORK_ERROR = 'تعذّر الاتصال. تأكد من الإنترنت ثم حاول مرة أخرى.';

async function request(endpoint, options = {}) {
  const active = getActive();
  const headers = {
    'Content-Type': 'application/json',
    // Header values must be ISO-8859-1, so encode to allow Arabic codes/passwords
    ...(active?.code ? { 'x-khatma-code': encodeURIComponent(active.code) } : {}),
    ...(active?.adminPassword ? { 'x-admin-password': encodeURIComponent(active.adminPassword) } : {}),
    ...(active?.participantToken ? { 'x-participant-token': active.participantToken } : {}),
    ...options.headers
  };

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || 'حدث خطأ غير متوقع');
    err.status = res.status;
    throw err;
  }

  return data;
}
```

and inside the `api` object, after `getParticipants`, add:

```js
  claimParticipant: (khatmaId, pid) => request(`/khatma/${khatmaId}/participants/${pid}/claim`, {
    method: 'POST'
  }),
```

- [ ] **Step 7: Shared components, header, styles, migration**

`client/src/components/ConfirmDialog.jsx`:

```jsx
function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, danger = false }) {
  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-box">
        <p className="confirm-message">{message}</p>
        <button className={`btn btn-big ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn btn-big btn-secondary" onClick={onCancel}>
          لا
        </button>
      </div>
    </div>
  );
}

export default ConfirmDialog;
```

`client/src/components/BackButton.jsx`:

```jsx
import { Link } from 'react-router-dom';

function BackButton({ to, label = 'رجوع' }) {
  return (
    <Link to={to} className="btn btn-big btn-secondary back-button">
      {label}
    </Link>
  );
}

export default BackButton;
```

`client/src/components/Header.jsx` (replace whole file):

```jsx
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="header">
      <Link to="/">
        <h1>ختمة القرآن الكريم</h1>
      </Link>
    </header>
  );
}

export default Header;
```

`client/src/main.jsx` (replace whole file):

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { migrateLegacyStorage } from './utils/storage';
import './index.css';
import './elderly.css';

migrateLegacyStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

`client/src/elderly.css`:

```css
/* Elderly-friendly layer (loaded after index.css). 1rem = 20px. */
:root {
  --text-light: #4a4a4a;
}

html {
  font-size: 125%;
}

body {
  line-height: 1.7;
}

.container {
  max-width: 640px;
  padding: 16px;
}

.header {
  padding: 14px 16px;
}

.header a {
  color: #fff;
  text-decoration: none;
}

.header h1 {
  font-size: 1.4rem;
  margin: 0;
}

.btn {
  min-height: 2.8rem;
  font-size: 1rem;
  border-radius: 12px;
}

.btn-primary:hover,
.btn-secondary:hover {
  transform: none;
}

.btn-big {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 3rem;
  padding: 12px 20px;
  margin: 0 0 14px;
  font-size: 1.1rem;
  font-weight: 700;
  border-radius: 14px;
  text-decoration: none;
}

.btn-big:disabled {
  opacity: 0.6;
  cursor: wait;
}

.btn-danger.btn-big {
  padding: 12px 20px;
  font-size: 1.1rem;
}

.btn-finish {
  background: #1b5e20;
  color: #fff;
  border: 3px solid #0d3311;
}

.btn-whatsapp {
  background: #128c4a;
  color: #fff;
}

.link-button {
  display: block;
  width: 100%;
  min-height: 2.8rem;
  padding: 12px 8px;
  margin: 4px 0;
  background: none;
  border: none;
  font-family: inherit;
  font-size: 1rem;
  color: var(--primary);
  text-decoration: underline;
  text-align: center;
  cursor: pointer;
}

.center-text {
  text-align: center;
}

.big-text {
  font-size: 1.15rem;
  margin-bottom: 14px;
}

.hint {
  font-size: 0.95rem;
  color: var(--text-light);
  text-align: center;
  margin: 4px 0 18px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary);
  text-align: center;
  margin: 8px 0 14px;
}

.big-question {
  font-size: 1.4rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 18px;
}

.big-label {
  display: block;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.big-input {
  width: 100%;
  min-height: 3rem;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-family: inherit;
  font-size: 1.15rem;
  color: var(--text);
  background: #fff;
  border: 3px solid var(--border);
  border-radius: 12px;
  direction: rtl;
}

.big-input:focus {
  outline: none;
  border-color: var(--primary);
}

textarea.big-input {
  min-height: 8rem;
}

.error-msg,
.success-msg {
  font-size: 1rem;
}

.khatma-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--primary);
  text-align: center;
  margin: 4px 0 14px;
}

/* Participant main screen */
.greeting {
  font-size: 1.15rem;
  text-align: center;
  margin-bottom: 10px;
}

.juz-hero {
  background: var(--card-bg);
  border: 4px solid var(--primary);
  border-radius: 20px;
  padding: 18px 12px;
  margin-bottom: 16px;
  text-align: center;
  box-shadow: var(--shadow);
}

.juz-hero-label {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-light);
}

.juz-hero-number {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.3;
  color: var(--primary);
}

.juz-hero-next {
  font-size: 0.95rem;
  color: var(--text-light);
  margin-top: 6px;
}

.done-box {
  background: #e8f5e9;
  border: 3px solid #2e7d32;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
  font-size: 1.1rem;
  color: #1b5e20;
}

.done-title {
  font-size: 1.35rem;
  font-weight: 800;
  margin-bottom: 6px;
}

.big-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.big-row-button {
  width: 100%;
  min-height: 3rem;
  padding: 12px 16px;
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
  background: var(--card-bg);
  border: 3px solid var(--primary);
  border-radius: 14px;
  cursor: pointer;
}

.big-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 3rem;
  padding: 12px 14px;
  background: var(--card-bg);
  border: 2px solid var(--border);
  border-radius: 14px;
}

.big-row.taken {
  background: #f3f3f3;
}

.big-row-main {
  font-size: 1.1rem;
  font-weight: 700;
}

.row-action {
  flex: 1 1 100%;
  min-height: 2.8rem;
  font-size: 1rem;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.row-actions .btn {
  flex: 1 1 40%;
  min-height: 2.8rem;
  padding: 8px 10px;
  font-size: 0.95rem;
}

.status {
  font-size: 1rem;
  font-weight: 700;
}

.dedication-line {
  background: var(--gold-light);
  color: #3e2f00;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 16px;
  font-size: 1.05rem;
  text-align: center;
}

.progress-card {
  margin-bottom: 16px;
}

.progress-bar {
  height: 16px;
}

.progress-sentence {
  font-size: 1.1rem;
  font-weight: 700;
  text-align: center;
  margin-top: 8px;
}

.status-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
}

.status-list li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  padding: 12px 6px;
  border-bottom: 1px solid var(--border);
  font-size: 1rem;
}

.page-footer {
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.paused-banner {
  font-size: 1.15rem;
}

/* Confirmation dialog */
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
}

.confirm-box {
  width: 100%;
  max-width: 420px;
  padding: 22px 18px 8px;
  background: var(--card-bg);
  border-radius: 18px;
}

.confirm-message {
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 18px;
}

/* Create flow */
.choice-card {
  display: block;
  width: 100%;
  padding: 18px;
  margin-bottom: 14px;
  font-family: inherit;
  color: var(--text);
  text-align: center;
  background: var(--card-bg);
  border: 3px solid var(--primary);
  border-radius: 16px;
  cursor: pointer;
}

.choice-card-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--primary);
}

.choice-card-desc {
  font-size: 0.95rem;
  color: var(--text-light);
  margin-top: 6px;
}

.radio-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 2.8rem;
  padding: 8px 14px;
  margin-bottom: 10px;
  font-size: 1.1rem;
  background: var(--card-bg);
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
}

.radio-row.selected {
  border: 3px solid var(--primary);
}

.radio-row input {
  width: 1.3rem;
  height: 1.3rem;
}

.success-title {
  font-size: 1.4rem;
  color: var(--primary);
  margin-bottom: 14px;
}

/* Organizer menu */
.tile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 6rem;
  padding: 14px 8px;
  color: var(--primary);
  font-size: 1.05rem;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
  background: var(--card-bg);
  border: 3px solid var(--primary);
  border-radius: 16px;
}

.tile-icon {
  font-size: 1.8rem;
}

/* Home */
.bismillah {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
  margin: 10px 0 14px;
}

.home-intro {
  font-size: 1.1rem;
  text-align: center;
  margin-bottom: 18px;
}

@media (max-width: 360px) {
  .tile-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 8: Playwright setup**

Run:

```bash
cd client && npm install --save-dev @playwright/test@^1 && npx playwright install chromium
```

Append to the root `.gitignore`:

```
client/test-results/
client/playwright-report/
client/e2e/screenshots/
```

`client/playwright.config.js`:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  use: {
    ...devices['iPhone 13'], // 390×844, touch
    browserName: 'chromium',
    baseURL: 'http://localhost:5173',
    locale: 'ar'
  },
  // Always start fresh servers. Never reuse one: it could be connected to the real database.
  webServer: [
    {
      command: 'npm run dev:memory',
      cwd: '../server',
      url: 'http://localhost:3000/api',
      reuseExistingServer: false,
      timeout: 180000
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60000
    }
  ]
});
```

`client/e2e/api.js`:

```js
// Direct API helpers for setting up e2e scenarios (talks to the in-memory API on :3000).
const API = 'http://localhost:3000/api';
const enc = encodeURIComponent;

export async function createKhatma(request, { quick = false, phone, code, name = 'ختمة العائلة' } = {}) {
  const accessCode = code || 'e2e' + Math.random().toString(36).slice(2, 9);
  const password = 'pw-' + Math.random().toString(36).slice(2);
  const res = await request.post(`${API}/khatma`, {
    data: {
      name, accessCode, adminPassword: password,
      startDate: new Date().toISOString().slice(0, 10),
      rotationType: 'weekly', isQuick: quick, organizerPhone: phone
    }
  });
  const { id } = await res.json();
  return { id, code: accessCode, password, name };
}

export async function addParticipant(request, k, name, slotNumber) {
  const res = await request.post(`${API}/khatma/${k.id}/participants`, {
    headers: { 'x-admin-password': enc(k.password) },
    data: { name, slotNumber }
  });
  return (await res.json()).participant;
}

export async function addDeceased(request, k, name, deathDate) {
  await request.post(`${API}/khatma/${k.id}/deceased`, {
    headers: { 'x-admin-password': enc(k.password) },
    data: { name, deathDate }
  });
}

export async function joinQuick(request, k, name, slotNumber) {
  return request.post(`${API}/khatma/${k.id}/join`, {
    headers: { 'x-khatma-code': enc(k.code) },
    data: { name, slotNumber }
  });
}

export async function dashboard(request, k) {
  const res = await request.get(`${API}/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': enc(k.code) } });
  return res.json();
}

export async function completedCount(request, k) {
  const dash = await dashboard(request, k);
  const res = await request.get(`${API}/khatma/${k.id}/completions/${dash.cycleNumber}`, {
    headers: { 'x-khatma-code': enc(k.code) }
  });
  return (await res.json()).completedCount;
}
```

`client/e2e/smoke.spec.js`:

```js
import { test, expect } from '@playwright/test';

test('base text is at least 20px and there is no dark-mode toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ختمة القرآن الكريم' })).toBeVisible();
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(size).toBeGreaterThanOrEqual(20);
  await expect(page.getByText('الوضع الليلي')).toHaveCount(0);
});

test('old dark-mode preference is cleared', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('darkMode', 'true');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('darkMode'))).toBeNull();
});
```

- [ ] **Step 9: Run e2e smoke and build**

Run: `cd client && npm run test:e2e -- smoke.spec.js`
Expected: 2 passed.
Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add .gitignore client
git commit -m "Client foundation: per-khatma storage, link utils, large base styles, Playwright

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Participant experience (`/k/:code`)

**Files:**
- Create: `client/src/pages/KhatmaPage.jsx`, `client/src/components/WhoAreYou.jsx`, `client/src/components/MyJuzCard.jsx`, `client/src/components/QuickJuzPicker.jsx`, `client/src/components/ParticipantsList.jsx`, `client/src/components/DedicationLine.jsx`, `client/e2e/participant.spec.js`, `client/e2e/quick.spec.js`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: Task 2 endpoints; Task 3 `api`, `storage`, `links`, `ar`, `ConfirmDialog`, CSS classes.
- Produces: route `/k/:code`; KhatmaPage stores `{ code, name }` for the khatma and sets it active; shows a "⚙️ إدارة الختمة" link to `/k/<code>/manage` when the phone has the admin password (that route is built in Task 5).

- [ ] **Step 1: Write the failing e2e tests**

`client/e2e/participant.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, addDeceased, completedCount } from './api.js';

async function claimAs(page, k, name) {
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByText(`هل أنت ${name}؟`)).toBeVisible();
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await expect(page.getByText(`السلام عليكم يا ${name.split(' ')[0]}`)).toBeVisible();
}

test('participant opens link, picks name, finishes, undoes, is remembered', async ({ page, request }) => {
  const k = await createKhatma(request, { phone: '97336123456' });
  await addParticipant(request, k, 'محمد أحمد', 1);
  await addParticipant(request, k, 'فاطمة علي', 2);
  await addDeceased(request, k, 'أحمد محمد', '2020-01-15');

  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByText('جزؤك الحالي')).toBeVisible();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ١');
  await expect(page.getByText(/يتغير الجزء يوم/)).toBeVisible();
  await expect(page.getByText(/إهداءً إلى روح أحمد محمد/)).toBeVisible();
  await expect(page.getByRole('link', { name: /ابدأ قراءة الجزء/ })).toHaveAttribute('href', 'https://quran.com/ar/juz/1');
  await expect(page.getByRole('link', { name: /تحتاج مساعدة/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/97336123456\?text=/);
  await page.screenshot({ path: 'e2e/screenshots/participant-main.png', fullPage: true });

  await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  await expect(page.getByText('١ من ٢ شخصًا أنهوا القراءة')).toBeVisible();
  expect(await completedCount(request, k)).toBe(1);
  await page.screenshot({ path: 'e2e/screenshots/participant-done.png', fullPage: true });

  // Undo asks first; "لا" changes nothing
  await page.getByRole('button', { name: 'تراجع' }).click();
  await expect(page.getByText('هل تريد التراجع عن تسجيل القراءة؟')).toBeVisible();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  expect(await completedCount(request, k)).toBe(1);
  await page.getByRole('button', { name: 'تراجع' }).click();
  await page.getByRole('button', { name: 'نعم، تراجع' }).click();
  await expect(page.getByRole('button', { name: /أنهيت قراءة الجزء/ })).toBeVisible();
  expect(await completedCount(request, k)).toBe(0);

  // Remembered after reload
  await page.reload();
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();

  // Change name
  await page.getByRole('button', { name: /لست محمد؟ غيّر الاسم/ }).click();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
});

test('"لا" on "هل أنت…؟" goes back to the name list', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${k.code}`);
  await page.getByRole('button', { name: 'محمد أحمد' }).click();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
});

test('rapid triple tap on "أنهيت" sends one request and records one completion', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');

  let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/completions')) posts++; });
  await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click({ clickCount: 3 });
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toHaveCount(1);
  expect(posts).toBe(1);
  expect(await completedCount(request, k)).toBe(1);
});

test('participant list is collapsed and view-only', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await addParticipant(request, k, 'فاطمة علي', 2);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.locator('.status-list')).toHaveCount(0);
  await page.getByRole('button', { name: /عرض المشاركين/ }).click();
  await expect(page.getByText('الجزء ٢ — فاطمة علي')).toBeVisible();
  await expect(page.getByText('⏳ لم ينته بعد').first()).toBeVisible();
  await expect(page.locator('.status-list button')).toHaveCount(0);
});

test('sizes: juz number is the biggest text and main buttons are ≥ 56px tall', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');
  const juzSize = await page.locator('.juz-hero-number').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(juzSize).toBeGreaterThanOrEqual(56);
  const greetingSize = await page.locator('.greeting').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(juzSize).toBeGreaterThan(greetingSize);
  for (const box of await page.locator('.btn-big').all()) {
    expect((await box.boundingBox()).height).toBeGreaterThanOrEqual(56);
  }
});

test('help link is hidden when the organizer saved no phone', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByText(/تحتاج مساعدة/)).toHaveCount(0);
});

test('unknown link shows a friendly message', async ({ page }) => {
  await page.goto('/k/does-not-exist');
  await expect(page.getByText('لم نجد هذه الختمة.')).toBeVisible();
  await expect(page.getByText('تأكد من الرابط، أو اسأل منظم الختمة.')).toBeVisible();
  await expect(page.getByText(/رمز/)).toHaveCount(0);
});
```

`client/e2e/quick.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { createKhatma, joinQuick } from './api.js';

test('quick khatma: pick a free juz, type name, land on my juz', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await joinQuick(request, k, 'خالد', 2);
  await page.goto(`/k/${k.code}`);
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
  await expect(page.getByText('الجزء ٢ — خالد')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/quick-list.png', fullPage: true });

  await page.locator('.big-row', { hasText: 'الجزء ١ — متاح' }).getByRole('button', { name: 'اختر هذا الجزء' }).click();
  await page.getByLabel('اكتب اسمك').fill('محمد');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ١');
  await expect(page.getByText(/يتغير الجزء يوم/)).toHaveCount(0);
});

test('quick khatma: juz taken meanwhile shows a clear message', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await page.goto(`/k/${k.code}`);
  await page.locator('.big-row', { hasText: 'الجزء ٣ — متاح' }).getByRole('button', { name: 'اختر هذا الجزء' }).click();
  await joinQuick(request, k, 'سارة', 3);
  await page.getByLabel('اكتب اسمك').fill('محمد');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('هذا الجزء أخذه شخص آخر، اختر جزءًا آخر')).toBeVisible();
  await expect(page.getByText('الجزء ٣ — سارة')).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd client && npm run test:e2e -- participant.spec.js quick.spec.js`
Expected: FAIL — `/k/...` renders NotFound.

- [ ] **Step 3: Components**

`client/src/components/DedicationLine.jsx`:

```jsx
// One short sentence. Gender-neutral closing because we don't store gender.
function DedicationLine({ dedication }) {
  const names = dedication?.dedicated?.map(d => d.name) || [];
  if (names.length === 0) return null;
  return (
    <p className="dedication-line">
      🤲 هذه الختمة إهداءً إلى روح {names.join(' و ')}، رحمة الله على موتانا جميعًا.
    </p>
  );
}

export default DedicationLine;
```

`client/src/components/ParticipantsList.jsx`:

```jsx
import { useState } from 'react';
import { ar } from '../utils/arabicNumbers';

// View-only: no buttons inside the list, so nobody can change someone else's status by mistake
function ParticipantsList({ participants, juzOf, isDone }) {
  const [open, setOpen] = useState(false);
  const rows = [...participants].sort((a, b) => juzOf(a) - juzOf(b));

  return (
    <section>
      <button className="btn btn-big btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'إخفاء المشاركين ▲' : 'عرض المشاركين ▼'}
      </button>
      {open && (
        <ul className="status-list">
          {rows.map(p => (
            <li key={p._id}>
              <span>الجزء {ar(juzOf(p))} — {p.name}</span>
              <span className="status">{isDone(p._id) ? '✅ أنهى' : '⏳ لم ينته بعد'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ParticipantsList;
```

`client/src/components/WhoAreYou.jsx`:

```jsx
import { useState, useRef } from 'react';
import { api } from '../api/client';

function WhoAreYou({ khatmaId, participants, onClaimed }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.claimParticipant(khatmaId, selected._id);
      onClaimed(selected._id, res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (participants.length === 0) {
    return (
      <div className="card center-text big-text">
        لم يُضِف منظم الختمة الأسماء بعد. حاول لاحقًا إن شاء الله.
      </div>
    );
  }

  if (selected) {
    return (
      <section className="card">
        <p className="big-question">هل أنت {selected.name}؟</p>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-big btn-primary" onClick={confirm} disabled={busy}>
          {busy ? 'جاري التحميل…' : 'نعم'}
        </button>
        <button className="btn btn-big btn-secondary" onClick={() => setSelected(null)} disabled={busy}>
          لا
        </button>
      </section>
    );
  }

  return (
    <section>
      <h3 className="section-title">مَن أنت؟ اضغط على اسمك</h3>
      <div className="big-list">
        {participants.map(p => (
          <button key={p._id} className="big-row-button" onClick={() => setSelected(p)}>
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export default WhoAreYou;
```

`client/src/components/MyJuzCard.jsx`:

```jsx
import { useState, useRef } from 'react';
import { api } from '../api/client';
import { ar } from '../utils/arabicNumbers';
import { formatDate } from '../utils/hijriDate';
import ConfirmDialog from './ConfirmDialog';

function formatChangeDay(dateStr, useHijri) {
  const date = new Date(`${dateStr}T00:00:00`);
  const weekday = date.toLocaleDateString('ar-EG', { weekday: 'long' });
  return `${weekday} ${formatDate(date, useHijri)}`;
}

function MyJuzCard({ khatmaId, participant, juz, cycleNumber, done, nextChangeDate, useHijri, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [error, setError] = useState('');
  // A ref, not state: a second tap in the same tick must see "busy" immediately
  const busyRef = useRef(false);
  const firstName = participant.name.trim().split(/\s+/)[0];

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const body = { participantId: participant._id, cycleNumber };
  const finish = () => run(() => api.markComplete(khatmaId, body));
  const undo = () => {
    setConfirmUndo(false);
    run(() => api.undoComplete(khatmaId, body));
  };

  return (
    <section>
      <p className="greeting">السلام عليكم يا {firstName} 🌷</p>

      <div className="juz-hero">
        <div className="juz-hero-label">جزؤك الحالي</div>
        <div className="juz-hero-number">الجزء {ar(juz)}</div>
        {nextChangeDate && (
          <div className="juz-hero-next">يتغير الجزء يوم {formatChangeDay(nextChangeDate, useHijri)}</div>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {done ? (
        <div className="done-box" role="status">
          <div className="done-title">✅ جزاك الله خيرًا 🌷</div>
          <div>تم تسجيل أنك أنهيت الجزء {ar(juz)}.</div>
          <button className="link-button" onClick={() => setConfirmUndo(true)} disabled={busy}>
            تراجع
          </button>
        </div>
      ) : (
        <>
          <a
            className="btn btn-big btn-primary"
            href={`https://quran.com/ar/juz/${juz}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            📖 ابدأ قراءة الجزء
          </a>
          <button className="btn btn-big btn-finish" onClick={finish} disabled={busy}>
            {busy ? 'جاري التسجيل…' : '✅ أنهيت قراءة الجزء'}
          </button>
        </>
      )}

      {confirmUndo && (
        <ConfirmDialog
          message="هل تريد التراجع عن تسجيل القراءة؟"
          confirmLabel="نعم، تراجع"
          onConfirm={undo}
          onCancel={() => setConfirmUndo(false)}
        />
      )}
    </section>
  );
}

export default MyJuzCard;
```

`client/src/components/QuickJuzPicker.jsx`:

```jsx
import { useState, useRef } from 'react';
import { api } from '../api/client';
import { ar } from '../utils/arabicNumbers';

function QuickJuzPicker({ khatmaId, participants, isDone, onJoined, onRefresh }) {
  const [juz, setJuz] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const byJuz = new Map(participants.map(p => [p.slot_number, p]));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('الرجاء كتابة اسمك');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.joinQuickKhatma(khatmaId, { name: name.trim(), slotNumber: juz });
      await onJoined(res.participant._id, res.token);
    } catch (err) {
      if (err.status === 409) {
        setError('هذا الجزء أخذه شخص آخر، اختر جزءًا آخر');
        setJuz(null);
        await onRefresh();
      } else {
        setError(err.message);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (juz) {
    return (
      <form className="card" onSubmit={submit}>
        <p className="big-question">الجزء {ar(juz)}</p>
        <label className="big-label" htmlFor="quick-name">اكتب اسمك</label>
        <input
          id="quick-name"
          className="big-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>
          {busy ? 'جاري التسجيل…' : 'تأكيد'}
        </button>
        <button type="button" className="btn btn-big btn-secondary" onClick={() => { setJuz(null); setError(''); }}>
          رجوع
        </button>
      </form>
    );
  }

  return (
    <section>
      <h3 className="section-title">اختر الجزء الذي ستقرؤه</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="big-list">
        {Array.from({ length: 30 }, (_, i) => i + 1).map(n => {
          const p = byJuz.get(n);
          return p ? (
            <div key={n} className="big-row taken">
              <span className="big-row-main">الجزء {ar(n)} — {p.name}</span>
              <span className="status">{isDone(p._id) ? '✅ أنهى' : '⏳ لم ينته بعد'}</span>
            </div>
          ) : (
            <div key={n} className="big-row">
              <span className="big-row-main">الجزء {ar(n)} — متاح</span>
              <button
                className="btn btn-primary row-action"
                onClick={() => { setJuz(n); setName(''); setError(''); }}
              >
                اختر هذا الجزء
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default QuickJuzPicker;
```

- [ ] **Step 4: The page**

`client/src/pages/KhatmaPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { saveKhatma, setActive, getKhatma, forgetParticipant } from '../utils/storage';
import { khatmaPath, whatsappUrl } from '../utils/links';
import { ar } from '../utils/arabicNumbers';
import { formatDate } from '../utils/hijriDate';
import WhoAreYou from '../components/WhoAreYou';
import QuickJuzPicker from '../components/QuickJuzPicker';
import MyJuzCard from '../components/MyJuzCard';
import ParticipantsList from '../components/ParticipantsList';
import DedicationLine from '../components/DedicationLine';
import DuaKhatm from '../components/DuaKhatm';

function KhatmaPage() {
  const { code } = useParams();
  const [khatmaId, setKhatmaId] = useState(null);
  const [data, setData] = useState(null);
  const [completions, setCompletions] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id) => {
    const dash = await api.getDashboard(id);
    const comp = await api.getCompletions(id, dash.cycleNumber);
    setData(dash);
    setCompletions(comp);
    return dash;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const access = await api.access(code);
        const id = access.khatma._id;
        saveKhatma(id, { code, name: access.khatma.name });
        setActive(id);
        const dash = await load(id);
        if (cancelled) return;
        setKhatmaId(id);
        const saved = getKhatma(id);
        const stillListed = dash.participants.some(p => p._id === saved?.participantId);
        if (saved?.participantToken && stillListed) {
          setMe(saved.participantId);
        } else {
          forgetParticipant(id);
          setMe(null);
        }
      } catch (err) {
        // A wrong link returns 404 "رمز الختمة غير صحيح" — don't show technical words to participants
        if (!cancelled) setError(err.status === 404 ? 'لم نجد هذه الختمة.' : err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, load]);

  const handleClaimed = (participantId, token) => {
    saveKhatma(khatmaId, { participantId, participantToken: token });
    setMe(participantId);
  };

  const handleJoined = async (participantId, token) => {
    saveKhatma(khatmaId, { participantId, participantToken: token });
    await load(khatmaId);
    setMe(participantId);
  };

  const handleChangeName = () => {
    forgetParticipant(khatmaId);
    setMe(null);
  };

  const refreshCompletions = async () => {
    setCompletions(await api.getCompletions(khatmaId, data.cycleNumber));
  };

  if (loading) return <div className="loading">جاري التحميل...</div>;

  if (error) {
    return (
      <div className="card center-text">
        <p className="big-text">{error}</p>
        <p className="big-text">تأكد من الرابط، أو اسأل منظم الختمة.</p>
        <Link to="/" className="btn btn-big btn-secondary">الصفحة الرئيسية</Link>
      </div>
    );
  }

  const { khatma } = data;
  const isQuick = khatma.is_quick;
  const isOrganizer = !!getKhatma(khatmaId)?.adminPassword;
  const myself = data.participants.find(p => p._id === me);
  const isDone = (pid) => !!completions?.completedIds?.includes(pid);
  const juzOf = (p) => (isQuick ? p.slot_number : p.currentJuz);
  const allDone = completions?.allCompleted && completions.totalParticipants > 0;

  return (
    <div>
      <h2 className="khatma-title">{khatma.name}</h2>

      {isOrganizer && (
        <Link to={`${khatmaPath(code)}/manage`} className="btn btn-big btn-secondary">
          ⚙️ إدارة الختمة
        </Link>
      )}

      {allDone && (
        <>
          <div className="khatma-complete-banner">
            🎉 تمت الختمة بحمد الله
            <div className="complete-sub">أنهى جميع المشاركين قراءتهم</div>
          </div>
          <DuaKhatm />
        </>
      )}

      {data.paused ? (
        <div className="paused-banner">
          ⏸️ الختمة متوقفة مؤقتًا حتى {formatDate(khatma.paused_to, khatma.use_hijri)}
        </div>
      ) : myself ? (
        <MyJuzCard
          khatmaId={khatmaId}
          participant={myself}
          juz={juzOf(myself)}
          cycleNumber={data.cycleNumber}
          done={isDone(myself._id)}
          nextChangeDate={data.nextChangeDate}
          useHijri={khatma.use_hijri}
          onChanged={refreshCompletions}
        />
      ) : isQuick ? (
        <QuickJuzPicker
          khatmaId={khatmaId}
          participants={data.participants}
          isDone={isDone}
          onJoined={handleJoined}
          onRefresh={() => load(khatmaId)}
        />
      ) : (
        <WhoAreYou khatmaId={khatmaId} participants={data.participants} onClaimed={handleClaimed} />
      )}

      {!isQuick && <DedicationLine dedication={data.dedication} />}

      {myself && completions && completions.totalParticipants > 0 && (
        <div className="progress-card">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(completions.completedCount / completions.totalParticipants) * 100}%` }}
            />
          </div>
          <p className="progress-sentence">
            {ar(completions.completedCount)} من {ar(completions.totalParticipants)} شخصًا أنهوا القراءة
          </p>
        </div>
      )}

      {myself && <ParticipantsList participants={data.participants} juzOf={juzOf} isDone={isDone} />}

      <div className="page-footer">
        {myself && (
          <button className="link-button" onClick={handleChangeName}>
            لست {myself.name.trim().split(/\s+/)[0]}؟ غيّر الاسم
          </button>
        )}
        {khatma.organizer_phone && (
          <a
            className="link-button"
            href={whatsappUrl(`السلام عليكم، أحتاج مساعدة في: ${khatma.name}`, khatma.organizer_phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 تحتاج مساعدة؟ تواصل مع منظم الختمة
          </a>
        )}
      </div>
    </div>
  );
}

export default KhatmaPage;
```

- [ ] **Step 5: Route**

In `client/src/App.jsx`, add `import KhatmaPage from './pages/KhatmaPage';` and add the route above the `*` route:

```jsx
          <Route path="/k/:code" element={<KhatmaPage />} />
```

- [ ] **Step 6: Run e2e and build**

Run: `cd client && npm run test:e2e -- participant.spec.js quick.spec.js smoke.spec.js`
Expected: all pass.
Run: `cd client && npm run build` — succeeds.
Open the screenshots in `client/e2e/screenshots/` and check: juz number is the dominant element, nothing overflows horizontally, RTL is correct.

- [ ] **Step 7: Commit**

```bash
git add client
git commit -m "Participant page: open by link, pick name once, big juz card, finish/undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Organizer entry, menu, names and deceased

**Files:**
- Create: `client/src/pages/ManageEntry.jsx`, `client/src/pages/LegacyLogin.jsx`, `client/src/pages/manage/ManageLayout.jsx`, `client/src/pages/manage/ManageMenu.jsx`, `client/src/pages/manage/NamesScreen.jsx`, `client/src/pages/manage/DeceasedScreen.jsx`, `client/e2e/manage.spec.js`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: Task 3 storage/api/links/ConfirmDialog/BackButton.
- Produces: routes `/m/:code`, `/manage-login`, `/k/:code/manage` (layout) with children `''` (menu), `names`, `deceased`. Outlet context: `{ khatma, participants, deceased, code, khatmaId, password, reload }` where `reload: () => Promise<void>` re-fetches admin data. Later screens (Task 6) are added as more children.

- [ ] **Step 1: Write the failing e2e tests**

`client/e2e/manage.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, dashboard } from './api.js';

function manageUrl(k) {
  return `/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`;
}

test('manage link opens the menu and removes the password from the address bar', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
  expect(page.url()).not.toContain(k.password);
  expect(page.url()).not.toContain('#');
  await page.screenshot({ path: 'e2e/screenshots/manage-menu.png', fullPage: true });
});

test('wrong manage link shows a clear message', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(`/m/${k.code}#wrong`);
  await expect(page.getByText('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.')).toBeVisible();
});

test('organizer adds names in bulk, edits, reorders and deletes with confirmation', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الأسماء/ }).click();

  await page.getByRole('button', { name: 'إضافة عدة أسماء مرة واحدة' }).click();
  await page.getByLabel('اكتب كل اسم في سطر').fill('محمد أحمد\nفاطمة علي\nخالد حسن');
  await page.getByRole('button', { name: 'إضافة الأسماء' }).click();
  await expect(page.getByText('تمت إضافة ٣ أسماء')).toBeVisible();
  await expect(page.getByText('١. محمد أحمد')).toBeVisible();

  // Edit
  await page.locator('.big-row', { hasText: 'خالد حسن' }).getByRole('button', { name: 'تعديل' }).click();
  await page.getByLabel('الاسم الجديد').fill('خالد حسين');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('٣. خالد حسين')).toBeVisible();

  // Reorder
  await page.locator('.big-row', { hasText: 'فاطمة علي' }).getByRole('button', { name: '▲ تقديم' }).click();
  await expect(page.getByText('١. فاطمة علي')).toBeVisible();

  // Delete: "لا" keeps, "نعم، احذف" deletes
  const row = page.locator('.big-row', { hasText: 'محمد أحمد' });
  await row.getByRole('button', { name: 'حذف' }).click();
  await expect(page.getByText('هل أنت متأكد أنك تريد حذف محمد أحمد؟')).toBeVisible();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.locator('.big-row', { hasText: 'محمد أحمد' })).toHaveCount(0);

  const dash = await dashboard(request, k);
  expect(dash.participants.map(p => p.name).sort()).toEqual(['خالد حسين', 'فاطمة علي'].sort());

  await page.getByRole('link', { name: 'رجوع' }).click();
  await expect(page.getByRole('link', { name: /الإهداء للمتوفين/ })).toBeVisible();
});

test('organizer adds one name', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الأسماء/ }).click();
  await page.getByLabel('اسم جديد').fill('سارة');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('٢. سارة')).toBeVisible();
});

test('organizer adds and deletes a deceased person', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإهداء للمتوفين/ }).click();
  await page.getByLabel('اسم المتوفى').fill('أحمد محمد');
  await page.getByLabel('تاريخ الوفاة').fill('2020-01-15');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.locator('.big-row', { hasText: 'أحمد محمد' })).toBeVisible();
  await page.locator('.big-row', { hasText: 'أحمد محمد' }).getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.locator('.big-row', { hasText: 'أحمد محمد' })).toHaveCount(0);
});

test('legacy login with code and password reaches the menu', async ({ page, request }) => {
  const k = await createKhatma(request, { code: 'ختمة' + Math.floor(Math.random() * 1e6) });
  await page.goto('/manage-login');
  await page.getByLabel('رمز الختمة').fill(k.code);
  await page.getByLabel('كلمة مرور المسؤول').fill(k.password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
});

test('participant page shows "إدارة الختمة" only on the organizer phone', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${k.code}`);
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toHaveCount(0);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: 'عرض الختمة كما يراها المشاركون' }).click();
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd client && npm run test:e2e -- manage.spec.js`
Expected: FAIL (routes missing).

- [ ] **Step 3: Entry pages**

`client/src/pages/ManageEntry.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { saveKhatma, setActive } from '../utils/storage';
import { khatmaPath, readPasswordFromHash } from '../utils/links';

// Opened from the private manage link: /m/<code>#<password>
function ManageEntry() {
  const { code } = useParams();
  const navigate = useNavigate();
  // Read once, before the effect wipes the fragment from the address bar
  const [password] = useState(() => readPasswordFromHash(window.location.hash));
  const [error, setError] = useState('');

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (!password) {
      setError('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.adminLogin(code, password);
        if (cancelled) return;
        saveKhatma(data.khatma._id, { code, adminPassword: password, name: data.khatma.name });
        setActive(data.khatma._id);
        navigate(`${khatmaPath(code)}/manage`, { replace: true });
      } catch {
        if (!cancelled) setError('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.');
      }
    })();
    return () => { cancelled = true; };
  }, [code, password, navigate]);

  if (!error) return <div className="loading">جاري التحميل...</div>;

  return (
    <div className="card center-text">
      <p className="big-text">{error}</p>
      <Link to="/" className="btn btn-big btn-secondary">الصفحة الرئيسية</Link>
    </div>
  );
}

export default ManageEntry;
```

`client/src/pages/LegacyLogin.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { saveKhatma, setActive } from '../utils/storage';
import { khatmaPath } from '../utils/links';
import BackButton from '../components/BackButton';

// For khatmas created before links existed: code + admin password
function LegacyLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || !password) {
      setError('الرجاء كتابة الرمز وكلمة المرور');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await api.adminLogin(code.trim(), password);
      saveKhatma(data.khatma._id, { code: data.khatma.access_code, adminPassword: password, name: data.khatma.name });
      setActive(data.khatma._id);
      navigate(`${khatmaPath(data.khatma.access_code)}/manage`);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="khatma-title">دخول المنظم</h2>
      <form className="card" onSubmit={handleSubmit}>
        <label className="big-label" htmlFor="legacy-code">رمز الختمة</label>
        <input id="legacy-code" className="big-input" value={code} onChange={(e) => setCode(e.target.value)} />
        <label className="big-label" htmlFor="legacy-password">كلمة مرور المسؤول</label>
        <input
          id="legacy-password"
          className="big-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>
          {busy ? 'جاري الدخول…' : 'دخول'}
        </button>
      </form>
      <BackButton to="/" />
    </div>
  );
}

export default LegacyLogin;
```

- [ ] **Step 4: Layout and menu**

`client/src/pages/manage/ManageLayout.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { api } from '../../api/client';
import { findIdByCode, getKhatma, setActive } from '../../utils/storage';

// Loads the organizer's data once and shares it with every manage screen
function ManageLayout() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', khatma: null, participants: [], deceased: [] });
  const id = findIdByCode(code);
  const password = id ? getKhatma(id)?.adminPassword : null;

  const reload = useCallback(async () => {
    try {
      const data = await api.adminLogin(code, password);
      setState({ loading: false, error: '', khatma: data.khatma, participants: data.participants, deceased: data.deceased });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [code, password]);

  useEffect(() => {
    if (!password) {
      navigate('/manage-login', { replace: true });
      return;
    }
    setActive(id);
    reload();
  }, [id, password, navigate, reload]);

  if (state.loading) return <div className="loading">جاري التحميل...</div>;
  if (state.error) return <div className="error-msg">{state.error}</div>;

  return (
    <div>
      <h2 className="khatma-title">إدارة: {state.khatma.name}</h2>
      <Outlet context={{ ...state, code, khatmaId: state.khatma._id, password, reload }} />
    </div>
  );
}

export default ManageLayout;
```

`client/src/pages/manage/ManageMenu.jsx`:

```jsx
import { Link, useOutletContext } from 'react-router-dom';
import { khatmaPath } from '../../utils/links';

const TILES = [
  { to: 'names', icon: '👥', label: 'الأسماء', quick: true },
  { to: 'deceased', icon: '🤲', label: 'الإهداء للمتوفين', quick: false },
  { to: 'finished', icon: '✅', label: 'تسجيل من أنهى القراءة', quick: true },
  { to: 'send', icon: '📤', label: 'إرسال للعائلة', quick: true },
  { to: 'pause', icon: '⏸️', label: 'إيقاف مؤقت', quick: false },
  { to: 'settings', icon: '⚙️', label: 'الإعدادات', quick: true },
  { to: 'history', icon: '📊', label: 'السجل والإحصائيات', quick: false }
];

function ManageMenu() {
  const { khatma, code } = useOutletContext();
  const tiles = TILES.filter(t => !khatma.is_quick || t.quick);

  return (
    <div>
      <div className="tile-grid">
        {tiles.map(t => (
          <Link key={t.to} to={t.to} className="tile">
            <span className="tile-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
      <Link to={khatmaPath(code)} className="link-button">عرض الختمة كما يراها المشاركون</Link>
    </div>
  );
}

export default ManageMenu;
```

- [ ] **Step 5: Names screen**

`client/src/pages/manage/NamesScreen.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { ar } from '../../utils/arabicNumbers';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackButton from '../../components/BackButton';

function NamesScreen() {
  const { khatma, khatmaId, participants, reload } = useOutletContext();
  const [newName, setNewName] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editing, setEditing] = useState(null); // participant being renamed
  const [editName, setEditName] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const sorted = [...participants].sort((a, b) => a.slot_number - b.slot_number);
  const freeSlots = () => {
    const taken = new Set(participants.map(p => p.slot_number));
    return Array.from({ length: 30 }, (_, i) => i + 1).filter(n => !taken.has(n));
  };

  const run = async (action, successMessage) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await reload();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const addOne = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setError('الرجاء كتابة الاسم');
    const slot = freeSlots()[0];
    if (!slot) return setError('اكتمل العدد: ٣٠ اسمًا');
    run(async () => {
      await api.addParticipant(khatmaId, { name, slotNumber: slot });
      setNewName('');
    }, `تمت إضافة ${name}`);
  };

  const addMany = (e) => {
    e.preventDefault();
    const names = bulkText.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return setError('الرجاء كتابة اسم واحد على الأقل');
    const slots = freeSlots();
    if (names.length > slots.length) return setError(`يمكن إضافة ${ar(slots.length)} أسماء فقط`);
    run(async () => {
      for (let i = 0; i < names.length; i++) {
        await api.addParticipant(khatmaId, { name: names[i], slotNumber: slots[i] });
      }
      setBulkText('');
      setBulkOpen(false);
    }, `تمت إضافة ${ar(names.length)} أسماء`);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return setError('الرجاء كتابة الاسم');
    run(async () => {
      await api.updateParticipant(khatmaId, editing._id, { name });
      setEditing(null);
    }, 'تم حفظ الاسم');
  };

  const move = (index, direction) => {
    const target = sorted[index + direction];
    if (!target) return;
    run(() => api.swapParticipants(khatmaId, sorted[index]._id, target._id));
  };

  const confirmDelete = () => {
    const p = toDelete;
    setToDelete(null);
    run(() => api.deleteParticipant(khatmaId, p._id), `تم حذف ${p.name}`);
  };

  if (editing) {
    return (
      <form className="card" onSubmit={saveEdit}>
        <label className="big-label" htmlFor="edit-name">الاسم الجديد</label>
        <input id="edit-name" className="big-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>حفظ</button>
        <button type="button" className="btn btn-big btn-secondary" onClick={() => setEditing(null)}>رجوع</button>
      </form>
    );
  }

  return (
    <div>
      <h3 className="section-title">الأسماء ({ar(participants.length)} من ٣٠)</h3>
      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      {bulkOpen ? (
        <form className="card" onSubmit={addMany}>
          <label className="big-label" htmlFor="bulk-names">اكتب كل اسم في سطر</label>
          <textarea id="bulk-names" className="big-input" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إضافة الأسماء</button>
          <button type="button" className="btn btn-big btn-secondary" onClick={() => setBulkOpen(false)}>رجوع</button>
        </form>
      ) : (
        <>
          <form className="card" onSubmit={addOne}>
            <label className="big-label" htmlFor="new-name">اسم جديد</label>
            <input id="new-name" className="big-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إضافة</button>
          </form>
          <button className="btn btn-big btn-secondary" onClick={() => setBulkOpen(true)}>
            إضافة عدة أسماء مرة واحدة
          </button>
        </>
      )}

      <div className="big-list">
        {sorted.map((p, i) => (
          <div key={p._id} className="big-row">
            <span className="big-row-main">{ar(i + 1)}. {p.name}</span>
            <div className="row-actions">
              <button className="btn btn-secondary" onClick={() => { setEditing(p); setEditName(p.name); }} disabled={busy}>تعديل</button>
              <button className="btn btn-danger" onClick={() => setToDelete(p)} disabled={busy}>حذف</button>
              {!khatma.is_quick && (
                <>
                  <button className="btn btn-secondary" onClick={() => move(i, -1)} disabled={busy || i === 0}>▲ تقديم</button>
                  <button className="btn btn-secondary" onClick={() => move(i, 1)} disabled={busy || i === sorted.length - 1}>▼ تأخير</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <BackButton to=".." />

      {toDelete && (
        <ConfirmDialog
          message={`هل أنت متأكد أنك تريد حذف ${toDelete.name}؟`}
          confirmLabel="نعم، احذف"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

export default NamesScreen;
```

- [ ] **Step 6: Deceased screen**

`client/src/pages/manage/DeceasedScreen.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { formatDate } from '../../utils/hijriDate';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackButton from '../../components/BackButton';

function DeceasedScreen() {
  const { khatma, khatmaId, deceased, reload } = useOutletContext();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!name.trim() || !date) return setError('الرجاء كتابة الاسم وتاريخ الوفاة');
    run(async () => {
      await api.addDeceased(khatmaId, { name: name.trim(), deathDate: date });
      setName('');
      setDate('');
    });
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editName.trim() || !editDate) return setError('الرجاء كتابة الاسم وتاريخ الوفاة');
    run(async () => {
      await api.updateDeceased(khatmaId, editing._id, { name: editName.trim(), deathDate: editDate });
      setEditing(null);
    });
  };

  const confirmDelete = () => {
    const d = toDelete;
    setToDelete(null);
    run(() => api.deleteDeceased(khatmaId, d._id));
  };

  if (editing) {
    return (
      <form className="card" onSubmit={saveEdit}>
        <label className="big-label" htmlFor="edit-dec-name">الاسم</label>
        <input id="edit-dec-name" className="big-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
        <label className="big-label" htmlFor="edit-dec-date">تاريخ الوفاة</label>
        <input id="edit-dec-date" className="big-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>حفظ</button>
        <button type="button" className="btn btn-big btn-secondary" onClick={() => setEditing(null)}>رجوع</button>
      </form>
    );
  }

  return (
    <div>
      <h3 className="section-title">الإهداء للمتوفين</h3>
      <p className="hint">كل ختمة تُهدى لواحد منهم بالترتيب، ولمن تقترب ذكرى وفاته.</p>
      {error && <div className="error-msg">{error}</div>}

      <form className="card" onSubmit={add}>
        <label className="big-label" htmlFor="dec-name">اسم المتوفى</label>
        <input id="dec-name" className="big-input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="big-label" htmlFor="dec-date">تاريخ الوفاة</label>
        <input id="dec-date" className="big-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إضافة</button>
      </form>

      <div className="big-list">
        {deceased.map(d => (
          <div key={d._id} className="big-row">
            <span className="big-row-main">{d.name}</span>
            <span>{formatDate(d.death_date, khatma.use_hijri)}</span>
            <div className="row-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setEditing(d); setEditName(d.name); setEditDate(String(d.death_date).slice(0, 10)); }}
                disabled={busy}
              >
                تعديل
              </button>
              <button className="btn btn-danger" onClick={() => setToDelete(d)} disabled={busy}>حذف</button>
            </div>
          </div>
        ))}
      </div>

      <BackButton to=".." />

      {toDelete && (
        <ConfirmDialog
          message={`هل أنت متأكد أنك تريد حذف ${toDelete.name}؟`}
          confirmLabel="نعم، احذف"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

export default DeceasedScreen;
```

- [ ] **Step 7: Routes**

In `client/src/App.jsx`, add imports:

```jsx
import ManageEntry from './pages/ManageEntry';
import LegacyLogin from './pages/LegacyLogin';
import ManageLayout from './pages/manage/ManageLayout';
import ManageMenu from './pages/manage/ManageMenu';
import NamesScreen from './pages/manage/NamesScreen';
import DeceasedScreen from './pages/manage/DeceasedScreen';
```

and routes above `*`:

```jsx
          <Route path="/m/:code" element={<ManageEntry />} />
          <Route path="/manage-login" element={<LegacyLogin />} />
          <Route path="/k/:code/manage" element={<ManageLayout />}>
            <Route index element={<ManageMenu />} />
            <Route path="names" element={<NamesScreen />} />
            <Route path="deceased" element={<DeceasedScreen />} />
          </Route>
```

`<BackButton to=".." />` inside a child route resolves to the menu (`/k/:code/manage`), because react-router resolves `..` by route hierarchy.

- [ ] **Step 8: Run e2e and build**

Run: `cd client && npm run test:e2e -- manage.spec.js participant.spec.js`
Expected: all pass. `npm run build` succeeds.

- [ ] **Step 9: Commit**

```bash
git add client
git commit -m "Organizer: manage link entry, legacy login, tile menu, names and deceased screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Organizer — finished, send, pause, settings, history

**Files:**
- Create: `client/src/pages/manage/useCycleStatus.js`, `client/src/pages/manage/FinishedScreen.jsx`, `client/src/pages/manage/SendScreen.jsx`, `client/src/pages/manage/PauseScreen.jsx`, `client/src/pages/manage/SettingsScreen.jsx`, `client/src/components/ShareButtons.jsx`, `client/e2e/manage-more.spec.js`
- Modify: `client/src/pages/HistoryPage.jsx`, `client/src/pages/StatsPage.jsx`, `client/src/App.jsx`

**Interfaces:**
- Consumes: Task 5 outlet context; Task 3 links/storage/api.
- Produces: `useCycleStatus(khatmaId) => { dash, completions, loading, error, reload }`; `<ShareButtons name code password? />` (used again in Task 7); routes `finished`, `send`, `pause`, `settings`, `history`, `stats` under `/k/:code/manage`.

- [ ] **Step 1: Write the failing e2e tests**

`client/e2e/manage-more.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, completedCount, dashboard } from './api.js';

const manageUrl = k => `/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`;

test('organizer records that someone finished, and undoes with confirmation', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /تسجيل من أنهى القراءة/ }).click();
  const row = page.locator('.big-row', { hasText: 'محمد أحمد' });
  await expect(row.getByText('⏳ لم ينته بعد')).toBeVisible();
  await row.getByRole('button', { name: 'سجّل أنه أنهى' }).click();
  await expect(row.getByText('✅ أنهى')).toBeVisible();
  expect(await completedCount(request, k)).toBe(1);
  await row.getByRole('button', { name: 'تراجع' }).click();
  await page.getByRole('button', { name: 'نعم، تراجع' }).click();
  await expect(row.getByText('⏳ لم ينته بعد')).toBeVisible();
  expect(await completedCount(request, k)).toBe(0);
});

test('send screen builds WhatsApp links for family, reminder and distribution', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /إرسال للعائلة/ }).click();
  const family = await page.getByRole('link', { name: /أرسل الختمة للعائلة/ }).getAttribute('href');
  expect(decodeURIComponent(family)).toContain(`/k/${k.code}`);
  const reminder = await page.getByRole('link', { name: /تذكير/ }).getAttribute('href');
  expect(decodeURIComponent(reminder)).toContain('محمد أحمد (الجزء ١)');
  const manage = await page.getByRole('link', { name: /رابط الإدارة/ }).getAttribute('href');
  expect(decodeURIComponent(manage)).toContain('ولا ترسلها لأحد');
});

test('pause and resume', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /إيقاف مؤقت/ }).click();
  await page.getByLabel('من يوم').fill('2020-01-01');
  await page.getByLabel('إلى يوم').fill('2099-01-01');
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  await expect(page.getByText(/الختمة متوقفة/)).toBeVisible();
  expect((await dashboard(request, k)).paused).toBe(true);
  await page.getByRole('button', { name: 'استئناف الختمة' }).click();
  await expect(page.getByRole('button', { name: 'إيقاف الختمة' })).toBeVisible();
  expect((await dashboard(request, k)).paused).toBe(false);
});

test('settings: change name and help phone; Excel and copy are under advanced options', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإعدادات/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة جديدة');
  await page.getByLabel(/رقم واتساب للمساعدة/).fill('+973 3612 3456');
  await expect(page.getByRole('button', { name: /تنزيل ملف Excel/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  const dash = await dashboard(request, k);
  expect(dash.khatma.name).toBe('ختمة جديدة');
  expect(dash.khatma.organizer_phone).toBe('97336123456');

  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await expect(page.getByRole('button', { name: /تنزيل ملف Excel/ })).toBeVisible();
  await page.getByRole('button', { name: /نسخ الختمة/ }).click();
  await expect(page.getByText('تم نسخ الختمة')).toBeVisible();
  await expect(page.getByRole('link', { name: /أرسل الختمة للعائلة/ })).toBeVisible();
});

test('delete khatma needs two confirmations', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإعدادات/ }).click();
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await page.getByRole('button', { name: 'حذف الختمة' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.getByText('هذا لا يمكن التراجع عنه. هل تحذفها نهائيًا؟')).toBeVisible();
  await page.getByRole('button', { name: 'نعم، احذف نهائيًا' }).click();
  await expect(page).toHaveURL(/\/$/);
  const res = await request.post('http://localhost:3000/api/khatma/access', { data: { code: k.code } });
  expect(res.status()).toBe(404);
});

test('history and stats open from the menu and go back', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /السجل والإحصائيات/ }).click();
  await expect(page.getByText('سجل الختمات السابقة')).toBeVisible();
  await page.getByRole('link', { name: 'الإحصائيات' }).click();
  await expect(page.getByText('ترتيب المشاركين')).toBeVisible();
  await page.getByRole('link', { name: 'رجوع' }).click();
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd client && npm run test:e2e -- manage-more.spec.js`
Expected: FAIL.

- [ ] **Step 3: Shared hook and ShareButtons**

`client/src/pages/manage/useCycleStatus.js`:

```js
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

// Current cycle's distribution + who finished, for organizer screens
export function useCycleStatus(khatmaId) {
  const [state, setState] = useState({ dash: null, completions: null, loading: true, error: '' });

  const reload = useCallback(async () => {
    try {
      const dash = await api.getDashboard(khatmaId);
      const completions = await api.getCompletions(khatmaId, dash.cycleNumber);
      setState({ dash, completions, loading: false, error: '' });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [khatmaId]);

  useEffect(() => { reload(); }, [reload]);

  return { ...state, reload };
}
```

`client/src/components/ShareButtons.jsx`:

```jsx
import { whatsappUrl, familyMessage, manageMessage } from '../utils/links';

function ShareButtons({ name, code, password }) {
  return (
    <div>
      <a className="btn btn-big btn-whatsapp" href={whatsappUrl(familyMessage(name, code))} target="_blank" rel="noopener noreferrer">
        🟢 أرسل الختمة للعائلة على واتساب
      </a>
      {password && (
        <>
          <a className="btn btn-big btn-secondary" href={whatsappUrl(manageMessage(name, code, password))} target="_blank" rel="noopener noreferrer">
            🔒 احفظ رابط الإدارة عندك على واتساب
          </a>
          <p className="hint">أرسل رابط الإدارة لنفسك فقط، واحتفظ بالرسالة.</p>
        </>
      )}
    </div>
  );
}

export default ShareButtons;
```

- [ ] **Step 4: Finished screen**

`client/src/pages/manage/FinishedScreen.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { ar } from '../../utils/arabicNumbers';
import { useCycleStatus } from './useCycleStatus';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackButton from '../../components/BackButton';

function FinishedScreen() {
  const { khatma, khatmaId } = useOutletContext();
  const { dash, completions, loading, error: loadError, reload } = useCycleStatus(khatmaId);
  const [toUndo, setToUndo] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const busyRef = useRef(false);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (loadError) return <div className="error-msg">{loadError}</div>;

  const isDone = (pid) => completions.completedIds.includes(pid);
  const juzOf = (p) => (khatma.is_quick ? p.slot_number : p.currentJuz);
  const rows = [...dash.participants].sort((a, b) => juzOf(a) - juzOf(b));

  const run = async (pid, action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(pid);
    setError('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const body = (p) => ({ participantId: p._id, cycleNumber: dash.cycleNumber });

  return (
    <div>
      <h3 className="section-title">تسجيل من أنهى القراءة</h3>
      <p className="hint">{ar(completions.completedCount)} من {ar(completions.totalParticipants)} أنهوا القراءة</p>
      {error && <div className="error-msg">{error}</div>}

      <div className="big-list">
        {rows.map(p => (
          <div key={p._id} className="big-row">
            <span className="big-row-main">الجزء {ar(juzOf(p))} — {p.name}</span>
            <span className="status">{isDone(p._id) ? '✅ أنهى' : '⏳ لم ينته بعد'}</span>
            <div className="row-actions">
              {isDone(p._id) ? (
                <button className="btn btn-secondary" onClick={() => setToUndo(p)} disabled={busyId !== null}>تراجع</button>
              ) : (
                <button className="btn btn-primary" onClick={() => run(p._id, () => api.markComplete(khatmaId, body(p)))} disabled={busyId !== null}>
                  {busyId === p._id ? 'جاري التسجيل…' : 'سجّل أنه أنهى'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <BackButton to=".." />

      {toUndo && (
        <ConfirmDialog
          message={`هل تريد التراجع عن تسجيل قراءة ${toUndo.name}؟`}
          confirmLabel="نعم، تراجع"
          onConfirm={() => { const p = toUndo; setToUndo(null); run(p._id, () => api.undoComplete(khatmaId, body(p))); }}
          onCancel={() => setToUndo(null)}
        />
      )}
    </div>
  );
}

export default FinishedScreen;
```

- [ ] **Step 5: Send screen**

`client/src/pages/manage/SendScreen.jsx`:

```jsx
import { useOutletContext } from 'react-router-dom';
import { whatsappUrl, reminderMessage, distributionMessage } from '../../utils/links';
import { ar } from '../../utils/arabicNumbers';
import { useCycleStatus } from './useCycleStatus';
import ShareButtons from '../../components/ShareButtons';
import BackButton from '../../components/BackButton';

function SendScreen() {
  const { khatma, khatmaId, code, password } = useOutletContext();
  const { dash, completions, loading, error } = useCycleStatus(khatmaId);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  const juzOf = (p) => (khatma.is_quick ? p.slot_number : p.currentJuz);
  const isDone = (pid) => completions.completedIds.includes(pid);
  const notDone = dash.participants.filter(p => !isDone(p._id)).map(p => ({ name: p.name, juz: juzOf(p) }));

  const distribution = distributionMessage({
    name: khatma.name,
    code,
    isQuick: khatma.is_quick,
    khatmaNumber: dash.currentKhatmaNumber,
    dedicatedNames: dash.dedication?.dedicated?.map(d => d.name) || [],
    rows: dash.participants.map(p => ({ juz: juzOf(p), name: p.name, done: isDone(p._id) })),
    completedCount: completions.completedCount,
    total: completions.totalParticipants
  });

  return (
    <div>
      <h3 className="section-title">إرسال للعائلة</h3>
      <ShareButtons name={khatma.name} code={code} password={password} />

      {notDone.length > 0 && !dash.paused && (
        <a className="btn btn-big btn-secondary" href={whatsappUrl(reminderMessage(khatma.name, code, notDone))} target="_blank" rel="noopener noreferrer">
          🔔 إرسال تذكير لمن لم ينته ({ar(notDone.length)})
        </a>
      )}

      <a className="btn btn-big btn-secondary" href={whatsappUrl(distribution)} target="_blank" rel="noopener noreferrer">
        📋 إرسال توزيع الأجزاء كاملًا
      </a>

      <BackButton to=".." />
    </div>
  );
}

export default SendScreen;
```

- [ ] **Step 6: Pause screen**

`client/src/pages/manage/PauseScreen.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { formatDate } from '../../utils/hijriDate';
import BackButton from '../../components/BackButton';

function PauseScreen() {
  const { khatma, khatmaId, reload } = useOutletContext();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isPaused = !!(khatma.paused_from && khatma.paused_to);

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const pause = (e) => {
    e.preventDefault();
    if (!from || !to) return setError('الرجاء اختيار اليومين');
    if (to < from) return setError('يوم النهاية يجب أن يكون بعد يوم البداية');
    run(() => api.updateKhatma(khatmaId, { pausedFrom: from, pausedTo: to }));
  };

  return (
    <div>
      <h3 className="section-title">إيقاف مؤقت</h3>
      {error && <div className="error-msg">{error}</div>}

      {isPaused ? (
        <div className="card center-text">
          <p className="big-text">
            ⏸️ الختمة متوقفة من {formatDate(khatma.paused_from, khatma.use_hijri)} إلى {formatDate(khatma.paused_to, khatma.use_hijri)}
          </p>
          <button className="btn btn-big btn-primary" onClick={() => run(() => api.updateKhatma(khatmaId, { pausedFrom: '', pausedTo: '' }))} disabled={busy}>
            استئناف الختمة
          </button>
        </div>
      ) : (
        <form className="card" onSubmit={pause}>
          <p className="hint">في أيام الإيقاف لا تتغير الأجزاء (مثلًا في السفر أو رمضان).</p>
          <label className="big-label" htmlFor="pause-from">من يوم</label>
          <input id="pause-from" className="big-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="big-label" htmlFor="pause-to">إلى يوم</label>
          <input id="pause-to" className="big-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إيقاف الختمة</button>
        </form>
      )}

      <BackButton to=".." />
    </div>
  );
}

export default PauseScreen;
```

- [ ] **Step 7: Settings screen**

`client/src/pages/manage/SettingsScreen.jsx`:

```jsx
import { useState, useRef } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { generateCode, generatePassword, khatmaPath } from '../../utils/links';
import { saveKhatma, removeKhatma } from '../../utils/storage';
import ConfirmDialog from '../../components/ConfirmDialog';
import ShareButtons from '../../components/ShareButtons';
import BackButton from '../../components/BackButton';

const SCHEDULES = [
  ['daily', 'كل يوم'],
  ['weekly', 'كل أسبوع'],
  ['biweekly', 'كل أسبوعين'],
  ['monthly', 'كل شهر']
];

function SettingsScreen() {
  const { khatma, khatmaId, reload } = useOutletContext();
  const navigate = useNavigate();
  const [name, setName] = useState(khatma.name);
  const [rotationType, setRotationType] = useState(khatma.rotation_type === 'custom' ? 'weekly' : khatma.rotation_type);
  const [customDays, setCustomDays] = useState(khatma.rotation_type === 'custom' ? String(khatma.custom_days || '') : '');
  const [phone, setPhone] = useState(khatma.organizer_phone || '');
  const [startDate, setStartDate] = useState(khatma.start_date);
  const [useHijri, setUseHijri] = useState(!!khatma.use_hijri);
  const [khatmaNumber, setKhatmaNumber] = useState(khatma.khatma_number || 1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0); // 0 none, 1 first, 2 final
  const [copy, setCopy] = useState(null); // { code, password, name }
  const busyRef = useRef(false);

  const run = async (action, successMessage) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('الرجاء كتابة اسم الختمة');
    const custom = Number(customDays);
    run(async () => {
      await api.updateKhatma(khatmaId, {
        name: name.trim(),
        organizerPhone: phone,
        ...(khatma.is_quick ? {} : {
          rotationType: custom >= 1 ? 'custom' : rotationType,
          customDays: custom >= 1 ? custom : null,
          startDate,
          useHijri,
          khatmaNumber: Number(khatmaNumber) || 1
        })
      });
      saveKhatma(khatmaId, { name: name.trim() });
      await reload();
    }, 'تم الحفظ');
  };

  const downloadExcel = () => run(async () => {
    const dash = await api.getDashboard(khatmaId);
    const comp = await api.getCompletions(khatmaId, dash.cycleNumber);
    const juzOf = (p) => (khatma.is_quick ? p.slot_number : p.currentJuz);
    const rows = [['الترتيب', 'الاسم', 'الجزء الحالي', 'الحالة']];
    [...dash.participants].sort((a, b) => a.slot_number - b.slot_number).forEach(p => {
      rows.push([p.slot_number, p.name, juzOf(p), comp.completedIds.includes(p._id) ? 'أنهى' : 'لم ينته']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${khatma.name}_الختمة_${dash.currentKhatmaNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const duplicate = () => run(async () => {
    const newCode = generateCode();
    const newPassword = generatePassword();
    const result = await api.duplicateKhatma(khatmaId, { newAccessCode: newCode, newAdminPassword: newPassword });
    const newName = `${khatma.name} (نسخة)`;
    saveKhatma(result.id, { code: newCode, adminPassword: newPassword, name: newName });
    setCopy({ code: newCode, password: newPassword, name: newName });
  }, 'تم نسخ الختمة');

  const deleteKhatma = () => {
    setConfirmStep(0);
    run(async () => {
      await api.deleteKhatma(khatmaId);
      removeKhatma(khatmaId);
      navigate('/', { replace: true });
    });
  };

  return (
    <div>
      <h3 className="section-title">الإعدادات</h3>
      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      <form className="card" onSubmit={save}>
        <label className="big-label" htmlFor="set-name">اسم الختمة</label>
        <input id="set-name" className="big-input" value={name} onChange={(e) => setName(e.target.value)} />

        {!khatma.is_quick && (
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend className="big-label">متى تتغير الأجزاء؟</legend>
            {SCHEDULES.map(([value, label]) => (
              <label key={value} className={`radio-row ${rotationType === value && !customDays ? 'selected' : ''}`}>
                <input type="radio" name="schedule" value={value} checked={rotationType === value && !customDays} onChange={() => { setRotationType(value); setCustomDays(''); }} />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        <label className="big-label" htmlFor="set-phone">رقم واتساب للمساعدة (اختياري)</label>
        <input id="set-phone" className="big-input" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="hint">مع رمز الدولة، مثال: 973xxxxxxxx</p>

        <button type="button" className="btn btn-big btn-secondary" onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced}>
          {showAdvanced ? 'إخفاء الخيارات المتقدمة ▲' : 'خيارات متقدمة ▼'}
        </button>

        {showAdvanced && !khatma.is_quick && (
          <div>
            <label className="big-label" htmlFor="set-start">تاريخ بداية الختمة</label>
            <input id="set-start" className="big-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <label className="big-label" htmlFor="set-days">عدد أيام مخصص (بدل الاختيارات أعلاه)</label>
            <input id="set-days" className="big-input" type="number" min="1" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
            <label className={`radio-row ${useHijri ? 'selected' : ''}`}>
              <input type="checkbox" checked={useHijri} onChange={(e) => setUseHijri(e.target.checked)} />
              عرض التواريخ بالتقويم الهجري
            </label>
            <label className="big-label" htmlFor="set-number">رقم الختمة الأولى</label>
            <input id="set-number" className="big-input" type="number" min="1" value={khatmaNumber} onChange={(e) => setKhatmaNumber(e.target.value)} />
          </div>
        )}

        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>حفظ</button>
      </form>

      {showAdvanced && (
        <div className="card">
          <button className="btn btn-big btn-secondary" onClick={downloadExcel} disabled={busy}>⬇️ تنزيل ملف Excel بالأسماء</button>
          <button className="btn btn-big btn-secondary" onClick={duplicate} disabled={busy}>📄 نسخ الختمة (نفس الأسماء والمتوفين)</button>
          {copy && (
            <>
              <ShareButtons name={copy.name} code={copy.code} password={copy.password} />
              <Link to={khatmaPath(copy.code)} className="link-button">فتح النسخة</Link>
            </>
          )}
          <button className="btn btn-big btn-danger" onClick={() => setConfirmStep(1)} disabled={busy}>حذف الختمة</button>
        </div>
      )}

      <BackButton to=".." />

      {confirmStep === 1 && (
        <ConfirmDialog
          message="هل أنت متأكد أنك تريد حذف الختمة كلها؟ ستُحذف الأسماء والسجل."
          confirmLabel="نعم، احذف"
          danger
          onConfirm={() => setConfirmStep(2)}
          onCancel={() => setConfirmStep(0)}
        />
      )}
      {confirmStep === 2 && (
        <ConfirmDialog
          message="هذا لا يمكن التراجع عنه. هل تحذفها نهائيًا؟"
          confirmLabel="نعم، احذف نهائيًا"
          danger
          onConfirm={deleteKhatma}
          onCancel={() => setConfirmStep(0)}
        />
      )}
    </div>
  );
}

export default SettingsScreen;
```

- [ ] **Step 8: History and Stats under the manage layout**

`client/src/pages/HistoryPage.jsx`:
- Change the router import to `import { useOutletContext, Link } from 'react-router-dom';` and add `import BackButton from '../components/BackButton';`.
- Replace `const { id } = useParams();` and `const navigate = useNavigate();` with `const { khatmaId: id } = useOutletContext();`.
- Directly under the "سجل الختمات السابقة" card, add: `<Link to="../stats" className="btn btn-big btn-secondary">الإحصائيات</Link>`.
- Replace the final `<div style={{ textAlign: 'center', marginTop: 16 }}>…العودة للوحة…</div>` block with `<BackButton to=".." />`.

`client/src/pages/StatsPage.jsx`:
- Change the router import to `import { useOutletContext } from 'react-router-dom';` and add `import BackButton from '../components/BackButton';`.
- Replace `const { id } = useParams();` and `const navigate = useNavigate();` with `const { khatmaId: id } = useOutletContext();`.
- Replace the final "العودة للوحة" block with `<BackButton to=".." />`.

- [ ] **Step 9: Routes**

In `client/src/App.jsx` add imports:

```jsx
import FinishedScreen from './pages/manage/FinishedScreen';
import SendScreen from './pages/manage/SendScreen';
import PauseScreen from './pages/manage/PauseScreen';
import SettingsScreen from './pages/manage/SettingsScreen';
```

and inside the `/k/:code/manage` route, after `deceased`:

```jsx
            <Route path="finished" element={<FinishedScreen />} />
            <Route path="send" element={<SendScreen />} />
            <Route path="pause" element={<PauseScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="stats" element={<StatsPage />} />
```

Remove the old `/khatma/:id/history` and `/khatma/:id/stats` routes (Task 7 adds redirects for `/khatma/*`).

- [ ] **Step 10: Run e2e and build**

Run: `cd client && npm run test:e2e -- manage-more.spec.js manage.spec.js`
Expected: all pass. `npm run build` succeeds.

- [ ] **Step 11: Commit**

```bash
git add client
git commit -m "Organizer: record finishers, WhatsApp sending, pause, settings, history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Home, create flow, legacy redirects

**Files:**
- Rewrite: `client/src/pages/HomePage.jsx`, `client/src/pages/CreateKhatma.jsx`
- Create: `client/src/pages/LegacyRedirects.jsx`, `client/e2e/create.spec.js`
- Modify: `client/src/App.jsx` (final route table)

**Interfaces:**
- Consumes: `ShareButtons` (Task 6), storage/links/api (Task 3).
- Produces: routes `/`, `/create`; redirects `/admin`, `/admin/create` → `/create`; `/admin/manage` → manage of the active khatma or `/manage-login`; `/khatma/:id/*` → `/k/<code>` or `/`.

- [ ] **Step 1: Write the failing e2e tests**

`client/e2e/create.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, dashboard } from './api.js';

test('create a regular khatma with only a name, then add names', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /إنشاء ختمة جديدة/ }).click();
  await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة عائلة الأحمد');
  await expect(page.getByLabel('كل أسبوع')).toBeChecked();
  await page.getByLabel(/رقم واتساب للمساعدة/).fill('97336123456');
  await page.screenshot({ path: 'e2e/screenshots/create-form.png', fullPage: true });
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();

  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  await expect(page.getByText('الخطوة التالية: أضف أسماء المشاركين')).toBeVisible();
  const family = decodeURIComponent(await page.getByRole('link', { name: /أرسل الختمة للعائلة/ }).getAttribute('href'));
  expect(family).toMatch(/\/k\/[a-z0-9]{8}/);
  const manage = decodeURIComponent(await page.getByRole('link', { name: /احفظ رابط الإدارة/ }).getAttribute('href'));
  expect(manage).toMatch(/\/m\/[a-z0-9]{8}#\S{24}/);
  expect(manage).toContain('احتفظ بهذه الرسالة، ولا ترسلها لأحد');
  await page.screenshot({ path: 'e2e/screenshots/create-success.png', fullPage: true });

  await page.getByRole('link', { name: /أضف الأسماء/ }).click();
  await page.getByLabel('اسم جديد').fill('محمد');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('١. محمد')).toBeVisible();
});

test('create a quick khatma and land on the juz list', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
  await expect(page.getByText('متى تتغير الأجزاء؟')).toHaveCount(0);
  await page.getByLabel('اسم الختمة').fill('ختمة سريعة');
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  await expect(page.getByText('الخطوة التالية')).toHaveCount(0);
  await page.getByRole('link', { name: 'فتح الختمة' }).click();
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
});

test('name is required', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('الرجاء كتابة اسم الختمة')).toBeVisible();
});

test('home: old Arabic code still works and the khatma is offered next time', async ({ page, request }) => {
  const k = await createKhatma(request, { code: 'ختمة' + Math.floor(Math.random() * 1e6), name: 'ختمة قديمة' });
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto('/');
  await page.getByRole('button', { name: 'عندك رمز الختمة؟ اكتبه هنا' }).click();
  await page.getByLabel('رمز الختمة').fill(k.code);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /العودة إلى: ختمة قديمة/ })).toBeVisible();
});

test('legacy storage and URLs from the old site keep working', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto('/');
  await page.evaluate(({ id, code, password }) => {
    localStorage.clear();
    localStorage.setItem('khatmaCode', code);
    localStorage.setItem('khatmaId', id);
    localStorage.setItem('adminPassword', password);
    localStorage.setItem('participantId', 'old-id');
  }, k);
  await page.goto(`/khatma/${k.id}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/k/${k.code}$`));
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.goto('/admin/manage');
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
});

test('the banned technical words do not appear on participant screens', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${k.code}`);
  await page.getByRole('button', { name: 'محمد أحمد' }).click();
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await page.getByRole('button', { name: /عرض المشاركين/ }).click();
  const text = await page.locator('body').innerText();
  for (const word of ['CSV', 'شاغر', 'التكرار', 'رمز', 'كلمة مرور']) {
    expect(text).not.toContain(word);
  }
  const dash = await dashboard(request, k);
  expect(dash.participants).toHaveLength(1);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd client && npm run test:e2e -- create.spec.js`
Expected: FAIL.

- [ ] **Step 3: Home page**

`client/src/pages/HomePage.jsx` (replace whole file):

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getActive } from '../utils/storage';
import { khatmaPath } from '../utils/links';

function HomePage() {
  const navigate = useNavigate();
  const active = getActive();
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('الرجاء كتابة رمز الختمة');
      return;
    }
    navigate(khatmaPath(code.trim()));
  };

  return (
    <div>
      <div className="bismillah">بسم الله الرحمن الرحيم</div>

      {active?.code && (
        <Link to={khatmaPath(active.code)} className="btn btn-big btn-primary">
          ↩️ العودة إلى: {active.name || 'ختمتي'}
        </Link>
      )}

      <p className="home-intro">هنا تنظّم ختم القرآن الكريم مع عائلتك وأحبابك، وكل شخص يقرأ جزءًا.</p>

      <Link to="/create" className={`btn btn-big ${active?.code ? 'btn-secondary' : 'btn-primary'}`}>
        ➕ إنشاء ختمة جديدة
      </Link>

      <p className="hint">إذا وصلك رابط ختمة على واتساب، اضغط عليه مباشرة.</p>

      {showCode ? (
        <form className="card" onSubmit={handleSubmit}>
          <label className="big-label" htmlFor="home-code">رمز الختمة</label>
          <input id="home-code" className="big-input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-big btn-primary">دخول</button>
        </form>
      ) : (
        <button className="btn btn-big btn-secondary" onClick={() => setShowCode(true)}>
          عندك رمز الختمة؟ اكتبه هنا
        </button>
      )}

      <Link to="/manage-login" className="link-button">دخول المنظم بالرمز وكلمة المرور</Link>
    </div>
  );
}

export default HomePage;
```

- [ ] **Step 4: Create flow**

`client/src/pages/CreateKhatma.jsx` (replace whole file):

```jsx
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { generateCode, generatePassword, khatmaPath } from '../utils/links';
import { saveKhatma, setActive } from '../utils/storage';
import ShareButtons from '../components/ShareButtons';
import BackButton from '../components/BackButton';

const SCHEDULES = [
  ['daily', 'كل يوم'],
  ['weekly', 'كل أسبوع'],
  ['biweekly', 'كل أسبوعين'],
  ['monthly', 'كل شهر']
];

const today = () => new Date().toISOString().split('T')[0];

function CreateKhatma() {
  const [isQuick, setIsQuick] = useState(null); // null = choosing
  const [name, setName] = useState('');
  const [rotationType, setRotationType] = useState('weekly');
  const [phone, setPhone] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [startDate, setStartDate] = useState(today());
  const [customDays, setCustomDays] = useState('');
  const [useHijri, setUseHijri] = useState(false);
  const [khatmaNumber, setKhatmaNumber] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const busyRef = useRef(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('الرجاء كتابة اسم الختمة');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');

    const custom = Number(customDays);
    const payload = {
      name: name.trim(),
      organizerPhone: phone,
      isQuick,
      startDate: isQuick ? today() : startDate,
      rotationType: isQuick ? 'weekly' : (custom >= 1 ? 'custom' : rotationType),
      customDays: !isQuick && custom >= 1 ? custom : null,
      useHijri: isQuick ? false : useHijri,
      khatmaNumber: isQuick ? 1 : (Number(khatmaNumber) || 1)
    };

    try {
      let code;
      let password;
      let result;
      // A random code collision is very unlikely; retry once if it happens
      for (let attempt = 0; attempt < 2; attempt++) {
        code = generateCode();
        password = generatePassword();
        try {
          result = await api.createKhatma({ ...payload, accessCode: code, adminPassword: password });
          break;
        } catch (err) {
          if (err.status !== 409 || attempt === 1) throw err;
        }
      }
      saveKhatma(result.id, { code, adminPassword: password, name: payload.name });
      setActive(result.id);
      setCreated({ code, password, name: payload.name, isQuick });
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="card center-text">
        <h2 className="success-title">تم إنشاء الختمة بنجاح 🌷</h2>
        {!created.isQuick && (
          <>
            <p className="big-text">الخطوة التالية: أضف أسماء المشاركين</p>
            <Link to={`${khatmaPath(created.code)}/manage/names`} className="btn btn-big btn-primary">
              👥 أضف الأسماء
            </Link>
          </>
        )}
        <ShareButtons name={created.name} code={created.code} password={created.password} />
        <Link to={khatmaPath(created.code)} className="link-button">فتح الختمة</Link>
      </div>
    );
  }

  if (isQuick === null) {
    return (
      <div>
        <h2 className="khatma-title">كيف تريد الختمة؟</h2>
        <button className="choice-card" onClick={() => setIsQuick(true)}>
          <div className="choice-card-title">كل شخص يختار جزءه بنفسه</div>
          <div className="choice-card-desc">ترسل الرابط، وكل شخص يضغط على جزء متاح ويكتب اسمه.</div>
        </button>
        <button className="choice-card" onClick={() => setIsQuick(false)}>
          <div className="choice-card-title">أنا أكتب الأسماء، والأجزاء تتغير كل فترة</div>
          <div className="choice-card-desc">تكتب أسماء العائلة، والموقع يوزّع الأجزاء ويغيّرها تلقائيًا، مع الإهداء للمتوفين.</div>
        </button>
        <BackButton to="/" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="khatma-title">ختمة جديدة</h2>
      <form className="card" onSubmit={handleCreate}>
        <label className="big-label" htmlFor="create-name">اسم الختمة</label>
        <input
          id="create-name"
          className="big-input"
          placeholder="مثال: ختمة عائلة الأحمد"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {!isQuick && (
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend className="big-label">متى تتغير الأجزاء؟</legend>
            {SCHEDULES.map(([value, label]) => (
              <label key={value} className={`radio-row ${rotationType === value ? 'selected' : ''}`}>
                <input type="radio" name="schedule" value={value} checked={rotationType === value} onChange={() => setRotationType(value)} />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        <label className="big-label" htmlFor="create-phone">رقم واتساب للمساعدة (اختياري)</label>
        <input id="create-phone" className="big-input" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="hint">ليتواصل معك المشاركون إذا احتاجوا مساعدة. مع رمز الدولة، مثال: 973xxxxxxxx</p>

        {!isQuick && (
          <>
            <button type="button" className="btn btn-big btn-secondary" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
              {showMore ? 'إخفاء الخيارات الإضافية ▲' : 'خيارات إضافية ▼'}
            </button>
            {showMore && (
              <div>
                <label className="big-label" htmlFor="create-start">تاريخ بداية الختمة</label>
                <input id="create-start" className="big-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <label className="big-label" htmlFor="create-days">عدد أيام مخصص (بدل الاختيارات أعلاه)</label>
                <input id="create-days" className="big-input" type="number" min="1" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
                <label className={`radio-row ${useHijri ? 'selected' : ''}`}>
                  <input type="checkbox" checked={useHijri} onChange={(e) => setUseHijri(e.target.checked)} />
                  عرض التواريخ بالتقويم الهجري
                </label>
                <label className="big-label" htmlFor="create-number">رقم الختمة الأولى</label>
                <input id="create-number" className="big-input" type="number" min="1" value={khatmaNumber} onChange={(e) => setKhatmaNumber(e.target.value)} />
              </div>
            )}
          </>
        )}

        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>
          {busy ? 'جاري الإنشاء…' : 'إنشاء الختمة'}
        </button>
      </form>
      <button className="link-button" onClick={() => setIsQuick(null)}>رجوع</button>
    </div>
  );
}

export default CreateKhatma;
```

- [ ] **Step 5: Legacy redirects**

`client/src/pages/LegacyRedirects.jsx`:

```jsx
import { Navigate, useParams } from 'react-router-dom';
import { getKhatma, getActive } from '../utils/storage';
import { khatmaPath } from '../utils/links';

// Old bookmarks: /khatma/:id/dashboard, /khatma/:id/history, ...
export function LegacyKhatmaRedirect() {
  const { id } = useParams();
  const record = getKhatma(id);
  return <Navigate to={record?.code ? khatmaPath(record.code) : '/'} replace />;
}

// Old /admin/manage
export function LegacyManageRedirect() {
  const active = getActive();
  const to = active?.code && active.adminPassword ? `${khatmaPath(active.code)}/manage` : '/manage-login';
  return <Navigate to={to} replace />;
}
```

- [ ] **Step 6: Final route table**

Replace `client/src/App.jsx` entirely:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import CreateKhatma from './pages/CreateKhatma';
import KhatmaPage from './pages/KhatmaPage';
import ManageEntry from './pages/ManageEntry';
import LegacyLogin from './pages/LegacyLogin';
import { LegacyKhatmaRedirect, LegacyManageRedirect } from './pages/LegacyRedirects';
import ManageLayout from './pages/manage/ManageLayout';
import ManageMenu from './pages/manage/ManageMenu';
import NamesScreen from './pages/manage/NamesScreen';
import DeceasedScreen from './pages/manage/DeceasedScreen';
import FinishedScreen from './pages/manage/FinishedScreen';
import SendScreen from './pages/manage/SendScreen';
import PauseScreen from './pages/manage/PauseScreen';
import SettingsScreen from './pages/manage/SettingsScreen';
import HistoryPage from './pages/HistoryPage';
import StatsPage from './pages/StatsPage';
import NotFound from './pages/NotFound';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateKhatma />} />
          <Route path="/k/:code" element={<KhatmaPage />} />
          <Route path="/m/:code" element={<ManageEntry />} />
          <Route path="/manage-login" element={<LegacyLogin />} />
          <Route path="/k/:code/manage" element={<ManageLayout />}>
            <Route index element={<ManageMenu />} />
            <Route path="names" element={<NamesScreen />} />
            <Route path="deceased" element={<DeceasedScreen />} />
            <Route path="finished" element={<FinishedScreen />} />
            <Route path="send" element={<SendScreen />} />
            <Route path="pause" element={<PauseScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>

          {/* Old addresses from before the redesign */}
          <Route path="/admin" element={<Navigate to="/create" replace />} />
          <Route path="/admin/create" element={<Navigate to="/create" replace />} />
          <Route path="/admin/manage" element={<LegacyManageRedirect />} />
          <Route path="/khatma/:id/*" element={<LegacyKhatmaRedirect />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 7: Run e2e and build**

Run: `cd client && npm run test:e2e`
Expected: every spec passes. `npm run build` succeeds.

- [ ] **Step 8: Commit**

```bash
git add client
git commit -m "Home and create flow: name-only creation, WhatsApp share, legacy redirects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Remove the old UI and dead styles

**Files:**
- Delete: `client/src/pages/Dashboard.jsx`, `client/src/pages/SelectParticipant.jsx`, `client/src/pages/ManageKhatma.jsx`, `client/src/pages/AdminPage.jsx`, `client/src/components/KhatmaGrid.jsx`, `client/src/components/DeceasedInfo.jsx`, `client/src/utils/juzNames.js`
- Modify: `client/src/index.css`

- [ ] **Step 1: Confirm nothing imports the old files**

Run: `cd client && grep -rnE "Dashboard|SelectParticipant|ManageKhatma|AdminPage|KhatmaGrid|DeceasedInfo|juzNames" src --include=*.jsx --include=*.js | grep -v "^src/pages/Dashboard.jsx\|^src/pages/SelectParticipant.jsx\|^src/pages/ManageKhatma.jsx\|^src/pages/AdminPage.jsx\|^src/components/KhatmaGrid.jsx\|^src/components/DeceasedInfo.jsx\|^src/utils/juzNames.js"`
Expected: no output.

- [ ] **Step 2: Delete them**

```bash
cd client && git rm src/pages/Dashboard.jsx src/pages/SelectParticipant.jsx src/pages/ManageKhatma.jsx src/pages/AdminPage.jsx src/components/KhatmaGrid.jsx src/components/DeceasedInfo.jsx src/utils/juzNames.js
```

- [ ] **Step 3: Remove dead CSS**

In `client/src/index.css` delete the whole rule blocks (including inside the `@media (max-width: 600px)` block) for these selectors, and the `[data-theme="dark"]` block:

`.header p`, `.header-nav`, `.header-nav a`, `.header-nav a:hover`, `.juz-grid`, `.juz-card` (all variants), `.big-juz` (all), `.dedication-box` (all), `.deceased-entry` (all), `.deceased-separator`, `.anniversary-tag`, `.week-info` (all), `.participant-select-grid`, `.participant-select-card` (all), `.home-page` (all), `.access-form` (all), `.home-links`, `.admin-section` (all), `.admin-list` (all), `.inline-form` (all), `.access-code-display`, `.completion-badge`, `.btn-complete` (all), `.btn-undo-complete` (all), `.password-field` (all), `.eye-btn`, `.dark-mode-toggle` (all), `.dashboard-actions` (all), `.dashboard-nav`, `.read-juz-btn` (all), `.khatma-type-choice`, `.type-card` (all), `.type-icon`, `.type-title`, `.type-desc`, `.btn-join-juz` (all), `.quick-join-form`, `.quick-join-input` (all), `.celebration-overlay` (and its `@keyframes`), `.khatma-complete-banner.celebrating`.

Keep: `:root`, base resets, `.app`, `.container`, `.header`, `.header h1`, `.card`, `.card-title`, `.form-group*`, `.btn*`, `.error-msg`, `.success-msg`, `.loading`, `.completion-progress`, `.progress-*`, `.khatma-complete-banner` (+ `.complete-sub`), `.paused-banner*`, `.dua-*`, `.history-*`, `.hp-*`, `.stats-*`, `.stat-*`, `.rank-*`.

- [ ] **Step 4: Verify each removed class is unused**

Run (bash): 
```bash
cd client && for c in juz-grid juz-card big-juz dedication-box deceased-entry week-info participant-select home-page access-form home-links admin-section admin-list inline-form access-code-display completion-badge btn-complete btn-undo-complete password-field eye-btn dark-mode-toggle dashboard-actions dashboard-nav read-juz-btn khatma-type-choice type-card btn-join-juz quick-join celebration; do grep -rln "$c" src --include=*.jsx && echo "STILL USED: $c"; done; echo done
```
Expected: only `done`.

- [ ] **Step 5: Full verification**

Run: `cd server && npm test` — all pass.
Run: `cd client && npm run test:unit && npm run build && npm run test:e2e` — all pass.
Open every PNG in `client/e2e/screenshots/` and check at phone size: no horizontal scroll, juz number dominant, buttons full width, RTL correct, no technical words on participant screens.

- [ ] **Step 6: Commit**

```bash
git add -A client
git commit -m "Remove old dashboard/manage UI and unused styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Release

- [ ] **Step 1:** Show the user the screenshots from `client/e2e/screenshots/` and get their go-ahead before deploying (this changes the live site everyone uses).
- [ ] **Step 2:** Push: `git push origin main`. Both Vercel projects (`khatma-quran` frontend, `khatma-api` backend) deploy from `main`.
- [ ] **Step 3:** Verify the backend is live without writing data: `curl -s https://khatma-api.vercel.app/api` → `{"status":"ok",...}`; and `curl -s -X POST https://khatma-api.vercel.app/api/khatma/x/participants/000000000000000000000000/claim -H "x-khatma-code: nope"` → `400` JSON (`معرف الختمة غير صحيح`), proving the new route exists (an old backend returns an HTML 404).
- [ ] **Step 4:** Verify the frontend bundle is the new one: the HTML at `https://khatma-quran.vercel.app/` references a new `/assets/index-*.js`, and that file contains `مَن أنت؟`.
- [ ] **Step 5:** Ask the user to open their existing khatma link once on their phone and confirm it works.
