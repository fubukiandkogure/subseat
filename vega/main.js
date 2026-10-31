// VEGA 本体：three.js のホログラム、操作、モード、画面まわり
(() => {
'use strict';

const { Sound, Music, Voice } = window.VegaAudio;
const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeBack = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
const hex = (len) => Array.from({ length: len }, () => '0123456789ABCDEF'[Math.random() * 16 | 0]).join('');
const pad = (n) => String(n).padStart(2, '0');
const root = document.documentElement, body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* 振動なし */ } };
const later = (fn, ms) => setTimeout(fn, ms);

/* ── せりふ ─────────────────────────── */
const LINES = {
  hint: 'コアを長押しでエネルギーをチャージ。ドラッグでホログラムを回せます。画面のどこかをタップすると、撃ちます。',
  talk: [
    'お呼びですか、ボス。',
    '全システム正常。いつでもいけます。',
    'コア出力、安定しています。今日も絶好調です。',
    '周辺に異常なし。…少し退屈ですね。',
    '計算完了。成功確率は97.3パーセントです。',
    '衛星リンク確立。世界中のデータが、ボスの指先にあります。',
    'ボスの心拍数が上がっています。わくわくしていますね？',
    '出撃準備はできています。行き先だけ教えてください。',
    'コアを長押ししてみてください。きっと気に入りますよ。',
    '演算速度、毎秒4京回。ボスの宿題なら一瞬です。…冗談です。',
    'TRANSFORM を押してみてください。私の本気をお見せします。',
    '私はいつでもここにいます、ボス。',
  ],
  rapid: 'ボス、そんなに連打しなくても聞こえています。',
  spin: ['回転数、限界に接近中！ …楽しそうですね、ボス。', 'ボス、私まで目が回りそうです。'],
  blast: [
    '出力全開。…派手にいきましたね、ボス。',
    '衝撃波、半径2キロに到達。ご近所には私から謝っておきます。',
    '臨界突破。今のは最高の一撃でした。',
    'エネルギー放出完了。もう一発いきますか？',
  ],
  scanStart: '周辺スキャンを開始します。',
  odStart: 'リミッター解除。出力、300パーセント！',
  odEnd: 'オーバードライブ終了。冷却を開始します。…熱かったですね。',
  defWarn: '警告！ 敵性ドローン、多数接近中！',
  defGo: '迎撃開始。ボス、敵をタップして撃ち落としてください！',
  defHit: ['シールドに被弾！', '被弾しました。まだ持ちます！'],
  formOn: '戦闘形態へ移行。全リング、展開します。',
  formOff: '通常形態に戻ります。',
  globeOn: '地球ホログラムを展開。現在地、東京。',
  globeOff: 'ホログラムを収納します。',
  sleep: 'スリープモードに移行します。おやすみなさい、ボス。',
};
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'おはようございます、ボス。VEGA、全システム起動しました。';
  if (h >= 11 && h < 17) return 'おかえりなさい、ボス。VEGA、全システム起動しました。';
  if (h >= 17 && h < 23) return 'こんばんは、ボス。VEGA、全システム起動しました。';
  return 'こんな時間までお疲れさまです、ボス。VEGA、起動しました。';
}
const BOOT = [
  'VEGA BIOS v8.00 ─ VEGA LABS',
  'CPU    QUANTUM CORE x256 ......... OK',
  'MEM    4.80 PB ................... OK',
  'HOLO PROJECTOR ................... CALIBRATED',
  'NEURAL MATRIX .................... SYNC',
  'SAT LINK   12/12 ................. LOCK',
  'DEFENSE GRID ..................... ARMED',
  'VOICE  ja-JP ..................... OK',
  'ENERGY CORE IGNITION ............. ████████',
  '>>> ALL SYSTEMS GO',
];

/* ── DOM ─────────────────────────── */
const stageEl = $('#stage'), ui = $('#ui2d'), ux = ui.getContext('2d');
const hudEl = $('#hud'), topEl = $('.topwrap'), deckEl = $('.deck');
const sayEl = $('#say'), voiceBar = $('#voiceBar'), bannerEl = $('#banner'), bootEl = $('#bootlog');
const wakeBtn = $('#wake'), statusText = $('#statusText'), missionEl = $('#mission');

/* ── 文字の演出 ──────────────────── */
const GLYPHS = 'ABCDEF0123456789#$%&*+=<>/|';
function decodeText(el, text, dur = 520) {
  const start = performance.now(), chars = Array.from(text);
  clearInterval(el._dec);
  el._dec = setInterval(() => {
    const p = (performance.now() - start) / dur;
    let s = '';
    for (let i = 0; i < chars.length; i++) s += (chars[i] === ' ' || i < p * chars.length) ? chars[i] : GLYPHS[Math.random() * GLYPHS.length | 0];
    el.textContent = s;
    if (p >= 1) { clearInterval(el._dec); el.textContent = text; }
  }, 32);
}
let typeTimer = 0, talkUntil = 0;
function say(text, withVoice = true) {
  clearInterval(typeTimer);
  const chars = Array.from(text);
  let i = 0;
  sayEl.textContent = '';
  typeTimer = setInterval(() => {
    sayEl.textContent += chars[i++];
    if (i % 2 === 0) Sound.type();
    if (i >= chars.length) clearInterval(typeTimer);
  }, 34);
  talkUntil = performance.now() + chars.length * 95 + 400;
  if (withVoice) Voice.speak(text, () => { talkUntil = performance.now() + 60000; }, () => { talkUntil = performance.now() + 120; });
}
let bannerTimer = 0;
function banner(main, sub, cls = '') {
  decodeText(bannerEl.querySelector('b'), main, 420);
  bannerEl.querySelector('small').textContent = sub || '';
  bannerEl.className = '';
  void bannerEl.offsetWidth;
  bannerEl.className = 'on ' + cls;
  Sound.glitch();
  clearTimeout(bannerTimer);
  bannerTimer = later(() => { bannerEl.className = ''; }, 2500);
}

/* ── 状態 ─────────────────────────── */
const S = {
  phase: 'loading',          // loading | standby | booting | awake | sleeping
  standby: 1, table: 0, reveal: 0, revealGoal: 0, dolly: 0.85,
  energy: 0, talk: 0, power: 0.97, charge: 0, charging: false,
  mode: 'normal', modeEnd: 0,  // normal | overdrive | alert | defense
  form: 0, formGoal: 0, globe: 0, globeGoal: 0,
  shake: 0, kick: 0, flash: 0, aberr: 0, glitch: 0, freeze: 0, collapse: 0, bloomBoost: 0, bolts: 0,
  shock: { x: 0.5, y: 0.5, r: 0, amp: 0 },
  shield: 1, shieldFlash: 0,
  scan: null, touched: false, ringTime: 0, lastInput: 0,
  rainbow: 0, timeScale: 1, slowGoal: 1, dim: 0, dimGoal: 0, zoomFx: 0, zoomGoal: 0, swarmT: 0, swarmDir: 1,
  tableOn: false, assembling: false, asmStart: 0,
  lineAt: { spin: 0, blast: 0 },
};
let T = 0;

/* ── フォントを待ってから組み立てる（文字入りのテクスチャがあるため） ── */
const fontsReady = Promise.race([
  document.fonts ? Promise.all([
    document.fonts.load('20px "Share Tech Mono"', 'A0'),
    document.fonts.load('700 20px "Chakra Petch"', 'A'),
    document.fonts.load('500 20px "Chakra Petch"', 'A'),
    document.fonts.load('300 20px "M PLUS 1 Code"', 'あア'),
  ]) : Promise.resolve(),
  new Promise((r) => setTimeout(r, 2500)),
]).catch(() => {});

fontsReady.then(build);

function build() {
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
} catch (_) { renderer = null; }
if (!renderer || !window.THREE || !THREE.EffectComposer) {
  body.classList.add('no-gl');
  return;
}

const MAX_PR = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2);
let PR = MAX_PR;
renderer.setPixelRatio(PR);
renderer.setClearColor(0x01060b, 1);
renderer.domElement.id = 'gl';
stageEl.prepend(renderer.domElement);

const FOV = 40;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x01060b, 20, 60);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);

/* ── 色：通常はシアン、全出力はアンバー、警戒は赤 ── */
const PAL = {
  cyan: new THREE.Color('#5cecff'), amber: new THREE.Color('#ffa63c'), red: new THREE.Color('#ff3349'),
  gold: new THREE.Color('#ffd34d'), green: new THREE.Color('#4dff9a'),
};
const ENEMY = new THREE.Color('#ff2f4f');
const WHITE = new THREE.Color(1, 1, 1);
const accent = PAL.cyan.clone();
let accentGoal = PAL.cyan;
const tintList = [];
function tinted(mat, k = 1) { tintList.push([mat, k]); mat.color.copy(accent).multiplyScalar(k); return mat; }
let accRGB = '92,236,255';
function modeColor() { return S.mode === 'overdrive' ? PAL.amber : S.mode === 'alert' ? PAL.red : PAL.cyan; }
function applyTint() {
  for (const [m, k] of tintList) m.color.copy(accent).multiplyScalar(k);
  accRGB = `${Math.round(accent.r * 255)},${Math.round(accent.g * 255)},${Math.round(accent.b * 255)}`;
  root.style.setProperty('--acc', accRGB.replace(/,/g, ' '));
}
function updateTint(dt, real) {
  // 大当たり中は虹色に回す
  if (S.rainbow > 0) {
    S.rainbow -= real;
    accent.setHSL((performance.now() / 1000 * 0.45) % 1, 1, 0.6);
    applyTint();
    if (S.rainbow <= 0) accentGoal = modeColor();
    return;
  }
  const d = Math.abs(accent.r - accentGoal.r) + Math.abs(accent.g - accentGoal.g) + Math.abs(accent.b - accentGoal.b);
  if (d === 0) return;
  if (d < 0.004) accent.copy(accentGoal); else accent.lerp(accentGoal, Math.min(1, real * 4));
  applyTint();
}
const ACC = (a) => `rgba(${accRGB},${a})`;
const INK = (a) => `rgba(223,252,255,${a})`;
const DIM = (a) => `rgba(120,160,172,${a})`;

/* ── テクスチャ ─────────────────── */
const ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texFrom(w, h, draw) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = ANISO;
  return t;
}
const TEX = {
  dot: texFrom(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }),
  glow: texFrom(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }),
  streak: texFrom(512, 64, (g, w, h) => {
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(255,255,255,0)'); gy.addColorStop(0.5, 'rgba(255,255,255,1)'); gy.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gy; g.fillRect(0, 0, w, h);
  }),
  ray: texFrom(32, 256, (g, w, h) => {
    const gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(255,255,255,0)'); gy.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gy; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx; g.fillRect(0, 0, w, h);
  }),
  hexgrid: texFrom(256, 222, (g, w, h) => {
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
    const r = 37, hh = r * Math.sqrt(3) / 2;
    for (let row = -1; row < 4; row++) for (let col = -1; col < 5; col++) {
      const cx = col * r * 1.5, cy = row * hh * 2 + (col % 2 ? hh : 0);
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU; k ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.stroke();
    }
  }),
};
TEX.hexgrid.wrapS = TEX.hexgrid.wrapT = THREE.RepeatWrapping;

