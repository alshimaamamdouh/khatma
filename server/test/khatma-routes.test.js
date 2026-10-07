const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');
const { codeH, adminH, daysAgo, daysAhead } = require('./util');
const Participant = require('../models/Participant');
const Deceased = require('../models/Deceased');
const Completion = require('../models/Completion');
const Khatma = require('../models/Khatma');

test.before(start);
test.after(stop);

const dash = async k => (await call('GET', `/khatma/${k.id}/dashboard`, { headers: codeH(k) })).data;
const addP = (k, name, slotNumber) => call('POST', `/khatma/${k.id}/participants`, { body: { name, slotNumber }, headers: adminH(k) });

// ---------------------------------------------------------------- POST /khatma
test('create: required fields are enforced', async () => {
  const base = { name: 'ن', accessCode: 'req' + Date.now(), adminPassword: 'p', startDate: '2026-01-04' };
  for (const missing of ['name', 'accessCode', 'adminPassword', 'startDate']) {
    const body = { ...base };
    delete body[missing];
    const res = await call('POST', '/khatma', { body });
    assert.strictEqual(res.status, 400, missing);
  }
  for (const bad of [{ name: '' }, { name: 5 }, { adminPassword: ['x'] }, { startDate: { $gt: '' } }]) {
    const res = await call('POST', '/khatma', { body: { ...base, ...bad } });
    assert.strictEqual(res.status, 400, JSON.stringify(bad));
  }
});

test('create: duplicate access code is 409 and does not overwrite the original', async () => {
  const k = await createKhatma({ name: 'الأصلية' });
  const res = await call('POST', '/khatma', { body: { name: 'مكررة', accessCode: k.code, adminPassword: 'other', startDate: '2026-01-04' } });
  assert.strictEqual(res.status, 409);
  assert.strictEqual((await dash(k)).khatma.name, 'الأصلية');
});

test('create: regular defaults (weekly, number 1, not quick, no phone, not hijri)', async () => {
  const k = await createKhatma();
  assert.strictEqual(k.res.status, 201);
  const d = (await dash(k)).khatma;
  assert.strictEqual(d.rotation_type, 'weekly');
  assert.strictEqual(d.custom_days, null);
  assert.strictEqual(d.khatma_number, 1);
  assert.strictEqual(d.is_quick, false);
  assert.strictEqual(d.use_hijri, false);
  assert.strictEqual(d.organizer_phone, null);
  assert.strictEqual(d.paused_from, null);
  assert.strictEqual(d.paused_to, null);
});

test('create: quick khatma keeps its flag and has no next change date', async () => {
  const k = await createKhatma({ isQuick: true, startDate: daysAgo(0) });
  const d = await dash(k);
  assert.strictEqual(d.khatma.is_quick, true);
  assert.strictEqual(d.nextChangeDate, null);
  assert.strictEqual(d.cycleNumber, 1);
});

test('create: khatmaNumber is stored and drives currentKhatmaNumber', async () => {
  const k = await createKhatma({ khatmaNumber: 7, startDate: daysAgo(10) });
  const d = await dash(k);
  assert.strictEqual(d.khatma.khatma_number, 7);
  assert.strictEqual(d.cycleNumber, 2);
  assert.strictEqual(d.currentKhatmaNumber, 8);
});

test('create: custom rotation with days, and custom without days defaults to 7', async () => {
  const a = await createKhatma({ rotationType: 'custom', customDays: 10 });
  const da = await dash(a);
  assert.strictEqual(da.khatma.custom_days, 10);
  assert.strictEqual(da.rotationLabel, 'كل 10 يوم');
  const b = await createKhatma({ rotationType: 'custom' });
  assert.strictEqual((await dash(b)).khatma.custom_days, 7);
});

test('create/update: invalid custom days are 400, numeric strings are accepted', async () => {
  for (const customDays of ['abc', 0, -3, 2.5, 1000]) {
    const k = await createKhatma({ rotationType: 'custom', customDays });
    assert.strictEqual(k.res.status, 400, String(customDays));
  }
  const k = await createKhatma({ rotationType: 'custom', customDays: '10' });
  assert.strictEqual(k.res.status, 201);
  assert.strictEqual((await dash(k)).khatma.custom_days, 10);
  const bad = await call('PUT', `/khatma/${k.id}`, { body: { rotationType: 'custom', customDays: -1 }, headers: adminH(k) });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await dash(k)).khatma.custom_days, 10);
});

