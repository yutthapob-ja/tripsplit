# TripSplit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แอปหารเงินส่วนตัวแบบ PWA ออฟไลน์บน iPhone สำหรับทริปหลายสกุลเงินและหารค่าข้าว (ทีละจาน + Service/VAT)

**Architecture:** HTML + JavaScript ES modules ล้วน ไม่มี build step ไม่มี dependency ภายนอก ตรรกะคำนวณทั้งหมดเป็น pure functions ใน `src/core/` (ทดสอบด้วย `node --test`) ส่วน UI ใน `src/ui/` render ด้วย DOM ตรง ๆ + hash router ข้อมูลเก็บ IndexedDB ผ่าน `src/store.js` ออฟไลน์ด้วย service worker

**Tech Stack:** Vanilla JS (ES2022 modules), IndexedDB, Service Worker, Web Share API, Node 26 built-in test runner, `python3 -m http.server` สำหรับดูในเครื่อง, GitHub Pages

**Spec:** `Code/TripSplit/DESIGN-TripSplit.md`

## Global Constraints
- ห้ามใช้ชื่อ โลโก้ สี หรือหน้าตาของ Splitwise; ชื่อแอป "TripSplit"
- UI ภาษาไทยทั้งหมด ปุ่มใหญ่ใช้นิ้วโป้งได้ (เป้าแตะ ≥ 44px) โหมดมืด/สว่างตาม `prefers-color-scheme`
- ทำงานออฟไลน์ 100% หลังเปิดครั้งแรก; ไม่มี request ไปเซิร์ฟเวอร์อื่นเลย (ไม่มี CDN ไม่มี analytics ไม่มีฟอนต์ภายนอก)
- เงินภายในเป็น **จำนวนเต็ม**: สกุลเงินบิลเก็บเป็นหน่วยย่อย (minor units) ตามจำนวนทศนิยมของสกุล; บาทเก็บเป็น **สตางค์**
- ยอดที่แบ่งให้แต่ละคนรวมกันต้อง **เท่ากับยอดบิลพอดีทุกสตางค์** เสมอ
- VAT คิดบน (ยอดอาหาร + Service); Service/VAT เฉลี่ยตามสัดส่วนยอดอาหารของแต่ละคน
- ยอดบาทจริง (`actualTHB`) ชนะเรตกลางเสมอ; แก้แล้วยอดของคนจ่ายแต่ละคนปรับตามสัดส่วนเดิม
- ทุก path อ้างแบบ relative (แอปต้องทำงานใต้ `https://<user>.github.io/tripsplit/`)
- ไฟล์สำรองมี `schemaVersion` (เริ่มที่ `1`)

## Review Focus
1. **ลบสมาชิกที่มีบิลผูกอยู่** → ต้องห้ามลบ พร้อมบอกว่าอยู่ในบิลไหน (ไม่งั้นยอดเพี้ยน) — test ใน Task 5 (`canRemoveMember`)
2. **ยอดคนจ่ายรวมไม่เท่ายอดบิล / ยอดระบุรายคนรวมไม่เท่ายอดบิล** → ฟอร์มกดบันทึกไม่ได้ และบอกส่วนต่าง — test ใน Task 2 (`validateExpense`)
3. **บิลสกุลเงินที่ทริปยังไม่ตั้งเรต และไม่ได้ใส่ยอดบาทจริง** → บันทึกไม่ได้ ชวนให้ตั้งเรต — test ใน Task 2
4. **แก้เรตกลางหลังมีบิลแล้ว** → บิลที่ไม่ได้แก้ยอดจริงคำนวณใหม่ทั้งหมด บิลที่แก้แล้วไม่เปลี่ยน — test ใน Task 3
5. **กู้คืนไฟล์สำรองที่เสีย / เป็นเวอร์ชันใหม่กว่าแอป** → ปฏิเสธพร้อมข้อความ ไม่ลบข้อมูลเดิม — test ใน Task 4

