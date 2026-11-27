import { allocate, toSatang } from './money.js';

/** Total of an expense in satang, or null when no rate and no actual baht. */
export function expenseTotalTHB(expense, group) {
  if (expense.actualTHB != null) return expense.actualTHB;
  if (expense.currency === 'THB') return expense.amount;
  const rate = group.rates?.[expense.currency];
  if (!(rate > 0)) return null;
  return toSatang(expense.amount, expense.currency, rate);
}

/** Per-member food/service/vat/total (minor units of bill currency). */
export function itemsBreakdown(split, members) {
  const ids = members.map((m) => m.id);
  const food = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const item of split.items || []) {
    const eaters = (item.memberIds || []).filter((id) => id in food);
    if (!eaters.length || !(item.price > 0)) continue;
    allocate(item.price, eaters.map(() => 1)).forEach((v, i) => (food[eaters[i]] += v));
  }
  const foodArr = ids.map((id) => food[id]);
  const foodSum = foodArr.reduce((a, b) => a + b, 0);
  const serviceTotal = Math.round((foodSum * (split.servicePct || 0)) / 100);
  const service = allocate(serviceTotal, foodArr);
  const vatTotal = Math.round(((foodSum + serviceTotal) * (split.vatPct || 0)) / 100);
  const vat = allocate(vatTotal, foodArr.map((f, i) => f + service[i]));
  const perMember = {};
  ids.forEach((id, i) => {
    if (foodArr[i] === 0) return;
    perMember[id] = { food: foodArr[i], service: service[i], vat: vat[i], total: foodArr[i] + service[i] + vat[i] };
  });
  const computedTotal = foodSum + serviceTotal + vatTotal;
  const diff = split.billTotal != null ? split.billTotal - computedTotal : 0;
  return { perMember, computedTotal, diff };
}

function owedWeights(expense, group) {
  const s = expense.split;
  if (s.type === 'equal') return s.memberIds.map((id) => [id, 1]);
  if (s.type === 'exact') return Object.entries(s.amounts || {});
  if (s.type === 'items') {
    return Object.entries(itemsBreakdown(s, group.members).perMember).map(([id, v]) => [id, v.total]);
  }
  return [];
}

function spread(total, pairs) {
  const out = {};
  const vals = allocate(total, pairs.map((p) => p[1]));
  pairs.forEach(([id], i) => {
    if (vals[i]) out[id] = (out[id] || 0) + vals[i];
  });
  return out;
}

/** owed and paid per member in satang; both sum to expenseTotalTHB. */
export function expenseShares(expense, group) {
  const total = expenseTotalTHB(expense, group);
  if (total == null) return { owed: {}, paid: {} };
  return {
    owed: spread(total, owedWeights(expense, group)),
    paid: spread(total, expense.payers.map((p) => [p.memberId, p.amount])),
  };
}

/** Thai error messages; empty when the expense can be saved. */
export function validateExpense(expense, group) {
  const errs = [];
  const memberIds = new Set(group.members.map((m) => m.id));
  if (!(expense.amount > 0)) errs.push('ใส่ยอดเงินมากกว่า 0');
  if (!expense.payers?.length) errs.push('เลือกคนจ่ายอย่างน้อย 1 คน');
  const paidSum = (expense.payers || []).reduce((a, p) => a + (p.amount || 0), 0);
  if (expense.payers?.length && paidSum !== expense.amount) errs.push("ยอดคนจ่ายรวมไม่เท่ากับยอดบิล");
  if (expense.currency !== 'THB' && expense.actualTHB == null && !(group.rates?.[expense.currency] > 0)) {
    errs.push(`ยังไม่ได้ตั้งเรต ${expense.currency} ของกลุ่มนี้ — ตั้งเรต หรือใส่ยอดบาทจริง`);
  }
  if (expense.actualTHB != null && !(expense.actualTHB > 0)) errs.push('ยอดบาทจริงต้องมากกว่า 0');
  const payerIds = (expense.payers || []).map((p) => p.memberId);
  if (new Set(payerIds).size !== payerIds.length) errs.push('มีคนจ่ายซ้ำ — เลือกคนละครั้งเดียว');
  const s = expense.split || {};
  if (s.type === 'equal' && !(s.memberIds || []).length) errs.push('เลือกคนหารอย่างน้อย 1 คน');
  if (s.type === 'exact') {
    const t = Object.values(s.amounts || {}).reduce((a, b) => a + (b || 0), 0);
    if (t !== expense.amount) errs.push("ยอดรายคนรวมไม่เท่ากับยอดบิล");
  }
  if (s.type === 'items') {
    if (!(s.items || []).length) errs.push('ใส่รายการอาหารอย่างน้อย 1 จาน');
    if ((s.items || []).some((it) => !(it.memberIds || []).length)) errs.push('ทุกจานต้องเลือกคนกิน');
    else if (!(itemsBreakdown(s, group.members).computedTotal > 0)) errs.push('ใส่ราคาอาหารอย่างน้อย 1 จาน');
  }
  const refs = [...(expense.payers || []).map((p) => p.memberId), ...(s.memberIds || []), ...Object.keys(s.amounts || {})];
  if (refs.some((id) => !memberIds.has(id))) errs.push('มีชื่อที่ไม่ได้อยู่ในกลุ่มแล้ว');
  return errs;
}
