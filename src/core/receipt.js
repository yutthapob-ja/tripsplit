// Turn receipt text (e.g. copied with iPhone Live Text) into dishes + service/VAT/total.
// Amounts are returned in minor units for the given number of currency decimals.

const CUR = '[¥฿$€£₩]';
const NUM_RE = new RegExp(`-?${CUR}?\\s*(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?!\\s*%)`, 'g');
const NUM_ONLY_RE = new RegExp(`^-?${CUR}?\\s*(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?$`);
const LETTER_RE = /[A-Za-z฀-๿぀-ヿ一-鿿가-힯]/;

const KW = {
  skip: /เงินสด|cash|ทอน|change|รับเงิน|บัตรเครดิต|credit|card|โทร|tel\b|phone|tax ?id|ผู้เสียภาษี|โต๊ะ|table|ขอบคุณ|thank|www|http|ใบเสร็จ|receipt|ใบกำกับ|invoice|cashier|พนักงาน|staff|pos\b|สาขา|branch|qty|จำนวน|คิว|queue|order ?no|เลขที่/i,
  discount: /ส่วนลด|discount/i,
  service: /service|ค่าบริการ|\bs\.?\/?c\b|\bsc\b/i,
  vat: /vat|ภาษี|tax/i,
  subtotal: /sub ?-?total|^รวม(?!สุทธิ)|ยอดรวม(?!สุทธิ)|รวมเงิน|รวมค่าอาหาร/i,
  total: /สุทธิ|grand ?total|\btotal\b|\bnet\b|ทั้งหมด|ยอดชำระ|ต้องชำระ|amount due|合計|お会計/i,
};
const DATE_RE = /\d{1,2}[/:.-]\d{1,2}([/:.-]\d{2,4})?/;

function toMinor(numText, decimals) {
  const v = Number(numText.replace(new RegExp(CUR, 'g'), '').replace(/[,\s]/g, ''));
  return Number.isFinite(v) ? Math.round(Math.abs(v) * 10 ** decimals) : null;
}

function lastAmount(line, decimals) {
  const m = line.match(NUM_RE);
  return m ? toMinor(m[m.length - 1], decimals) : null;
}

function percentIn(line) {
  const m = line.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

/** Split "2 x ชาเย็น" / "3 ส้มตำ" / "โค้ก x2" / "ข้าวเหนียว 2 @20" into {name, qty}. */
function splitQty(raw) {
  let s = raw.replace(new RegExp(`^${CUR}\\s*`), '').trim();
  let m;
  if ((m = s.match(/^(.*?)\s+(\d+)\s*@\s*[\d.,]+$/))) return { name: m[1], qty: +m[2] };
  if ((m = s.match(/^(\d+)\s*[x×X]\s+(.+)$/))) return { name: m[2], qty: +m[1] };
  if ((m = s.match(/^(.+?)\s*[x×X]\s*(\d+)$/))) return { name: m[1], qty: +m[2] };
  if ((m = s.match(/^(\d+)\s+(.+)$/)) && LETTER_RE.test(m[2])) return { name: m[2], qty: +m[1] };
  return { name: s, qty: 1 };
}

function itemName(raw) {
  const { name, qty } = splitQty(raw);
  const clean = name.replace(new RegExp(`${CUR}`, 'g'), '').replace(/\s+/g, ' ').trim();
  return qty > 1 ? `${clean} ×${qty}` : clean;
}

export function parseReceiptText(text, decimals = 2) {
  const out = { items: [], subtotal: null, service: null, vat: null, total: null, discount: null, servicePct: null, vatPct: null };
  let servicePctHint = null;
  let vatPctHint = null;
  const pending = []; // slots waiting for a price on a later number-only line: {kind:'item', name} | {kind: key}
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const assign = (kind, amount) => {
    if (kind === 'item') return;
    if (kind === 'discount') out.discount = amount;
    else out[kind] = amount;
  };

  for (const line of lines) {
    if (NUM_ONLY_RE.test(line)) {
      const slot = pending.shift();
      if (!slot) continue;
      const amount = toMinor(line, decimals);
      if (slot.kind === 'item') { if (amount > 0) out.items.push({ name: slot.name, price: amount }); }
      else assign(slot.kind, amount);
      continue;
    }
    const key = ['skip', 'discount', 'service', 'vat', 'subtotal', 'total'].find((k) => KW[k].test(line));
    if (key === 'skip' || (!key && DATE_RE.test(line) && !LETTER_RE.test(line.replace(DATE_RE, '')))) continue;
    if (key) {
      if (key === 'service') servicePctHint = percentIn(line) ?? servicePctHint;
      if (key === 'vat') vatPctHint = percentIn(line) ?? vatPctHint;
      const amount = lastAmount(line, decimals);
      if (amount != null) assign(key, amount);
      else pending.push({ kind: key });
      continue;
    }
    if (!LETTER_RE.test(line)) continue;
    const nums = line.match(NUM_RE);
    const lastNum = nums?.[nums.length - 1];
    const endsWithNumber = lastNum && line.trimEnd().endsWith(lastNum.trim());
    if (endsWithNumber) {
      const price = toMinor(lastNum, decimals);
      const name = itemName(line.slice(0, line.lastIndexOf(lastNum.trim())).trim());
      if (price > 0 && LETTER_RE.test(name)) {
        pending.length = 0; // anything queued before the first priced dish was header text
        out.items.push({ name, price });
      }
    } else {
      pending.push({ kind: 'item', name: itemName(line) });
    }
  }

  const itemsSum = out.items.reduce((a, i) => a + i.price, 0);
  const base = out.subtotal ?? (itemsSum || null);
  if (out.service != null) out.servicePct = servicePctHint ?? (base ? Math.round((out.service / base) * 1000) / 10 : null);
  if (out.vat != null) out.vatPct = vatPctHint ?? (base ? Math.round((out.vat / (base + (out.service || 0))) * 1000) / 10 : null);
  if (out.total == null && out.subtotal != null && out.service == null && out.vat == null) out.total = out.subtotal;
  return out;
}
