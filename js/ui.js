import { nfkc, formatYen } from './text.js';

// 小さな DOM 組み立て係。h('div', { class: 'x', onClick }, '文字', 子要素...)
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const yen = (n) => (n == null ? '—' : `${formatYen(n)}円`);
export const money = (n) => (n == null ? '—' : formatYen(n));

// ロゴの代わり：サービス名の頭文字と、名前から決まる色のタイル
export function tile(name, size = 'm') {
  const s = nfkc(name).trim();
  const first = [...s][0] || '?';
  let hash = 0;
  for (const ch of s) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  const hue = hash % 360;
  return h('span', { class: `tile tile-${size}`, style: { '--tile-h': String(hue) }, 'aria-hidden': 'true' }, /[a-z]/i.test(first) ? first.toUpperCase() : first);
}

// ---------- 下から出るシート ----------
let sheetCleanup = null;
export function openSheet(title, build, { onClose } = {}) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  const close = () => closeSheet();
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
      h('h2', { class: 'sheet-title' }, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': '閉じる', onClick: close }, '✕')),
    h('div', { class: 'sheet-body' }, build(close)));
  const backdrop = h('div', { class: 'sheet-backdrop', onClick: close });
  root.replaceChildren(backdrop, panel);
  root.hidden = false;
  document.body.classList.add('sheet-open');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  sheetCleanup = () => { document.removeEventListener('keydown', onKey); onClose?.(); };
  requestAnimationFrame(() => panel.querySelector('input, select, textarea, button:not(.icon-btn)')?.focus({ preventScroll: true }));
}
export function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (!root || root.hidden) return;
  root.replaceChildren();
  root.hidden = true;
  document.body.classList.remove('sheet-open');
  const done = sheetCleanup;
  sheetCleanup = null;
  done?.();
}

// 確認（ブラウザの confirm の代わり）。はい → true、やめる・閉じる → false
export function ask(message, { ok = 'はい', cancel = 'やめる', danger = false, title = '確認' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet(title, (close) => h('div', { class: 'form' },
      h('p', { class: 'ask-msg' }, message),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => { answered = true; close(); resolve(true); } }, ok),
        h('button', { type: 'button', class: 'btn', onClick: close }, cancel))),
    { onClose: () => { if (!answered) resolve(false); } });
  });
}

// 画像などを共有する。共有シートが使えない端末では保存（ダウンロード）にする
export async function shareOrSave(blob, name, text) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

// ---------- 小さなお知らせ ----------
let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ファイルを保存させる（JSON バックアップ・.ics）
export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 選択肢のボタン（セグメント）
export function segmented(options, value, onChange, label) {
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  for (const o of options) {
    group.append(h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(o.id === value), class: o.id === value ? 'on' : '',
      onClick: (e) => {
        for (const b of group.children) {
          const on = b === e.currentTarget;
          b.classList.toggle('on', on);
          b.setAttribute('aria-checked', String(on));
        }
        onChange(o.id);
      }
    }, o.label));
  }
  return group;
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function select(options, value, onChange, attrs = {}) {
  return h('select', { ...attrs, onChange: (e) => onChange(e.target.value) },
    options.map((o) => h('option', { value: o.id, selected: o.id === value }, o.label)));
}

// 数字の入力（空欄は null）
export function numberInput(value, onChange, attrs = {}) {
  return h('input', {
    type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: value ?? '', ...attrs,
    onInput: (e) => onChange(e.target.value === '' ? null : Number(e.target.value))
  });
}
