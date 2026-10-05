import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthlyYen, yearlyYen, totals, upcoming, relativeLabel, savings, DEFAULT_SETTINGS, squarify, planRooms, takeHomeBreakdown,
  paidSince, formerSaved, inspectionDue, occurrencesInRange, recordPrice, recentRaise
} from '../js/model.js';
import { migrate, SCHEMA } from '../js/migrate.js';
import { buildIcs, fold } from '../js/ics.js';
import { addMonths, rollForward } from '../js/dates.js';

const TODAY = '2026-10-05';
const settings = (s = {}) => ({ ...DEFAULT_SETTINGS, usdJpy: 150, ...s });
const sub = (f) => ({ id: f.name, currency: 'JPY', cycle: 'month', status: 'keep', trial: { on: false }, history: [], ...f });

test('月・年あたりの額：ドルは円に、年払いは12で割る、未確定は null', () => {
  assert.equal(monthlyYen(sub({ amount: 980 }), 150), 980);
  assert.equal(monthlyYen(sub({ amount: 20, currency: 'USD' }), 150), 3000);
  assert.equal(monthlyYen(sub({ amount: 12000, cycle: 'year' }), 150), 1000);
  assert.equal(yearlyYen(sub({ amount: 980 }), 150), 11760);
  assert.equal(monthlyYen(sub({ amount: null }), 150), null);
});

test('合計には未確定を入れず、件数だけ数える', () => {
  const t = totals({ settings: settings({ takeHome: 200000, rent: 70000 }), contracts: [sub({ name: 'a', amount: 1000 }), sub({ name: 'b', amount: null })] });
  assert.equal(t.subs, 1000);
  assert.equal(t.unknown, 1);
  assert.equal(t.reserved, 71000);
  assert.equal(t.free, 129000);
});

test('間取り（squarify）：面積は値に比例し、枠からはみ出さず、重ならない', () => {
  const items = [{ value: 36000 }, { value: 36000 }, { value: 26268 }, { value: 19080 }, { value: 11760 }, { value: 4800 }, { value: 2400 }];
  const W = 400, H = 500;
  const r = squarify(items, 0, 0, W, H);
  assert.equal(r.length, items.length);
  const total = items.reduce((a, i) => a + i.value, 0);
  for (const x of r) {
    assert.ok(Math.abs((x.w * x.h) / (W * H) - x.value / total) < 1e-9, '面積の割合');
    assert.ok(x.x >= -1e-9 && x.y >= -1e-9 && x.x + x.w <= W + 1e-6 && x.y + x.h <= H + 1e-6, '枠の中');
  }
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    assert.ok(overlap < 1e-6, '重ならない');
  }
  assert.ok(r[0].x === 0 && r[0].y === 0, 'いちばん大きい部屋は左上');
});

test('サブスク荘の部屋：年額の大きい順。金額未確定は部屋にしない。札の材料も持つ', () => {
  const st = {
    settings: settings(),
    contracts: [
      sub({ name: 'small', amount: 400 }),
      sub({ name: 'big', amount: 20, currency: 'USD', trial: { on: true, endDate: '2026-10-10' } }),
      sub({ name: 'unknown', amount: null }),
      sub({ name: 'raised', amount: 1590, history: [{ date: '2026-01-01', amount: 1490, currency: 'JPY', cycle: 'month' }, { date: '2026-09-01', amount: 1590, currency: 'JPY', cycle: 'month' }] })
    ]
  };
  const rooms = planRooms(st, TODAY);
  assert.deepEqual(rooms.map((r) => r.name), ['big', 'raised', 'small']);
  assert.equal(rooms[0].value, 36000, '部屋の広さは年額（ドルは円にして）');
  assert.equal(rooms[0].trial, true);
  assert.deepEqual(rooms[1].raise, { from: 1490, to: 1590, date: '2026-09-01' });
});

test('手取りの内訳：サブスク・家賃・通信費と、自由に使えるお金。使いすぎも分かる', () => {
  const st = { settings: settings({ takeHome: 200000, rent: 70000, phone: 3000 }), contracts: [sub({ name: 'a', amount: 2000 }), sub({ name: 'b', amount: null })] };
  const b = takeHomeBreakdown(st);
  assert.deepEqual(b.parts.map((p) => [p.id, p.monthly]), [['subs', 2000], ['rent', 70000], ['phone', 3000]]);
  assert.equal(b.free, 125000);
  assert.equal(b.over, 0);
  const over = takeHomeBreakdown({ settings: settings({ takeHome: 50000, rent: 70000 }), contracts: [] });
  assert.equal(over.free, 0);
  assert.equal(over.over, 20000);
  assert.equal(takeHomeBreakdown({ settings: settings(), contracts: [] }), null, '手取りが未入力なら出さない');
});

test('模様替え：退去させると浮く額（月・年）と、サブスク代のうちの割合', () => {
  const s = { settings: settings(), contracts: [sub({ name: 'a', amount: 1590 }), sub({ name: 'b', amount: 20, currency: 'USD' }), sub({ name: 'c', amount: 6000, cycle: 'year' })] };
  const sv = savings(s, new Set(['a', 'c']));
  assert.equal(sv.month, 2090);
  assert.equal(sv.year, 25080);
  assert.ok(Math.abs(sv.share - 2090 / 5090) < 1e-9);
  assert.equal(savings({ settings: settings(), contracts: [] }, new Set()).share, 0);
});

