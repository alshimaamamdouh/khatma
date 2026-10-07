const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');
const { codeH, adminH } = require('./util');
const Completion = require('../models/Completion');

test.before(start);
test.after(stop);

async function setup(extra = {}) {
  const k = await createKhatma(extra);
  const add = async (name, slot) => (await call('POST', `/khatma/${k.id}/participants`, { body: { name, slotNumber: slot }, headers: adminH(k) })).data.participant;
  const a = await add('أ', 1);
  const b = await add('ب', 2);
  const claim = async p => (await call('POST', `/khatma/${k.id}/participants/${p._id}/claim`, { headers: codeH(k) })).data.token;
  return { k, a, b, claim };
}
const path = k => `/khatma/${k.id}/completions`;
const mark = (k, pid, cycleNumber, headers) => call('POST', path(k), { body: { participantId: pid, cycleNumber }, headers: { ...codeH(k), ...headers } });
const undo = (k, pid, cycleNumber, headers) => call('DELETE', path(k), { body: { participantId: pid, cycleNumber }, headers: { ...codeH(k), ...headers } });
const get = (k, cycle) => call('GET', `${path(k)}/${cycle}`, { headers: codeH(k) });

test('all completion routes need the khatma code', async () => {
  const { k, a } = await setup();
  assert.strictEqual((await call('POST', path(k), { body: { participantId: a._id, cycleNumber: 1 } })).status, 401);
  assert.strictEqual((await call('DELETE', path(k), { body: { participantId: a._id, cycleNumber: 1 } })).status, 401);
  assert.strictEqual((await call('GET', `${path(k)}/1`)).status, 401);
  assert.strictEqual((await call('GET', `${path(k)}/1`, { headers: { 'x-khatma-code': 'bad' } })).status, 403);
  assert.strictEqual((await call('GET', '/khatma/zzz/completions/1', { headers: codeH(k) })).status, 400);
});

test('GET for a cycle with no completions: zeros and allCompleted false', async () => {
  const { k } = await setup();
  const res = await get(k, 99);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.data, { completedIds: [], completedCount: 0, totalParticipants: 2, allCompleted: false });
});

test('GET for a khatma with no participants is "allCompleted" vacuously, with zero counts', async () => {
  const k = await createKhatma();
  const res = await get(k, 1);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.totalParticipants, 0);
  assert.strictEqual(res.data.completedCount, 0);
});

test('GET with a non-numeric cycle is 400', async () => {
  const { k } = await setup();
  for (const c of ['abc', '1.5', 'NaN', 'Infinity']) assert.strictEqual((await get(k, c)).status, 400, c);
});

test('GET with a malformed percent-encoded cycle does not crash', async () => {
  const { k } = await setup();
  const res = await get(k, '%E0%A4%A');
  assert.strictEqual(res.status, 400);
});

test('organizer can mark and undo anyone; the count and allCompleted follow', async () => {
  const { k, a, b } = await setup();
  const admin = adminH(k);
  let res = await mark(k, a._id, 1, admin);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual([res.data.completedCount, res.data.totalParticipants, res.data.allCompleted], [1, 2, false]);
  res = await mark(k, b._id, 1, admin);
  assert.strictEqual(res.data.allCompleted, true);
  assert.deepStrictEqual((await get(k, 1)).data.completedIds.sort(), [a._id, b._id].sort());
  res = await undo(k, a._id, 1, admin);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await get(k, 1)).data.completedCount, 1);
  assert.strictEqual((await get(k, 1)).data.allCompleted, false);
});

test('marking and undoing are idempotent', async () => {
  const { k, a } = await setup();
  const admin = adminH(k);
  for (let i = 0; i < 3; i++) assert.strictEqual((await mark(k, a._id, 1, admin)).status, 200);
  assert.strictEqual(await Completion.countDocuments({ khatma_id: k.id }), 1);
  for (let i = 0; i < 3; i++) assert.strictEqual((await undo(k, a._id, 1, admin)).status, 200);
  assert.strictEqual(await Completion.countDocuments({ khatma_id: k.id }), 0);
});

test('concurrent identical marks create exactly one completion', async () => {
  const { k, a } = await setup();
  const rs = await Promise.all(Array.from({ length: 8 }, () => mark(k, a._id, 1, adminH(k))));
  assert.ok(rs.every(r => r.status === 200));
  assert.strictEqual(await Completion.countDocuments({ khatma_id: k.id }), 1);
});

test('completions are tracked per cycle', async () => {
  const { k, a } = await setup();
  await mark(k, a._id, 1, adminH(k));
  await mark(k, a._id, 3, adminH(k));
  assert.strictEqual((await get(k, 1)).data.completedCount, 1);
  assert.strictEqual((await get(k, 2)).data.completedCount, 0);
  assert.strictEqual((await get(k, 3)).data.completedCount, 1);
  await undo(k, a._id, 1, adminH(k));
  assert.strictEqual((await get(k, 3)).data.completedCount, 1);
});

