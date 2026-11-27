import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balances, simplify } from '../src/core/balance.js';

const members = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
const group = { id: 'g', name: 'โตเกียว', members, rates: { JPY: 0.23 } };
const exp = (over) => ({ id: Math.random().toString(36), groupId: 'g', title: 't', currency: 'THB', amount: 90000,
  payers: [{ memberId: 'a', amount: 90000 }], split: { type: 'equal', memberIds: ['a', 'b', 'c'] }, actualTHB: null, ...over });
const total = (b) => Object.values(b).reduce((x, y) => x + y, 0);

test('one payer equal split gives creditor and two debtors', () => {
  const b = balances(group, [exp()], []);
  assert.deepEqual(b, { a: 60000, b: -30000, c: -30000 });
  const t = simplify(b);
  assert.equal(t.length, 2);
  assert.ok(t.every((x) => x.to === 'a' && x.amount === 30000));
});

test('debt chain collapses to one transfer', () => {
  assert.deepEqual(simplify({ a: -10000, b: 0, c: 10000 }), [{ from: 'a', to: 'c', amount: 10000 }]);
});

test('recorded settlement clears that debt', () => {
  const b = balances(group, [exp()], [{ id: 's', groupId: 'g', from: 'b', to: 'a', amount: 30000 }]);
  assert.equal(b.b, 0);
  assert.ok(!simplify(b).some((x) => x.from === 'b'));
});

test('balances sum to zero and simplify settles everyone (random)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const g = { ...group, members: ids.map((id) => ({ id, name: id })) };
  for (let i = 0; i < 100; i++) {
    const expenses = Array.from({ length: 1 + (i % 7) }, () => {
      const amount = 1 + Math.floor(Math.random() * 500000);
      const payer = ids[Math.floor(Math.random() * 5)];
      const who = ids.filter(() => Math.random() < 0.6);
      return exp({ amount, payers: [{ memberId: payer, amount }], split: { type: 'equal', memberIds: who.length ? who : ['a'] } });
    });
    const b = balances(g, expenses, []);
    assert.equal(total(b), 0);
    const t = simplify(b);
    assert.ok(t.length <= ids.length - 1);
    const after = { ...b };
    for (const x of t) { after[x.from] += x.amount; after[x.to] -= x.amount; }
    assert.ok(Object.values(after).every((v) => v === 0));
  }
});

test('changing rate recalculates only expenses without actual baht', () => {
  const e1 = exp({ currency: 'JPY', amount: 3000, payers: [{ memberId: 'a', amount: 3000 }] });
  const e2 = exp({ currency: 'JPY', amount: 3000, payers: [{ memberId: 'b', amount: 3000 }], actualTHB: 70000, split: { type: 'equal', memberIds: ['b', 'c'] } });
  const before = balances(group, [e1, e2], []);
  const after = balances({ ...group, rates: { JPY: 0.25 } }, [e1, e2], []);
  assert.equal(before.a, 46000);
  assert.equal(after.a, 50000);
  assert.equal(before.b, 35000 - 23000); // e2 fixed at actual baht; only e1 share moves
  assert.equal(after.b, 35000 - 25000);
});
