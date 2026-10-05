import { h, toast, segmented } from '../ui.js';
import { layoutSubs, planSvg, readPalette } from '../plan.js';
import { facadeSvg } from '../facade.js';
import { clearSample } from '../store.js';

// 初回に出るチュートリアル（設定からもう一度見られる）。
// どのページも窓の大きさ・絵の大きさ・ボタンの位置を同じにする（ボタンが動かないように）
const AW = 320, AH = 200;
const DEMO = [
  { id: 'a', name: 'ChatGPT', category: 'ai', value: 36000 },
  { id: 'b', name: 'Netflix', category: 'video', value: 19080 },
  { id: 'c', name: 'Spotify', category: 'music', value: 11760 },
  { id: 'd', name: 'iCloud+', category: 'cloud', value: 4800, status: 'keep' }
];

function buildingArt() {
  const rooms = [
    { id: 'a', name: 'ChatGPT', category: 'ai', roomNo: 101 }, { id: 'b', name: 'Netflix', category: 'video', roomNo: 102, raise: true },
    { id: 'c', name: 'Spotify', category: 'music', roomNo: 103 }, { id: 'd', name: 'iCloud+', category: 'cloud', roomNo: 201 },
    { id: 'e', name: 'U-NEXT', category: 'video', roomNo: 202, trial: true }
  ];
  return svgBox(facadeSvg(rooms, { height: 225 }));
}

const svgBox = (markup) => { const d = h('div', { class: 'tut-art' }); d.innerHTML = markup; return d; };

function demoPlan(vacant = new Set(), trial = false) {
  const rooms = DEMO.map((r) => (trial && r.id === 'c' ? { ...r, trial: true } : r));
  return svgBox(planSvg(layoutSubs(rooms, AW, AH), { w: AW, h: AH, vacant, unit: 'month', palette: readPalette() }));
}

function breakdownArt() {
  const blocks = [
    { label: 'サブスク', share: 0.07, color: 'var(--accent)', em: true },
    { label: '家賃・通信費', share: 0.31, color: 'var(--cat-fixed)' },
    { label: '自由に使えるお金', share: 0.62, color: 'color-mix(in oklab, var(--freed) 45%, var(--surface))' }
  ];
  return svgBox(`<svg viewBox="0 0 ${AW} ${AH}" aria-hidden="true" font-family="system-ui,sans-serif">
    <text x="30" y="52" font-size="14" font-weight="900" fill="var(--text)">手取りの内訳</text>
    ${(() => { let x = 30; return blocks.map((b) => { const w = 260 * b.share; const r = `<rect x="${x}" y="66" width="${w - 2}" height="30" rx="4" fill="${b.color}"/>`; x += w; return r; }).join(''); })()}
    ${blocks.map((b, i) => `<g transform="translate(30 ${118 + i * 20})"><rect width="10" height="10" rx="3" y="1" fill="${b.color}"/><text x="18" y="10" font-size="12" font-weight="${b.em ? 900 : 700}" fill="var(--text)">${b.label}</text><text x="260" y="10" text-anchor="end" font-size="12" font-weight="900" fill="var(--text)">${Math.round(b.share * 100)}%</text></g>`).join('')}
  </svg>`);
}

function doorArt() {
  return svgBox(`<svg viewBox="0 0 ${AW} ${AH}" aria-hidden="true" font-family="system-ui,sans-serif">
    <rect x="18" y="150" width="284" height="8" rx="4" fill="var(--line-strong)"/>
    <rect x="34" y="34" width="86" height="116" rx="6" fill="var(--surface)" stroke="var(--plan-wall)" stroke-width="4"/>
    <circle cx="104" cy="94" r="5" fill="var(--plan-wall)"/>
    <text x="77" y="26" text-anchor="middle" font-size="13" font-weight="900" fill="var(--muted)">サブスク荘</text>
    ${[['N', 'var(--cat-video)', 150], ['C', 'var(--cat-ai)', 200], ['?', 'var(--cat-other)', 250]].map(([t, c, x], i) => `
      <g transform="translate(${x} ${92 - i * 4})"><rect width="40" height="40" rx="11" fill="${c}"/><text x="20" y="27" text-anchor="middle" font-size="19" font-weight="900" fill="#fff">${t}</text>
      <rect x="6" y="44" width="28" height="14" rx="7" fill="var(--surface)" stroke="var(--line-strong)"/><text x="20" y="54.5" text-anchor="middle" font-size="9" font-weight="900" fill="var(--muted)">${i === 2 ? '確度 低' : '確度 高'}</text></g>`).join('')}
  </svg>`);
}

function checkArt() {
  const rows = [['Netflix', 'よく使った', 'var(--ok)'], ['Spotify', 'たまに', 'var(--warn)'], ['Adobe', '使ってない', 'var(--accent)']];
  return svgBox(`<svg viewBox="0 0 ${AW} ${AH}" aria-hidden="true" font-family="system-ui,sans-serif">
    <rect x="40" y="14" width="240" height="172" rx="16" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
    <text x="160" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="var(--text)">今月、使いましたか？</text>
    ${rows.map(([n, a, c], i) => `<g transform="translate(60 ${60 + i * 40})"><text x="0" y="20" font-size="14" font-weight="800" fill="var(--text)">${n}</text>
      <rect x="104" y="2" width="96" height="26" rx="13" fill="${c}"/><text x="152" y="20" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${a}</text></g>`).join('')}
  </svg>`);
}

