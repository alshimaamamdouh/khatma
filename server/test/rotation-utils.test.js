const test = require('node:test');
const assert = require('node:assert');
const {
  getCycleNumber, getCurrentJuz, getCycleDedication, isPaused, getRotationLabel, getCycleDays, getNextChangeDate
} = require('../utils/rotation');
const { normalizePhone } = require('../utils/phone');
const { newToken } = require('../utils/token');

// Local-time dates so the tests do not depend on the machine's timezone.
const D = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

test('getCycleDays: each type, custom with and without days, unknown falls back to 7', () => {
  assert.strictEqual(getCycleDays('daily'), 1);
  assert.strictEqual(getCycleDays('weekly'), 7);
  assert.strictEqual(getCycleDays('biweekly'), 14);
  assert.strictEqual(getCycleDays('monthly'), 30);
  assert.strictEqual(getCycleDays('custom', 10), 10);
  assert.strictEqual(getCycleDays('custom'), 7);
  assert.strictEqual(getCycleDays('custom', null), 7);
  assert.strictEqual(getCycleDays('bogus'), 7);
  assert.strictEqual(getCycleDays(undefined), 7);
});

test('getRotationLabel: all types', () => {
  assert.strictEqual(getRotationLabel('daily'), 'يومياً');
  assert.strictEqual(getRotationLabel('weekly'), 'أسبوعياً');
  assert.strictEqual(getRotationLabel('biweekly'), 'كل أسبوعين');
  assert.strictEqual(getRotationLabel('monthly'), 'شهرياً');
  assert.strictEqual(getRotationLabel('custom', 5), 'كل 5 يوم');
  assert.strictEqual(getRotationLabel('nonsense'), 'أسبوعياً');
});

test('getCurrentJuz: starts at the slot, advances per cycle, wraps 30 -> 1', () => {
  assert.strictEqual(getCurrentJuz(1, 0), 1);
  assert.strictEqual(getCurrentJuz(30, 0), 30);
  assert.strictEqual(getCurrentJuz(1, 29), 30);
  assert.strictEqual(getCurrentJuz(1, 30), 1);
  assert.strictEqual(getCurrentJuz(30, 1), 1);
  assert.strictEqual(getCurrentJuz(15, 20), 5);
  assert.strictEqual(getCurrentJuz(7, 60), 7);
  assert.strictEqual(getCurrentJuz(30, 29), 29);
});

test('getCurrentJuz: every slot visits each juz exactly once in 30 cycles', () => {
  for (const slot of [1, 13, 30]) {
    const seen = new Set(Array.from({ length: 30 }, (_, c) => getCurrentJuz(slot, c)));
    assert.strictEqual(seen.size, 30);
  }
});

test('getCycleNumber: counts whole cycles since the start', () => {
  const start = D(2026, 1, 4);
  assert.strictEqual(getCycleNumber(start, D(2026, 1, 4)), 0);
  assert.strictEqual(getCycleNumber(start, D(2026, 1, 10)), 0);
  assert.strictEqual(getCycleNumber(start, D(2026, 1, 11)), 1);
  assert.strictEqual(getCycleNumber(start, D(2026, 3, 1)), 8);
  assert.strictEqual(getCycleNumber(start, D(2026, 1, 5), null, null, 'daily'), 1);
  assert.strictEqual(getCycleNumber(start, D(2026, 2, 3), null, null, 'monthly'), 1);
  assert.strictEqual(getCycleNumber(start, D(2026, 1, 25), null, null, 'biweekly'), 1);
  assert.strictEqual(getCycleNumber(start, D(2026, 1, 14), null, null, 'custom', 5), 2);
});

test('getCycleNumber: before the start is 0, never negative', () => {
  assert.strictEqual(getCycleNumber(D(2026, 6, 1), D(2026, 1, 1)), 0);
});

test('getCycleNumber: a pause spanning several cycles skips them', () => {
  const start = D(2026, 1, 1);
  const now = D(2026, 2, 12); // 42 days = 6 cycles
  assert.strictEqual(getCycleNumber(start, now), 6);
  // 21 days paused = 3 whole cycles skipped
  assert.strictEqual(getCycleNumber(start, now, D(2026, 1, 8), D(2026, 1, 29)), 3);
  // 10 days paused = 1 whole cycle
  assert.strictEqual(getCycleNumber(start, now, D(2026, 1, 8), D(2026, 1, 18)), 5);
  // 6 days paused < one cycle: nothing skipped
  assert.strictEqual(getCycleNumber(start, now, D(2026, 1, 8), D(2026, 1, 14)), 6);
});

