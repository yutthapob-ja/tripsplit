import { categoryOf } from './categories.js';
import { formatAmount } from './money.js';

/** Filter bills by free text (title, payer names, category label, amount) AND optional payer / category. */
export function filterExpenses(expenses, group, { q = '', payer = null, category = null } = {}) {
  const needle = q.trim().toLowerCase();
  const numNeedle = needle.replace(/,/g, '');
  const nameOf = (id) => group.members.find((m) => m.id === id)?.name ?? '';
  return expenses.filter((e) => {
    if (payer && !e.payers.some((p) => p.memberId === payer)) return false;
    if (category && categoryOf(e.category).id !== category) return false;
    if (!needle) return true;
    const amt = formatAmount(e.amount, e.currency);
    const hay = [e.title, ...e.payers.map((p) => nameOf(p.memberId)), categoryOf(e.category).label, amt]
      .join(' ').toLowerCase();
    return hay.includes(needle) || (numNeedle !== '' && /^[\d.]+$/.test(numNeedle) && amt.replace(/,/g, '').includes(numNeedle));
  });
}
