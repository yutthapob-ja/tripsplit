import { expenseShares } from './split.js';

/** Net satang per member: positive = should receive. Sums to 0. */
export function balances(group, expenses, settlements) {
  const b = Object.fromEntries(group.members.map((m) => [m.id, 0]));
  const add = (id, v) => (b[id] = (b[id] || 0) + v);
  for (const e of expenses) {
    const { owed, paid } = expenseShares(e, group);
    for (const [id, v] of Object.entries(paid)) add(id, v);
    for (const [id, v] of Object.entries(owed)) add(id, -v);
  }
  for (const s of settlements) {
    add(s.from, s.amount);
    add(s.to, -s.amount);
  }
  return b;
}

/** Greedy: biggest debtor pays biggest creditor until all settled. */
export function simplify(bal) {
  const debt = Object.entries(bal).filter(([, v]) => v < 0).map(([id, v]) => [id, -v]);
  const cred = Object.entries(bal).filter(([, v]) => v > 0).map(([id, v]) => [id, v]);
  const out = [];
  while (debt.length && cred.length) {
    debt.sort((x, y) => y[1] - x[1]);
    cred.sort((x, y) => y[1] - x[1]);
    const d = debt[0], c = cred[0];
    const amt = Math.min(d[1], c[1]);
    out.push({ from: d[0], to: c[0], amount: amt });
    d[1] -= amt;
    c[1] -= amt;
    if (!d[1]) debt.shift();
    if (!c[1]) cred.shift();
  }
  return out;
}
