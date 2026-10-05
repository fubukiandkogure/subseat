import { h, toast, segmented } from '../ui.js';
import { layoutSubs, planSvg, readPalette } from '../plan.js';
import { clearSample } from '../store.js';

// 初回に出るチュートリアル（設定からもう一度見られる）
const DEMO = [
  { id: 'a', name: 'ChatGPT', category: 'ai', value: 36000, jo: 3.6 },
  { id: 'b', name: 'Netflix', category: 'video', value: 19080, jo: 1.9 },
  { id: 'c', name: 'Spotify', category: 'music', value: 11760, jo: 1.2 },
  { id: 'd', name: 'iCloud+', category: 'cloud', value: 4800, jo: 0.5, status: 'keep' }
];

function demoPlan(vacant = new Set(), trial = false) {
  const rooms = DEMO.map((r) => (trial && r.id === 'c' ? { ...r, trial: true } : r));
  return planSvg(layoutSubs(rooms, 320, 230), { w: 320, h: 230, vacant, amountLabel: (r) => `${Math.round(r.value).toLocaleString('ja-JP')}円/年`, palette: readPalette() });
}

const svgBox = (markup) => { const d = h('div', { class: 'tut-art' }); d.innerHTML = markup; return d; };

function doorArt() {
  return svgBox(`<svg viewBox="0 0 320 200" width="100%" aria-hidden="true" font-family="system-ui,sans-serif">
    <rect x="18" y="150" width="284" height="8" rx="4" fill="var(--line-strong)"/>
    <rect x="34" y="34" width="86" height="116" rx="6" fill="var(--surface-2)" stroke="var(--plan-wall)" stroke-width="4"/>
    <circle cx="104" cy="94" r="5" fill="var(--plan-wall)"/>
    <text x="77" y="26" text-anchor="middle" font-size="13" font-weight="900" fill="var(--muted)">サブスク荘</text>
    ${[['N', 'var(--cat-video)', 150], ['C', 'var(--cat-ai)', 200], ['?', 'var(--cat-other)', 250]].map(([t, c, x], i) => `
      <g transform="translate(${x} ${92 - i * 4})"><rect width="40" height="40" rx="11" fill="${c}"/><text x="20" y="27" text-anchor="middle" font-size="19" font-weight="900" fill="#fff">${t}</text>
      <rect x="6" y="44" width="28" height="14" rx="7" fill="var(--surface)" stroke="var(--line-strong)"/><text x="20" y="54.5" text-anchor="middle" font-size="9" font-weight="900" fill="var(--muted)">${i === 2 ? '確度 低' : '確度 高'}</text></g>`).join('')}
  </svg>`);
}

function checkArt() {
  const rows = [['Netflix', 'よく使った', 'var(--ok)'], ['Spotify', 'たまに', 'var(--warn)'], ['Adobe', '使ってない', 'var(--accent)']];
  return svgBox(`<svg viewBox="0 0 320 200" width="100%" aria-hidden="true" font-family="system-ui,sans-serif">
    <rect x="40" y="14" width="240" height="176" rx="16" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
    <text x="160" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="var(--text)">今月、使いましたか？</text>
    ${rows.map(([n, a, c], i) => `<g transform="translate(60 ${62 + i * 40})"><text x="0" y="20" font-size="14" font-weight="800" fill="var(--text)">${n}</text>
      <rect x="104" y="2" width="96" height="26" rx="13" fill="${c}"/><text x="152" y="20" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${a}</text></g>`).join('')}
  </svg>`);
}