test('create: customDays is ignored for non-custom rotations', async () => {
  const k = await createKhatma({ rotationType: 'monthly', customDays: 5 });
  assert.strictEqual((await dash(k)).khatma.custom_days, null);
});

test('create: every rotation type is accepted, an unknown one is a 400', async () => {
  for (const rotationType of ['daily', 'weekly', 'biweekly', 'monthly', 'custom']) {
    const k = await createKhatma({ rotationType });
    assert.strictEqual(k.res.status, 201, rotationType);
  }
  for (const rotationType of ['yearly', { $ne: 1 }, 5]) {
    const k = await createKhatma({ rotationType });
    assert.strictEqual(k.res.status, 400, JSON.stringify(rotationType));
  }
});

test('create: organizer phone is normalised; too-short phone becomes null', async () => {
  const a = await createKhatma({ organizerPhone: '00973 3612-3456' });
  assert.strictEqual((await dash(a)).khatma.organizer_phone, '97336123456');
  const b = await createKhatma({ organizerPhone: '+20 100 123 4567' });
  assert.strictEqual((await dash(b)).khatma.organizer_phone, '201001234567');
  const c = await createKhatma({ organizerPhone: '123' });
  assert.strictEqual((await dash(c)).khatma.organizer_phone, null);
  const d = await createKhatma({ organizerPhone: 'abc' });
  assert.strictEqual((await dash(d)).khatma.organizer_phone, null);
});

test('create: initial participants and deceased are stored', async () => {
  const k = await createKhatma({
    participants: [{ name: 'أ', slotNumber: 1 }, { name: 'ب', slotNumber: 2 }],
    deceased: [{ name: 'فلان', deathDate: '2020-02-02' }]
  });
  assert.strictEqual(k.res.status, 201);
  const d = await dash(k);
  assert.deepStrictEqual(d.participants.map(p => p.name), ['أ', 'ب']);
  assert.strictEqual(d.deceased.length, 1);
});

test('create: invalid initial participants fail cleanly and leave no half-created khatma', async () => {
  const code = 'half' + Date.now();
  const bad = await call('POST', '/khatma', {
    body: { name: 'x', accessCode: code, adminPassword: 'p', startDate: '2026-01-04', participants: [{ name: 'أ', slotNumber: 1 }, { name: 'ب', slotNumber: 1 }] }
  });
  assert.ok(bad.status >= 400 && bad.status < 500, 'status ' + bad.status);
  assert.strictEqual((await call('POST', '/khatma/access', { body: { code } })).status, 404);
  assert.strictEqual(await Khatma.countDocuments({ access_code: code }), 0);
});

