const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');
const { codeH, adminH } = require('./util');
const Participant = require('../models/Participant');

test.before(start);
test.after(stop);

const base = k => `/khatma/${k.id}/participants`;
const add = (k, name, slotNumber) => call('POST', base(k), { body: { name, slotNumber }, headers: adminH(k) });
const list = async k => (await call('GET', base(k), { headers: codeH(k) })).data;
const slots = async k => Object.fromEntries((await list(k)).map(p => [p.name, p.slot_number]));

test('list: requires the code, returns sorted participants without tokens', async () => {
  const k = await createKhatma();
  await add(k, 'ج', 9);
  const b = (await add(k, 'أ', 3)).data.participant;
  await call('POST', `${base(k)}/${b._id}/claim`, { headers: codeH(k) });
  assert.strictEqual((await call('GET', base(k))).status, 401);
  assert.strictEqual((await call('GET', base(k), { headers: { 'x-khatma-code': 'bad' } })).status, 403);
  assert.strictEqual((await call('GET', '/khatma/zzz/participants', { headers: codeH(k) })).status, 400);
  const res = await call('GET', base(k), { headers: codeH(k) });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.data.map(p => p.slot_number), [3, 9]);
  assert.ok(!JSON.stringify(res.data).includes('token'));
});

test('list: an empty khatma gives an empty array', async () => {
  const k = await createKhatma();
  assert.deepStrictEqual(await list(k), []);
});

test('list: does not leak participants of another khatma', async () => {
  const a = await createKhatma();
  const b = await createKhatma();
  await add(a, 'من أ', 1);
  await add(b, 'من ب', 1);
  assert.deepStrictEqual((await list(a)).map(p => p.name), ['من أ']);
});

test('add: admin only', async () => {
  const k = await createKhatma();
  const body = { name: 'أ', slotNumber: 1 };
  assert.strictEqual((await call('POST', base(k), { body })).status, 401);
  assert.strictEqual((await call('POST', base(k), { body, headers: codeH(k) })).status, 401);
  assert.strictEqual((await call('POST', base(k), { body, headers: { 'x-admin-password': 'bad' } })).status, 403);
  assert.strictEqual((await list(k)).length, 0);
});

test('add: valid slot 1 and 30 succeed and return the participant without a token', async () => {
  const k = await createKhatma();
  const a = await add(k, 'أول', 1);
  const z = await add(k, 'آخر', 30);
  assert.strictEqual(a.status, 201);
  assert.strictEqual(z.status, 201);
  assert.strictEqual(a.data.participant.name, 'أول');
  assert.strictEqual(a.data.participant.slot_number, 1);
  assert.ok(!a.data.participant.token);
});

test('add: slot outside 1-30, fractional, non-numeric, or missing is 400', async () => {
  const k = await createKhatma();
  for (const slotNumber of [0, -1, 31, 100, 1.5, 'abc', null, undefined, { $gt: 0 }, [1]]) {
    const res = await add(k, 'x', slotNumber);
    assert.strictEqual(res.status, 400, JSON.stringify(slotNumber));
  }
  assert.strictEqual((await list(k)).length, 0);
});

test('add: missing, empty or non-string name is 400', async () => {
  const k = await createKhatma();
  for (const name of [undefined, '', null, 5, { $ne: '' }, ['a']]) {
    const res = await add(k, name, 1);
    assert.strictEqual(res.status, 400, JSON.stringify(name));
  }
});

test('add: duplicate slot is 409 and the original is kept', async () => {
  const k = await createKhatma();
  await add(k, 'الأصل', 5);
  const res = await add(k, 'المكرر', 5);
  assert.strictEqual(res.status, 409);
  assert.deepStrictEqual(await slots(k), { 'الأصل': 5 });
});

test('add: the same slot may be used in different khatmas', async () => {
  const a = await createKhatma();
  const b = await createKhatma();
  assert.strictEqual((await add(a, 'x', 1)).status, 201);
  assert.strictEqual((await add(b, 'y', 1)).status, 201);
});

