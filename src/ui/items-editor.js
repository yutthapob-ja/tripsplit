import { h } from './dom.js';
import { registerSplitEditor } from './expense-form.js';
import { itemsBreakdown } from '../core/split.js';
import { parseAmount, formatAmount } from '../core/money.js';
import { decimalsOf } from '../core/currencies.js';

const pctNum = (t) => {
  const n = Number(String(t).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function itemsEditor(container, { group, split, currency, onChange }) {
  const dec = decimalsOf(currency);
  const fmt = (m) => `${formatAmount(m, currency)} ${currency}`;
  const toText = (minor) => (minor ? formatAmount(minor, currency).replace(/,/g, '') : '');

  // working copy (never mutate the caller's object)
  const s = {
    type: 'items',
    items: (split.items || []).map((it) => ({ name: it.name || '', price: it.price || 0, memberIds: [...(it.memberIds || [])] })),
    servicePct: split.servicePct || 0,
    vatPct: split.vatPct || 0,
    billTotal: split.billTotal ?? null,
  };
  if (!s.items.length) s.items.push({ name: '', price: 0, memberIds: [] });

  // raw price text per dish, so "12." survives while typing
  const priceText = new WeakMap();
  s.items.forEach((it) => priceText.set(it, toText(it.price)));

  const allIds = group.members.map((m) => m.id);

  const listBox = h('ul.list');
  const summaryBox = h('div');

  const serviceIn = h('input', { inputmode: 'decimal', placeholder: '0', value: s.servicePct ? String(s.servicePct) : '', 'aria-label': 'Service %' });
  const vatIn = h('input', { inputmode: 'decimal', placeholder: '0', value: s.vatPct ? String(s.vatPct) : '', 'aria-label': 'VAT %' });
  const scBtn = h('button.btn.small.shrink', { type: 'button' }, 'SC 10%');
  const vatBtn = h('button.btn.small.shrink', { type: 'button' }, 'VAT 7%');
  const billIn = h('input', { inputmode: 'decimal', placeholder: 'ไม่ระบุ', value: toText(s.billTotal ?? 0), 'aria-label': 'ยอดบิลจริง' });

  function emit() {
    const bd = itemsBreakdown(s, group.members);
    const amount = s.billTotal ?? bd.computedTotal;
    onChange(s, amount);
    return bd;
  }

  function drawSummary(bd) {
    bd = bd || itemsBreakdown(s, group.members);
    const rows = group.members.filter((m) => bd.perMember[m.id]).map((m) => {
      const v = bd.perMember[m.id];
      const parts = [`อาหาร ${formatAmount(v.food, currency)}`];
      if (s.servicePct) parts.push(`Service ${formatAmount(v.service, currency)}`);
      if (s.vatPct) parts.push(`VAT ${formatAmount(v.vat, currency)}`);
      return h('li.row', h('div.grow', h('div.title', m.name), h('div.sub', parts.join(' / '))),
        h('div.amt', h('b', fmt(v.total))));
    });
    const kids = [];
    if (rows.length) kids.push(h('ul.list.card', rows));
    else kids.push(h('p.hint', 'เลือกคนกินแต่ละจานเพื่อดูยอดรายคน'));
    kids.push(h('p.hint', `ยอดคำนวณ: ${fmt(bd.computedTotal)}`));
    if (s.billTotal != null && bd.diff !== 0) {
      kids.push(h('p.hint', { class: bd.diff > 0 ? 'pos' : 'neg' },
        `ต่าง ${fmt(Math.abs(bd.diff))} (เฉลี่ยตามสัดส่วนแล้ว)`));
    }
    summaryBox.replaceChildren(...kids);
  }

  function update() { drawSummary(emit()); }

  function drawList(focusLast) {
    let lastPrice = null;
    listBox.replaceChildren(...s.items.map((it, idx) => {
      const nameIn = h('input', { value: it.name, placeholder: 'ชื่อจาน', maxlength: 60, 'aria-label': 'ชื่อจาน',
        on: { input: (ev) => { it.name = ev.target.value; emit(); } } });
      const priceIn = h('input.shrink', { inputmode: 'decimal', placeholder: 'ราคา', value: priceText.get(it) ?? '',
        style: 'width:110px;text-align:right', 'aria-label': 'ราคา',
        on: { input: (ev) => {
          priceText.set(it, ev.target.value);
          it.price = parseAmount(ev.target.value, dec) ?? 0;
          update();
        } } });
      lastPrice = priceIn;
      const chips = h('div.chips');
      const drawChips = () => {
        const all = it.memberIds.length === allIds.length && allIds.length > 0;
        chips.replaceChildren(
          h('button.chip', { type: 'button', class: all ? 'on' : '',
            on: { click: () => { it.memberIds = all ? [] : [...allIds]; drawChips(); update(); } } }, 'ทุกคน'),
          ...group.members.map((m) => h('button.chip', { type: 'button', class: it.memberIds.includes(m.id) ? 'on' : '',
            on: { click: () => {
              it.memberIds = it.memberIds.includes(m.id) ? it.memberIds.filter((x) => x !== m.id) : [...it.memberIds, m.id];
              drawChips(); update();
            } } }, m.name)));
      };
      drawChips();
      return h('li', { style: 'padding:12px 14px' },
        h('div.inline', nameIn, priceIn,
          h('button.icon-btn.small.shrink', { type: 'button', 'aria-label': `ลบจานที่ ${idx + 1}`,
            on: { click: () => {
              s.items.splice(idx, 1);
              if (!s.items.length) { const d = { name: '', price: 0, memberIds: [] }; priceText.set(d, ''); s.items.push(d); }
              drawList(); update();
            } } }, '✕')),
        h('div', { style: 'margin-top:8px' }, chips));
    }));
    if (focusLast && lastPrice) lastPrice.focus();
  }

  const addBtn = h('button.btn.block', { type: 'button', on: { click: () => {
    const d = { name: '', price: 0, memberIds: [] };
    priceText.set(d, '');
    s.items.push(d);
    drawList(true); update();
  } } }, '+ เพิ่มจาน');

  // service / vat
  serviceIn.addEventListener('input', () => { s.servicePct = pctNum(serviceIn.value); update(); });
  vatIn.addEventListener('input', () => { s.vatPct = pctNum(vatIn.value); update(); });
  scBtn.addEventListener('click', () => {
    s.servicePct = s.servicePct === 10 ? 0 : 10;
    serviceIn.value = s.servicePct ? '10' : '';
    update();
  });
  vatBtn.addEventListener('click', () => {
    s.vatPct = s.vatPct === 7 ? 0 : 7;
    vatIn.value = s.vatPct ? '7' : '';
    update();
  });
  billIn.addEventListener('input', () => {
    const t = billIn.value.trim();
    const v = t ? parseAmount(t, dec) : null;
    s.billTotal = v;
    update();
  });

  container.replaceChildren(
    h('div.card', listBox),
    h('div', { style: 'margin:10px 0' }, addBtn),
    h('div.inline', { style: 'margin:10px 0' },
      h('label.field', { style: 'margin:0' }, h('span', 'Service %'), h('div.inline', serviceIn, scBtn)),
      h('label.field', { style: 'margin:0' }, h('span', 'VAT %'), h('div.inline', vatIn, vatBtn))),
    summaryBox,
    h('label.field', h('span', 'ยอดบิลจริง (ถ้าต่างจากที่คำนวณ)'), billIn));

  drawList();
  update();
}

registerSplitEditor('items', itemsEditor);
