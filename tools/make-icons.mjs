// アプリのアイコン（間取り図）を PNG と SVG で作る。追加のライブラリなし（PNG は自前で書き出す）
//   node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const BG = [14, 16, 21];
const WALL = [233, 235, 240];
// 外壁の中に、大きさの違う部屋（AI・動画・クラウド・音楽・ゲーム）。マスカブル用に中央 70% に収める
const OUT = { x0: 0.165, y0: 0.165, x1: 0.835, y1: 0.835 };
const ROOMS = [
  { x0: 0.2, y0: 0.2, x1: 0.52, y1: 0.8, c: [116, 87, 240] },
  { x0: 0.52, y0: 0.2, x1: 0.8, y1: 0.5, c: [229, 72, 77] },
  { x0: 0.52, y0: 0.5, x1: 0.8, y1: 0.68, c: [44, 123, 224] },
  { x0: 0.52, y0: 0.68, x1: 0.68, y1: 0.8, c: [29, 154, 92] },
  { x0: 0.68, y0: 0.68, x1: 0.8, y1: 0.8, c: [236, 132, 32] }
];
const INNER = 0.012;

function pixel(px, py) {
  if (px < OUT.x0 || px > OUT.x1 || py < OUT.y0 || py > OUT.y1) return BG;
  for (const r of ROOMS) {
    if (px >= r.x0 + INNER && px <= r.x1 - INNER && py >= r.y0 + INNER && py <= r.y1 - INNER) return r.c;
  }
  return WALL;
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
const svgRooms = ROOMS.map((r) => `<rect x="${pct(r.x0 + INNER)}" y="${pct(r.y0 + INNER)}" width="${pct(r.x1 - r.x0 - INNER * 2)}" height="${pct(r.y1 - r.y0 - INNER * 2)}" fill="${rgb(r.c)}"/>`).join('');
writeFileSync(join(out, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${rgb(BG)}"/>` +
  `<rect x="${pct(OUT.x0)}" y="${pct(OUT.y0)}" width="${pct(OUT.x1 - OUT.x0)}" height="${pct(OUT.y1 - OUT.y0)}" fill="${rgb(WALL)}"/>${svgRooms}</svg>\n`);
console.log('icons written to', out);
