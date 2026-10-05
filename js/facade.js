import { mix, FONT } from './plan.js';
import { ROOMS_PER_FLOOR } from './model.js';
import { LOGO_DAY, LOGO_NIGHT } from './logo.js';

// サブスク荘の外観。部屋番号の場所に窓とドアがあり、窓の色はカテゴリ。
// 昼（ライト）はカーテン、夜（ダーク）は明かりがつく。窓を押すとその部屋を開く。
const W = 360, FH = 46, UW = 66, BX = 20;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(n * 10) / 10;

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const cat = {};
  for (const id of ['video', 'ai', 'music', 'cloud', 'game', 'other']) cat[id] = v(`--cat-${id}`);
  return {
    sky1: v('--fa-sky-1'), sky2: v('--fa-sky-2'), wall: v('--fa-wall'), line: v('--fa-wall-line'), roof: v('--fa-roof'),
    slab: v('--fa-slab'), glass: v('--fa-glass'), glow: v('--fa-glow'), door: v('--fa-door'), ground: v('--fa-ground'),
    ink: v('--plan-wall'), warn: v('--warn'), accent: v('--accent'), night: v('--fa-night') === '1', cat
  };
}

// 星の位置（毎回同じ）
const STARS = [[18, 10], [52, 22], [88, 8], [130, 18], [170, 6], [205, 24], [240, 12], [300, 20], [338, 8], [112, 30], [262, 30], [348, 30]];