test('update: renames; slot is unchanged; extra fields ignored', async () => {
  const k = await createKhatma();
  const p = (await add(k, 'قديم', 4)).data.participant;
  const res = await call('PUT', `${base(k)}/${p._id}`, { body: { name: 'جديد', slot_number: 9 }, headers: adminH(k) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.participant.name, 'جديد');
  assert.deepStrictEqual(await slots(k), { 'جديد': 4 });
});

test('update: missing name 400, unknown id 404, malformed id 404, other khatma 404, auth', async () => {
  const k = await createKhatma();
  const other = await createKhatma();
  const p = (await add(k, 'أ', 1)).data.participant;
  const op = (await add(other, 'ب', 1)).data.participant;
  const put = (id, body, headers = adminH(k)) => call('PUT', `${base(k)}/${id}`, { body, headers });
  assert.strictEqual((await put(p._id, {})).status, 400);
  assert.strictEqual((await put(p._id, { name: { $ne: 1 } })).status, 400);
  assert.strictEqual((await put('000000000000000000000000', { name: 'x' })).status, 404);
  assert.strictEqual((await put('not-an-id', { name: 'x' })).status, 404);
  assert.strictEqual((await put(op._id, { name: 'اختراق' })).status, 404);
  assert.strictEqual((await put(p._id, { name: 'x' }, {})).status, 401);
  assert.strictEqual((await put(p._id, { name: 'x' }, { 'x-admin-password': 'bad' })).status, 403);
  assert.strictEqual((await list(other))[0].name, 'ب');
});

test('swap: exchanges slots, in both directions', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  const b = (await add(k, 'ب', 2)).data.participant;
  const swap = (from, to) => call('PUT', `${base(k)}/${from._id}/swap`, { body: { targetPid: to._id }, headers: adminH(k) });
  assert.strictEqual((await swap(a, b)).status, 200);
  assert.deepStrictEqual(await slots(k), { 'أ': 2, 'ب': 1 });
  assert.strictEqual((await swap(a, b)).status, 200);
  assert.deepStrictEqual(await slots(k), { 'أ': 1, 'ب': 2 });
  assert.strictEqual((await swap(b, a)).status, 200);
  assert.deepStrictEqual(await slots(k), { 'أ': 2, 'ب': 1 });
});

test('swap: non-adjacent slots swap and nothing else moves; no temp slot is left behind', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  await add(k, 'ب', 2);
  const c = (await add(k, 'ج', 30)).data.participant;
  await call('PUT', `${base(k)}/${a._id}/swap`, { body: { targetPid: c._id }, headers: adminH(k) });
  assert.deepStrictEqual(await slots(k), { 'أ': 30, 'ب': 2, 'ج': 1 });
});

test('swap: with itself changes nothing', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 7)).data.participant;
  const res = await call('PUT', `${base(k)}/${a._id}/swap`, { body: { targetPid: a._id }, headers: adminH(k) });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await slots(k), { 'أ': 7 });
});

test('swap: missing target 400, unknown or malformed ids 404, auth enforced', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  const swap = (pid, body, headers = adminH(k)) => call('PUT', `${base(k)}/${pid}/swap`, { body, headers });
  assert.strictEqual((await swap(a._id, {})).status, 400);
  assert.strictEqual((await swap(a._id, { targetPid: '000000000000000000000000' })).status, 404);
  assert.strictEqual((await swap('000000000000000000000000', { targetPid: a._id })).status, 404);
  assert.strictEqual((await swap(a._id, { targetPid: 'garbage' })).status, 404);
  assert.strictEqual((await swap('garbage', { targetPid: a._id })).status, 404);
  assert.strictEqual((await swap(a._id, { targetPid: a._id }, {})).status, 401);
  assert.strictEqual((await swap(a._id, { targetPid: a._id }, { 'x-admin-password': 'bad' })).status, 403);
});