test('getCycleNumber: pause that is still running is clamped to today', () => {
  const start = D(2026, 1, 1);
  const now = D(2026, 1, 29); // 28 days = 4 cycles; paused from day 7 to far future = 21 days effective
  assert.strictEqual(getCycleNumber(start, now, D(2026, 1, 8), D(2027, 1, 1)), 1);
});

test('getCycleNumber: pause before the start or after today has no effect; ignores half-set pauses', () => {
  const start = D(2026, 3, 1);
  const now = D(2026, 4, 12); // 6 cycles
  assert.strictEqual(getCycleNumber(start, now, D(2025, 1, 1), D(2025, 6, 1)), 6);
  assert.strictEqual(getCycleNumber(start, now, D(2026, 5, 1), D(2026, 6, 1)), 6);
  assert.strictEqual(getCycleNumber(start, now, D(2026, 3, 8), null), 6);
  assert.strictEqual(getCycleNumber(start, now, null, D(2026, 3, 20)), 6);
});

test('getCycleNumber: a pause beginning before the start only counts from the start; never negative', () => {
  const start = D(2026, 1, 8);
  const now = D(2026, 1, 22); // 2 cycles
  assert.strictEqual(getCycleNumber(start, now, D(2025, 12, 1), D(2026, 3, 1)), 0);
});

test('getCycleNumber: pause length uses the cycle length of the rotation', () => {
  const start = D(2026, 1, 1);
  const now = D(2026, 1, 31); // 30 days
  // daily: 10 paused days = 10 cycles skipped of 30
  assert.strictEqual(getCycleNumber(start, now, D(2026, 1, 11), D(2026, 1, 21), 'daily'), 20);
  // monthly: only 1 cycle total, pause of 10 days < 30 skips none
  assert.strictEqual(getCycleNumber(start, now, D(2026, 1, 11), D(2026, 1, 21), 'monthly'), 1);
});

test('isPaused: inclusive range, either end missing means not paused', () => {
  const from = D(2026, 5, 10);
  const to = D(2026, 5, 20);
  assert.strictEqual(isPaused(from, to, D(2026, 5, 9)), false);
  assert.strictEqual(isPaused(from, to, D(2026, 5, 10)), true);
  assert.strictEqual(isPaused(from, to, D(2026, 5, 15)), true);
  assert.strictEqual(isPaused(from, to, D(2026, 5, 20)), true);
  assert.strictEqual(isPaused(from, to, D(2026, 5, 21)), false);
  assert.strictEqual(isPaused(null, to, D(2026, 5, 15)), false);
  assert.strictEqual(isPaused(from, null, D(2026, 5, 15)), false);
  assert.strictEqual(isPaused(null, null), false);
});

test('getNextChangeDate: weekly, biweekly, monthly, custom and boundary', () => {
  const at = (y, m, d) => D(y, m, d);
  assert.strictEqual(getNextChangeDate(D(2026, 1, 1), 'weekly', null, at(2026, 1, 3)), '2026-01-08');
  assert.strictEqual(getNextChangeDate(D(2026, 1, 1), 'biweekly', null, at(2026, 1, 20)), '2026-01-29');
  assert.strictEqual(getNextChangeDate(D(2026, 1, 1), 'monthly', null, at(2026, 2, 5)), '2026-03-02');
  assert.strictEqual(getNextChangeDate(D(2026, 1, 1), 'custom', 3, at(2026, 1, 3)), '2026-01-04');
  assert.strictEqual(getNextChangeDate(D(2026, 1, 1), 'weekly', null, at(2026, 1, 8)), '2026-01-15');
});

test('getNextChangeDate: crosses month and year ends', () => {
  assert.strictEqual(getNextChangeDate(D(2026, 12, 25), 'weekly', null, D(2026, 12, 30)), '2027-01-01');
});

// ---- dedication
const person = (id, name, death_date) => ({ _id: id, name, death_date });

test('getCycleDedication: empty or missing list is null', () => {
  assert.strictEqual(getCycleDedication([], 0), null);
  assert.strictEqual(getCycleDedication(null, 3), null);
  assert.strictEqual(getCycleDedication(undefined, 3), null);
});

