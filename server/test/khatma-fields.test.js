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
