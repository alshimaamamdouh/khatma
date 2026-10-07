const test = require('node:test');
const assert = require('node:assert');
const { start, stop, call, createKhatma } = require('./helpers');
const { codeH, adminH } = require('./util');

test.before(start);
test.after(stop);

const base = k => `/khatma/${k.id}/deceased`;
const add = (k, name, deathDate) => call('POST', base(k), { body: { name, deathDate }, headers: adminH(k) });
const list = async k => (await call('GET', base(k), { headers: codeH(k) })).data;

test('list: needs the code; empty at first; sorted by death date', async () => {
  const k = await createKhatma();
  assert.strictEqual((await call('GET', base(k))).status, 401);
  assert.strictEqual((await call('GET', base(k), { headers: { 'x-khatma-code': 'bad' } })).status, 403);
  assert.strictEqual((await call('GET', '/khatma/zzz/deceased', { headers: codeH(k) })).status, 400);
  assert.deepStrictEqual(await list(k), []);
  await add(k, 'ثاني', '2021-05-01');
  await add(k, 'أول', '2019-01-01');
  assert.deepStrictEqual((await list(k)).map(d => d.name), ['أول', 'ثاني']);
});

test('add: admin only', async () => {
  const k = await createKhatma();
  const body = { name: 'ف', deathDate: '2020-01-01' };
  assert.strictEqual((await call('POST', base(k), { body })).status, 401);
  assert.strictEqual((await call('POST', base(k), { body, headers: codeH(k) })).status, 401);
  assert.strictEqual((await call('POST', base(k), { body, headers: { 'x-admin-password': 'bad' } })).status, 403);
  assert.strictEqual((await list(k)).length, 0);
});

test('add: stores name and date and returns the record', async () => {
  const k = await createKhatma();
  const res = await add(k, 'عبد الله', '2020-03-04');
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.deceased.name, 'عبد الله');
  assert.strictEqual(res.data.deceased.death_date, '2020-03-04');
});

test('add: missing, empty or non-string fields are 400', async () => {
  const k = await createKhatma();
  const bodies = [{}, { name: 'ف' }, { deathDate: '2020-01-01' }, { name: '', deathDate: '2020-01-01' }, { name: 'ف', deathDate: '' },
    { name: { $ne: 1 }, deathDate: '2020-01-01' }, { name: 'ف', deathDate: { $ne: 1 } }];
  for (const body of bodies) {
    const res = await call('POST', base(k), { body, headers: adminH(k) });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
  }
  assert.strictEqual((await list(k)).length, 0);
});

test('update: name only, date only, and both', async () => {
  const k = await createKhatma();
  const d = (await add(k, 'قديم', '2020-01-01')).data.deceased;
  const put = body => call('PUT', `${base(k)}/${d._id}`, { body, headers: adminH(k) });
  let res = await put({ name: 'جديد' });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual([res.data.deceased.name, res.data.deceased.death_date], ['جديد', '2020-01-01']);
  res = await put({ deathDate: '2018-08-08' });
  assert.deepStrictEqual([res.data.deceased.name, res.data.deceased.death_date], ['جديد', '2018-08-08']);
  res = await put({ name: 'ثالث', deathDate: '2017-07-07' });
  assert.deepStrictEqual([res.data.deceased.name, res.data.deceased.death_date], ['ثالث', '2017-07-07']);
  assert.strictEqual((await list(k)).length, 1);
});

test('update: empty body 400, unknown/malformed id 404, auth enforced', async () => {
  const k = await createKhatma();
  const d = (await add(k, 'ف', '2020-01-01')).data.deceased;
  const put = (id, body, headers = adminH(k)) => call('PUT', `${base(k)}/${id}`, { body, headers });
  assert.strictEqual((await put(d._id, {})).status, 400);
  assert.strictEqual((await put('000000000000000000000000', { name: 'x' })).status, 404);
  assert.strictEqual((await put('garbage', { name: 'x' })).status, 404);
  assert.strictEqual((await put(d._id, { name: 'x' }, {})).status, 401);
  assert.strictEqual((await put(d._id, { name: 'x' }, { 'x-admin-password': 'bad' })).status, 403);
});

test('update: non-string values are 400 and change nothing', async () => {
  const k = await createKhatma();
  const d = (await add(k, 'ثابت', '2020-01-01')).data.deceased;
  for (const body of [{ name: { $ne: 1 } }, { deathDate: ['x'] }]) {
    const res = await call('PUT', `${base(k)}/${d._id}`, { body, headers: adminH(k) });
    assert.strictEqual(res.status, 400, JSON.stringify(body));
  }
  assert.strictEqual((await list(k))[0].name, 'ثابت');
});

test('delete: removes; second delete and unknown/malformed ids are 404; auth enforced', async () => {
  const k = await createKhatma();
  const d = (await add(k, 'ف', '2020-01-01')).data.deceased;
  const del = (id, headers = adminH(k)) => call('DELETE', `${base(k)}/${id}`, { headers });
  assert.strictEqual((await del(d._id, {})).status, 401);
  assert.strictEqual((await del(d._id, { 'x-admin-password': 'bad' })).status, 403);
  assert.strictEqual((await del(d._id)).status, 200);
  assert.strictEqual((await list(k)).length, 0);
  assert.strictEqual((await del(d._id)).status, 404);
  assert.strictEqual((await del('garbage')).status, 404);
});

test('isolation: another khatma cannot list, edit or delete these records', async () => {
  const a = await createKhatma({ adminPassword: 'pw-a' });
  const b = await createKhatma({ adminPassword: 'pw-b' });
  const d = (await add(a, 'خاص بأ', '2020-01-01')).data.deceased;
  await add(b, 'خاص بب', '2021-01-01');
  assert.deepStrictEqual((await list(b)).map(x => x.name), ['خاص بب']);
  // B's admin addressing A's record through B's own URL
  assert.strictEqual((await call('PUT', `${base(b)}/${d._id}`, { body: { name: 'اختراق' }, headers: adminH(b) })).status, 404);
  assert.strictEqual((await call('DELETE', `${base(b)}/${d._id}`, { headers: adminH(b) })).status, 404);
  // B's credentials on A's URL
  assert.strictEqual((await call('GET', base(a), { headers: codeH(b) })).status, 403);
  assert.strictEqual((await call('DELETE', `${base(a)}/${d._id}`, { headers: adminH(b) })).status, 403);
  assert.deepStrictEqual((await list(a)).map(x => x.name), ['خاص بأ']);
});
