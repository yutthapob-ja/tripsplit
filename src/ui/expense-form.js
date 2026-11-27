import { h, header, toast, confirmBox } from './dom.js';
import { getAll, getByGroup, put, del } from '../store.js';
import { validateExpense, expenseTotalTHB } from '../core/split.js';
import { parseAmount, formatAmount, toSatang } from '../core/money.js';
import { CURRENCIES, decimalsOf } from '../core/currencies.js';
import { newId, rescaleExpense } from '../core/model.js';
import { go } from '../router.js';

const editors = {};
/** Later modules plug in extra split editors: fn(container, {group, split, currency, onChange(split, amount)}) */
export function registerSplitEditor(type, fn) {
  editors[type] = fn;
}

const today = () => new Date().toLocaleDateString('en-CA');
const toText = (minor, code) => (minor ? formatAmount(minor, code).replace(/,/g, '') : '');

export async function expenseFormView(root, { id, eid }) {
  const group = (await getAll('groups')).find((g) => g.id === id);
  if (!group) return go('#/');
  const existing = await getByGroup('expenses', id);
  const latest = [...existing].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const found = eid ? existing.find((e) => e.id === eid) : null;
  if (eid && !found) return go(`#/g/${id}`);

  const allIds = group.members.map((m) => m.id);
  const firstPayer = latest?.payers?.[0]?.memberId && allIds.includes(latest.payers[0].memberId) ? latest.payers[0].memberId : allIds[0];
  const e = found ? structuredClone(found) : {
    id: newId(), groupId: id, title: '', date: today(),
    currency: latest?.currency || (group.kind === 'trip' && Object.keys(group.rates)[0]) || 'THB',
    amount: 0, payers: [{ memberId: firstPayer, amount: 0 }],
    split: group.kind === 'meal' && editors.items
      ? { type: 'items', items: [], servicePct: 0, vatPct: 0, billTotal: null }
      : { type: 'equal', memberIds: [...allIds] },
    actualTHB: null,
  };
  // keep alternate split states so switching tabs doesn't lose input
  const splits = { equal: { type: 'equal', memberIds: [...allIds] }, exact: { type: 'exact', amounts: {} },
    items: { type: 'items', items: [], servicePct: 0, vatPct: 0, billTotal: null } };
  splits[e.split.type] = e.split;
  const tabAmount = {}; // amount typed while on equal/exact, restored when leaving the items tab

  const name = (mid) => group.members.find((m) => m.id === mid)?.name ?? '?';
  const dec = () => decimalsOf(e.currency);

  // ---- elements
  const titleIn = h('input', { value: e.title, placeholder: 'เช่น ราเมง, ตั๋วรถไฟ', maxlength: 80 });
  const amountIn = h('input.big', { inputmode: 'decimal', placeholder: '0', value: toText(e.amount, e.currency), 'aria-label': 'ยอดเงิน' });
  const currencySel = h('select.shrink', { style: 'width:auto', 'aria-label': 'สกุลเงิน' },
    CURRENCIES.map((c) => h('option', { value: c.code, selected: c.code === e.currency }, c.code)));
  const dateIn = h('input', { type: 'date', value: e.date });
  const fxBox = h('div');
  const payersBox = h('div.stack');
  const splitTabs = h('div.tabs');
  const splitBox = h('div');
  const errBox = h('ul.errors');
  const saveBtn = h('button.btn.primary.block', { type: 'button' }, 'บันทึก');

  // ---- amount & currency
  function setAmount(minor, { fromEditor = false } = {}) {
    e.amount = minor || 0;
    if (e.payers.length === 1) e.payers[0].amount = e.amount;
    if (fromEditor) amountIn.value = toText(e.amount, e.currency);
    drawFx(); drawPayers(); refresh();
  }
  amountIn.addEventListener('input', () => {
    if (e.split.type === 'items') return;
    setAmount(parseAmount(amountIn.value, dec()) ?? 0);
  });
  currencySel.addEventListener('change', () => {
    const from = e.currency, to = currencySel.value;
    const r = rescaleExpense({ ...e, split: e.split }, from, to);
    for (const k of Object.keys(splits)) splits[k] = k === e.split.type ? r.split : rescaleExpense({ amount: 0, payers: [], split: splits[k] }, from, to).split;
    Object.assign(e, { currency: to, amount: r.amount, payers: r.payers, split: splits[e.split.type], actualTHB: null });
    for (const k of Object.keys(tabAmount)) tabAmount[k] = rescaleExpense({ amount: tabAmount[k], payers: [], split: {} }, from, to).amount;
    amountIn.value = toText(e.amount, e.currency);
    drawFx(); drawPayers(); drawSplit(); refresh();
  });

  function drawFx() {
    if (e.currency === 'THB') return fxBox.replaceChildren();
    const rate = group.rates[e.currency];
    const est = rate > 0 ? toSatang(e.amount, e.currency, rate) : null;
    const actualIn = h('input', { inputmode: 'decimal', placeholder: est != null ? formatAmount(est, 'THB') : 'ใส่ยอดบาท',
      value: e.actualTHB != null ? toText(e.actualTHB, 'THB') : '', 'aria-label': 'ยอดบาทจริง' });
    actualIn.addEventListener('input', () => {
      const v = parseAmount(actualIn.value, 2);
      e.actualTHB = actualIn.value.trim() === '' ? null : v;
      refresh();
    });
    fxBox.replaceChildren(h('div.card.pad',
      h('div.sub', rate > 0 ? `≈ ฿${formatAmount(est, 'THB')} ตามเรตกลาง (1 ${e.currency} = ${rate} บาท)` :
        h('span', 'ยังไม่ได้ตั้งเรต ', h('a', { href: `#/g/${id}/settings`, style: 'color:var(--accent);font-weight:600' }, 'ตั้งเรต'), ' หรือใส่ยอดบาทจริง')),
      h('label.field', { style: 'margin-bottom:0' }, h('span', 'ยอดบาทจริง (ถ้ารู้ เช่น จากแจ้งเตือนบัตร)'), actualIn)));
  }

  // ---- payers
  function drawPayers() {
    const multi = e.payers.length > 1;
    const rows = e.payers.map((p, i) => {
      const sel = h('select', { 'aria-label': 'คนจ่าย', on: { change: (ev) => { p.memberId = ev.target.value; refresh(); } } },
        group.members.map((m) => h('option', { value: m.id, selected: m.id === p.memberId }, m.name)));
      if (!multi) return h('div.inline', h('span.shrink.muted', 'จ่ายโดย'), sel);
      const amt = h('input', { inputmode: 'decimal', value: toText(p.amount, e.currency), placeholder: '0', 'aria-label': 'ยอดที่จ่าย',
        on: { input: (ev) => { p.amount = parseAmount(ev.target.value, dec()) ?? 0; drawPayersHint(); refresh(); } } });
      return h('div.inline', sel, amt,
        h('button.icon-btn.small.shrink', { type: 'button', 'aria-label': 'เอาออก', on: { click: () => {
          e.payers.splice(i, 1);
          if (e.payers.length === 1) e.payers[0].amount = e.amount;
          drawPayers(); refresh();
        } } }, '✕'));
    });
    const unused = allIds.filter((mid) => !e.payers.some((p) => p.memberId === mid));
    payersBox.replaceChildren(...rows, h('div', { id: 'payers-hint' }),
      unused.length ? h('button.btn.small', { type: 'button', on: { click: () => {
        if (e.payers.length === 1) e.payers[0].amount = e.amount;
        e.payers.push({ memberId: unused[0], amount: 0 });
        drawPayers(); refresh();
      } } }, '+ คนจ่ายเพิ่ม') : null);
    drawPayersHint();
  }
  function drawPayersHint() {
    const el = payersBox.querySelector('#payers-hint');
    if (!el || e.payers.length < 2) return el?.replaceChildren();
    const left = e.amount - e.payers.reduce((s, p) => s + p.amount, 0);
    el.replaceChildren(h('p.hint', { class: left ? 'neg' : 'pos' },
      left === 0 ? 'ยอดคนจ่ายครบพอดี' : left > 0 ? `ยังขาด ${formatAmount(left, e.currency)}` : `เกิน ${formatAmount(-left, e.currency)}`));
  }

  // ---- split
  function drawSplit() {
    const types = [['equal', 'หารเท่ากัน'], ['exact', 'ระบุจำนวน']];
    if (editors.items) types.push(['items', 'ทีละจาน']);
    splitTabs.replaceChildren(...types.map(([k, t]) => h('button', { type: 'button', class: e.split.type === k ? 'on' : '',
      on: { click: () => {
        if (k === e.split.type) return;
        if (e.split.type !== 'items') tabAmount.manual = e.amount;
        e.split = splits[k];
        amountIn.readOnly = k === 'items';
        if (k !== 'items' && tabAmount.manual != null) setAmount(tabAmount.manual, { fromEditor: true });
        drawSplit(); refresh();
      } } }, t)));
    amountIn.readOnly = e.split.type === 'items';
    const s = e.split;
    if (s.type === 'equal') {
      const chips = h('div.chips');
      const drawChips = () => {
        chips.replaceChildren(
          h('button.chip', { type: 'button', class: s.memberIds.length === allIds.length ? 'on' : '',
            on: { click: () => { s.memberIds = s.memberIds.length === allIds.length ? [] : [...allIds]; drawChips(); refresh(); } } }, 'ทุกคน'),
          ...group.members.map((m) => h('button.chip', { type: 'button', class: s.memberIds.includes(m.id) ? 'on' : '',
            on: { click: () => {
              s.memberIds = s.memberIds.includes(m.id) ? s.memberIds.filter((x) => x !== m.id) : [...s.memberIds, m.id];
              drawChips(); refresh();
            } } }, m.name)));
      };
      drawChips();
      const each = h('p.hint');
      const upd = () => { each.textContent = s.memberIds.length ? `คนละ ~${formatAmount(Math.round(e.amount / s.memberIds.length), e.currency)} ${e.currency}` : ''; };
      splitBox.replaceChildren(chips, each);
      splitBox._update = upd;
    } else if (s.type === 'exact') {
      const hint = h('p.hint');
      const upd = () => {
        const left = e.amount - Object.values(s.amounts).reduce((a, b) => a + (b || 0), 0);
        hint.className = 'hint ' + (left ? 'neg' : 'pos');
        hint.textContent = left === 0 ? 'ครบพอดี' : left > 0 ? `เหลือ ${formatAmount(left, e.currency)}` : `เกิน ${formatAmount(-left, e.currency)}`;
      };
      splitBox.replaceChildren(h('ul.list.card', group.members.map((m) => h('li.row',
        h('div.grow.title', m.name),
        h('input', { style: 'max-width:150px;text-align:right', inputmode: 'decimal', placeholder: '0', value: toText(s.amounts[m.id], e.currency),
          'aria-label': 'ยอดของ ' + m.name,
          on: { input: (ev) => { const v = parseAmount(ev.target.value, dec()); if (v) s.amounts[m.id] = v; else delete s.amounts[m.id]; refresh(); } } })))), hint);
      splitBox._update = upd;
    } else if (s.type === 'items' && editors.items) {
      const c = h('div');
      splitBox.replaceChildren(c);
      splitBox._update = null;
      editors.items(c, { group, split: s, currency: e.currency, onChange: (split, amount) => {
        e.split = splits.items = split;
        setAmount(amount, { fromEditor: true });
      } });
    }
  }

  function refresh() {
    e.title = titleIn.value.trim();
    e.date = dateIn.value || today();
    splitBox._update?.();
    const errs = e.amount > 0 ? validateExpense(e, group) : ['ใส่ยอดเงิน'];
    errBox.replaceChildren(...(e.amount > 0 ? errs : []).map((x) => h('li', x)));
    saveBtn.disabled = errs.length > 0;
  }
  titleIn.addEventListener('input', refresh);
  dateIn.addEventListener('change', refresh);

  saveBtn.addEventListener('click', async () => {
    refresh();
    if (saveBtn.disabled) return;
    if (!e.title) e.title = e.split.type === 'items' ? 'ค่าอาหาร' : 'ค่าใช้จ่าย';
    const now = new Date().toISOString();
    e.createdAt = e.createdAt || now;
    e.updatedAt = now;
    if (e.split.type === 'exact') e.split.amounts = Object.fromEntries(Object.entries(e.split.amounts).filter(([, v]) => v > 0));
    await put('expenses', e);
    await put('groups', { ...group, updatedAt: now });
    toast(expenseTotalTHB(e, group) != null ? 'บันทึกแล้ว' : 'บันทึกแล้ว (ยังไม่มีเรต)');
    go(`#/g/${id}`);
  });

  drawFx(); drawPayers(); drawSplit(); refresh();
  root.append(
    header(found ? 'แก้บิล' : 'เพิ่มบิล', { back: `#/g/${id}` }),
    h('div.inline', { style: 'margin-top:8px' }, amountIn, currencySel),
    h('label.field', h('span', 'ชื่อบิล'), titleIn),
    fxBox,
    h('h2', 'ใครจ่าย'), payersBox,
    h('h2', 'หารยังไง'), splitTabs, splitBox,
    h('label.field', h('span', 'วันที่'), dateIn),
    errBox, saveBtn,
    found ? h('div', { style: 'margin-top:12px' }, h('button.btn.danger.block', { type: 'button', on: { click: async () => {
      if (!(await confirmBox('ลบบิลนี้?'))) return;
      await del('expenses', e.id);
      go(`#/g/${id}`);
    } } }, 'ลบบิล')) : '',
  );
  if (!found) amountIn.focus();
}
