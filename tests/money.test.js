import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, parseAmount, formatAmount, toSatang } from '../src/core/money.js';
import { decimalsOf, CURRENCIES } from '../src/core/currencies.js';

test('allocate splits remainder to largest fractions', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(1000, [0, 0]), [500, 500]);
  assert.equal(allocate(7, [2, 1]).reduce((a, b) => a + b, 0), 7);
});

test('allocate always sums to total and is non-negative (random)', () => {
  for (let i = 0; i < 200; i++) {
    const total = Math.floor(Math.random() * 1_000_000);
    const n = 1 + Math.floor(Math.random() * 8);
    const w = Array.from({ length: n }, () => Math.floor(Math.random() * 5000));
    const r = allocate(total, w);
    assert.equal(r.reduce((a, b) => a + b, 0), total);
    assert.ok(r.every((x) => x >= 0 && Number.isInteger(x)));
  }
});

test('parseAmount accepts formatted input and rejects bad input', () => {
  assert.equal(parseAmount('1,250.50', 2), 125050);
  assert.equal(parseAmount(' 300 ', 2), 30000);
  assert.equal(parseAmount('฿99', 2), 9900);
  assert.equal(parseAmount('1200', 0), 1200);
  assert.equal(parseAmount('12.345', 2), null);
  assert.equal(parseAmount('12.5', 0), null);
  assert.equal(parseAmount('abc', 2), null);
  assert.equal(parseAmount('-5', 2), null);
  assert.equal(parseAmount('', 2), null);
});

test('formatAmount uses currency decimals', () => {
  assert.equal(formatAmount(125050, 'THB'), '1,250.50');
  assert.equal(formatAmount(1200, 'JPY'), '1,200');
});

test('toSatang converts minor units with rate', () => {
  assert.equal(toSatang(1000, 'JPY', 0.23), 23000);
  assert.equal(toSatang(1999, 'USD', 35.5), 70965);
  assert.equal(toSatang(12345, 'THB', 1), 12345);
});

test('currency table has zero-decimal currencies', () => {
  assert.equal(decimalsOf('JPY'), 0);
  assert.equal(decimalsOf('THB'), 2);
  assert.ok(CURRENCIES.length >= 13);
});
