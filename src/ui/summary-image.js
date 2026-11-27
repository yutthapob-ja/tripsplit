import { qrModules } from './qr.js';
import { avatarColor } from './dom.js';
import { formatAmount } from '../core/money.js';

const W = 1080, M = 40, CW = W - M * 2, PAD = 36;
const FONT = '-apple-system, "Sukhumvit Set", Thonburi, "Noto Sans Thai", sans-serif';
const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;
const THB = (s) => '฿' + formatAmount(s, 'THB');
const INK = '#3A2E2A', MUTED = '#9A8B83';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx, text, maxW) {
  text = String(text ?? '');
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > maxW) chars.pop();
  return chars.join('') + '…';
}

function text(ctx, str, x, y, { size = 30, weight = 400, color = INK, align = 'left', maxW } = {}) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(maxW ? fit(ctx, str, maxW) : str, x, y);
}

function card(ctx, y, h, dry) {
  if (dry) return;
  ctx.save();
  ctx.shadowColor = 'rgba(120,70,40,0.12)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#fff';
  rr(ctx, M, y, CW, h, 32);
  ctx.fill();
  ctx.restore();
}

function qr(ctx, payload, x, y, size) {
  const grid = qrModules(payload);
  const n = grid.length + 8;
  const cell = size / n;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid.length; c++) {
    if (grid[r][c]) ctx.fillRect(Math.round(x + (c + 4) * cell), Math.round(y + (r + 4) * cell), Math.ceil(cell), Math.ceil(cell));
  }
  ctx.strokeStyle = '#EFE3DA';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
}

function pill(ctx, label, rightX, cy, bg, fg) {
  ctx.font = font(28, 700);
  const w = ctx.measureText(label).width + 40;
  ctx.fillStyle = bg;
  rr(ctx, rightX - w, cy - 24, w, 48, 24);
  ctx.fill();
  text(ctx, label, rightX - w / 2, cy + 1, { size: 28, weight: 700, color: fg, align: 'center' });
  return w;
}

