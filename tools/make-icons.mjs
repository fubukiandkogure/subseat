// アプリのアイコン（座席表）を PNG と SVG で作る。追加のライブラリなし（PNG は自前で書き出す）
//   node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const BG = [14, 16, 21];
const SEATS = [
  [227, 52, 77], [116, 87, 240], [44, 123, 224],
  [29, 154, 92], [236, 132, 32], [38, 42, 52],
  [38, 42, 52], [38, 42, 52], [38, 42, 52]
];
// 0〜1 の座標で：スクリーンの弧と 3×3 の席（マスカブル用に中央 80% に収める）
const seatRect = (i) => {
  const c = i % 3, r = Math.floor(i / 3);
  const size = 0.17, gap = 0.045, x0 = 0.5 - (3 * size + 2 * gap) / 2, y0 = 0.39;
  return { x: x0 + c * (size + gap), y: y0 + r * (size + gap), w: size, h: size * 0.94, rt: 0.045, rb: 0.025 };
};

function inRoundRect(px, py, s) {
  if (px < s.x || px > s.x + s.w || py < s.y || py > s.y + s.h) return false;
  const r = py < s.y + s.h / 2 ? s.rt : s.rb;
  const cx = Math.min(Math.max(px, s.x + r), s.x + s.w - r);
  const cy = Math.min(Math.max(py, s.y + r), s.y + s.h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
function onScreenArc(px, py) {
  // 楕円の上半分の弧（太さつき）
  const cx = 0.5, cy = 0.36, rx = 0.33, ry = 0.13, t = 0.022;
  if (py > cy) return false;
  const d = Math.sqrt(((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2);
  return Math.abs(d - 1) * Math.min(rx, ry) < t / 2 && Math.abs(px - cx) < rx * 0.92;
}

function pixel(px, py) {
  for (let i = 0; i < SEATS.length; i++) if (inRoundRect(px, py, seatRect(i))) return SEATS[i];
  if (onScreenArc(px, py)) return [227, 52, 77];
  return BG;
}

function png(size) {
  const SS = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = acc[0] / SS / SS; raw[o + 1] = acc[1] / SS / SS; raw[o + 2] = acc[2] / SS / SS; raw[o + 3] = 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(join(out, name), png(size));
}

const rgb = (c) => `rgb(${c.join(',')})`;
const svgSeats = SEATS.map((c, i) => {
  const s = seatRect(i);
  return `<rect x="${(s.x * 100).toFixed(2)}" y="${(s.y * 100).toFixed(2)}" width="${(s.w * 100).toFixed(2)}" height="${(s.h * 100).toFixed(2)}" rx="${(s.rt * 100).toFixed(2)}" fill="${rgb(c)}"/>`;
}).join('');
writeFileSync(join(out, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${rgb(BG)}"/>` +
  `<path d="M20 34 Q50 14 80 34" fill="none" stroke="rgb(227,52,77)" stroke-width="2.4" stroke-linecap="round"/>${svgSeats}</svg>\n`);
console.log('icons written to', out);