---

## File Structure
```
TripSplit/
  index.html                 # shell, <main id="app">, โหลด src/app.js
  manifest.webmanifest       # name, icons, display: standalone, start_url: "./"
  sw.js                      # cache-first ไฟล์ทั้งหมดใน ASSETS, เวอร์ชันแคช
  styles.css
  icons/icon-192.png icon-512.png apple-touch-icon.png
  src/
    app.js                   # boot, register SW, router
    router.js                # hash routes → view functions
    store.js                 # IndexedDB CRUD
    core/
      money.js               # parse/format/allocate
      currencies.js          # ตารางสกุลเงิน {code, decimals, label}
      split.js               # คำนวณส่วนแบ่ง/คนจ่ายต่อบิลเป็นสตางค์ + validate
      balance.js             # ยอดสุทธิรายคน + ยุบหนี้
      summary.js             # ข้อความสรุปสำหรับไลน์
      backup.js              # serialize / parse / validate ไฟล์สำรอง
      model.js               # factory + กฎ เช่น canRemoveMember
    ui/
      groups.js              # หน้ารายการกลุ่ม
      group.js               # หน้ากลุ่ม: บิล / สรุป / โอนคืน
      group-settings.js      # สมาชิก, เรตกลาง
      expense-form.js        # ฟอร์มบิล (equal/exact/items, หลายคนจ่าย)
      items-editor.js        # ส่วนใส่ทีละจาน
      backup-ui.js           # สำรอง/กู้คืน/เตือน
      dom.js                 # h() helper, toast, confirm
  tests/*.test.js
  package.json               # {"type":"module","scripts":{"test":"node --test tests/"}}
  .claude/launch.json        # python3 -m http.server 5180
```

## Data Model (ใช้ร่วมทุก task)
```js
Group = { id, name, kind: 'trip'|'meal', members: [{id, name}],
          rates: { [code]: number /* บาทต่อ 1 หน่วยหลัก เช่น JPY: 0.23 */ },
          defaultCurrency: 'THB', createdAt, updatedAt }
Expense = { id, groupId, title, date: 'YYYY-MM-DD', currency, amount /* minor units */,
            payers: [{ memberId, amount /* minor units */ }],
            split: { type: 'equal', memberIds: [] }
                 | { type: 'exact', amounts: { [memberId]: minor } }
                 | { type: 'items', items: [{ name, price /* minor */, memberIds: [] }],
                     servicePct: number, vatPct: number, billTotal: minor|null },
            actualTHB: satang|null, createdAt, updatedAt }
Settlement = { id, groupId, from, to, amount /* satang */, date }
Meta = { key: 'lastBackupAt', value: ISOString } // store 'meta'
```
สำหรับ `items`: `amount` ของบิล = `billTotal ?? computedTotal` (บันทึกไว้ใน `amount` ตอน save)

---

### Task 1: Scaffold + money utilities

**Files:**
- Create: `package.json`, `.claude/launch.json`, `.gitignore`, `src/core/money.js`, `src/core/currencies.js`, `tests/money.test.js`

**Interfaces:**
- Produces:
  - `CURRENCIES: Array<{code, decimals, label}>` — อย่างน้อย THB(2) JPY(0) KRW(0) USD(2) EUR(2) CNY(2) SGD(2) HKD(2) TWD(0) VND(0) MYR(2) GBP(2) AUD(2); `decimalsOf(code): number`
  - `parseAmount(text: string, decimals: number): number|null` — รับ "1,250.50", " 300 ", "฿99"; คืน minor units, ไม่ถูกต้องคืน `null`
  - `formatAmount(minor: number, code: string): string` — `formatAmount(125050,'THB') === '1,250.50'`, `formatAmount(1200,'JPY') === '1,200'`
  - `allocate(total: number, weights: number[]): number[]` — largest-remainder; ผลรวม = total เสมอ; น้ำหนักรวม 0 → แบ่งเท่า
  - `toSatang(minor: number, code: string, rate: number): number` — `Math.round(minor * rate * 100 / 10**dec)` (คูณก่อนหาร ลดเพี้ยนทศนิยม); THB คืนค่าเดิม