test('participant with the right token can mark and undo only their own juz', async () => {
  const { k, a, b, claim } = await setup();
  const ta = await claim(a);
  const own = { 'x-participant-token': ta };
  assert.strictEqual((await mark(k, a._id, 1, own)).status, 200);
  assert.strictEqual((await mark(k, b._id, 1, own)).status, 403);
  assert.strictEqual((await undo(k, b._id, 1, own)).status, 403);
  assert.strictEqual((await undo(k, a._id, 1, own)).status, 200);
  assert.strictEqual((await get(k, 1)).data.completedCount, 0);
});

test('no credentials, wrong token, or unclaimed participant is 403', async () => {
  const { k, a, b, claim } = await setup();
  await claim(a);
  assert.strictEqual((await mark(k, a._id, 1, {})).status, 403);
  assert.strictEqual((await mark(k, a._id, 1, { 'x-participant-token': 'wrong' })).status, 403);
  assert.strictEqual((await mark(k, b._id, 1, { 'x-participant-token': 'null' })).status, 403);
  assert.strictEqual((await undo(k, a._id, 1, { 'x-participant-token': 'wrong' })).status, 403);
  assert.strictEqual(await Completion.countDocuments({ khatma_id: k.id }), 0);
});

test('a wrong admin password does not grant marking rights', async () => {
  const { k, a } = await setup();
  assert.strictEqual((await mark(k, a._id, 1, { 'x-admin-password': 'wrong' })).status, 403);
});

test('invalid cycleNumber (0, negative, float, string, object, missing) is 400 for mark and undo', async () => {
  const { k, a } = await setup();
  for (const cycleNumber of [0, -1, 1.5, '1', 'abc', { $gt: 0 }, null, undefined, [1]]) {
    for (const fn of [mark, undo]) {
      const res = await fn(k, a._id, cycleNumber, adminH(k));
      assert.strictEqual(res.status, 400, `${fn.name} ${JSON.stringify(cycleNumber)}`);
    }
  }
  assert.strictEqual(await Completion.countDocuments({ khatma_id: k.id }), 0);
});

test('invalid or missing participantId is 400', async () => {
  const { k } = await setup();
  for (const pid of [undefined, '', 'garbage', { $ne: null }, 5]) {
    assert.strictEqual((await mark(k, pid, 1, adminH(k))).status, 400, JSON.stringify(pid));
    assert.strictEqual((await undo(k, pid, 1, adminH(k))).status, 400, JSON.stringify(pid));
  }
});

test('unknown participant id is 404 on mark', async () => {
  const { k } = await setup();
  assert.strictEqual((await mark(k, '000000000000000000000000', 1, adminH(k))).status, 404);
});

test('participant from another khatma: mark is 404, even for the other khatma\'s organizer and token', async () => {
  const { k } = await setup({ adminPassword: 'pw-main' });
  const other = await setup({ adminPassword: 'pw-other' });
  const token = await other.claim(other.a);
  assert.strictEqual((await mark(k, other.a._id, 1, adminH(k))).status, 404);
  assert.strictEqual((await mark(k, other.a._id, 1, { 'x-participant-token': token })).status, 404);
  assert.strictEqual((await mark(k, other.a._id, 1, adminH(other))).status, 404);
  assert.strictEqual(await Completion.countDocuments({ participant_id: other.a._id }), 0);
});

test('token from another khatma is rejected on this khatma\'s participants (mark and undo)', async () => {
  const { k, a } = await setup({ adminPassword: 'pw-main' });
  const other = await setup({ adminPassword: 'pw-other' });
  const foreignToken = await other.claim(other.a);
  assert.strictEqual((await mark(k, a._id, 1, { 'x-participant-token': foreignToken })).status, 403);
  await mark(k, a._id, 1, adminH(k));
  assert.strictEqual((await undo(k, a._id, 1, { 'x-participant-token': foreignToken })).status, 403);
  assert.strictEqual((await get(k, 1)).data.completedCount, 1);
});

test('undo of a participant from another khatma does not touch that khatma\'s completions', async () => {
  const { k } = await setup({ adminPassword: 'pw-main' });
  const other = await setup({ adminPassword: 'pw-other' });
  await mark(other.k, other.a._id, 1, adminH(other.k));
  await undo(k, other.a._id, 1, adminH(k));
  assert.strictEqual((await get(other.k, 1)).data.completedCount, 1);
});

test('deleting a participant leaves other participants\' completions intact', async () => {
  const { k, a, b } = await setup();
  await mark(k, a._id, 1, adminH(k));
  await mark(k, b._id, 1, adminH(k));
  await call('DELETE', `/khatma/${k.id}/participants/${a._id}`, { headers: adminH(k) });
  const res = await get(k, 1);
  assert.strictEqual(res.data.totalParticipants, 1);
  assert.ok(res.data.completedIds.includes(b._id));
});