function draw(ctx, model, dry) {
  const date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  let y = M;
  const ix = M + PAD, iw = CW - PAD * 2;

  // hero
  const heroH = 300;
  if (!dry) {
    const g = ctx.createLinearGradient(M, y, M + CW, y + heroH);
    g.addColorStop(0, '#FF6B4A'); g.addColorStop(0.55, '#FF9F45'); g.addColorStop(1, '#FFC85C');
    ctx.save();
    ctx.shadowColor = 'rgba(255,107,74,0.35)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    ctx.fillStyle = g;
    rr(ctx, M, y, CW, heroH, 40);
    ctx.fill();
    ctx.restore();
    text(ctx, model.kind === 'meal' ? '🍜' : '✈️', M + CW - PAD, y + 62, { size: 56, align: 'right' });
    text(ctx, model.title, ix, y + 62, { size: 54, weight: 800, color: '#fff', maxW: iw - 90 });
    text(ctx, 'ยอดรวม ' + THB(model.total), ix, y + 154, { size: 76, weight: 800, color: '#fff', maxW: iw });
    text(ctx, `${model.members.length} คน · เฉลี่ยคนละ ${THB(model.avg)}`, ix, y + 244, { size: 32, weight: 500, color: 'rgba(255,255,255,0.95)', maxW: iw });
  }
  y += heroH + 32;

  if (model.missing > 0) {
    text(ctx, `⚠️ ยังไม่รวม ${model.missing} บิลที่ไม่มีเรต`, M + 8, y + 18, { size: 28, color: '#C2410C' });
    y += 56;
  }

  // categories
  if (model.categories.length) {
    const rowH = 96, h = PAD + 56 + model.categories.length * rowH + PAD - 20;
    card(ctx, y, h, dry);
    if (!dry) {
      text(ctx, 'ใช้ไปกับอะไร', ix, y + PAD + 20, { size: 38, weight: 800 });
      model.categories.forEach((c, i) => {
        const ry = y + PAD + 56 + i * rowH;
        text(ctx, `${c.emoji} ${c.label}`, ix, ry + 20, { size: 30, weight: 600, maxW: iw - 330 });
        text(ctx, `${Math.round(c.share * 100)}%`, ix + iw, ry + 20, { size: 28, color: MUTED, align: 'right' });
        text(ctx, THB(c.total), ix + iw - 100, ry + 20, { size: 30, weight: 700, align: 'right' });
        ctx.fillStyle = '#F5EBE3';
        rr(ctx, ix, ry + 46, iw, 18, 9); ctx.fill();
        const bw = Math.max(18, iw * Math.min(1, c.share));
        ctx.fillStyle = c.color;
        rr(ctx, ix, ry + 46, bw, 18, 9); ctx.fill();
      });
    }
    y += h + 32;
  }

  // members
  {
    const rowH = 84, h = PAD + 56 + model.members.length * rowH + PAD - 20;
    card(ctx, y, h, dry);
    if (!dry) {
      text(ctx, 'ยอดสุทธิรายคน', ix, y + PAD + 20, { size: 38, weight: 800 });
      model.members.forEach((m, i) => {
        const cy = y + PAD + 56 + i * rowH + 30;
        ctx.fillStyle = avatarColor(m);
        ctx.beginPath(); ctx.arc(ix + 30, cy, 30, 0, Math.PI * 2); ctx.fill();
        const nm = (m.name || '?').trim();
        const initial = Array.from(nm.replace(/^[เแโใไ]+/, ''))[0] || Array.from(nm)[0] || '?';
        text(ctx, initial, ix + 30, cy + 1, { size: 30, weight: 700, color: '#fff', align: 'center' });
        const [label, bg, fg] = m.net > 0 ? [`ได้คืน ${THB(m.net)}`, '#DCF5E3', '#15803D']
          : m.net < 0 ? [`ต้องจ่าย ${THB(-m.net)}`, '#FEE2E2', '#B91C1C'] : ['เคลียร์แล้ว ✓', '#EEE9E5', '#7C6F68'];
        ctx.font = font(28, 700);
        const pw = ctx.measureText(label).width + 40;
        text(ctx, nm, ix + 78, cy, { size: 32, weight: 600, maxW: iw - 78 - pw - 20 });
        pill(ctx, label, ix + iw, cy, bg, fg);
      });
    }
    y += h + 32;
  }

  // transfers
  {
    const ts = model.transfers;
    const rowH = (t) => (t.payload ? 300 : 84);
    const body = ts.length ? ts.reduce((s, t) => s + rowH(t), 0) : 90;
    const h = PAD + 56 + body + PAD - 20;
    card(ctx, y, h, dry);
    if (!dry) {
      text(ctx, 'ต้องโอน', ix, y + PAD + 20, { size: 38, weight: 800 });
      let ry = y + PAD + 56;
      if (!ts.length) text(ctx, '🎉 เคลียร์ครบแล้ว', ix + iw / 2, ry + 30, { size: 40, weight: 700, align: 'center' });
      ts.forEach((t, i) => {
        const rh = rowH(t);
        if (i > 0) { ctx.fillStyle = '#F5EBE3'; ctx.fillRect(ix, ry - 10, iw, 2); }
        const cy = ry + (t.payload ? 28 : 30);
        ctx.font = font(34, 700);
        const aw = ctx.measureText(THB(t.amount)).width;
        text(ctx, `${t.fromName} → ${t.toName}`, ix, cy, { size: 32, weight: 600, maxW: iw - aw - 30 });
        text(ctx, THB(t.amount), ix + iw, cy, { size: 34, weight: 700, color: '#EA580C', align: 'right' });
        if (t.payload) {
          qr(ctx, t.payload, ix, ry + 60, 220);
          text(ctx, `สแกนจ่าย ${t.toName}`, ix + 250, ry + 60 + 110, { size: 30, color: MUTED, maxW: iw - 250 });
        }
        ry += rh;
      });
    }
    y += h + 32;
  }

  if (!dry) {
    text(ctx, `สรุปจาก TripSplit · ${date}`, W / 2, y + 14, { size: 24, color: MUTED, align: 'center' });
  }
  y += 28 + M;
  return y;
}

export function renderSummaryImage(model) {
  const probe = document.createElement('canvas');
  probe.width = W; probe.height = 10;
  const height = Math.ceil(draw(probe.getContext('2d'), model, true));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFF6EE';
  ctx.fillRect(0, 0, W, height);
  draw(ctx, model, false);
  return canvas;
}

export function canvasToFile(canvas, filename) {
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: 'image/png' });
}