const STEPS = [
  {
    title: 'サブスク荘へ、ようこそ',
    body: ['あなたのサブスクが、アパートの住人になります。1つのサブスクに1部屋、部屋番号つき。', '窓を押すとその部屋へ。ダークモードの夜は、窓に明かりがつきます。'],
    art: buildingArt
  },
  {
    title: '入居希望者を、審査する',
    body: ['カード明細のCSVや「ChatGPTとNetflix…」のようなメモから、サブスクっぽいものを探します。', 'あなたが確かめて入居させたものだけが、部屋になります。'],
    art: doorArt
  },
  {
    title: '模様替えで、退去させてみる',
    body: ['間取りの部屋の広さは、払っている額。部屋を押して退去させると、月・年でいくら浮くかがその場で出ます。', '無料体験中の部屋には「内見中」の札がつき、終わる前に知らせます。'],
    art: () => demoPlan(new Set(['b']), true)
  },
  {
    title: '月に1回、見回りする',
    body: ['「今月これ使った？」に答えるだけで、使っていない部屋が見えてきます。', 'データはこの端末の中だけに保存され、外には送りません。'],
    art: checkArt
  }
];
const LAST = STEPS.length; // 最後のページ（手取りとはじめ方）

export function openTutorial(store, { onDone } = {}) {
  document.querySelector('.tutorial')?.remove();
  const s = store.get();
  let step = 0;
  let mode = s.settings.takeHomeMode || 'month';
  let start = 'sample';
  let takeHome = '';
  const root = h('div', { class: 'tutorial', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'はじめての説明' });

  const finish = (opts = {}) => {
    store.update((st) => {
      st.ui.welcomed = true;
      if (opts.clear) clearSample(st);
      if (opts.takeHome != null) {
        st.settings.takeHome = mode === 'year' ? Math.round(opts.takeHome / 12) : opts.takeHome;
        st.settings.takeHomeMode = mode;
        delete st.settings.sample;
      }
    });
    root.classList.add('closing');
    setTimeout(() => root.remove(), 200);
    document.removeEventListener('keydown', onKey);
    onDone?.();
  };
  const begin = () => {
    const v = takeHome === '' ? null : Math.max(0, Number(takeHome));
    finish({ clear: start === 'empty', takeHome: v });
    toast(start === 'empty' ? 'サブスク荘をはじめました。「入居希望」から部屋を探しましょう' : 'サンプルは、ホームの「サンプルを消す」でいつでも消せます');
  };
  const goTo = (n) => { step = Math.max(0, Math.min(LAST, n)); render(); };
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') finish();
    if (e.key === 'ArrowRight' && step < LAST) goTo(step + 1);
    if (e.key === 'ArrowLeft' && step > 0) goTo(step - 1);
  };

  function lastPage() {
    const input = h('input', {
      type: 'number', inputmode: 'numeric', min: '0', value: takeHome, placeholder: mode === 'year' ? '例：3200000' : '例：240000', 'aria-label': '手取り（円）',
      onInput: (e) => { takeHome = e.target.value; }
    });
    return [
      breakdownArt(),
      h('h2', { class: 'tut-title' }, 'さいごに、手取りを教えてください'),
      h('p', { class: 'tut-body' }, '入れると、手取りのうちサブスク・家賃・通信費・自由に使えるお金がいくらずつかが分かります。あとからでも入れられます。'),
      h('div', { class: 'tut-form' },
        h('div', { class: 'tut-row' },
          segmented([{ id: 'month', label: '月' }, { id: 'year', label: '年' }], mode, (v) => {
            mode = v;
            input.placeholder = v === 'year' ? '例：3200000' : '例：240000';
          }, '手取りの単位'),
          input),
        h('div', { class: 'tut-row' },
          h('span', { class: 'field-label' }, 'はじめ方'),
          segmented([{ id: 'sample', label: 'サンプルを見ながら' }, { id: 'empty', label: '空っぽから' }], start, (v) => { start = v; }, 'はじめ方')))
    ];
  }

  function render() {
    const last = step === LAST;
    const st = STEPS[step];
    const content = last ? lastPage() : [st.art(), h('h2', { class: 'tut-title' }, st.title), ...st.body.map((p) => h('p', { class: 'tut-body' }, p))];
    root.replaceChildren(
      h('div', { class: 'tut-panel' },
        h('div', { class: 'tut-top' },
          h('span', { class: 'tut-count' }, `${step + 1} / ${LAST + 1}`),
          h('button', { type: 'button', class: 'tut-skip', onClick: () => finish() }, 'スキップ')),
        h('div', { class: 'tut-content' }, content),
        h('div', { class: 'tut-nav' },
          // 1ページ目も「もどる」の場所を空けておく（ほかのボタンがずれないように）
          h('button', { type: 'button', class: 'btn ghost', style: { visibility: step ? 'visible' : 'hidden' }, onClick: () => goTo(step - 1) }, 'もどる'),
          h('div', { class: 'tut-dots', 'aria-hidden': 'true' }, Array.from({ length: LAST + 1 }, (_, k) => h('span', { class: k === step ? 'on' : '' }))),
          h('button', { type: 'button', class: 'btn primary', onClick: () => (last ? begin() : goTo(step + 1)) }, last ? 'はじめる' : '次へ'))));
    root.querySelector('.tut-content')?.animate?.([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }

  document.body.append(root);
  document.addEventListener('keydown', onKey);
  render();
}
