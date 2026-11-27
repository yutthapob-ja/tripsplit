import { h, header, toast } from './dom.js';
import { getAll, getByGroup, put, del } from '../store.js';
import { expenseTotalTHB } from '../core/split.js';
import { balances, simplify } from '../core/balance.js';
import { summaryText } from '../core/summary.js';
import { formatAmount } from '../core/money.js';
import { newId } from '../core/model.js';
import { go } from '../router.js';

const tabState = {};
const THB = (s) => '฿' + formatAmount(s, 'THB');

export async function groupView(root, { id }) {
  const group = (await getAll('groups')).find((g) => g.id === id);
  if (!group) return go('#/');
  const [expenses, settlements] = await Promise.all([getByGroup('expenses', id), getByGroup('settlements', id)]);
  expenses.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const name = (mid) => group.members.find((m) => m.id === mid)?.name ?? '?';
  let tab = tabState[id] || 'bills';
  let roundBaht = false;
  const body = h('div');

  const total = expenses.reduce((s, e) => s + (expenseTotalTHB(e, group) || 0), 0);

  function billsTab() {
    if (!expenses.length) return h('div.empty', h('p', 'ยังไม่มีบิล'), h('p', 'กด “+ เพิ่มบิล” ด้านล่าง'));
    let lastDate = '';
    const items = [];
    for (const e of expenses) {
      if (e.date !== lastDate) {
        lastDate = e.date;
        items.push(h('li.row.sub', { style: 'min-height:36px;padding:8px 16px' }, new Date(e.date + 'T00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })));
      }
      const t = expenseTotalTHB(e, group);
      const payers = e.payers.map((p) => name(p.memberId)).join(', ');
      items.push(h('li', h('a.row', { href: `#/g/${id}/e/${e.id}` },
        h('div.grow', h('div.title', e.title || 'ไม่มีชื่อ'), h('div.sub', `${payers} จ่าย`)),
        h('div.amt',
          e.currency === 'THB' ? h('div', THB(e.amount)) : [h('div', `${formatAmount(e.amount, e.currency)} ${e.currency}`),
            h('div.sub', t == null ? 'ยังไม่ตั้งเรต' : (e.actualTHB != null ? 'จริง ' : '≈ ') + THB(t))]))));
    }
    return h('ul.list.card', items);
  }

  function summaryTab() {
    const bal = balances(group, expenses, settlements);
    const transfers = simplify(bal);
    const box = h('div');
    box.append(
      h('div.card.pad', h('div.sub.muted', 'ยอดรวมทั้งหมด'), h('div.total', THB(total))),
      h('h2', 'ยอดสุทธิรายคน'),
      h('ul.list.card', group.members.map((m) => {
        const v = bal[m.id] || 0;
        return h('li.row', h('div.grow.title', m.name),
          h('div.amt', { class: v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted' }, v > 0 ? `ได้คืน ${THB(v)}` : v < 0 ? `ต้องจ่าย ${THB(-v)}` : 'เคลียร์แล้ว'));
      })),
      h('h2', 'ต้องโอน'),
      transfers.length
        ? h('ul.list.card', transfers.map((t) => h('li.row',
            h('div.grow', h('div.title', `${name(t.from)} → ${name(t.to)}`), h('div.sub', THB(t.amount))),
            h('button.btn.small', { type: 'button', on: { click: async () => {
              await put('settlements', { id: newId(), groupId: id, from: t.from, to: t.to, amount: t.amount, date: new Date().toISOString().slice(0, 10) });
              toast('บันทึกว่าโอนแล้ว');
              go(`#/g/${id}`);
            } } }, 'โอนแล้ว'))))
        : h('div.card.pad.muted', 'เคลียร์ครบแล้ว 🎉'),
      settlements.length ? [h('h2', 'โอนคืนแล้ว'), h('ul.list.card', settlements.map((s) => h('li.row',
        h('div.grow.sub', `${name(s.from)} → ${name(s.to)} ${THB(s.amount)}`),
        h('button.icon-btn.small', { type: 'button', 'aria-label': 'ยกเลิก', on: { click: async () => { await del('settlements', s.id); go(`#/g/${id}`); } } }, '↺'))))] : '',
      h('label.row', { style: 'padding:14px 4px' },
        h('input', { type: 'checkbox', style: 'width:22px;min-height:22px', checked: roundBaht, on: { change: (e) => (roundBaht = e.target.checked) } }),
        h('span', 'ปัดเป็นบาทเต็มตอนคัดลอก')),
      h('button.btn.block', { type: 'button', on: { click: async () => {
        const text = summaryText(group, expenses, settlements, { roundBaht });
        try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว วางในไลน์ได้เลย'); }
        catch { window.prompt('คัดลอกข้อความนี้', text); }
      } } }, '📋 คัดลอกสรุปไปวางไลน์'),
    );
    return box;
  }

  const tabs = h('div.tabs');
  function draw() {
    tabState[id] = tab;
    tabs.replaceChildren(...[['bills', `บิล (${expenses.length})`], ['summary', 'สรุป']].map(([k, t]) =>
      h('button', { type: 'button', class: tab === k ? 'on' : '', on: { click: () => { tab = k; draw(); } } }, t)));
    body.replaceChildren(tab === 'bills' ? billsTab() : summaryTab());
  }
  draw();
  root.append(
    header(group.name, { back: '#/', actions: [h('a.icon-btn.small', { href: `#/g/${id}/settings`, 'aria-label': 'ตั้งค่า' }, '⚙︎')] }),
    h('div', { id: 'backup-banner' }),
    tabs, body,
    h('a.btn.primary.fab', { href: `#/g/${id}/new` }, '+ เพิ่มบิล'),
  );
  window.dispatchEvent(new CustomEvent('tripsplit:view', { detail: { root, hasData: true } }));
}