// リングの絵：白で描いて、色はシェーダーで付ける
const RS = 1024;
const circle = (g, r) => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
const spoke = (g, a, r0, r1) => { g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); };
const tri = (g, a, r, s, out = true) => {
  g.save(); g.rotate(a); g.beginPath();
  if (out) { g.moveTo(r, 0); g.lineTo(r - s * 1.4, -s); g.lineTo(r - s * 1.4, s); } else { g.moveTo(r - s * 1.4, 0); g.lineTo(r, -s); g.lineTo(r, s); }
  g.closePath(); g.fill(); g.restore();
};
function textArc(g, text, r, size, alpha, center = -Math.PI / 2) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${Math.round(size)}px "Share Tech Mono", monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = size * 0.74 / r, chars = Array.from(text);
  let a = center - step * (chars.length - 1) / 2;
  for (const ch of chars) { g.save(); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, -r); g.restore(); a += step; }
  g.restore();
}
const hash = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
function ringTex(draw) {
  return texFrom(RS, RS, (g, s) => {
    g.translate(s / 2, s / 2);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    draw(g, s / 2, s / 1024);
  });
}
const RT = {
  outer: ringTex((g, R, k) => {
    g.lineWidth = 1.5 * k; g.globalAlpha = 0.35; circle(g, R * 0.99); circle(g, R * 0.93);
    for (let i = 0; i < 72; i++) {
      const big = i % 6 === 0;
      g.globalAlpha = big ? 0.9 : 0.4; g.lineWidth = (big ? 3 : 1.5) * k;
      spoke(g, i / 72 * TAU, R * 0.93, R * (big ? 0.99 : 0.96));
    }
    g.globalAlpha = 0.95; g.lineWidth = 7 * k;
    for (let i = 0; i < 4; i++) { const c = i * TAU / 4 + TAU / 8; g.beginPath(); g.arc(0, 0, R * 0.9, c - 0.13, c + 0.13); g.stroke(); }
    textArc(g, 'HOLOGRAPHIC INTERFACE  //  VEGA LABS', R * 0.885, 17 * k, 0.6);
  }),
  ticks: ringTex((g, R, k) => {
    g.globalAlpha = 0.9; g.lineWidth = 2.5 * k; circle(g, R * 0.985);
    for (let i = 0; i < 240; i++) {
      const len = i % 20 === 0 ? 0.075 : i % 5 === 0 ? 0.04 : 0.022;
      g.globalAlpha = i % 5 === 0 ? 0.95 : 0.5; g.lineWidth = (i % 20 === 0 ? 3 : 1.6) * k;
      spoke(g, i / 240 * TAU, R * 0.965, R * (0.965 - len));
    }
    g.globalAlpha = 0.85; g.font = `${Math.round(24 * k)}px "Share Tech Mono", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * TAU); g.fillText(String(i * 30).padStart(3, '0'), 0, -R * 0.845); g.restore(); }
  }),
  arcs: ringTex((g, R, k) => {
    for (let j = 0; j < 3; j++) {
      const a0 = j * TAU / 3 + 0.15, a1 = a0 + TAU / 3 * 0.66;
      g.globalAlpha = 0.95; g.lineWidth = R * 0.07;
      g.beginPath(); g.arc(0, 0, R * 0.9, a0, a1); g.stroke();
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = 3.5 * k;
      for (let a = a0 + 0.06; a < a1 - 0.03; a += 0.085) spoke(g, a, R * 0.86, R * 0.94);
      g.globalCompositeOperation = 'source-over';
      g.lineWidth = 3 * k;
      spoke(g, a0, R * 0.83, R * 0.975); spoke(g, a1, R * 0.83, R * 0.975);
    }
    g.globalAlpha = 0.5; g.lineWidth = 1.5 * k; circle(g, R * 0.815);
    textArc(g, 'VEGA CORE ─ NEURAL LINK ESTABLISHED ─ SYS 8.00', R * 0.775, 18 * k, 0.75);
    textArc(g, 'ENERGY OUTPUT NOMINAL ─ SAT 12/12', R * 0.775, 18 * k, 0.55, Math.PI / 2 + Math.PI);
  }),
  blocks: ringTex((g, R, k) => {
    const n = 72;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, w = TAU / n * 0.6;
      g.globalAlpha = 0.18 + 0.82 * (hash(i) > 0.45 ? 1 : 0.25);
      g.beginPath(); g.arc(0, 0, R * 0.98, a, a + w); g.arc(0, 0, R * 0.88, a + w, a, true); g.closePath(); g.fill();
    }
    g.globalAlpha = 0.6; g.lineWidth = 1.5 * k; circle(g, R * 0.85);
    g.globalAlpha = 1;
    for (let i = 0; i < 4; i++) tri(g, i * TAU / 4 + TAU / 8, R * 0.84, 14 * k, false);
  }),
  dash: ringTex((g, R, k) => {
    g.globalAlpha = 0.9; g.lineWidth = 4 * k; g.setLineDash([10 * k, 14 * k]); circle(g, R * 0.95); g.setLineDash([]);
    g.globalAlpha = 0.45; g.lineWidth = 1.5 * k; circle(g, R * 0.9);
    g.globalAlpha = 0.95;
    for (let i = 0; i < 8; i++) tri(g, i * TAU / 8, R * 0.885, 10 * k);
    g.globalAlpha = 0.5; g.lineWidth = 1.5 * k;
    for (let i = 0; i < 48; i++) spoke(g, i / 48 * TAU, R * 0.86, R * 0.835);
  }),
  coil: ringTex((g, R, k) => {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, w = TAU / n * 0.72;
      g.beginPath(); g.arc(0, 0, R * 0.97, a, a + w); g.arc(0, 0, R * 0.74, a + w * 0.9, a + w * 0.1, true); g.closePath();
      g.globalAlpha = 0.16; g.fill();
      g.globalAlpha = 0.95; g.lineWidth = 2.5 * k; g.stroke();
      g.globalAlpha = 0.7; g.lineWidth = 1.5 * k; g.beginPath(); g.arc(0, 0, R * 0.86, a + w * 0.2, a + w * 0.8); g.stroke();
    }
    g.globalAlpha = 0.8; g.lineWidth = 3 * k; circle(g, R * 0.68);
  }),
  lens: ringTex((g, R, k) => {
    g.lineWidth = 1.2 * k;
    for (let i = 0; i < 36; i++) { g.globalAlpha = i % 3 === 0 ? 0.5 : 0.18; spoke(g, i / 36 * TAU, R * 0.38, R * 0.98); }
    for (const f of [0.45, 0.6, 0.75, 0.9]) { g.globalAlpha = 0.32; circle(g, R * f); }
    g.globalAlpha = 0.9; g.lineWidth = 2 * k; g.setLineDash([3 * k, 6 * k]); circle(g, R * 0.98); g.setLineDash([]);
  }),
  table: ringTex((g, R, k) => {
    g.lineWidth = 2 * k;
    for (const [f, a] of [[0.99, 0.8], [0.92, 0.35], [0.7, 0.5], [0.5, 0.3], [0.3, 0.6], [0.16, 0.9]]) { g.globalAlpha = a; circle(g, R * f); }
    for (let i = 0; i < 120; i++) { g.globalAlpha = i % 10 === 0 ? 0.9 : 0.35; g.lineWidth = (i % 10 === 0 ? 3 : 1.5) * k; spoke(g, i / 120 * TAU, R * 0.92, R * (i % 10 === 0 ? 0.99 : 0.96)); }
    for (let i = 0; i < 24; i++) { g.globalAlpha = 0.14; g.lineWidth = 1.5 * k; spoke(g, i / 24 * TAU, R * 0.3, R * 0.92); }
    g.globalAlpha = 0.9; g.lineWidth = 8 * k;
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; g.beginPath(); g.arc(0, 0, R * 0.7, a, a + 0.9); g.stroke(); }
    textArc(g, 'VEGA HOLO PROJECTOR  //  EMITTER ARRAY 07', R * 0.81, 20 * k, 0.6);
  }),
};

/* ── 共通シェーダー ────────────────── */
const VS_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const VS_FRES = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS_RING = `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity, uReveal, uSweep, uSweepAmp, uBoost;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float ang = atan(p.y, p.x);
  float a01 = fract(0.25 - ang / 6.2831853);
  if (a01 > uReveal) discard;
  vec4 t = texture2D(uMap, vUv);
  float d = abs(fract((ang - uSweep) / 6.2831853 + 0.5) - 0.5);
  float sw = smoothstep(0.16, 0.0, d) * uSweepAmp;
  float edge = smoothstep(0.025, 0.0, uReveal - a01) * step(uReveal, 0.999);
  float a = t.a * uOpacity * (1.0 + sw * 1.4 + uBoost + edge * 3.0);
  vec3 col = mix(uColor, vec3(1.0), clamp(sw * 0.35 + uBoost * 0.25 + edge, 0.0, 0.85));
  gl_FragColor = vec4(col, a);
}`;
const NOISE = `vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;
const U_SCALE = { value: 600 };   // 点の大きさを画面の高さに合わせる係数
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const basicAdd = (o = {}) => new THREE.MeshBasicMaterial(Object.assign({ fog: false }, ADD, o));
const lineAdd = (o = {}) => new THREE.LineBasicMaterial(Object.assign({ fog: false }, ADD, o));

/* ── ホログラム本体 ─────────────────── */
const holo = new THREE.Group();
scene.add(holo);

const RINGS = [
  { tex: RT.outer, r: 2.75, z: -0.55, spin: 0.03, op: 0.55, sweep: 0.6, battle: [1.25, 0.35] },
  { tex: RT.ticks, r: 2.35, z: -0.3, spin: -0.06, op: 0.85, sweep: 0.8, battle: [0.05, 1.3] },
  { tex: RT.arcs, r: 2.08, z: -0.05, spin: 0.22, op: 0.95, sweep: 1.0, battle: [1.57, 0.0] },
  { tex: RT.blocks, r: 1.82, z: 0.12, spin: -0.12, op: 0.8, sweep: 1.2, battle: [0.65, -0.95] },
  { tex: RT.dash, r: 1.6, z: 0.28, spin: 0.45, op: 0.75, sweep: 0.8, battle: [-0.9, 0.55] },
  { tex: RT.coil, r: 1.28, z: 0.42, spin: -0.18, op: 0.85, sweep: 1.0, battle: [0.35, 0.3] },
  { tex: RT.lens, r: 1.02, z: 0.55, spin: 0.08, op: 0.5, sweep: 0.5, battle: [0, 0] },
];
const rings = RINGS.map((d) => {
  const mat = new THREE.ShaderMaterial(Object.assign({
    uniforms: {
      uMap: { value: d.tex }, uColor: { value: accent }, uOpacity: { value: d.op }, uReveal: { value: 0 },
      uSweep: { value: rand(0, TAU) }, uSweepAmp: { value: d.sweep }, uBoost: { value: 0 },
    },
    vertexShader: VS_UV, fragmentShader: FS_RING, side: THREE.DoubleSide,
  }, ADD));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(d.r * 2, d.r * 2), mat);
  const pivot = new THREE.Group();
  pivot.add(mesh);
  holo.add(pivot);
  return Object.assign({}, d, {
    mat, mesh, pivot, angle: rand(0, TAU), shown: false, locked: 0,
    qBattle: new THREE.Quaternion().setFromEuler(new THREE.Euler(d.battle[0], d.battle[1], 0)),
    axis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
  });
});
const Q0 = new THREE.Quaternion();

// プラズマの玉
const orbMat = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uTime: { value: 0 }, uAmp: { value: 0.06 }, uColor: { value: accent }, uIntensity: { value: 1 } },
  vertexShader: NOISE + `
    uniform float uTime, uAmp; varying vec3 vN; varying vec3 vV; varying float vNoise;
    void main(){
      float n = snoise(normal * 1.6 + vec3(uTime * 0.35)) * 0.6 + snoise(normal * 3.5 - uTime * 0.6) * 0.4;
      vNoise = n;
      vec3 p = position + normal * n * uAmp;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV; varying float vNoise;
    void main(){
      float facing = max(dot(vN, vV), 0.0);
      float fres = pow(1.0 - facing, 2.2);
      float bands = 0.5 + 0.5 * sin(vNoise * 10.0);
      vec3 col = uColor * (fres * 1.6 + bands * 0.4) + vec3(1.0) * pow(facing, 3.0) * 0.55;
      float a = clamp(fres * 1.2 + pow(facing, 3.0) * 0.5 + bands * 0.18, 0.0, 1.0);
      gl_FragColor = vec4(col * uIntensity, a);
    }`,
}, ADD));
const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, coarse ? 4 : 5), orbMat);
holo.add(orb);
const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), basicAdd({ color: 0xffffff }));
holo.add(heart);

const shellMat = tinted(lineAdd({ opacity: 0.45 }));
const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.95, 1)), shellMat);
const shell2Mat = tinted(lineAdd({ opacity: 0.22 }));
const shell2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.32, 0)), shell2Mat);
const nodeMat = new THREE.PointsMaterial(Object.assign({ size: 0.07, map: TEX.dot, color: 0xffffff, fog: false }, ADD));
const nodes = new THREE.Points(new THREE.IcosahedronGeometry(0.95, 1), nodeMat);
shell.add(nodes);
holo.add(shell, shell2);

const gyros = [0, 1, 2].map((i) => {
  const m = tinted(basicAdd({ opacity: 0.6 }));
  const torus = new THREE.Mesh(new THREE.TorusGeometry(1.12 + i * 0.12, 0.007, 4, 160), m);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), basicAdd({ color: 0xffffff }));
  bead.position.x = 1.12 + i * 0.12;
  torus.add(bead);
  const g = new THREE.Group();
  g.add(torus);
  g.rotation.set(rand(0, TAU), rand(0, TAU), 0);
  holo.add(g);
  return { g, torus, m, axis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), sp: rand(0.5, 1.1) };
});

// 円盤状に回る粒
const ORB_N = coarse ? 900 : 1700;
const orbitGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(ORB_N * 3), aR = new Float32Array(ORB_N), aA = new Float32Array(ORB_N), aSp = new Float32Array(ORB_N), aS = new Float32Array(ORB_N), aB = new Float32Array(ORB_N);
  for (let i = 0; i < ORB_N; i++) {
    const r = 1.3 + Math.pow(Math.random(), 1.6) * 1.75;
    aR[i] = r; aA[i] = rand(0, TAU); aSp[i] = (0.5 / Math.sqrt(r)) * (Math.random() < 0.1 ? -1 : 1);
    pos[i * 3 + 2] = rand(-0.05, 0.05);
    aS[i] = rand(0.012, 0.035); aB[i] = Math.random() < 0.08 ? 1 : rand(0.2, 0.6);
  }
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  orbitGeo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
  orbitGeo.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
  orbitGeo.setAttribute('aSp', new THREE.BufferAttribute(aSp, 1));
  orbitGeo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  orbitGeo.setAttribute('aB', new THREE.BufferAttribute(aB, 1));
}
const orbitMat = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uTime: { value: 0 }, uScale: U_SCALE, uColor: { value: accent }, uOpacity: { value: 0 } },
  vertexShader: `uniform float uTime, uScale; attribute float aR, aA, aSp, aS, aB; varying float vB;
    void main(){ float a = aA + uTime * aSp; vec3 p = vec3(cos(a) * aR, sin(a) * aR, position.z);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = aS * uScale / -mv.z; vB = aB; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vB;
    void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vB * uOpacity;
      gl_FragColor = vec4(mix(uColor, vec3(1.0), vB * 0.35), a); }`,
}, ADD));
const orbit = new THREE.Points(orbitGeo, orbitMat);
orbit.frustumCulled = false;
holo.add(orbit);

// 放射状の光
const rays = new THREE.Group();
const rayMats = [];
for (let i = 0; i < 18; i++) {
  const m = tinted(basicAdd({ map: TEX.ray, opacity: 0.06, side: THREE.DoubleSide }));
  const geo = new THREE.PlaneGeometry(0.1, 5.5);
  geo.translate(0, 2.75, 0);
  const mesh = new THREE.Mesh(geo, m);
  mesh.rotation.z = i / 18 * TAU + rand(-0.1, 0.1);
  mesh.scale.y = rand(0.55, 1.15);
  rays.add(mesh);
  rayMats.push(m);
}
rays.position.z = -0.2;
holo.add(rays);

// 戦闘形態で外に出る武装
const spikes = new THREE.Group();
const spikeMat = tinted(lineAdd({ opacity: 0.9 }));
const spikeGeo = new THREE.EdgesGeometry(new THREE.ConeGeometry(0.12, 0.7, 4));
for (let i = 0; i < 8; i++) {
  const a = i / 8 * TAU + TAU / 16;
  const s = new THREE.LineSegments(spikeGeo, spikeMat);
  s.position.set(Math.cos(a) * 3.05, Math.sin(a) * 3.05, 0);
  s.rotation.z = a - Math.PI / 2;
  spikes.add(s);
}
spikes.scale.setScalar(0.001);
holo.add(spikes);

// 稲妻
const NB = 12, NSEG = 10;
const boltPos = new Float32Array(NB * NSEG * 6);
const boltGeo = new THREE.BufferGeometry();
boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3).setUsage(THREE.DynamicDrawUsage));
const boltMat = lineAdd({ color: 0xffffff, opacity: 0 });
const bolts = new THREE.LineSegments(boltGeo, boltMat);
bolts.frustumCulled = false;
holo.add(bolts);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
function randDir(v) { const u = rand(-1, 1), a = rand(0, TAU), s = Math.sqrt(1 - u * u); return v.set(s * Math.cos(a), s * Math.sin(a), u); }
function regenBolts(reach) {
  let k = 0;
  for (let b = 0; b < NB; b++) {
    randDir(tmpA);
    const len = rand(0.9, reach);
    tmpB.copy(tmpA).multiplyScalar(0.58);
    tmpC.copy(tmpA).multiplyScalar(0.58 + len);
    let px = tmpB.x, py = tmpB.y, pz = tmpB.z;
    for (let s = 1; s <= NSEG; s++) {
      const t = s / NSEG, j = Math.sin(t * Math.PI) * 0.28;
      const qx = lerp(tmpB.x, tmpC.x, t) + rand(-j, j), qy = lerp(tmpB.y, tmpC.y, t) + rand(-j, j), qz = lerp(tmpB.z, tmpC.z, t) + rand(-j, j);
      boltPos[k++] = px; boltPos[k++] = py; boltPos[k++] = pz;
      boltPos[k++] = qx; boltPos[k++] = qy; boltPos[k++] = qz;
      px = qx; py = qy; pz = qz;
    }
  }
  boltGeo.attributes.position.needsUpdate = true;
}

// 中心の光とアナモルフィックな横線
const flare = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: TEX.glow, depthTest: false, fog: false }, ADD)));
tinted(flare.material);
flare.scale.setScalar(3.4);
flare.renderOrder = 10;
const streak = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: TEX.streak, depthTest: false, fog: false }, ADD)));
tinted(streak.material);
streak.renderOrder = 11;
scene.add(flare, streak);

// スタンバイ中の輪
const standby = new THREE.Group();
const sbMat = tinted(basicAdd({ opacity: 0.5, side: THREE.DoubleSide }));
standby.add(new THREE.Mesh(new THREE.RingGeometry(1.25, 1.29, 128), sbMat));
const sbArcMat = tinted(basicAdd({ opacity: 0.9, side: THREE.DoubleSide }));
const sbArcs = new THREE.Group();
for (let i = 0; i < 4; i++) sbArcs.add(new THREE.Mesh(new THREE.RingGeometry(1.22, 1.32, 32, 1, i * TAU / 4, 0.3), sbArcMat));
standby.add(sbArcs);
const sbGhostMat = tinted(basicAdd({ opacity: 0.07, side: THREE.DoubleSide }));
for (const r of [2.75, 2.35, 2.08, 1.82, 1.6]) standby.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.012, r, 128), sbGhostMat));
scene.add(standby);

