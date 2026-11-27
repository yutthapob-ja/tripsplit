import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText } from '../src/core/receipt.js';

const names = (r) => r.items.map((i) => [i.name, i.price]);

test('Thai receipt: name and price on one line, service, VAT, total', () => {
  const text = `ร้านอาหารบ้านสวน
สาขาสุขุมวิท โทร 02-123-4567
เลขประจำตัวผู้เสียภาษี 0105556012345
โต๊ะ 12   27/11/2026 19:42
ต้มยำกุ้ง 250.00
ข้าวผัดปู 180.00
2 x ชาเย็น 90.00
รวม 520.00
Service Charge 10% 52.00
VAT 7% 40.04
ยอดสุทธิ 612.04
เงินสด 1,000.00
ทอน 387.96
ขอบคุณที่ใช้บริการ`;
  const r = parseReceiptText(text, 2);
  assert.deepEqual(names(r), [['ต้มยำกุ้ง', 25000], ['ข้าวผัดปู', 18000], ['ชาเย็น ×2', 9000]]);
  assert.equal(r.subtotal, 52000);
  assert.equal(r.service, 5200);
  assert.equal(r.vat, 4004);
  assert.equal(r.total, 61204);
  assert.equal(r.servicePct, 10);
  assert.equal(r.vatPct, 7);
});

test('Live Text columns: names then prices on separate lines', () => {
  const text = `Ramen Ichiran
Gyoza
Beer
980
450
600
Total
2,030`;
  const r = parseReceiptText(text, 0);
  assert.deepEqual(names(r), [['Ramen Ichiran', 980], ['Gyoza', 450], ['Beer', 600]]);
  assert.equal(r.total, 2030);
});

test('name line followed by its price line', () => {
  const r = parseReceiptText(`หมูกระทะชุดใหญ่\n599.00\nน้ำแข็ง\n20.00`, 2);
  assert.deepEqual(names(r), [['หมูกระทะชุดใหญ่', 59900], ['น้ำแข็ง', 2000]]);
});

test('quantity formats and unit-price columns', () => {
  const r = parseReceiptText(`ข้าวเหนียว 2 @20 40.00\n3 ส้มตำ 150\nโค้ก x2 60`, 2);
  assert.deepEqual(names(r), [['ข้าวเหนียว ×2', 4000], ['ส้มตำ ×3', 15000], ['โค้ก ×2', 6000]]);
});

test('discounts, cash, change and junk are skipped; currency symbols tolerated', () => {
  const r = parseReceiptText(`¥ ราเมง ¥1,200\nส่วนลด -100\nCASH 2000\nCHANGE 900\nTEL 03-1234-5678\n#0012`, 0);
  assert.deepEqual(names(r), [['ราเมง', 1200]]);
  assert.equal(r.discount, 100);
});

test('nothing usable returns empty items and nulls', () => {
  const r = parseReceiptText('ขอบคุณค่ะ\nwww.example.com', 2);
  assert.deepEqual(r.items, []);
  assert.equal(r.total, null);
  assert.equal(r.servicePct, null);
});
