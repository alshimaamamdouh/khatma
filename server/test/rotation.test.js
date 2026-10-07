const test = require('node:test');
const assert = require('node:assert');
const { getNextChangeDate } = require('../utils/rotation');

test('weekly: next change is the next 7-day boundary after the start', () => {
  assert.strictEqual(getNextChangeDate('2026-01-04', 'weekly', null, new Date('2026-01-06T10:00:00')), '2026-01-11');
});

test('on a boundary day, the next change is one full cycle later', () => {
  assert.strictEqual(getNextChangeDate('2026-01-04', 'weekly', null, new Date('2026-01-11T10:00:00')), '2026-01-18');
});

test('custom days are respected', () => {
  assert.strictEqual(getNextChangeDate('2026-01-01', 'custom', 10, new Date('2026-01-05T10:00:00')), '2026-01-11');
});

test('before the start date, the first cycle ends one cycle after the start', () => {
  assert.strictEqual(getNextChangeDate('2026-02-01', 'weekly', null, new Date('2026-01-20T10:00:00')), '2026-02-08');
});

test('daily returns null (the line is not shown)', () => {
  assert.strictEqual(getNextChangeDate('2026-01-04', 'daily', null, new Date('2026-01-06T10:00:00')), null);
});
