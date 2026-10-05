// ロゴ「サブスク荘」の文字を、フォントの形から SVG の図形にして js/logo.js に書き出す。
// アプリはフォントを読み込まない（外に通信しない・軽い）。フォントは作るときだけ使う。
//   node tools/make-logo.mjs <DelaGothicOne-Regular.ttf> <RocknRollOne-Regular.ttf>
// フォント：Dela Gothic One / RocknRoll One（どちらも SIL Open Font License 1.1、Google Fonts）
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT = 'サブスク荘';

function parseFont(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o) => dv.getUint16(o), i16 = (o) => dv.getInt16(o), u32 = (o) => dv.getUint32(o);
  const tables = {};
  for (let i = 0, n = u16(4); i < n; i++) {
    const e = 12 + i * 16;
    tables[String.fromCharCode(buf[e], buf[e + 1], buf[e + 2], buf[e + 3])] = u32(e + 8);
  }
  if (!tables.glyf) throw new Error('TrueType の輪郭（glyf）がないフォントです');
  const unitsPerEm = u16(tables.head + 18);
  const longLoca = i16(tables.head + 50) === 1;
  const numHMetrics = u16(tables.hhea + 34);

  // 文字 → グリフ番号（cmap の形式 12 か 4）
  const cmap = tables.cmap;
  let sub12 = null, sub4 = null;
  for (let i = 0, n = u16(cmap + 2); i < n; i++) {
    const r = cmap + 4 + i * 8;
    const pid = u16(r), eid = u16(r + 2), off = cmap + u32(r + 4);
    if (pid === 3 && eid === 10 && u16(off) === 12) sub12 = off;
    if (pid === 3 && eid === 1 && u16(off) === 4) sub4 = off;
  }
  const glyphOf = (cp) => {
    if (sub12 != null) {
      for (let g = 0, n = u32(sub12 + 12); g < n; g++) {
        const r = sub12 + 16 + g * 12;
        if (cp >= u32(r) && cp <= u32(r + 4)) return u32(r + 8) + (cp - u32(r));
      }
    }
    if (sub4 != null) {
      const segX2 = u16(sub4 + 6);
      const ends = sub4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        if (cp > u16(ends + s * 2)) continue;
        const start = u16(starts + s * 2);
        if (cp < start) return 0;
        const ro = u16(ranges + s * 2);
        if (!ro) return (cp + i16(deltas + s * 2)) & 0xffff;
        const g = u16(ranges + s * 2 + ro + (cp - start) * 2);
        return g ? (g + i16(deltas + s * 2)) & 0xffff : 0;
      }
    }
    return 0;
  };
  const advance = (g) => u16(tables.hmtx + Math.min(g, numHMetrics - 1) * 4);
  const locaAt = (g) => (longLoca ? u32(tables.loca + g * 4) : u16(tables.loca + g * 2) * 2);

  // グリフの輪郭（点の配列の配列）。複合グリフは部品を移動して足す
  function contours(g) {
    const start = locaAt(g), end = locaAt(g + 1);
    if (start === end) return [];
    const o = tables.glyf + start;
    const nc = i16(o);
    if (nc < 0) {
      const out = [];
      let p = o + 10, more = true;
      while (more) {
        const flags = u16(p), gi = u16(p + 2);
        p += 4;
        let dx, dy;
        if (flags & 1) { dx = i16(p); dy = i16(p + 2); p += 4; } else { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); p += 2; }
        let a = 1, b = 0, c = 0, d = 1;
        const f2 = (q) => i16(q) / 16384;
        if (flags & 8) { a = d = f2(p); p += 2; } else if (flags & 0x40) { a = f2(p); d = f2(p + 2); p += 4; } else if (flags & 0x80) { a = f2(p); b = f2(p + 2); c = f2(p + 4); d = f2(p + 6); p += 8; }
        for (const ct of contours(gi)) out.push(ct.map((pt) => ({ x: a * pt.x + c * pt.y + dx, y: b * pt.x + d * pt.y + dy, on: pt.on })));
        more = !!(flags & 0x20);
      }
      return out;
    }
    const endPts = [];
    for (let i = 0; i < nc; i++) endPts.push(u16(o + 10 + i * 2));
    const n = endPts[nc - 1] + 1;
    let p = o + 10 + nc * 2;
    p += 2 + u16(p); // 命令はとばす
    const flags = [];
    while (flags.length < n) {
      const f = buf[p++];
      flags.push(f);
      if (f & 8) { let r = buf[p++]; while (r--) flags.push(f); }
    }
    const xs = [], ys = [];
    let v = 0;
    for (const f of flags) { if (f & 2) { const d = buf[p++]; v += f & 16 ? d : -d; } else if (!(f & 16)) { v += i16(p); p += 2; } xs.push(v); }
    v = 0;
    for (const f of flags) { if (f & 4) { const d = buf[p++]; v += f & 32 ? d : -d; } else if (!(f & 32)) { v += i16(p); p += 2; } ys.push(v); }
    const out = [];
    let s = 0;
    for (const e of endPts) {
      const ct = [];
      for (let i = s; i <= e; i++) ct.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
      out.push(ct);
      s = e + 1;
    }
    return out;
  }
  return { unitsPerEm, glyphOf, advance, contours };
}