// ---------------------------------------------------------------- PUT /khatma/:id
test('update: needs admin header (401), correct password (403), valid id (400)', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' } })).status, 401);
  assert.strictEqual((await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' }, headers: { 'x-admin-password': 'bad' } })).status, 403);
  assert.strictEqual((await call('PUT', '/khatma/xyz', { body: { name: 'x' }, headers: adminH(k) })).status, 400);
  // the access code header is not enough
  assert.strictEqual((await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' }, headers: codeH(k) })).status, 401);
});

test('update: each field changes', async () => {
  const k = await createKhatma();
  const put = body => call('PUT', `/khatma/${k.id}`, { body, headers: adminH(k) });
  assert.strictEqual((await put({ name: 'اسم جديد' })).status, 200);
  assert.strictEqual((await dash(k)).khatma.name, 'اسم جديد');
  await put({ startDate: '2025-05-05' });
  assert.strictEqual((await dash(k)).khatma.start_date, '2025-05-05');
  await put({ khatmaNumber: 9 });
  assert.strictEqual((await dash(k)).khatma.khatma_number, 9);
  await put({ useHijri: true });
  assert.strictEqual((await dash(k)).khatma.use_hijri, true);
  await put({ useHijri: false });
  assert.strictEqual((await dash(k)).khatma.use_hijri, false);
  await put({ rotationType: 'monthly' });
  assert.strictEqual((await dash(k)).khatma.rotation_type, 'monthly');
  await put({ organizerPhone: '+973 3612 3456' });
  assert.strictEqual((await dash(k)).khatma.organizer_phone, '97336123456');
});

test('update: an update of one field leaves the others alone', async () => {
  const k = await createKhatma({ name: 'ثابت', rotationType: 'biweekly', organizerPhone: '97336123456' });
  await call('PUT', `/khatma/${k.id}`, { body: { useHijri: true }, headers: adminH(k) });
  const d = (await dash(k)).khatma;
  assert.strictEqual(d.name, 'ثابت');
  assert.strictEqual(d.rotation_type, 'biweekly');
  assert.strictEqual(d.organizer_phone, '97336123456');
});

test('update: empty body (or only empty/unknown fields) is 400', async () => {
  const k = await createKhatma();
  for (const body of [{}, { name: '' }, { unknown: 1 }]) {
    const res = await call('PUT', `/khatma/${k.id}`, { body, headers: adminH(k) });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
  }
});

test('update: invalid values are 400 and change nothing', async () => {
  const k = await createKhatma({ name: 'سليمة' });
  for (const body of [{ rotationType: 'yearly' }, { name: { $set: 1 } }, { startDate: { a: 1 } }]) {
    const res = await call('PUT', `/khatma/${k.id}`, { body, headers: adminH(k) });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
  }
  const d = (await dash(k)).khatma;
  assert.strictEqual(d.name, 'سليمة');
  assert.strictEqual(d.rotation_type, 'weekly');
});

test('update: pause can be set and cleared (null or empty string)', async () => {
  const k = await createKhatma();
  const put = body => call('PUT', `/khatma/${k.id}`, { body, headers: adminH(k) });
  await put({ pausedFrom: daysAgo(2), pausedTo: daysAhead(2) });
  let d = await dash(k);
  assert.strictEqual(d.paused, true);
  assert.strictEqual(d.khatma.paused_from, daysAgo(2));
  await put({ pausedFrom: null, pausedTo: null });
  d = await dash(k);
  assert.strictEqual(d.paused, false);
  assert.strictEqual(d.khatma.paused_from, null);
  await put({ pausedFrom: daysAgo(2), pausedTo: daysAhead(2) });
  await put({ pausedFrom: '', pausedTo: '' });
  d = await dash(k);
  assert.strictEqual(d.paused, false);
  assert.strictEqual(d.khatma.paused_to, null);
});

test('update: a pause entirely in the past or future is not "paused"', async () => {
  const k = await createKhatma();
  await call('PUT', `/khatma/${k.id}`, { body: { pausedFrom: daysAgo(30), pausedTo: daysAgo(20) }, headers: adminH(k) });
  assert.strictEqual((await dash(k)).paused, false);
  await call('PUT', `/khatma/${k.id}`, { body: { pausedFrom: daysAhead(10), pausedTo: daysAhead(20) }, headers: adminH(k) });
  assert.strictEqual((await dash(k)).paused, false);
});

test('update: changing rotation resets custom_days; custom without days gets 7', async () => {
  const k = await createKhatma({ rotationType: 'custom', customDays: 12 });
  const put = body => call('PUT', `/khatma/${k.id}`, { body, headers: adminH(k) });
  assert.strictEqual((await dash(k)).khatma.custom_days, 12);
  await put({ rotationType: 'weekly' });
  assert.strictEqual((await dash(k)).khatma.custom_days, null);
  await put({ rotationType: 'custom' });
  assert.strictEqual((await dash(k)).khatma.custom_days, 7);
  await put({ rotationType: 'custom', customDays: 3 });
  assert.strictEqual((await dash(k)).khatma.custom_days, 3);
});

// ---------------------------------------------------------------- GET dashboard
test('dashboard: needs code (401), right code (403), valid id (400)', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('GET', `/khatma/${k.id}/dashboard`)).status, 401);
  assert.strictEqual((await call('GET', `/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': 'bad' } })).status, 403);
  assert.strictEqual((await call('GET', '/khatma/zzz/dashboard', { headers: codeH(k) })).status, 400);
});

test('dashboard: never exposes the admin password or participant tokens', async () => {
  const k = await createKhatma();
  const p = (await addP(k, 'أ', 1)).data.participant;
  await call('POST', `/khatma/${k.id}/participants/${p._id}/claim`, { headers: codeH(k) });
  const res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: codeH(k) });
  const s = JSON.stringify(res.data);
  assert.ok(!s.includes('admin_password') && !s.includes('secret-pass') && !s.includes('"token"'));
});

test('dashboard: juz is the slot in cycle 1 and rotates by one each cycle', async () => {
  const k = await createKhatma({ startDate: daysAgo(17) }); // 2 full weekly cycles passed
  await addP(k, 'أ', 1);
  await addP(k, 'ب', 10);
  await addP(k, 'ج', 30);
  const d = await dash(k);
  assert.strictEqual(d.cycleNumber, 3);
  assert.deepStrictEqual(d.participants.map(p => p.currentJuz), [3, 12, 2]);
});

test('dashboard: before any cycle completes, juz equals the slot', async () => {
  const k = await createKhatma({ startDate: daysAgo(2) });
  await addP(k, 'أ', 4);
  const d = await dash(k);
  assert.strictEqual(d.cycleNumber, 1);
  assert.strictEqual(d.participants[0].currentJuz, 4);
});

test('dashboard: future start date stays in cycle 1', async () => {
  const k = await createKhatma({ startDate: daysAhead(20) });
  await addP(k, 'أ', 4);
  const d = await dash(k);
  assert.strictEqual(d.cycleNumber, 1);
  assert.strictEqual(d.participants[0].currentJuz, 4);
});

test('dashboard: juz wraps 30 -> 1 and 1 -> 30 across a full lap of 30 cycles', async () => {
  const at29 = await createKhatma({ startDate: daysAgo(7 * 29 + 3) });
  await addP(at29, 'أ', 1);
  await addP(at29, 'ب', 2);
  await addP(at29, 'ج', 30);
  assert.deepStrictEqual((await dash(at29)).participants.map(p => p.currentJuz), [30, 1, 29]);

  const at30 = await createKhatma({ startDate: daysAgo(7 * 30 + 3) });
  await addP(at30, 'أ', 1);
  await addP(at30, 'ج', 30);
  const d = await dash(at30);
  assert.strictEqual(d.cycleNumber, 31);
  assert.deepStrictEqual(d.participants.map(p => p.currentJuz), [1, 30]);
});

test('dashboard: a quick khatma shows each person their picked slot', async () => {
  const k = await createKhatma({ isQuick: true, startDate: daysAgo(0) });
  const j = await call('POST', `/khatma/${k.id}/join`, { body: { name: 'علي', slotNumber: 17 }, headers: codeH(k) });
  assert.strictEqual(j.status, 201);
  const d = await dash(k);
  assert.strictEqual(d.participants[0].currentJuz, 17);
  assert.strictEqual(d.nextChangeDate, null);
});

test('dashboard: participants are sorted by slot', async () => {
  const k = await createKhatma();
  await addP(k, 'ج', 9);
  await addP(k, 'أ', 2);
  await addP(k, 'ب', 5);
  assert.deepStrictEqual((await dash(k)).participants.map(p => p.slot_number), [2, 5, 9]);
});

test('dashboard: paused flag and cycle counting across a pause', async () => {
  const k = await createKhatma({ startDate: daysAgo(24) }); // 3 cycles would have passed
  await addP(k, 'أ', 1);
  await call('PUT', `/khatma/${k.id}`, { body: { pausedFrom: daysAgo(10), pausedTo: daysAhead(2) }, headers: adminH(k) });
  const d = await dash(k);
  assert.strictEqual(d.paused, true);
  assert.strictEqual(d.nextChangeDate, null);
  // pause covers now-10 .. now (clamped) = 10 days = 1 whole weekly cycle skipped: 3 - 1 = 2
  assert.strictEqual(d.cycleNumber, 3);
  assert.strictEqual(d.participants[0].currentJuz, 3);
});

test('dashboard: dedication round-robins through the deceased by cycle', async () => {
  const k = await createKhatma({ startDate: daysAgo(10) }); // cycle index 1
  const farMonth = n => { const d = new Date(); d.setMonth(d.getMonth() + n); return `2010-${String(d.getMonth() + 1).padStart(2, '0')}-15`; };
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'الأول', deathDate: farMonth(4) }, headers: adminH(k) });
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'الثاني', deathDate: farMonth(8) }, headers: adminH(k) });
  const d = await dash(k);
  assert.strictEqual(d.dedication.hasAnniversary, false);
  assert.strictEqual(d.dedication.dedicated.length, 1);
  assert.strictEqual(d.dedication.dedicated[0]._id, d.deceased[1]._id);
});

test('dashboard: dedication with one deceased always names them; none gives null', async () => {
  const k = await createKhatma({ startDate: daysAgo(40) });
  assert.strictEqual((await dash(k)).dedication, null);
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'الوحيد', deathDate: '2010-01-01' }, headers: adminH(k) });
  const d = await dash(k);
  assert.strictEqual(d.dedication.dedicated[0].name, 'الوحيد');
});

test('dashboard: anniversary adds the person whose death date falls in this window', async () => {
  const k = await createKhatma({ startDate: daysAgo(1) }); // cycle index 0 -> round robin picks the first by date
  const t = new Date();
  const pad = n => String(n).padStart(2, '0');
  const today = `2015-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  const early = '2000-01-01';
  const late = '2030-12-31';
  // keep early/late away from today's window
  const farFromToday = [early, late].every(s => Math.abs((new Date(s).getMonth() * 31 + new Date(s).getDate()) - (t.getMonth() * 31 + t.getDate())) > 5);
  if (!farFromToday) return; // only on the few days of the year around 1 Jan / 31 Dec
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'الأول', deathDate: early }, headers: adminH(k) });
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'صاحب الذكرى', deathDate: today }, headers: adminH(k) });
  const d = await dash(k);
  assert.strictEqual(d.dedication.hasAnniversary, true);
  assert.deepStrictEqual(d.dedication.dedicated.map(x => x.name).sort(), ['الأول', 'صاحب الذكرى'].sort());
  assert.deepStrictEqual(d.dedication.anniversaryPeople.map(x => x.name), ['صاحب الذكرى']);
});