/* ── 投影台・床・背景 ──────────────── */
const table = new THREE.Group();
scene.add(table);
const plateMat = tinted(basicAdd({ map: RT.table, opacity: 0.5 }));
const plate = new THREE.Mesh(new THREE.CircleGeometry(1, 96), plateMat);
plate.rotation.x = -Math.PI / 2;
plate.scale.setScalar(4.3);
const emitterMat = tinted(basicAdd({ opacity: 0.9, side: THREE.DoubleSide }));
const emitter = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 64), emitterMat);
emitter.rotation.x = -Math.PI / 2;
emitter.position.y = 0.01;
const coneMat = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uColor: { value: accent }, uOpacity: { value: 0 } },
  vertexShader: VS_FRES,
  fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
    void main(){ float fres = pow(1.0 - abs(dot(vN, vV)), 2.0); float fade = pow(1.0 - vUv.y, 2.2);
      gl_FragColor = vec4(uColor, (0.03 + fres * 0.22) * fade * uOpacity); }`,
  side: THREE.DoubleSide,
}, ADD));
const cone = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 0.55, 1, 64, 1, true), coneMat);
table.add(plate, emitter, cone);

const grid = new THREE.GridHelper(70, 70, 0xffffff, 0xffffff);
grid.material.transparent = true;
grid.material.opacity = 0.09;
grid.material.depthWrite = false;
tintList.push([grid.material, 1]);
grid.material.color.copy(accent);
scene.add(grid);

const DUST_N = coarse ? 700 : 1400;
const dustGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(DUST_N * 3);
  for (let i = 0; i < DUST_N; i++) { p[i * 3] = rand(-24, 24); p[i * 3 + 1] = rand(-15, 15); p[i * 3 + 2] = rand(-45, 6); }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const dustMat = tinted(new THREE.PointsMaterial(Object.assign({ size: 0.07, map: TEX.dot, opacity: 0.55 }, ADD)), 0.8);
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);

const backMat = tinted(basicAdd({ map: TEX.hexgrid, opacity: 0.045 }));
TEX.hexgrid.repeat.set(16, 10);
const back = new THREE.Mesh(new THREE.PlaneGeometry(160, 100), backMat);
back.position.z = -38;
scene.add(back);

/* ── 地球（横の小さい地球と、GLOBE の大きい地球） ── */
const LAND = (() => {
  const b = atob(window.VEGA_LAND || '');
  const bits = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bits[i] = b.charCodeAt(i);
  const pts = [];
  for (let r = 0; r < 90; r++) {
    const lat = 90 - (r + 0.5) * 2, keep = Math.cos(lat * DEG) * 1.05;
    for (let c = 0; c < 180; c++) {
      const i = r * 180 + c;
      if (!(bits[i >> 3] & (1 << (i & 7))) || hash(i) > keep) continue;
      pts.push(...ll(lat + (hash(i + 7) - 0.5) * 1.2, -180 + (c + 0.5) * 2 + (hash(i + 13) - 0.5) * 1.2));
    }
  }
  return new Float32Array(pts);
})();
function ll(lat, lon, r = 1) {
  const la = lat * DEG, lo = lon * DEG;
  return [Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r];
}
const CITIES = [[35.68, 139.76], [40.71, -74.0], [51.5, -0.12], [-33.86, 151.2], [1.35, 103.82], [37.77, -122.42], [48.86, 2.35], [-23.55, -46.63], [55.75, 37.62], [19.43, -99.13], [25.2, 55.27], [-1.29, 36.82]];
const LINKS = [[0, 5], [0, 4], [2, 1], [6, 8], [4, 3], [1, 7], [2, 0], [9, 1], [10, 4], [10, 2], [11, 10], [0, 3]];

function makeEarth(big) {
  const grp = new THREE.Group(), inner = new THREE.Group();
  grp.add(inner);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(LAND, 3));
  const dotMat = new THREE.ShaderMaterial(Object.assign({
    uniforms: { uColor: { value: accent }, uOpacity: { value: 1 }, uScale: U_SCALE, uSize: { value: 0.03 } },
    vertexShader: `uniform float uScale, uSize; varying float vF;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vF = normalize(normalMatrix * normalize(position)).z;
        gl_PointSize = uSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vF;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * mix(0.1, 1.0, smoothstep(-0.15, 0.35, vF)) * uOpacity;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.2), a); }`,
  }, ADD));
  inner.add(new THREE.Points(dotGeo, dotMat));

  const gp = [];
  for (let la = -60; la <= 60; la += 30) for (let lo = 0; lo < 360; lo += 6) gp.push(...ll(la, lo), ...ll(la, lo + 6));
  for (let lo = 0; lo < 360; lo += 30) for (let la = -84; la < 84; la += 6) gp.push(...ll(la, lo), ...ll(la + 6, lo));
  const gratGeo = new THREE.BufferGeometry();
  gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const gratMat = tinted(lineAdd({ opacity: 0.1 }));
  inner.add(new THREE.LineSegments(gratGeo, gratMat));

  const atmMat = new THREE.ShaderMaterial(Object.assign({
    uniforms: { uColor: { value: accent }, uOpacity: { value: 1 } },
    vertexShader: VS_FRES,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); gl_FragColor = vec4(uColor, f * 0.85 * uOpacity); }`,
  }, ADD));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(1.07, 48, 32), atmMat));

  const ap = [], at = [], aph = [];
  LINKS.forEach(([i, j], n) => {
    const a = new THREE.Vector3(...ll(...CITIES[i])), b = new THREE.Vector3(...ll(...CITIES[j]));
    const om = Math.acos(clamp(a.dot(b), -1, 1)), so = Math.sin(om) || 1, seg = 40;
    let prev = null;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, s1 = Math.sin((1 - t) * om) / so, s2 = Math.sin(t * om) / so, lift = 1 + Math.sin(t * Math.PI) * 0.25;
      const p = [(a.x * s1 + b.x * s2) * lift, (a.y * s1 + b.y * s2) * lift, (a.z * s1 + b.z * s2) * lift];
      if (prev) { ap.push(...prev, ...p); at.push((k - 1) / seg, t); aph.push(n * 0.37, n * 0.37); }
      prev = p;
    }
  });
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  arcGeo.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
  arcGeo.setAttribute('aPh', new THREE.Float32BufferAttribute(aph, 1));
  const arcMat = new THREE.ShaderMaterial(Object.assign({
    uniforms: { uColor: { value: accent }, uOpacity: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `attribute float aT, aPh; varying float vT, vPh, vF;
      void main(){ vT = aT; vPh = aPh; vF = normalize(normalMatrix * normalize(position)).z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime; varying float vT, vPh, vF;
      void main(){ float head = fract(uTime * 0.4 + vPh); float d = head - vT;
        float pulse = (d >= 0.0 && d < 0.2) ? 1.0 - d / 0.2 : 0.0;
        float face = mix(0.12, 1.0, smoothstep(-0.25, 0.3, vF));
        gl_FragColor = vec4(mix(uColor, vec3(1.0), pulse * 0.6), (0.16 + pulse * 1.3) * face * uOpacity); }`,
  }, ADD));
  inner.add(new THREE.LineSegments(arcGeo, arcMat));

  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(CITIES.flatMap((c) => ll(c[0], c[1], 1.01)), 3));
  const cityMat = new THREE.PointsMaterial(Object.assign({ size: big ? 0.11 : 0.07, map: TEX.dot, color: 0xffffff, fog: false }, ADD));
  inner.add(new THREE.Points(cityGeo, cityMat));
  const tokyoMat = basicAdd({ color: 0xffffff, side: THREE.DoubleSide });
  const tokyo = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 32), tokyoMat);
  tokyo.position.set(...ll(35.68, 139.76, 1.015));
  tokyo.lookAt(tokyo.position.clone().multiplyScalar(2));
  inner.add(tokyo);

  const orbitMats = [], sats = [];
  for (let i = 0; i < (big ? 3 : 1); i++) {
    const m = tinted(lineAdd({ opacity: 0.3 }));
    const pts = [];
    for (let k = 0; k <= 128; k++) { const a = k / 128 * TAU; pts.push(Math.cos(a) * (1.35 + i * 0.12), 0, Math.sin(a) * (1.35 + i * 0.12)); }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(og, m);
    const pivot = new THREE.Group();
    pivot.rotation.set(rand(-0.6, 0.6), rand(0, TAU), rand(-0.5, 0.5));
    pivot.add(line);
    const sat = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: TEX.glow, color: 0xffffff, fog: false }, ADD)));
    sat.scale.setScalar(0.16);
    pivot.add(sat);
    grp.add(pivot);
    orbitMats.push(m);
    sats.push({ sat, r: 1.35 + i * 0.12, sp: rand(0.5, 0.9), a: rand(0, TAU) });
  }
  const mats = [dotMat, gratMat, atmMat, arcMat, cityMat, tokyoMat, ...orbitMats, ...sats.map((s) => s.sat.material)];
  const base = mats.map((m) => (m.uniforms ? m.uniforms.uOpacity.value : m.opacity));
  let cur = 1;
  return {
    grp, inner, dotMat,
    setScale(s) { grp.scale.setScalar(s); dotMat.uniforms.uSize.value = (big ? 0.028 : 0.04) * s; },
    setOpacity(o) {
      cur = o;
      mats.forEach((m, i) => { if (m.uniforms) m.uniforms.uOpacity.value = base[i] * o; else m.opacity = base[i] * o; });
      grp.visible = o > 0.003;
    },
    update(dt) {
      arcMat.uniforms.uTime.value = T;
      inner.rotation.y += dt * (big ? 0.12 : 0.25) * (S.mode === 'overdrive' ? 3 : 1);
      for (const s of sats) { s.a += dt * s.sp; s.sat.position.set(Math.cos(s.a) * s.r, 0, Math.sin(s.a) * s.r); }
      const pulse = (T * 0.9) % 1;
      tokyo.scale.setScalar(1 + pulse * 2.2);
      tokyoMat.opacity = (1 - pulse) * cur;
    },
  };
}
const sideEarth = makeEarth(false);
scene.add(sideEarth.grp);
sideEarth.grp.rotation.x = 0.35;
const bigEarth = makeEarth(true);
holo.add(bigEarth.grp);
bigEarth.inner.rotation.y = -139.76 * DEG;
bigEarth.grp.rotation.x = 35.68 * DEG;
bigEarth.setOpacity(0);

/* ── 横のホロ画面（canvas に描いて板に貼る） ── */
class Panel {
  constructor(cw, ch, draw, every = 3) {
    this.cw = cw; this.ch = ch; this.draw = draw; this.every = every;
    this.c = makeCanvas(cw, ch); this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false; this.tex.anisotropy = ANISO;
    this.mat = basicAdd({ map: this.tex, opacity: 0 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, ch / cw), this.mat);
    this.mesh.visible = false;
    this.rev = 0; this.revGoal = 0; this.flash = 0; this.width = 1; this.enabled = true; this.frame = 0;
    scene.add(this.mesh);
  }
  update(dt) {
    this.rev = this.revGoal > this.rev ? Math.min(this.revGoal, this.rev + dt / 0.55) : Math.max(this.revGoal, this.rev - dt / 0.35);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    const vis = this.enabled && this.rev > 0.001;
    this.mesh.visible = vis;
    if (!vis) return;
    const k = easeOut(this.rev);
    this.mesh.scale.set(this.width, this.width * (0.03 + 0.97 * k), 1);
    this.mat.opacity = (this.rev < 1 && Math.random() < 0.35 ? 0.25 : 1) * (0.25 + 0.75 * k);
    if (this.frame++ % this.every === 0) { this.draw(this.g, this.cw, this.ch, this); this.tex.needsUpdate = true; }
  }
}
function spaced(g, text, x, y, sp) {
  for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + sp; }
  return x;
}
function frame2d(g, w, h, title, jp, code, flash) {
  g.clearRect(0, 0, w, h);
  const c = 24;
  g.beginPath();
  g.moveTo(2, 2); g.lineTo(w - c, 2); g.lineTo(w - 2, c); g.lineTo(w - 2, h - 2); g.lineTo(c, h - 2); g.lineTo(2, h - c); g.closePath();
  g.fillStyle = ACC(0.05 + flash * 0.25); g.fill();
  g.strokeStyle = ACC(0.35); g.lineWidth = 2; g.stroke();
  g.strokeStyle = ACC(1); g.lineWidth = 5;
  g.beginPath(); g.moveTo(3, 34); g.lineTo(3, 3); g.lineTo(34, 3); g.moveTo(w - 3, h - 34); g.lineTo(w - 3, h - 3); g.lineTo(w - 34, h - 3); g.stroke();
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = '700 25px "Chakra Petch", sans-serif'; g.fillStyle = ACC(1);
  const x = spaced(g, title, 24, 46, 5);
  g.font = '300 19px "M PLUS 1 Code", sans-serif'; g.fillStyle = DIM(1);
  g.fillText(jp, x + 10, 45);
  g.font = '19px "Share Tech Mono", monospace'; g.textAlign = 'right';
  g.fillText(code, w - 26, 45);
  g.fillStyle = ACC(0.3); g.fillRect(24, 60, w - 48, 2);
}

const V = { pow: 0.97, shd: 1, neu: 0.86, tmp: 36.5, code: '3FA' };
const panelSys = new Panel(512, 300, (g, w, h, p) => {
  frame2d(g, w, h, 'SYSTEM', 'システム', '0x' + V.code, p.flash);
  const rows = [['POWER', V.pow, (V.pow * 100).toFixed(1) + '%'], ['SHIELD', V.shd, Math.round(V.shd * 100) + '%'], ['NEURAL', V.neu, Math.round(V.neu * 100) + '%'], ['THERMAL', V.tmp / 120, V.tmp.toFixed(1) + '°C']];
  rows.forEach(([label, v, txt], i) => {
    const y = 104 + i * 50;
    g.textAlign = 'left'; g.font = '21px "Share Tech Mono", monospace'; g.fillStyle = DIM(1);
    g.fillText(label, 26, y + 7);
    const x0 = 140, x1 = w - 128, n = 24, sw = (x1 - x0) / n, lit = Math.round(clamp(v) * n);
    for (let k = 0; k < n; k++) { g.fillStyle = k < lit ? ACC(0.95) : ACC(0.12); g.fillRect(x0 + k * sw, y - 8, sw * 0.6, 17); }
    g.textAlign = 'right'; g.font = '23px "Share Tech Mono", monospace'; g.fillStyle = INK(0.95);
    g.fillText(txt, w - 24, y + 8);
  });
}, 4);

const blips = Array.from({ length: 16 }, () => ({ a: rand(0, TAU), d: rand(0.15, 0.95), life: 0 }));
const panelRadar = new Panel(512, 560, (g, w, h, p) => {
  frame2d(g, w, h, 'RADAR', '周辺探知', '2.0 KM', p.flash);
  const cx = w / 2, cy = 300, r = 200, alert = S.mode === 'alert' || S.mode === 'defense';
  g.strokeStyle = ACC(0.28); g.lineWidth = 2;
  g.beginPath();
  for (const kk of [0.33, 0.66, 1]) { g.moveTo(cx + r * kk, cy); g.arc(cx, cy, r * kk, 0, TAU); }
  g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
  g.stroke();
  const sweep = (T * (alert ? 3.2 : S.mode === 'overdrive' ? 2.6 : 1.4)) % TAU;
  for (let k = 0; k < 24; k++) {
    g.fillStyle = ACC(0.22 * (1 - k / 24));
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, sweep - (k + 1) * 0.035, sweep - k * 0.035); g.closePath(); g.fill();
  }
  g.strokeStyle = ACC(1); g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r); g.stroke();
  const dt = 1 / 60, active = alert ? 16 : 5;
  blips.forEach((b, i) => {
    if (alert) { b.d -= dt * 0.08; if (b.d < 0.08) b.d = 0.95; }
    let diff = (sweep - b.a) % TAU;
    if (diff < 0) diff += TAU;
    if (i < active && diff < 0.12) b.life = 1;
    b.life = Math.max(0, b.life - dt * 0.6);
    if (b.life <= 0) { if (Math.random() < 0.004) { b.a = rand(0, TAU); b.d = rand(0.15, 0.95); } return; }
    const x = cx + Math.cos(b.a) * b.d * r, y = cy + Math.sin(b.a) * b.d * r;
    g.fillStyle = alert ? `rgba(255,70,90,${b.life})` : ACC(b.life);
    g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
    g.strokeStyle = alert ? `rgba(255,70,90,${b.life * 0.6})` : ACC(b.life * 0.6); g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 8 + (1 - b.life) * 18, 0, TAU); g.stroke();
  });
  g.textAlign = 'center'; g.font = '20px "Share Tech Mono", monospace'; g.fillStyle = DIM(1);
  g.fillText(`CONTACTS ${alert ? '16' : '05'}  ·  SWEEP ${alert ? '3.2' : '1.4'}Hz`, cx, h - 26);
}, 1);

