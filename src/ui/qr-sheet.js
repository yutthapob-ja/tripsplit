import { h, avatar } from './dom.js';
import { getMeta, setMeta } from '../store.js';
import { formatAmount } from '../core/money.js';
import { normalizePromptPay, promptPayPayload, maskPromptPay } from '../core/promptpay.js';
import { lookupPromptPay, setPromptPay } from '../core/contacts.js';
import { qrSvg } from './qr.js';

/** Full-screen PromptPay QR for one transfer; asks for the receiver's number when missing. */
export function openQrSheet({ fromName, toName, toMember, amountSatang, onPaid }) {
  const sheet = h('div.qr-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${fromName} โอนให้ ${toName}` });
  const prevFocus = document.activeElement;
  let editing = false;

  function close() {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    document.body.classList.remove('qr-open');
    if (prevFocus?.focus) try { prevFocus.focus(); } catch { /* ignore */ }
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  async function render() {
    const book = (await getMeta('promptpay')) || {};
    const id = lookupPromptPay(book, toName);
    const target = id ? normalizePromptPay(id) : null;
    const head = h('div.qr-head',
      h('span.transfer', avatar({ name: fromName }, 40), h('span.arrow', '→'), avatar(toMember || { name: toName }, 40)),
      h('div.qr-who', `${fromName} โอนให้ ${toName}`),
      h('div.qr-amt', `฿${formatAmount(amountSatang, 'THB')}`));
    const closeBtn = h('button.btn.block', { type: 'button', on: { click: close } }, 'ปิด');

    let body;
    if (target && !editing) {
      const payload = promptPayPayload(target, amountSatang);
      body = h('div.qr-body',
        h('div.qr-card', { 'data-payload': payload }, qrSvg(payload)),
        h('p.qr-pp', `พร้อมเพย์ ${toName}: ${maskPromptPay(target.id)}`),
        h('p.hint.qr-hint', 'เปิดแอปธนาคาร → สแกน QR ยอดเงินใส่ไว้ให้แล้ว'),
        h('div.stack.qr-actions',
          h('button.btn.primary.block', { type: 'button', on: { click: async (ev) => {
            ev.currentTarget.disabled = true;
            try { await onPaid?.(); } finally { close(); }
          } } }, 'โอนแล้ว ✓'),
          h('button.btn.block', { type: 'button', on: { click: () => { editing = true; render(); } } }, 'แก้เลขพร้อมเพย์'),
          closeBtn));
    } else {
      const input = h('input', { inputmode: 'numeric', autocomplete: 'off', placeholder: 'เบอร์มือถือ หรือ เลขบัตรประชาชน 13 หลัก',
        'aria-label': 'เลขพร้อมเพย์', value: id || '' });
      const saveBtn = h('button.btn.primary.block', { type: 'button', disabled: true, on: { click: async () => {
        const t = normalizePromptPay(input.value);
        if (!t) return;
        saveBtn.disabled = true;
        const fresh = (await getMeta('promptpay')) || {};
        await setMeta('promptpay', setPromptPay(fresh, toName, t.id));
        editing = false;
        render();
      } } }, 'บันทึกแล้วแสดง QR');
      const check = () => {
        const v = input.value.trim();
        const ok = !!normalizePromptPay(v);
        input.classList.toggle('invalid', !!v && !ok);
        saveBtn.disabled = !ok;
      };
      input.addEventListener('input', check);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click(); });
      check();
      body = h('div.qr-body',
        h('p.qr-pp', id ? `แก้เลขพร้อมเพย์ของ ${toName}` : `ยังไม่มีเลขพร้อมเพย์ของ ${toName}`),
        h('div.card.pad.stack', input, h('p.hint', 'เก็บไว้ในเครื่อง ใช้ได้ทุกทริป')),
        h('div.stack.qr-actions',
          saveBtn,
          id ? h('button.btn.small.danger', { type: 'button', on: { click: async () => {
            const fresh = (await getMeta('promptpay')) || {};
            await setMeta('promptpay', setPromptPay(fresh, toName, null));
            editing = false;
            render();
          } } }, 'ลบเลขนี้') : '',
          closeBtn));
      if (editing) setTimeout(() => input.focus(), 0);
    }
    sheet.replaceChildren(h('div.qr-inner', head, body));
    sheet.scrollTop = 0;
  }

  document.body.append(sheet);
  document.body.classList.add('qr-open');
  document.addEventListener('keydown', onKey);
  render();
  return { close };
}