test('dashboard: nextChangeDate for weekly, biweekly, monthly, custom; null for daily', async () => {
  const cases = [
    [{ rotationType: 'weekly', startDate: daysAgo(10) }, daysAhead(4)],
    [{ rotationType: 'biweekly', startDate: daysAgo(20) }, daysAhead(8)],
    [{ rotationType: 'monthly', startDate: daysAgo(40) }, daysAhead(20)],
    [{ rotationType: 'custom', customDays: 10, startDate: daysAgo(25) }, daysAhead(5)],
    [{ rotationType: 'weekly', startDate: daysAhead(5) }, daysAhead(12)],
    [{ rotationType: 'daily', startDate: daysAgo(5) }, null]
  ];
  for (const [overrides, expected] of cases) {
    const k = await createKhatma(overrides);
    assert.strictEqual((await dash(k)).nextChangeDate, expected, JSON.stringify(overrides));
  }
});

test('dashboard: rotation label for each type', async () => {
  const expected = { daily: 'يومياً', weekly: 'أسبوعياً', biweekly: 'كل أسبوعين', monthly: 'شهرياً' };
  for (const [type, label] of Object.entries(expected)) {
    const k = await createKhatma({ rotationType: type });
    assert.strictEqual((await dash(k)).rotationLabel, label);
  }
});