const teleA = Array(90).fill(0.5), teleB = Array(90).fill(0.35), hexLines = [];
let hexAddr = 0x3f00;
const panelTele = new Panel(512, 500, (g, w, h, p) => {
  frame2d(g, w, h, 'TELEMETRY', 'テレメトリ', 'Δ ' + (teleA[89] - teleA[88]).toFixed(2), p.flash);
  const x0 = 24, y0 = 78, gw = w - 48, gh = 140;
  g.strokeStyle = ACC(0.13); g.lineWidth = 1.5;
  g.beginPath();
  for (let i = 1; i < 4; i++) { const y = y0 + gh * i / 4; g.moveTo(x0, y); g.lineTo(x0 + gw, y); }
  for (let x = x0 + gw - (T * 40) % 32; x > x0; x -= 32) { g.moveTo(x, y0); g.lineTo(x, y0 + gh); }
  g.stroke();
  const step = gw / (teleA.length - 1);
  g.beginPath();
  teleA.forEach((v, i) => { const x = x0 + i * step, y = y0 + gh - v * gh; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.strokeStyle = ACC(1); g.lineWidth = 3; g.stroke();
  g.lineTo(x0 + gw, y0 + gh); g.lineTo(x0, y0 + gh); g.closePath();
  const gr = g.createLinearGradient(0, y0, 0, y0 + gh);
  gr.addColorStop(0, ACC(0.35)); gr.addColorStop(1, ACC(0));
  g.fillStyle = gr; g.fill();
  g.beginPath();
  teleB.forEach((v, i) => { const x = x0 + i * step, y = y0 + gh - v * gh; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.strokeStyle = INK(0.5); g.lineWidth = 2; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]);
  g.font = '19px "Share Tech Mono", monospace'; g.textAlign = 'left';
  hexLines.forEach((line, i) => { g.fillStyle = i === 0 ? ACC(1) : DIM(1 - i * 0.07); g.fillText(line, 26, 262 + i * 25); });
}, 3);

const panelOrbital = new Panel(512, 112, (g, w, h, p) => {
  frame2d(g, w, h, 'ORBITAL', '衛星リンク', 'SAT 12/12', p.flash);
  g.textAlign = 'left'; g.font = '19px "Share Tech Mono", monospace'; g.fillStyle = INK(0.85);
  g.fillText('TOKYO  35.68N  139.76E', 26, 92);
}, 20);
const panels = [panelSys, panelRadar, panelTele, panelOrbital];

/* ── 粒子 ─────────────────────────── */
const PMAX = reduced ? 500 : coarse ? 1800 : 3200;
const P = {
  pos: new Float32Array(PMAX * 3), col: new Float32Array(PMAX * 3), size: new Float32Array(PMAX), alpha: new Float32Array(PMAX),
  vel: new Float32Array(PMAX * 3), life: new Float32Array(PMAX), max: new Float32Array(PMAX), base: new Float32Array(PMAX),
  drag: new Float32Array(PMAX), kind: new Uint8Array(PMAX), n: 0,
};
const partGeo = new THREE.BufferGeometry();
const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
partGeo.setAttribute('position', attr(P.pos, 3));
partGeo.setAttribute('aColor', attr(P.col, 3));
partGeo.setAttribute('aSize', attr(P.size, 1));
partGeo.setAttribute('aAlpha', attr(P.alpha, 1));
const partMat = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uScale: U_SCALE },
  vertexShader: `uniform float uScale; attribute vec3 aColor; attribute float aSize, aAlpha; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, aSize * uScale / -mv.z); vC = aColor; vA = aAlpha; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, smoothstep(0.5, 0.05, d) * vA); }`,
}, ADD));
const particles = new THREE.Points(partGeo, partMat);
particles.frustumCulled = false;
particles.renderOrder = 5;
scene.add(particles);
function emit(x, y, z, vx, vy, vz, life, size, color, kind = 0, drag = 1.6) {
  if (P.n >= PMAX) return;
  const i = P.n++, i3 = i * 3;
  P.pos[i3] = x; P.pos[i3 + 1] = y; P.pos[i3 + 2] = z;
  P.vel[i3] = vx; P.vel[i3 + 1] = vy; P.vel[i3 + 2] = vz;
  P.col[i3] = color.r; P.col[i3 + 1] = color.g; P.col[i3 + 2] = color.b;
  P.life[i] = P.max[i] = life; P.base[i] = size; P.size[i] = size; P.alpha[i] = 1; P.drag[i] = drag; P.kind[i] = kind;
}
function burst(at, n, speed, life = 1, size = 0.08, color = accent, whiteRatio = 0.35) {
  for (let i = 0; i < n; i++) {
    randDir(tmpA);
    const s = speed * Math.pow(Math.random(), 0.6);
    emit(at.x, at.y, at.z, tmpA.x * s, tmpA.y * s, tmpA.z * s, life * rand(0.5, 1), size * rand(0.5, 1.3), Math.random() < whiteRatio ? WHITE : color);
  }
}
function stepParticles(dt) {
  for (let i = P.n - 1; i >= 0; i--) {
    const i3 = i * 3;
    P.life[i] -= dt;
    if (P.kind[i] === 1) {
      const x = P.pos[i3], y = P.pos[i3 + 1], z = P.pos[i3 + 2], d = Math.hypot(x, y, z) || 1;
      P.vel[i3] -= x / d * 26 * dt; P.vel[i3 + 1] -= y / d * 26 * dt; P.vel[i3 + 2] -= z / d * 26 * dt;
      const k = Math.exp(-2.2 * dt);
      P.vel[i3] *= k; P.vel[i3 + 1] *= k; P.vel[i3 + 2] *= k;
      if (d < 0.5) P.life[i] = 0;
    } else {
      const k = Math.exp(-P.drag[i] * dt);
      P.vel[i3] *= k; P.vel[i3 + 1] *= k; P.vel[i3 + 2] *= k;
      if (P.kind[i] === 2) P.vel[i3 + 1] += 0.9 * dt;
      else if (P.kind[i] === 3) P.vel[i3 + 1] -= 5.5 * dt;
    }
    P.pos[i3] += P.vel[i3] * dt; P.pos[i3 + 1] += P.vel[i3 + 1] * dt; P.pos[i3 + 2] += P.vel[i3 + 2] * dt;
    const f = P.life[i] / P.max[i];
    P.alpha[i] = P.kind[i] === 1 ? Math.min(1, (1 - f) * 4) : f;
    P.size[i] = P.base[i] * (0.4 + 0.6 * f);
    if (P.life[i] <= 0) {
      const j = --P.n;
      if (i !== j) {
        P.pos.copyWithin(i3, j * 3, j * 3 + 3); P.col.copyWithin(i3, j * 3, j * 3 + 3); P.vel.copyWithin(i3, j * 3, j * 3 + 3);
        P.size[i] = P.size[j]; P.alpha[i] = P.alpha[j]; P.life[i] = P.life[j]; P.max[i] = P.max[j];
        P.base[i] = P.base[j]; P.drag[i] = P.drag[j]; P.kind[i] = P.kind[j];
      }
    }
  }
  partGeo.setDrawRange(0, P.n);
  for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) partGeo.attributes[name].needsUpdate = true;
}

/* ── 衝撃波・ビーム・閃光 ──────────── */
const waveGeo = new THREE.RingGeometry(0.965, 1, 160);
const waves = Array.from({ length: 8 }, () => {
  const m = new THREE.Mesh(waveGeo, basicAdd({ color: 0xffffff, opacity: 0, side: THREE.DoubleSide }));
  m.visible = false; holo.add(m);
  return { m, life: 0, max: 1, r: 0, v: 0 };
});
const sphereGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 2));
const spheres = Array.from({ length: 4 }, () => {
  const m = new THREE.LineSegments(sphereGeo, lineAdd({ color: 0xffffff, opacity: 0 }));
  m.visible = false; scene.add(m);
  return { m, life: 0, max: 1, r: 0, v: 0 };
});
function ringWave(v, life, r0 = 0.5, color = accent) {
  const w = waves.find((x) => x.life <= 0) || waves[0];
  w.m.material.color.copy(color); w.r = r0; w.v = v; w.life = w.max = life; w.m.visible = true;
}
function sphereWave(v, life, color = accent) {
  const w = spheres.find((x) => x.life <= 0) || spheres[0];
  w.m.material.color.copy(color); w.r = 0.6; w.v = v; w.life = w.max = life; w.m.visible = true;
  w.m.rotation.set(rand(0, TAU), rand(0, TAU), 0);
}
function stepWaves(dt) {
  for (const list of [waves, spheres]) for (const w of list) {
    if (w.life <= 0) continue;
    w.life -= dt;
    w.r += w.v * dt; w.v *= Math.exp(-dt * 1.3);
    w.m.scale.setScalar(Math.max(0.01, w.r));
    w.m.material.opacity = Math.pow(Math.max(0, w.life / w.max), 1.5) * (list === spheres ? 0.5 : 1);
    if (w.life <= 0) w.m.visible = false;
  }
}

const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
beamGeo.translate(0, 0.5, 0);
const beams = Array.from({ length: 16 }, () => {
  const inner = new THREE.Mesh(beamGeo, basicAdd({ color: 0xffffff, opacity: 0 }));
  const outer = new THREE.Mesh(beamGeo, basicAdd({ color: 0xffffff, opacity: 0 }));
  inner.visible = outer.visible = false;
  scene.add(inner, outer);
  return { inner, outer, life: 0, max: 0.3, len: 1 };
});
const flashes = Array.from({ length: 10 }, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: TEX.glow, color: 0xffffff, opacity: 0, depthTest: false, fog: false }, ADD)));
  s.visible = false; s.renderOrder = 12; scene.add(s);
  return { s, life: 0, max: 0.35, size: 1 };
});
const UP = new THREE.Vector3(0, 1, 0), tmpQ = new THREE.Quaternion();
function flashAt(p, size, color = WHITE, life = 0.35) {
  const f = flashes.find((x) => x.life <= 0) || flashes[0];
  f.s.position.copy(p); f.s.material.color.copy(color); f.size = size; f.life = f.max = life; f.s.visible = true;
}
function fireBeam(from, to, color = accent) {
  const b = beams.find((x) => x.life <= 0) || beams[0];
  tmpA.subVectors(to, from);
  b.len = tmpA.length();
  tmpQ.setFromUnitVectors(UP, tmpA.normalize());
  for (const m of [b.inner, b.outer]) { m.position.copy(from); m.quaternion.copy(tmpQ); m.visible = true; }
  b.outer.material.color.copy(color);
  b.life = b.max = 0.3;
  flashAt(from, 1.1, color, 0.18);
  flashAt(to, 1.6, color, 0.3);
  burst(to, reduced ? 10 : 34, 5, 0.6, 0.07, color, 0.5);
}
function stepBeams(dt) {
  for (const b of beams) {
    if (b.life <= 0) continue;
    b.life -= dt;
    const k = Math.max(0, b.life / b.max);
    b.inner.scale.set(0.004 + 0.016 * k, b.len, 0.004 + 0.016 * k);
    b.outer.scale.set(0.075 * k + 0.01, b.len, 0.075 * k + 0.01);
    b.inner.material.opacity = k;
    b.outer.material.opacity = 0.55 * k;
    if (b.life <= 0) b.inner.visible = b.outer.visible = false;
  }
  for (const f of flashes) {
    if (f.life <= 0) continue;
    f.life -= dt;
    const k = Math.max(0, f.life / f.max);
    f.s.scale.setScalar(f.size * (1.4 - k * 0.6));
    f.s.material.opacity = k;
    if (f.life <= 0) f.s.visible = false;
  }
}

/* ── 敵ドローンとシールド ───────────── */
const droneEdges = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.36, 0));
const droneLine = lineAdd({ color: ENEMY, opacity: 1 });
droneLine.fog = true;
const droneCore = basicAdd({ color: ENEMY });
droneCore.fog = true;
const droneRing = basicAdd({ color: ENEMY, opacity: 0.6 });
droneRing.fog = true;
const droneCoreGeo = new THREE.OctahedronGeometry(0.13, 0), droneRingGeo = new THREE.TorusGeometry(0.55, 0.012, 4, 36);
const drones = Array.from({ length: 22 }, () => {
  const g = new THREE.Group();
  g.add(new THREE.LineSegments(droneEdges, droneLine), new THREE.Mesh(droneCoreGeo, droneCore));
  const ring = new THREE.Mesh(droneRingGeo, droneRing);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.visible = false;
  scene.add(g);
  return { g, alive: false, vel: new THREE.Vector3(), t: 0, seed: 0, speed: 4 };
});
const shieldMat = tinted(lineAdd({ opacity: 0 }));
const shieldMesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.4, 2)), shieldMat);
scene.add(shieldMesh);

