import { store } from './store.js';
import { closeSheet } from './ui.js';
import { renderHome, leaveHome } from './views/home.js';
import { renderImport } from './views/import.js';
import { renderContracts } from './views/contracts.js';
import { renderSettings } from './views/settings.js';
import { openTutorial } from './views/tutorial.js';
import { todayYmd, diffDays } from './dates.js';
import { installPressFeedback, setHaptics } from './feel.js';
import { LOGO_DAY, LOGO_NIGHT } from './logo.js';

// 画面の切り替えは URL の # で行う（GitHub Pages のサブパス配下でもそのまま動く）
const ROUTES = { home: renderHome, import: renderImport, contracts: renderContracts, settings: renderSettings };
const TITLES = { home: 'サブスク荘', import: '入居希望', contracts: '部屋', settings: '設定' };
let current = null;

const routeOf = () => {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES[r] ? r : 'home';
};
export const go = (r) => {
  if (routeOf() === r) render();
  else location.hash = `#/${r}`;
};

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

// ホーム画面のアイコンに数字（入居希望者＋3日以内に終わる無料体験）。対応している端末だけ
function updateBadge(state) {
  if (!('setAppBadge' in navigator)) return;
  const today = todayYmd();
  const trials = state.contracts.filter((c) => c.trial?.on && c.trial.endDate && diffDays(today, c.trial.endDate) >= 0 && diffDays(today, c.trial.endDate) <= 3).length;
  const n = state.candidates.length + trials;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

function render() {
  const r = routeOf();
  if (current === 'home' && r !== 'home') leaveHome();
  current = r;
  const state = store.get();
  applyTheme(state.settings.theme);
  setHaptics(state.settings.haptics);
  document.title = r === 'home' ? 'サブスク荘' : `${TITLES[r]}｜サブスク荘`;
  for (const a of document.querySelectorAll('.tabbar a')) {
    a.setAttribute('aria-current', a.dataset.route === r ? 'page' : 'false');
  }
  const badge = document.querySelector('.tabbar [data-route="import"] .tab-badge');
  badge.textContent = state.candidates.length || '';
  badge.hidden = !state.candidates.length;
  ROUTES[r](document.getElementById('view'), store, go);
  updateBadge(state);
}

// 画面を切り替えたときだけ、中身を下からふわっと出す
function enter() {
  const view = document.getElementById('view');
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
  clearTimeout(enter.t);
  enter.t = setTimeout(() => view.classList.remove('enter'), 900);
}

window.addEventListener('hashchange', () => {
  closeSheet();
  enter();
  render();
  window.scrollTo(0, 0);
});
// 看板：昼はホーロー看板、夜（ダーク）はネオン。文字はフォントから作った図形
const logoSvg = (l) => `<svg viewBox="${l.viewBox}" focusable="false"><path d="${l.d}"/></svg>`;
document.querySelector('.sign-day').innerHTML = logoSvg(LOGO_DAY);
document.querySelector('.sign-night').innerHTML = logoSvg(LOGO_NIGHT);

store.subscribe(render);
installPressFeedback();
enter();
render();
if (!store.get().ui.welcomed) openTutorial(store);

// オフラインで動くように、アプリ本体をキャッシュする。新しい版が入ったら一度だけ読み込み直す
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 登録できなくても普通に使える */ });
  });
}
