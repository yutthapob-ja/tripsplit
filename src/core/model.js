import { rescaleMinor } from './money.js';
export function newId() {
  return crypto.randomUUID();
}

export function newGroup({ name, kind, memberNames }) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: name.trim(),
    kind,
    members: memberNames.map((n) => n.trim()).filter(Boolean).map((n) => ({ id: newId(), name: n })),
    rates: {},
    defaultCurrency: 'THB',
    createdAt: now,
    updatedAt: now,
  };
}

/** A member can be removed only if no expense or settlement references them. */
export function canRemoveMember(memberId, expenses, settlements) {
  const usedIn = [];
  for (const e of expenses) {
    const s = e.split || {};
    const refs = [
      ...(e.payers || []).map((p) => p.memberId),
      ...(s.memberIds || []),
      ...Object.keys(s.amounts || {}),
      ...(s.items || []).flatMap((it) => it.memberIds || []),
    ];
    if (refs.includes(memberId)) usedIn.push(e.title || 'บิลไม่มีชื่อ');
  }
  for (const st of settlements) {
    if (st.from === memberId || st.to === memberId) usedIn.push('การโอนคืน');
  }
  return { ok: usedIn.length === 0, usedIn };
}

/** Unique member names, newest group first. */
export function recentMemberNames(groups) {
  const sorted = [...groups].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return [...new Set(sorted.flatMap((g) => g.members.map((m) => m.name)))];
}

/** Validate edited member list: trims, drops blank-named unreferenced members, rejects duplicates. */
export function checkMemberEdits(members, expenses, settlements) {
  const kept = [];
  for (const m of members) {
    const name = (m.name || '').trim();
    if (name) { kept.push({ ...m, name }); continue; }
    const r = canRemoveMember(m.id, expenses, settlements);
    if (!r.ok) return { ok: false, error: `ชื่อว่างไม่ได้ — คนนี้อยู่ในบิล: ${r.usedIn.slice(0, 3).join(', ')}` };
  }
  const names = kept.map((m) => m.name);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) return { ok: false, error: `มีชื่อ “${dup}” ซ้ำกัน` };
  return { ok: true, members: kept };
}

/** Number of bills that depend on the group rate for `code` (no actual baht). */
export function rateUsage(code, expenses) {
  return expenses.filter((e) => e.currency === code && e.actualTHB == null).length;
}

/** Copy of an expense with every minor-unit field re-expressed for a new currency. */
export function rescaleExpense(e, fromCode, toCode) {
  const r = (v) => rescaleMinor(v, fromCode, toCode);
  const out = structuredClone(e);
  out.amount = r(out.amount);
  out.payers = (out.payers || []).map((p) => ({ ...p, amount: r(p.amount) }));
  const s = out.split || {};
  if (s.amounts) s.amounts = Object.fromEntries(Object.entries(s.amounts).map(([k, v]) => [k, r(v)]));
  if (s.items) s.items = s.items.map((it) => ({ ...it, price: r(it.price) }));
  if (s.billTotal != null) s.billTotal = r(s.billTotal);
  return out;
}
