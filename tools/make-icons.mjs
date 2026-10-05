// アプリのアイコン（サブスク荘の建物）を PNG と SVG で作る。追加のライブラリなし（PNG は自前で書き出す）
//   node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

// 朱色の地に、生成りのアパート（サブスク荘）。窓はあかり・カテゴリの色。マスカブル用に中央に収める
const BG = [212, 70, 44];
const WALL = [246, 231, 204];
const ROOF = [59, 48, 42];
const ROOF_Y = [0.25, 0.36], ROOF_TOP = [0.25, 0.75], ROOF_BOTTOM = [0.15, 0.85];
const BODY = { x0: 0.2, y0: 0.36, x1: 0.8, y1: 0.78 };
const GROUND = { x0: 0.13, y0: 0.78, x1: 0.87, y1: 0.815 };
const WINDOWS = [
  { x0: 0.27, y0: 0.42, x1: 0.44, y1: 0.54, c: [255, 210, 122] },
  { x0: 0.56, y0: 0.42, x1: 0.73, y1: 0.54, c: [111, 95, 196] },
  { x0: 0.27, y0: 0.61, x1: 0.44, y1: 0.73, c: [58, 120, 185] },
  { x0: 0.56, y0: 0.61, x1: 0.73, y1: 0.73, c: [255, 210, 122] }
];
const FRAME = 0.018;
const inBox = (px, py, r) => px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1;

function pixel(px, py) {
  if (py >= ROOF_Y[0] && py <= ROOF_Y[1]) {
    const t = (py - ROOF_Y[0]) / (ROOF_Y[1] - ROOF_Y[0]);
    const l = ROOF_TOP[0] + (ROOF_BOTTOM[0] - ROOF_TOP[0]) * t, r = ROOF_TOP[1] + (ROOF_BOTTOM[1] - ROOF_TOP[1]) * t;
    if (px >= l && px <= r) return ROOF;
  }
  if (inBox(px, py, GROUND)) return ROOF;
  if (inBox(px, py, BODY)) {
    for (const w of WINDOWS) {
      if (inBox(px, py, w)) {
        const inner = { x0: w.x0 + FRAME, y0: w.y0 + FRAME, x1: w.x1 - FRAME, y1: w.y1 - FRAME };
        const mid = Math.abs(px - (w.x0 + w.x1) / 2) < FRAME / 2;
        return inBox(px, py, inner) && !mid ? w.c : ROOF;
      }
    }
    return WALL;
  }
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
const pct = (n) => (n * 100).toFixed(2);
const rect = (r, fill) => `<rect x="${pct(r.x0)}" y="${pct(r.y0)}" width="${pct(r.x1 - r.x0)}" height="${pct(r.y1 - r.y0)}" fill="${fill}"/>`;
const svgWin = WINDOWS.map((w) => rect(w, rgb(ROOF)) + rect({ x0: w.x0 + FRAME, y0: w.y0 + FRAME, x1: w.x1 - FRAME, y1: w.y1 - FRAME }, rgb(w.c)) + rect({ x0: (w.x0 + w.x1) / 2 - FRAME / 2, y0: w.y0, x1: (w.x0 + w.x1) / 2 + FRAME / 2, y1: w.y1 }, rgb(ROOF))).join('');
writeFileSync(join(out, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${rgb(BG)}"/>` +
  `<polygon points="${pct(ROOF_TOP[0])},${pct(ROOF_Y[0])} ${pct(ROOF_TOP[1])},${pct(ROOF_Y[0])} ${pct(ROOF_BOTTOM[1])},${pct(ROOF_Y[1])} ${pct(ROOF_BOTTOM[0])},${pct(ROOF_Y[1])}" fill="${rgb(ROOF)}"/>` +
  rect(BODY, rgb(WALL)) + rect(GROUND, rgb(ROOF)) + svgWin + '</svg>\n');
console.log('icons written to', out);
