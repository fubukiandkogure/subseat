// VEGA の起動演出：ブラウン管が点き、ターミナルで起動ログ、生体認証、発射前チェック、
// カウントダウンのあと、扉が割れてホログラムが組み上がり、タイトルが落ちてくる。ターミナルの間はタップで飛ばせる
(() => {
'use strict';

const rand = (a, b) => a + Math.random() * (b - a);
const irand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[irand(arr.length)];
const hex = (n) => Array.from({ length: n }, () => '0123456789ABCDEF'[irand(16)]).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const body = document.body;
const SKIP = { skip: true };
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// 7段のドット文字（# が光る）
const FONT = {
  V: ['#     #', '#     #', '#     #', ' #   # ', ' #   # ', '  # #  ', '   #   '],
  E: ['#######', '#      ', '#      ', '#####  ', '#      ', '#      ', '#######'],
  G: [' ##### ', '#     #', '#      ', '#  ####', '#     #', '#     #', ' ##### '],
  A: ['  ###  ', ' #   # ', '#     #', '#     #', '#######', '#     #', '#     #'],
};
const LOGO = FONT.V.map((_, r) => ['V', 'E', 'G', 'A'].map((c) => FONT[c][r]).join('  '));

const KERNEL = [
  ['0.000000', 'VEGA kernel 8.0.0-holo (boss@vega-labs) #1 SMP PREEMPT'],
  ['0.000412', 'quantum-core: 256 qubits online, decoherence 0.0001%'],
  ['0.001337', 'holo0: projector array detected (7 emitters)'],
  ['0.002048', 'neural-mesh: loading 4.8 PB synaptic weights'],
  ['0.004096', 'arc-lattice: energy containment field ', 'STABLE', 'ok'],
  ['0.008192', 'sat-link: 12/12 satellites ', 'LOCKED', 'ok'],
  ['0.016384', 'defense-grid: armed (safety: ON)'],
  ['0.032768', 'humor-module: sarcasm level set to 78%'],
  ['0.065536', 'snack-monitor: reserves ', 'LOW', 'warn'],
  ['0.131072', 'voice: ja-JP synthesizer ready'],
  ['0.262144', 'mounting /dev/holo0 on /core ... ', 'done', 'ok'],
  ['0.524288', 'starting vega-daemon ... ', 'done', 'ok'],
];
const MODULES = ['photon_bus', 'lattice_ctl', 'gyro_sync', 'flux_cap', 'iris_scan', 'qnet', 'holo_render', 'arc_reg', 'sat_uplink', 'boss_detect', 'pun_engine', 'shield_drv'];
const CHECKS = [
  ['PRIMARY POWER', 'GO'], ['QUANTUM CORE', 'GO'], ['HOLO EMITTERS', 'GO'], ['NEURAL MESH', 'GO'],
  ['SAT LINK', 'GO'], ['DEFENSE GRID', 'GO'], ['VOICE MODULE', 'GO'], ['HUMOR MODULE', 'GO'],
  ['SNACK RESERVES', 'LOW / GO ANYWAY', 'warn'], ['BOSS', 'READY'],
];
const SPECS = [
  ['OS', 'VEGA OS 8.0 "Polaris"'], ['KERNEL', '8.0.0-holo'], ['CPU', 'QUANTUM CORE x256 @ 9.81 PHz'],
  ['MEMORY', '4.8 PB'], ['DISPLAY', 'HOLOGRAPHIC 7-LAYER'], ['UPTIME', '0 sec'], ['HUMOR', '78%'], ['SNACKS', 'LOW'],
];

function setup() {
const V = window.VEGA;
const { S, Sound, Music, fx, say, boot } = V;

/* ── 画面の部品 ─────────────────────── */
const term = el('div', 'term', `
  <div class="t-door t-top"><span>VEGA LABS // BLAST DOOR 07</span></div>
  <div class="t-door t-bot"><span>AUTHORIZED PERSONNEL ONLY</span></div>
  <div class="t-screen"><div class="t-log"></div><canvas class="t-scan"></canvas><div class="t-big"></div></div>
  <div class="t-seam"></div>
  <div class="t-crt"></div>
  <div class="t-skip">TAP TO SKIP ▸▸</div>`);
const title = el('div', 'vtitle', '<div class="vt-letters"><span style="--i:0">V</span><span style="--i:1">E</span><span style="--i:2">G</span><span style="--i:3">A</span></div><div class="vt-sub"></div>');
const sweep = el('div', 'fsweep');
body.append(term, title, sweep);
const log = term.querySelector('.t-log'), big = term.querySelector('.t-big'), scanCv = term.querySelector('.t-scan'), screen = term.querySelector('.t-screen');

let gen = 0, running = false, inTerminal = false;

/* ── ターミナルに書く ───────────────── */
function line(parts = [], cls = '') {
  const d = el('div', 't-line ' + cls);
  for (const p of [].concat(parts)) {
    if (typeof p === 'string') d.append(p);
    else { const s = el('span', p[1] || ''); s.textContent = p[0]; d.append(s); }
  }
  log.append(d);
  while (log.children.length > 140) log.firstChild.remove();
  return d;
}
const cursor = () => el('span', 't-cursor');
function bigText(main, sub, cls = '') {
  big.className = 't-big';
  big.innerHTML = '';
  big.append(main);
  if (sub) { const s = el('small'); s.textContent = sub; big.append(s); }
  void big.offsetWidth;
  big.className = 't-big show ' + cls;
}
function shake() { term.classList.remove('shake'); void term.offsetWidth; term.classList.add('shake'); }

/* ── 各場面 ─────────────────────────── */
async function bios(w) {
  Sound.droneSet(0.1);
  line([['VEGA LABS (R) HOLOGRAPHIC BIOS v8.00', 'hi']]);
  line([['Copyright (C) 2026 VEGA LABS. All rights reserved.', 'dim']]);
  line(' ');
  await w(260);
  line(['CPU      : QUANTUM CORE x256 @ 9.81 PHz']); Sound.key();
  await w(120);
  const num = el('span', 'hi');
  const mem = line(['MEMORY   : ']);
  mem.append(num, ' KB ');
  const t0 = performance.now();
  while (true) {
    const p = Math.min(1, (performance.now() - t0) / 800);
    num.textContent = Math.floor(4800000000 * p * p).toLocaleString('en-US');
    if (Math.random() < 0.5) Sound.key();
    if (p >= 1) break;
    await w(30);
  }
  const ok = el('span', 'ok'); ok.textContent = 'OK'; mem.append(ok);
  await w(120);
  line(['HOLO     : 7 EMITTERS DETECTED']); Sound.disk();
  await w(100);
  line(['NEURAL   : 4.8 PB SYNAPTIC MESH']); Sound.disk();
  await w(140);
  const bar = line(['LOADING CORE IMAGE ']);
  const b = el('span', 'hi'); bar.append(b);
  for (let i = 0; i <= 24; i++) {
    b.textContent = `[${'#'.repeat(i)}${'.'.repeat(24 - i)}] ${String(Math.round(i / 24 * 100)).padStart(3)}%`;
    if (i % 3 === 0) Sound.disk();
    await w(28);
  }
  line(' ');
}
async function kernel(w) {
  Sound.droneSet(0.25);
  const lines = KERNEL.slice();
  for (let i = 0; i < 12; i++) lines.splice(1 + irand(lines.length - 1), 0, [(0.0001 * (i + 1) * rand(1, 9)).toFixed(6), `loading module ${pick(MODULES)}.ko @ 0x${hex(8)} ... `, '[ OK ]', 'ok']);
  for (const [t, msg, tail, cls] of lines) {
    const parts = [[`[${t.padStart(12)}] `, 'dim'], msg];
    if (tail) parts.push([tail, cls]);
    line(parts);
    if (Math.random() < 0.6) Sound.key();
    await w(rand(28, 52));
  }
  line(' ');
}
async function logo(w) {
  Sound.droneSet(0.35);
  const box = el('div', 't-ascii');
  const cols = LOGO[0].length;
  box.style.setProperty('--cols', cols);
  const cells = [];
  for (const row of LOGO) for (const ch of row) { const c = el('i', ch === '#' ? 'on' : ''); box.append(c); cells.push(c); }
  log.append(box);
  for (let r = 0; r < LOGO.length; r++) {
    for (let c = 0; c < cols; c++) cells[r * cols + c].classList.add('lit');
    Sound.go(r);
    await w(75);
  }
  line([['VIRTUAL ENGAGEMENT & GUARDIAN ASSISTANT', 'hi']], 'center');
  await w(300);
  line(' ');
  for (const [k, v] of SPECS) { line([[k.padEnd(9), 'acc'], v]); Sound.key(); await w(45); }
  line(' ');
}
async function typeInto(node, text, ms, sound = true) {
  for (const ch of text) { node.textContent += ch; if (sound) Sound.key(); await ms(); }
}
async function command(w) {
  Sound.droneSet(0.45);
  const l = line([['boss@vega-labs', 'ok'], ':', ['~', 'acc'], '$ ']);
  const t = el('span', 'hi'); l.append(t, cursor());
  await w(350);
  await typeInto(t, './awaken --core=vega --mode=hero', () => w(rand(22, 48)));
  await w(260);
  Sound.enter();
  l.querySelector('.t-cursor').remove();
  const p = line(['PASSPHRASE: ']);
  const s = el('span', 'hi'); p.append(s, cursor());
  await w(200);
  await typeInto(s, '********', () => w(rand(50, 90)));
  Sound.enter();
  p.querySelector('.t-cursor').remove();
  const a = line(['AUTHENTICATING ']);
  const spin = el('span', 'hi'); a.append(spin);
  for (let i = 0; i < 14; i++) { spin.textContent = '|/-\\'[i % 4]; await w(55); }
  spin.textContent = 'OK';
  spin.className = 'ok';
  line([['BIOMETRIC VERIFICATION REQUIRED', 'warn']]);
  Sound.error();
  await w(300);
}
async function scan(w) {
  Sound.droneSet(0.6);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(Math.min(innerWidth, innerHeight) * 0.62);
  scanCv.width = scanCv.height = size * dpr;
  scanCv.style.width = scanCv.style.height = size + 'px';
  const g = scanCv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  scanCv.classList.add('on');
  screen.classList.add('dimlog');
  line([['RETINA SCAN INITIATED', 'hi']]);
  const dur = 1700, t0 = performance.now();
  let done = false, okAt = 0;
  Sound.scanSweep(dur / 1000);
  (function draw() {
    if (!scanCv.classList.contains('on')) return;
    const t = (performance.now() - t0) / 1000, p = Math.min(1, t * 1000 / dur);
    drawScan(g, size, p, t, done);
    if (!done && Math.random() < 0.3) Sound.reelTick();
    requestAnimationFrame(draw);
  })();
  await w(dur);
  done = true; okAt = performance.now();
  Sound.granted();
  fx.flash(0.2);
  line([['MATCH 99.98% — IDENTITY: BOSS — CLEARANCE: OMEGA', 'ok']]);
  await w(450);
  bigText('ACCESS GRANTED', '認証完了 · おかえりなさい、ボス', 'granted');
  say('生体認証、完了。');
  await w(1300);
  scanCv.classList.remove('on');
  screen.classList.remove('dimlog');
  big.className = 't-big';
  return okAt;
}
function drawScan(g, size, p, t, done) {
  const c = size / 2, R = size * 0.42;
  const col = done ? '109,255,176' : '92,236,255';
  const C = (a) => `rgba(${col},${a})`;
  g.clearRect(0, 0, size, size);
  g.save();
  g.translate(c, c);
  g.lineCap = 'butt';
  g.strokeStyle = C(0.35); g.lineWidth = 1;
  for (const k of [1, 0.86, 0.62]) { g.beginPath(); g.arc(0, 0, R * k, 0, Math.PI * 2); g.stroke(); }
  g.save(); g.rotate(t * 0.8);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, long = i % 6 === 0;
    g.strokeStyle = C(long ? 0.9 : 0.4); g.lineWidth = long ? 2 : 1;
    g.beginPath(); g.moveTo(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93); g.lineTo(Math.cos(a) * R * (long ? 1.0 : 0.97), Math.sin(a) * R * (long ? 1.0 : 0.97)); g.stroke();
  }
  g.restore();
  g.save(); g.rotate(-t * 1.6);
  g.strokeStyle = C(0.8); g.lineWidth = 3;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, R * 0.78, i * 2.094, i * 2.094 + 0.8); g.stroke(); }
  g.restore();
  // 進み具合の弧
  g.strokeStyle = C(1); g.lineWidth = 5; g.shadowColor = C(1); g.shadowBlur = 14;
  g.beginPath(); g.arc(0, 0, R * 1.06, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke();
  g.shadowBlur = 0;
  // 目
  const ew = R * 0.7, eh = R * 0.38;
  g.strokeStyle = C(0.9); g.lineWidth = 2;
  g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, -eh * 1.6, ew, 0); g.quadraticCurveTo(0, eh * 1.6, -ew, 0); g.stroke();
  g.save();
  g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, -eh * 1.6, ew, 0); g.quadraticCurveTo(0, eh * 1.6, -ew, 0); g.clip();
  const ir = R * 0.3;
  g.strokeStyle = C(0.85); g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, ir, 0, Math.PI * 2); g.stroke();
  g.save(); g.rotate(t * 0.4);
  g.strokeStyle = C(0.35); g.lineWidth = 1;
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * ir * 0.42, Math.sin(a) * ir * 0.42); g.lineTo(Math.cos(a) * ir * 0.98, Math.sin(a) * ir * 0.98); g.stroke(); }
  g.restore();
  g.fillStyle = C(0.9); g.beginPath(); g.arc(0, 0, ir * 0.36 * (1 + Math.sin(t * 6) * 0.06), 0, Math.PI * 2); g.fill();
  // 走査線
  if (!done) {
    const y = Math.sin(t * 5) * eh * 1.2;
    const grd = g.createLinearGradient(0, y - 30, 0, y);
    grd.addColorStop(0, C(0)); grd.addColorStop(1, C(0.45));
    g.fillStyle = grd; g.fillRect(-ew, y - 30, ew * 2, 30);
    g.fillStyle = C(1); g.fillRect(-ew, y - 1, ew * 2, 2);
  }
  g.restore();
  // 角の括弧
  const s = R * 1.2, k = R * 0.18;
  g.strokeStyle = C(0.9); g.lineWidth = 2;
  g.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(sx * s, sy * (s - k)); g.lineTo(sx * s, sy * s); g.lineTo(sx * (s - k), sy * s); }
  g.stroke();
  // 文字
  g.textAlign = 'center';
  g.fillStyle = C(1);
  g.font = `700 ${Math.round(R * 0.2)}px "Chakra Petch", sans-serif`;
  g.fillText(done ? 'MATCH' : `${Math.round(p * 100)}%`, 0, R * 0.78);
  g.font = `${Math.round(Math.max(10, R * 0.075))}px "Share Tech Mono", monospace`;
  g.fillStyle = C(0.8);
  g.fillText(done ? 'IDENTITY CONFIRMED' : 'RETINA SCAN', 0, -R * 0.66);
  g.textAlign = 'left';
  for (let i = 0; i < 5; i++) g.fillText(hex(8), R * 1.12, -R * 0.4 + i * R * 0.16);
  g.textAlign = 'right';
  for (let i = 0; i < 5; i++) g.fillText(hex(8), -R * 1.12, -R * 0.4 + i * R * 0.16);
  g.restore();
}
async function checklist(w) {
  Sound.droneSet(0.75);
  line(' ');
  line([['PRE-IGNITION CHECKLIST', 'hi']]);
  for (let i = 0; i < CHECKS.length; i++) {
    const [name, status, cls] = CHECKS[i];
    line([`  ${name} ${'.'.repeat(Math.max(2, 22 - name.length))} `, [status, cls || 'ok']]);
    Sound.go(i);
    await w(110);
  }
  line([['  ALL SYSTEMS: GO', 'ok']]);
  Sound.confirm();
  await w(450);
}
async function countdown(w) {
  Sound.droneSet(0.9);
  Sound.riser(3.1);
  for (const n of [3, 2, 1]) {
    bigText(String(n), 'IGNITION SEQUENCE');
    Sound.drum(0.7 + (3 - n) * 0.15); Sound.beep(n === 1 ? 1320 : 880);
    shake();
    line([[`T-${n}`, 'warn']]);
    await w(1000);
  }
  Sound.droneSet(1);
  bigText('IGNITION', 'コア点火', 'ignite');
  shake();
  await w(380);
}

