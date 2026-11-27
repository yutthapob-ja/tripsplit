export const SCHEMA_VERSION = 1;

export function serialize({ groups, expenses, settlements, promptpay = {} }) {
  return JSON.stringify({
    app: 'TripSplit',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groups, expenses, settlements, promptpay,
  }, null, 2);
}

const fail = (error) => ({ ok: false, error });

export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return fail('ไฟล์เสียหรือไม่ใช่ไฟล์สำรอง'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.app !== 'TripSplit') {
    return fail('ไม่ใช่ไฟล์สำรองของ TripSplit');
  }
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) return fail('ไฟล์สำรองไม่สมบูรณ์ (ไม่มีเวอร์ชัน)');
  if (obj.schemaVersion > SCHEMA_VERSION) {
    return fail('ไฟล์มาจากเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อนกู้คืน');
  }
  for (const k of ['groups', 'expenses', 'settlements']) {
    if (!Array.isArray(obj[k])) return fail(`ไฟล์สำรองไม่สมบูรณ์ (ไม่มีข้อมูล ${k})`);
  }
  const okId = (r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id !== '';
  if (!obj.groups.every((g) => okId(g) && Array.isArray(g.members))) return fail('ไฟล์สำรองเสีย (ข้อมูลกลุ่มไม่ถูกต้อง)');
  const ids = new Set(obj.groups.map((g) => g.id));
  for (const k of ['expenses', 'settlements']) {
    if (!obj[k].every((r) => okId(r) && ids.has(r.groupId))) return fail('ไฟล์สำรองเสีย (มีรายการที่ไม่มีกลุ่ม)');
  }
  const promptpay = obj.promptpay ?? {};
  if (typeof promptpay !== 'object' || Array.isArray(promptpay) || !Object.values(promptpay).every((v) => typeof v === 'string')) {
    return fail('ไฟล์สำรองเสีย (ข้อมูลพร้อมเพย์ไม่ถูกต้อง)');
  }
  return { ok: true, data: { groups: obj.groups, expenses: obj.expenses, settlements: obj.settlements, promptpay } };
}

export function backupFilename(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `tripsplit-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}
