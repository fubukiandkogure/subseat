import { nfkc, formatYen } from './text.js';
import { countUp, haptic } from './feel.js';

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
// 閉じるときは下に滑らせる。上の帯（つまみ）を下に引っぱっても閉じられる
let sheetCleanup = null;
let sheetSeq = 0;
export function openSheet(title, build, { onClose } = {}) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  const seq = ++sheetSeq;
  const close = () => closeSheet(true);
  const head = h('div', { class: 'sheet-head' },
    h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    h('h2', { class: 'sheet-title' }, title),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': '閉じる', onClick: close }, '✕'));
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, head, h('div', { class: 'sheet-body' }, build(close)));
  const backdrop = h('div', { class: 'sheet-backdrop', onClick: close });
  root.replaceChildren(backdrop, panel);
  root.hidden = false;
  document.body.classList.add('sheet-open');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  sheetCleanup = () => { document.removeEventListener('keydown', onKey); onClose?.(); };
  dragToClose(head, panel, backdrop, () => seq === sheetSeq && closeSheet(true));
  requestAnimationFrame(() => panel.querySelector('input, select, textarea, button:not(.icon-btn)')?.focus({ preventScroll: true }));
}

function dragToClose(handle, panel, backdrop, close) {
  let y0 = null, t0 = 0, dy = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    y0 = e.clientY; t0 = performance.now(); dy = 0;
    handle.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(Math.max(0.2, 1 - dy / 400));
  });
  const end = () => {
    if (y0 == null) return;
    const fast = dy / Math.max(1, performance.now() - t0) > 0.5;
    y0 = null;
    if (dy > 110 || (dy > 30 && fast)) { close(); return; }
    panel.style.transition = 'transform .22s cubic-bezier(.2,.9,.3,1.2)';
    panel.style.transform = '';
    backdrop.style.opacity = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

export function closeSheet(animate = false) {
  const root = document.getElementById('sheet-root');
  if (!root || root.hidden || !sheetCleanup) return;
  const seq = sheetSeq;
  document.body.classList.remove('sheet-open');
  const done = sheetCleanup;
  sheetCleanup = null;
  const panel = root.querySelector('.sheet');
  const remove = () => {
    if (seq !== sheetSeq) return; // もう次のシートが開いている
    root.replaceChildren();
    root.hidden = true;
  };
  if (animate && panel && !reducedMotion()) {
    root.style.pointerEvents = 'none';
    const from = getComputedStyle(panel).transform;
    panel.animate([{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: 'translateY(105%)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    root.querySelector('.sheet-backdrop')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    setTimeout(() => { root.style.pointerEvents = ''; remove(); }, 190);
  } else {
    remove();
  }
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
// action を渡すと「元に戻す」などのボタン付きで、少し長めに出す
let toastTimer = null;
export function toast(msg, { action, onAction, duration } = {}) {
  const el = document.getElementById('toast');
  el.replaceChildren(h('span', null, msg), action ? h('button', { type: 'button', class: 'toast-action', onClick: () => { el.classList.remove('show'); onAction?.(); } }, action) : null);
  el.classList.toggle('has-action', !!action);
  el.classList.remove('show');
  void el.offsetWidth; // 出し直しのアニメーション
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration ?? (action ? 5000 : 2600));
}

// 元に戻せる操作：やる前の状態を覚えておき、お知らせの「元に戻す」で戻す（表示の設定はそのまま）
export function undoable(store, message, mutate) {
  const before = structuredClone(store.get());
  if (mutate.length === 0) mutate(); // 自分で store を更新する処理（入居させる など）
  else store.update(mutate);
  toast(message, {
    action: '元に戻す',
    onAction: () => {
      store.update((s) => { const ui = s.ui; Object.assign(s, structuredClone(before)); s.ui = ui; });
      haptic('select');
      toast('元に戻しました');
    }
  });
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
// 大きな金額（月額／年額の切り替えに合わせる）と、もう片方の額
// key を渡すと、前に出した数字からカウントアップする。onTap を渡すと、押して月／年を切り替えられる
export function bigAmount(monthly, yearMode, { key, onTap } = {}) {
  const value = yearMode ? monthly * 12 : monthly;
  const num = h('span', { class: 'num' }, money(value));
  if (key) countUp(num, value, (v) => money(v), key);
  const kids = [h('span', { class: 'per' }, yearMode ? '年' : '月'), num, h('span', { class: 'unit' }, '円')];
  if (!onTap) return h('p', { class: 'big' }, kids);
  return h('button', { type: 'button', class: 'big tap-amount', 'aria-label': `${yearMode ? '年' : '月'} ${money(value)}円。押すと${yearMode ? '月' : '年'}の額にします`, onClick: onTap }, kids);
}
export const otherAmount = (monthly, yearMode) => (yearMode ? `月 ${money(monthly)}円` : `年 ${money(monthly * 12)}円`);

// 月額／年額の切り替え（ホームと部屋の一覧で同じものを使う）
export function modeToggle(store) {
  return segmented([{ id: 'month', label: '月額' }, { id: 'year', label: '年額' }], store.get().ui.mode, (m) => store.update((s) => { s.ui.mode = m; }), '金額の出し方');
}
export function flipMode(store) {
  haptic('select');
  store.update((s) => { s.ui.mode = s.ui.mode === 'year' ? 'month' : 'year'; });
}

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
