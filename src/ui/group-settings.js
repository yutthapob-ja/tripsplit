import { h, header, toast, confirmBox, avatar } from './dom.js';
import { getAll, getByGroup, put, deleteGroup } from '../store.js';
import { newGroup, newId, canRemoveMember, recentMemberNames } from '../core/model.js';
import { CURRENCIES } from '../core/currencies.js';
import { go } from '../router.js';

export async function groupSettingsView(root, { id }) {
  const isNew = !id;
  const all = await getAll('groups');
  let group = isNew ? newGroup({ name: '', kind: 'trip', memberNames: [] }) : all.find((g) => g.id === id);
  if (!group) return go('#/');
  group = structuredClone(group);
  const [expenses, settlements] = isNew ? [[], []] : await Promise.all([getByGroup('expenses', id), getByGroup('settlements', id)]);
  const suggestions = recentMemberNames(all);

  const nameInput = h('input', { value: group.name, placeholder: 'เช่น โตเกียว ธ.ค. 69 / ข้าวเย็นวันศุกร์', maxlength: 60 });
  const kindTabs = h('div.tabs');
  const memberList = h('ul.list.card');
  const sugBox = h('div.chips');
  const newMember = h('input', { placeholder: 'พิมพ์ชื่อแล้วกด เพิ่ม', enterkeyhint: 'done' });
  const rateBox = h('div.stack');

  function drawKind() {
    kindTabs.replaceChildren(...[['trip', '✈️ ทริป'], ['meal', '🍜 มื้ออาหาร']].map(([k, t]) =>
      h('button', { type: 'button', class: group.kind === k ? 'on' : '', on: { click: () => { group.kind = k; drawKind(); } } }, t)));
  }

  function addMember(name) {
    name = name.trim();
    if (!name) return;
    if (group.members.some((m) => m.name === name)) return toast('มีชื่อนี้แล้ว');
    group.members.push({ id: newId(), name });
    drawMembers();
  }

  function drawMembers() {
    memberList.replaceChildren(...group.members.map((m) => h('li.row',
      avatar(m),
      h('input.grow.plain', { value: m.name, 'aria-label': 'ชื่อ', on: { input: (e) => (m.name = e.target.value) } }),
      h('button.icon-btn.small', { type: 'button', 'aria-label': 'ลบ ' + m.name, on: { click: () => {
        const r = canRemoveMember(m.id, expenses, settlements);
        if (!r.ok) return toast(`ลบไม่ได้ — อยู่ใน: ${r.usedIn.slice(0, 3).join(', ')}${r.usedIn.length > 3 ? '…' : ''}`);
        group.members = group.members.filter((x) => x.id !== m.id);
        drawMembers();
      } } }, '✕'))));
    if (!group.members.length) memberList.append(h('li.row.muted', '👥 ยังไม่มีใคร — พิมพ์ชื่อเพื่อนด้านล่าง'));
    const have = new Set(group.members.map((m) => m.name));
    sugBox.replaceChildren(...suggestions.filter((n) => !have.has(n)).slice(0, 12).map((n) =>
      h('button.chip', { type: 'button', on: { click: () => addMember(n) } }, '+ ' + n)));
  }

  function drawRates() {
    const codes = Object.keys(group.rates);
    rateBox.replaceChildren(
      ...codes.map((code) => h('div.inline',
        h('span.shrink', `1 ${code} =`),
        h('input', { inputmode: 'decimal', value: String(group.rates[code]), 'aria-label': `เรต ${code}`,
          on: { input: (e) => { const v = Number(e.target.value.replace(/,/g, '')); if (v > 0) group.rates[code] = v; } } }),
        h('span.shrink', 'บาท'),
        h('button.icon-btn.small.shrink', { type: 'button', 'aria-label': 'ลบเรต', on: { click: () => { delete group.rates[code]; drawRates(); } } }, '✕'))),
      h('select', { 'aria-label': 'เพิ่มสกุลเงิน', on: { change: (e) => {
        if (!e.target.value) return;
        group.rates[e.target.value] = group.rates[e.target.value] || 1;
        drawRates();
      } } },
        h('option', { value: '' }, '+ เพิ่มสกุลเงิน'),
        CURRENCIES.filter((c) => c.code !== 'THB' && !codes.includes(c.code)).map((c) => h('option', { value: c.code }, `${c.code} · ${c.label}`))),
    );
  }

  async function save() {
    group.name = nameInput.value.trim();
    group.members = group.members.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name);
    if (!group.name) return toast('ใส่ชื่อก่อน');
    if (!group.members.length) return toast('เพิ่มสมาชิกอย่างน้อย 1 คน');
    group.updatedAt = new Date().toISOString();
    await put('groups', group);
    go(`#/g/${group.id}`);
  }

  drawKind(); drawMembers(); drawRates();
  root.append(
    header(isNew ? 'สร้างใหม่' : 'ตั้งค่า', { back: isNew ? '#/' : `#/g/${group.id}` }),
    h('label.field', h('span', 'ชื่อ'), nameInput),
    kindTabs,
    h('h2', 'สมาชิก'),
    memberList,
    h('div.inline', { style: 'margin-top:10px' }, newMember,
      h('button.btn.shrink', { type: 'button', on: { click: () => { addMember(newMember.value); newMember.value = ''; newMember.focus(); } } }, 'เพิ่ม')),
    h('div', { style: 'margin-top:10px' }, sugBox),
    h('h2', 'เรตกลาง (แปลงเป็นบาท)'),
    h('div.card.pad', rateBox, h('p.hint', 'บิลสกุลอื่นจะแปลงด้วยเรตนี้ แก้เป็นยอดบาทจริงได้ทีละบิล')),
    h('div', { style: 'margin-top:24px' }, h('button.btn.primary.block', { type: 'button', on: { click: save } }, 'บันทึก')),
    isNew ? '' : h('div', { style: 'margin-top:12px' }, h('button.btn.danger.block', { type: 'button', on: { click: async () => {
      if (!(await confirmBox(`ลบ “${group.name}” และบิลทั้งหมด? กู้คืนไม่ได้ถ้าไม่ได้สำรองไว้`))) return;
      await deleteGroup(group.id);
      go('#/');
    } } }, 'ลบกลุ่มนี้')),
  );
  newMember.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addMember(newMember.value); newMember.value = ''; } });
  if (isNew) nameInput.focus();
}
