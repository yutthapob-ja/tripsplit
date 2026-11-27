import { h, header, toast, confirmBox } from './dom.js';
import { getAll, replaceAll, getMeta, setMeta } from '../store.js';
import { serialize, parseBackup, backupFilename } from '../core/backup.js';
import { go } from '../router.js';

const WEEK_MS = 7 * 24 * 3600 * 1000;
let dismissed = false;

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 'ยังไม่เคยสำรอง';
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function download(file) {
  const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: file.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** `file` is prebuilt so share() runs inside the tap (iOS needs a fresh user gesture). */
async function doBackup(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'TripSplit backup' });
    } catch (err) {
      if (err?.name !== 'NotAllowedError') throw err;
      download(file);
    }
  } else {
    download(file);
  }
  await setMeta('lastBackupAt', new Date().toISOString());
}

export async function backupView(root) {
  const [groups, expenses, settlements, last] = await Promise.all([
    getAll('groups'), getAll('expenses'), getAll('settlements'), getMeta('lastBackupAt'),
  ]);
  const file = new File([serialize({ groups, expenses, settlements })], backupFilename(new Date()), { type: 'application/json' });
  let persisted = false;
  try { persisted = !!(await navigator.storage?.persisted?.()); } catch { /* ignore */ }

  const lastEl = h('b', last ? fmtDate(last) : 'ยังไม่เคยสำรอง');

  const backupBtn = h('button.btn.primary.block', {
    type: 'button',
    on: {
      click: async () => {
        backupBtn.disabled = true;
        try {
          await doBackup(file);
          lastEl.textContent = fmtDate(new Date().toISOString());
          toast('สำรองข้อมูลแล้ว');
        } catch (err) {
          if (err?.name !== 'AbortError') toast('สำรองไม่สำเร็จ: ' + (err?.message || err));
        } finally {
          backupBtn.disabled = false;
        }
      },
    },
  }, 'สำรองข้อมูล (บันทึกลง Files/iCloud)');

  const input = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    on: {
      change: async () => {
        const f = input.files?.[0];
        try {
          if (!f) return;
          const res = parseBackup(await f.text());
          if (!res.ok) { toast(res.error); return; }
          const { data } = res;
          const ok = await confirmBox(
            `แทนที่ข้อมูลทั้งหมดในเครื่องด้วยไฟล์นี้? (${data.groups.length} กลุ่ม, ${data.expenses.length} บิล) ข้อมูลปัจจุบันจะหายไป`);
          if (!ok) return;
          await replaceAll(data);
          toast('กู้คืนแล้ว');
          go('#/');
        } catch (err) {
          toast('กู้คืนไม่สำเร็จ: ' + (err?.message || err));
        } finally {
          input.value = '';
        }
      },
    },
  });

  root.append(
    header('สำรองข้อมูล', { back: '#/' }),
    h('main.stack',
      h('div.card.pad',
        h('p', 'สำรองล่าสุด: ', lastEl),
        h('p', `ข้อมูลในเครื่อง: ${groups.length} ทริป/มื้อ, ${expenses.length} บิล`),
        h('p.hint', persisted
          ? 'เบราว์เซอร์เก็บข้อมูลถาวรแล้ว'
          : 'อาจถูกล้างได้ — สำรองบ่อย ๆ')),
      h('div.card.pad.stack',
        backupBtn,
        h('p.hint', 'บน iPhone เลือก "บันทึกลงในไฟล์" แล้วเก็บไว้ใน iCloud Drive')),
      h('div.card.pad.stack',
        h('h2', 'กู้คืนข้อมูล'),
        h('button.btn.block', { type: 'button', on: { click: () => input.click() } }, 'กู้คืนจากไฟล์'),
        h('p.hint.muted', 'ข้อมูลปัจจุบันในเครื่องจะถูกแทนที่ด้วยข้อมูลจากไฟล์'),
        input)));
}

async function checkBanner(hasData) {
  if (dismissed) return;
  const slot = document.getElementById('backup-banner');
  if (!slot || slot.firstChild) return;
  if (hasData === undefined) hasData = (await getAll('groups')).length > 0;
  if (!hasData) return;
  const last = await getMeta('lastBackupAt');
  const t = last ? new Date(last).getTime() : NaN;
  if (!isNaN(t) && Date.now() - t < WEEK_MS) return;
  if (dismissed || !slot.isConnected || slot.firstChild) return;
  slot.append(h('div.banner',
    h('span.grow', isNaN(t) ? 'ยังไม่เคยสำรองข้อมูล' : 'ยังไม่ได้สำรองข้อมูลเกิน 7 วัน'),
    h('a', { href: '#/backup' }, 'สำรองเลย'),
    h('button.btn.small', {
      type: 'button', 'aria-label': 'ปิด',
      on: { click: () => { dismissed = true; slot.replaceChildren(); } },
    }, '✕')));
}

export function initBackupReminder() {
  window.addEventListener('tripsplit:view', (e) => {
    checkBanner(!!e.detail?.hasData).catch(() => {});
  });
  checkBanner().catch(() => {});
}
