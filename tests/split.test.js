import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseTotalTHB, itemsBreakdown, expenseShares, validateExpense } from '../src/core/split.js';

const members = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
const group = { id: 'g', members, rates: { JPY: 0.23 } };
const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0);
const base = (over) => ({
  id: 'e', groupId: 'g', title: 'x', currency: 'THB', amount: 100000,
  payers: [{ memberId: 'a', amount: 100000 }],
  split: { type: 'equal', memberIds: ['a', 'b', 'c'] }, actualTHB: null, ...over,
});

test('equal split of 1,000 baht among three sums exactly', () => {
  const { owed, paid } = expenseShares(base(), group);
  assert.deepEqual([owed.a, owed.b, owed.c], [33334, 33333, 33333]);
  assert.equal(paid.a, 100000);
});

test('equal split among a subset leaves others out', () => {
  const { owed } = expenseShares(base({ split: { type: 'equal', memberIds: ['a', 'b'] } }), group);
  assert.equal(owed.a, 50000);
  assert.equal(owed.b, 50000);
  assert.ok(!owed.c);
});

test('exact split uses given amounts', () => {
  const { owed } = expenseShares(base({ split: { type: 'exact', amounts: { a: 30000, b: 70000 } } }), group);
  assert.equal(owed.a, 30000);
  assert.equal(owed.b, 70000);
});

test('foreign currency converts with group rate', () => {
  const e = base({ currency: 'JPY', amount: 3000, payers: [{ memberId: 'b', amount: 2000 }, { memberId: 'c', amount: 1000 }] });
  assert.equal(expenseTotalTHB(e, group), 69000);
});

test('actualTHB overrides rate and scales payers proportionally', () => {
  const e = base({ currency: 'JPY', amount: 3000, actualTHB: 71250,
    payers: [{ memberId: 'b', amount: 2000 }, { memberId: 'c', amount: 1000 }] });
  assert.equal(expenseTotalTHB(e, group), 71250);
  const { paid, owed } = expenseShares(e, group);
  assert.deepEqual([paid.b, paid.c], [47500, 23750]);
  assert.equal(sum(owed), 71250);
});

test('missing rate and no actualTHB gives null total', () => {
  assert.equal(expenseTotalTHB(base({ currency: 'KRW', amount: 5000 }), group), null);
});

const mealSplit = {
  type: 'items',
  items: [
    { name: 'สเต๊ก', price: 45000, memberIds: ['a'] },
    { name: 'ข้าวผัด', price: 12000, memberIds: ['b'] },
    { name: 'ส้มตำ', price: 15000, memberIds: ['a', 'b', 'c'] },
  ],
  servicePct: 10, vatPct: 7, billTotal: null,
};

test('itemized meal with service then VAT on top', () => {
  const r = itemsBreakdown(mealSplit, members);
  assert.equal(r.perMember.a.food, 50000);
  assert.equal(r.perMember.b.food, 17000);
  assert.equal(r.perMember.c.food, 5000);
  assert.equal(r.computedTotal, 84744);
  assert.equal(sum(Object.fromEntries(Object.entries(r.perMember).map(([k, v]) => [k, v.total]))), 84744);
  assert.equal(r.diff, 0);
});

test('itemized meal with real bill total spreads difference', () => {
  const split = { ...mealSplit, billTotal: 85000 };
  const r = itemsBreakdown(split, members);
  assert.equal(r.diff, 256);
  const { owed } = expenseShares(base({ amount: 85000, payers: [{ memberId: 'a', amount: 85000 }], split }), group);
  assert.equal(sum(owed), 85000);
});

test('validateExpense catches payer total mismatch', () => {
  const errs = validateExpense(base({ payers: [{ memberId: 'a', amount: 90000 }] }), group);
  assert.ok(errs.some((e) => e.includes('คนจ่าย')));
});

test('validateExpense catches exact total mismatch', () => {
  const errs = validateExpense(base({ split: { type: 'exact', amounts: { a: 10000 } } }), group);
  assert.ok(errs.length > 0);
});

test('validateExpense requires rate or actual baht', () => {
  const errs = validateExpense(base({ currency: 'KRW', amount: 5000, payers: [{ memberId: 'a', amount: 5000 }] }), group);
  assert.ok(errs.some((e) => e.includes('เรต')));
});

test('validateExpense requires at least one person in equal split', () => {
  assert.ok(validateExpense(base({ split: { type: 'equal', memberIds: [] } }), group).length > 0);
});

test('validateExpense requires eaters for each item', () => {
  const split = { ...mealSplit, items: [{ name: 'x', price: 100000, memberIds: [] }] };
  assert.ok(validateExpense(base({ split }), group).length > 0);
});

test('valid expense has no errors', () => {
  assert.deepEqual(validateExpense(base(), group), []);
});

test('itemized bill with real total but no priced dishes is invalid', () => {
  const split = { type: 'items', items: [{ name: 'x', price: 0, memberIds: ['a'] }], servicePct: 0, vatPct: 0, billTotal: 85000 };
  const errs = validateExpense(base({ amount: 85000, payers: [{ memberId: 'a', amount: 85000 }], split }), group);
  assert.ok(errs.some((e) => e.includes('ราคา')));
});

test('validateExpense rejects zero or negative actual baht', () => {
  const krw = { currency: 'KRW', amount: 5000, payers: [{ memberId: 'a', amount: 5000 }] };
  assert.ok(validateExpense(base({ ...krw, actualTHB: 0 }), group).some((e) => e.includes('ยอดบาทจริง')));
  assert.ok(validateExpense(base({ ...krw, actualTHB: -5 }), group).some((e) => e.includes('ยอดบาทจริง')));
  assert.ok(!validateExpense(base({ ...krw, actualTHB: 100 }), group).some((e) => e.includes('ยอดบาทจริง')));
});

test('validateExpense rejects the same person as payer twice', () => {
  const payers = [{ memberId: 'a', amount: 60000 }, { memberId: 'a', amount: 40000 }];
  assert.ok(validateExpense(base({ payers }), group).some((e) => e.includes('คนจ่ายซ้ำ')));
});
