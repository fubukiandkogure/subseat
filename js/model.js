import { addDays, diffDays, rollForward, nextCycleDate, parseYmd, daysInMonth, weekday } from './dates.js';

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
const catOrder = (id) => Math.max(0, CATEGORIES.findIndex((c) => c.id === id));

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

export const DEFAULT_SETTINGS = { takeHome: null, rent: null, phone: null, usdJpy: 150, seatUnit: 'auto', theme: 'auto' };

export function newContract(fields = {}) {
  return {
    id: fields.id || uid(), name: '', category: 'other', amount: null, currency: 'JPY', cycle: 'month',
    nextDate: null, channel: 'direct', cancelUrl: '', status: 'keep', trial: { on: false, endDate: null },
    serviceId: null, keys: [], createdAt: new Date().toISOString(), ...fields
  };
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- お金 ----------
// 円にした1回分の額。金額未確定なら null
export function chargeYen(c, rate) {
  if (c.amount == null || !(c.amount >= 0)) return null;
  return c.currency === 'USD' ? c.amount * (rate > 0 ? rate : DEFAULT_SETTINGS.usdJpy) : c.amount;
}
// 月あたりの額（年払いは12で割ってならす）
export function monthlyYen(c, rate) {
  const y = chargeYen(c, rate);
  if (y == null) return null;
  return c.cycle === 'year' ? y / 12 : y;
}

export function fixedItems(settings) {
  const out = [];
  if (settings.rent > 0) out.push({ id: 'fixed:rent', kind: 'fixed', name: '家賃', category: 'fixed', yen: Math.round(settings.rent) });
  if (settings.phone > 0) out.push({ id: 'fixed:phone', kind: 'fixed', name: '通信費', category: 'fixed', yen: Math.round(settings.phone) });
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
  const fixed = fixedItems(settings).reduce((a, f) => a + f.yen, 0);
  const takeHome = settings.takeHome > 0 ? settings.takeHome : null;
  const reserved = subs + (takeHome ? fixed : 0);
  return { subs, fixed, reserved, takeHome, free: takeHome ? takeHome - reserved : null, unknown };
}

// ---------- 席 ----------
const UNITS = [500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];
export const MAX_SEATS = 240;

export function chooseUnit(capacity, setting) {
  if (setting && setting !== 'auto') return Number(setting);
  for (const u of UNITS) if (capacity / u <= MAX_SEATS) return u;
  return UNITS[UNITS.length - 1];
}

// 席の配置。前の列（スクリーン側）からサブスク → 固定費 の順に埋め、残りが空席。
// 1席は unit 円。小さいサブスクは1席を分け合うので、席ごとに「誰が何割座っているか」を持つ。
// 手取りが未入力のときは、サブスクの席だけを出す。
export function seatPlan(state) {
  const { settings, contracts } = state;
  const rate = settings.usdJpy;
  const subs = contracts
    .map((c) => ({ c, m: monthlyYen(c, rate) }))
    .filter((x) => x.m != null && x.m > 0)
    .sort((a, b) => catOrder(a.c.category) - catOrder(b.c.category) || b.m - a.m)
    .map(({ c, m }) => ({ id: c.id, kind: 'sub', name: c.name, category: c.category, yen: Math.round(m), status: c.status, trial: !!c.trial?.on }));
  const takeHome = settings.takeHome > 0 ? settings.takeHome : null;
  const items = takeHome ? [...subs, ...fixedItems(settings)] : subs;

  // 同じカテゴリの中で隣り合うものを見分けられるよう、濃淡の段を振る
  const shadeIdx = new Map();
  for (const it of items) {
    const n = shadeIdx.get(it.category) ?? 0;
    it.shade = n % 3;
    shadeIdx.set(it.category, n + 1);
  }

  const used = items.reduce((a, it) => a + it.yen, 0);
  const capacity = takeHome ?? used;
  const unit = chooseUnit(Math.max(capacity, used), settings.seatUnit);
  const inCapacity = Math.max(1, Math.ceil(capacity / unit));
  const count = Math.max(inCapacity, Math.ceil(used / unit));
  const seats = Array.from({ length: count }, (_, i) => ({ index: i, segs: [], over: i >= inCapacity }));
  let pos = 0;
  for (const it of items) {
    let left = it.yen;
    while (left > 0) {
      const si = Math.min(seats.length - 1, Math.floor(pos / unit));
      const room = (si + 1) * unit - pos;
      const take = Math.min(room, left);
      seats[si].segs.push({ id: it.id, frac: take / unit });
      pos += take;
      left -= take;
      if (room <= 0) break;
    }
  }
  return { unit, seats, items, used, capacity, takeHome };
}

// 「これをやめたら？」で浮く額
export function savings(state, ids) {
  const rate = state.settings.usdJpy;
  let month = 0;
  for (const c of state.contracts) if (ids.has(c.id)) month += monthlyYen(c, rate) ?? 0;
  return { month, year: month * 12 };
}

// ---------- タイムライン ----------
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
      events.push({ date: c.trial.endDate, type: 'trialEnd', contract: c, yen: chargeYen(c, rate) });
    }
  }
  const order = { trialEnd: 0, pay: 1 };
  return events.sort((a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type]);
}

// 「明日」「来週の水曜」「月末」のような言い方
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