const STEPS = [
  {
    title: 'サブスク荘へ、ようこそ',
    body: ['あなたのサブスクを、アパートの部屋にして並べます。', '部屋の広さは払っている額。1畳＝年1万円です。大きい部屋ほど、1年で払う額が大きい。'],
    art: () => svgBox(demoPlan())
  },
  {
    title: '入居希望者を、審査する',
    body: ['カード明細のCSVや「ChatGPTとNetflix…」のようなメモから、サブスクっぽいものを探します。', '見つかったものはまず「入居希望者」。あなたが確かめて入居させたものだけが、部屋になります。'],
    art: doorArt
  },
  {
    title: '模様替えで、退去させてみる',
    body: ['やめるか迷ったら「模様替え」。部屋を退去させると、何畳ひろくなって、月・年でいくら浮くかがその場で出ます。', '無料体験中の部屋には「内見中」の札がつき、終わる前に知らせます。'],
    art: () => svgBox(demoPlan(new Set(['b']), true))
  },
  {
    title: '月に1回、見回りする',
    body: ['「今月これ使った？」に答えるだけの見回りで、使っていない部屋が見えてきます。', '支払い予定はカレンダーにも書き出せます。データはこの端末の中だけに保存され、外には送りません。'],
    art: checkArt
  }
];

export function openTutorial(store, { onDone } = {}) {
  document.querySelector('.tutorial')?.remove();
  const s = store.get();
  let step = 0;
  let mode = s.settings.takeHomeMode || 'month';
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
  const onKey = (e) => {
    if (e.key === 'Escape') finish();
    if (e.key === 'ArrowRight' && step < STEPS.length) { step++; render(); }
    if (e.key === 'ArrowLeft' && step > 0) { step--; render(); }
  };

  function dots() {
    return h('div', { class: 'tut-dots', 'aria-hidden': 'true' }, [...STEPS, null].map((_, k) => h('span', { class: k === step ? 'on' : '' })));
  }

  function render() {
    let content;
    if (step < STEPS.length) {
      const st = STEPS[step];
      content = [
        st.art(),
        h('h2', { class: 'tut-title' }, st.title),
        ...st.body.map((p) => h('p', { class: 'tut-body' }, p)),
        h('div', { class: 'tut-nav' },
          step > 0 ? h('button', { type: 'button', class: 'btn ghost', onClick: () => { step--; render(); } }, 'もどる') : h('span'),
          dots(),
          h('button', { type: 'button', class: 'btn primary', onClick: () => { step++; render(); } }, '次へ'))
      ];
    } else {
      const input = h('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: mode === 'year' ? '例：3200000' : '例：240000', 'aria-label': '手取り' });
      const read = () => (input.value === '' ? null : Math.max(0, Number(input.value)));
      content = [
        h('h2', { class: 'tut-title' }, 'さいごに、手取りを教えてください'),
        h('p', { class: 'tut-body' }, '入れると「手取りの家」が見えます。家賃・通信費・サブスク棟と、自由に使えるお金（リビング）の広さです。あとから設定でも入れられます。'),
        h('div', { class: 'tut-form' },
          segmented([{ id: 'month', label: '月の手取り' }, { id: 'year', label: '年の手取り（ボーナス込み）' }], mode, (v) => {
            mode = v;
            input.placeholder = v === 'year' ? '例：3200000' : '例：240000';
          }, '手取りの入れ方'),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, '手取り（円）'), input)),
        h('div', { class: 'tut-start' },
          h('button', { type: 'button', class: 'btn primary', onClick: () => { finish({ clear: true, takeHome: read() }); toast('サブスク荘をはじめました。まずは「取り込み」から入居希望者を探しましょう'); } }, '空っぽの状態から始める'),
          h('button', { type: 'button', class: 'btn', onClick: () => { finish({ takeHome: read() }); toast('サンプルのサブスク荘を表示しています。設定から消せます'); } }, 'サンプルを見ながら始める')),
        h('div', { class: 'tut-nav' },
          h('button', { type: 'button', class: 'btn ghost', onClick: () => { step--; render(); } }, 'もどる'),
          dots(),
          h('span'))
      ];
    }
    root.replaceChildren(
      h('div', { class: 'tut-panel' },
        h('button', { type: 'button', class: 'tut-skip', onClick: () => finish() }, 'スキップ'),
        h('div', { class: 'tut-content', key: step }, content)));
    root.querySelector('.tut-content')?.animate?.([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }

  document.body.append(root);
  document.addEventListener('keydown', onKey);
  render();
}
