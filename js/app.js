import { store } from './store.js';
import { closeSheet } from './ui.js';
import { renderHome, leaveHome } from './views/home.js';
import { renderImport } from './views/import.js';
import { renderContracts } from './views/contracts.js';
import { renderSettings } from './views/settings.js';

// 画面の切り替えは URL の # で行う（GitHub Pages のサブパス配下でもそのまま動く）
const ROUTES = { home: renderHome, import: renderImport, contracts: renderContracts, settings: renderSettings };
const TITLES = { home: 'ホーム', import: '取り込み', contracts: '契約', settings: '設定' };
let current = null;

const routeOf = () => {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES[r] ? r : 'home';
};
export const go = (r) => { location.hash = `#/${r}`; };

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

function render() {
  const r = routeOf();
  if (current === 'home' && r !== 'home') leaveHome();
  current = r;
  const state = store.get();
  applyTheme(state.settings.theme);
  document.title = r === 'home' ? 'サブスク席' : `${TITLES[r]}｜サブスク席`;
  for (const a of document.querySelectorAll('.tabbar a')) {
    a.setAttribute('aria-current', a.dataset.route === r ? 'page' : 'false');
  }
  const badge = document.querySelector('.tabbar [data-route="import"] .tab-badge');
  badge.textContent = state.candidates.length || '';
  badge.hidden = !state.candidates.length;
  ROUTES[r](document.getElementById('view'), store, go);
}

window.addEventListener('hashchange', () => {
  closeSheet();
  render();
  window.scrollTo(0, 0);
});
store.subscribe(render);
render();

// オフラインで動くように、アプリ本体をキャッシュする
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 登録できなくても普通に使える */ });
  });
}
