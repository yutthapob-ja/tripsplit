export const CURRENCIES = [
  { code: 'THB', decimals: 2, label: 'บาท' },
  { code: 'JPY', decimals: 0, label: 'เยน' },
  { code: 'KRW', decimals: 0, label: 'วอน' },
  { code: 'USD', decimals: 2, label: 'ดอลลาร์สหรัฐ' },
  { code: 'EUR', decimals: 2, label: 'ยูโร' },
  { code: 'CNY', decimals: 2, label: 'หยวน' },
  { code: 'SGD', decimals: 2, label: 'ดอลลาร์สิงคโปร์' },
  { code: 'HKD', decimals: 2, label: 'ดอลลาร์ฮ่องกง' },
  { code: 'TWD', decimals: 0, label: 'ดอลลาร์ไต้หวัน' },
  { code: 'VND', decimals: 0, label: 'ดอง' },
  { code: 'MYR', decimals: 2, label: 'ริงกิต' },
  { code: 'GBP', decimals: 2, label: 'ปอนด์' },
  { code: 'AUD', decimals: 2, label: 'ดอลลาร์ออสเตรเลีย' },
  { code: 'LAK', decimals: 0, label: 'กีบ' },
  { code: 'IDR', decimals: 0, label: 'รูเปียห์' },
  { code: 'PHP', decimals: 2, label: 'เปโซ' },
];

const MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

export function decimalsOf(code) {
  return MAP.get(code)?.decimals ?? 2;
}

export function labelOf(code) {
  return MAP.get(code)?.label ?? code;
}