// ---------------------------------------------------------------- history & stats
async function cycleSetup() {
  // 17 days ago weekly -> 3 cycles so far (current is #3)
  const k = await createKhatma({ startDate: daysAgo(17), khatmaNumber: 5 });
  const ids = [];
  for (const [i, name] of ['أ', 'ب', 'ج'].entries()) ids.push((await addP(k, name, i + 1)).data.participant._id);
  const mark = (pid, cycle) => Completion.create({ khatma_id: k.id, participant_id: pid, cycle_number: cycle });
  return { k, ids, mark };
}

test('history/stats: auth and invalid id', async () => {
  const k = await createKhatma();
  for (const path of ['history', 'stats']) {
    assert.strictEqual((await call('GET', `/khatma/${k.id}/${path}`)).status, 401, path);
    assert.strictEqual((await call('GET', `/khatma/${k.id}/${path}`, { headers: { 'x-khatma-code': 'bad' } })).status, 403, path);
    assert.strictEqual((await call('GET', `/khatma/bad/${path}`, { headers: codeH(k) })).status, 400, path);
  }
});

test('history: newest first, with per-cycle juz, completion flags, counts and khatma numbers', async () => {
  const { k, ids, mark } = await cycleSetup();
  for (const id of ids) await mark(id, 1);
  await mark(ids[0], 2);
  await mark(ids[0], 3);
  await mark(ids[1], 3);
  const res = await call('GET', `/khatma/${k.id}/history`, { headers: codeH(k) });
  assert.strictEqual(res.status, 200);
  const h = res.data.history;
  assert.deepStrictEqual(h.map(c => c.cycle), [3, 2, 1]);
  assert.deepStrictEqual(h.map(c => c.khatmaNumber), [7, 6, 5]);
  assert.deepStrictEqual(h.map(c => c.completedCount), [2, 1, 3]);
  assert.deepStrictEqual(h.map(c => c.allCompleted), [false, false, true]);
  assert.ok(h.every(c => c.totalParticipants === 3));
  // participant with slot 1 reads juz 3 in cycle 3
  assert.deepStrictEqual(h[0].participants.map(p => p.juz), [3, 4, 5]);
  assert.deepStrictEqual(h[0].participants.map(p => p.completed), [true, true, false]);
  assert.deepStrictEqual(h[2].participants.map(p => p.juz), [1, 2, 3]);
  assert.deepStrictEqual(h[1].dedication, []);
});

