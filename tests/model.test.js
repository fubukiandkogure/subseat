import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyYen, seatPlan, totals, upcoming, relativeLabel, savings, chooseUnit, DEFAULT_SETTINGS } from '../js/model.js';
import { buildIcs, fold } from '../js/ics.js';
import { addMonths, rollForward } from '../js/dates.js';

const settings = (s = {}) => ({ ...DEFAULT_SETTINGS, usdJpy: 150, ...s });
const sub = (f) => ({ id: f.name, currency: 'JPY', cycle: 'month', status: 'keep', trial: { on: false }, ...f });

test('月あたりの額：ドルは円に、年払いは12で割る、未確定は null', () => {
  assert.equal(monthlyYen(sub({ amount: 980 }), 150), 980);
  assert.equal(monthlyYen(sub({ amount: 20, currency: 'USD' }), 150), 3000);
  assert.equal(monthlyYen(sub({ amount: 12000, cycle: 'year' }), 150), 1000);
  assert.equal(monthlyYen(sub({ amount: null }), 150), null);
});

test('合計には未確定を入れず、件数だけ数える', () => {
  const t = totals({ settings: settings({ takeHome: 200000, rent: 70000 }), contracts: [sub({ name: 'a', amount: 1000 }), sub({ name: 'b', amount: null })] });
  assert.equal(t.subs, 1000);
  assert.equal(t.unknown, 1);
  assert.equal(t.reserved, 71000);
  assert.equal(t.free, 129000);
});

test('席：前からサブスク → 固定費の順に埋まり、残りが空席', () => {
  const p = seatPlan({ settings: settings({ takeHome: 10000, rent: 3000, seatUnit: 1000 }), contracts: [sub({ name: 'a', amount: 1500, category: 'video' }), sub({ name: 'b', amount: 300, category: 'music' })] });
  assert.equal(p.unit, 1000);
  assert.equal(p.seats.length, 10);
  assert.deepEqual(p.seats[0].segs, [{ id: 'a', frac: 1 }]);
  assert.deepEqual(p.seats[1].segs, [{ id: 'a', frac: 0.5 }, { id: 'b', frac: 0.3 }, { id: 'fixed:rent', frac: 0.2 }]);
  const filled = p.seats.reduce((a, s) => a + s.segs.reduce((x, g) => x + g.frac, 0), 0);
  assert.ok(Math.abs(filled - 4.8) < 1e-9);
  assert.equal(p.seats.filter((s) => !s.segs.length).length, 5);
});

test('手取りが未入力なら、サブスクの席だけ（固定費は出さない）', () => {
  const p = seatPlan({ settings: settings({ rent: 70000, seatUnit: 1000 }), contracts: [sub({ name: 'a', amount: 2500 })] });
  assert.equal(p.takeHome, null);
  assert.equal(p.seats.length, 3);
  assert.ok(p.items.every((i) => i.kind === 'sub'));
});

test('手取りを超えたら、はみ出した席に印をつける', () => {
  const p = seatPlan({ settings: settings({ takeHome: 2000, seatUnit: 1000 }), contracts: [sub({ name: 'a', amount: 3000 })] });
  assert.equal(p.seats.length, 3);
  assert.deepEqual(p.seats.map((s) => s.over), [false, false, true]);
});

test('1席の額は、席が多くなりすぎないよう自動で決める', () => {
  assert.equal(chooseUnit(200000, 'auto'), 1000);
  assert.equal(chooseUnit(300000, 'auto'), 2000);
  assert.equal(chooseUnit(300000, '1000'), 1000);
});

test('これをやめたら：浮く額（月・年）', () => {
  const s = { settings: settings(), contracts: [sub({ name: 'a', amount: 1590 }), sub({ name: 'b', amount: 20, currency: 'USD' }), sub({ name: 'c', amount: 6000, cycle: 'year' })] };
  assert.deepEqual(savings(s, new Set(['a', 'c'])), { month: 2090, year: 25080 });
});

test('タイムライン：30日以内の支払いと無料体験の終わりを近い順に', () => {
  const s = {
    settings: settings(),
    contracts: [
      sub({ name: 'past', amount: 980, nextDate: '2026-09-20' }),
      sub({ name: 'year', amount: 12000, cycle: 'year', nextDate: '2026-10-30' }),
      sub({ name: 'far', amount: 500, cycle: 'year', nextDate: '2027-01-01' }),
      sub({ name: 'trial', amount: 2189, nextDate: '2026-10-12', trial: { on: true, endDate: '2026-10-12' } })
    ]
  };
  const ev = upcoming(s, '2026-10-05', 30);
  assert.deepEqual(ev.map((e) => `${e.date} ${e.type} ${e.contract.name}`), [
    '2026-10-12 trialEnd trial', '2026-10-12 pay trial', '2026-10-20 pay past', '2026-10-30 pay year'
  ]);
});

test('日付の言い方（今日は 2026-10-05 月曜）', () => {
  const t = '2026-10-05';
  assert.equal(relativeLabel('2026-10-05', t), '今日');
  assert.equal(relativeLabel('2026-10-06', t), '明日');
  assert.equal(relativeLabel('2026-10-07', t), 'あさって');
  assert.equal(relativeLabel('2026-10-09', t), '今週金曜');
  assert.equal(relativeLabel('2026-10-14', t), '来週水曜');
  assert.equal(relativeLabel('2026-10-30', t), '月末');
  assert.equal(relativeLabel('2026-11-03', t), '11/3（火）');
});

test('月末の日付をまたいでも、本来の日に戻る', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(rollForward('2026-01-31', 'month', '2026-03-01'), '2026-03-31');
});

test('.ics：毎月・毎年の繰り返し、31日払い、前日の通知、75バイトの折り返し', () => {
  const ics = buildIcs([
    sub({ id: 'x', name: 'Netflix', amount: 1590, nextDate: '2026-10-31' }),
    sub({ id: 'y', name: 'Adobe Creative Cloud コンプリートプラン（年間プラン・年払い）', amount: 86880, cycle: 'year', nextDate: '2027-01-15' }),
    sub({ id: 'z', name: 'U-NEXT', amount: 2189, nextDate: null, trial: { on: true, endDate: '2026-10-12' } })
  ], { rate: 150, now: new Date(Date.UTC(2026, 9, 5)) });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1/);
  assert.match(ics, /RRULE:FREQ=YEARLY/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.match(ics, /SUMMARY:無料体験おわり U-NEXT/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(fold('a'.repeat(80)).split('\r\n')[1], ' ' + 'a'.repeat(5));
});
