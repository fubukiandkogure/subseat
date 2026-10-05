import { squarify } from './model.js';
import { logoSvg } from './pixel.js';

// 間取り図を SVG で描く。色は CSS の変数から実際の値を読んで埋め込む（そのまま画像に書き出せるように）
export const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic UI',Meiryo,system-ui,sans-serif";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const f1 = (n) => Math.round(n * 10) / 10;

// 家具のアイコン（32×32 の線画。FILL は塗りの色に置き換える）
const ICONS = {
  video: '<rect x="4" y="7" width="24" height="15" rx="2.5"/><path d="M12 26h8M16 22v4"/>',
  ai: '<rect x="7" y="10" width="18" height="14" rx="4"/><path d="M16 10V6.5"/><circle cx="16" cy="5" r="1.6" fill="FILL" stroke="none"/><circle cx="12.5" cy="17" r="1.7" fill="FILL" stroke="none"/><circle cx="19.5" cy="17" r="1.7" fill="FILL" stroke="none"/>',
  music: '<path d="M6 19v-3a10 10 0 0 1 20 0v3"/><rect x="5" y="18" width="5" height="8" rx="2"/><rect x="22" y="18" width="5" height="8" rx="2"/>',
  cloud: '<path d="M10 24h13a5 5 0 0 0 0-10 7 7 0 0 0-13-1 5.5 5.5 0 0 0 0 11z"/>',
  game: '<rect x="4" y="10" width="24" height="13" rx="6"/><path d="M10 14v5M7.5 16.5h5"/><circle cx="21" cy="15" r="1.4" fill="FILL" stroke="none"/><circle cx="23.5" cy="18.5" r="1.4" fill="FILL" stroke="none"/>',
  other: '<path d="M5 11l11-5 11 5v11l-11 5-11-5z"/><path d="M5 11l11 5 11-5M16 16v11"/>'
};

function icon(name, x, y, size, color) {
  const body = (ICONS[name] || ICONS.other).replace(/FILL/g, color);
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${(size / 32).toFixed(3)})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

