import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupPromptPay, setPromptPay } from '../src/core/contacts.js';

test('lookup trims names', () => {
  assert.equal(lookupPromptPay({ 'บี': '0812345678' }, '  บี '), '0812345678');
  assert.equal(lookupPromptPay({}, 'บี'), null);
  assert.equal(lookupPromptPay(null, 'บี'), null);
});

test('setPromptPay returns a new book and can clear', () => {
  const a = {};
  const b = setPromptPay(a, ' จา ', '0899999999');
  assert.deepEqual(a, {});
  assert.deepEqual(b, { 'จา': '0899999999' });
  assert.deepEqual(setPromptPay(b, 'จา', null), {});
});
