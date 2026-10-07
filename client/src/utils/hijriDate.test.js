import test from 'node:test';
import assert from 'node:assert';
import { formatHijriDate, formatDate } from './hijriDate.js';

const MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];
function parse(text) {
  const m = text.match(/^(\d+) (.+) (\d+) هـ$/);
  assert.ok(m, `unexpected format: ${text}`);
  return { day: Number(m[1]), month: MONTHS.indexOf(m[2]), year: Number(m[3]) };
}
const local = (y, mo, d) => new Date(y, mo - 1, d, 12);

test('2024-03-11 is about 1 Ramadan 1445 (within one day)', () => {
  const h = parse(formatHijriDate(local(2024, 3, 11)));
  assert.strictEqual(h.year, 1445);
  assert.ok((h.month === 8 && h.day <= 2) || (h.month === 7 && h.day >= 29), JSON.stringify(h));
});

test('2024-07-07 is about 1 Muharram 1446', () => {
  const h = parse(formatHijriDate(local(2024, 7, 7)));
  assert.ok(
    (h.year === 1446 && h.month === 0 && h.day <= 2) || (h.year === 1445 && h.month === 11 && h.day >= 29),
    JSON.stringify(h)
  );
});

test('2023-04-21 is about 1 Shawwal 1444 (within one day)', () => {
  const h = parse(formatHijriDate(local(2023, 4, 21)));
  assert.strictEqual(h.year, 1444);
  assert.ok((h.month === 9 && h.day <= 2) || (h.month === 8 && h.day >= 29), JSON.stringify(h));
});

test('400 consecutive days give valid, consecutive Hijri dates', () => {
  let prev = null;
  for (let i = 0; i < 400; i++) {
    const h = parse(formatHijriDate(local(2024, 1, 1 + i)));
    assert.ok(h.month >= 0 && h.day >= 1 && h.day <= 30, JSON.stringify(h));
    if (prev) {
      const next = h.year === prev.year && h.month === prev.month && h.day === prev.day + 1;
      assert.ok(next || h.day === 1, `${JSON.stringify(prev)} -> ${JSON.stringify(h)}`);
    }
    prev = h;
  }
});

test('Date object and ISO string inputs agree', () => {
  assert.strictEqual(formatHijriDate(local(2024, 3, 11)), formatHijriDate('2024-03-11T12:00:00'));
});

test('formatDate hijri vs gregorian', () => {
  const d = local(2024, 3, 11);
  assert.strictEqual(formatDate(d, true), formatHijriDate(d));
  const g = formatDate(d, false);
  assert.notStrictEqual(g, formatHijriDate(d));
  assert.ok(!g.includes('هـ'));
  assert.ok(g.includes('٢٠٢٤') || g.includes('2024'), g);
  assert.strictEqual(formatDate(d), g);
});

test('January dates are correct (regression: negative floor in month term)', () => {
  // 1 Rajab 1445 was 2024-01-13 (+-1 day); 2025-01-01 is about 1 Rajab 1446
  const a = parse(formatHijriDate(local(2024, 1, 13)));
  assert.strictEqual(a.month, 6);
  assert.ok(a.day >= 1 && a.day <= 3, JSON.stringify(a));
  const b = parse(formatHijriDate(local(2025, 1, 1)));
  assert.strictEqual(b.year, 1446);
  assert.ok((b.month === 6 && b.day <= 2) || (b.month === 5 && b.day >= 29), JSON.stringify(b));
});
