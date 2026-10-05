// 日付はすべて端末のローカル時刻の 'YYYY-MM-DD' 文字列で扱う（文字列のまま大小比較できる）

export const pad2 = (n) => String(n).padStart(2, '0');

export function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayYmd = (now = new Date()) => ymd(now);

export const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// 月を足す。31日→2月のように存在しない日は月末に寄せる。anchorDay で「本来の日」を保つ
export function addMonths(s, n, anchorDay) {
  const d = parseYmd(s);
  const day = anchorDay ?? d.getDate();
  const total = d.getFullYear() * 12 + d.getMonth() + n;
  const y = Math.floor(total / 12), m = total % 12;
  return ymd(new Date(y, m, Math.min(day, daysInMonth(y, m))));
}

export const addYears = (s, n, anchorDay) => addMonths(s, n * 12, anchorDay);

// b − a の日数
export const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

// 支払日を周期ごとに進めて、from 以降の最初の日にする
export function rollForward(s, cycle, from) {
  if (!s) return null;
  if (s >= from) return s;
  const day = parseYmd(s).getDate();
  for (let i = 1; i < 1200; i++) {
    const next = cycle === 'year' ? addYears(s, i, day) : addMonths(s, i, day);
    if (next >= from) return next;
  }
  return null;
}

export const nextCycleDate = (s, cycle) => (cycle === 'year' ? addYears(s, 1) : addMonths(s, 1));

export const WEEKDAYS = '日月火水木金土';
export const weekday = (s) => WEEKDAYS[parseYmd(s).getDay()];