/* ── 後処理：グロー、色収差、衝撃波のゆがみ、ノイズ、ブラウン管の消灯 ── */
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 0.12);
composer.addPass(bloom);
const finalPass = new THREE.ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0 }, uAspect: { value: 1 }, uFlash: { value: 0 },
    uGlitch: { value: 0 }, uCollapse: { value: 0 }, uShockR: { value: 0 }, uShockAmp: { value: 0 },
    uShockC: { value: new THREE.Vector2(0.5, 0.5) }, uTint: { value: accent },
    uDim: { value: 0 }, uSpot: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: VS_UV,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAberr, uAspect, uFlash, uGlitch, uCollapse, uShockR, uShockAmp, uDim;
    uniform vec2 uShockC, uSpot; uniform vec3 uTint; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float boost = 0.0;
      if (uCollapse > 0.0) {
        float sy = max(1.0 - uCollapse * 1.25, 0.004);
        float sx = max(1.0 - clamp((uCollapse - 0.8) * 5.0, 0.0, 1.0), 0.003);
        vec2 q = (uv - 0.5) / vec2(sx, sy) + 0.5;
        if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        uv = q; boost = uCollapse * 3.0;
      }
      if (uGlitch > 0.001) {
        float tt = floor(uTime * 24.0), band = floor(uv.y * 18.0);
        if (hash(vec2(band, tt)) < uGlitch * 0.6) uv.x += (hash(vec2(tt, band)) - 0.5) * 0.12 * uGlitch;
      }
      float ring = 0.0;
      if (uShockAmp > 0.001) {
        vec2 sd = uv - uShockC; sd.x *= uAspect;
        float dist = length(sd), w = 0.1, diff = dist - uShockR;
        if (abs(diff) < w) {
          ring = 1.0 - pow(abs(diff) / w, 0.8);
          vec2 dir = sd / max(dist, 1e-4); dir.x /= uAspect;
          uv -= dir * (diff / w) * ring * uShockAmp * 0.045;
        }
      }
      vec2 c = uv - 0.5;
      vec2 off = c * (0.0015 + uAberr) * (0.6 + dot(c, c) * 2.5);
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col += uTint * ring * uShockAmp * 0.3;
      col *= 1.0 + boost;
      col *= 0.94 + 0.06 * sin(gl_FragCoord.y * 1.7);
      float v = length((vUv - 0.5) * 2.0);
      col *= mix(1.0, 0.3, smoothstep(0.55, 1.45, v));
      col *= 1.0 - uDim * 0.85 * smoothstep(0.12, 0.5, length((vUv - uSpot) * vec2(uAspect, 1.0)));
      col += (hash(vUv * 731.0 + fract(uTime) * 91.0) - 0.5) * 0.035;
      col = mix(col, vec3(1.0), clamp(uFlash, 0.0, 1.0) * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(finalPass);
const FU = finalPass.uniforms;
FU.uTint.value = accent;   // ShaderPass は uniform を複製するので、色だけ本物を差し直す

/* ── 配置：画面の形に合わせてカメラと横の画面を置く ── */
let W = 0, H = 0, UIPR = 1, camDist = 12, zoom = 1;
const L = { portrait: false, top: 0, bot: 0, cy: 0, Rpx: 150, u: 0.01 };
const tanH = Math.tan(FOV / 2 * DEG);
function place(obj, px, py, wpx) {
  obj.position.set((px - W / 2) * L.u, (L.cy - py) * L.u, 0);
  return wpx * L.u;
}
function layout() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setPixelRatio(PR);
  renderer.setSize(W, H, false);
  composer.setPixelRatio(PR);
  composer.setSize(W, H);
  UIPR = Math.min(window.devicePixelRatio || 1, 2);
  ui.width = Math.round(W * UIPR); ui.height = Math.round(H * UIPR);
  ux.setTransform(UIPR, 0, 0, UIPR, 0, 0);
  camera.aspect = W / H;
  FU.uAspect.value = W / H;

  const tr = topEl.getBoundingClientRect(), dr = deckEl.getBoundingClientRect();
  L.top = tr.bottom + 6; L.bot = dr.top - 6;
  L.portrait = W / H < 0.9;
  const freeH = Math.max(120, L.bot - L.top);
  const mini = L.portrait ? Math.min(W * 0.36, freeH * 0.27) : 0;
  const coreTop = L.top + mini, coreH = L.bot - coreTop;
  L.cy = coreTop + coreH / 2;
  const side = L.portrait ? 0 : clamp((W - 32) * 0.2, 0, 300);
  L.Rpx = L.portrait ? Math.min(W * 0.42, coreH * 0.42) : Math.min(coreH * 0.44, (W - 2 * side - 120) * 0.42);
  camDist = 2.75 * H / (2 * L.Rpx * tanH);
  camera.setViewOffset(W, H, 0, H / 2 - L.cy, W, H);
  camera.updateProjectionMatrix();
  L.u = (2 * camDist * tanH) / H;
  U_SCALE.value = (H * PR) / (2 * tanH);

  scene.fog.near = camDist + 4;
  scene.fog.far = camDist + 48;
  const tableY = -2.75 * 1.12;
  table.position.y = tableY;
  cone.scale.set(1, -tableY - 1.0, 1);
  cone.position.y = (-tableY - 1.0) / 2;
  grid.position.y = tableY - 0.02;

  if (!L.portrait && side >= 150) {
    const gap = 16, avail = L.bot - L.top;
    const hSys = side * 300 / 512, hRadar = side * 560 / 512, hOrb = side * 112 / 512, hTele = side * 500 / 512, hGlobe = side * 0.95;
    const sl = Math.min(1, avail / (hSys + hRadar + gap)), sr = Math.min(1, avail / (hGlobe + hOrb + hTele + gap * 2));
    const xl = 16 + side * sl / 2, xr = W - 16 - side * sr / 2;
    let y = L.top;
    panelSys.width = place(panelSys.mesh, xl, y + hSys * sl / 2, side * sl); y += hSys * sl + gap;
    panelRadar.width = place(panelRadar.mesh, xl, y + hRadar * sl / 2, side * sl);
    y = L.top;
    sideEarth.setScale(place(sideEarth.grp, xr, y + hGlobe * sr / 2, side * sr * 0.34)); y += hGlobe * sr;
    panelOrbital.width = place(panelOrbital.mesh, xr, y + hOrb * sr / 2, side * sr); y += hOrb * sr + gap;
    panelTele.width = place(panelTele.mesh, xr, y + hTele * sr / 2, side * sr);
    panelSys.mesh.rotation.y = panelRadar.mesh.rotation.y = 0.32;
    panelTele.mesh.rotation.y = panelOrbital.mesh.rotation.y = -0.32;
    panels.forEach((p) => { p.enabled = true; });
    L.sideEarth = true;
  } else if (L.portrait) {
    const box = Math.min(mini, (W - 48) / 2);
    panelRadar.width = place(panelRadar.mesh, 16 + box / 2, L.top + mini / 2, box * 512 / 560);
    panelRadar.mesh.rotation.y = 0.18;
    sideEarth.setScale(place(sideEarth.grp, W - 16 - box / 2, L.top + mini / 2, box * 0.36));
    panelSys.enabled = panelTele.enabled = panelOrbital.enabled = false;
    panelRadar.enabled = true;
    L.sideEarth = true;
  } else {
    panels.forEach((p) => { p.enabled = false; });
    L.sideEarth = false;
  }
  root.style.setProperty('--top', L.top + 'px');
  root.style.setProperty('--cx', W / 2 + 'px');
  root.style.setProperty('--cy', L.cy + 'px');
  root.style.setProperty('--cr', L.Rpx + 'px');
  root.style.setProperty('--hy', Math.min(L.bot - 14, L.cy + L.Rpx * 1.0 + 16) + 'px');
}
let layoutQueued = false;
function queueLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => { layoutQueued = false; layout(); });
}
window.addEventListener('resize', queueLayout);
if ('ResizeObserver' in window) new ResizeObserver(queueLayout).observe(deckEl);

/* ── 画面座標と3D座標 ──────────────── */
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.2);
function toWorld(x, y, out) {
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(aimPlane, out) || out.set(0, 0, 1.2);
}
const projV = new THREE.Vector3();
function toScreen(v) {
  projV.copy(v).project(camera);
  return { x: (projV.x + 1) / 2 * W, y: (1 - projV.y) / 2 * H, z: projV.z };
}
const ORIGIN = new THREE.Vector3();
let coreS = { x: 0, y: 0 };

/* ── 操作 ─────────────────────────── */
function markTouched() { S.touched = true; S.lastInput = performance.now(); body.classList.add('touched'); }
const rot = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
const pointers = new Map();
const drag = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, lastT: 0, onCore: false, moved: false, hold: 0 };
let pinch = null, tapTimes = [], lastLine = '';
const mouse = { x: 0, y: 0 };
const locks = [];

function coreHit(x, y) { return Math.hypot(x - coreS.x, y - coreS.y) < L.Rpx * 0.3; }

ui.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'awake') return;
  Sound.init();
  markTouched();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { ui.setPointerCapture(e.pointerId); } catch (_) { /* そのまま */ }
  if (pointers.size === 2) {
    clearTimeout(drag.hold);
    if (S.charging) release();
    drag.id = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
    return;
  }
  if (pointers.size > 2) return;
  const now = performance.now();
  Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: now, lastT: now, moved: false });
  drag.onCore = coreHit(e.clientX, e.clientY);
  rot.vy *= 0.25; rot.vp *= 0.25;
  if (drag.onCore && S.mode !== 'defense') drag.hold = later(startCharge, 230);
});
ui.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX / W * 2 - 1; mouse.y = e.clientY / H * 2 - 1; }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    zoom = clamp(pinch.z * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.6, 1.6);
    return;
  }
  if (e.pointerId !== drag.id) return;
  const x = e.clientX, y = e.clientY, now = performance.now();
  if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > 9) {
    drag.moved = true;
    if (!S.charging) clearTimeout(drag.hold);
  }
  if (drag.moved && !S.charging) {
    const dts = Math.max(0.008, (now - drag.lastT) / 1000);
    const dyaw = (x - drag.x) * 0.0065, dpitch = (y - drag.y) * 0.0045;
    rot.yaw += dyaw; rot.pitch = clamp(rot.pitch + dpitch, -1.2, 1.2);
    rot.vy = rot.vy * 0.5 + (dyaw / dts) * 0.5;
    rot.vp = rot.vp * 0.5 + (dpitch / dts) * 0.5;
  }
  drag.x = x; drag.y = y; drag.lastT = now;
});
function endPointer(e, cancelled) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (e.pointerId !== drag.id) return;
  clearTimeout(drag.hold);
  if (S.charging) release();
  else if (!cancelled && !drag.moved) {
    if (drag.onCore && S.mode !== 'defense') { if (performance.now() - drag.t0 < 400) talk(); }
    else tapFire(drag.x, drag.y);
  }
  drag.id = null;
}
ui.addEventListener('pointerup', (e) => endPointer(e, false));
ui.addEventListener('pointercancel', (e) => endPointer(e, true));
ui.addEventListener('contextmenu', (e) => e.preventDefault());
ui.addEventListener('wheel', (e) => { if (S.phase === 'awake') { e.preventDefault(); zoom = clamp(zoom * (1 + e.deltaY * 0.001), 0.6, 1.6); } }, { passive: false });

function talk() {
  const now = performance.now();
  tapTimes = tapTimes.filter((t) => now - t < 2500);
  tapTimes.push(now);
  if (tapTimes.length >= 5) {
    tapTimes = [];
    say(LINES.rapid);
    banner('!?', '連打を検知');
    burst(ORIGIN, 160, 9, 1, 0.09);
    S.glitch = 0.5;
  } else {
    let line;
    do { line = pick(LINES.talk); } while (line === lastLine);
    lastLine = line;
    say(line);
  }
  S.energy = Math.max(S.energy, 0.7);
  ringWave(5, 0.9, 0.6);
  Sound.blip(1046);
  buzz(10);
}

const aimV = new THREE.Vector3(), fromV = new THREE.Vector3();
function tapFire(x, y) {
  if (S.mode === 'defense') {
    D.shots++;
    let best = null, bd = coarse ? 60 : 44;
    for (const d of drones) {
      if (!d.alive) continue;
      const s = toScreen(d.g.position);
      const dd = Math.hypot(s.x - x, s.y - y);
      if (dd < bd) { bd = dd; best = d; }
    }
    if (best) { D.hits++; shoot(best.g.position, true); killDrone(best, true); }
    else { toWorld(x, y, aimV); shoot(aimV, false); }
    return;
  }
  locks.push({ x, y, t: 0, fired: false, id: 'T-' + hex(4) });
  if (locks.length > 10) locks.shift();
  Sound.lock();
  buzz(8);
}
function shoot(target, hitSound) {
  fromV.copy(target).normalize().multiplyScalar(0.62);
  fireBeam(fromV, target, accent);
  const s = toScreen(target);
  Sound.beam((s.x / W) * 2 - 1);
  S.energy = Math.max(S.energy, 0.35);
  S.kick = Math.max(S.kick, 0.15);
  if (!hitSound) Sound.zap((s.x / W) * 2 - 1);
}

function startCharge() {
  if (S.charging || S.phase !== 'awake') return;
  S.charging = true;
  Sound.chargeStart();
  buzz(20);
}
function release() {
  if (!S.charging) return;
  S.charging = false;
  Sound.chargeStop();
  const p = S.charge;
  for (let i = 0; i < P.n; i++) {
    if (P.kind[i] !== 1) continue;
    const i3 = i * 3, d = Math.hypot(P.pos[i3], P.pos[i3 + 1], P.pos[i3 + 2]) || 1, s = rand(6, 18) * Math.max(p, 0.3);
    P.kind[i] = 0; P.drag[i] = 1.4;
    P.vel[i3] = P.pos[i3] / d * s; P.vel[i3 + 1] = P.pos[i3 + 1] / d * s; P.vel[i3 + 2] = P.pos[i3 + 2] / d * s;
    P.life[i] = P.max[i] = rand(0.6, 1.3);
  }
  if (p > 0.18) blast(p);
  else { ringWave(4, 0.6, 0.6); Sound.blip(660); }
  S.charge = 0;
}
function blast(p) {
  const big = p > 0.85;
  Sound.boom(p);
  buzz(big ? [60, 40, 140] : 40);
  if (big) S.freeze = 0.09;
  S.flash = Math.max(S.flash, 0.25 + 0.55 * p);
  S.shake = Math.max(S.shake, 0.08 + 0.3 * p);
  S.kick = 1; S.energy = 1;
  S.aberr = 0.012 + 0.02 * p;
  S.bloomBoost = Math.max(S.bloomBoost, 1.6 * p);
  S.glitch = big ? 0.7 : 0.25;
  shockScreen(0.6 + 0.9 * p);
  ringWave(10 + 14 * p, 1.3, 0.6);
  ringWave(6 + 9 * p, 1.6, 0.5, WHITE);
  if (big) ringWave(26, 1.0, 1);
  sphereWave(6 + 8 * p, 1.4);
  burst(ORIGIN, Math.round((reduced ? 40 : 200) + (reduced ? 60 : 900) * p), 6 + 22 * p, 1.6, 0.1);
  rot.vy += (Math.random() < 0.5 ? -1 : 1) * 3.5 * p;
  hudEl.classList.remove('jolt'); void hudEl.offsetWidth; hudEl.classList.add('jolt');
  if (big) {
    banner('FULL BURST', `出力 ${Math.round(100 + p * 200)}%`);
    if (T > S.lineAt.blast) { S.lineAt.blast = T + 8; later(() => say(pick(LINES.blast)), 800); }
  }
}
function shockScreen(amp) {
  const s = toScreen(ORIGIN);
  FU.uShockC.value.set(s.x / W, 1 - s.y / H);
  S.shock.r = 0; S.shock.amp = amp;
}

/* ── コマンド ─────────────────────── */
const cmdBtns = [...document.querySelectorAll('[data-cmd]')];
function setButtons() {
  for (const b of cmdBtns) {
    const c = b.dataset.cmd;
    b.classList.toggle('active', (c === 'overdrive' && S.mode === 'overdrive') || (c === 'defense' && (S.mode === 'defense' || S.mode === 'alert'))
      || (c === 'transform' && S.formGoal === 1) || (c === 'globe' && S.globeGoal === 1));
  }
  statusText.textContent = { overdrive: 'OVERDRIVE', alert: 'ALERT', defense: 'COMBAT' }[S.mode] || (S.formGoal ? 'BATTLE FORM' : 'ONLINE');
}

const D = { t: 0, dur: 26, kills: 0, shots: 0, hits: 0, spawnT: 0, autoT: 0 };
function endMode(silent) {
  if (S.mode === 'normal') return;
  const was = S.mode;
  S.mode = 'normal';
  accentGoal = PAL.cyan;
  body.classList.remove('mode-od', 'mode-alert', 'mode-def');
  Sound.humBoost(0); Sound.alarmStop(); Sound.engine(0);
  if (was === 'overdrive' || was === 'defense') Music.stop();
  if (was === 'defense') finishDefense(silent);
  setButtons();
  if (silent) return;
  if (was === 'overdrive') {
    say(LINES.odEnd);
    Sound.cool();
    for (let i = 0; i < 120; i++) {
      randDir(tmpA);
      emit(tmpA.x * 0.8, tmpA.y * 0.8, tmpA.z * 0.8, rand(-0.4, 0.4), rand(0.4, 1.4), rand(-0.4, 0.4), rand(1.2, 2.4), rand(0.08, 0.2), WHITE, 2, 0.8);
    }
  }
}

function startScan() {
  if (S.scan) return;
  const targets = [];
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
    const x = rand(W * 0.08, W * 0.92), y = rand(L.top + 20, L.bot - 20);
    if (Math.hypot(x - coreS.x, y - coreS.y) < L.Rpx * 1.1) continue;
    targets.push({ x, y, s: rand(20, 42), id: 'OBJ-' + hex(4), info: `${rand(12, 980).toFixed(1)}m  ${pick(['NEUTRAL', 'UNKNOWN', 'FRIENDLY', 'PASSIVE'])}`, seen: 0 });
    i++;
  }
  S.scan = { t: 0, dur: 2, targets, done: false };
  Sound.scan();
  say(LINES.scanStart);
}