- [ ] **Step 1:** `git init` ใน `TripSplit/`, สร้าง `package.json`, `.gitignore` (`node_modules`, `.DS_Store`), `.claude/launch.json` (name `tripsplit`, `python3 -m http.server 5180`, port 5180)
- [ ] **Step 2: เขียน test ที่ fail** `tests/money.test.js`:
  - `allocate(100, [1,1,1])` → `[34,33,33]`; `allocate(1000, [0,0])` → `[500,500]`; `allocate(7, [2,1])` ผลรวม 7
  - property: 200 ชุดสุ่ม total/weights ผลรวม = total ทุกครั้ง และทุกค่า ≥ 0
  - `parseAmount('1,250.50',2) === 125050`; `parseAmount('1200',0) === 1200`; `parseAmount('12.345',2) === null`; `parseAmount('abc',2) === null`; `parseAmount('-5',2) === null`
  - `toSatang(1000,'JPY',0.23) === 23000`; `toSatang(1999,'USD',35.5) === 70965`
- [ ] **Step 3:** รัน `npm test` → FAIL (module not found)
- [ ] **Step 4:** Implement ตาม Interfaces
- [ ] **Step 5:** `npm test` → PASS
- [ ] **Step 6:** Commit `feat: scaffold and money utilities`

### Task 2: Per-expense split engine

**Files:**
- Create: `src/core/split.js`, `tests/split.test.js`

**Interfaces:**
- Consumes: `allocate`, `toSatang`, `decimalsOf`
- Produces:
  - `expenseTotalTHB(expense, group): number|null` — `actualTHB ?? toSatang(amount, currency, rates[currency])`; ไม่มีเรตและไม่มี actualTHB → `null`
  - `itemsBreakdown(split, members): { perMember: {[id]: {food, service, vat, total}}, computedTotal, diff }` — หน่วย minor ของสกุลบิล; `diff = billTotal - computedTotal` (หรือ 0)
  - `expenseShares(expense, group): { owed: {[memberId]: satang}, paid: {[memberId]: satang} }` — ผลรวม owed = ผลรวม paid = `expenseTotalTHB`
  - `validateExpense(expense, group): string[]` — ข้อความ error ภาษาไทย; ว่าง = ใช้ได้

**อัลกอริทึม (ที่ test ไม่ได้กำหนดเอง):**
- `owed`: น้ำหนักในสกุลบิล → equal: 1 ต่อคนที่เลือก; exact: `amounts`; items: `perMember[id].total` → `allocate(totalTHB, weights)`
- items: แต่ละจาน `allocate(price, ones(memberIds))` → food รายคน; `serviceTotal = round(foodSum*servicePct/100)` แล้ว `allocate(serviceTotal, food)`; `vatTotal = round((foodSum+serviceTotal)*vatPct/100)` แล้ว `allocate(vatTotal, food+service)`
- `paid`: `allocate(totalTHB, payers.map(p=>p.amount))` (ทำให้ actualTHB ปรับตามสัดส่วนคนจ่ายอัตโนมัติ)

