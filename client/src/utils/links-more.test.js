import test from 'node:test';
import assert from 'node:assert';
import {
  khatmaPath, shareLink, manageLink, readPasswordFromHash, whatsappUrl,
  reminderMessage, distributionMessage
} from './links.js';

const ORIGIN = 'https://khatma-quran.vercel.app';

test('quick distribution has no number or dedication lines', () => {
  const t = distributionMessage({
    name: 'سريعة', code: 'abc', isQuick: true, khatmaNumber: 5, dedicatedNames: ['أحمد'],
    rows: [{ juz: 4, name: 'علي', done: false }], completedCount: 0, total: 1
  }, ORIGIN);
  assert.ok(!t.includes('الختمة رقم'));
  assert.ok(!t.includes('الإهداء'));
  assert.ok(!t.includes('أحمد'));
  assert.ok(t.includes('الجزء ٤ ← علي'));
  assert.ok(t.includes(`${ORIGIN}/k/abc`));
});

test('regular distribution shows number and joins dedications', () => {
  const t = distributionMessage({
    name: 'ختمة', code: 'abc', isQuick: false, khatmaNumber: 12, dedicatedNames: ['أحمد', 'سعاد'],
    rows: [], completedCount: 0, total: 0
  }, ORIGIN);
  assert.ok(t.includes('الختمة رقم: *١٢*'));
  assert.ok(t.includes('أحمد و سعاد'));
  assert.ok(!t.includes('أنهوا القراءة'));
});

test('all done adds the celebration line; no free parts omits the available line', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ juz: i + 1, name: `p${i + 1}`, done: true }));
  const t = distributionMessage({
    name: 'ختمة', code: 'abc', isQuick: false, khatmaNumber: 1, rows, completedCount: 30, total: 30
  }, ORIGIN);
  assert.ok(t.includes('تمت الختمة بحمد الله'));
  assert.ok(t.includes('٣٠ من ٣٠ أنهوا القراءة'));
  assert.ok(!t.includes('أجزاء متاحة'));
});

test('not all done: no celebration, rows sorted by juz, free parts listed', () => {
  const t = distributionMessage({
    name: 'ختمة', code: 'abc', isQuick: false, khatmaNumber: 1,
    rows: [{ juz: 3, name: 'ج', done: false }, { juz: 1, name: 'أ', done: true }],
    completedCount: 1, total: 2
  }, ORIGIN);
  assert.ok(!t.includes('تمت الختمة'));
  assert.ok(t.indexOf('الجزء ١') < t.indexOf('الجزء ٣'));
  const free = t.split('أجزاء متاحة:*')[1].split('\n')[0];
  assert.ok(free.trim().startsWith('٢، ٤'), free);
  assert.ok(free.includes('٣٠'));
  assert.ok(!free.split('، ').includes('٣') && !free.split('، ').includes('١'));
});

test('reminderMessage lists multiple people', () => {
  const r = reminderMessage('ختمة', 'abc', [{ name: 'محمد', juz: 1 }, { name: 'فاطمة', juz: 30 }], ORIGIN);
  assert.ok(r.includes('• محمد (الجزء ١)\n• فاطمة (الجزء ٣٠)'));
  assert.ok(r.includes(`${ORIGIN}/k/abc`));
});

test('khatmaPath escapes spaces, slashes and #', () => {
  const p = khatmaPath('a b/c#d');
  assert.strictEqual(p, '/k/a%20b%2Fc%23d');
  assert.strictEqual(shareLink('a b/c#d', ORIGIN), ORIGIN + p);
});

test('manageLink with Arabic code and password round-trips', () => {
  const link = manageLink('ختمة', 'كلمة سر/#؟', ORIGIN);
  const url = new URL(link);
  assert.strictEqual(decodeURIComponent(url.pathname.replace('/m/', '')), 'ختمة');
  assert.strictEqual(readPasswordFromHash(url.hash), 'كلمة سر/#؟');
  assert.strictEqual(url.search, '');
});

test('readPasswordFromHash handles malformed encoding and odd input', () => {
  assert.strictEqual(readPasswordFromHash('#%E0%A4%A'), null);
  assert.strictEqual(readPasswordFromHash(undefined), null);
  assert.strictEqual(readPasswordFromHash('#a'), 'a');
});

test('whatsappUrl with emoji, newlines and reserved characters round-trips', () => {
  const text = 'السلام 🌷\nline2 & a=b?c#d+e %';
  const url = whatsappUrl(text);
  assert.ok(!url.includes('\n') && !url.includes(' '));
  assert.strictEqual(decodeURIComponent(url.split('?text=')[1]), text);
  const withPhone = whatsappUrl(text, '97336123456');
  assert.ok(withPhone.startsWith('https://wa.me/97336123456?text='));
  assert.strictEqual(new URL(withPhone).searchParams.get('text'), text);
});
