import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRecurring, reconcile, merchantKey, dedupeTransactions } from '../js/detect.js';
import { readStatement } from '../js/csv.js';
import { encodeSjis } from './helpers/sjis.js';

const TODAY = '2026-10-05';
const monthly = (merchant, amounts, day = 3, startMonth = 4) =>
  amounts.map((amount, i) => ({ date: `2026-${String(startMonth + i).padStart(2, '0')}-${String(day).padStart(2, '0')}`, amount, merchant }));
const find = (cands, name) => cands.find((c) => c.name === name);

test('毎月同じ額 → 確度高の候補。次回の支払日は今日以降に進める', () => {
  const c = detectRecurring(monthly('SPOTIFY JAPAN', [980, 980, 980, 980, 980, 980]), { today: TODAY });
  assert.equal(c.length, 1);
  assert.equal(c[0].name, 'Spotify');
  assert.equal(c[0].amount, 980);
  assert.equal(c[0].cycle, 'month');
  assert.equal(c[0].confidence, 'high');
  assert.equal(c[0].nextDate, '2026-10-03' < TODAY ? '2026-11-03' : '2026-10-03');
});

test('ドル建てで毎月額がぶれても、1つの候補にまとめる', () => {
  const tx = monthly('CLAUDE.AI SUBSCRIPTION', [2985, 3062, 3010, 3128, 3044, 2996], 14);
  const c = detectRecurring(tx, { today: TODAY });
  assert.equal(c.length, 1);
  assert.equal(c[0].name, 'Claude');
  assert.equal(c[0].fx, true);
  assert.equal(c[0].confidence, 'high');
  assert.equal(c[0].amount, Math.round((2985 + 3062 + 3010 + 3128 + 3044 + 2996) / 6));
  assert.ok(c[0].notes.some((n) => n.includes('為替')));
});

test('値上げ（ある月から額が変わった）は1つの候補で、最新の額にする', () => {
  const c = detectRecurring(monthly('NETFLIX.COM', [1490, 1490, 1490, 1590, 1590, 1590]), { today: TODAY });
  assert.equal(c.length, 1);
  assert.equal(c[0].amount, 1590);
  assert.ok(c[0].notes.some((n) => n.includes('1,490円 → 1,590円')));
});

test('単発の買い物が混ざっても候補にしない。辞書にあるサービスの1回だけは確度低めで残す', () => {
  const tx = [
    ...monthly('NETFLIX.COM', [1590, 1590, 1590, 1590]),
    ...monthly('AMAZON.CO.JP', [2380, 899, 4510, 1200], 11),
    ...monthly('セブン－イレブン', [300, 437, 574, 711], 8),
    { date: '2026-05-25', amount: 640, merchant: 'スターバックス' },
    { date: '2026-07-25', amount: 710, merchant: 'スターバックス' },
    { date: '2026-06-20', amount: 5500, merchant: '山田歯科医院' },
    { date: '2026-09-02', amount: 990, merchant: 'DISNEY PLUS' }
  ];
  const c = detectRecurring(tx, { today: TODAY });
  assert.deepEqual(c.map((x) => x.name).sort(), ['Disney+', 'Netflix']);
  const disney = find(c, 'Disney+');
  assert.equal(disney.confidence, 'low');
  assert.equal(disney.nextDate, null, '1回だけでは次回の日付は決めない');
});

test('App Store の中の別々のサブスク（同じ日・違う額）は分けて出す', () => {
  const tx = [...monthly('APPLE.COM/BILL', [400, 400, 400], 18), ...monthly('APPLE.COM/BILL', [480, 480, 480], 18)];
  const c = detectRecurring(tx, { today: TODAY });
  assert.equal(c.length, 2);
  assert.deepEqual(c.map((x) => x.amount).sort(), [400, 480]);
  assert.ok(c.every((x) => x.channel === 'appstore'));
  assert.ok(c[0].name.startsWith('App Store の課金'));
});

test('年払いは年の周期として拾う', () => {
  const tx = [
    { date: '2025-03-10', amount: 2400, merchant: 'NINTENDO' },
    { date: '2026-03-10', amount: 2400, merchant: 'NINTENDO' }
  ];
  const c = detectRecurring(tx, { today: TODAY });
  assert.equal(c[0].cycle, 'year');
  assert.equal(c[0].nextDate, '2027-03-10');
});