function startDefense() {
  S.mode = 'defense';
  accentGoal = PAL.cyan;
  body.classList.remove('mode-alert');
  body.classList.add('mode-def');
  Object.assign(D, { t: 0, kills: 0, shots: 0, hits: 0, spawnT: 0.3, autoT: 1.6 });
  S.shield = 1;
  missionEl.hidden = false;
  Music.start();
  say(LINES.defGo);
  banner('ENGAGE', '敵をタップして撃墜');
  setButtons();
}
function spawnDrone() {
  const d = drones.find((x) => !x.alive);
  if (!d) return;
  // 6割は画面の端から、4割は奥から飛んでくる
  const a = rand(0, TAU), edge = Math.random() < 0.6;
  if (edge) d.g.position.set(Math.cos(a) * rand(9, 12), Math.sin(a) * rand(5, 7), rand(-6, 1));
  else d.g.position.set(Math.cos(a) * rand(4, 9), Math.sin(a) * rand(2, 5), rand(-26, -16));
  d.speed = rand(2.6, 3.6) + D.t * 0.08;
  d.vel.set(0, 0, 0);
  d.seed = rand(0, 100); d.t = 0; d.alive = true; d.g.visible = true;
  d.g.scale.setScalar(1.5);
}
function killDrone(d, byPlayer) {
  if (!d.alive) return;
  d.alive = false; d.g.visible = false;
  const p = d.g.position;
  burst(p, reduced ? 20 : 90, 7, 1, 0.1, ENEMY, 0.4);
  flashAt(p, 2.4, ENEMY, 0.4);
  const s = toScreen(p);
  Sound.explode((s.x / W) * 2 - 1, 0.9);
  if (byPlayer) { D.kills++; buzz(15); S.kick = Math.max(S.kick, 0.25); }
}
function finishDefense(silent) {
  missionEl.hidden = true;
  drones.forEach((d, i) => { if (d.alive) later(() => killDrone(d, false), i * 60); });
  if (silent) return;
  const n = D.kills, acc = D.shots ? Math.round(D.hits / D.shots * 100) : 0;
  banner('MISSION COMPLETE', `撃墜 ${n}機 · 命中率 ${acc}%`);
  Sound.chord(220);
  const line = n >= 25 ? `完璧です、ボス。撃墜${n}機。…正直、惚れ惚れしました。`
    : n >= 12 ? `迎撃完了。撃墜${n}機。見事な腕前です。`
      : `迎撃完了。撃墜${n}機。…残りは私が片付けておきました。`;
  later(() => say(line), 500);
}

const CMD = {
  scan: startScan,
  overdrive() {
    if (S.mode === 'overdrive') return;
    endMode(true);
    S.mode = 'overdrive'; S.modeEnd = T + 12;
    accentGoal = PAL.amber;
    body.classList.add('mode-od');
    setButtons();
    Sound.rise();
    say(LINES.odStart);
    S.shake = Math.max(S.shake, 0.05);
    later(() => {
      if (S.mode !== 'overdrive') return;
      Music.start();
      Sound.boom(0.9); Sound.chord(146.83); Sound.humBoost(1); Sound.engine(1);
      S.freeze = 0.06; S.flash = 0.8; S.kick = 1; S.energy = 1; S.bloomBoost = 1.4; S.aberr = 0.025; S.glitch = 0.5;
      shockScreen(1.2);
      ringWave(22, 1.2, 0.6); ringWave(12, 1.5, 0.5, WHITE); sphereWave(12, 1.3);
      burst(ORIGIN, reduced ? 60 : 700, 18, 1.5, 0.1);
      banner('OVERDRIVE', '出力 300%');
      buzz([50, 30, 100]);
    }, 1050);
  },
  defense() {
    if (S.mode === 'defense' || S.mode === 'alert') { endMode(false); return; }
    endMode(true);
    S.mode = 'alert';
    accentGoal = PAL.red;
    body.classList.add('mode-alert');
    setButtons();
    Sound.alarm(2.6);
    say(LINES.defWarn);
    banner('WARNING', '敵性ドローン 多数接近');
    S.shake = Math.max(S.shake, 0.06);
    S.glitch = 0.4;
    buzz([200, 100, 200, 100, 200]);
    later(() => { if (S.mode === 'alert') startDefense(); }, 2800);
  },
  transform() {
    S.formGoal = S.formGoal ? 0 : 1;
    const on = S.formGoal === 1;
    Sound.servo(0, on ? 1 : 0.8);
    Sound.servo(0.35, on ? 1.15 : 0.7);
    rings.forEach((r) => { r.locked = -1; });
    banner(on ? 'BATTLE FORM' : 'STANDARD FORM', on ? '戦闘形態' : '通常形態');
    say(on ? LINES.formOn : LINES.formOff);
    S.kick = Math.max(S.kick, 0.5); S.glitch = 0.35; S.aberr = 0.012;
    setButtons();
  },
  globe() {
    S.globeGoal = S.globeGoal ? 0 : 1;
    const on = S.globeGoal === 1;
    Sound.open(); Sound.servo(0.1, on ? 1.2 : 0.8);
    if (on) { bigEarth.inner.rotation.y = -139.76 * DEG; rot.yaw = Math.round(rot.yaw / TAU) * TAU; }
    banner(on ? 'GLOBAL VIEW' : 'CORE VIEW', on ? '地球ホログラム' : 'コア表示');
    say(on ? LINES.globeOn : LINES.globeOff);
    ringWave(6, 1, 0.8);
    setButtons();
  },
  report() {
    const d = new Date();
    say(`状況報告。現在時刻、${d.getHours()}時${d.getMinutes()}分。コア出力${Math.round(S.power * 100)}パーセント、シールド${Math.round(V.shd * 100)}パーセント。ボスの調子も、良さそうですね。`);
    panels.filter((p) => p.enabled).forEach((p, i) => later(() => { p.flash = 1; Sound.blip(880 + i * 220); }, 150 + i * 220));
    rings.forEach((r, i) => later(() => { r.mat.uniforms.uBoost.value = 1.2; Sound.glitch(); }, i * 90));
    ringWave(5, 1.2, 0.8);
  },
};
for (const b of cmdBtns) b.addEventListener('click', () => {
  if (S.phase !== 'awake') return;
  Sound.init(); Sound.click(); buzz(12);
  markTouched();
  b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire');
  const c = b.dataset.cmd;
  if (CMD[c]) CMD[c]();
  else if (window.VEGA_FUN && window.VEGA_FUN[c]) window.VEGA_FUN[c]();
});

const tSound = $('#tSound'), tVoice = $('#tVoice'), tPower = $('#tPower');
tSound.addEventListener('click', () => {
  Sound.init(); Sound.set(!Sound.on);
  tSound.setAttribute('aria-pressed', String(Sound.on));
  if (Sound.on) Sound.click();
});
tVoice.addEventListener('click', () => {
  Voice.set(!Voice.on);
  tVoice.setAttribute('aria-pressed', String(Voice.on));
  Sound.click();
});
tPower.addEventListener('click', () => { if (S.phase === 'awake') { Sound.click(); sleep(); } });

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || S.phase !== 'awake') return;
  const k = e.key.toLowerCase();
  if (k === ' ' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) {
    e.preventDefault(); Sound.init(); markTouched(); startCharge();
    return;
  }
  const map = { s: 'scan', o: 'overdrive', d: 'defense', t: 'transform', g: 'globe', r: 'report', l: 'lucky', j: 'joke' };
  if (map[k]) { const b = document.querySelector(`[data-cmd="${map[k]}"]`); if (b) b.click(); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ' && S.charging) release(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Sound.suspend(); Voice.stop(); release(); } else Sound.resume();
});

/* ── 起動とスリープ ────────────────── */
function wake() {
  if (S.phase !== 'standby') return;
  Sound.init(); Voice.unlock();
  S.phase = 'booting'; S.touched = false; body.classList.remove('touched');
  body.classList.add('booting');
  S.tableOn = true; S.assembling = false;
  rings.forEach((r) => { r.shown = false; });
  Sound.powerUp(); buzz(30);
  bootEl.textContent = '';
  bootEl.classList.add('on');
  BOOT.forEach((line, i) => later(() => { bootEl.textContent += line + '\n'; Sound.glitch(); }, 60 + i * 120));
  later(() => { S.revealGoal = 1; }, 280);
  later(ignite, 1600);
  later(() => bootEl.classList.remove('on'), 2800);
  later(() => say(greeting()), 2500);
  later(() => { if (S.phase === 'awake' && !S.touched) say(LINES.hint); }, 9000);
}
function ignite(cinematic = false) {
  S.phase = 'awake';
  S.assembling = false; S.tableOn = true;
  S.reveal = Math.max(S.reveal, cinematic ? 1 : 0); S.revealGoal = 1;
  body.classList.remove('booting'); body.classList.add('awake');
  Sound.boom(cinematic ? 1 : 0.8); Sound.chord(220, 0.05); Sound.humStart();
  S.freeze = cinematic ? 0.13 : 0.07; S.flash = 1; S.kick = 1; S.energy = 1;
  S.bloomBoost = cinematic ? 2.2 : 1.6; S.aberr = cinematic ? 0.03 : 0.02; S.glitch = 0.7;
  shockScreen(cinematic ? 1.5 : 1.1);
  ringWave(cinematic ? 20 : 14, 1.2, 0.6); ringWave(8, 1.5, 0.5, WHITE); sphereWave(cinematic ? 12 : 9, 1.4);
  if (cinematic) ringWave(30, 0.9, 1, WHITE);
  burst(ORIGIN, reduced ? 60 : cinematic ? 1100 : 600, cinematic ? 20 : 14, 1.5, 0.1);
  rot.vy += cinematic ? 4 : 0;
  panels.forEach((p, i) => later(() => { p.revGoal = 1; Sound.glitch(); }, (cinematic ? 900 : 150) + i * 140));
  if (!cinematic) banner('VEGA ONLINE', 'ALL SYSTEMS GO');
  buzz([40, 30, 80]);
  setButtons();
}
function sleep() {
  if (S.phase !== 'awake') return;
  S.phase = 'sleeping';
  endMode(true);
  release();
  S.formGoal = 0; S.globeGoal = 0; S.scan = null;
  S.slowGoal = 1; S.dimGoal = 0; S.zoomGoal = 0; S.rainbow = 0; S.swarmT = 0;
  accentGoal = PAL.cyan;
  window.dispatchEvent(new Event('vega-sleep'));
  setButtons();
  say(LINES.sleep);
  later(() => {
    S.revealGoal = 0;
    panels.forEach((p) => { p.revGoal = 0; });
    body.classList.remove('awake');
    Sound.humStop(); Sound.powerDown();
  }, 2300);
  later(() => { S.collapseGoal = 1; }, 3000);
  later(() => {
    S.phase = 'standby'; S.collapseGoal = 0; S.collapse = 0;
    clearInterval(typeTimer); sayEl.textContent = '';
    locks.length = 0;
  }, 3700);
}
wakeBtn.addEventListener('click', () => {
  if (window.VEGA_BOOT) window.VEGA_BOOT.run();
  else wake();
});

/* ── 毎フレームの更新 ──────────────── */
let hexAcc = 0, teleAcc = 0, barAcc = 0, boltAcc = 0;
function pushHex() {
  hexAddr = (hexAddr + 16) & 0xffff;
  hexLines.unshift(hexAddr.toString(16).toUpperCase().padStart(4, '0') + '  ' + Array.from({ length: 8 }, () => hex(2)).join(' '));
  if (hexLines.length > 9) hexLines.pop();
}
for (let i = 0; i < 9; i++) pushHex();
function pushTele() {
  const goal = 0.42 + S.energy * 0.35 + (S.mode === 'overdrive' ? 0.3 : 0) + S.talk * 0.15 + S.charge * 0.3;
  const a = teleA[teleA.length - 1], b = teleB[teleB.length - 1];
  teleA.push(clamp(a + rand(-0.09, 0.09) + (goal - a) * 0.18, 0.06, 0.94)); teleA.shift();
  teleB.push(clamp(b + rand(-0.05, 0.05) + (0.32 - b) * 0.1, 0.06, 0.94)); teleB.shift();
}
const clockEl = $('#clock'), mKills = $('#mKills'), mShield = $('#mShield'), mTime = $('#mTime');
let talkingShown = false;
S.collapseGoal = 0;