// 2次ベジェの輪郭を SVG の path に（y は下向きに反転）
function toPath(cts, ox, scale) {
  const P = (pt) => `${+(ox + pt.x * scale).toFixed(2)} ${+(-pt.y * scale).toFixed(2)}`;
  let d = '';
  for (const ct of cts) {
    if (!ct.length) continue;
    const pts = ct.slice();
    let startIdx = pts.findIndex((q) => q.on);
    let start;
    if (startIdx < 0) { start = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, on: true }; startIdx = 0; pts.unshift(start); } else start = pts[startIdx];
    const seq = [...pts.slice(startIdx + 1), ...pts.slice(0, startIdx), start];
    d += `M${P(start)}`;
    let ctrl = null;
    for (const q of seq) {
      if (q.on) { d += ctrl ? `Q${P(ctrl)} ${P(q)}` : `L${P(q)}`; ctrl = null; }
      else if (ctrl) { const mid = { x: (ctrl.x + q.x) / 2, y: (ctrl.y + q.y) / 2 }; d += `Q${P(ctrl)} ${P(mid)}`; ctrl = q; }
      else ctrl = q;
    }
    d += 'Z';
  }
  return d;
}

function logoFrom(file, { spacing = 0 } = {}) {
  const f = parseFont(readFileSync(file));
  const scale = 100 / f.unitsPerEm; // 1em = 100
  let x = 0, d = '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ch of TEXT) {
    const g = f.glyphOf(ch.codePointAt(0));
    if (!g) throw new Error(`${file} に「${ch}」がありません`);
    const cts = f.contours(g);
    for (const ct of cts) for (const pt of ct) {
      minX = Math.min(minX, x + pt.x * scale); maxX = Math.max(maxX, x + pt.x * scale);
      minY = Math.min(minY, -pt.y * scale); maxY = Math.max(maxY, -pt.y * scale);
    }
    d += toPath(cts, x, scale);
    x += f.advance(g) * scale + spacing;
  }
  const pad = 1;
  return { viewBox: [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map((n) => +n.toFixed(2)).join(' '), d };
}

const [dela, rock] = process.argv.slice(2);
if (!dela || !rock) { console.error('使い方: node tools/make-logo.mjs <DelaGothicOne-Regular.ttf> <RocknRollOne-Regular.ttf>'); process.exit(1); }
const day = logoFrom(dela, { spacing: 4 });
const night = logoFrom(rock, { spacing: 8 });
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'logo.js');
writeFileSync(out, `// ロゴ「サブスク荘」の文字の形（tools/make-logo.mjs で作る。手で直さない）
// 昼：Dela Gothic One、夜：RocknRoll One（どちらも SIL Open Font License 1.1 / Google Fonts）
export const LOGO_DAY = ${JSON.stringify(day)};
export const LOGO_NIGHT = ${JSON.stringify(night)};
`);
console.log('written', out, `day ${day.d.length} / night ${night.d.length} chars`);
