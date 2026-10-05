import { DEFAULT_SETTINGS } from './model.js';
import { sampleState } from './sample.js';
import { todayYmd } from './dates.js';

// データはこの端末のブラウザ（localStorage）にだけ置く。外には送らない。
const KEY = 'subseat:v1';
export const SCHEMA = 1;

export function emptyState() {
  return { schema: SCHEMA, settings: { ...DEFAULT_SETTINGS }, contracts: [], candidates: [], ignored: [], ui: { mode: 'month' } };
}

function withDefaults(s) {
  const base = emptyState();
  return {
    ...base, ...s,
    settings: { ...base.settings, ...(s.settings || {}) },
    ui: { ...base.ui, ...(s.ui || {}) },
    contracts: Array.isArray(s.contracts) ? s.contracts : [],
    candidates: Array.isArray(s.candidates) ? s.candidates : [],
    ignored: Array.isArray(s.ignored) ? s.ignored : []
  };
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
  return s;
}

let state = load();
const listeners = new Set();
let timer = null;

function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 容量不足などは無視（次の変更で再挑戦） */ }
  }, 120);
}

export const store = {
  get: () => state,
  update(fn) {
    const next = structuredClone(state);
    fn(next);
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

export const hasSample = (s) => !!s.settings.sample || s.contracts.some((c) => c.sample) || s.candidates.some((c) => c.sample);

export function clearSample(s) {
  s.contracts = s.contracts.filter((c) => !c.sample);
  s.candidates = s.candidates.filter((c) => !c.sample);
  if (s.settings.sample) {
    const { theme } = s.settings;
    s.settings = { ...DEFAULT_SETTINGS, theme };
  }
}

// バックアップ（端末間の移行にも使う）
export function exportJson(s) {
  const { ui, ...data } = s;
  return JSON.stringify({ app: 'subseat', schema: SCHEMA, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function parseBackup(text) {
  const obj = JSON.parse(text);
  if (obj?.app !== 'subseat' || !obj.data) throw new Error('サブスク席のバックアップファイルではありません');
  if (obj.schema > SCHEMA) throw new Error('新しい版のアプリで書き出されたファイルです。アプリを更新してから読み込んでください');
  return withDefaults({ ...obj.data, ui: state.ui });
}
