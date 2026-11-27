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
