import { addDays, addMonths, diffDays, rollForward, nextCycleDate, parseYmd, daysInMonth, weekday } from './dates.js';

export const CATEGORIES = [
  { id: 'video', label: '動画' },
  { id: 'ai', label: 'AI' },
  { id: 'music', label: '音楽' },
  { id: 'cloud', label: 'クラウド・ツール' },
  { id: 'game', label: 'ゲーム' },
  { id: 'other', label: 'その他' },
  { id: 'fixed', label: '固定費' }
];
export const SUB_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'fixed');
export const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || CATEGORIES[5]).label;

export const CHANNELS = [
  { id: 'direct', label: '直接' },
  { id: 'appstore', label: 'App Store' },
  { id: 'googleplay', label: 'Google Play' },
  { id: 'other', label: 'その他' }
];
export const STATUSES = [
  { id: 'keep', label: '続ける' },
  { id: 'review', label: '見直す' },
  { id: 'cancel', label: '解約予定' }
];

export const DEFAULT_SETTINGS = {
  takeHome: null,          // 月の手取り（年で入れたときも、ここには12で割った額を持つ）
  takeHomeMode: 'month',   // 入力欄を「月」「年」のどちらで見せるか
  rent: null, phone: null, usdJpy: 150,
  theme: 'auto',
  haptics: true            // 押したときの小さな振動（対応端末だけ）
};

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newContract(fields = {}) {
  return {
    id: fields.id || uid(), name: '', category: 'other', amount: null, currency: 'JPY', cycle: 'month',
    nextDate: null, channel: 'direct', cancelUrl: '', status: 'keep', trial: { on: false, endDate: null },
    serviceId: null, keys: [], since: null, history: [], usage: [], createdAt: new Date().toISOString(), ...fields
  };
}

// ---------- お金 ----------
export function chargeYen(c, rate) {
  if (c.amount == null || !(c.amount >= 0)) return null;
  return c.currency === 'USD' ? c.amount * (rate > 0 ? rate : DEFAULT_SETTINGS.usdJpy) : c.amount;
}
export function monthlyYen(c, rate) {
  const y = chargeYen(c, rate);
  if (y == null) return null;
  return c.cycle === 'year' ? y / 12 : y;
}
export function yearlyYen(c, rate) {
  const m = monthlyYen(c, rate);
  return m == null ? null : m * 12;
}

// 金額が変わったら記録しておく（値上げの検知と「金額の推移」に使う）
export function recordPrice(c, today) {
  if (c.amount == null) return c;
  const h = c.history || [];
  const last = h[h.length - 1];
  if (!last || last.amount !== c.amount || last.currency !== c.currency || last.cycle !== c.cycle) {
    c.history = [...h, { date: today, amount: c.amount, currency: c.currency, cycle: c.cycle }];
  }
  return c;
}

// 最近（既定で120日以内）値上がりしたか
export function recentRaise(c, today, days = 120) {
  const h = c.history || [];
  if (h.length < 2) return null;
  const a = h[h.length - 2], b = h[h.length - 1];
  if (!b.date || a.currency !== b.currency || a.cycle !== b.cycle) return null;
  if (b.amount > a.amount && diffDays(b.date, today) <= days) return { from: a.amount, to: b.amount, date: b.date };
  return null;
}

export function fixedItems(settings) {
  const out = [];
  if (settings.rent > 0) out.push({ id: 'fixed:rent', kind: 'fixed', name: '家賃', category: 'fixed', monthly: settings.rent, icon: 'rent' });
  if (settings.phone > 0) out.push({ id: 'fixed:phone', kind: 'fixed', name: '通信費', category: 'fixed', monthly: settings.phone, icon: 'phone' });
  return out;
}

export function totals(state) {
  const { settings, contracts } = state;
  const rate = settings.usdJpy;
  let subs = 0, unknown = 0;
  for (const c of contracts) {
    const m = monthlyYen(c, rate);
    if (m == null) unknown++;
    else subs += m;
  }
  const fixed = fixedItems(settings).reduce((a, f) => a + f.monthly, 0);
  const takeHome = settings.takeHome > 0 ? settings.takeHome : null;
  const reserved = subs + (takeHome ? fixed : 0);
  return { subs, fixed, reserved, takeHome, free: takeHome ? takeHome - reserved : null, unknown };
}