function update(dt, real) {
  updateTint(dt, real);
  // 起動・停止の進み具合
  S.standby = S.phase === 'standby' || S.phase === 'loading' ? Math.min(1, S.standby + dt / 0.6) : Math.max(0, S.standby - dt / 0.35);
  const tableGoal = S.phase === 'awake' || (S.phase === 'booting' && S.tableOn) ? 1 : 0;
  S.table += (tableGoal - S.table) * Math.min(1, dt * (tableGoal ? 1.6 : 3));
  S.reveal = S.revealGoal > S.reveal ? Math.min(1, S.reveal + dt / 1.3) : Math.max(0, S.reveal - dt / 0.8);
  // 起動演出の間はカメラを遠くに置き、組み立てが始まったら寄っていく
  const dollyGoal = S.phase === 'awake' || S.phase === 'sleeping' ? 1 : S.phase === 'booting' ? (S.tableOn ? 0.94 : 0.42) : 0.82;
  S.dolly += (dollyGoal - S.dolly) * Math.min(1, dt * (S.phase === 'awake' ? 1.2 : 0.8));
  S.collapse += ((S.collapseGoal || 0) - S.collapse) * Math.min(1, dt * 7);
  S.form += Math.sign(S.formGoal - S.form) * Math.min(Math.abs(S.formGoal - S.form), dt / 1.5);
  S.globe += Math.sign(S.globeGoal - S.globe) * Math.min(Math.abs(S.globeGoal - S.globe), dt / 1.1);

  // ホログラムの回転（離すと正面に戻る）
  if (drag.id === null || !drag.moved) {
    rot.yaw += rot.vy * dt; rot.pitch += rot.vp * dt;
    rot.vy *= Math.exp(-dt * 1.3); rot.vp *= Math.exp(-dt * 3);
    if (Math.abs(rot.vy) < 1.2) rot.yaw += (Math.round(rot.yaw / Math.PI) * Math.PI - rot.yaw) * Math.min(1, dt * 0.9);
    rot.pitch += -rot.pitch * Math.min(1, dt * 0.9);
  } else if (performance.now() - drag.lastT > 60) { rot.vy *= Math.exp(-dt * 12); rot.vp *= Math.exp(-dt * 12); }
  rot.pitch = clamp(rot.pitch, -1.2, 1.2);
  holo.rotation.set(rot.pitch + Math.sin(T * 0.27) * 0.07 + mouse.y * 0.08, rot.yaw + Math.sin(T * 0.19) * 0.17 + mouse.x * 0.12, 0);
  const spin = Math.abs(rot.vy);
  Sound.spin(S.phase === 'awake' ? spin : 0);
  if (S.phase === 'awake' && spin > 3 && !reduced) {
    holo.updateMatrixWorld();
    const n = Math.floor(Math.min(10, spin * dt * 12) + Math.random());
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      tmpA.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0).applyMatrix4(holo.matrixWorld);
      emit(tmpA.x, tmpA.y, tmpA.z, rot.vy * tmpA.z * 0.6 + rand(-0.5, 0.5), rand(-0.5, 0.5), -rot.vy * tmpA.x * 0.6, rand(0.3, 0.7), rand(0.04, 0.08), Math.random() < 0.4 ? WHITE : accent, 0, 2);
    }
    if (spin > 7 && T > S.lineAt.spin) {
      S.lineAt.spin = T + 25;
      say(pick(LINES.spin));
      banner('OVERSPEED', `${Math.round(spin / TAU * 60)} RPM`);
    }
  }

  // チャージ
  if (S.charging) {
    const before = S.charge;
    S.charge = Math.min(1, S.charge + dt / 1.5);
    Sound.chargeSet(S.charge);
    S.shake = Math.max(S.shake, S.charge * 0.05);
    const n = Math.floor((40 + 260 * S.charge) * dt + Math.random());
    for (let i = 0; i < n; i++) {
      randDir(tmpA);
      const r = rand(4, 7.5);
      emit(tmpA.x * r, tmpA.y * r, tmpA.z * r, -tmpA.y * 2, tmpA.x * 2, 0, 2.2, rand(0.05, 0.12), Math.random() < 0.4 ? WHITE : accent, 1);
    }
    if (before < 1 && S.charge >= 1) {
      banner('MAX CHARGE', '指をはなして発射');
      Sound.blip(2640); buzz([20, 40, 20]);
      S.glitch = 0.3;
    }
  } else if (S.charge > 0) S.charge = Math.max(0, S.charge - dt * 3);

  // 群：粒の大群が画面を横切る
  if (S.swarmT > 0) {
    S.swarmT -= dt;
    const hw = W / 2 * L.u * 1.25, hh = (L.bot - L.top) / 2 * L.u;
    const n = Math.floor((reduced ? 80 : 420) * dt + Math.random());
    for (let i = 0; i < n; i++) {
      emit(-hw * S.swarmDir, rand(-hh, hh), rand(-1.5, 2.5), S.swarmDir * rand(10, 16), rand(-0.6, 0.6), 0, 2.2, rand(0.05, 0.11), Math.random() < 0.35 ? WHITE : accent, 0, 0.05);
    }
  }

  const od = S.mode === 'overdrive';
  if (od && !reduced) {
    const n = Math.floor(160 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      randDir(tmpA);
      const s = rand(2, 7);
      emit(tmpA.x * 0.6, tmpA.y * 0.6, tmpA.z * 0.6, tmpA.x * s, tmpA.y * s, tmpA.z * s, rand(0.5, 1.1), rand(0.04, 0.1), Math.random() < 0.4 ? WHITE : accent, 0, 1.2);
    }
    S.shake = Math.max(S.shake, 0.012);
  }
  if ((S.mode === 'overdrive') && T > S.modeEnd) endMode(false);

  // 迎撃戦
  if (S.mode === 'defense') {
    D.t += dt;
    D.spawnT -= dt;
    if (D.spawnT <= 0 && D.t < D.dur - 1.5) {
      spawnDrone();
      if (D.t > 8 && Math.random() < 0.4) spawnDrone();
      if (D.t > 16 && Math.random() < 0.4) spawnDrone();
      D.spawnT = Math.max(0.35, 1.0 - D.t * 0.025);
    }
    D.autoT -= dt;
    if (D.autoT <= 0) {
      D.autoT = rand(0.9, 1.5);
      let near = null, nd = 1e9;
      for (const d of drones) if (d.alive && d.g.position.length() < nd) { nd = d.g.position.length(); near = d; }
      if (near) locks.push({ drone: near, t: 0, fired: false, id: 'AUTO', x: 0, y: 0 });
    }
    for (const d of drones) {
      if (!d.alive) continue;
      d.t += dt;
      const p = d.g.position;
      tmpA.copy(p).negate().normalize();
      tmpB.set(-tmpA.y, tmpA.x, 0).multiplyScalar(Math.sin(d.t * 2.2 + d.seed) * 2.2);
      tmpA.multiplyScalar(d.speed).add(tmpB);
      d.vel.lerp(tmpA, Math.min(1, dt * 2));
      p.addScaledVector(d.vel, dt);
      d.g.rotation.x += dt * 2; d.g.rotation.y += dt * 3;
      if (p.length() < 3.5) {
        killDrone(d, false);
        S.shield = Math.max(0, S.shield - 0.04);
        S.shieldFlash = 1;
        S.shake = Math.max(S.shake, 0.12);
        S.glitch = 0.35; S.aberr = 0.015;
        Sound.shield();
        buzz(60);
        if (Math.random() < 0.35) say(pick(LINES.defHit));
      }
    }
    mKills.textContent = pad(D.kills);
    mShield.textContent = Math.round(S.shield * 100);
    mTime.style.width = clamp(1 - D.t / D.dur) * 100 + '%';
    if (D.t > D.dur) endMode(false);
  }
  S.shieldFlash = Math.max(0, S.shieldFlash - dt * 2.5);
  shieldMat.opacity = (S.mode === 'defense' ? 0.05 : 0) + S.shieldFlash * 0.6;
  shieldMesh.rotation.y += dt * 0.1;

  // 数値
  const pGoal = od ? 3 : S.mode === 'defense' ? 1.08 : 0.968 + Math.sin(T * 0.7) * 0.012;
  S.power += (pGoal - S.power) * Math.min(1, dt * 2.5);
  S.energy = Math.max(0, S.energy - dt * 0.8);
  const talking = performance.now() < talkUntil;
  const tgt = talking ? (0.35 + 0.65 * Math.abs(Math.sin(T * 17) * Math.sin(T * 5.3 + 1.7))) * rand(0.7, 1) : 0;
  S.talk += (tgt - S.talk) * Math.min(1, dt * 18);
  if (talking !== talkingShown) { talkingShown = talking; voiceBar.classList.toggle('talking', talking); }

  // 演出の減衰
  S.shake *= Math.exp(-dt * 6);
  S.kick *= Math.exp(-dt * 4);
  S.flash *= Math.exp(-dt * 4.5);
  S.aberr *= Math.exp(-dt * 3);
  S.glitch *= Math.exp(-dt * 5);
  S.bloomBoost *= Math.exp(-dt * 2.2);
  if (S.shock.amp > 0.001) { S.shock.r += dt * 0.95; S.shock.amp *= Math.exp(-dt * 1.6); if (S.shock.r > 1.8) S.shock.amp = 0; }

  stepParticles(dt);
  stepWaves(dt);
  stepBeams(dt);

  // パネルの中身
  if (S.phase === 'awake' || S.phase === 'booting') {
    hexAcc += dt; teleAcc += dt; barAcc += dt;
    if (hexAcc > (od ? 0.04 : 0.12)) { hexAcc = 0; pushHex(); }
    if (teleAcc > 0.07) { teleAcc = 0; pushTele(); }
    if (barAcc > 0.5) {
      barAcc = 0;
      V.pow = Math.min(3, S.power);
      V.shd = S.mode === 'defense' ? S.shield : S.mode === 'alert' ? rand(0.6, 1) : 1;
      V.neu = clamp(V.neu + rand(-0.04, 0.04) + (0.85 - V.neu) * 0.2 + S.talk * 0.05, 0.6, 0.99);
      V.tmp = 36.5 + S.energy * 18 + S.charge * 30 + (od ? 62 : 0) + rand(-0.2, 0.2);
      V.code = hex(3);
      const d = new Date();
      clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  }
  for (const p of panels) p.update(dt);
}

/* ── 3D の見た目を状態に合わせる ───── */
function pose(dt) {
  const od = S.mode === 'overdrive', form = S.form, globe = easeOut(S.globe);
  const spinMul = 1 + Math.abs(rot.vy) * 0.5 + (od ? 2.2 : 0) + form * 0.6 + S.charge * 1.5;
  S.ringTime += dt * spinMul;
  const heat = clamp(0.25 + S.energy * 0.5 + S.charge * 0.7 + S.talk * 0.2 + (od ? 0.4 : 0));

  const asmNow = (performance.now() - S.asmStart) / 1000;
  rings.forEach((r, i) => {
    // 組み立て：外側のリングから順に、カメラの手前から飛んできてはまる
    let asmK = 0, asmO = 1, rv = clamp((S.reveal * 1.5 - i * 0.07) / 0.5);
    if (S.assembling) {
      const a = clamp((asmNow - i * 0.22) / 0.65);
      rv = a > 0 ? 1 : 0;
      asmK = 1 - easeBack(a);
      asmO = Math.min(1, a * 4);
      if (a >= 1 && !r.landed) {
        r.landed = true;
        Sound.clank(0, rand(-0.3, 0.3));
        S.kick = Math.max(S.kick, 0.25); S.flash = Math.max(S.flash, 0.06); S.glitch = Math.max(S.glitch, 0.15);
        ringWave(4, 0.5, r.r * 0.98);
      }
    } else if (S.phase === 'booting' && rv > 0 && !r.shown) { r.shown = true; Sound.glitch(); }
    r.mat.uniforms.uReveal.value = rv;
    r.mesh.visible = rv > 0;
    r.angle += r.spin * dt * spinMul;
    r.mesh.rotation.z = r.angle;
    r.mat.uniforms.uSweep.value += dt * (0.8 + i * 0.15) * (od ? 2.5 : 1);
    const ub = r.mat.uniforms.uBoost;
    ub.value = Math.max(S.charge * 0.8 + S.energy * 0.3 + (od ? 0.4 : 0), ub.value - dt * 1.5);
    r.mat.uniforms.uOpacity.value = r.op * (1 - globe * 0.55) * asmO;
    // 変形：順番にずれて、少し行き過ぎてから止まる
    const raw = clamp(form * 1.8 - i * 0.12);
    const f = easeBack(raw);
    const target = S.formGoal ? 1 : 0;
    if (r.locked !== target + 1 && ((target === 1 && raw >= 1) || (target === 0 && raw <= 0))) {
      if (r.locked === -1 && S.phase === 'awake') { Sound.clank(0, rand(-0.4, 0.4)); S.kick = Math.max(S.kick, 0.18); ringWave(3, 0.4, r.r * 0.95); }
      r.locked = target + 1;
    }
    r.pivot.quaternion.slerpQuaternions(Q0, r.qBattle, clamp(f, 0, 1.1));
    if (form > 0.001) r.pivot.rotateOnAxis(r.axis, S.ringTime * 0.25 * f);
    r.pivot.position.z = lerp(r.z, 0, clamp(f)) + asmK * 9;
    r.pivot.scale.setScalar((1 + f * 0.1 + globe * 0.35) * (1 + asmK * 1.6));
    if (asmK) r.mesh.rotation.z += asmK * 4 * (i % 2 ? 1 : -1);
  });

  const orbScale = easeOut(clamp(S.reveal * 1.6 - 0.35)) * (1 - globe);
  orb.scale.setScalar(Math.max(0.001, orbScale * (1 + S.energy * 0.12 + S.charge * 0.35 + S.talk * 0.06 + form * 0.1)));
  orb.visible = orbScale > 0.002;
  orbMat.uniforms.uTime.value += dt * (1 + S.charge * 3 + (od ? 2 : 0));
  orbMat.uniforms.uAmp.value = 0.06 + S.charge * 0.18 + S.talk * 0.05 + (od ? 0.1 : 0) + form * 0.05;
  orbMat.uniforms.uIntensity.value = 0.7 + heat * 0.6;
  heart.scale.setScalar(Math.max(0.001, orbScale * (1 + Math.sin(T * 2.2) * 0.06 + S.charge * 0.8 + S.energy * 0.4)));

  const shellV = clamp(S.reveal * 2 - 0.8) * (1 - globe);
  shell.visible = shell2.visible = shellV > 0.01;
  shellMat.opacity = 0.45 * shellV; shell2Mat.opacity = 0.22 * shellV; nodeMat.opacity = shellV;
  shell.rotation.x += dt * 0.21 * spinMul; shell.rotation.y += dt * 0.33 * spinMul;
  shell2.rotation.y -= dt * 0.17 * spinMul; shell2.rotation.z += dt * 0.11 * spinMul;
  shell.scale.setScalar(1 + form * 0.4 + S.charge * 0.15);
  shell2.scale.setScalar(1 + form * 0.8);

  gyros.forEach((gy, i) => {
    gy.g.visible = shellV > 0.01;
    gy.m.opacity = (0.35 + form * 0.5) * shellV;
    gy.torus.rotation.z += dt * gy.sp * spinMul * 1.5;
    gy.g.rotateOnAxis(gy.axis, dt * (0.25 + form * 0.6));
    gy.g.scale.setScalar(1 + form * (0.35 + i * 0.12));
  });

  orbitMat.uniforms.uTime.value = S.ringTime;
  orbitMat.uniforms.uOpacity.value = clamp(S.reveal * 1.5 - 0.5) * (1 - globe * 0.5);

  const rayO = clamp(S.reveal * 2 - 1) * (0.05 + S.energy * 0.25 + S.charge * 0.5 + (od ? 0.25 : 0) + form * 0.08);
  rayMats.forEach((m, i) => { m.opacity = rayO * (0.6 + 0.4 * Math.sin(T * 3 + i * 1.7)); });
  rays.rotation.z += dt * 0.08 * spinMul;
  rays.visible = rayO > 0.003;

  spikes.scale.setScalar(Math.max(0.001, easeBack(clamp(form * 1.4 - 0.4))));
  spikes.visible = form > 0.01;
  spikes.rotation.z -= dt * 0.15 * spinMul;

  S.bolts = Math.max(od ? 0.9 : 0, S.charge, form * 0.35 * (Math.random() < 0.08 ? 1 : 0));
  boltAcc += dt;
  if (S.bolts > 0.02 && boltAcc > 0.05) { boltAcc = 0; regenBolts(1.2 + S.bolts * 1.8); }
  boltMat.opacity = S.bolts > 0.02 ? S.bolts * (Math.random() < 0.3 ? 0.35 : 1) : 0;
  bolts.visible = boltMat.opacity > 0.01;

  const fv = clamp(S.reveal * 1.5 - 0.3) * (1 - globe * 0.6);
  flare.material.opacity = fv * (0.32 + heat * 0.35 + S.flash * 0.5);
  flare.scale.setScalar(2.6 + heat * 1.2 + S.charge * 2.5 + S.flash * 3);
  streak.material.opacity = fv * (0.35 + heat * 0.45 + S.charge * 0.5) * (0.85 + Math.random() * 0.15);
  streak.scale.set(11 + heat * 6 + S.charge * 8, 0.3 + S.charge * 0.25, 1);
  flare.visible = streak.visible = fv > 0.003;

  bigEarth.setOpacity(globe);
  bigEarth.setScale(1.75 * (0.6 + 0.4 * globe));
  if (globe > 0.003) bigEarth.update(dt);
  const se = L.sideEarth ? easeOut(panelRadar.rev) : 0;
  sideEarth.setOpacity(se);
  if (se > 0.003) { sideEarth.update(dt); sideEarth.grp.rotation.y = -0.4; }

  standby.visible = S.standby > 0.003;
  if (standby.visible) {
    const pulse = 0.5 + 0.5 * Math.sin(T * 2.2);
    sbMat.opacity = (0.25 + 0.35 * pulse) * S.standby;
    sbArcMat.opacity = 0.9 * S.standby;
    sbGhostMat.opacity = 0.07 * S.standby;
    sbArcs.rotation.z = -T * 0.5;
    standby.scale.setScalar(S.phase === 'booting' ? Math.max(0.001, S.standby) : 0.7 + 0.3 * easeOut(S.standby));
  }

  const tv = easeOut(S.table);
  table.visible = tv > 0.003;
  plateMat.opacity = 0.5 * tv;
  emitterMat.opacity = (0.6 + 0.3 * Math.sin(T * 4)) * tv;
  coneMat.uniforms.uOpacity.value = tv * (0.8 + heat * 0.4) * (1 + (Math.random() < 0.04 ? -0.4 : 0));
  plate.rotation.z += dt * 0.05;
  grid.material.opacity = 0.09 * (0.3 + 0.7 * tv);

  dust.rotation.y = T * 0.008;
  dust.position.z = (T * 0.25) % 6;
  dustMat.opacity = 0.35 + 0.25 * tv;

  // カメラ
  const dist = camDist * zoom * (1 / S.dolly) * (1 - S.kick * 0.06) * (1 - S.charge * 0.08) * (1 - S.zoomFx * 0.22);
  const sh = S.shake * (reduced ? 0.2 : 1);
  camera.position.set(Math.sin(T * 0.11) * 0.35 + mouse.x * 0.5 + rand(-sh, sh), Math.sin(T * 0.14) * 0.22 - mouse.y * 0.3 + rand(-sh, sh), dist);
  camera.lookAt(0, 0, 0);
  camera.fov = FOV * (1 - S.kick * 0.05);
  camera.updateProjectionMatrix();

  bloom.strength = 0.9 + S.bloomBoost * 0.8 + (od ? 0.15 : 0) + S.charge * 0.5 + form * 0.1;
  FU.uTime.value = T;
  FU.uAberr.value = S.aberr * 0.5 + S.charge * 0.004 + (od ? 0.002 : 0);
  FU.uFlash.value = S.flash;
  FU.uGlitch.value = S.glitch;
  FU.uCollapse.value = S.collapse > 0.002 ? S.collapse : 0;
  FU.uShockR.value = S.shock.r;
  FU.uShockAmp.value = S.shock.amp;
  FU.uDim.value = S.dim;
  FU.uSpot.value.set(coreS.x / W, 1 - coreS.y / H);
}

