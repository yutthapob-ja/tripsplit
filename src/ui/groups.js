import { h, header, avatarStack } from './dom.js';
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
          h('span.emoji-badge', g.kind === 'meal' ? '🍜' : '✈️'),
          h('div.grow',
            h('div.title', g.name),
            h('div.sub', avatarStack(g.members), ` ${countOf(g)} บิล`)),
          h('div.amt', `฿${formatAmount(totalOf(g), 'THB')}`)))))]
      : null;

  root.append(
    header('TripSplit', { actions: [h('a.icon-btn.small', { href: '#/backup', 'aria-label': 'สำรองข้อมูล' }, '💾')] }),
    h('section.hero', h('div.hero-title', 'หวัดดี! 👋'), h('div.hero-sub', 'วันนี้หารอะไรกันดี ทริปเที่ยวหรือมื้ออร่อย')),
    h('div', { id: 'backup-banner' }),
    h('div', groups.length
      ? [section('ทริป', groups.filter((g) => g.kind === 'trip')), section('มื้ออาหาร', groups.filter((g) => g.kind === 'meal'))]
      : h('div.empty', h('div.empty-emoji', '🧳🍕'), h('p.title', 'ยังว่างอยู่เลย'), h('p', 'กด “+ สร้างใหม่” แล้วชวนเพื่อนมาหารกัน'))),
    h('a.btn.primary.fab', { href: '#/new' }, '+ สร้างใหม่'),
  );
  return { hasData: groups.length > 0 };
}
