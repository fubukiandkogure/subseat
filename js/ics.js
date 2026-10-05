import { addDays, parseYmd } from './dates.js';
import { chargeYen } from './model.js';
import { formatYen } from './text.js';

// 支払日を .ics（カレンダー）に書き出す。サーバーなしで通知を作るための代わり。
// 毎月・毎年の繰り返し予定にして、前日に通知が出るようにする。

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dateOnly = (s) => s.replace(/-/g, '');

function stamp(now) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
}

// 1行75バイトで折り返す（RFC 5545）。日本語の途中で切らない
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

// 29〜31日は「その月にある一番大きい日」にする（2月にずれて消えないように）
function rrule(c, start) {
  if (c.cycle === 'year') return 'RRULE:FREQ=YEARLY';
  const day = parseYmd(start).getDate();
  if (day <= 28) return 'RRULE:FREQ=MONTHLY';
  const days = [];
  for (let d = 28; d <= day; d++) days.push(d);
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
}

export function buildIcs(contracts, { rate = 150, now = new Date() } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//subseat//ja', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:サブスクの支払い'];
  const ts = stamp(now);
  for (const c of contracts) {
    const yen = chargeYen(c, rate);
    const price = c.amount == null ? '金額未確定' : c.currency === 'USD' ? `$${c.amount}（約${formatYen(yen)}円）` : `${formatYen(c.amount)}円`;
    if (c.nextDate) {
      L.push('BEGIN:VEVENT', `UID:${c.id}-pay@subseat`, `DTSTAMP:${ts}`,
        `DTSTART;VALUE=DATE:${dateOnly(c.nextDate)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(c.nextDate, 1))}`,
        rrule(c, c.nextDate),
        `SUMMARY:${esc(`支払い ${c.name} ${price}`)}`,
        `DESCRIPTION:${esc(`${c.cycle === 'year' ? '年払い' : '月払い'}・サブスク席から書き出し`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', `DESCRIPTION:${esc(`明日 ${c.name} の支払い`)}`, 'END:VALARM',
        'END:VEVENT');
    }
    if (c.trial?.on && c.trial.endDate) {
      L.push('BEGIN:VEVENT', `UID:${c.id}-trial@subseat`, `DTSTAMP:${ts}`,
        `DTSTART;VALUE=DATE:${dateOnly(c.trial.endDate)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(c.trial.endDate, 1))}`,
        `SUMMARY:${esc(`無料体験おわり ${c.name}`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P2D', `DESCRIPTION:${esc(`${c.name} の無料体験があさってで終わります`)}`, 'END:VALARM',
        'END:VEVENT');
    }
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
