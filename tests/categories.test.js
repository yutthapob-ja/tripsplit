import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, categoryOf, guessCategory, categoryTotals } from '../src/core/categories.js';

test('fixed set of 7 categories with emoji and Thai label', () => {
  assert.deepEqual(CATEGORIES.map((c) => c.id), ['food', 'transport', 'stay', 'fun', 'shopping', 'gift', 'other']);
  assert.ok(CATEGORIES.every((c) => c.emoji && c.label));
});

test('categoryOf falls back to none for missing or unknown ids', () => {
  assert.equal(categoryOf('food').label, 'กินดื่ม');
  assert.equal(categoryOf(undefined).id, 'none');
  assert.equal(categoryOf('zzz').id, 'none');
});

test('guessCategory from Thai and English titles', () => {
  assert.equal(guessCategory('ราเมงอิจิรัน'), 'food');
  assert.equal(guessCategory('หมูกระทะ'), 'food');
  assert.equal(guessCategory('กาแฟ Starbucks'), 'food');
  assert.equal(guessCategory('ตั๋วรถไฟ JR'), 'transport');
  assert.equal(guessCategory('แท็กซี่'), 'transport');
  assert.equal(guessCategory('Grab ไปสนามบิน'), 'transport');
  assert.equal(guessCategory('โรงแรม Shinjuku'), 'stay');
  assert.equal(guessCategory('Airbnb'), 'stay');
  assert.equal(guessCategory('ตั๋ว Disneyland'), 'fun');
  assert.equal(guessCategory('Uniqlo'), 'shopping');
  assert.equal(guessCategory('ของฝากที่ทำงาน'), 'gift');
  assert.equal(guessCategory('อะไรก็ไม่รู้'), null);
  assert.equal(guessCategory(''), null);
});

test('categoryTotals sums baht per category, largest first, skips bills without rate', () => {
  const group = { members: [{ id: 'a' }], rates: { JPY: 0.25 } };
  const ex = (category, currency, amount) => ({ category, currency, amount, actualTHB: null,
    payers: [{ memberId: 'a', amount }], split: { type: 'equal', memberIds: ['a'] } });
  const r = categoryTotals(group, [ex('food', 'THB', 30000), ex('food', 'JPY', 1000), ex('transport', 'THB', 10000), ex(undefined, 'THB', 5000), ex('stay', 'KRW', 9999)]);
  assert.deepEqual(r.map((x) => [x.id, x.total]), [['food', 55000], ['transport', 10000], ['none', 5000]]);
  assert.equal(r[0].share.toFixed(4), (55000 / 70000).toFixed(4));
});
