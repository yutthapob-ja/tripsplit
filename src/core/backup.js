export const SCHEMA_VERSION = 1;

export function serialize({ groups, expenses, settlements }) {
  return JSON.stringify({
    app: 'TripSplit',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groups, expenses, settlements,
  }, null, 2);
}

const fail = (error) => ({ ok: false, error });

export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return fail('ไฟล์เสียหรือไม่ใช่ไฟล์สำรอง'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.app !== 'TripSplit') {
    return fail('ไม่ใช่ไฟล์สำรองของ TripSplit');
  }
  if (typeof obj.schemaVersion !== 'number') return fail('ไฟล์สำรองไม่สมบูรณ์ (ไม่มีเวอร์ชัน)');
  if (obj.schemaVersion > SCHEMA_VERSION) {
    return fail('ไฟล์มาจากเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อนกู้คืน');
  }
  for (const k of ['groups', 'expenses', 'settlements']) {
    if (!Array.isArray(obj[k])) return fail(`ไฟล์สำรองไม่สมบูรณ์ (ไม่มีข้อมูล ${k})`);
  }
  return { ok: true, data: { groups: obj.groups, expenses: obj.expenses, settlements: obj.settlements } };
}

export function backupFilename(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `tripsplit-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}
