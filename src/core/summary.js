import { balances, simplify } from './balance.js';
import { expenseShares, expenseTotalTHB } from './split.js';
import { formatAmount } from './money.js';

/** Thai plain-text summary for pasting into LINE. */
export function summaryText(group, expenses, settlements, { roundBaht = false } = {}) {
  const fmt = (satang) =>
    roundBaht ? Math.round(satang / 100).toLocaleString('en-US') : formatAmount(satang, 'THB');
  const name = (id) => group.members.find((m) => m.id === id)?.name ?? '?';
  const paid = {}, owed = {};
  let total = 0;
  for (const e of expenses) {
    const t = expenseTotalTHB(e, group);
    if (t == null) continue;
    total += t;
    const s = expenseShares(e, group);
    for (const [id, v] of Object.entries(s.paid)) paid[id] = (paid[id] || 0) + v;
    for (const [id, v] of Object.entries(s.owed)) owed[id] = (owed[id] || 0) + v;
  }
  const lines = [`🧾 ${group.name}`, `ยอดรวม ฿${fmt(total)}`, ''];
  for (const m of group.members) {
    if (!paid[m.id] && !owed[m.id]) continue;
    lines.push(`• ${m.name}: จ่ายไป ฿${fmt(paid[m.id] || 0)} / ส่วนของตัวเอง ฿${fmt(owed[m.id] || 0)}`);
  }
  const transfers = simplify(balances(group, expenses, settlements));
  lines.push('');
  if (!transfers.length) {
    lines.push('เคลียร์ครบแล้ว 🎉');
  } else {
    lines.push('💸 ต้องโอน');
    for (const t of transfers) lines.push(`${name(t.from)} → ${name(t.to)} ฿${fmt(t.amount)}`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
