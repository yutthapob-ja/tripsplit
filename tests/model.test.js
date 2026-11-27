import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRemoveMember, newGroup, recentMemberNames } from '../src/core/model.js';

const expenses = [
  { id: 'e1', title: 'ราเมง', payers: [{ memberId: 'a', amount: 1 }], split: { type: 'equal', memberIds: ['a', 'b'] } },
  { id: 'e2', title: 'ซูชิ', payers: [{ memberId: 'a', amount: 1 }], split: { type: 'exact', amounts: { a: 1, c: 0 } } },
  { id: 'e3', title: 'ปิ้งย่าง', payers: [{ memberId: 'a', amount: 1 }], split: { type: 'items', items: [{ price: 1, memberIds: ['d'] }] } },
];

test('member used in equal split cannot be removed', () => {
  const r = canRemoveMember('b', expenses, []);
  assert.equal(r.ok, false);
  assert.deepEqual(r.usedIn, ['ราเมง']);
});

test('payer, exact and itemized references block removal', () => {
  assert.equal(canRemoveMember('a', expenses, []).ok, false);
  assert.deepEqual(canRemoveMember('c', expenses, []).usedIn, ['ซูชิ']);
  assert.deepEqual(canRemoveMember('d', expenses, []).usedIn, ['ปิ้งย่าง']);
});

test('member in a settlement cannot be removed', () => {
  const r = canRemoveMember('z', [], [{ from: 'z', to: 'a', amount: 1 }]);
  assert.equal(r.ok, false);
  assert.ok(r.usedIn.length === 1);
});

test('unreferenced member can be removed', () => {
  assert.deepEqual(canRemoveMember('q', expenses, []), { ok: true, usedIn: [] });
});

test('newGroup builds members with ids and trims names', () => {
  const g = newGroup({ name: ' ญี่ปุ่น ', kind: 'trip', memberNames: ['จา', ' บี ', ''] });
  assert.equal(g.name, 'ญี่ปุ่น');
  assert.deepEqual(g.members.map((m) => m.name), ['จา', 'บี']);
  assert.ok(g.members.every((m) => m.id));
  assert.deepEqual(g.rates, {});
});

test('recentMemberNames returns unique names newest group first', () => {
  const groups = [
    { updatedAt: '2026-01-01', members: [{ name: 'เก่า' }, { name: 'บี' }] },
    { updatedAt: '2026-11-01', members: [{ name: 'บี' }, { name: 'ซี' }] },
  ];
  assert.deepEqual(recentMemberNames(groups), ['บี', 'ซี', 'เก่า']);
});

import { checkMemberEdits, rateUsage, rescaleExpense } from '../src/core/model.js';

test('blanking a referenced member name is blocked', () => {
  const before = [{ id: 'a', name: 'จา' }, { id: 'b', name: 'บี' }, { id: 'q', name: 'คิว' }];
  const after = [{ id: 'a', name: 'จา' }, { id: 'b', name: ' ' }, { id: 'q', name: '' }];
  const r = checkMemberEdits(after, expenses, []);
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('บี') || r.error.includes('ราเมง'));
  void before;
});

test('blanking an unreferenced member name removes them', () => {
  const r = checkMemberEdits([{ id: 'a', name: 'จา' }, { id: 'q', name: '' }], expenses, []);
  assert.equal(r.ok, true);
  assert.deepEqual(r.members.map((m) => m.id), ['a']);
});

test('duplicate names are rejected', () => {
  assert.equal(checkMemberEdits([{ id: 'x', name: 'จา' }, { id: 'y', name: ' จา' }], [], []).ok, false);
});

test('rateUsage counts bills relying on a rate (no actual baht)', () => {
  const ex = [
    { currency: 'JPY', actualTHB: null }, { currency: 'JPY', actualTHB: 500 }, { currency: 'KRW', actualTHB: null },
  ];
  assert.equal(rateUsage('JPY', ex), 1);
  assert.equal(rateUsage('USD', ex), 0);
});

test('rescaleExpense converts minor-unit fields between decimal places', () => {
  const e = { currency: 'THB', amount: 12050, payers: [{ memberId: 'a', amount: 12050 }],
    split: { type: 'items', items: [{ price: 12050, memberIds: ['a'] }], servicePct: 0, vatPct: 0, billTotal: 13000 } };
  const j = rescaleExpense(e, 'THB', 'JPY');
  assert.equal(j.amount, 121);
  assert.equal(j.payers[0].amount, 121);
  assert.equal(j.split.items[0].price, 121);
  assert.equal(j.split.billTotal, 130);
  const back = rescaleExpense({ currency: 'JPY', amount: 120, payers: [], split: { type: 'exact', amounts: { a: 120 } } }, 'JPY', 'THB');
  assert.equal(back.amount, 12000);
  assert.equal(back.split.amounts.a, 12000);
});

import { duplicateGroup } from '../src/core/model.js';

test('duplicateGroup copies members, kind and rates with fresh ids and a copy name', () => {
  const g = { id: 'g1', name: 'โตเกียว', kind: 'trip', members: [{ id: 'a', name: 'จา' }, { id: 'b', name: 'บี' }],
    rates: { JPY: 0.23 }, defaultCurrency: 'THB', createdAt: '2026-01-01', updatedAt: '2026-01-02' };
  const c = duplicateGroup(g);
  assert.notEqual(c.id, g.id);
  assert.equal(c.name, 'โตเกียว (สำเนา)');
  assert.equal(c.kind, 'trip');
  assert.deepEqual(c.members.map((m) => m.name), ['จา', 'บี']);
  assert.ok(c.members.every((m, i) => m.id && m.id !== g.members[i].id));
  assert.deepEqual(c.rates, { JPY: 0.23 });
  c.rates.JPY = 1;
  assert.equal(g.rates.JPY, 0.23); // no shared reference
  assert.notEqual(c.createdAt, g.createdAt);
});