/* ── 2D の重ね描き（照準、スキャン、数値） ── */
function drawUI(dt) {
  ux.clearRect(0, 0, W, H);
  coreS = toScreen(ORIGIN);
  if (S.phase !== 'awake') return;
  ux.globalCompositeOperation = 'lighter';
  ux.lineCap = 'butt';

  // スキャン
  const sc = S.scan;
  if (sc) {
    sc.t += dt;
    const p = sc.t / sc.dur, y = p * H;
    if (p <= 1) {
      const g = ux.createLinearGradient(0, y - 140, 0, y);
      g.addColorStop(0, ACC(0)); g.addColorStop(1, ACC(0.22));
      ux.fillStyle = g; ux.fillRect(0, y - 140, W, 140);
      ux.fillStyle = ACC(1); ux.fillRect(0, y - 1, W, 2);
      ux.fillStyle = ACC(0.6);
      for (let x = (T * 220) % 40; x < W; x += 40) ux.fillRect(x, y - 6, 1, 12);
      ux.font = '11px "Share Tech Mono", monospace'; ux.textAlign = 'left'; ux.textBaseline = 'alphabetic';
      ux.fillStyle = INK(0.9); ux.fillText(`SCANNING  ${Math.round(p * 100)}%`, 18, y - 10);
    }
    for (const tg of sc.targets) {
      if (!tg.seen && y >= tg.y) { tg.seen = sc.t; Sound.detect(); }
      if (!tg.seen) continue;
      const age = sc.t - tg.seen, k = easeOut(age / 0.22), fade = clamp((sc.dur + 3 - sc.t) / 0.6);
      const s = tg.s * (1.8 - 0.8 * k), c = Math.max(6, s * 0.35);
      brackets(tg.x, tg.y, s, c, ACC(0.95 * fade), 1.5);
      ux.strokeStyle = ACC(0.2 * fade); ux.strokeRect(tg.x - s, tg.y - s, s * 2, s * 2);
      if (k >= 1) {
        ux.font = '11px "Share Tech Mono", monospace'; ux.textAlign = 'left';
        const tx = tg.x + s + 8 > W - 150 ? tg.x - s - 150 : tg.x + s + 8;
        ux.fillStyle = INK(0.95 * fade); ux.fillText(tg.id, tx, tg.y - 4);
        ux.fillStyle = ACC(0.8 * fade); ux.fillText(tg.info, tx, tg.y + 11);
      }
    }
    if (p > 1 && !sc.done) {
      sc.done = true;
      const n = sc.targets.length;
      say(`スキャン完了。未確認物体、${n}件。脅威レベルはゼロです。`);
      banner('SCAN COMPLETE', `${n} OBJECTS · THREAT 0`);
    }
    if (sc.t > sc.dur + 3) S.scan = null;
  }

  // 敵の囲み
  if (S.mode === 'defense') {
    ux.font = '10px "Share Tech Mono", monospace'; ux.textAlign = 'left';
    for (const d of drones) {
      if (!d.alive) continue;
      const s = toScreen(d.g.position);
      if (s.z > 1) continue;
      const size = clamp(900 / (camera.position.z - d.g.position.z), 10, 40);
      brackets(s.x, s.y, size, size * 0.4, 'rgba(255,60,90,0.95)', 1.4);
      ux.fillStyle = 'rgba(255,90,110,0.9)';
      ux.fillText(`HOSTILE ${d.g.position.length().toFixed(0)}m`, s.x + size + 5, s.y - size + 8);
    }
  }

  // 照準（タップ）と自動照準
  for (let i = locks.length - 1; i >= 0; i--) {
    const Lk = locks[i];
    Lk.t += dt;
    if (Lk.drone) {
      if (!Lk.drone.alive && !Lk.fired) { locks.splice(i, 1); continue; }
      const s = toScreen(Lk.drone.g.position);
      Lk.x = s.x; Lk.y = s.y;
    }
    if (!Lk.fired && Lk.t >= 0.24) {
      Lk.fired = true;
      if (Lk.drone) { shoot(Lk.drone.g.position, true); killDrone(Lk.drone, false); }
      else { toWorld(Lk.x, Lk.y, aimV); shoot(aimV, false); }
    }
    if (Lk.t > 1.4) { locks.splice(i, 1); continue; }
    const k = easeOut(Lk.t / 0.24), fade = Lk.t > 1 ? 1 - (Lk.t - 1) / 0.4 : 1;
    const s = 64 - 42 * k;
    brackets(Lk.x, Lk.y, s, 10, ACC(0.95 * fade), 1.6);
    if (k < 1) continue;
    ux.save();
    ux.translate(Lk.x, Lk.y); ux.rotate(Lk.t * 3);
    ux.strokeStyle = ACC(0.8 * fade); ux.setLineDash([4, 4]); ux.lineWidth = 1;
    ux.beginPath(); ux.arc(0, 0, 14, 0, TAU); ux.stroke();
    ux.setLineDash([]);
    ux.restore();
    const dx = Lk.x > W - 170 ? -1 : 1, dy = Lk.y < 90 ? 1 : -1, ex = Lk.x + dx * 40, ey = Lk.y + dy * 40;
    ux.strokeStyle = ACC(0.7 * fade); ux.lineWidth = 1;
    ux.beginPath(); ux.moveTo(Lk.x + dx * 24, Lk.y + dy * 24); ux.lineTo(ex, ey); ux.lineTo(ex + dx * 86, ey); ux.stroke();
    ux.font = '11px "Share Tech Mono", monospace'; ux.textAlign = dx > 0 ? 'left' : 'right';
    ux.fillStyle = INK(fade); ux.fillText(Lk.drone ? 'AUTO LOCK' : `LOCKED ${Lk.id}`, ex + dx * 2, ey - 6);
    ux.fillStyle = ACC(0.8 * fade); ux.fillText(Lk.drone ? 'VEGA TURRET' : 'FIRE', ex + dx * 2, ey + 14);
  }

  // チャージ量
  if (S.charging || S.charge > 0.02) {
    ux.textAlign = 'center'; ux.textBaseline = 'middle';
    ux.font = '700 ' + Math.round(clamp(L.Rpx * 0.16, 18, 34)) + 'px "Chakra Petch", sans-serif';
    ux.fillStyle = INK(0.95);
    ux.shadowColor = ACC(1); ux.shadowBlur = 16;
    ux.fillText(`${Math.round(S.charge * 100)}%`, coreS.x, coreS.y + L.Rpx * 0.55);
    ux.shadowBlur = 0;
    ux.font = '10px "Share Tech Mono", monospace'; ux.fillStyle = ACC(0.9);
    ux.fillText(S.charge >= 1 ? 'RELEASE TO FIRE' : 'CHARGING', coreS.x, coreS.y + L.Rpx * 0.55 + 24);
    ux.textBaseline = 'alphabetic';
  }

  // コアの数値
  const rpm = 0.6 * (S.mode === 'overdrive' ? 3 : 1) + Math.abs(rot.vy) / TAU * 60;
  const rows = [['CORE OUTPUT', (S.power * 100).toFixed(1) + '%'], ['ROTATION', rpm.toFixed(1) + ' RPM'], ['SYNC RATE', (99.2 + Math.sin(T * 0.9) * 0.7).toFixed(1) + '%']];
  const R = L.Rpx, side = L.portrait ? 0 : clamp((W - 32) * 0.2, 0, 300), reach = R * 1.08 + 140;
  if (!L.portrait && coreS.x + reach < W - side - 24) {
    callout(-0.62, rows[0], 1); callout(0.7, rows[1], 1); callout(Math.PI + 0.62, rows[2], -1);
  } else {
    ux.font = '11px "Share Tech Mono", monospace'; ux.textAlign = 'center'; ux.textBaseline = 'middle';
    ux.fillStyle = INK(0.8);
    ux.fillText(`OUT ${rows[0][1]}   ·   ${rows[1][1]}   ·   SYNC ${rows[2][1]}`, coreS.x, Math.min(L.bot - 30, coreS.y + R * 1.0));
    ux.textBaseline = 'alphabetic';
  }

  // ドラッグ中の指カーソル
  if (drag.id !== null && drag.moved && !S.charging) {
    ux.save();
    ux.translate(drag.x, drag.y); ux.rotate(-T * 4);
    ux.strokeStyle = ACC(0.8); ux.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { ux.beginPath(); ux.arc(0, 0, 26, i * TAU / 3, i * TAU / 3 + 1.2); ux.stroke(); }
    ux.restore();
  }
  ux.globalCompositeOperation = 'source-over';
}
function brackets(x, y, s, c, color, lw) {
  ux.strokeStyle = color; ux.lineWidth = lw;
  ux.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bx = x + sx * s, by = y + sy * s;
    ux.moveTo(bx - sx * c, by); ux.lineTo(bx, by); ux.lineTo(bx, by - sy * c);
  }
  ux.stroke();
}
function callout(ang, [label, value], dir) {
  const R = L.Rpx;
  const x0 = coreS.x + Math.cos(ang) * R * 0.94, y0 = coreS.y + Math.sin(ang) * R * 0.94;
  const x1 = coreS.x + Math.cos(ang) * R * 1.08, y1 = coreS.y + Math.sin(ang) * R * 1.08;
  const x2 = x1 + dir * 130;
  ux.strokeStyle = ACC(0.6); ux.lineWidth = 1;
  ux.beginPath(); ux.moveTo(x0, y0); ux.lineTo(x1, y1); ux.lineTo(x2, y1); ux.stroke();
  ux.fillStyle = ACC(1); ux.fillRect(x0 - 2, y0 - 2, 4, 4);
  ux.textAlign = dir > 0 ? 'right' : 'left'; ux.textBaseline = 'alphabetic';
  ux.font = '10px "Share Tech Mono", monospace'; ux.fillStyle = ACC(0.8); ux.fillText(label, x2, y1 - 7);
  ux.font = '500 18px "Chakra Petch", sans-serif'; ux.fillStyle = INK(0.95); ux.fillText(value, x2, y1 + 20);
}

/* ── ループ ────────────────────────── */
let last = performance.now(), slowFrames = 0, frames = 0;
function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  let dt = real;
  if (S.freeze > 0) { S.freeze -= real; dt = 0; }
  S.timeScale += (S.slowGoal - S.timeScale) * Math.min(1, real * 4);
  dt *= S.timeScale;
  S.dim += (S.dimGoal - S.dim) * Math.min(1, real * 3);
  S.zoomFx += (S.zoomGoal - S.zoomFx) * Math.min(1, real * 2);
  T += dt;
  update(dt, real);
  pose(dt);
  composer.render(real);
  drawUI(dt);
  // 重いときは解像度を下げる
  frames++;
  if (real > 0.03) slowFrames++;
  if (frames >= 90) {
    if (slowFrames > 45 && PR > 1) { PR = Math.max(1, PR - 0.25); layout(); }
    frames = 0; slowFrames = 0;
  }
  requestAnimationFrame(frame);
}

/* ── くだらない機能（fun.js）から演出を呼ぶ窓口 ── */
function visibleBox() { return { hw: W / 2 * L.u, top: (L.cy - L.top) * L.u }; }
const fx = {
  flash(v) { S.flash = Math.max(S.flash, v); },
  kick(v) { S.kick = Math.max(S.kick, v); },
  shake(v) { S.shake = Math.max(S.shake, v); },
  glitch(v) { S.glitch = Math.max(S.glitch, v); },
  aberr(v) { S.aberr = Math.max(S.aberr, v); },
  bloom(v) { S.bloomBoost = Math.max(S.bloomBoost, v); },
  spin(v) { rot.vy += v; },
  zoom(v) { S.zoomGoal = v; },
  dim(v) { S.dimGoal = v; },
  slow(k) { S.slowGoal = k; },
  freeze(sec) { S.freeze = Math.max(S.freeze, sec); },
  rainbow(sec) { S.rainbow = Math.max(S.rainbow, sec); },
  collapse(on) { S.collapseGoal = on ? 1 : 0; },
  setAccent(name) { if (PAL[name]) accentGoal = PAL[name]; },
  restoreAccent() { accentGoal = modeColor(); },
  shock(amp) { shockScreen(amp); },
  ring(v, life, r0) { ringWave(v, life, r0); },
  sphere(v, life) { sphereWave(v, life); },
  burst(n, speed, white = 0.35) { burst(ORIGIN, n, speed, 1.4, 0.1, accent, white); },
  swarm(dir = Math.random() < 0.5 ? 1 : -1, sec = 1.3) { S.swarmT = sec; S.swarmDir = dir; },
  ringBoost(v) { rings.forEach((r) => { r.mat.uniforms.uBoost.value = Math.max(r.mat.uniforms.uBoost.value, v); }); },
  coins(n) {
    const b = visibleBox();
    for (let i = 0; i < n; i++) {
      emit(rand(-b.hw, b.hw), b.top + rand(0, 3), rand(-1, 2), rand(-0.6, 0.6), rand(-2, 0), 0, rand(2.4, 3.6), rand(0.09, 0.16), Math.random() < 0.75 ? PAL.gold : WHITE, 3, 0.25);
    }
  },
  fireworks(n) {
    const b = visibleBox();
    for (let k = 0; k < n; k++) later(() => {
      const c = new THREE.Color().setHSL(Math.random(), 1, 0.6);
      const x = rand(-b.hw * 0.8, b.hw * 0.8), y = rand(b.top * 0.1, b.top * 0.85), z = rand(-2, 1);
      for (let i = 0; i < (reduced ? 30 : 110); i++) {
        randDir(tmpA);
        const s = rand(2.5, 5);
        emit(x, y, z, tmpA.x * s, tmpA.y * s, tmpA.z * s, rand(1, 1.6), rand(0.05, 0.09), Math.random() < 0.25 ? WHITE : c, 3, 1.3);
      }
      flashAt(tmpB.set(x, y, z), 2, c, 0.35);
      Sound.firework();
    }, k * rand(180, 320));
  },
  popcorn(n) {
    for (let i = 0; i < n; i++) later(() => {
      randDir(tmpA);
      const px = tmpA.x * 0.7, py = tmpA.y * 0.7, pz = tmpA.z * 0.7;
      for (let j = 0; j < 8; j++) emit(px, py, pz, tmpA.x * 2 + rand(-1, 1), Math.abs(tmpA.y) * 2 + rand(2, 4), tmpA.z * 2, rand(1.2, 1.8), rand(0.1, 0.18), WHITE, 3, 0.8);
      Sound.pop();
    }, i * rand(60, 140));
  },
};
// 起動演出（boot.js）から呼ぶ段取り
const bootApi = {
  begin() {
    Sound.init(); Voice.unlock();
    S.phase = 'booting'; S.touched = false;
    body.classList.remove('touched'); body.classList.add('booting');
    S.tableOn = false; S.assembling = false; S.revealGoal = 0; S.reveal = 0; S.dolly = 0.42;
    rot.yaw = 0; rot.vy = 0;
    rings.forEach((r) => { r.shown = false; r.landed = false; });
  },
  assemble() {
    S.tableOn = true; S.assembling = true; S.asmStart = performance.now();
    rings.forEach((r) => { r.landed = false; });
  },
  ignite() { ignite(true); },
  greet() {
    say(greeting());
    later(() => { if (S.phase === 'awake' && !S.touched) say(LINES.hint); }, 9000);
  },
};
window.VEGA = {
  S, say, banner, Sound, Music, Voice, fx, boot: bootApi,
  talking: () => performance.now() < talkUntil,
  isIdle: () => S.phase === 'awake' && S.mode === 'normal' && !S.charging && !S.scan
    && performance.now() > talkUntil && performance.now() - S.lastInput > 5000,
  core: () => coreS,
};

layout();
S.phase = 'standby';
body.classList.add('ready');
window.dispatchEvent(new Event('vega-ready'));
requestAnimationFrame(frame);
}
})();