// rooms: [{ id, name, roomNo, category, status, trial, raise }]。height を渡すと、その高さになるよう空を広げる
export function facadeSvg(rooms, { height } = {}) {
  const P = palette();
  const byNo = new Map(rooms.filter((r) => r.roomNo).map((r) => [r.roomNo, r]));
  const floors = Math.max(2, ...rooms.map((r) => Math.floor((r.roomNo || 101) / 100)));
  const bw = UW * ROOMS_PER_FLOOR;
  const TOP = Math.max(40, (height || 0) - floors * FH - 14);
  const ground = TOP + floors * FH;
  const H = ground + 14;
  const bottomOf = (f) => TOP + (floors - f + 1) * FH; // f 階の床の高さ
  const out = [];

  // 空と地面
  out.push(`<defs><linearGradient id="fa-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient></defs>`);
  out.push(`<rect width="${W}" height="${H}" fill="url(#fa-sky)"/>`);
  if (P.night) {
    out.push(STARS.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff" opacity="${i % 2 ? 0.55 : 0.85}"/>`).join(''));
    out.push(`<circle cx="322" cy="18" r="9" fill="#ffe7a8"/><circle cx="326" cy="15" r="8" fill="${P.sky1}"/>`);
  } else {
    out.push(`<g fill="#fff" opacity="0.85"><ellipse cx="58" cy="16" rx="18" ry="6"/><ellipse cx="70" cy="12" rx="11" ry="6"/><ellipse cx="276" cy="20" rx="15" ry="5"/><ellipse cx="286" cy="16" rx="9" ry="5"/></g>`);
  }
  out.push(`<rect x="0" y="${ground}" width="${W}" height="14" fill="${P.ground}"/>`);

  // 建物（屋根・板張りの壁）
  out.push(`<polygon points="${BX - 10},${TOP} ${BX + bw + 10},${TOP} ${BX + bw - 2},${TOP - 11} ${BX + 2},${TOP - 11}" fill="${P.roof}"/>`);
  out.push(`<rect x="${BX}" y="${TOP}" width="${bw}" height="${floors * FH}" fill="${P.wall}"/>`);
  for (let y = TOP + 6; y < ground; y += 6) out.push(`<line x1="${BX}" y1="${y}" x2="${BX + bw}" y2="${y}" stroke="${P.line}" stroke-width="1"/>`);
  // 屋根の上の看板
  const sx = BX + bw / 2 - 38, sy = TOP - 29;
  if (P.night) {
    out.push(`<defs><filter id="fa-neon" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="1.6" result="b"/><feFlood flood-color="#ff6a2e"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`);
    out.push(`<rect x="${sx}" y="${sy}" width="76" height="18" rx="3" fill="#15131b" stroke="#3a3542" stroke-width="1"/>`);
    out.push(`<svg class="fa-neon" x="${sx + 6}" y="${sy + 3}" width="64" height="12" viewBox="${LOGO_NIGHT.viewBox}"><path d="${LOGO_NIGHT.d}" fill="#fff1d6" filter="url(#fa-neon)"/></svg>`);
  } else {
    out.push(`<rect x="${sx}" y="${sy}" width="76" height="18" rx="3" fill="#fbf4e4" stroke="#1f3a5f" stroke-width="1.6"/>`);
    out.push(`<svg x="${sx + 6}" y="${sy + 3.5}" width="64" height="11" viewBox="${LOGO_DAY.viewBox}"><path d="${LOGO_DAY.d}" fill="#c93a22"/></svg>`);
  }

  // 外階段（右側）
  const sx1 = BX + bw + 4, sx2 = W - 18;
  for (let f = 1; f < floors; f++) {
    const yLow = bottomOf(f), yHigh = bottomOf(f + 1);
    const steps = [];
    for (let k = 1; k <= 7; k++) {
      const t = k / 8;
      const px = sx2 - (sx2 - sx1 - 6) * t, py = yLow - (yLow - yHigh) * t;
      steps.push(`M${r1(px - 5)} ${r1(py)}h10`);
    }
    out.push(`<path d="M${sx2} ${yLow}L${sx1 + 6} ${yHigh}M${sx2} ${yLow - 11}L${sx1 + 6} ${yHigh - 11}${steps.join('')}" stroke="${P.slab}" stroke-width="1.6" fill="none"/>`);
    out.push(`<rect x="${BX + bw}" y="${yHigh - 3}" width="${sx2 - BX - bw + 4}" height="3" fill="${P.slab}"/>`);
  }
  // 自転車（階段の下）
  const gx = sx2 - 30, gy = ground - 6;
  out.push(`<g fill="none" stroke="${P.ink}" stroke-width="1.2" opacity="0.75"><circle cx="${gx}" cy="${gy}" r="5"/><circle cx="${gx + 18}" cy="${gy}" r="5"/><path d="M${gx} ${gy}l6-8h8l4 8M${gx + 6} ${gy - 8}l3 8h4M${gx + 4} ${gy - 11}h4M${gx + 14} ${gy - 8}l-1-3h3"/></g>`);

  // 部屋（ドア・窓・番号）
  let i = 0;
  for (let f = floors; f >= 1; f--) {
    const yb = bottomOf(f), yt = yb - FH;
    for (let k = 1; k <= ROOMS_PER_FLOOR; k++) {
      const no = f * 100 + k;
      const r = byNo.get(no);
      const x = BX + (k - 1) * UW;
      const g = [];
      // ドアと番号
      g.push(`<rect x="${x + 7}" y="${yb - 30}" width="15" height="27" rx="1.5" fill="${P.door}" stroke="${P.ink}" stroke-width="1"/><circle cx="${x + 19}" cy="${yb - 16}" r="1.2" fill="${P.ink}"/>`);
      g.push(`<text x="${x + 14.5}" y="${yb - 33}" text-anchor="middle" font-size="6.5" font-weight="800" fill="${P.ink}" opacity="0.7">${no}</text>`);
      // 窓
      const wx = x + 28, wy = yt + 9, ww = 32, wh = 21;
      if (r) {
        const c = P.cat[r.category] || P.cat.other;
        if (P.night) {
          const lit = mix(P.glow, c, 0.72);
          g.push(`<rect class="fa-glow" x="${wx - 4}" y="${wy - 4}" width="${ww + 8}" height="${wh + 8}" rx="6" fill="${lit}" opacity="0.28"/>`);
          g.push(`<rect class="fa-pane" x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${lit}" stroke="${P.ink}" stroke-width="1.4"/>`);
        } else {
          const curtain = mix(c, P.wall, 0.6);
          g.push(`<rect class="fa-pane" x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${curtain}" stroke="${P.ink}" stroke-width="1.4"/>`);
          g.push(`<path d="M${wx + 5} ${wy + 1}v${wh - 2}M${wx + 11} ${wy + 1}v${wh - 2}M${wx + ww - 5} ${wy + 1}v${wh - 2}M${wx + ww - 11} ${wy + 1}v${wh - 2}" stroke="#fff" stroke-width="1" opacity="0.35"/>`);
        }
        // 状態：様子見はブラインド半分、退去予定はテープ、内見中はリボン、値上げは↑
        if (r.status === 'review') g.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${wh / 2}" fill="${P.slab}" opacity="0.85"/><path d="M${wx} ${wy + 3.5}h${ww}M${wx} ${wy + 7}h${ww}" stroke="${P.wall}" stroke-width="0.8" opacity="0.6"/>`);
        if (r.status === 'cancel') g.push(`<path d="M${wx - 2} ${wy + 2}L${wx + ww + 2} ${wy + wh - 2}M${wx - 2} ${wy + wh - 2}L${wx + ww + 2} ${wy + 2}" stroke="${P.warn}" stroke-width="3" opacity="0.9"/>`);
        if (r.trial) g.push(`<path d="M${wx} ${wy}h9l-9 9z" fill="${P.warn}"/>`);
        if (r.raise) g.push(`<circle cx="${wx + ww}" cy="${wy}" r="5" fill="${P.accent}"/><path d="M${wx + ww} ${wy + 2.5}v-5M${wx + ww - 2.2} ${wy - 0.3}l2.2-2.2 2.2 2.2" stroke="#fff" stroke-width="1.2" fill="none"/>`);
      } else {
        g.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${P.glass}" stroke="${P.ink}" stroke-width="1.4"/>`);
      }
      g.push(`<path d="M${wx + ww / 2} ${wy}v${wh}" stroke="${P.ink}" stroke-width="1"/>`);
      const label = r ? `${no}号室 ${r.name}` : `${no}号室 空き部屋`;
      out.push(`<g class="fa-room${r ? '' : ' vacant'}" data-id="${r ? esc(r.id) : ''}" style="--i:${i++}" role="button" tabindex="0" aria-label="${esc(label)}"><title>${esc(label)}</title><rect x="${x}" y="${yt}" width="${UW}" height="${FH}" fill="transparent"/>${g.join('')}</g>`);
    }
    // 2階より上は外廊下の手すり（ドアの前）
    if (f >= 2) {
      const ry = yb - 12;
      const bal = [];
      for (let x = BX + 2; x < BX + bw; x += 6) bal.push(`M${x} ${ry}v9`);
      out.push(`<path d="M${BX - 4} ${ry}h${bw + 8}${bal.join('')}" stroke="${P.slab}" stroke-width="1.3" fill="none" pointer-events="none"/>`);
    }
    out.push(`<rect x="${BX - 4}" y="${yb - 3}" width="${bw + 8}" height="3" fill="${P.slab}" pointer-events="none"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="${FONT}" role="group" aria-label="サブスク荘の外観（窓を押すとその部屋）">${out.join('')}</svg>`;
}