test('最近請求が止まったものは、解約済みかもしれないと伝える', () => {
  const tx = [...monthly('HULU JAPAN', [1026, 1026, 1026], 5, 4), ...monthly('SPOTIFY', [980, 980, 980, 980, 980, 980], 9, 4)];
  const hulu = find(detectRecurring(tx, { today: TODAY }), 'Hulu');
  assert.equal(hulu.confidence, 'low');
  assert.ok(hulu.notes.some((n) => n.includes('解約済み')));
});

test('期間が重なる CSV を2つ読んでも二重に数えない', () => {
  const a = monthly('SPOTIFY', [980, 980, 980]);
  const b = monthly('SPOTIFY', [980, 980, 980], 3, 5);
  assert.equal(dedupeTransactions([...a, ...b]).length, 4);
});

test('利用先の名前のそろえ方', () => {
  assert.equal(merchantKey('ＮＥＴＦＬＩＸ．ＣＯＭ'), merchantKey('NETFLIX.COM'));
  assert.equal(merchantKey('PAYPAL *SPOTIFY'), 'SPOTIFY');
  assert.equal(merchantKey('NETFLIX.COM 866-579-7172'), 'NETFLIXCOM');
});

test('2回目の取り込み：登録済みは出さず、値上げは知らせ、「違う」にしたものは出さない', () => {
  const tx = [
    ...monthly('NETFLIX.COM', [1490, 1490, 1590, 1590]),
    ...monthly('SPOTIFY', [980, 980, 980, 980], 9),
    ...monthly('DROPBOX', [1500, 1500, 1500, 1500], 20),
    ...monthly('UNKNOWN SALON', [5000, 5000, 5000], 12)
  ];
  const cands = detectRecurring(tx, { today: TODAY });
  const contracts = [
    { id: 'n', name: 'Netflix', serviceId: 'netflix', amount: 1490, currency: 'JPY', keys: [] },
    { id: 's', name: 'Spotify', serviceId: 'spotify', amount: 980, currency: 'JPY', keys: [] }
  ];
  const ignored = [{ key: merchantKey('UNKNOWN SALON'), amount: 5000 }];
  const { fresh, changes } = reconcile(cands, contracts, ignored);
  assert.deepEqual(fresh.map((c) => c.name), ['Dropbox']);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].contractId, 'n');
  assert.equal(changes[0].from, 1490);
  assert.equal(changes[0].to, 1590);
});

test('Shift_JIS の CSV から通しで候補を出す（読み取り → 検出）', () => {
  const lines = ['ご利用日,ご利用店名,ご利用金額'];
  for (let m = 4; m <= 9; m++) {
    const mm = String(m).padStart(2, '0');
    lines.push(`2026/${mm}/22,ｱﾏｿﾞﾝﾌﾟﾗｲﾑｶｲﾋ,600`);
    lines.push(`2026/${mm}/10,ローソン,${300 + m * 41}`);
  }
  const r = readStatement(encodeSjis(lines.join('\r\n')));
  const c = detectRecurring(r.transactions, { today: TODAY });
  assert.equal(c.length, 1);
  assert.equal(c[0].name, 'Amazonプライム');
  assert.equal(c[0].confidence, 'high');
});

test('辞書にない店でも、毎月まったく同じ額なら候補にする（ジムの月会費など）', () => {
  const tx = [
    ...monthly('ﾐﾄﾞﾘｼﾞﾑ ｼﾌﾞﾔ', [7700, 7700, 7700, 7700], 27),
    ...monthly('まちのパン屋', [620, 655, 690, 640], 12)
  ];
  const c = detectRecurring(tx, { today: TODAY });
  assert.equal(c.length, 1, 'パン屋（額が毎回ちがう国内の店）は候補にしない');
  assert.equal(c[0].name, 'ミドリジム シブヤ');
  assert.equal(c[0].confidence, 'high');
});

test('候補には最初に請求が出た日（入居日の目安）を持たせる', () => {
  const c = detectRecurring(monthly('SPOTIFY', [980, 980, 980], 9, 4), { today: TODAY });
  assert.equal(c[0].firstSeen, '2026-04-09');
});