// ---------- 部屋番号 ----------
// 1フロア4部屋（101〜104, 201〜204 …）。空いている一番小さい番号に入居する。退去すると番号が空く
export const ROOMS_PER_FLOOR = 4;
export const roomNoAt = (k) => (Math.floor(k / ROOMS_PER_FLOOR) + 1) * 100 + (k % ROOMS_PER_FLOOR) + 1;
const validRoomNo = (n) => Number.isInteger(n) && n >= 101 && n % 100 >= 1 && n % 100 <= ROOMS_PER_FLOOR;
export function assignRoomNumbers(s) {
  const used = new Set();
  for (const c of s.contracts) {
    if (validRoomNo(c.roomNo) && !used.has(c.roomNo)) used.add(c.roomNo);
    else c.roomNo = null; // 番号なし・重複（再入居で取られていた など）は振り直す
  }
  let k = 0;
  for (const c of s.contracts) {
    if (c.roomNo) continue;
    while (used.has(roomNoAt(k))) k++;
    c.roomNo = roomNoAt(k);
    used.add(c.roomNo);
  }
  return s;
}
export const roomLabel = (c) => (c?.roomNo ? `${c.roomNo}号室` : '');

// ---------- 間取り ----------
// 面積を値に比例させて長方形を分ける（squarified treemap）。大きいものほど左上に来る。
export function squarify(items, x, y, w, h) {
  const list = items.filter((i) => i.value > 0);
  const total = list.reduce((a, i) => a + i.value, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  let rest = list.map((item) => ({ item, area: item.value * scale }));
  const worst = (row, len) => {
    const s = row.reduce((a, r) => a + r.area, 0);
    let m = 0;
    for (const r of row) m = Math.max(m, (len * len * r.area) / (s * s), (s * s) / (len * len * r.area));
    return m;
  };
  const out = [];
  let rx = x, ry = y, rw = w, rh = h;
  while (rest.length) {
    const len = Math.min(rw, rh);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) row.push(rest[i++]);
    const s = row.reduce((a, r) => a + r.area, 0);
    const thick = s / len;
    let off = 0;
    for (const r of row) {
      const l = r.area / thick;
      out.push(rw >= rh ? { ...r.item, x: rx, y: ry + off, w: thick, h: l } : { ...r.item, x: rx + off, y: ry, w: l, h: thick });
      off += l;
    }
    if (rw >= rh) { rx += thick; rw -= thick; } else { ry += thick; rh -= thick; }
    rest = rest.slice(row.length);
  }
  return out;
}

// サブスク荘の部屋（年額の大きい順）。部屋の広さは年額に比例。金額未確定のものは広さが決まらないので入れない
export function planRooms(state, today) {
  const { settings: s, contracts } = state;
  return contracts
    .map((c) => ({ c, y: yearlyYen(c, s.usdJpy) }))
    .filter((x) => x.y != null && x.y > 0)
    .sort((a, b) => b.y - a.y)
    .map(({ c, y }) => ({
      id: c.id, kind: 'sub', name: c.name, category: c.category, value: y, roomNo: c.roomNo,
      status: c.status, trial: !!c.trial?.on, raise: recentRaise(c, today), currency: c.currency
    }));
}

// 手取りの内訳（月額）：サブスク・家賃・通信費と、自由に使えるお金
export function takeHomeBreakdown(state) {
  const s = state.settings;
  if (!(s.takeHome > 0)) return null;
  const parts = [
    { id: 'subs', label: 'サブスク', monthly: totals(state).subs },
    ...fixedItems(s).map((f) => ({ id: f.icon, label: f.name, monthly: f.monthly }))
  ].filter((p) => p.monthly > 0);
  const left = s.takeHome - parts.reduce((a, p) => a + p.monthly, 0);
  return { take: s.takeHome, parts, free: Math.max(0, left), over: left < 0 ? -left : 0 };
}

