import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterExpenses } from '../src/core/search.js';

const group = { members: [{ id: 'a', name: 'จา' }, { id: 'b', name: 'บี' }, { id: 'c', name: 'Cee' }], rates: { JPY: 0.25 } };
const ex = (id, title, payerIds, category, currency = 'THB', amount = 10000) => ({
  id, title, category, currency, amount, actualTHB: null,
  payers: payerIds.map((m) => ({ memberId: m, amount: amount / payerIds.length })),
  split: { type: 'equal', memberIds: ['a', 'b'] },
});
const list = [
  ex('1', 'ราเมงอิจิรัน', ['a'], 'food', 'JPY', 4800),
  ex('2', 'ตั๋วรถไฟ JR', ['b', 'c'], 'transport', 'JPY', 3000),
  ex('3', 'Uniqlo', ['b'], 'shopping', 'THB', 125050),
  ex('4', 'ค่าอะไรสักอย่าง', ['a'], undefined, 'THB', 9900),
];
const ids = (r) => r.map((e) => e.id);

test('empty filter returns everything', () => {
  assert.deepEqual(ids(filterExpenses(list, group, {})), ['1', '2', '3', '4']);
});

test('query matches title case-insensitively and trims', () => {
  assert.deepEqual(ids(filterExpenses(list, group, { q: '  uniQLO ' })), ['3']);
  assert.deepEqual(ids(filterExpenses(list, group, { q: 'ราเมง' })), ['1']);
});

test('query matches payer name and category label', () => {
  assert.deepEqual(ids(filterExpenses(list, group, { q: 'cee' })), ['2']);
  assert.deepEqual(ids(filterExpenses(list, group, { q: 'เดินทาง' })), ['2']);
  assert.deepEqual(ids(filterExpenses(list, group, { q: 'ไม่ระบุ' })), ['4']);
});

test('query matches amount with or without commas', () => {
  assert.deepEqual(ids(filterExpenses(list, group, { q: '1,250.50' })), ['3']);
  assert.deepEqual(ids(filterExpenses(list, group, { q: '1250' })), ['3']);
  assert.deepEqual(ids(filterExpenses(list, group, { q: '4800' })), ['1']);
});

test('payer and category filters combine with query (AND)', () => {
  assert.deepEqual(ids(filterExpenses(list, group, { payer: 'b' })), ['2', '3']);
  assert.deepEqual(ids(filterExpenses(list, group, { payer: 'b', category: 'shopping' })), ['3']);
  assert.deepEqual(ids(filterExpenses(list, group, { category: 'none' })), ['4']);
  assert.deepEqual(ids(filterExpenses(list, group, { payer: 'a', q: 'ตั๋ว' })), []);
});
