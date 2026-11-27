import { h, header } from './dom.js';
import { getAll } from '../store.js';
import { expenseTotalTHB } from '../core/split.js';
import { formatAmount } from '../core/money.js';

export async function groupsView(root) {
  const [groups, expenses] = await Promise.all([getAll('groups'), getAll('expenses')]);
  groups.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const totalOf = (g) =>
    expenses.filter((e) => e.groupId === g.id).reduce((s, e) => s + (expenseTotalTHB(e, g) || 0), 0);
  const countOf = (g) => expenses.filter((e) => e.groupId === g.id).length;

  const section = (title, list) =>
    list.length
      ? [h('h2', title), h('ul.list.card', list.map((g) => h('li', h('a.row', { href: `#/g/${g.id}` },
          h('div.grow',
            h('div.title', g.name),
            h('div.sub', `${g.members.length} คน · ${countOf(g)} บิล`)),
          h('div.amt', `฿${formatAmount(totalOf(g), 'THB')}`)))))]
      : null;

  root.append(
    header('TripSplit', { actions: [h('a.icon-btn.small', { href: '#/backup', 'aria-label': 'สำรองข้อมูล' }, '⛁')] }),
    h('div', { id: 'backup-banner' }),
    groups.length
      ? [section('ทริป', groups.filter((g) => g.kind === 'trip')), section('มื้ออาหาร', groups.filter((g) => g.kind === 'meal'))]
      : h('div.empty', h('p', 'ยังไม่มีทริปหรือมื้ออาหาร'), h('p', 'กด “+ สร้างใหม่” เพื่อเริ่ม')),
    h('a.btn.primary.fab', { href: '#/new' }, '+ สร้างใหม่'),
  );
  window.dispatchEvent(new CustomEvent('tripsplit:view', { detail: { root, hasData: groups.length > 0 } }));
}