test('history: dedication names appear per cycle', async () => {
  const { k } = await cycleSetup();
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'المرحوم', deathDate: '2010-01-01' }, headers: adminH(k) });
  const h = (await call('GET', `/khatma/${k.id}/history`, { headers: codeH(k) })).data.history;
  assert.ok(h.every(c => c.dedication.includes('المرحوم')));
});

test('history: a khatma with no participants never counts a cycle as complete', async () => {
  const k = await createKhatma({ startDate: daysAgo(10) });
  const h = (await call('GET', `/khatma/${k.id}/history`, { headers: codeH(k) })).data.history;
  assert.strictEqual(h.length, 2);
  assert.ok(h.every(c => c.allCompleted === false && c.totalParticipants === 0));
});

test('history: completions belonging to another khatma are not counted', async () => {
  const { k, ids } = await cycleSetup();
  const other = await createKhatma({ startDate: daysAgo(17) });
  const op = (await addP(other, 'غريب', 1)).data.participant._id;
  await Completion.create({ khatma_id: other.id, participant_id: op, cycle_number: 1 });
  await Completion.create({ khatma_id: k.id, participant_id: ids[0], cycle_number: 1 });
  const h = (await call('GET', `/khatma/${k.id}/history`, { headers: codeH(k) })).data.history;
  assert.strictEqual(h[2].completedCount, 1);
});

test('stats: counts, completed khatmas, streak and per-person rates across cycles', async () => {
  const { k, ids, mark } = await cycleSetup();
  for (const id of ids) await mark(id, 1); // cycle 1 complete
  await mark(ids[0], 2); // cycle 2 partial
  for (const id of ids) await mark(id, 3); // cycle 3 (current) complete
  const res = await call('GET', `/khatma/${k.id}/stats`, { headers: codeH(k) });
  assert.strictEqual(res.status, 200);
  const s = res.data;
  assert.strictEqual(s.totalCycles, 3);
  assert.strictEqual(s.totalParticipants, 3);
  assert.strictEqual(s.completedKhatmas, 2);
  assert.strictEqual(s.streak, 1);
  assert.deepStrictEqual(s.participantStats.map(p => p.completedCycles), [3, 2, 2]);
  assert.deepStrictEqual(s.participantStats.map(p => p.rate), [100, 67, 67]);
  assert.ok(s.participantStats.every(p => p.totalCycles === 3));
});

test('stats: streak counts consecutive complete cycles back from the current one', async () => {
  const { k, ids, mark } = await cycleSetup();
  for (const c of [2, 3]) for (const id of ids) await mark(id, c);
  const s = (await call('GET', `/khatma/${k.id}/stats`, { headers: codeH(k) })).data;
  assert.strictEqual(s.streak, 2);
  assert.strictEqual(s.completedKhatmas, 2);
});

test('stats: streak is 0 when the current cycle is not complete; empty khatma is all zero', async () => {
  const { k, ids, mark } = await cycleSetup();
  for (const c of [1, 2]) for (const id of ids) await mark(id, c);
  let s = (await call('GET', `/khatma/${k.id}/stats`, { headers: codeH(k) })).data;
  assert.strictEqual(s.streak, 0);
  assert.strictEqual(s.completedKhatmas, 2);

  const e = await createKhatma({ startDate: daysAgo(10) });
  s = (await call('GET', `/khatma/${e.id}/stats`, { headers: codeH(e) })).data;
  assert.deepStrictEqual([s.completedKhatmas, s.streak, s.totalParticipants, s.participantStats.length], [0, 0, 0, 0]);
  assert.strictEqual(s.totalCycles, 2);
});

test('stats: new khatma (cycle 1) rate is 0 or 100', async () => {
  const k = await createKhatma({ startDate: daysAgo(0) });
  const pid = (await addP(k, 'أ', 1)).data.participant._id;
  let s = (await call('GET', `/khatma/${k.id}/stats`, { headers: codeH(k) })).data;
  assert.strictEqual(s.participantStats[0].rate, 0);
  await Completion.create({ khatma_id: k.id, participant_id: pid, cycle_number: 1 });
  s = (await call('GET', `/khatma/${k.id}/stats`, { headers: codeH(k) })).data;
  assert.strictEqual(s.participantStats[0].rate, 100);
  assert.strictEqual(s.completedKhatmas, 1);
  assert.strictEqual(s.streak, 1);
});

