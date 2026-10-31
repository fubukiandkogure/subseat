// VEGA の音まわり。効果音は Kenney のサンプル（CC0, sfx/）、残りは Web Audio で合成する
(() => {
'use strict';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SHOTS = [
  'boom_big', 'boom_mid', 'crunch_1', 'crunch_2', 'crunch_3', 'field_1', 'field_2',
  'beam_1', 'beam_2', 'beam_3', 'zap_1', 'zap_2', 'zap_3', 'servo_1', 'servo_2', 'clank_1', 'clank_2',
  'ui_select', 'ui_confirm', 'ui_open', 'ui_glitch_1', 'ui_glitch_2', 'ui_glitch_3', 'ui_error', 'ui_tick', 'ui_switch',
];
const LOOPS = ['loop_engine', 'loop_whir', 'loop_data', 'loop_thrust'];

// ファイルはページを開いた時点で取りに行く（鳴らせるのはタップの後）
const raw = {};
const prefetch = Promise.all(SHOTS.map((n) => [n, 'mp3']).concat(LOOPS.map((n) => [n, 'wav'])).map(([n, ext]) =>
  fetch(`sfx/${n}.${ext}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => { if (ab) raw[n] = ab; })
    .catch(() => {})));

let ac = null, master = null, sfx = null, music = null, duck = null, verb = null, delay = null, noiseBuf = null;
let on = true;
const buf = {}, loops = {};

function gain(v, dest) {
  const g = ac.createGain();
  g.gain.value = v;
  if (dest) g.connect(dest);
  return g;
}

function init() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ac = new AC(); } catch (_) { ac = null; return; }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = gain(on ? 1 : 0);
  master.connect(comp); comp.connect(ac.destination);
  sfx = gain(0.9, master);
  music = gain(0.0001, master);
  duck = gain(1, music);
  // 残響：減衰するノイズをインパルス応答に
  const len = Math.floor(ac.sampleRate * 2.6);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  conv.connect(master);
  verb = gain(0.55, conv);
  // 音楽のアルペジオ用ディレイ（付点8分）
  delay = ac.createDelay(1);
  delay.delayTime.value = 60 / 128 * 0.75;
  const fb = gain(0.32, delay);
  delay.connect(fb);
  delay.connect(gain(0.3, duck));
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  prefetch.then(() => Promise.all(Object.keys(raw).map((n) => new Promise((res) => {
    try { ac.decodeAudioData(raw[n], (b) => { buf[n] = b; res(); }, () => res()); } catch (_) { res(); }
  }))));
}
const ok = () => !!ac && on;

function play(name, o = {}) {
  if (!ok() || !buf[name]) return;
  const { vol = 1, rate = 1, t = 0, wet = 0.15, pan = 0 } = o;
  const src = ac.createBufferSource();
  src.buffer = buf[name];
  src.playbackRate.value = rate;
  let node = gain(vol);
  src.connect(node);
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); node = p;
  }
  node.connect(sfx);
  if (wet) node.connect(gain(wet, verb));
  src.start(ac.currentTime + t);
}
const vary = (names, o = {}) => play(pick(names), Object.assign({}, o, { rate: (o.rate || 1) * rand(0.93, 1.07) }));

// ループ素材：一度つくったら鳴らしっぱなしにして、音量と速さだけ動かす
function loop(name, vol, rate = 1, tc = 0.15) {
  if (!ac) return;
  let L = loops[name];
  if (!L) {
    if (vol <= 0.001 || !buf[name]) return;
    const src = ac.createBufferSource();
    src.buffer = buf[name]; src.loop = true;
    const g = gain(0.0001, sfx);
    src.connect(g); src.start();
    L = loops[name] = { src, g };
  }
  L.g.gain.setTargetAtTime(Math.max(0.0001, vol), ac.currentTime, tc);
  L.src.playbackRate.setTargetAtTime(rate, ac.currentTime, 0.08);
}

function tone(o) {
  if (!ok()) return;
  const { type = 'sine', f = 440, f2 = 0, t = 0, dur = 0.2, a = 0.005, vol = 0.2, wet = 0.15, lp = 0, lp2 = 0, detune = 0, out = null } = o;
  const t0 = ac.currentTime + t;
  const osc = ac.createOscillator();
  osc.type = type; osc.detune.value = detune;
  osc.frequency.setValueAtTime(f, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc;
  if (lp) {
    const fl = ac.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(lp, t0);
    if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t0 + dur);
    osc.connect(fl); node = fl;
  }
  node.connect(g);
  if (out) g.connect(out);
  else { g.connect(sfx); if (wet) g.connect(gain(wet, verb)); }
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function hiss(o) {
  if (!ok()) return;
  const { t = 0, dur = 0.5, a = 0.01, vol = 0.3, type = 'bandpass', f = 1000, f2 = 0, q = 1, wet = 0.2 } = o;
  const t0 = ac.currentTime + t;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const fl = ac.createBiquadFilter();
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(fl); fl.connect(g); g.connect(sfx);
  if (wet) g.connect(gain(wet, verb));
  src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
}

let hum = null, charge = null, alarmBus = null;

const Sound = {
  init,
  get on() { return on; },
  set(v) {
    on = v;
    if (master) master.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, 0.05);
  },
  suspend() { if (ac) ac.suspend().catch(() => {}); },
  resume() { if (ac) ac.resume().catch(() => {}); },

  click() { play('ui_select', { vol: 0.5, wet: 0.05 }); tone({ f: 1250, dur: 0.08, vol: 0.035, wet: 0.2 }); },
  open() { play('ui_open', { vol: 0.5, wet: 0.25 }); },
  confirm() { play('ui_confirm', { vol: 0.45, wet: 0.3 }); },
  error() { play('ui_error', { vol: 0.5, wet: 0.2 }); },
  glitch() { play(pick(['ui_glitch_1', 'ui_glitch_2', 'ui_glitch_3']), { vol: 0.22, wet: 0, rate: rand(0.8, 1.4) }); },
  type() { tone({ type: 'square', f: 3800, dur: 0.016, vol: 0.009, wet: 0, lp: 6000 }); },
  blip(f = 1320, t = 0) { tone({ f, t, dur: 0.14, vol: 0.07, wet: 0.35 }); tone({ f: f * 2, t, dur: 0.06, vol: 0.018, wet: 0.2 }); },
  lock() {
    play('ui_tick', { vol: 0.5, wet: 0 });
    play('ui_tick', { vol: 0.4, t: 0.06, wet: 0 });
    tone({ f: 1320, t: 0.12, dur: 0.1, vol: 0.05, wet: 0.3 });
    tone({ f: 1980, t: 0.18, dur: 0.18, vol: 0.045, wet: 0.35 });
  },
  beam(pan = 0) {
    vary(['beam_1', 'beam_2', 'beam_3'], { vol: 0.5, wet: 0.25, pan });
    tone({ type: 'sawtooth', f: 1800, f2: 110, dur: 0.22, vol: 0.045, lp: 4000, wet: 0.1 });
  },
  zap(pan = 0) { vary(['zap_1', 'zap_2', 'zap_3'], { vol: 0.4, wet: 0.2, pan }); },
  explode(pan = 0, size = 1) {
    vary(['crunch_1', 'crunch_2', 'crunch_3'], { vol: 0.55 * size, wet: 0.35, pan });
    play('boom_mid', { vol: 0.45 * size, rate: rand(0.9, 1.15), wet: 0.3, pan });
  },
  boom(p = 1) {
    play('boom_big', { vol: 0.6 + 0.4 * p, wet: 0.5 });
    play('crunch_3', { vol: 0.3 + 0.4 * p, wet: 0.45, rate: 0.85 });
    tone({ f: 120, f2: 28, dur: 1.4, a: 0.004, vol: 0.45 * p + 0.2, wet: 0.1 });
    hiss({ type: 'highpass', f: 4000, dur: 0.18, a: 0.002, vol: 0.18 * p + 0.05, wet: 0.3 });
  },
  chord(base = 220, t = 0) {
    [1, 1.25, 1.5, 2, 2.5, 3].forEach((m, i) => {
      tone({ type: 'triangle', f: base * m, t: t + i * 0.045, dur: 2.8, a: 0.25, vol: 0.032, wet: 0.7, detune: rand(-6, 6) });
      tone({ f: base * m * 2, t: t + i * 0.045, dur: 2.2, a: 0.4, vol: 0.011, wet: 0.8 });
    });
  },
  powerUp() {
    tone({ type: 'sawtooth', f: 45, f2: 520, dur: 1.55, a: 1.4, vol: 0.11, lp: 300, lp2: 4200, wet: 0.3 });
    tone({ f: 90, f2: 1040, dur: 1.55, a: 1.4, vol: 0.05, wet: 0.3 });
    hiss({ f: 200, f2: 7000, dur: 1.55, a: 1.45, vol: 0.18, q: 1.2, wet: 0.4 });
    play('field_1', { vol: 0.45, rate: 0.6, wet: 0.5 });
  },
  powerDown() {
    tone({ type: 'sawtooth', f: 420, f2: 40, dur: 1.4, a: 0.02, vol: 0.08, lp: 3000, lp2: 200, wet: 0.4 });
    hiss({ f: 5000, f2: 150, dur: 1.2, a: 0.05, vol: 0.1, wet: 0.4 });
    play('servo_2', { vol: 0.6, rate: 0.55, wet: 0.4 });
  },
  servo(t = 0, rate = 1) { play(pick(['servo_1', 'servo_2']), { vol: 0.6, t, rate, wet: 0.3 }); },
  clank(t = 0, pan = 0) {
    play(pick(['clank_1', 'clank_2']), { vol: 0.9, t, rate: rand(0.8, 1.05), wet: 0.4, pan });
    tone({ f: 95, f2: 45, t, dur: 0.28, vol: 0.22, wet: 0.1 });
  },
  shield() { play('field_2', { vol: 0.6, wet: 0.35, rate: rand(0.85, 1.1) }); tone({ f: 320, f2: 110, dur: 0.4, vol: 0.07, wet: 0.3 }); },
  scan() {
    tone({ f: 220, f2: 880, dur: 2.0, a: 0.2, vol: 0.04, wet: 0.4 });
    loop('loop_data', 0.22, 1.1, 0.1);
    setTimeout(() => loop('loop_data', 0, 1, 0.2), 2100);
  },
  detect() { tone({ f: 1760, dur: 0.08, vol: 0.05, wet: 0.3 }); tone({ f: 2640, t: 0.07, dur: 0.12, vol: 0.04, wet: 0.4 }); play('ui_tick', { vol: 0.4, wet: 0 }); },
  alarm(sec) {
    if (!ok()) return;
    Sound.alarmStop();
    alarmBus = gain(1, sfx);
    alarmBus.connect(gain(0.25, verb));
    const n = Math.floor(sec / 0.42);
    for (let i = 0; i < n; i++) tone({ type: 'sawtooth', f: i % 2 ? 960 : 700, t: i * 0.42, dur: 0.4, a: 0.02, vol: 0.055, lp: 2200, out: alarmBus });
  },
  alarmStop() {
    if (!alarmBus) return;
    alarmBus.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    alarmBus = null;
  },
  rise() {
    tone({ type: 'sawtooth', f: 70, f2: 700, dur: 1.1, a: 1.0, vol: 0.12, lp: 400, lp2: 5000, wet: 0.3 });
    hiss({ f: 300, f2: 8000, dur: 1.1, a: 1.0, vol: 0.16, wet: 0.4 });
    play('field_1', { vol: 0.5, rate: 0.8, wet: 0.4 });
  },
  engine(x) { loop('loop_engine', x * 0.42, 0.75 + x * 0.45, 0.4); },
  cool() {
    hiss({ type: 'highpass', f: 6000, f2: 1500, dur: 1.6, a: 0.05, vol: 0.12, wet: 0.4 });
    tone({ f: 660, f2: 220, dur: 1.2, vol: 0.04, wet: 0.5 });
  },
  spin(v) {
    const s = Math.min(1, Math.abs(v) / 7);
    loop('loop_whir', s * 0.45, 0.55 + s * 1.3, 0.06);
  },
  humStart() {
    if (!ac || hum) return;
    const g = gain(0.0001, master);
    const lf = ac.createBiquadFilter();
    lf.type = 'lowpass'; lf.frequency.value = 400; lf.connect(g);
    const oscs = [55, 55.4, 110.3, 164.8].map((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 3 ? 'triangle' : 'sine'; o.frequency.value = f;
      o.connect(gain([0.5, 0.5, 0.25, 0.06][i], lf)); o.start();
      return o;
    });
    g.gain.setTargetAtTime(0.05, ac.currentTime, 0.8);
    hum = { g, lf, oscs };
  },
  humStop() {
    if (!hum) return;
    const h = hum; hum = null;
    h.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
    setTimeout(() => h.oscs.forEach((o) => o.stop()), 1600);
  },
  humBoost(x) {
    if (!hum) return;
    hum.g.gain.setTargetAtTime(0.05 + x * 0.07, ac.currentTime, 0.2);
    hum.lf.frequency.setTargetAtTime(400 + x * 1500, ac.currentTime, 0.2);
  },
  chargeStart() {
    if (!ac || charge) return;
    const g = gain(0.0001);
    const fl = ac.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = 300; fl.Q.value = 6;
    const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 120;
    const lfo = ac.createOscillator(); lfo.frequency.value = 6;
    const lg = gain(0, g.gain);
    lfo.connect(lg);
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(sfx); g.connect(gain(0.35, verb));
    o1.start(); o2.start(); lfo.start();
    g.gain.setTargetAtTime(0.1, ac.currentTime, 0.08);
    charge = { g, fl, o1, o2, lfo, lg };
    play('field_1', { vol: 0.5, rate: 0.7, wet: 0.3 });
  },
  chargeSet(x) {
    loop('loop_thrust', 0.12 + x * 0.4, 0.6 + x * 0.9, 0.05);
    if (!charge) return;
    const t = ac.currentTime;
    charge.o1.frequency.setTargetAtTime(60 + x * 340, t, 0.05);
    charge.o2.frequency.setTargetAtTime(120 + x * 900, t, 0.05);
    charge.fl.frequency.setTargetAtTime(300 + x * 4200, t, 0.05);
    charge.lfo.frequency.setTargetAtTime(6 + x * 22, t, 0.05);
    charge.lg.gain.setTargetAtTime(x * 0.045, t, 0.05);
  },
  chargeStop() {
    loop('loop_thrust', 0, 1, 0.04);
    if (!charge) return;
    const c = charge; charge = null;
    const t = ac.currentTime;
    c.g.gain.cancelScheduledValues(t);
    c.g.gain.setTargetAtTime(0.0001, t, 0.03);
    setTimeout(() => [c.o1, c.o2, c.lfo].forEach((o) => o.stop()), 300);
  },
};

/* ── 音楽：オーバードライブと迎撃戦で流れる 128BPM のループ（Am-F-C-G） ── */
const Music = (() => {
  const S16 = 60 / 128 / 4;
  const ROOT = [33, 29, 36, 31];
  const CHORD = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
  let playing = false, step = 0, nextT = 0, timer = 0;

  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(music);
    o.start(t); o.stop(t + 0.4);
    // キックのたびに他の楽器を少し下げる（ポンプ感）
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.35, t);
    duck.gain.linearRampToValueAtTime(1, t + 0.2);
  }
  function noiseHit(t, type, f, q, vol, dec, wet) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    src.connect(fl); fl.connect(g); g.connect(music);
    if (wet) g.connect(gain(wet, verb));
    src.start(t, Math.random()); src.stop(t + dec + 0.02);
  }
  function bass(n, t) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(n);
    o2.type = 'square'; o2.frequency.value = mtof(n - 12);
    fl.type = 'lowpass'; fl.Q.value = 7;
    fl.frequency.setValueAtTime(1400, t);
    fl.frequency.exponentialRampToValueAtTime(180, t + S16 * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + S16 * 0.95);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(duck);
    o.start(t); o2.start(t); o.stop(t + S16); o2.stop(t + S16);
  }
  function pluck(n, t, vol) {
    const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(n);
    fl.type = 'lowpass'; fl.Q.value = 4;
    fl.frequency.setValueAtTime(5000, t);
    fl.frequency.exponentialRampToValueAtTime(600, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(fl); fl.connect(g); g.connect(duck); g.connect(delay);
    o.start(t); o.stop(t + 0.22);
  }
  function pad(notes, t, dur) {
    for (const n of notes) for (const d of [-9, 9]) {
      const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = mtof(n - 12); o.detune.value = d;
      fl.type = 'lowpass'; fl.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.016, t + 0.35);
      g.gain.setValueAtTime(0.016, t + dur - 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(duck); g.connect(gain(0.5, verb));
      o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function playStep(s, t) {
    const bar = (s >> 4) & 3, i = s & 15;
    if (i % 4 === 0) kick(t);
    if (i === 4 || i === 12) for (let k = 0; k < 3; k++) noiseHit(t + k * 0.011, 'bandpass', 1600, 0.9, 0.32, 0.09 + k * 0.03, 0.25);
    if (i % 4 === 2) noiseHit(t, 'highpass', 8000, 0.7, 0.08, 0.045, 0);
    else if (i % 2 === 1) noiseHit(t, 'highpass', 9000, 0.7, 0.03, 0.03, 0);
    if (i % 4 !== 0) bass(ROOT[bar] + (i % 4 === 2 ? 12 : 0), t);
    const ch = CHORD[bar];
    pluck(ch[[0, 1, 2, 3, 2, 1, 0, 1][i % 8]] + 12, t, i % 4 === 0 ? 0.06 : 0.042);
    if (i === 0) pad(ch, t, S16 * 16);
    if (i === 0 && bar === 0) noiseHit(t, 'highpass', 5000, 0.5, 0.22, 1.6, 0.4);
  }
  function tick() {
    while (nextT < ac.currentTime + 0.14) {
      playStep(step, nextT);
      nextT += S16;
      step = (step + 1) & 63;
    }
  }
  return {
    get playing() { return playing; },
    start() {
      if (!ac || playing) return;
      playing = true; step = 0; nextT = ac.currentTime + 0.06;
      music.gain.cancelScheduledValues(ac.currentTime);
      music.gain.setTargetAtTime(0.5, ac.currentTime, 0.05);
      clearInterval(timer);
      timer = setInterval(tick, 25);
      tick();
    },
    stop(fade = 1.2) {
      if (!ac || !playing) return;
      playing = false;
      music.gain.setTargetAtTime(0.0001, ac.currentTime, fade / 4);
      const id = timer;
      setTimeout(() => { if (!playing) clearInterval(id); }, fade * 1000 + 200);
    },
  };
})();

/* ── 声：端末の読み上げ（日本語の声がある時だけ） ── */
const Voice = (() => {
  const syn = window.speechSynthesis;
  let enabled = true, voice = null, known = false;
  function choose() {
    if (!syn) return;
    const vs = syn.getVoices();
    if (!vs.length) return;
    known = true;
    const ja = vs.filter((v) => /^ja/i.test(v.lang));
    voice = ja.find((v) => /otoya|ichiro|keita|male/i.test(v.name)) || ja.find((v) => /google/i.test(v.name)) || ja[0] || null;
  }
  if (syn) {
    choose();
    if (syn.addEventListener) syn.addEventListener('voiceschanged', choose);
    else syn.onvoiceschanged = choose;
  }
  return {
    get on() { return enabled; },
    set(v) { enabled = v; if (!v) this.stop(); },
    unlock() {
      if (!syn) return;
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; syn.speak(u); } catch (_) { /* 読み上げなし */ }
    },
    stop() { try { if (syn) syn.cancel(); } catch (_) { /* 読み上げなし */ } },
    speak(text, onStart, onEnd) {
      if (!syn || !enabled || (known && !voice)) return false;
      try {
        syn.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/VEGA/g, 'ヴェガ'));
        u.lang = 'ja-JP';
        if (voice) u.voice = voice;
        u.rate = 1.05; u.pitch = 0.85; u.volume = 1;
        u.onstart = onStart; u.onend = onEnd; u.onerror = onEnd;
        syn.speak(u);
        return true;
      } catch (_) { return false; }
    },
  };
})();

window.VegaAudio = { Sound, Music, Voice };
})();
