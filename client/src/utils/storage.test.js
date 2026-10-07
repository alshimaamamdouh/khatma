import test, { beforeEach } from 'node:test';
import assert from 'node:assert';

// Test scaffolding: in-memory localStorage + minimal document, installed before the module loads.
const mem = new Map();
const state = { throwing: false, failWrites: false };
function boom() { throw new Error('storage blocked'); }
globalThis.localStorage = {
  getItem(k) { if (state.throwing) boom(); return mem.has(k) ? mem.get(k) : null; },
  setItem(k, v) { if (state.throwing || state.failWrites) boom(); mem.set(k, String(v)); },
  removeItem(k) { if (state.throwing) boom(); mem.delete(k); }
};
const docAttrs = new Map();
globalThis.document = {
  documentElement: {
    setAttribute(k, v) { docAttrs.set(k, v); },
    removeAttribute(k) { docAttrs.delete(k); },
    getAttribute(k) { return docAttrs.has(k) ? docAttrs.get(k) : null; }
  }
};

const s = await import('./storage.js');

beforeEach(() => {
  mem.clear();
  docAttrs.clear();
  state.throwing = false;
  state.failWrites = false;
});

test('getKhatma returns null when missing; saveKhatma merges patches', () => {
  assert.strictEqual(s.getKhatma('a'), null);
  s.saveKhatma('a', { code: 'abc' });
  s.saveKhatma('a', { adminPassword: 'pw' });
  s.saveKhatma('a', { code: 'xyz' });
  assert.deepStrictEqual(s.getKhatma('a'), { code: 'xyz', adminPassword: 'pw' });
  s.saveKhatma('b', { code: 'bbb' });
  assert.strictEqual(s.getKhatma('a').code, 'xyz');
  assert.strictEqual(s.getKhatma('b').code, 'bbb');
});

test('removeKhatma deletes the record and clears active only if same', () => {
  s.saveKhatma('a', { code: 'a1' });
  s.saveKhatma('b', { code: 'b1' });
  s.setActive('a');
  s.removeKhatma('b');
  assert.strictEqual(s.getKhatma('b'), null);
  assert.strictEqual(s.getActive().id, 'a');
  s.removeKhatma('a');
  assert.strictEqual(s.getActive(), null);
  assert.strictEqual(mem.has('activeKhatmaId'), false);
});

test('forgetParticipant keeps code and admin password', () => {
  s.saveKhatma('a', { code: 'c', adminPassword: 'p', participantId: '7', participantToken: 't' });
  s.forgetParticipant('a');
  assert.deepStrictEqual(s.getKhatma('a'), { code: 'c', adminPassword: 'p' });
  s.forgetParticipant('missing');
  assert.strictEqual(s.getKhatma('missing'), null);
});

test('findIdByCode finds Arabic codes and returns null when absent', () => {
  s.saveKhatma('a', { code: 'ختمة' });
  s.saveKhatma('b', { code: 'other' });
  assert.strictEqual(s.findIdByCode('ختمة'), 'a');
  assert.strictEqual(s.findIdByCode('other'), 'b');
  assert.strictEqual(s.findIdByCode('nope'), null);
});

test('setActive/getActive; missing record gives null', () => {
  assert.strictEqual(s.getActive(), null);
  s.setActive('ghost');
  assert.strictEqual(s.getActive(), null);
  s.saveKhatma('a', { code: 'c' });
  s.setActive('a');
  assert.deepStrictEqual(s.getActive(), { id: 'a', code: 'c' });
});

for (const bad of ['{not json', '"x"', '[]', 'null', '', '123', 'true']) {
  test(`corrupted khatmas value ${JSON.stringify(bad)} never throws and acts empty`, () => {
    mem.set('khatmas', bad);
    assert.strictEqual(s.getKhatma('a'), null);
    assert.strictEqual(s.findIdByCode('c'), null);
    s.setActive('a');
    assert.strictEqual(s.getActive(), null);
    s.forgetParticipant('a');
    s.removeKhatma('a');
    s.saveKhatma('a', { code: 'c' });
    assert.strictEqual(s.getKhatma('a').code, 'c');
  });
}

test('localStorage throwing on every call never throws out', () => {
  state.throwing = true;
  assert.strictEqual(s.getKhatma('a'), null);
  assert.doesNotThrow(() => s.saveKhatma('a', { code: 'c' }));
  assert.doesNotThrow(() => s.removeKhatma('a'));
  assert.doesNotThrow(() => s.forgetParticipant('a'));
  assert.strictEqual(s.findIdByCode('c'), null);
  assert.doesNotThrow(() => s.setActive('a'));
  assert.strictEqual(s.getActive(), null);
  assert.doesNotThrow(() => s.migrateLegacyStorage());
});

test('migrateLegacyStorage: full legacy set becomes record + active, legacy keys removed', () => {
  const legacy = {
    khatmaCode: 'abc', khatmaId: '42', adminPassword: 'pw', khatmaName: 'n',
    participantId: '9', participantName: 'م', participantSlot: '3', darkMode: 'true'
  };
  for (const [k, v] of Object.entries(legacy)) mem.set(k, v);
  docAttrs.set('data-theme', 'dark');
  s.migrateLegacyStorage();
  assert.deepStrictEqual(s.getKhatma('42'), { code: 'abc', adminPassword: 'pw' });
  assert.strictEqual(s.getActive().id, '42');
  for (const k of Object.keys(legacy)) assert.strictEqual(mem.has(k), false, k);
  assert.strictEqual(docAttrs.has('data-theme'), false);
});

test('migrateLegacyStorage without admin password saves only code', () => {
  mem.set('khatmaCode', 'abc');
  mem.set('khatmaId', '1');
  s.migrateLegacyStorage();
  assert.deepStrictEqual(s.getKhatma('1'), { code: 'abc' });
});

test('migrateLegacyStorage: partial set (no id) migrates nothing', () => {
  mem.set('khatmaCode', 'abc');
  mem.set('adminPassword', 'pw');
  mem.set('darkMode', 'true');
  s.migrateLegacyStorage();
  assert.strictEqual(mem.has('khatmas'), false);
  assert.strictEqual(mem.has('activeKhatmaId'), false);
  assert.strictEqual(mem.has('darkMode'), false);
});

test('migrateLegacyStorage does not overwrite an already-migrated id', () => {
  s.saveKhatma('42', { code: 'new', participantId: '5', participantToken: 't' });
  mem.set('khatmaCode', 'old');
  mem.set('khatmaId', '42');
  mem.set('adminPassword', 'oldpw');
  s.migrateLegacyStorage();
  assert.deepStrictEqual(s.getKhatma('42'), { code: 'new', participantId: '5', participantToken: 't' });
});

test('migrateLegacyStorage keeps legacy credentials when the write fails', () => {
  mem.set('khatmaCode', 'abc');
  mem.set('khatmaId', '42');
  mem.set('adminPassword', 'pw');
  mem.set('participantId', '9');
  state.failWrites = true;
  s.migrateLegacyStorage();
  assert.strictEqual(mem.get('khatmaCode'), 'abc');
  assert.strictEqual(mem.get('khatmaId'), '42');
  assert.strictEqual(mem.get('adminPassword'), 'pw');
  assert.strictEqual(mem.has('participantId'), false);
});