// ---------------------------------------------------------------- duplicate
const dupBody = () => ({ newAccessCode: 'dup' + Math.random().toString(36).slice(2, 9), newAdminPassword: 'newpw' });

test('duplicate: regular copies settings, participants and deceased, not completions or tokens', async () => {
  const k = await createKhatma({ name: 'الأسرة', rotationType: 'custom', customDays: 5, khatmaNumber: 4, useHijri: true, organizerPhone: '97336123456' });
  const pid = (await addP(k, 'أ', 1)).data.participant._id;
  await addP(k, 'ب', 2);
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'فلان', deathDate: '2020-02-02' }, headers: adminH(k) });
  await call('POST', `/khatma/${k.id}/participants/${pid}/claim`, { headers: codeH(k) });
  await Completion.create({ khatma_id: k.id, participant_id: pid, cycle_number: 1 });

  const body = dupBody();
  const res = await call('POST', `/khatma/${k.id}/duplicate`, { body, headers: adminH(k) });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.accessCode, body.newAccessCode);
  const copy = { id: res.data.id, code: body.newAccessCode, password: body.newAdminPassword };
  const d = await dash(copy);
  assert.strictEqual(d.khatma.name, 'الأسرة (نسخة)');
  assert.strictEqual(d.khatma.rotation_type, 'custom');
  assert.strictEqual(d.khatma.custom_days, 5);
  assert.strictEqual(d.khatma.khatma_number, 4);
  assert.strictEqual(d.khatma.use_hijri, true);
  assert.strictEqual(d.khatma.organizer_phone, '97336123456');
  assert.strictEqual(d.khatma.is_quick, false);
  assert.strictEqual(d.khatma.start_date, new Date().toISOString().split('T')[0]);
  assert.deepStrictEqual(d.participants.map(p => [p.name, p.slot_number]), [['أ', 1], ['ب', 2]]);
  assert.strictEqual(d.deceased.length, 1);
  assert.strictEqual(d.deceased[0].name, 'فلان');
  assert.strictEqual(await Completion.countDocuments({ khatma_id: copy.id }), 0);
  const copied = await Participant.find({ khatma_id: copy.id }).select('+token');
  assert.ok(copied.every(p => !p.token));
  // The new admin password works, the old one does not
  assert.strictEqual((await call('PUT', `/khatma/${copy.id}`, { body: { name: 'x' }, headers: adminH(copy) })).status, 200);
  assert.strictEqual((await call('PUT', `/khatma/${copy.id}`, { body: { name: 'x' }, headers: adminH(k) })).status, 403);
  // the original is untouched
  assert.strictEqual((await dash(k)).participants.length, 2);
});

test('duplicate: quick copies mode and phone but not participants (deceased still copied)', async () => {
  const k = await createKhatma({ isQuick: true, organizerPhone: '97336123456' });
  await call('POST', `/khatma/${k.id}/join`, { body: { name: 'علي', slotNumber: 3 }, headers: codeH(k) });
  const body = dupBody();
  const res = await call('POST', `/khatma/${k.id}/duplicate`, { body, headers: adminH(k) });
  assert.strictEqual(res.status, 201);
  const d = await dash({ id: res.data.id, code: body.newAccessCode });
  assert.strictEqual(d.khatma.is_quick, true);
  assert.strictEqual(d.khatma.organizer_phone, '97336123456');
  assert.strictEqual(d.participants.length, 0);
});

test('duplicate: existing code is 409, missing/non-string fields 400, auth enforced', async () => {
  const k = await createKhatma();
  const other = await createKhatma();
  assert.strictEqual((await call('POST', `/khatma/${k.id}/duplicate`, { body: { newAccessCode: other.code, newAdminPassword: 'p' }, headers: adminH(k) })).status, 409);
  assert.strictEqual((await call('POST', `/khatma/${k.id}/duplicate`, { body: { newAccessCode: k.code, newAdminPassword: 'p' }, headers: adminH(k) })).status, 409);
  for (const body of [{}, { newAccessCode: 'x' }, { newAdminPassword: 'x' }, { newAccessCode: 1, newAdminPassword: 'x' }]) {
    assert.strictEqual((await call('POST', `/khatma/${k.id}/duplicate`, { body, headers: adminH(k) })).status, 400, JSON.stringify(body));
  }
  assert.strictEqual((await call('POST', `/khatma/${k.id}/duplicate`, { body: dupBody() })).status, 401);
  assert.strictEqual((await call('POST', `/khatma/${k.id}/duplicate`, { body: dupBody(), headers: { 'x-admin-password': 'bad' } })).status, 403);
  assert.strictEqual((await call('POST', '/khatma/nope/duplicate', { body: dupBody(), headers: adminH(k) })).status, 400);
});

