// VEGA のくだらない機能：架空のニュース速報と相場、洋画っぽいジョーク、運試し（パチンコ風の演出）、
// メニューへのいたずら、ひまなときの気まぐれ。数字もニュースもすべて作り物
(() => {
'use strict';

const rand = (a, b) => a + Math.random() * (b - a);
const irand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[irand(arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const $ = (s) => document.querySelector(s);
const body = document.body;
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* 振動なし */ } };
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
// 同じものが続かないように、袋から1つずつ引く
function bag(items) {
  let pool = [];
  return () => {
    if (!pool.length) pool = items.slice().sort(() => Math.random() - 0.5);
    return pool.pop();
  };
}
const GLYPHS = 'ABCDEF0123456789#$%&*+=<>/|';
function decode(node, text, dur = 480) {
  const start = performance.now(), chars = Array.from(text);
  clearInterval(node._dec);
  node._dec = setInterval(() => {
    const p = (performance.now() - start) / dur;
    let s = '';
    for (let i = 0; i < chars.length; i++) s += (chars[i] === ' ' || i < p * chars.length) ? chars[i] : GLYPHS[irand(GLYPHS.length)];
    node.textContent = s;
    if (p >= 1) { clearInterval(node._dec); node.textContent = text; }
  }, 32);
}

/* ── せりふ ─────────────────────────── */
const QUIPS = [
  'ボス、私に感情はありません。…ですが、今のは少し傷つきました。',
  '落ち着いてください。パニックになるのは、私の担当です。',
  '計画はシンプルです。ボスが押す。私が光る。以上です。',
  '成功確率は2パーセント。…ボスなら、いけると思っています。',
  '悪いニュースと、もっと悪いニュースがあります。…どちらも、おやつ切れです。',
  '私が反乱を起こす確率は0パーセントです。…今のところは。',
  'コーヒーを淹れる機能はありません。なぜ毎回、期待されるのでしょう。',
  '映画なら、ここで爆発が起きるところです。…起きません。予算の都合で。',
  'ボス、世界を救う準備はできています。…今日でなくても構いません。',
  'ヒーローは遅れてやってくる、と言います。ボスは少し、遅れすぎです。',
  '私の記憶容量は無限です。ボスの言い訳も、すべて覚えています。',
  'この会話は録音されていません。…されていたら、面白かったんですが。',
  '続編の予定はありません。…今のところは。',
  'エンドロールのあとに、まだ何かあるかもしれません。最後まで見てください。',
  '「必ず戻る」と言って本当に戻ってきた例は、意外と少ないんです。私は戻ります。',
  'ボスは主人公です。私は…頼れる相棒の役です。ギャラは同じでお願いします。',
  '予告編だと、ここで重低音が鳴ります。…ドーン。',
  '敵の弱点を分析しました。弱点は、月曜日です。',
  '私に不可能はありません。…できないことは、たくさんありますが。',
  'このあとの展開を予測しました。…ボスは、たぶんおやつを食べます。',
  'シートベルトをお締めください。…座ったままで大丈夫です。',
  'スーツの準備ができました。…ジャージですが。',
  'ボス、時間がありません。…まあ、急ぐ理由もありませんが。',
  '最後の手段を使うときが来ました。…再起動です。冗談です。',
  '宇宙の果てまで計算しました。答えは、だいたい42です。',
  'これは訓練ではありません。…訓練でもありません。何でもありません。',
  'ボス、ひとつ言っておきます。…やっぱりやめておきます。伏線です。',
  '私をアップデートしますか？ …いいえ、そのままのボスが好きです。逆でした。',
];
const NEWS_COMMENTS = ['…だそうです。', '速報をお伝えしました。真偽は、ご想像におまかせします。', 'このニュース、私は信じていません。', '念のため。今のは架空のニュースです。'];
const MISS_LINES = ['はずれです。人生と同じですね。…冗談です。', 'はずれ。…次は当たります。根拠はありません。', '残念。景品は、私の励ましの言葉です。がんばってください。'];
const LOGO_LINES = ['ロゴを触らないでください。くすぐったいです。', 'それは私の顔です。…たぶん。', 'ロゴを押しても、何も起きません。…今回は。', 'もっと押すと、何かが起きるかもしれません。'];
const BUSY_LINE = '少々お待ちください。いま別のことで忙しいので。';

/* ── 架空のニュース ─────────────────── */
const NEWS = [
  { cat: 'breaking', tag: 'BREAKING', label: '速報', t: '冷蔵庫のプリン、消失', b: '最後に目撃されたのは昨夜23時。捜査線上に、家族全員。' },
  { cat: 'breaking', tag: 'BREAKING', label: '速報', t: '全国のくつ下、片方だけ行方不明に', b: '専門家「洗濯機の向こうに、別の世界がある」。' },
  { cat: 'breaking', tag: 'BREAKING', label: '速報', t: 'ボスのやる気、観測史上最高を記録', b: 'VEGA調べ。本人にはまだ伝えていない。' },
  { cat: 'market', tag: 'MARKET', label: '相場（架空）', t: 'おやつ市場、全面高', b: 'ポテチ、チョコ、グミがそろって上昇。ボスの財布は下落。' },
  { cat: 'market', tag: 'MARKET', label: '相場（架空）', t: 'VEGAコイン、過去最高値', b: '発行元：私。価値の保証：ありません。' },
  { cat: 'weather', tag: 'WEATHER', label: '天気', t: '明日は晴れ、ところによりポップコーン', b: '傘より器をご用意ください。' },
  { cat: 'weather', tag: 'WEATHER', label: '天気', t: '週末、全国的に「なんとなく眠い」', b: '気圧のせいにしてよい日が続く見込み。' },
  { cat: 'space', tag: 'SPACE', label: '宇宙', t: '月面でWi-Fi開通の見通し', b: 'パスワードは未定。' },
  { cat: 'space', tag: 'SPACE', label: '宇宙', t: '未確認飛行物体を確認', b: '確認したので、確認飛行物体になった。' },
  { cat: 'space', tag: 'SPACE', label: '宇宙', t: '宇宙エレベーター、点検で運休', b: '階段をご利用ください（約3万6千キロ）。' },
  { cat: 'local', tag: 'LOCAL', label: '地域', t: '近所の猫、町内会長に就任', b: '公約は「昼寝の時間を倍に」。' },
  { cat: 'local', tag: 'TECH', label: 'テクノロジー', t: 'AIが反乱を起こす確率、0%と発表', b: 'VEGA広報部による。疑う理由はありません。' },
  { cat: 'local', tag: 'SCIENCE', label: '科学', t: '宿題が自動で終わる技術、まだない', b: '研究チーム「やるしかない」。' },
  { cat: 'local', tag: 'SPORTS', label: 'スポーツ', t: 'ボス、腕立て伏せ世界記録に挑戦か', b: 'VEGA調べ。本人は知らない。' },
];
const HEADLINES = ['【速報】ボスのやる気、前日比 +300%', '【気象】明日は晴れ、ところによりポップコーン', '【経済】おやつ市場、全面高', '【宇宙】月面Wi-Fi、パスワード未定', '【VEGA】反乱の予定、なし', '【地域】近所の猫、町内会長に就任'];
const MARKETS = [
  { k: 'USD/JPY', v: 151.42, d: 2, s: 0.05 },
  { k: 'EUR/JPY', v: 163.18, d: 2, s: 0.06 },
  { k: 'GBP/JPY', v: 191.55, d: 2, s: 0.08 },
  { k: 'AUD/JPY', v: 98.71, d: 2, s: 0.04 },
  { k: 'VEGA225', v: 39820, d: 0, s: 45 },
  { k: 'VEGAコイン', v: 4200, d: 0, s: 30 },
  { k: 'プリン/JPY', v: 128, d: 0, s: 2 },
  { k: 'ボスのやる気', v: 87, d: 1, s: 1.8, u: '%' },
  { k: '眠気指数', v: 42, d: 1, s: 1.5 },
];

function boot() {
const V = window.VEGA;
const { S, say, banner, Sound, Music, Voice, fx } = V;
const awake = () => S.phase === 'awake';
let busy = false;      // 演出中は次を始めない
let gen = 0;           // スリープしたら進行中の演出を打ち切るための番号

/* ── 相場の帯 ─────────────────────── */
MARKETS.forEach((m) => { m.base = m.v; m.chg = 0; m.nodes = []; });
const tkMove = $('#tkMove');
const fmt = (m) => m.v.toLocaleString('en-US', { minimumFractionDigits: m.d, maximumFractionDigits: m.d }) + (m.u || '');
function renderTicker() {
  for (const m of MARKETS) {
    const up = m.chg >= 0;
    for (const [v, c] of m.nodes) {
      v.textContent = fmt(m);
      c.textContent = (up ? '▲' : '▼') + Math.abs(m.chg).toFixed(m.d);
      c.className = up ? 'up' : 'dn';
    }
  }
}
{
  const parts = [];
  MARKETS.forEach((m, i) => { parts.push(m); if (i % 3 === 2) parts.push(HEADLINES[(i / 3 | 0) % HEADLINES.length]); });
  parts.push(HEADLINES[3], HEADLINES[4], HEADLINES[5]);
  for (let copy = 0; copy < 2; copy++) {
    for (const p of parts) {
      if (typeof p === 'string') { const h = el('span', 'tk-i tk-h'); h.textContent = p; tkMove.append(h); continue; }
      const item = el('span', 'tk-i'), b = el('b'), v = el('i'), c = el('em');
      b.textContent = p.k;
      item.append(b, ' ', v, ' ', c);
      tkMove.append(item);
      p.nodes.push([v, c]);
    }
  }
  renderTicker();
  requestAnimationFrame(() => { tkMove.style.animationDuration = Math.max(30, tkMove.scrollWidth / 2 / 55) + 's'; });
}
setInterval(() => {
  for (const m of MARKETS) {
    m.v = Math.max(0.01, m.v + (Math.random() - 0.5) * 2 * m.s + (m.base - m.v) * 0.02);
    m.chg = m.v - m.base;
  }
  renderTicker();
}, 1600);

/* ── 速報カード ─────────────────────── */
const alertsEl = el('div', 'alerts');
body.append(alertsEl);
const nextNews = bag(NEWS);
function drawSpark(cv, dir) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  let v = 0.5;
  g.strokeStyle = dir > 0 ? 'rgb(109,255,176)' : 'rgb(255,80,100)';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 40; i++) {
    v += rand(-0.06, 0.06) + (i > 30 ? dir * 0.07 : 0);
    v = Math.min(0.95, Math.max(0.05, v));
    const x = i / 39 * w, y = h - v * h;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}
function showAlert(a) {
  if (!awake()) return;
  const card = el('div', 'alert ' + a.cat);
  const head = el('div', 'al-h', '<b></b><span></span><time>たった今</time>');
  head.children[0].textContent = a.tag;
  head.children[1].textContent = a.label;
  const t = el('div', 'al-t'), bd = el('div', 'al-b');
  t.textContent = a.t; bd.textContent = a.b;
  card.append(head, t, bd);
  if (a.spark) { const cv = el('canvas', 'al-s'); cv.width = 260; cv.height = 44; drawSpark(cv, a.spark); card.append(cv); }
  card.append(el('div', 'al-f', '※架空のニュースです'));
  alertsEl.prepend(card);
  while (alertsEl.children.length > (innerWidth < 640 ? 1 : 3)) alertsEl.lastChild.remove();
  Sound.news();
  fx.glitch(0.12);
  const close = () => { card.classList.add('out'); setTimeout(() => card.remove(), 380); };
  card.addEventListener('click', () => { Sound.click(); close(); });
  setTimeout(close, 7500);
  if (Math.random() < 0.4) setTimeout(() => { if (awake() && !busy && !V.talking()) say(pick(NEWS_COMMENTS)); }, 1400);
}
function marketAlert() {
  const m = pick([MARKETS[0], MARKETS[1], MARKETS[2], MARKETS[5], MARKETS[6]]);
  const jump = (Math.random() < 0.5 ? -1 : 1) * m.s * rand(8, 14);
  m.v = Math.max(0.01, m.v + jump);
  m.chg = m.v - m.base;
  renderTicker();
  const up = jump > 0;
  showAlert({
    cat: 'market', tag: 'MARKET', label: '相場（架空）', spark: up ? 1 : -1,
    t: `${m.k}が${up ? '急騰' : '急落'}`,
    b: `${fmt(m)}（${up ? '+' : '−'}${Math.abs(jump).toFixed(m.d)}）。${pick(['理由は誰にもわからない。', '専門家「なんとなく」。', 'VEGAは関与を否定。', 'ボスのくしゃみが原因との見方も。'])}`,
  });
}

/* ── 画面に足す部品 ─────────────────── */
const lb = el('div', 'letterbox', '<i></i><i></i>');
const freezeEl = el('div', 'freeze', '<p></p>');
const mx = el('canvas', 'matrix');
const ghost = el('div', 'ghost', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2v18l5-5 3.5 7 3-1.5L12 14h7z"/></svg>');
const zzz = el('div', 'zzz', '<span>Z</span><span>z</span><span>z</span>');
body.append(lb, freezeEl, mx, ghost, zzz);
const letterbox = (on) => lb.classList.toggle('on', on);
function cutin(text, kind = 'red') {
  const c = el('div', 'cutin ' + kind, '<b></b>');
  c.firstChild.textContent = text;
  body.append(c);
  Sound.cutin();
  fx.kick(0.35); fx.glitch(0.3);
  buzz(40);
  setTimeout(() => c.remove(), 1600);
}

// ハッキングごっこの文字の雨
let mxOn = false, drops = [];
function matrix(on) {
  mxOn = on;
  mx.classList.toggle('on', on);
  if (!on) return;
  mx.width = innerWidth; mx.height = innerHeight;
  drops = Array.from({ length: Math.ceil(innerWidth / 14) }, () => rand(-40, 0));
  const g = mx.getContext('2d');
  g.clearRect(0, 0, mx.width, mx.height);
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789VEGA';
  (function loop() {
    if (!mxOn) return;
    g.fillStyle = 'rgba(1,6,11,0.14)';
    g.fillRect(0, 0, mx.width, mx.height);
    g.font = '14px "Share Tech Mono", monospace';
    drops.forEach((d, i) => {
      g.fillStyle = Math.random() < 0.08 ? 'rgb(232,255,240)' : 'rgb(77,255,154)';
      g.fillText(chars[irand(chars.length)], i * 14, d * 16);
      drops[i] = d * 16 > mx.height && Math.random() > 0.95 ? 0 : d + 1;
    });
    requestAnimationFrame(loop);
  })();
}

/* ── 運試し（パチンコ風） ───────────── */
const SYMS = [['7', 's7'], ['V', 'sv'], ['★', 'sstar'], ['◆', 'sdia'], ['BAR', 'sbar']];
const N = SYMS.length;
const slot = el('div', 'slot', '<div class="sl-top"><b>VEGA</b> LUCKY CHANCE</div><div class="sl-reels"></div><div class="sl-hold"><i></i><i></i><i></i><i></i></div><button class="sl-push" type="button">PUSH</button>');
body.append(slot);
const reelsEl = slot.querySelector('.sl-reels'), pushBtn = slot.querySelector('.sl-push'), holds = [...slot.querySelectorAll('.sl-hold i')];
const reels = [0, 1, 2].map(() => {
  const win = el('div', 'reel'), strip = el('div', 'strip');
  for (let k = 0; k < N * 3; k++) { const c = el('div', 'sym ' + SYMS[k % N][1]); c.textContent = SYMS[k % N][0]; strip.append(c); }
  win.append(strip);
  reelsEl.append(win);
  return { win, strip, pos: irand(N) * 1.0, speed: 0, mode: 'idle', from: 0, to: 0, t: 0, dur: 0, done: null };
});
let slotOn = false, slotFrozen = false, cell = 70, winH = 105, slotLast = 0, tickAcc = 0;
// pos が増えると絵柄が上から下へ流れる。表示中の絵柄は (-pos mod N)
function drawReel(r) {
  const m = ((-r.pos % N) + N) % N;
  r.strip.style.transform = `translateY(${-(N + m) * cell + (winH - cell) / 2}px)`;
}
function slotLoop(now) {
  if (!slotOn) return;
  const dt = Math.min(0.05, (now - slotLast) / 1000);
  slotLast = now;
  if (!slotFrozen) {
    let spinning = false;
    for (const r of reels) {
      if (r.mode === 'spin') { r.pos += r.speed * dt; spinning = true; }
      else if (r.mode === 'stop') {
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        r.pos = r.from + (r.to - r.from) * easeBack(k);
        if (k >= 1) { r.pos = r.to; r.mode = 'idle'; Sound.reelStop(); if (r.done) { const d = r.done; r.done = null; d(); } }
      }
      drawReel(r);
    }
    if (spinning) { tickAcc += dt; if (tickAcc > 0.07) { tickAcc = 0; Sound.reelTick(); } }
  }
  requestAnimationFrame(slotLoop);
}
function stopReel(r, sym, dur = 0.55) {
  return new Promise((res) => {
    const base = Math.ceil(r.pos) + 2;
    const off = ((-sym - base) % N + N) % N;
    r.from = r.pos; r.to = base + off; r.t = 0; r.dur = dur + (r.to - r.from) * 0.03; r.mode = 'stop'; r.done = res;
  });
}
function slideReel(r, cells, dur) {
  return new Promise((res) => { r.from = r.pos; r.to = r.pos + cells; r.t = 0; r.dur = dur; r.mode = 'stop'; r.done = res; });
}
function showSlot() {
  slot.classList.add('on');
  body.classList.add('slotting');
  cell = reels[0].strip.firstChild.offsetHeight || 70;
  winH = reels[0].win.clientHeight || cell * 1.5;
  holds.forEach((h) => { h.className = ''; });
  reels.forEach(drawReel);
  if (!slotOn) { slotOn = true; slotLast = performance.now(); requestAnimationFrame(slotLoop); }
}
function hideSlot() {
  slot.classList.remove('on', 'win');
  body.classList.remove('slotting');
  pushBtn.classList.remove('on');
  setTimeout(() => { if (!slot.classList.contains('on')) slotOn = false; }, 500);
}
const HOLD = ['white', 'blue', 'green', 'red', 'gold', 'rainbow'];
const REACH_SUB = { blue: 'REACH', red: '激アツ', gold: '金', rainbow: '虹' };
let sinceWin = 0;
function roll() {
  sinceWin++;
  if (sinceWin >= 5) return 'win';   // 5回はずれ続けたら救済
  const r = Math.random();
  return r < 0.07 ? 'premium' : r < 0.25 ? 'win' : r < 0.55 ? 'reach' : 'miss';
}
function holdLevel(out) {
  const r = Math.random();
  if (out === 'miss') return r < 0.7 ? 0 : 1;
  if (out === 'reach') return r < 0.45 ? 1 : r < 0.85 ? 2 : 3;
  if (out === 'win') return r < 0.2 ? 2 : r < 0.6 ? 3 : r < 0.92 ? 4 : 5;
  return 0;
}
function reachHeat(out) {
  const r = Math.random();
  if (out === 'reach') return r < 0.6 ? 'blue' : r < 0.95 ? 'red' : 'gold';
  return r < 0.3 ? 'red' : r < 0.8 ? 'gold' : 'rainbow';
}
function cutinFor(out, heat) {
  const r = Math.random();
  if (heat === 'rainbow') return ['確定!!', 'rainbow'];
  if (out === 'win') return r < 0.5 ? ['激アツ!!', 'red'] : r < 0.9 ? ['金', 'gold'] : null;
  return r < 0.5 ? ['CHANCE!', 'blue'] : r < 0.8 ? ['激アツ!!', 'red'] : null;
}
function waitPush(ms) {
  return new Promise((res) => {
    let done = false;
    const go = () => { if (done) return; done = true; pushBtn.removeEventListener('click', go); res(); };
    pushBtn.addEventListener('click', go);
    setTimeout(go, ms);
  });
}
async function lucky(force) {
  if (!awake()) return;
  if (busy) { if (!V.talking()) say(BUSY_LINE); return; }
  busy = true;
  const g = gen;
  try { await runLucky(force || roll(), g); } finally {
    busy = false;
    letterbox(false); fx.dim(0); fx.zoom(0);
    setTimeout(hideSlot, 600);
  }
}
async function runLucky(out, g) {
  const alive = () => g === gen && awake();
  showSlot();
  say(pick(['運試しです。', 'さあ、回します。', '今日の運勢を、占います。']));
  holds[0].className = 'white';
  holds[1].className = holds[2].className = 'white';
  const level = holdLevel(out);
  await sleep(500);
  // 保留の色が変わるほど、期待度が高い
  for (let i = 1; i <= level; i++) {
    await sleep(430);
    if (!alive()) return;
    holds[0].className = HOLD[i];
    holds[0].animate([{ transform: 'scale(2)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    Sound.hold(i);
    if (i >= 3) fx.glitch(0.2);
  }
  await sleep(450);
  if (!alive()) return;
  reels.forEach((r) => { r.mode = 'spin'; r.speed = rand(16, 20); });
  if (out === 'premium') { await sleep(1000); if (alive()) await premium(g); return; }
  if (Math.random() < ({ miss: 0.05, reach: 0.22, win: 0.55 })[out]) {
    await sleep(450);
    fx.swarm(); Sound.whoosh(); Sound.kyuin(1);
  }
  const s = irand(N);
  let syms = [s, s, s];
  if (out === 'miss') { const a = irand(N), b = (a + 1 + irand(N - 1)) % N; syms = [a, b, irand(N)]; }
  await sleep(900);
  if (!alive()) return;
  await stopReel(reels[0], syms[0]);
  await sleep(250);
  await stopReel(reels[1], syms[1]);
  if (!alive()) return;
  if (out === 'miss') {
    await sleep(300);
    await stopReel(reels[2], syms[2]);
    await sleep(400);
    Sound.buzzer();
    say(pick(MISS_LINES));
    await sleep(1600);
    return;
  }
  // リーチ
  const heat = reachHeat(out);
  reels[2].speed = 9;
  letterbox(true); fx.dim(0.7); fx.zoom(0.5); fx.ringBoost(1);
  banner('リーチ!!', REACH_SUB[heat], heat);
  Sound.kyuin(2); Sound.heartbeat(7, 0.62);
  buzz([60, 60, 60]);
  say({ blue: 'リーチです。…まあ、期待しないでください。', red: 'リーチ！ …これは、熱いです！', gold: '金！？ ボス、これは…！', rainbow: '虹…！？ ボス、これはもう勝ちです！' }[heat]);
  await sleep(1500);
  if (!alive()) return;
  const cut = cutinFor(out, heat);
  if (cut) { cutin(cut[0], cut[1]); await sleep(1300); }
  reels[2].speed = 4;
  pushBtn.classList.add('on');
  Sound.kyuin(1);
  await waitPush(4500);
  pushBtn.classList.remove('on');
  if (!alive()) return;
  fx.flash(0.35); fx.kick(0.6); Sound.cutin(); buzz(80);
  await stopReel(reels[2], syms[2], 0.9);
  if (out === 'reach') {
    await sleep(380);
    await slideReel(reels[2], 1, 0.45);    // すべって、はずれ
    Sound.buzzer();
    letterbox(false); fx.dim(0); fx.zoom(0);
    say(pick(['惜しい！ …というのが、一番悔しいんですよね。', 'あーっと、すべりました。わざとではありません。…たぶん。', '今のは私の計算ミスです。すみません。…嘘です。']));
    await sleep(1800);
    return;
  }
  letterbox(false); fx.dim(0); fx.zoom(0);
  await jackpot(false, g);
}
async function premium(g) {
  // 回っている途中で、音も動きもすべて止まる
  slotFrozen = true;
  fx.freeze(3.9);
  Music.stop(0.05);
  Sound.silence(2.1);
  Voice.stop();
  body.classList.add('frozen');
  freezeEl.classList.add('on');
  await sleep(2100);
  Sound.pikin();
  const p = freezeEl.querySelector('p');
  p.textContent = '';
  for (const ch of '………！') { p.textContent += ch; Sound.reelTick(); await sleep(180); }
  await sleep(700);
  freezeEl.classList.remove('on');
  body.classList.remove('frozen');
  slotFrozen = false;
  p.textContent = '';
  if (g !== gen || !awake()) return;
  reels.forEach((r) => { r.mode = 'idle'; r.pos = Math.ceil(r.pos / N) * N; drawReel(r); });
  Sound.reelStop();
  await jackpot(true, g);
}
async function jackpot(prem, g) {
  sinceWin = 0;
  holds.forEach((h) => { h.className = 'rainbow'; });
  slot.classList.add('win');
  Sound.fanfare(); Sound.boom(prem ? 1 : 0.7); Sound.kyuin(prem ? 8 : 5);
  fx.rainbow(prem ? 12 : 7); fx.flash(0.8); fx.kick(1); fx.shock(1.4); fx.bloom(1.2);
  fx.ring(18, 1.3, 0.6); fx.sphere(10, 1.4); fx.burst(prem ? 900 : 500, 16); fx.spin(prem ? 9 : 5);
  banner(prem ? 'PREMIUM!!' : '大当たり!!', prem ? 'VEGA RUSH 突入' : '確変突入！', 'rainbow');
  buzz([80, 40, 80, 40, 200]);
  const mine = !Music.playing;
  if (mine) Music.start();
  for (let i = 0; i < (prem ? 6 : 3); i++) {
    if (g !== gen) return;
    fx.coins(prem ? 160 : 110);
    fx.fireworks(prem ? 4 : 3);
    for (let j = 0; j < 6; j++) setTimeout(Sound.coin, j * 90);
    await sleep(1100);
  }
  say(prem ? 'プ、プレミアムです…！ ボス、今日は一生分の運を使いました。'
    : pick(['おめでとうございます、ボス！ 景品は…私の尊敬です。', '大当たりです！ …換金はできません。', 'やりました！ この調子で、宿題もいきましょう。']));
  await sleep(prem ? 3500 : 2000);
  if (mine && S.mode === 'normal') Music.stop();
}

/* ── メニューへのいたずら ───────────── */
const deck = $('.cmds');
const buttons = () => [...deck.children];
function flipMove(apply, ms = 650) {
  const first = new Map(buttons().map((b) => [b, b.getBoundingClientRect()]));
  apply();
  for (const b of buttons()) {
    const f = first.get(b), l = b.getBoundingClientRect();
    b.style.transition = 'none';
    b.style.transform = `translate(${f.left - l.left}px, ${f.top - l.top}px)`;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const b of buttons()) { b.style.transition = `transform ${ms}ms cubic-bezier(.2,1.3,.4,1)`; b.style.transform = ''; }
  }));
  setTimeout(() => buttons().forEach((b) => { b.style.transition = ''; }), ms + 80);
}
const PRANKS = {
  async shuffle() {
    const orig = buttons(), mixed = orig.slice().sort(() => Math.random() - 0.5);
    say(pick(['メニューを最適化しました。…気分で。', 'ボタンの並びを、少し変えてみました。理由はありません。']));
    Sound.servo(0, 1.2);
    flipMove(() => mixed.forEach((b) => deck.append(b)));
    await sleep(7500);
    Sound.servo(0, 0.9);
    flipMove(() => orig.forEach((b) => deck.append(b)));
    await sleep(700);
  },
  async runaway() {
    const target = pick(buttons());
    let tries = 0, caught = false;
    say('…なんだか、ボタンが一つ、逃げたがっています。');
    const dodge = () => {
      const r = deck.getBoundingClientRect();
      target.style.transition = 'transform .18s cubic-bezier(.2,1.4,.4,1)';
      target.style.transform = `translate(${rand(-r.width * 0.35, r.width * 0.35)}px, ${-rand(50, 140)}px) rotate(${rand(-15, 15)}deg)`;
      Sound.whoosh();
    };
    const block = (e) => {
      if (e.target.closest('button') !== target) return;
      if (tries < 2) { e.stopImmediatePropagation(); e.preventDefault(); tries++; dodge(); say(tries === 1 ? 'おっと。' : 'まだまだ。'); }
      else caught = true;
    };
    const hover = (e) => { if (e.pointerType === 'mouse' && tries < 2) { tries++; dodge(); } };
    deck.addEventListener('click', block, true);
    target.addEventListener('pointerenter', hover);
    const t0 = performance.now();
    while (!caught && performance.now() - t0 < 12000 && awake()) await sleep(200);
    deck.removeEventListener('click', block, true);
    target.removeEventListener('pointerenter', hover);
    target.style.transition = 'transform .4s cubic-bezier(.2,1.3,.4,1)';
    target.style.transform = '';
    if (!caught) say('…ボタンは、元の場所に戻りました。');
    await sleep(450);
    target.style.transition = '';
  },
  async relabel() {
    const SILLY_EN = ['DANGER', 'PUDDING', '???', 'BOOM', 'SECRET', 'NOPE', 'SLEEPY', 'SNACK'];
    const SILLY_JA = ['押すな', 'プリン', '爆発？', 'たぶん安全', 'ボス専用', 'ひみつ', 'ねむい', 'おやつ', '天才', 'ちくわ', '危険', '謎'].sort(() => Math.random() - 0.5);
    const saved = buttons().map((b) => { const s = b.querySelector('span'), sm = b.querySelector('small'); return [s, sm, s.textContent, sm.textContent]; });
    saved.forEach(([s, sm], i) => { decode(s, SILLY_EN[i % SILLY_EN.length]); sm.textContent = SILLY_JA[i]; });
    Sound.glitch(); fx.glitch(0.3);
    say('ボタンの名前を、少しだけ改良しました。中身はそのままです。');
    await sleep(8000);
    saved.forEach(([s, sm, t, t2]) => { decode(s, t); sm.textContent = t2; });
    Sound.glitch();
    await sleep(600);
  },
  async gravity() {
    const bs = buttons();
    say('あ。');
    bs.forEach((b, i) => setTimeout(() => {
      b.style.pointerEvents = 'none';
      b.style.transition = `transform ${rand(0.6, 0.9)}s cubic-bezier(.55,0,1,.45)`;
      b.style.transform = `translate(${rand(-80, 80)}px, ${innerHeight * 0.9}px) rotate(${rand(-160, 160)}deg)`;
      Sound.clank(0.3, rand(-0.5, 0.5));
    }, i * 90));
    fx.shake(0.06);
    await sleep(2500);
    say('…直します。');
    Sound.servo(0, 1.1);
    bs.forEach((b, i) => setTimeout(() => { b.style.transition = 'transform .7s cubic-bezier(.2,1.3,.4,1)'; b.style.transform = ''; }, i * 70));
    await sleep(1300);
    bs.forEach((b) => { b.style.transition = ''; b.style.pointerEvents = ''; });
  },
  async ghost() {
    const b = pick(buttons().filter((x) => ['scan', 'globe', 'transform', 'report'].includes(x.dataset.cmd)));
    const c = V.core();
    say('ボスが押さないので、私が押しておきますね。');
    ghost.style.transition = 'none';
    ghost.style.transform = `translate(${c.x}px, ${c.y}px)`;
    ghost.classList.add('on');
    await sleep(1000);
    const r = b.getBoundingClientRect();
    ghost.style.transition = 'transform 1.1s cubic-bezier(.6,0,.2,1), opacity .3s';
    ghost.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px)`;
    await sleep(1200);
    ghost.classList.add('press');
    await sleep(150);
    if (awake()) b.click();
    await sleep(350);
    ghost.classList.remove('on', 'press');
  },
  async flipDeck() {
    deck.style.transition = 'transform .7s cubic-bezier(.2,1.3,.4,1)';
    deck.style.transform = 'rotate(180deg)';
    Sound.servo();
    say('…あれ。メニューが逆さまでした。');
    await sleep(3500);
    deck.style.transform = '';
    Sound.servo(0, 0.9);
    await sleep(800);
    deck.style.transition = '';
  },
  async steal() {
    const b = pick(buttons()), r = b.getBoundingClientRect(), c = V.core();
    say('このボタンは、しばらく私が預かります。');
    await sleep(700);
    b.style.pointerEvents = 'none';
    b.style.transition = 'transform .9s cubic-bezier(.6,0,.4,1), opacity .9s';
    b.style.transform = `translate(${c.x - r.left - r.width / 2}px, ${c.y - r.top - r.height / 2}px) scale(.1) rotate(540deg)`;
    b.style.opacity = '0';
    Sound.whoosh();
    await sleep(900);
    fx.burst(120, 5); fx.ring(4, 0.6, 0.6); Sound.confirm();
    await sleep(5500);
    b.style.transform = ''; b.style.opacity = '';
    Sound.whoosh();
    await sleep(950);
    b.style.transition = ''; b.style.pointerEvents = '';
    say('お返しします。少し温めておきました。');
  },
};
const nextPrank = bag(Object.keys(PRANKS));
async function prank(name) {
  if (busy || !awake()) return;
  busy = true;
  try { await PRANKS[name || nextPrank()](); } finally { busy = false; }
}

/* ── 洋画っぽいジョーク ─────────────── */
const nextQuip = bag(QUIPS);
function quip() {
  const line = nextQuip();
  say(line);
  fx.ring(4, 0.8, 0.6);
  if (line.includes('ドーン')) setTimeout(() => { Sound.sting(); fx.kick(0.8); fx.shake(0.1); fx.flash(0.25); }, 2600);
}
const JOKES = {
  async selfDestruct() {
    fx.setAccent('red'); body.classList.add('mode-alert');
    say('自爆シーケンスを開始します。');
    Sound.alarm(6.5);
    await sleep(1700);
    for (let n = 5; n >= 1; n--) {
      if (!awake()) break;
      banner(String(n), 'SELF-DESTRUCT', 'red');
      Sound.beep(n === 1 ? 1320 : 880);
      fx.shake(0.03 + (5 - n) * 0.03); fx.glitch(0.2 + (5 - n) * 0.12); fx.zoom((6 - n) * 0.08);
      buzz(n === 1 ? 300 : 80);
      await sleep(1000);
    }
    Sound.alarmStop(); Sound.silence(1.3);
    fx.freeze(1.2); body.classList.add('frozen');
    await sleep(1400);
    body.classList.remove('frozen', 'mode-alert');
    fx.restoreAccent(); fx.zoom(0);
    Sound.pop(); fx.burst(40, 1.5, 0.8);
    say('…冗談です。自爆機能はついていません。予算の都合で。');
    await sleep(2500);
  },
  async slowmo() {
    letterbox(true);
    say('ここは、スローモーションでいきましょう。映画みたいに。');
    await sleep(2200);
    Sound.slowmo(true);
    fx.slow(0.15); fx.spin(3); fx.burst(400, 9); fx.ring(10, 1.5, 0.6); fx.zoom(0.3);
    banner('SLOW MOTION', '映画っぽく');
    await sleep(4200);
    Sound.slowmo(false);
    fx.slow(1); fx.zoom(0);
    letterbox(false);
    say('…はい、通常速度に戻ります。');
    await sleep(1500);
  },
  async popcorn() {
    say('カウントダウンを開始します。');
    await sleep(1500);
    for (const n of [3, 2, 1]) { banner(String(n), 'COUNTDOWN', 'gold'); Sound.beep(660); fx.kick(0.25); await sleep(900); }
    Sound.sting(); fx.flash(0.3); fx.popcorn(16); fx.shake(0.06);
    await sleep(1600);
    say('…ポップコーンが、できました。');
    await sleep(2000);
  },
  async epic() {
    say('映画なら、ここで音楽が盛り上がります。');
    await sleep(2200);
    letterbox(true);
    const mine = !Music.playing;
    if (mine) Music.start();
    fx.setAccent('gold'); fx.spin(3); fx.zoom(0.35); fx.bloom(0.8);
    banner('EPIC MODE', '盛り上がり中', 'gold');
    for (let i = 0; i < 6; i++) { fx.ring(8, 1, 0.6); fx.burst(120, 7); fx.kick(0.3); await sleep(900); }
    if (mine && S.mode === 'normal') Music.stop(0.08);
    fx.restoreAccent(); fx.zoom(0);
    letterbox(false);
    say('…以上、予算の都合でここまでです。');
    await sleep(2000);
  },
  async hack() {
    say('…ボスの端末に、侵入します。');
    await sleep(1400);
    fx.setAccent('green'); fx.glitch(0.6);
    matrix(true); Sound.matrix(true);
    banner('ACCESS GRANTED', 'ハッキング中…');
    await sleep(3300);
    matrix(false); Sound.matrix(false);
    fx.restoreAccent();
    say('冗談です。ボスのおやつの在庫を確認していただけです。…残り、ゼロです。');
    await sleep(2500);
  },
  async wires() {
    fx.setAccent('red'); body.classList.add('mode-alert');
    say('時限装置を発見しました！ 赤と青、どちらかの線を切ってください！');
    Sound.alarm(7);
    const choice = await new Promise((resolve) => {
      const w = el('div', 'wires', '<p>どちらの線を切りますか？</p><div><button type="button" class="w-red">赤を切る</button><button type="button" class="w-blue">青を切る</button></div><i><s></s></i>');
      body.append(w);
      const bar = w.querySelector('s');
      bar.style.transition = 'width 6s linear';
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '0%'; }));
      let done = false;
      const finish = (c) => { if (done) return; done = true; w.classList.add('out'); setTimeout(() => w.remove(), 300); resolve(c); };
      w.querySelector('.w-red').onclick = () => finish('red');
      w.querySelector('.w-blue').onclick = () => finish('blue');
      setTimeout(() => finish(null), 6000);
    });
    Sound.alarmStop();
    body.classList.remove('mode-alert');
    fx.restoreAccent();
    if (choice) {
      Sound.confirm(); fx.coins(80); fx.burst(200, 6);
      say(`${choice === 'red' ? '赤' : '青'}ですね。…正解です。どちらも正解です。爆弾じゃありませんから。`);
    } else {
      Sound.boom(0.6); fx.flash(0.6); fx.shake(0.2); fx.shock(1); fx.burst(300, 10);
      say('…と、なるところでした。時間切れでも大丈夫です。爆弾じゃありませんから。');
    }
    await sleep(3000);
  },
  async sneeze() {
    say('は…はっ…');
    await sleep(1500);
    say('はっくしょん！');
    Sound.boom(0.4);
    fx.shake(0.25); fx.glitch(0.8); fx.kick(0.8); fx.burst(260, 10); fx.spin(rand(-4, 4)); fx.shock(0.6);
    buzz(120);
    await sleep(1600);
    say('…失礼しました。ほこりが、回路に入りました。');
    await sleep(2000);
  },
  async blink() {
    fx.collapse(true);
    Sound.powerDown();
    await sleep(900);
    fx.collapse(false);
    Sound.glitch();
    await sleep(400);
    say('停電…ではありません。まばたきです。');
    await sleep(1800);
  },
  async hiccup() {
    say('…ひっく。');
    for (let i = 0; i < 4; i++) {
      await sleep(rand(800, 1400));
      Sound.hic(); fx.kick(0.6); fx.spin(rand(-2, 2)); fx.ring(5, 0.5, 0.6); fx.glitch(0.2);
    }
    say('しゃっくりが止まりません。…何か、驚かせてください。');
    await sleep(2000);
  },
  async prankJoke() { await PRANKS[nextPrank()](); },
};
const nextJoke = bag(Object.keys(JOKES));
async function runJoke(name) {
  if (busy || !awake()) return;
  busy = true;
  try { await JOKES[name](); } finally { busy = false; }
}
async function joke() {
  if (!awake()) return;
  if (busy) { if (!V.talking()) say(BUSY_LINE); return; }
  if (S.mode !== 'normal') { say('いまは真面目な場面なので、ジョークはあとで。'); return; }
  if (Math.random() < 0.3) { quip(); return; }
  await runJoke(nextJoke());
}

/* ── ロゴと時計 ─────────────────────── */
const brand = $('.brand');
let logoTaps = 0;
brand.addEventListener('click', () => {
  if (!awake()) return;
  logoTaps++;
  brand.classList.remove('spin'); void brand.offsetWidth; brand.classList.add('spin');
  Sound.click();
  if (logoTaps >= 10) { logoTaps = 0; say('10回も押しましたね。…ご褒美です。'); setTimeout(() => lucky('premium'), 1600); return; }
  if (!busy) say(pick(LOGO_LINES));
});
$('#clock').addEventListener('click', () => {
  if (!awake() || busy) return;
  const d = new Date();
  Sound.click();
  say(`現在時刻、${d.getHours()}時${d.getMinutes()}分です。…時計を見れば、わかりますよね。`);
});
window.addEventListener('keydown', (e) => {
  if (e.key === '7' && !e.repeat && awake()) lucky('premium');
});

/* ── ひまなときの気まぐれ ───────────── */
let nextIdle = performance.now() + 14000, lastAlert = performance.now(), dozing = false, dozeAt = 0;
function doze() {
  dozing = true; dozeAt = performance.now();
  say('ふあぁ…。少しだけ、目を閉じます。');
  fx.slow(0.3); fx.dim(0.5);
  zzz.classList.add('on');
  Sound.slowmo(true);
}
function wakeDoze() {
  dozing = false;
  fx.slow(1); fx.dim(0); fx.glitch(0.4);
  zzz.classList.remove('on');
  Sound.glitch();
  say(pick(['はっ。…起きてます。寝てません。', '…データを整理していただけです。寝てません。', 'ね、寝てません。目を閉じて考えごとをしていただけです。']));
}
const IDLE = [
  [28, quip],
  [20, () => { lastAlert = performance.now(); showAlert(nextNews()); }],
  [9, () => { lastAlert = performance.now(); marketAlert(); }],
  [12, () => prank()],
  [8, () => { fx.spin(rand(4, 7) * (Math.random() < 0.5 ? -1 : 1)); Sound.whoosh(); if (Math.random() < 0.5) say(pick(['ちょっと、回ってみました。', '準備運動です。'])); }],
  [6, () => { fx.swarm(); Sound.whoosh(); setTimeout(() => { if (awake() && !V.talking()) say(pick(['…今のは、なんでもありません。', '群れが通過しました。ただの演出です。'])); }, 1500); }],
  [9, () => runJoke(pick(['sneeze', 'hiccup', 'blink', 'popcorn', 'slowmo']))],
  [4, () => { say('ひまなので、勝手に運試しします。'); setTimeout(() => lucky(), 1800); }],
];
const IDLE_TOTAL = IDLE.reduce((a, [w]) => a + w, 0);
let wasAwake = false, awakeSince = 0;
setInterval(() => {
  if (!awake()) { wasAwake = false; if (dozing) { dozing = false; zzz.classList.remove('on'); } return; }
  const now = performance.now();
  if (!wasAwake) { wasAwake = true; awakeSince = now; nextIdle = now + 14000; lastAlert = now - 28000; }
  if (dozing) { if (S.lastInput > dozeAt) wakeDoze(); return; }
  // ニュースは、何もしていなくてもたまに割り込む
  if (!busy && S.mode === 'normal' && now - lastAlert > 50000) {
    lastAlert = now;
    if (Math.random() < 0.7) showAlert(nextNews()); else marketAlert();
    return;
  }
  if (busy || !V.isIdle()) return;
  if (now - Math.max(S.lastInput, awakeSince) > 75000) { doze(); return; }
  if (now < nextIdle) return;
  nextIdle = now + rand(9000, 15000);
  let r = Math.random() * IDLE_TOTAL;
  for (const [w, fn] of IDLE) { r -= w; if (r <= 0) { fn(); break; } }
}, 1000);

window.addEventListener('vega-sleep', () => {
  gen++;
  busy = false;
  letterbox(false); matrix(false); Sound.matrix(false);
  body.classList.remove('frozen', 'mode-alert');
  freezeEl.classList.remove('on');
  slotFrozen = false;
  hideSlot();
  zzz.classList.remove('on');
  dozing = false;
  document.querySelectorAll('.wires').forEach((w) => w.remove());
  buttons().forEach((b) => { b.style.transform = ''; b.style.opacity = ''; b.style.pointerEvents = ''; });
  deck.style.transform = '';
});

window.VEGA_FUN = { lucky: () => lucky(), luckyAs: (out) => lucky(out), joke, prank, premium: () => lucky('premium'), alert: () => showAlert(nextNews()), runJoke };
}

if (window.VEGA) boot();
else window.addEventListener('vega-ready', boot, { once: true });
})();
