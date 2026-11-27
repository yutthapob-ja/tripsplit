import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, normalizePromptPay, promptPayPayload, maskPromptPay } from '../src/core/promptpay.js';

test('crc16 CCITT-FALSE check value', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('payload without amount matches reference (CRC cross-checked with python binascii.crc_hqx)', () => {
  assert.equal(
    promptPayPayload(normalizePromptPay('000-000-0000'), null),
    '00020101021129370016A000000677010111011300660000000005802TH530376463048956',
  );
});

test('payload with amount is dynamic and has two-decimal amount', () => {
  const p = promptPayPayload(normalizePromptPay('0812345678'), 18000);
  assert.ok(p.startsWith('000201010212'));
  assert.ok(p.includes('5406180.00'));
  assert.ok(p.includes('011300668123456785'));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test('zero amount omits tag 54', () => {
  assert.ok(!promptPayPayload(normalizePromptPay('0812345678'), 0).includes('5404'));
});

test('national id payload uses sub-tag 02', () => {
  const t = normalizePromptPay('1-1017-00203-45-0');
  assert.equal(t?.type, 'nid');
  assert.ok(promptPayPayload(t, null).includes('0213' + '1101700203450'));
});

test('normalize handles +66, spaces and dashes; rejects junk', () => {
  assert.deepEqual(normalizePromptPay('+66 81 234 5678'), { type: 'phone', id: '0812345678' });
  assert.deepEqual(normalizePromptPay('081-234-5678'), { type: 'phone', id: '0812345678' });
  assert.equal(normalizePromptPay('12345'), null);
  assert.equal(normalizePromptPay('1101700203451'), null); // bad checksum
  assert.equal(normalizePromptPay(''), null);
});

test('mask hides middle digits', () => {
  assert.equal(maskPromptPay('0812345678'), '081-xxx-5678');
  assert.equal(maskPromptPay('1101700203450'), '1-xxxx-xxxxx-45-0');
});
