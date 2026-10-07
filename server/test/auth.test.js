const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');
const { enc, codeH, adminH } = require('./util');

test.before(start);
test.after(stop);

const noSecrets = data => {
  const s = JSON.stringify(data);
  assert.ok(!/admin_password/.test(s), 'admin_password leaked');
  assert.ok(!/"token"/.test(s), 'token leaked');
};

// ---- POST /khatma/access
test('access: valid code returns khatma and participants, no secrets', async () => {
  const k = await createKhatma();
  await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'أحمد', slotNumber: 1 }, headers: adminH(k) });
  const res = await call('POST', '/khatma/access', { body: { code: k.code } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.khatma._id, k.id);
  assert.strictEqual(res.data.participants.length, 1);
  noSecrets(res.data);
});

test('access: unknown code is 404', async () => {
  const res = await call('POST', '/khatma/access', { body: { code: 'does-not-exist' } });
  assert.strictEqual(res.status, 404);
});

test('access: missing, empty and non-string codes are 400', async () => {
  for (const body of [{}, { code: '' }, { code: 123 }, { code: ['a'] }, { code: null }, { code: true }]) {
    const res = await call('POST', '/khatma/access', { body });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
  }
});

test('access: Arabic code works', async () => {
  const k = await createKhatma({ accessCode: 'ختمة-الفاتحة' });
  const res = await call('POST', '/khatma/access', { body: { code: 'ختمة-الفاتحة' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.khatma._id, k.id);
});

test('access: participants come back sorted by slot and without tokens even after claim', async () => {
  const k = await createKhatma();
  const b = (await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'ب', slotNumber: 5 }, headers: adminH(k) })).data.participant;
  await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'أ', slotNumber: 2 }, headers: adminH(k) });
  await call('POST', `/khatma/${k.id}/participants/${b._id}/claim`, { headers: codeH(k) });
  const res = await call('POST', '/khatma/access', { body: { code: k.code } });
  assert.deepStrictEqual(res.data.participants.map(p => p.slot_number), [2, 5]);
  noSecrets(res.data);
});

// ---- POST /khatma/admin-login
test('admin-login: valid credentials return khatma, participants, deceased and no secrets', async () => {
  const k = await createKhatma();
  await call('POST', `/khatma/${k.id}/participants`, { body: { name: 'أحمد', slotNumber: 1 }, headers: adminH(k) });
  await call('POST', `/khatma/${k.id}/deceased`, { body: { name: 'فلان', deathDate: '2020-05-05' }, headers: adminH(k) });
  const res = await call('POST', '/khatma/admin-login', { body: { code: k.code, adminPassword: k.password } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.khatma._id, k.id);
  assert.strictEqual(res.data.participants.length, 1);
  assert.strictEqual(res.data.deceased.length, 1);
  noSecrets(res.data);
});

test('admin-login: wrong password and wrong code are 404', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('POST', '/khatma/admin-login', { body: { code: k.code, adminPassword: 'nope' } })).status, 404);
  assert.strictEqual((await call('POST', '/khatma/admin-login', { body: { code: 'nope', adminPassword: k.password } })).status, 404);
});

test('admin-login: missing and non-string fields are 400', async () => {
  const k = await createKhatma();
  const bodies = [{}, { code: k.code }, { adminPassword: k.password }, { code: '', adminPassword: '' },
    { code: 1, adminPassword: k.password }, { code: k.code, adminPassword: 1 },
    { code: { $ne: '' }, adminPassword: { $ne: '' } }, { code: [k.code], adminPassword: [k.password] }];
  for (const body of bodies) {
    const res = await call('POST', '/khatma/admin-login', { body });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
  }
});

test('admin-login: Arabic code and password work', async () => {
  const k = await createKhatma({ accessCode: 'ختمة-رمضان', adminPassword: 'كلمة-سر-قوية' });
  const res = await call('POST', '/khatma/admin-login', { body: { code: 'ختمة-رمضان', adminPassword: 'كلمة-سر-قوية' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.khatma._id, k.id);
  noSecrets(res.data);
});

// ---- auth middleware
test('middleware: Arabic code header (URL-encoded) authenticates', async () => {
  const k = await createKhatma({ accessCode: 'ختمة-الأسرة' });
  const res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': enc('ختمة-الأسرة') } });
  assert.strictEqual(res.status, 200);
});

test('middleware: Arabic admin password header (URL-encoded) authenticates', async () => {
  const k = await createKhatma({ adminPassword: 'سر-المنظم' });
  const res = await call('PUT', `/khatma/${k.id}`, { body: { name: 'جديد' }, headers: { 'x-admin-password': enc('سر-المنظم') } });
  assert.strictEqual(res.status, 200);
});

test('middleware: malformed percent-encoding does not crash (falls back to raw, then 403)', async () => {
  const k = await createKhatma();
  const r1 = await call('GET', `/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': '%E0%A4%A' } });
  assert.strictEqual(r1.status, 403);
  const r2 = await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' }, headers: { 'x-admin-password': '%E0%A4%A' } });
  assert.strictEqual(r2.status, 403);
});

test('middleware: a raw code that is not valid percent-encoding still works (raw fallback)', async () => {
  const k = await createKhatma({ accessCode: '100%E0%A4%A' });
  const res = await call('GET', `/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': '100%E0%A4%A' } });
  assert.strictEqual(res.status, 200);
});

test('middleware: missing header 401, wrong 403, invalid id 400 (code and admin)', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('GET', `/khatma/${k.id}/dashboard`)).status, 401);
  assert.strictEqual((await call('GET', `/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': 'wrong' } })).status, 403);
  assert.strictEqual((await call('GET', '/khatma/not-an-id/dashboard', { headers: codeH(k) })).status, 400);
  assert.strictEqual((await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' } })).status, 401);
  assert.strictEqual((await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' }, headers: { 'x-admin-password': 'wrong' } })).status, 403);
  assert.strictEqual((await call('PUT', '/khatma/not-an-id', { body: { name: 'x' }, headers: adminH(k) })).status, 400);
});

test('middleware: valid id of a nonexistent khatma is 403', async () => {
  const k = await createKhatma();
  const res = await call('GET', '/khatma/000000000000000000000000/dashboard', { headers: codeH(k) });
  assert.strictEqual(res.status, 403);
});

test('middleware: code of khatma A does not open khatma B; admin password of A does not admin B', async () => {
  const a = await createKhatma({ adminPassword: 'pw-of-a' });
  const b = await createKhatma({ adminPassword: 'pw-of-b' });
  assert.strictEqual((await call('GET', `/khatma/${b.id}/dashboard`, { headers: codeH(a) })).status, 403);
  assert.strictEqual((await call('PUT', `/khatma/${b.id}`, { body: { name: 'x' }, headers: adminH(a) })).status, 403);
});

test('middleware: the access code is not accepted as the admin password', async () => {
  const k = await createKhatma();
  const res = await call('PUT', `/khatma/${k.id}`, { body: { name: 'x' }, headers: { 'x-admin-password': enc(k.code) } });
  assert.strictEqual(res.status, 403);
});

test('health check responds', async () => {
  const res = await call('GET', '');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'ok');
});
