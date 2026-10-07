import test from 'node:test';
import assert from 'node:assert';
import { ar } from './arabicNumbers.js';

test('ar renders zero', () => assert.strictEqual(ar(0), '٠'));
test('ar renders large numbers without grouping', () => {
  assert.strictEqual(ar(1234567890), '١٢٣٤٥٦٧٨٩٠');
});
test('ar accepts numeric strings', () => {
  assert.strictEqual(ar('30'), '٣٠');
  assert.strictEqual(ar('007'), '٧');
});
test('ar renders all ten digits', () => assert.strictEqual(ar(9876543210), '٩٨٧٦٥٤٣٢١٠'));
