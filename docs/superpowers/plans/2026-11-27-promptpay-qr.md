# PromptPay QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** ทุกรายการ "ต้องโอน" มีปุ่ม QR พร้อมเพย์ของคนรับเงินพร้อมยอด สร้างในเครื่อง ใช้ออฟไลน์ได้
**Architecture:** `src/core/promptpay.js` (pure: normalize/validate id, build EMVCo payload + CRC) → `vendor/qrcode.js` (qrcode-generator, MIT) วาด SVG → UI ใน `src/ui/qr-sheet.js` + ช่องเลขใน settings; สมุดรายชื่อเก็บใน meta `promptpay`
**Spec:** `docs/superpowers/specs/2026-11-27-promptpay-qr-design.md`

## Global Constraints
- ไม่มี request ออกนอกเครื่อง; ไลบรารี QR อยู่ใน `vendor/` และอยู่ใน `ASSETS` ของ sw.js
- เลขพร้อมเพย์ไม่ถูก commit ลงโค้ด เก็บเฉพาะ IndexedDB + ไฟล์สำรอง
- QR พื้นขาว/จุดดำเสมอ (โหมดมืดด้วย), quiet zone ≥ 4 modules
- ทุกครั้งที่แก้ไฟล์แอป: `npm run bump` แล้ว `npm test` เขียวหมด

## Review Focus
1. เบอร์ที่พิมพ์มีขีด/เว้นวรรค/+66 → normalize ถูก — test Task 1
2. ยอด .5 สตางค์/ยอด 0 → QR ไม่มี tag 54 เมื่อไม่มียอด; ยอดมีทศนิยม 2 ตำแหน่งเสมอ — test Task 1
3. ไฟล์สำรองเก่าที่ไม่มี `promptpay` → กู้ได้ — test Task 3
4. ชื่อคนรับมีช่องว่างหน้า/หลัง → หาเลขเจอ (key = ชื่อ trim) — test Task 3
5. โหมดมืด → QR ยังพื้นขาว — ตรวจในเบราว์เซอร์ Task 4

---

### Task 1: PromptPay core
**Files:** Create `src/core/promptpay.js`, `tests/promptpay.test.js`
**Produces:**
- `normalizePromptPay(text): {type:'phone'|'nid', id:string}|null` — phone: 10 หลักขึ้นต้น 0 (รับ `+66`/`66` นำหน้า → แปลงเป็น 0); nid: 13 หลักผ่าน checksum
- `promptPayPayload(target, amountSatang|null): string` — ลำดับ tag: 00=01, 01=11(ไม่มียอด)/12(มียอด), 29{00=A000000677010111, 01=`0066`+เบอร์ตัด 0 | 02=nid}, 58=TH, 53=764, 54=ยอด (`(s/100).toFixed(2)`, เฉพาะเมื่อ >0), 63=CRC
- `crc16(str): string` — CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), hex 4 ตัวพิมพ์ใหญ่
- `maskPromptPay(id): string` — เช่น `081-xxx-5678`
- [ ] test: `crc16('123456789') === '29B1'`; `promptPayPayload(normalizePromptPay('000-000-0000'), null) === '00020101021129370016A000000677010111011300660000000005802TH53037646304E469'`; payload มียอด 18000 มี `5406180.00` และ `010212`; normalize `'+66 81 234 5678'` → `0812345678`; nid checksum ผิด → null; `'12345'` → null
- [ ] RED → implement → GREEN → commit

### Task 2: Vendor QR library
**Files:** Create `vendor/qrcode.js` (+ `vendor/LICENSE-qrcode-generator`), modify `sw.js` ASSETS, `tests/sw.test.js` walk ต้องครอบ `vendor/`
- [ ] `npm pack qrcode-generator@1.4.4` ใน scratch dir แยก, อ่าน LICENSE + `qrcode.js`, แปลงเป็น ES module (`export default qrcode`)
- [ ] test sw: ทุกไฟล์ใน `vendor/` อยู่ใน ASSETS (RED ก่อนเพิ่ม)
- [ ] `src/ui/qr.js`: `qrSvg(text): SVGElement` (error level M, quiet zone 4, fill ขาว/ดำ)
- [ ] commit

### Task 3: Address book + backup
**Files:** Create `src/core/contacts.js`, modify `src/core/backup.js`, `src/store.js` (replaceAll รับ `promptpay`), `tests/backup.test.js`, `tests/contacts.test.js`
**Produces:** `lookupPromptPay(book, name)`, `setPromptPay(book, name, id|null): book` (key = name.trim()); backup `serialize({..., promptpay})` / `parseBackup` คืน `data.promptpay ?? {}` และ reject ถ้าไม่ใช่ object ของ string
- [ ] tests ตาม Review Focus 3, 4 → RED → implement → GREEN → commit

### Task 4: UI (มอบ Sonnet, ตรวจเอง)
**Files:** Create `src/ui/qr-sheet.js`; modify `src/ui/group.js` (ปุ่ม QR ทุกรายการโอน), `src/ui/group-settings.js` (ช่องเลขพร้อมเพย์ต่อสมาชิก, validate ด้วย normalize), `src/ui/backup-ui.js` (ส่ง/กู้ promptpay), `styles.css`
- `openQrSheet({fromName, toName, amountSatang, onPaid})`: overlay เต็มจอ, ถ้าไม่มีเลข → ช่องกรอก + บันทึก → แสดง QR; มีเลข → QR, "บี โอนให้ จา ฿180.00", เลขแบบ mask, ปุ่ม "โอนแล้ว" (เรียก onPaid) / "ปิด" / "แก้เลข"
- ยอด = ยอดในรายการ (เคารพ roundBaht)
- [ ] ตรวจในเบราว์เซอร์: ไม่มีเลข → กรอก → QR ขึ้น; decode QR (jsQR ไม่มี — ตรวจ payload string ที่ใส่ใน data attribute แทน); โหมดมืดพื้นขาว; ตั้งค่าแสดงเลขที่บันทึก; สำรอง→กู้ เลขกลับมา
- [ ] bump, test, commit, merge main, push, รอ Pages
