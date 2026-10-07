const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');

test.before(start);
test.after(stop);

const codeHeader = k => ({ 'x-khatma-code': encodeURIComponent(k.code) });
const adminHeader = k => ({ 'x-admin-password': encodeURIComponent(k.password) });

test('access rejects an operator object as code', async () => {
  await createKhatma();
  const res = await call('POST', '/khatma/access', { body: { code: { $ne: '' } } });
  assert.strictEqual(res.status, 400);
});

test('access still works with a normal code', async () => {
  const k = await createKhatma();
  const res = await call('POST', '/khatma/access', { body: { code: k.code } });
  assert.strictEqual(res.status, 200);
});

test('admin-login rejects an object password', async () => {
  const k = await createKhatma();
  const res = await call('POST', '/khatma/admin-login', { body: { code: k.code, adminPassword: { $ne: '' } } });
  assert.strictEqual(res.status, 400);
});

test('create and duplicate reject non-string fields', async () => {
  const bad = await call('POST', '/khatma', { body: { name: 'x', accessCode: { $ne: '' }, adminPassword: 'p', startDate: '2026-01-04' } });
  assert.strictEqual(bad.status, 400);
  const k = await createKhatma();
  const dup = await call('POST', `/khatma/${k.id}/duplicate`, { body: { newAccessCode: { $ne: '' }, newAdminPassword: 'p' }, headers: adminHeader(k) });
  assert.strictEqual(dup.status, 400);
});

test('completions reject a non-integer cycleNumber', async () => {
  const k = await createKhatma();
  const p = await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'أحمد', slotNumber: 1 }, headers: adminHeader(k) });
  assert.strictEqual(p.status, 201);
  const pid = p.data.id || p.data.participant?._id || p.data._id;
  for (const method of ['POST', 'DELETE']) {
    const res = await call(method, `/khatma/${k.id}/completions`, {
      body: { participantId: pid, cycleNumber: { $gt: 0 } }, headers: { ...codeHeader(k), ...adminHeader(k) }
    });
    assert.strictEqual(res.status, 400, method);
  }
});

test('duplicating a quick khatma keeps quick mode and phone, without participants', async () => {
  const k = await createKhatma({ isQuick: true, organizerPhone: '97336123456' });
  await call('POST', `/khatma/${k.id}/join`, { body: { name: 'علي', slotNumber: 3 }, headers: codeHeader(k) });
  const dup = await call('POST', `/khatma/${k.id}/duplicate`, { body: { newAccessCode: 'copy' + Date.now(), newAdminPassword: 'pw2' }, headers: adminHeader(k) });
  assert.strictEqual(dup.status, 201);
  const res = await call('GET', `/khatma/${dup.data.id}/dashboard`, { headers: { 'x-khatma-code': encodeURIComponent(dup.data.accessCode) } });
  assert.strictEqual(res.data.khatma.is_quick, true);
  assert.strictEqual(res.data.khatma.organizer_phone, '97336123456');
  assert.strictEqual(res.data.participants.length, 0);
});
