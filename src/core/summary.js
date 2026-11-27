import { balances, simplify, roundBalances } from './balance.js';
import { expenseShares, expenseTotalTHB } from './split.js';
import { formatAmount } from './money.js';
import { categoryTotals } from './categories.js';
import { lookupPromptPay } from './contacts.js';
import { normalizePromptPay, promptPayPayload } from './promptpay.js';

/** Thai plain-text summary for pasting into LINE. */
export function summaryText(group, expenses, settlements, { roundBaht = false } = {}) {
  const fmt = (satang) =>
    roundBaht ? Math.round(satang / 100).toLocaleString('en-US') : formatAmount(satang, 'THB');
  const name = (id) => group.members.find((m) => m.id === id)?.name ?? '?';
  const paid = {}, owed = {};
  let total = 0;
  let missing = 0;
  for (const e of expenses) {
    const t = expenseTotalTHB(e, group);
    if (t == null) { missing++; continue; }
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
  const bal = balances(group, expenses, settlements);
  const transfers = simplify(roundBaht ? roundBalances(bal) : bal);
  lines.push('');
  if (!transfers.length) {
    lines.push('เคลียร์ครบแล้ว 🎉');
  } else {
    lines.push('💸 ต้องโอน');
    for (const t of transfers) lines.push(`${name(t.from)} → ${name(t.to)} ฿${fmt(t.amount)}`);
  }
  if (missing) lines.push('', `⚠️ ยังไม่รวม ${missing} บิลที่ไม่มีเรตแลกเงิน`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Structured summary for rendering (e.g. the shareable image). Amounts in satang. */
export function summaryModel(group, expenses, settlements, promptpayBook = {}, { roundBaht = false } = {}) {
  let total = 0;
  let missing = 0;
  for (const e of expenses) {
    const t = expenseTotalTHB(e, group);
    if (t == null) missing++;
    else total += t;
  }
  const raw = balances(group, expenses, settlements);
  const bal = roundBaht ? roundBalances(raw) : raw;
  const member = (id) => group.members.find((m) => m.id === id) || { id, name: '?' };
  return {
    title: group.name,
    kind: group.kind,
    total,
    avg: Math.round(total / Math.max(1, group.members.length)),
    missing,
    categories: categoryTotals(group, expenses),
    members: group.members.map((m) => ({ id: m.id, name: m.name, net: bal[m.id] || 0 })),
    transfers: simplify(bal).map((t) => {
      const to = member(t.to);
      const target = normalizePromptPay(lookupPromptPay(promptpayBook, to.name) || '');
      return {
        from: t.from, to: t.to, fromName: member(t.from).name, toName: to.name, amount: t.amount,
        payload: target ? promptPayPayload(target, t.amount) : null,
      };
    }),
  };
}
