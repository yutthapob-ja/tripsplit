import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryText } from '../src/core/summary.js';

const members = [{ id: 'a', name: 'จา' }, { id: 'b', name: 'บี' }, { id: 'c', name: 'ซี' }];
const group = { id: 'g', name: 'โตเกียว', members, rates: {} };
const e = { id: 'e', groupId: 'g', title: 'ข้าว', currency: 'THB', amount: 100000,
  payers: [{ memberId: 'a', amount: 100000 }], split: { type: 'equal', memberIds: ['a', 'b', 'c'] }, actualTHB: null };

test('summary lists trip name, members and transfers', () => {
  const s = summaryText(group, [e], []);
  assert.ok(s.includes('โตเกียว'));
  assert.ok(s.includes('บี → จา'));
  assert.ok(s.includes('333.33'));
});

test('summary rounds to whole baht when asked', () => {
  const s = summaryText(group, [e], [], { roundBaht: true });
  assert.ok(!/\d\.\d\d/.test(s));
});

test('summary says settled when nothing owed', () => {
  const s = summaryText(group, [], []);
  assert.ok(s.includes('เคลียร์ครบแล้ว'));
});

test('summary warns when some bills have no rate and are excluded', () => {
  const krw = { ...e, id: 'k', currency: 'KRW', amount: 5000, payers: [{ memberId: 'a', amount: 5000 }] };
  const s = summaryText(group, [e, krw], []);
  assert.ok(s.includes('⚠️'));
  assert.ok(s.includes('1 บิล'));
});
