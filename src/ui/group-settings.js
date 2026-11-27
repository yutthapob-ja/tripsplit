import { h, header, toast, confirmBox, avatar } from './dom.js';
import { getAll, getByGroup, put, deleteGroup, getMeta, setMeta } from '../store.js';
import { normalizePromptPay } from '../core/promptpay.js';
import { lookupPromptPay, setPromptPay } from '../core/contacts.js';
import { newGroup, newId, canRemoveMember, recentMemberNames, checkMemberEdits, rateUsage } from '../core/model.js';
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
  const book = (await getMeta('promptpay')) || {};
  const pp = {}; // member id -> typed PromptPay text
  for (const m of group.members) pp[m.id] = lookupPromptPay(book, m.name) || '';

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
    const m = { id: newId(), name };
    pp[m.id] = lookupPromptPay(book, name) || '';
    group.members.push(m);
    drawMembers();
  }

  function drawMembers() {
    memberList.replaceChildren(...group.members.map((m) => h('li.row',
      avatar(m),
      h('div.grow.member-fields',
        h('input.plain', { value: m.name, 'aria-label': 'ชื่อ', on: { input: (e) => (m.name = e.target.value) } }),
        h('input.pp-input', { value: pp[m.id] || '', inputmode: 'numeric', autocomplete: 'off', placeholder: 'พร้อมเพย์ (ไม่บังคับ)',
          'aria-label': `พร้อมเพย์ ${m.name}`, class: pp[m.id] && !normalizePromptPay(pp[m.id]) ? 'invalid' : '',
          on: { input: (e) => {
            pp[m.id] = e.target.value;
            const v = e.target.value.trim();
            e.target.classList.toggle('invalid', !!v && !normalizePromptPay(v));
          } } })),
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

  // rows shown = saved rates + newly added (empty until a valid rate is typed)
  const rateCodes = Object.keys(group.rates);
  function drawRates() {
    rateBox.replaceChildren(
      h('div.inline.base-row', h('span.shrink', '฿'), h('span', h('b', 'บาท (THB)'), ' — สกุลหลัก ไม่ต้องตั้งเรต')),
      ...rateCodes.map((code) => {
        const input = h('input', { inputmode: 'decimal', placeholder: 'เช่น 0.23', value: group.rates[code] ? String(group.rates[code]) : '',
          'aria-label': `เรต ${code}`, class: group.rates[code] ? '' : 'invalid' });
        input.addEventListener('input', () => {
          const v = Number(input.value.replace(/,/g, ''));
          if (input.value.trim() && v > 0) { group.rates[code] = v; input.classList.remove('invalid'); }
          else { delete group.rates[code]; input.classList.add('invalid'); }
        });
        return h('div.inline', h('span.shrink', `1 ${code} =`), input, h('span.shrink', 'บาท'),
          h('button.icon-btn.small.shrink', { type: 'button', 'aria-label': 'ลบเรต ' + code, on: { click: () => {
            const n = rateUsage(code, expenses);
            if (n) return toast(`ลบไม่ได้ — มี ${n} บิล ${code} ที่ใช้เรตนี้อยู่`);
            delete group.rates[code];
            rateCodes.splice(rateCodes.indexOf(code), 1);
            drawRates();
          } } }, '✕'));
      }),
      h('select', { 'aria-label': 'เพิ่มสกุลเงิน', on: { change: (e) => {
        if (!e.target.value) return;
        rateCodes.push(e.target.value);
        drawRates();
        rateBox.querySelector(`input[aria-label="เรต ${e.target.value}"]`)?.focus();
      } } },
        h('option', { value: '' }, '+ เพิ่มสกุลเงิน'),
        CURRENCIES.filter((c) => c.code !== 'THB' && !rateCodes.includes(c.code)).map((c) => h('option', { value: c.code }, `${c.code} · ${c.label}`))),
    );
  }

  async function save() {
    group.name = nameInput.value.trim();
    if (!group.name) return toast('ใส่ชื่อก่อน');
    const chk = checkMemberEdits(group.members, expenses, settlements);
    if (!chk.ok) return toast(chk.error);
    const unset = rateCodes.filter((c) => !(group.rates[c] > 0));
    if (unset.length) return toast(`ใส่เรต ${unset.join(', ')} ก่อน หรือกด ✕ เอาออก`);
    group.members = chk.members;
    if (!group.members.length) return toast('เพิ่มสมาชิกอย่างน้อย 1 คน');
    let nextBook = book;
    for (const m of group.members) {
      const v = (pp[m.id] || '').trim();
      if (!v) continue;
      if (!normalizePromptPay(v)) return toast(`เลขพร้อมเพย์ของ ${m.name} ไม่ถูกต้อง`);
    }
    for (const m of group.members) {
      const v = (pp[m.id] || '').trim();
      nextBook = setPromptPay(nextBook, m.name, v ? normalizePromptPay(v).id : null);
    }
    await setMeta('promptpay', nextBook);
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
    h('h2', 'สกุลเงินที่ใช้ในทริป'),
    h('div.card.pad', rateBox, h('p.hint', 'บิลเงินบาทใช้ได้เลย สกุลอื่นใส่เรตแลกเป็นบาทไว้ (แก้เป็นยอดบาทจริงได้ทีละบิล)')),
    h('div', { style: 'margin-top:24px' }, h('button.btn.primary.block', { type: 'button', on: { click: save } }, 'บันทึก')),
    isNew ? '' : h('div', { style: 'margin-top:12px' }, h('button.btn.danger.block', { type: 'button', on: { click: async () => {
      if (!(await confirmBox(`ลบ “${group.name}” และบิลทั้งหมด? กู้คืนไม่ได้ถ้าไม่ได้สำรองไว้`))) return;
      await deleteGroup(group.id);
      go('#/');
    } } }, 'ลบกลุ่มนี้')),
  );
  newMember.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addMember(newMember.value); newMember.value = ''; } });
  return { afterMount: () => { if (isNew) nameInput.focus(); } };
}