- [ ] **Step 1: เขียน test ที่ fail:**
  - equal บิล 1,000 บาท (`amount: 100000`) สามคน → owed `[33334,33333,33333]` รวม 100000
  - equal เฉพาะ 2 จาก 3 คน → คนที่สามได้ 0 / ไม่มี key
  - exact `{a:30000,b:70000}` บิล 100000 → owed ตรงตามนั้น
  - JPY 3000 เรต 0.23, actualTHB null → total 69000; ตั้ง actualTHB 71250 → total 71250 และ paid ของคนจ่าย 2 คน (2000/1000 เยน) = `[47500,23750]`
  - items: สเต๊ก 450 (a), ข้าวผัด 120 (b), ส้มตำ 150 (a,b,c), service 10, vat 7 → food a=500 b=170 c=50 (บาท), computedTotal = round((720+72)*1.07) → 847.44 บาท = `84744`; ผลรวม perMember.total = computedTotal
  - items + billTotal 85000 → diff 256 และ owed รวม 85000
  - `validateExpense`: payers รวม ≠ amount → error มีคำว่า "คนจ่าย"; exact รวม ≠ amount → error; สกุล JPY ไม่มีเรตและไม่มี actualTHB → error มีคำว่า "เรต"; equal ไม่มีคนเลือก → error; item ไม่มีคนกิน → error
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5:** Commit `feat: expense split engine`

### Task 3: Balances, debt simplification, LINE summary

**Files:**
- Create: `src/core/balance.js`, `src/core/summary.js`, `tests/balance.test.js`, `tests/summary.test.js`

**Interfaces:**
- Consumes: `expenseShares`, `expenseTotalTHB`, `formatAmount`
- Produces:
  - `balances(group, expenses, settlements): {[memberId]: satang}` — paid − owed + (โอนออก) − (รับเข้า); ผลรวม = 0; บิลที่ `expenseTotalTHB` เป็น null ถูกข้าม
  - `simplify(balances): Array<{from, to, amount}>` — greedy: ลูกหนี้มากสุดจ่ายเจ้าหนี้มากสุดซ้ำจนหมด; ข้ามค่าที่เป็น 0
  - `summaryText(group, expenses, settlements, {roundBaht?: boolean}): string` — ไทย มี: ชื่อทริป, ยอดรวมทั้งหมด, จ่ายไป/ต้องจ่ายรายคน, รายการ "A → B ฿x"; ถ้าเคลียร์หมด → "เคลียร์ครบแล้ว 🎉"

- [ ] **Step 1: เขียน test ที่ fail:**
  - a จ่าย 900 หาร a,b,c เท่ากัน → balances a=+600 b=−300 c=−300 (บาท); simplify → 2 รายการ b→a, c→a
  - ห่วงโซ่ (a ติด b 100, b ติด c 100 → balances a=−100 b=0 c=+100) → simplify เหลือ a→c 100 (1 รายการ)
  - บันทึก settlement b→a 300 แล้ว → b=0 และไม่อยู่ใน simplify
  - property: สุ่ม 100 ชุด ผลรวม balances = 0 และหลังใช้ simplify ทุกคนเป็น 0; จำนวนรายการ ≤ n−1
  - แก้เรตกลาง JPY 0.23 → 0.25: บิลที่ไม่มี actualTHB เปลี่ยน, บิลที่มี actualTHB ไม่เปลี่ยน (Review Focus 4)
  - `summaryText` มีชื่อสมาชิกและ "→"; `roundBaht:true` ไม่มีทศนิยม
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** PASS
- [ ] **Step 5:** Commit `feat: balances, simplify, summary text`

### Task 4: Storage + backup format

**Files:**
- Create: `src/store.js`, `src/core/backup.js`, `tests/backup.test.js`

**Interfaces:**
- Produces:
  - `store.js` (DB `tripsplit`, v1, stores `groups`, `expenses` (index `groupId`), `settlements` (index `groupId`), `meta`):
    `openDB()`, `getAll(storeName)`, `getByGroup(storeName, groupId)`, `put(storeName, obj)`, `del(storeName, id)`, `deleteGroup(groupId)` (ลบบิล/โอนคืนด้วย), `replaceAll(data)` (ใน transaction เดียว), `getMeta(key)`, `setMeta(key, value)`, `requestPersist(): Promise<boolean>` (`navigator.storage.persist()`)
  - `backup.js`: `SCHEMA_VERSION = 1`; `serialize({groups, expenses, settlements}): string` (JSON มี `app:'TripSplit'`, `schemaVersion`, `exportedAt`); `parseBackup(text): {ok:true, data} | {ok:false, error: string}`; `backupFilename(date): string` → `tripsplit-backup-2026-11-27.json`