test('入居日からの累計（概算）', () => {
  assert.deepEqual(paidSince(sub({ amount: 1000, since: '2026-01' }), TODAY, 150), { months: 10, count: 10, yen: 10000 });
  assert.deepEqual(paidSince(sub({ amount: 12000, cycle: 'year', since: '2024-11' }), TODAY, 150), { months: 24, count: 2, yen: 24000 });
  assert.equal(paidSince(sub({ amount: 1000, since: null }), TODAY, 150), null);
});

test('退去済みの記録から、浮いたお金を数える', () => {
  const fs = formerSaved([{ ...sub({ amount: 1000 }), cancelledAt: '2026-07-05' }, { ...sub({ amount: 12000, cycle: 'year' }), cancelledAt: '2026-10-01' }], TODAY, 150);
  assert.equal(fs.count, 2);
  assert.equal(fs.monthly, 2000);
  assert.equal(fs.year, 24000);
  assert.equal(fs.saved, 1000 * 3);
});

test('金額の記録と値上げの検知（120日以内の値上がりだけ）', () => {
  const c = sub({ amount: 1490 });
  recordPrice(c, '2026-03-01');
  recordPrice(c, '2026-04-01');
  assert.equal(c.history.length, 1, '同じ額なら記録しない');
  c.amount = 1590;
  recordPrice(c, '2026-09-01');
  assert.deepEqual(recentRaise(c, TODAY), { from: 1490, to: 1590, date: '2026-09-01' });
  assert.equal(recentRaise(c, '2027-03-01'), null, '時間がたてば出さない');
  c.amount = 990;
  recordPrice(c, '2026-10-01');
  assert.equal(recentRaise(c, TODAY), null, '値下げは値上げではない');
});

test('見回りは月に1回', () => {
  const base = { contracts: [sub({ amount: 980 })] };
  assert.equal(inspectionDue({ ...base, lastInspection: null }, TODAY), true);
  assert.equal(inspectionDue({ ...base, lastInspection: '2026-10-01' }, TODAY), false);
  assert.equal(inspectionDue({ ...base, lastInspection: '2026-09-28' }, TODAY), true);
  assert.equal(inspectionDue({ contracts: [], lastInspection: null }, TODAY), false);
});

test('カレンダー：ある月に入る支払日（31日払いは月末に寄せる）', () => {
  const c = sub({ amount: 980, nextDate: '2026-12-31' });
  assert.deepEqual(occurrencesInRange(c, '2026-11-01', '2026-11-30'), ['2026-11-30']);
  assert.deepEqual(occurrencesInRange(c, '2027-02-01', '2027-02-28'), ['2027-02-28']);
  assert.deepEqual(occurrencesInRange(sub({ amount: 1, cycle: 'year', nextDate: '2027-03-04' }), '2026-03-01', '2026-03-31'), ['2026-03-04']);
  assert.deepEqual(occurrencesInRange(sub({ amount: 1, nextDate: null }), '2026-10-01', '2026-10-31'), []);
});

test('タイムライン：30日以内の支払いと無料体験の終わりを近い順に（同じ日の支払いは内見おわりにまとめる）', () => {
  const s = {
    settings: settings(),
    contracts: [
      sub({ name: 'past', amount: 980, nextDate: '2026-09-20' }),
      sub({ name: 'year', amount: 12000, cycle: 'year', nextDate: '2026-10-30' }),
      sub({ name: 'far', amount: 500, cycle: 'year', nextDate: '2027-01-01' }),
      sub({ name: 'trial', amount: 2189, nextDate: '2026-10-12', trial: { on: true, endDate: '2026-10-12' } })
    ]
  };
  const ev = upcoming(s, TODAY, 30);
  assert.deepEqual(ev.map((e) => `${e.date} ${e.type} ${e.contract.name}`), [
    '2026-10-12 trialEnd trial', '2026-10-20 pay past', '2026-10-30 pay year'
  ]);
});

test('日付の言い方（今日は 2026-10-05 月曜）', () => {
  const t = TODAY;
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

test('保存データの移行：0.2 の「1畳あたりの額」は消す（ほかの設定は残す）', () => {
  const v02 = { schema: 2, settings: { takeHome: 240000, joPrice: 20000, theme: 'light' }, contracts: [], candidates: [], ignored: [], former: [], ui: { mode: 'year', welcomed: true } };
  const m = migrate(v02);
  assert.equal('joPrice' in m.settings, false);
  assert.equal(m.settings.theme, 'light');
  assert.equal(m.ui.welcomed, true);
});

test('保存データの移行：座席表の版（schema 1）→ 間取りの版', () => {
  const old = {
    settings: { takeHome: 240000, usdJpy: 150, seatUnit: 'auto', theme: 'dark' },
    contracts: [{ id: 'x', name: 'Netflix', amount: 1590, currency: 'JPY', cycle: 'month', createdAt: '2026-10-01T00:00:00Z' }, { id: 'y', name: 'dアニメ', amount: null }],
    candidates: [], ignored: [], ui: { mode: 'month' }
  };
  const m = migrate(old);
  assert.equal(m.schema, SCHEMA);
  assert.equal('seatUnit' in m.settings, false);
  assert.equal('joPrice' in m.settings, false);
  assert.equal(m.settings.theme, 'dark');
  assert.deepEqual(m.contracts[0].history, [{ date: '2026-10-01', amount: 1590, currency: 'JPY', cycle: 'month' }]);
  assert.deepEqual(m.contracts[1].history, []);
  assert.deepEqual(m.former, []);
  assert.equal(m.ui.mode, 'month', '前の表示設定は残す');
  assert.equal(migrate(m).contracts[0].history.length, 1, '2回かけても変わらない');
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