test('getCycleDedication: a single person is dedicated every cycle', () => {
  const list = [person('1', 'واحد', '2010-01-01')];
  for (const c of [0, 1, 2, 17]) {
    const r = getCycleDedication(list, c, D(2026, 7, 1));
    assert.deepStrictEqual(r.dedicated.map(x => x.name), ['واحد']);
    assert.strictEqual(r.hasAnniversary, false);
  }
});

test('getCycleDedication: round-robin in death-date order, independent of list order', () => {
  const list = [person('c', 'ج', '2012-12-01'), person('a', 'أ', '2010-02-01'), person('b', 'ب', '2011-04-01')];
  const now = D(2026, 7, 1);
  const names = c => getCycleDedication(list, c, now).dedicated.map(x => x.name);
  assert.deepStrictEqual(names(0), ['أ']);
  assert.deepStrictEqual(names(1), ['ب']);
  assert.deepStrictEqual(names(2), ['ج']);
  assert.deepStrictEqual(names(3), ['أ']);
});

test('getCycleDedication: anniversary within the window adds that person to the round-robin one', () => {
  const list = [person('a', 'أ', '2010-02-01'), person('b', 'ب', '2011-07-03')];
  const r = getCycleDedication(list, 0, D(2026, 7, 2), 7);
  assert.strictEqual(r.hasAnniversary, true);
  assert.deepStrictEqual(r.anniversaryPeople.map(x => x.name), ['ب']);
  assert.deepStrictEqual(r.dedicated.map(x => x.name), ['أ', 'ب']);
});

test('getCycleDedication: when the anniversary person is already the round-robin pick they appear once', () => {
  const list = [person('a', 'أ', '2010-02-01'), person('b', 'ب', '2011-07-03')];
  const r = getCycleDedication(list, 1, D(2026, 7, 2), 7);
  assert.deepStrictEqual(r.dedicated.map(x => x.name), ['ب']);
  assert.strictEqual(r.hasAnniversary, true);
});

test('getCycleDedication: window edges follow ceil(cycleDays / 2)', () => {
  const list = [person('a', 'أ', '2010-07-10')];
  // weekly: window 4 days
  assert.strictEqual(getCycleDedication(list, 0, D(2026, 7, 6), 7).hasAnniversary, true);
  assert.strictEqual(getCycleDedication(list, 0, D(2026, 7, 5), 7).hasAnniversary, false);
  assert.strictEqual(getCycleDedication(list, 0, D(2026, 7, 14), 7).hasAnniversary, true);
  assert.strictEqual(getCycleDedication(list, 0, D(2026, 7, 15), 7).hasAnniversary, false);
  // daily: window 1 day
  assert.strictEqual(getCycleDedication(list, 0, D(2026, 7, 11), 1).hasAnniversary, true);
  assert.strictEqual(getCycleDedication(list, 0, D(2026, 7, 12), 1).hasAnniversary, false);
});

test('getCycleDedication: two anniversaries in one window both appear', () => {
  const list = [person('a', 'أ', '2010-07-01'), person('b', 'ب', '2011-07-03'), person('c', 'ج', '2012-01-01')];
  const r = getCycleDedication(list, 2, D(2026, 7, 2), 7); // round-robin picks ج
  assert.deepStrictEqual(r.dedicated.map(x => x.name), ['ج', 'أ', 'ب']);
  assert.strictEqual(r.anniversaryPeople.length, 2);
});

// ---- phone & token
test('normalizePhone: formats, junk and boundary lengths', () => {
  assert.strictEqual(normalizePhone('+973 3612 3456'), '97336123456');
  assert.strictEqual(normalizePhone('(973) 3612-3456'), '97336123456');
  assert.strictEqual(normalizePhone('00201001234567'), '201001234567');
  assert.strictEqual(normalizePhone('٩٧٣٣٦١٢٣٤٥٦'), null); // Arabic-Indic digits are not \d
  assert.strictEqual(normalizePhone('12345678'), '12345678');
  assert.strictEqual(normalizePhone('1234567'), null);
  assert.strictEqual(normalizePhone('0012345'), null);
  assert.strictEqual(normalizePhone(undefined), null);
  assert.strictEqual(normalizePhone(0), null);
  assert.strictEqual(normalizePhone('abc'), null);
  assert.strictEqual(normalizePhone(97336123456), '97336123456');
});

test('newToken: 48 hex chars and unique', () => {
  const tokens = Array.from({ length: 500 }, newToken);
  assert.ok(tokens.every(t => /^[0-9a-f]{48}$/.test(t)));
  assert.strictEqual(new Set(tokens).size, 500);
});