- `newId()` ใน `src/core/model.js`: `crypto.randomUUID()`

- [ ] **Step 1: เขียน test ที่ fail:** serialize→parse ได้ข้อมูลเดิม; JSON เสีย → `ok:false` ข้อความไทย; `app` ไม่ใช่ TripSplit → `ok:false`; `schemaVersion: 2` → `ok:false` ข้อความ "ไฟล์มาจากเวอร์ชันใหม่กว่า"; ขาด `groups` → `ok:false`
- [ ] **Step 2:** FAIL → **Step 3:** Implement `backup.js` และ `store.js` (store ทดสอบในเบราว์เซอร์ Task 5) → **Step 4:** PASS
- [ ] **Step 5:** Commit `feat: storage and backup format`

### Task 5: App shell, PWA, groups & group settings

**Files:**
- Create: `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `icons/*`, `src/app.js`, `src/router.js`, `src/ui/dom.js`, `src/ui/groups.js`, `src/ui/group-settings.js`, `src/core/model.js` (เพิ่ม), `tests/model.test.js`

**Interfaces:**
- Consumes: `store.js`, `CURRENCIES`
- Produces:
  - routes: `#/` groups, `#/g/:id` group, `#/g/:id/settings`, `#/g/:id/new`, `#/g/:id/e/:eid`, `#/backup`
  - `render(view: (root: HTMLElement, params) => Promise<void>)` ใน router
  - `model.js`: `newGroup({name, kind, memberNames}): Group`, `canRemoveMember(memberId, expenses, settlements): {ok:boolean, usedIn:string[]}` (ชื่อบิล), `recentMemberNames(groups): string[]`

- [ ] **Step 1: test ที่ fail** `tests/model.test.js`: `canRemoveMember` คืน `ok:false` + ชื่อบิลเมื่อสมาชิกเป็นคนจ่าย/อยู่ใน split/items/settlement; คืน `ok:true` เมื่อไม่ถูกอ้าง (Review Focus 1)
- [ ] **Step 2:** FAIL → **Step 3:** Implement model + UI:
  - หน้ากลุ่ม: แยก "ทริป" / "มื้ออาหาร", ปุ่ม + สร้าง (ชื่อ, ประเภท, สมาชิก — แตะเลือกชื่อเพื่อนที่เคยใช้ได้), ปุ่มสำรองข้อมูลที่มุม
  - ตั้งค่ากลุ่ม: เพิ่ม/แก้ชื่อ/ลบสมาชิก (ลบไม่ได้ถ้าถูกอ้าง → แสดงชื่อบิล), ตารางเรตกลาง (เลือกสกุล + "1 JPY = __ บาท"), ลบกลุ่ม (ยืนยัน)
  - SW: แคชไฟล์ทั้งหมดแบบ cache-first, เปลี่ยน `CACHE = 'tripsplit-v1'` เมื่ออัปเดต, ลบแคชเก่าตอน activate; meta `apple-mobile-web-app-capable`, `theme-color`, safe-area padding
  - ไอคอน: ออกแบบเอง (ไม่คล้าย Splitwise) สร้าง PNG ด้วยสคริปต์ Python/สร้าง SVG แล้วแปลงด้วย `sips`
- [ ] **Step 4:** `npm test` → PASS; `preview_start tripsplit` → สร้างทริป 3 คน ตั้งเรต JPY, รีโหลดแล้วข้อมูลยังอยู่, console ไม่มี error, DevTools: SW active และเปิดออฟไลน์ได้ (ตัดเครือข่ายแล้วรีโหลด)
- [ ] **Step 5:** Commit `feat: app shell, PWA, groups and settings`

### Task 6: Expense form (equal/exact, multi-payer, currency) + group page

**Files:**
- Create: `src/ui/expense-form.js`, `src/ui/group.js`

**Interfaces:**
- Consumes: `validateExpense`, `expenseShares`, `expenseTotalTHB`, `balances`, `simplify`, `summaryText`, `parseAmount`, `formatAmount`, store
- Produces: `expenseForm(root, {group, expense?})` — ใช้ต่อใน Task 7 ผ่าน `registerSplitEditor('items', editorFn)`; editor มี signature `(container, {group, split, currency, onChange(split, amount)})`

พฤติกรรม:
- ฟอร์ม: ชื่อบิล, ยอด (คีย์บอร์ดตัวเลข `inputmode="decimal"`), สกุลเงิน (ค่าเริ่ม = สกุลล่าสุดที่ใช้ในกลุ่ม), วันที่ (ค่าเริ่มวันนี้), คนจ่าย (ค่าเริ่ม = สมาชิกคนแรก/คนที่จ่ายล่าสุด; "+ คนจ่ายเพิ่ม" แบ่งยอด), วิธีหาร (แท็บ เท่ากัน / ระบุจำนวน / ทีละจาน), แสดง "≈ ฿x ตามเรตกลาง" และช่อง "ยอดบาทจริง (ถ้ารู้)"
- ปุ่มบันทึก disabled จน `validateExpense` ว่าง; แสดง error ใต้ฟอร์ม (Review Focus 2, 3) — ถ้าขาดเรตมีลิงก์ไปตั้งค่า
- หน้ากลุ่ม: แท็บ "บิล" (เรียงวันล่าสุด, ยอดเดิม + ≈บาท, แตะเพื่อแก้/ลบ) และ "สรุป" (ยอดรวมทริป, ยอดสุทธิรายคนสีเขียว/แดง, รายการโอน simplify, ปุ่ม "บันทึกว่าโอนแล้ว" ต่อรายการ → Settlement, ปุ่ม "คัดลอกสรุป" `navigator.clipboard.writeText` + toast, สวิตช์ปัดเป็นบาทเต็ม)
- ปุ่มลอย "+ เพิ่มบิล" ใช้นิ้วโป้งได้

- [ ] **Step 1:** Implement form + group page
- [ ] **Step 2:** `npm test` → PASS (ไม่ทำให้ core เสีย)
- [ ] **Step 3: ตรวจในเบราว์เซอร์ (มือถือ 375×812):** ทริป a,b,c: a จ่าย 900 บาทหารเท่า; b+c จ่าย 3000 เยนคนละครึ่ง เรต 0.23; แก้บิลเยนเป็นยอดจริง 720 บาท → สรุปตรงกับคำนวณมือ; คนจ่ายรวมไม่ตรง → บันทึกไม่ได้; คัดลอกสรุปได้; "บันทึกว่าโอนแล้ว" แล้วรายการหายไป; screenshot เก็บเป็นหลักฐาน
- [ ] **Step 4:** Commit `feat: expense form and group summary`

### Task 7: Itemized meal editor

**Files:**
- Create: `src/ui/items-editor.js`

**Interfaces:**
- Consumes: `itemsBreakdown`, `registerSplitEditor`, `parseAmount`, `formatAmount`

พฤติกรรม:
- รายการจาน: ชื่อ (ไม่บังคับ) + ราคา + ชิปสมาชิกแตะเลือกคนกิน (ปุ่ม "ทุกคน"); "+ เพิ่มจาน" โฟกัสช่องราคาถัดไปทันที
- Service % (ค่าเริ่ม 0, ปุ่มลัด 10) และ VAT % (ค่าเริ่ม 0, ปุ่มลัด 7)
- สรุปสดรายคน: อาหาร / Service / VAT / รวม; ยอดคำนวณ; ช่อง "ยอดบิลจริง" → ถ้าต่างแสดง "ต่าง ฿x (เฉลี่ยตามสัดส่วนแล้ว)"
- `onChange` ส่ง `split` และ `amount = billTotal ?? computedTotal` กลับฟอร์ม

- [ ] **Step 1:** Implement
- [ ] **Step 2: ตรวจในเบราว์เซอร์:** กรอกตัวอย่างจาก Task 2 (สเต๊ก/ข้าวผัด/ส้มตำ, SC10, VAT7) → รวม 847.44 และรายคนตรง test; ใส่ยอดบิลจริง 850 → ต่าง 2.56 และยอดรวมรายคน = 850.00; มื้ออาหาร (kind meal) ใช้แท็บนี้เป็นค่าเริ่ม
- [ ] **Step 3:** Commit `feat: itemized meal splitting`

### Task 8: Backup & restore UI

**Files:**
- Create: `src/ui/backup-ui.js`; Modify: `src/app.js` (เรียก `requestPersist()` + ตรวจเตือน)

**Interfaces:**
- Consumes: `serialize`, `parseBackup`, `backupFilename`, `store.replaceAll`, `getMeta/setMeta`

พฤติกรรม:
- "สำรองข้อมูล": สร้าง `File` JSON → ถ้า `navigator.canShare({files})` ใช้ `navigator.share` (เลือก "บันทึกลงไฟล์" → iCloud Drive) ไม่งั้นดาวน์โหลดผ่าน `<a download>`; สำเร็จแล้ว `setMeta('lastBackupAt', now)`
- แบนเนอร์เตือนบนหน้ากลุ่มเมื่อมีข้อมูลและ `lastBackupAt` ว่างหรือเก่ากว่า 7 วัน (ปิดชั่วคราวได้ถึงเปิดแอปครั้งถัดไป)
- "กู้คืนจากไฟล์": `<input type=file accept=".json">` → `parseBackup`; ไม่ผ่าน → แสดง error ไม่แตะข้อมูลเดิม (Review Focus 5); ผ่าน → ยืนยัน "แทนที่ข้อมูลทั้งหมดในเครื่อง (X ทริป)" → `replaceAll`
- แสดงสถานะ persistent storage และเวลาสำรองล่าสุด

- [ ] **Step 1:** Implement
- [ ] **Step 2: ตรวจในเบราว์เซอร์:** สำรอง → ลบข้อมูล → กู้คืน → ข้อมูลกลับครบ; กู้ไฟล์เสีย → error ข้อมูลเดิมอยู่; แบนเนอร์ขึ้นเมื่อ `lastBackupAt` ว่าง
- [ ] **Step 3:** Commit `feat: backup and restore`

### Task 9: Deploy to GitHub Pages + install on iPhone

**ต้องขอจายืนยันก่อนทำ** (สร้าง repo สาธารณะบน GitHub บัญชี `yutthapob-ja` = เผยแพร่โค้ดสู่สาธารณะ; GitHub Pages ฟรีต้องเป็น repo public — ข้อมูลการใช้จ่ายไม่อยู่ใน repo)

- [ ] **Step 1:** ตรวจ `git status` สะอาด, ไม่มีไฟล์ส่วนตัวใน repo
- [ ] **Step 2:** หลังจายืนยัน: `gh repo create tripsplit --public --source . --push`; เปิด Pages จาก branch `main` root (`gh api -X POST repos/yutthapob-ja/tripsplit/pages -f "source[branch]=main" -f "source[path]=/"`)
- [ ] **Step 3:** ตรวจ `https://yutthapob-ja.github.io/tripsplit/` ใน browser pane: โหลดได้, SW ลงทะเบียน, ไอคอน/manifest ถูก path
- [ ] **Step 4:** ให้จาเปิดบน iPhone Safari → แชร์ → "เพิ่มไปยังหน้าจอโฮม" → เปิดโหมดเครื่องบินแล้วทดสอบออฟไลน์
- [ ] **Step 5:** เขียน `README.md` สั้น ๆ (วิธีอัปเดต: แก้ → bump `CACHE` ใน sw.js → push) แล้ว commit + push
