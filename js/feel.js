// さわり心地：押したときの小さな振動、数字のカウントアップ、できたときの小さな紙ふぶき。
// 動きを減らす設定の端末では、動きを出さない（数字はすぐ最終の値になる）。
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let hapticsOn = true;
export const setHaptics = (on) => { hapticsOn = on !== false; };

// 振動（Android の Chrome などだけ。iPhone の Safari は対応していない）
export function haptic(kind = 'tap') {
  if (!hapticsOn || !navigator.vibrate) return;
  const p = { tap: 6, select: 10, success: [12, 60, 18], warn: [20, 40, 20] }[kind] ?? 6;
  try { navigator.vibrate(p); } catch { /* 振動できない */ }
}

// 押せるものを押したら、軽く振動（画面ごとに付けなくていいように、まとめて拾う）
const PRESSABLE = '.btn, .seg button, .alert, .row:not(.static), .event-btn, .room, .tabbar a, .cal-cell.has, .icon-btn, .former-card, .tap-amount, .next-pay';
export function installPressFeedback() {
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest?.(PRESSABLE);
    if (el && !el.disabled) haptic('tap');
  }, { passive: true });
}

// 数字のカウントアップ。key ごとに前の値を覚えておき、変わったときだけ動かす
const last = new Map();
const ease = (t) => 1 - Math.pow(1 - t, 3);
export function countUp(el, to, format, key, duration = 520) {
  const from = last.get(key);
  last.set(key, to);
  el.textContent = format(to);
  if (from == null || from === to || reduced()) return;
  const t0 = performance.now();
  const step = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, (now - t0) / duration);
    el.textContent = format(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = format(from);
  requestAnimationFrame(step);
}

// 小さな紙ふぶき（解約できた・見回りおわり など、うれしいときだけ）
export function burst(x, y, colors = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--cat-ai)', 'var(--cat-cloud)']) {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'burst';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const n = 22;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const d = 60 + Math.random() * 70;
    p.style.background = colors[i % colors.length];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    layer.append(p);
    p.animate([
      { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 40}px)) scale(0.6) rotate(${Math.random() * 540}deg)`, opacity: 0 }
    ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
  }
  setTimeout(() => layer.remove(), 1100);
}

// 要素の真ん中から紙ふぶき
export function burstFrom(el, colors) {
  const r = el?.getBoundingClientRect?.();
  if (r) burst(r.left + r.width / 2, r.top + r.height / 2, colors);
}
