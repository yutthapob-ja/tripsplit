// Thai PromptPay QR (EMVCo merchant-presented) payload builder.

const field = (tag, value) => tag + String(value.length).padStart(2, '0') + value;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as 4 uppercase hex chars. */
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function validNid(d) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

/** Phone (10 digits, leading 0; +66/66 accepted) or 13-digit national ID. */
export function normalizePromptPay(text) {
  let d = String(text || '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.length === 11 && d.startsWith('66')) d = '0' + d.slice(2);
  if (d.length === 10 && d.startsWith('0')) return { type: 'phone', id: d };
  if (d.length === 13 && validNid(d)) return { type: 'nid', id: d };
  return null;
}

/** EMVCo payload; amountSatang > 0 makes it a one-time (dynamic) QR with the amount. */
export function promptPayPayload(target, amountSatang) {
  const hasAmount = amountSatang > 0;
  const account = target.type === 'phone'
    ? field('01', '0066' + target.id.slice(1))
    : field('02', target.id);
  let p = field('00', '01')
    + field('01', hasAmount ? '12' : '11')
    + field('29', field('00', 'A000000677010111') + account)
    + field('58', 'TH')
    + field('53', '764')
    + (hasAmount ? field('54', (amountSatang / 100).toFixed(2)) : '');
  p += '6304';
  return p + crc16(p);
}

export function maskPromptPay(id) {
  if (id.length === 10) return `${id.slice(0, 3)}-xxx-${id.slice(6)}`;
  if (id.length === 13) return `${id[0]}-xxxx-xxxxx-${id.slice(10, 12)}-${id[12]}`;
  return id;
}