test('swap: a participant from another khatma is rejected and nothing changes', async () => {
  const k = await createKhatma({ adminPassword: 'pw-k' });
  const other = await createKhatma({ adminPassword: 'pw-other' });
  const a = (await add(k, 'أ', 1)).data.participant;
  const o = (await add(other, 'غريب', 2)).data.participant;
  const res = await call('PUT', `${base(k)}/${a._id}/swap`, { body: { targetPid: o._id }, headers: adminH(k) });
  assert.strictEqual(res.status, 404);
  const res2 = await call('PUT', `${base(k)}/${o._id}/swap`, { body: { targetPid: a._id }, headers: adminH(k) });
  assert.strictEqual(res2.status, 404);
  assert.deepStrictEqual(await slots(k), { 'أ': 1 });
  assert.deepStrictEqual(await slots(other), { 'غريب': 2 });
});

test('delete: removes the participant; unknown, malformed and cross-khatma ids are 404', async () => {
  const k = await createKhatma();
  const other = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  const o = (await add(other, 'ب', 1)).data.participant;
  const del = (id, headers = adminH(k)) => call('DELETE', `${base(k)}/${id}`, { headers });
  assert.strictEqual((await del(a._id, {})).status, 401);
  assert.strictEqual((await del(a._id, { 'x-admin-password': 'bad' })).status, 403);
  assert.strictEqual((await del('000000000000000000000000')).status, 404);
  assert.strictEqual((await del('garbage')).status, 404);
  assert.strictEqual((await del(o._id)).status, 404);
  assert.strictEqual((await list(other)).length, 1);
  assert.strictEqual((await del(a._id)).status, 200);
  assert.strictEqual((await list(k)).length, 0);
  assert.strictEqual((await del(a._id)).status, 404);
});

test('delete: frees the slot for a new participant', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  await call('DELETE', `${base(k)}/${a._id}`, { headers: adminH(k) });
  assert.strictEqual((await add(k, 'جديد', 1)).status, 201);
});

// ---- claim
test('claim: needs the khatma code; participant of another khatma is 404; malformed id 404', async () => {
  const k = await createKhatma();
  const other = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  const o = (await add(other, 'ب', 1)).data.participant;
  assert.strictEqual((await call('POST', `${base(k)}/${a._id}/claim`)).status, 401);
  assert.strictEqual((await call('POST', `${base(k)}/${a._id}/claim`, { headers: { 'x-khatma-code': 'bad' } })).status, 403);
  assert.strictEqual((await call('POST', `${base(k)}/${o._id}/claim`, { headers: codeH(k) })).status, 404);
  assert.strictEqual((await call('POST', `${base(k)}/nope/claim`, { headers: codeH(k) })).status, 404);
  // nothing leaked onto the other khatma's participant
  const stored = await Participant.findById(o._id).select('+token');
  assert.strictEqual(stored.token, null);
});

test('claim: token is stable across calls and distinct between participants', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  const b = (await add(k, 'ب', 2)).data.participant;
  const claim = p => call('POST', `${base(k)}/${p._id}/claim`, { headers: codeH(k) });
  const [t1, t2, tb] = [(await claim(a)).data.token, (await claim(a)).data.token, (await claim(b)).data.token];
  assert.strictEqual(t1, t2);
  assert.notStrictEqual(t1, tb);
  assert.strictEqual((await claim(a)).data.participantId, a._id);
});

test('claim: concurrent claims all receive the same token', async () => {
  const k = await createKhatma();
  const a = (await add(k, 'أ', 1)).data.participant;
  const results = await Promise.all(Array.from({ length: 8 }, () => call('POST', `${base(k)}/${a._id}/claim`, { headers: codeH(k) })));
  assert.ok(results.every(r => r.status === 200));
  assert.strictEqual(new Set(results.map(r => r.data.token)).size, 1);
});
