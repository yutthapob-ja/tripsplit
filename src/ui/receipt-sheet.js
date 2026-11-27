import { h, toast } from './dom.js';
import { formatAmount } from '../core/money.js';
import { decimalsOf } from '../core/currencies.js';
import { parseReceiptText } from '../core/receipt.js';

/** Full-screen "paste receipt text" sheet; calls onApply({ items, servicePct, vatPct, total }) with the checked dishes. */
export function openReceiptSheet({ currency, onApply }) {
  const dec = decimalsOf(currency);
  const fmt = (m) => `${formatAmount(m, currency)} ${currency}`;
  const sheet = h('div.qr-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'วางจากใบเสร็จ' });
  const prevFocus = document.activeElement;
  let parsed = null;
  let rows = []; // { item, checked }
  let timer;

  function close() {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    document.body.classList.remove('qr-open');
    if (prevFocus?.focus) try { prevFocus.focus(); } catch { /* ignore */ }
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  const ta = h('textarea', { placeholder: 'วางข้อความใบเสร็จที่นี่', 'aria-label': 'ข้อความใบเสร็จ', autofocus: true, rows: 7,
    style: 'width:100%;min-height:150px;box-sizing:border-box;font:inherit;padding:12px;border-radius:16px;border:1px solid var(--line);background:var(--card);color:var(--text)' });
  const pasteBtn = h('button.btn.block', { type: 'button', on: { click: async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) throw new Error('empty');
      ta.value = t;
      refresh();
    } catch { toast('แตะค้างในช่องแล้วเลือก "วาง"'); }
  } } }, 'วางจากคลิปบอร์ด');
  const previewBox = h('div.stack');
  const applyBtn = h('button.btn.primary.block', { type: 'button', disabled: true, on: { click: () => {
    const items = checked().map((r) => ({ name: r.item.name.trim(), price: r.item.price }));
    if (!items.length) return;
    const p = parsed || {};
    close();
    onApply({ items, servicePct: p.servicePct ?? null, vatPct: p.vatPct ?? null, total: p.total ?? null });
  } } }, 'ใส่ 0 รายการ');

  const checked = () => rows.filter((r) => r.checked);

  function summaryNodes() {
    const p = parsed;
    const out = [];
    const foodSum = checked().reduce((a, r) => a + r.item.price, 0);
    const svc = p.servicePct ? Math.round((foodSum * p.servicePct) / 100) : 0;
    const vat = p.vatPct ? Math.round(((foodSum + svc) * p.vatPct) / 100) : 0;
    if (p.servicePct != null) out.push(h('div', `Service ${p.servicePct}%${p.service != null ? ` (${fmt(p.service)})` : ''}`));
    if (p.vatPct != null) out.push(h('div', `VAT ${p.vatPct}%${p.vat != null ? ` (${fmt(p.vat)})` : ''}`));
    if (p.total != null) {
      out.push(h('div', h('b', `ยอดรวมในใบเสร็จ ${fmt(p.total)}`)));
      const diff = foodSum + svc + vat - p.total;
      if (checked().length && diff !== 0) {
        out.push(h('p.hint', `ต่างจากใบเสร็จ ${fmt(Math.abs(diff))} — ปรับให้ตรงตอนบันทึกได้`));
      }
    }
    return out;
  }

  function updateFooter() {
    const n = checked().length;
    applyBtn.disabled = n === 0;
    applyBtn.textContent = `ใส่ ${n} รายการ`;
    const box = previewBox.querySelector('.rs-summary');
    if (box && parsed) box.replaceChildren(...summaryNodes());
  }

  function refresh() {
    clearTimeout(timer);
    const text = ta.value;
    parsed = text.trim() ? parseReceiptText(text, dec) : null;
    rows = parsed ? parsed.items.map((item) => ({ item: { ...item }, checked: true })) : [];
    if (!text.trim()) {
      previewBox.replaceChildren();
    } else if (!rows.length) {
      previewBox.replaceChildren(h('p.hint', '🤔 ยังหาเมนูกับราคาไม่เจอ ลองคัดลอกใหม่ทั้งใบ'));
    } else {
      previewBox.replaceChildren(
        h('ul.list.card', rows.map((r, i) => h('li.row', { style: 'gap:10px;align-items:center' },
          h('input', { type: 'checkbox', checked: true, 'aria-label': `เลือกรายการที่ ${i + 1}`,
            style: 'width:22px;height:22px;flex:none;min-height:0',
            on: { change: (ev) => { r.checked = ev.target.checked; updateFooter(); } } }),
          h('input', { value: r.item.name, maxlength: 60, 'aria-label': 'ชื่อจาน', style: 'flex:1;min-width:0',
            on: { input: (ev) => { r.item.name = ev.target.value; } } }),
          h('div.amt', { style: 'white-space:nowrap' }, fmt(r.item.price))))),
        h('div.rs-summary.card.pad.stack'));
    }
    updateFooter();
  }
  ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 150); });

  sheet.append(h('div.qr-inner',
    h('h2', { style: 'margin:0;text-align:center' }, '📋 วางจากใบเสร็จ'),
    h('p.hint', { style: 'text-align:center' }, 'ถ่ายรูปใบเสร็จ → กดค้างที่ตัวหนังสือ → เลือกทั้งหมด → คัดลอก แล้วกลับมาวางที่นี่'),
    ta, pasteBtn, previewBox,
    h('div.qr-actions', applyBtn,
      h('button.btn.block', { type: 'button', on: { click: close } }, 'ยกเลิก'))));
  document.body.append(sheet);
  document.body.classList.add('qr-open');
  document.addEventListener('keydown', onKey);
  setTimeout(() => ta.focus(), 0);
  return { close };
}