// ---------- 色 ----------
function toRgb(c) {
  c = c.trim();
  if (c.startsWith('#')) {
    const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join('') : c.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = c.match(/\d+(\.\d+)?/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return '#' + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

export function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const cat = {};
  for (const id of ['video', 'ai', 'music', 'cloud', 'game', 'other', 'fixed']) cat[id] = v(`--cat-${id}`);
  return {
    floor: v('--plan-floor'), wall: v('--plan-wall'), ink: v('--text'), muted: v('--muted'), freed: v('--freed'),
    warn: v('--warn'), accent: v('--accent'), surface: v('--surface'), dark: v('color-scheme') === 'dark' || toRgb(v('--plan-floor'))[0] < 90, cat
  };
}

// ---------- 文字の幅 ----------
let mctx = null;
function textW(str, size, weight = 800) {
  mctx ||= document.createElement('canvas').getContext('2d');
  mctx.font = `${weight} ${size}px ${FONT}`;
  return mctx.measureText(str).width;
}
function fit(str, maxW, size, min, weight = 800) {
  let s = size;
  while (s > min && textW(str, s, weight) > maxW) s -= 0.5;
  if (textW(str, s, weight) <= maxW) return { text: str, size: s };
  let t = str;
  while (t.length > 1 && textW(t + '…', s, weight) > maxW) t = t.slice(0, -1);
  return { text: t.length > 1 ? t + '…' : '', size: s };
}

// ---------- 配置 ----------
const PAD = 7;
export function layoutSubs(rooms, w, h) {
  return squarify(rooms, PAD, PAD, w - PAD * 2, h - PAD * 2);
}
// 札（部屋の状態）
function signOf(r, vacant) {
  if (vacant) return null;
  if (r.trial) return { text: '内見中', tone: 'warn' };
  if (r.status === 'cancel') return { text: '退去予定', tone: 'muted' };
  if (r.raise) return { text: '値上げ', tone: 'accent' };
  if (r.status === 'review') return { text: '様子見', tone: 'ink' };
  return null;
}

// 部屋に出す金額。unit は 'month' | 'year' | 'none'（画像で金額を隠すとき）
const yen = (n) => Math.round(n).toLocaleString('ja-JP');
function amounts(value, unit) {
  if (unit === 'none') return { num: '', per: '', other: '' };
  return unit === 'year'
    ? { num: yen(value), per: '円/年', other: `月 ${yen(value / 12)}円` }
    : { num: yen(value / 12), per: '円/月', other: `年 ${yen(value)}円` };
}
export const amountText = (value, unit) => (unit === 'year' ? `年 ${yen(value)}円` : `月 ${yen(value / 12)}円`);

function roomSvg(r, P, o) {
  const vac = o.vacant.has(r.id);
  const base = P.cat[r.category] || P.cat.other;
  const fill = vac ? `url(#${o.pid}-hatch)` : mix(base, P.floor, P.dark ? 0.3 : 0.17);
  const parts = [`<rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" fill="${fill}" stroke="${P.wall}" stroke-width="2.4"/>`];
  const fullLabel = `月 ${yen(r.value / 12)}円・年 ${yen(r.value)}円`;

  const ink = vac ? P.muted : P.ink;
  const color = vac ? P.muted : base;
  const scale = Math.sqrt(r.w * r.h);
  const tiny = r.w < 34 || r.h < 26;
  const inner = r.w - 12;
  const lines = [];
  if (!vac) parts.push(`<rect x="${f1(r.x)}" y="${f1(r.y)}" width="${f1(r.w)}" height="${f1(r.h)}" fill="url(#${o.pid}-planks)" pointer-events="none"/>`);
  if (!tiny) {
    const iconSize = clamp(scale / 5, 16, 34);
    const bigSize = clamp(scale / 6.2, 11, 26);
    const nameSize = clamp(scale / 10, 9, 16);
    const smallSize = clamp(scale / 13.5, 8.5, 12.5);
    const name = vac ? '空き部屋' : r.name;
    const sub = vac ? `${r.name} が退去` : '';
    const a = amounts(r.value, o.unit);
    const nm = fit(name, inner, nameSize, 8);
    const room = r.h - 12;
    const want = [];
    if (!vac && room > iconSize + bigSize + nameSize + 16 && inner > 36) want.push({ kind: 'icon', h: iconSize + 4, size: iconSize, name: r.category });
    if (nm.text) want.push({ kind: 'name', h: nm.size * 1.25, ...nm });
    if (sub && room > bigSize + nameSize * 2.6) want.push({ kind: 'sub', h: smallSize * 1.35, ...fit(sub, inner, smallSize, 8, 700) });
    // 大きい数字：入りきらなければ文字を小さく → 単位を外す → 出さない
    if (a.num) {
      let size = bigSize, per = a.per;
      const unitOf = (sz) => Math.max(8, sz * 0.5);
      const width = (sz, p) => textW(a.num, sz, 900) + (p ? textW(p, unitOf(sz), 900) + 1 : 0);
      while (size > 9 && width(size, per) > inner) size -= 0.5;
      if (width(size, per) > inner) { per = ''; size = bigSize; while (size > 9 && width(size, '') > inner) size -= 0.5; }
      if (width(size, per) <= inner) want.push({ kind: 'big', h: size * 1.15, size, text: a.num, per, unit: unitOf(size) });
    }
    const other = a.other ? fit(a.other, inner, smallSize, 8, 700) : null;
    // 小さい部屋で途中で切れるなら出さない（金額は … で切らない）
    if (other && !other.text.endsWith('…') && room > bigSize + nameSize * 1.25 + smallSize * 1.4 + 6) want.push({ kind: 'other', h: smallSize * 1.35, ...other });
    let total = want.reduce((acc, x) => acc + x.h, 0);
    while (total > room && want.length > 1) {
      const drop = ['icon', 'sub', 'other', 'big'].map((k) => want.findIndex((x) => x.kind === k)).find((i) => i >= 0);
      total -= want.splice(drop ?? want.length - 1, 1)[0].h;
    }
    let y = r.y + r.h / 2 - total / 2;
    const cx = r.x + r.w / 2;
    for (const it of want) {
      if (it.kind === 'icon') lines.push(icon(it.name, cx - it.size / 2, y, it.size, color));
      else if (it.kind === 'big') {
        const wNum = textW(it.text, it.size, 900), wUnit = it.per ? textW(it.per, it.unit, 900) + 1 : 0;
        const sx = cx - (wNum + wUnit) / 2;
        lines.push(`<text x="${f1(sx)}" y="${f1(y + it.size * 0.92)}" font-size="${f1(it.size)}" font-weight="900" fill="${ink}">${esc(it.text)}${it.per ? `<tspan font-size="${f1(it.unit)}" dx="1">${esc(it.per)}</tspan>` : ''}</text>`);
      } else {
        const weight = it.kind === 'name' ? 900 : 700;
        const fillC = it.kind === 'name' ? ink : P.muted;
        lines.push(`<text x="${f1(cx)}" y="${f1(y + it.size * 0.95)}" text-anchor="middle" font-size="${f1(it.size)}" font-weight="${weight}" fill="${fillC}">${esc(it.text)}</text>`);
      }
      y += it.h;
    }
    // 扉（大きめの部屋だけ。飾り）
    if (!vac && r.w >= 80 && r.h >= 80) {
      const dx = r.x + 12, dy = r.y + r.h;
      lines.push(`<path d="M${f1(dx)} ${f1(dy)}h22" stroke="${P.floor}" stroke-width="4"/><path d="M${f1(dx)} ${f1(dy)}v-20M${f1(dx)} ${f1(dy - 20)}A20 20 0 0 1 ${f1(dx + 20)} ${f1(dy)}" fill="none" stroke="${P.wall}" stroke-width="1.4"/>`);
    }
    // 部屋番号（左上。間取り図のように）
    if (r.roomNo && r.w >= 44 && r.h >= 34) lines.push(`<text x="${f1(r.x + 6)}" y="${f1(r.y + 13)}" font-size="8.5" font-weight="800" fill="${P.muted}" opacity="0.85">${r.roomNo}</text>`);
    // 札
    const sign = signOf(r, vac);
    if (sign && r.w >= 58 && r.h >= 44) {
      const tone = { warn: P.warn, muted: P.muted, accent: P.accent, ink: P.ink }[sign.tone];
      const tw = textW(sign.text, 9.5, 900) + 10;
      const sx = r.x + r.w - tw - 5, sy = r.y + 5;
      lines.push(`<rect x="${f1(sx)}" y="${f1(sy)}" width="${f1(tw)}" height="16" rx="4" fill="${tone}"/><text x="${f1(sx + tw / 2)}" y="${f1(sy + 11.6)}" text-anchor="middle" font-size="9.5" font-weight="900" fill="${P.surface}">${esc(sign.text)}</text>`);
    }
  }
  const no = r.roomNo ? `${r.roomNo}号室 ` : '';
  const label = vac ? `${no}空き部屋（${r.name} が退去）${fullLabel}` : `${no}${r.name} ${fullLabel}`;
  return `<g class="room${vac ? ' vacant' : ''}" data-id="${esc(r.id)}" role="button" tabindex="0" aria-label="${esc(label)}"><title>${esc(label)}</title>${parts.join('')}${lines.join('')}</g>`;
}

let seq = 0;
// rooms はすでに配置済み（x, y, w, h を持つ）もの
export function planSvg(laid, { w, h, vacant = new Set(), unit = 'month', palette } = {}) {
  const P = palette || readPalette();
  const pid = `plan${++seq}`;
  const o = { vacant, unit, pid };
  const hatchLine = mix(P.freed, P.floor, P.dark ? 0.55 : 0.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" font-family="${FONT}" role="group" aria-label="間取り図">` +
    `<defs><pattern id="${pid}-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="${P.floor}"/><rect width="4" height="10" fill="${hatchLine}"/></pattern>` +
    `<pattern id="${pid}-planks" width="44" height="16" patternUnits="userSpaceOnUse"><path d="M0 8h44M0 16h44M14 0v8M36 8v8" stroke="${P.wall}" stroke-width="0.7" opacity="${P.dark ? 0.16 : 0.08}" fill="none"/></pattern></defs>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${P.floor}"/>` +
    laid.map((r) => roomSvg(r, P, o)).join('') +
    `<rect x="3.5" y="3.5" width="${w - 7}" height="${h - 7}" fill="none" stroke="${P.wall}" stroke-width="7" rx="2"/></svg>`;
}

// ---------- 画像にする（共有・保存用） ----------
export function shareSvg(laid, { w, h, title, sub, footer, unit, palette }) {
  const P = palette || readPalette();
  const W = 1080, H = 1350, M = 72, top = 250;
  const inner = planSvg(laid, { w, h, unit, palette: P }).replace('width="100%"', `x="${M}" y="${top}" width="${W - M * 2}" height="${H - top - 110}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">` +
    `<rect width="${W}" height="${H}" fill="${P.surface}"/>` +
    `<text x="${M}" y="118" font-size="44" font-weight="900" fill="${P.ink}">${esc(title)}</text>` +
    `<text x="${M}" y="182" font-size="30" font-weight="700" fill="${P.muted}">${esc(sub)}</text>` +
    inner +
    `<text x="${M}" y="${H - 48}" font-size="24" font-weight="700" fill="${P.muted}">${esc(footer)}</text>` +
    logoSvg({ night: P.dark, scale: 3 }).replace('<svg ', `<svg x="${W - M - 294}" y="${H - 96}" `) + '</svg>';
}

export function svgToPng(svg, width = 1080, height = 1350) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('画像にできませんでした'))), 'image/png');
    };
    img.onerror = () => reject(new Error('画像にできませんでした'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
