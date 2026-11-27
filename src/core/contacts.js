// PromptPay address book: { [member name, trimmed]: normalized id }

export function lookupPromptPay(book, name) {
  return book?.[String(name || '').trim()] ?? null;
}

export function setPromptPay(book, name, id) {
  const key = String(name || '').trim();
  const next = { ...(book || {}) };
  if (id) next[key] = id;
  else delete next[key];
  return next;
}
