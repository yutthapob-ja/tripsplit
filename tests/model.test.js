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