// 模様替え（これをやめたら？）で浮く額と、サブスク代のうちの割合（0〜1）
export function savings(state, ids) {
  const rate = state.settings.usdJpy;
  let month = 0, all = 0;
  for (const c of state.contracts) {
    const m = monthlyYen(c, rate) ?? 0;
    all += m;
    if (ids.has(c.id)) month += m;
  }
  return { month, year: month * 12, share: all > 0 ? month / all : 0 };
}

// 入居日からの支払いの累計（概算）
export function paidSince(c, today, rate) {
  if (!c.since) return null;
  const charge = chargeYen(c, rate);
  if (charge == null) return null;
  const [sy, sm] = c.since.split('-').map(Number);
  const t = parseYmd(today);
  const months = (t.getFullYear() - sy) * 12 + (t.getMonth() + 1 - sm) + 1;
  if (months <= 0) return null;
  const count = c.cycle === 'year' ? Math.ceil(months / 12) : months;
  return { months, count, yen: count * charge };
}

// 退去済み（解約した）の記録から、浮いたお金を数える
export function formerSaved(former, today, rate) {
  let monthly = 0, saved = 0;
  for (const f of former || []) {
    const m = monthlyYen(f, rate) ?? 0;
    monthly += m;
    saved += m * Math.max(0, Math.floor(diffDays(f.cancelledAt, today) / 30.44));
  }
  return { count: (former || []).length, monthly, year: monthly * 12, saved };
}

// 月1回の見回り（棚卸し）の時期か
export function inspectionDue(state, today) {
  if (!state.contracts.some((c) => c.amount != null)) return false;
  return !state.lastInspection || state.lastInspection.slice(0, 7) !== today.slice(0, 7);
}

// ---------- タイムライン・カレンダー ----------
export function upcoming(state, today, days = 30) {
  const end = addDays(today, days);
  const rate = state.settings.usdJpy;
  const events = [];
  for (const c of state.contracts) {
    if (c.nextDate) {
      let d = rollForward(c.nextDate, c.cycle, today);
      while (d && d <= end) {
        events.push({ date: d, type: 'pay', contract: c, yen: chargeYen(c, rate) });
        d = nextCycleDate(d, c.cycle);
      }
    }
    if (c.trial?.on && c.trial.endDate && c.trial.endDate >= today && c.trial.endDate <= end) {
      // 内見おわりの日がそのまま最初の支払日なら、1件にまとめる
      const same = events.findIndex((e) => e.contract === c && e.date === c.trial.endDate);
      if (same >= 0) events.splice(same, 1);
      events.push({ date: c.trial.endDate, type: 'trialEnd', contract: c, yen: chargeYen(c, rate) });
    }
  }
  const order = { trialEnd: 0, pay: 1 };
  return events.sort((a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type]);
}

// ある期間に入る支払日（カレンダー用）。支払日の「本来の日」を保って前後にたどる
export function occurrencesInRange(c, start, end) {
  if (!c.nextDate) return [];
  const day = parseYmd(c.nextDate).getDate();
  const step = c.cycle === 'year' ? 12 : 1;
  const out = [];
  for (let i = -36; i <= 36; i++) {
    const d = addMonths(c.nextDate, i * step, day);
    if (d >= start && d <= end) out.push(d);
  }
  return out;
}

export function relativeLabel(date, today) {
  const d = diffDays(today, date);
  const wd = weekday(date);
  if (d === 0) return '今日';
  if (d === 1) return '明日';
  if (d === 2) return 'あさって';
  const dt = parseYmd(date), td = parseYmd(today);
  const sameMonth = dt.getMonth() === td.getMonth() && dt.getFullYear() === td.getFullYear();
  if (sameMonth && daysInMonth(dt.getFullYear(), dt.getMonth()) - dt.getDate() < 3 && d >= 7) return '月末';
  const sundayIdx = (td.getDay() + 6) % 7;
  const toNextWeek = 7 - sundayIdx;
  if (d < toNextWeek) return `今週${wd}曜`;
  if (d < toNextWeek + 7) return `来週${wd}曜`;
  return `${dt.getMonth() + 1}/${dt.getDate()}（${wd}）`;
}
