import { decimalsOf } from './currencies.js';

/** Parse user text into integer minor units; null if invalid. */
export function parseAmount(text, decimals) {
  if (typeof text !== 'string') return null;
  const s = text.replace(/[,\s฿$¥€£₩]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  if (frac.length > decimals) return null;
  return Number(int) * 10 ** decimals + Number(frac.padEnd(decimals, '0') || 0);
}

export function formatAmount(minor, code) {
  const d = decimalsOf(code);
  return (minor / 10 ** d).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Largest-remainder split of integer total by weights; always sums to total. */
export function allocate(total, weights) {
  const n = weights.length;
  if (n === 0) return [];
  let w = weights.map((x) => Math.max(0, x));
  let sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    w = w.map(() => 1);
    sum = n;
  }
  const raw = w.map((x) => (total * x) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => [r - Math.floor(r), i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) out[order[k][1]]++;
  return out;
}

/** Convert minor units of `code` to satang at `rate` (THB per 1 major unit). */
export function toSatang(minor, code, rate) {
  if (code === 'THB') return minor;
  return Math.round((minor * rate * 100) / 10 ** decimalsOf(code));
}

/** Re-express an amount in minor units of `toCode` (same major value). */
export function rescaleMinor(minor, fromCode, toCode) {
  const diff = decimalsOf(toCode) - decimalsOf(fromCode);
  if (diff === 0 || minor == null) return minor;
  return diff > 0 ? minor * 10 ** diff : Math.round(minor / 10 ** -diff);
}
