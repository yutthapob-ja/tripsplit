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

/**
 * Round balances to whole baht (multiples of 100 satang) so they still sum to 0:
 * the credit side and debit side each round to the same whole-baht total, then
 * largest remainder spreads it inside each side.
 */
export function roundBalances(bal) {
  const out = Object.fromEntries(Object.keys(bal).map((id) => [id, 0]));
  const side = (sign, total) => {
    const ids = Object.keys(bal).filter((id) => bal[id] * sign > 0);
    const base = ids.map((id) => Math.floor((bal[id] * sign) / 100));
    let extra = total - base.reduce((a, b) => a + b, 0);
    const order = ids.map((id, i) => [i, (bal[id] * sign) % 100]).sort((x, y) => y[1] - x[1]);
    for (const [i] of order) if (extra-- > 0) base[i]++;
    ids.forEach((id, i) => (out[id] = sign * base[i] * 100));
  };
  const credit = Object.values(bal).reduce((a, v) => a + (v > 0 ? v : 0), 0);
  const total = Math.round(credit / 100);
  side(1, total);
  side(-1, total);
  return out;
}
