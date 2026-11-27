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

test('rounded summary transfers still add up to the creditor amount', () => {
  const s = summaryText(group, [e], [], { roundBaht: true });
  const amts = [...s.matchAll(/→ .* ฿([\d,.]+)/g)].map((m) => m[1]);
  assert.ok(amts.length > 0);
  assert.ok(amts.every((a) => !a.includes('.')));
  assert.equal(amts.reduce((x, a) => x + Number(a.replace(/,/g, '')), 0), 667);
});

import { summaryModel } from '../src/core/summary.js';

test('summaryModel gives totals, per-member net, transfers with PromptPay payload when known', () => {
  const m = summaryModel(group, [e], [], { 'จา': '0812345678' });
  assert.equal(m.title, 'โตเกียว');
  assert.equal(m.total, 100000);
  assert.equal(m.avg, 33333);
  assert.deepEqual(m.members.map((x) => [x.name, x.net]), [['จา', 66666], ['บี', -33333], ['ซี', -33333]]);
  assert.equal(m.transfers.length, 2);
  assert.ok(m.transfers.every((t) => t.toName === 'จา' && t.payload && t.payload.includes('011300668123456785')));
  assert.equal(m.missing, 0);
  assert.ok(Array.isArray(m.categories));
});

test('summaryModel leaves payload null when receiver has no PromptPay, honours roundBaht', () => {
  const m = summaryModel(group, [e], [], {}, { roundBaht: true });
  assert.ok(m.transfers.every((t) => t.payload === null && t.amount % 100 === 0));
  assert.equal(m.transfers.reduce((s, t) => s + t.amount, 0), 66700);
});
