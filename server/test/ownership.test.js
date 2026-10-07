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