// ---------------------------------------------------------------- delete
test('delete: removes khatma, participants, deceased and completions; others untouched', async () => {
  const k = await createKhatma({ adminPassword: 'pw-delete-me' });
  const other = await createKhatma({ adminPassword: 'pw-keep-me' });
  const pid = (await addP(k, 'أ', 1)).data.participant._id;
  const opid = (await addP(other, 'ب', 1)).data.participant._id;
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'ف', deathDate: '2020-01-01' }, headers: adminH(k) });
  await call('POST', `/khatma/${other.id}/deceased`, { body: { name: 'ص', deathDate: '2020-01-01' }, headers: adminH(other) });
  await Completion.create({ khatma_id: k.id, participant_id: pid, cycle_number: 1 });
  await Completion.create({ khatma_id: other.id, participant_id: opid, cycle_number: 1 });

  const res = await call('DELETE', `/khatma/${k.id}`, { headers: adminH(k) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await Khatma.countDocuments({ _id: k.id }), 0);
  assert.strictEqual(await Participant.countDocuments({ khatma_id: k.id }), 0);
  assert.strictEqual(await Deceased.countDocuments({ khatma_id: k.id }), 0);
  assert.strictEqual(await Completion.countDocuments({ khatma_id: k.id }), 0);
  assert.strictEqual((await call('POST', '/khatma/access', { body: { code: k.code } })).status, 404);

  assert.strictEqual(await Khatma.countDocuments({ _id: other.id }), 1);
  assert.strictEqual(await Participant.countDocuments({ khatma_id: other.id }), 1);
  assert.strictEqual(await Deceased.countDocuments({ khatma_id: other.id }), 1);
  assert.strictEqual(await Completion.countDocuments({ khatma_id: other.id }), 1);
});

test('delete: auth is enforced and a failed attempt deletes nothing', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('DELETE', `/khatma/${k.id}`)).status, 401);
  assert.strictEqual((await call('DELETE', `/khatma/${k.id}`, { headers: { 'x-admin-password': 'bad' } })).status, 403);
  assert.strictEqual((await call('DELETE', `/khatma/${k.id}`, { headers: codeH(k) })).status, 401);
  assert.strictEqual((await call('DELETE', '/khatma/nope', { headers: adminH(k) })).status, 400);
  assert.strictEqual(await Khatma.countDocuments({ _id: k.id }), 1);
});

test('delete: deleting twice gives 403 the second time (khatma gone)', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('DELETE', `/khatma/${k.id}`, { headers: adminH(k) })).status, 200);
  assert.strictEqual((await call('DELETE', `/khatma/${k.id}`, { headers: adminH(k) })).status, 403);
});

// ---------------------------------------------------------------- join (quick)
test('join: only quick khatmas, slot 1-30, name required, taken slot 409, token returned', async () => {
  const regular = await createKhatma();
  assert.strictEqual((await call('POST', `/khatma/${regular.id}/join`, { body: { name: 'أ', slotNumber: 1 }, headers: codeH(regular) })).status, 403);

  const q = await createKhatma({ isQuick: true });
  const join = body => call('POST', `/khatma/${q.id}/join`, { body, headers: codeH(q) });
  const ok = await join({ name: 'أ', slotNumber: 1 });
  assert.strictEqual(ok.status, 201);
  assert.match(ok.data.token, /^[0-9a-f]{48}$/);
  assert.ok(!('token' in ok.data.participant));
  assert.strictEqual((await join({ name: 'ب', slotNumber: 1 })).status, 409);
  for (const body of [{ slotNumber: 2 }, { name: 'ب' }, { name: 'ب', slotNumber: 0 }, { name: 'ب', slotNumber: 31 }, { name: 'ب', slotNumber: 'abc' }, { name: { $ne: 1 }, slotNumber: 2 }, { name: 'ب', slotNumber: 2.5 }]) {
    assert.strictEqual((await join(body)).status, 400, JSON.stringify(body));
  }
  assert.strictEqual((await call('POST', `/khatma/${q.id}/join`, { body: { name: 'ب', slotNumber: 2 } })).status, 401);
  // the token really proves ownership
  const mark = await call('POST', `/khatma/${q.id}/completions`, { body: { participantId: ok.data.participant._id, cycleNumber: 1 }, headers: { ...codeH(q), 'x-participant-token': ok.data.token } });
  assert.strictEqual(mark.status, 200);
});
