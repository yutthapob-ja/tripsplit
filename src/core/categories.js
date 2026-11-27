import { expenseTotalTHB } from './split.js';

export const CATEGORIES = [
  { id: 'food', emoji: '🍜', label: 'กินดื่ม', color: '#FF8A65' },
  { id: 'transport', emoji: '🚆', label: 'เดินทาง', color: '#4FC3F7' },
  { id: 'stay', emoji: '🏨', label: 'ที่พัก', color: '#9575CD' },
  { id: 'fun', emoji: '🎟️', label: 'เที่ยว/กิจกรรม', color: '#4DB6AC' },
  { id: 'shopping', emoji: '🛍️', label: 'ช้อปปิ้ง', color: '#F06292' },
  { id: 'gift', emoji: '🎁', label: 'ของฝาก', color: '#FFB74D' },
  { id: 'other', emoji: '📦', label: 'อื่น ๆ', color: '#90A4AE' },
];
const NONE = { id: 'none', emoji: '❔', label: 'ไม่ระบุ', color: '#B0A8C0' };
const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id) {
  return BY_ID.get(id) || NONE;
}

// order matters: more specific first (ของฝาก before ช้อป, ตั๋วรถ before ตั๋วเที่ยว)
const RULES = [
  ['gift', /ของฝาก|ฝากที่|souvenir|omiyage/i],
  ['transport', /รถไฟ|รถเมล์|รถบัส|แท็กซี่|แทกซี่|taxi|grab|bolt|uber|bts|mrt|jr|metro|subway|train|bus|ferry|เรือ|เครื่องบิน|flight|airline|ตั๋วเครื่อง|ค่าทางด่วน|น้ำมัน|ที่จอดรถ|parking|เช่ารถ|suica|pasmo|icoca|shinkansen|ชินคันเซ็น|สนามบิน|airport|ค่ารถ/i],
  ['stay', /โรงแรม|hotel|hostel|ที่พัก|airbnb|รีสอร์ท|resort|ryokan|เรียวกัง|agoda|booking\.com|ค่าห้อง/i],
  ['fun', /ตั๋ว|ticket|disney|universal|usj|พิพิธภัณฑ์|museum|สวนสนุก|onsen|ออนเซ็น|ทัวร์|tour|ค่าเข้า|entrance|karaoke|คาราโอเกะ|สปา|spa|นวด|massage|ดำน้ำ|show/i],
  ['shopping', /uniqlo|ยูนิโคล่|ช้อป|shop|ห้าง|mall|don ?quijote|donki|ดองกี้|เสื้อ|รองเท้า|กระเป๋า|เครื่องสำอาง|drugstore|matsumoto|7-?eleven|เซเว่น|lawson|familymart|ซุปเปอร์|supermarket/i],
  ['food', /ข้าว|ราเมง|ramen|ซูชิ|sushi|หมูกระทะ|ชาบู|shabu|ปิ้งย่าง|yakiniku|บุฟเฟ่ต์|buffet|กาแฟ|coffee|cafe|คาเฟ่|starbucks|ชา|ขนม|อาหาร|มื้อ|เบียร์|beer|เหล้า|bar|izakaya|อิซากายะ|ร้านอาหาร|restaurant|เนื้อ|ไก่|ก๋วยเตี๋ยว|ส้มตำ|ไอติม|ice ?cream|ของกิน|ดื่ม|น้ำ|breakfast|lunch|dinner|เช้า|กลางวัน|เย็น/i],
];

/** Best-guess category id from a bill title, or null. */
export function guessCategory(title) {
  const t = String(title || '').trim();
  if (!t) return null;
  for (const [id, re] of RULES) if (re.test(t)) return id;
  return null;
}

/** [{id, emoji, label, color, total (satang), share}] largest first; bills without a baht total are skipped. */
export function categoryTotals(group, expenses) {
  const sums = new Map();
  for (const e of expenses) {
    const t = expenseTotalTHB(e, group);
    if (t == null) continue;
    const id = categoryOf(e.category).id;
    sums.set(id, (sums.get(id) || 0) + t);
  }
  const grand = [...sums.values()].reduce((a, b) => a + b, 0);
  return [...sums.entries()]
    .map(([id, total]) => ({ ...categoryOf(id), total, share: grand ? total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}
