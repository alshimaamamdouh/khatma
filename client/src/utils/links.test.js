import test from 'node:test';
import assert from 'node:assert';
import { ar } from './arabicNumbers.js';
import {
  generateCode, generatePassword, khatmaPath, shareLink, manageLink, readPasswordFromHash,
  whatsappUrl, familyMessage, manageMessage, reminderMessage, distributionMessage
} from './links.js';

const ORIGIN = 'https://khatma-quran.vercel.app';

test('ar uses Arabic-Indic digits without grouping', () => {
  assert.strictEqual(ar(12), '١٢');
  assert.strictEqual(ar(1030), '١٠٣٠');
});

test('generated codes are 8 chars from an unambiguous alphabet', () => {
  for (let i = 0; i < 50; i++) assert.match(generateCode(), /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
});

test('generated passwords are 24 chars and differ', () => {
  const a = generatePassword();
  assert.strictEqual(a.length, 24);
  assert.notStrictEqual(a, generatePassword());
});

test('links encode Arabic codes', () => {
  assert.strictEqual(khatmaPath('ختمة'), '/k/%D8%AE%D8%AA%D9%85%D8%A9');
  assert.strictEqual(shareLink('abc', ORIGIN), `${ORIGIN}/k/abc`);
});

test('manage link keeps the password in the fragment and round-trips', () => {
  const link = manageLink('abc', 'p#ss/ word', ORIGIN);
  assert.ok(link.startsWith(`${ORIGIN}/m/abc#`));
  assert.strictEqual(readPasswordFromHash(new URL(link).hash), 'p#ss/ word');
  assert.strictEqual(readPasswordFromHash(''), null);
  assert.strictEqual(readPasswordFromHash('#'), null);
});

test('whatsappUrl targets a phone when given', () => {
  assert.strictEqual(whatsappUrl('مرحبا'), 'https://wa.me/?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7');
  assert.ok(whatsappUrl('x', '97336123456').startsWith('https://wa.me/97336123456?text='));
});

test('messages contain the right links and warnings', () => {
  assert.ok(familyMessage('ختمة العائلة', 'abc', ORIGIN).includes(`${ORIGIN}/k/abc`));
  const m = manageMessage('ختمة العائلة', 'abc', 'secret', ORIGIN);
  assert.ok(m.includes(`${ORIGIN}/m/abc#secret`));
  assert.ok(m.includes('احتفظ بهذه الرسالة، ولا ترسلها لأحد'));
  const r = reminderMessage('ختمة', 'abc', [{ name: 'محمد', juz: 12 }], ORIGIN);
  assert.ok(r.includes('محمد (الجزء ١٢)'));
});

test('distribution message lists rows, done marks and free parts', () => {
  const text = distributionMessage({
    name: 'ختمة', code: 'abc', isQuick: false, khatmaNumber: 3, dedicatedNames: ['أحمد'],
    rows: [{ juz: 1, name: 'محمد', done: true }, { juz: 2, name: 'فاطمة', done: false }],
    completedCount: 1, total: 2
  }, ORIGIN);
  assert.ok(text.includes('الجزء ١ ← محمد ✅'));
  assert.ok(text.includes('الجزء ٢ ← فاطمة'));
  assert.ok(text.includes('أجزاء متاحة'));
  assert.ok(text.includes('الإهداء'));
});
