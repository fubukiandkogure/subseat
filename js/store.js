import { DEFAULT_SETTINGS, assignRoomNumbers } from './model.js';
import { sampleState } from './sample.js';
import { todayYmd } from './dates.js';
import { migrate, SCHEMA } from './migrate.js';

// データはこの端末のブラウザ（localStorage）にだけ置く。外には送らない。
// キーは最初の版（サブスク席）から変えていない（前のデータをそのまま引き継ぐため）
const KEY = 'subseat:v1';
export { SCHEMA };

export function emptyState() {
  return {
    schema: SCHEMA, settings: { ...DEFAULT_SETTINGS }, contracts: [], candidates: [], ignored: [], former: [],
    lastInspection: null, ui: { mode: 'year', view: 'subs', calView: 'list', welcomed: false }
  };
}

function withDefaults(raw) {
  const s = migrate(raw);
  const base = emptyState();
  return assignRoomNumbers({
    ...base, ...s,
    settings: { ...base.settings, ...(s.settings || {}) },
    ui: { ...base.ui, ...(s.ui || {}) },
    contracts: Array.isArray(s.contracts) ? s.contracts : [],
    candidates: Array.isArray(s.candidates) ? s.candidates : [],
    ignored: Array.isArray(s.ignored) ? s.ignored : [],
    former: Array.isArray(s.former) ? s.former : []
  });
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch { /* 読めなければ初回扱い */ }
  const s = emptyState();
  const sample = sampleState(todayYmd());
  s.settings = { ...s.settings, ...sample.settings };
  s.contracts = sample.contracts;
  s.former = sample.former;
  return assignRoomNumbers(s);
}

let state = load();
const listeners = new Set();
let timer = null;

function save() {
  clearTimeout(timer);
  timer = null;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 容量不足などは次の変更で再挑戦 */ }
}
function persist() {
  clearTimeout(timer);
  timer = setTimeout(save, 120);
}
// アプリを閉じる・裏に回すときは、待たずにすぐ保存する
if (typeof window !== 'undefined') {
  const flush = () => { if (timer) save(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

export const store = {
  get: () => state,
  update(fn) {
    const next = structuredClone(state);
    fn(next);
    assignRoomNumbers(next);
    state = next;
    persist();
    listeners.forEach((l) => l(state));
  },
  replace(next) {
    state = withDefaults(next);
    persist();
    listeners.forEach((l) => l(state));
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};

export const hasSample = (s) => !!s.settings.sample || [...s.contracts, ...s.candidates, ...s.former].some((c) => c.sample);

export function clearSample(s) {
  s.contracts = s.contracts.filter((c) => !c.sample);
  s.candidates = s.candidates.filter((c) => !c.sample);
  s.former = s.former.filter((c) => !c.sample);
  if (s.settings.sample) {
    const { theme } = s.settings;
    s.settings = { ...DEFAULT_SETTINGS, theme };
  }
  s.lastInspection = null;
}

// バックアップ（端末間の移行にも使う）
export function exportJson(s) {
  const { ui, ...data } = s;
  return JSON.stringify({ app: 'subseat', schema: SCHEMA, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function parseBackup(text) {
  const obj = JSON.parse(text);
  if (obj?.app !== 'subseat' || !obj.data) throw new Error('サブスク荘のバックアップファイルではありません');
  if (obj.schema > SCHEMA) throw new Error('新しい版のアプリで書き出されたファイルです。アプリを更新してから読み込んでください');
  return withDefaults({ ...obj.data, schema: obj.schema || obj.data.schema || 1, ui: state.ui });
}