/* ── 扉が開いて、ホログラムが組み上がる ── */
async function finale() {
  inTerminal = false;
  Sound.droneStop(0.08);
  Sound.braam();
  Sound.doors();
  fx.flash(0.15);
  term.classList.add('open');
  boot.assemble();
  await sleep(1150);
  term.classList.add('gone');
  await sleep(750);
  boot.ignite();
  sweep.classList.remove('on'); void sweep.offsetWidth; sweep.classList.add('on');
  await sleep(380);
  // タイトルが1文字ずつ落ちてくる
  title.classList.remove('out');
  title.classList.add('on');
  const sub = title.querySelector('.vt-sub');
  sub.textContent = '';
  for (let i = 0; i < 4; i++) {
    setTimeout(() => { Sound.slam(); fx.shake(0.07); fx.kick(0.35); fx.glitch(0.2); }, 270 + i * 160);
  }
  if (!Music.playing) Music.start();
  await sleep(900);
  for (const ch of 'VIRTUAL ENGAGEMENT & GUARDIAN ASSISTANT') { sub.textContent += ch; if (ch !== ' ') Sound.type(); await sleep(22); }
  await sleep(1500);
  title.classList.add('out');
  await sleep(700);
  title.classList.remove('on', 'out');
  term.className = 'term';
  log.innerHTML = '';
  boot.greet();
  setTimeout(() => { if (S.mode === 'normal' && Music.playing) Music.stop(3); }, 6500);
  running = false;
}

async function run() {
  if (running || S.phase !== 'standby') return;
  running = true;
  const g = ++gen;
  const w = (ms) => new Promise((res, rej) => setTimeout(() => (g === gen ? res() : rej(SKIP)), ms));
  boot.begin();
  log.innerHTML = '';
  big.className = 't-big';
  term.className = 'term on';
  inTerminal = true;
  Sound.crtOn();
  void term.offsetWidth;
  term.classList.add('crt');
  try {
    await w(550);
    Sound.droneStart();
    await bios(w);
    await kernel(w);
    await logo(w);
    await command(w);
    await scan(w);
    await checklist(w);
    await countdown(w);
  } catch (e) {
    if (e !== SKIP) throw e;
    return;
  }
  await finale();
}
// ターミナルの間はタップで最後まで飛ばす
term.addEventListener('pointerdown', () => {
  if (!inTerminal) return;
  gen++;
  scanCv.classList.remove('on');
  big.className = 't-big';
  finale();
});
window.addEventListener('vega-sleep', () => { title.classList.remove('on', 'out'); });

window.VEGA_BOOT = { run };
}

if (window.VEGA) setup();
else window.addEventListener('vega-ready', setup, { once: true });
})();
