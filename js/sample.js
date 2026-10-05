import { addDays, addMonths, ymd } from './dates.js';
import { newContract } from './model.js';

// 初回起動時に入れるサンプル。金額や日付は雰囲気を見るための例で、実際の料金ではない。
// sample: true の印をつけておき、ホームや設定から一括で消せるようにする。
export function sampleState(today) {
  const d = (n) => addDays(today, n);
  const m = (n) => addMonths(today, -n).slice(0, 7);
  const price = (amount, ago, extra = {}) => ({ date: d(-ago), amount, currency: 'JPY', cycle: 'month', ...extra });
  const c = (f) => newContract({
    history: f.amount != null ? [{ date: d(-200), amount: f.amount, currency: f.currency || 'JPY', cycle: f.cycle || 'month' }] : [],
    ...f, sample: true
  });
  return {
    settings: { takeHome: 240000, takeHomeMode: 'month', rent: 72000, phone: 2980, usdJpy: 150, sample: true },
    contracts: [
      c({ name: 'Netflix', serviceId: 'netflix', category: 'video', amount: 1590, nextDate: d(3), since: m(40), history: [price(1490, 400), price(1590, 40)] }),
      c({ name: 'YouTube Premium', serviceId: 'ytpremium', category: 'video', amount: 1280, nextDate: d(12), channel: 'googleplay', since: m(22) }),
      c({ name: 'U-NEXT', serviceId: 'unext', category: 'video', amount: 2189, nextDate: d(5), status: 'review', trial: { on: true, endDate: d(5) }, since: m(0) }),
      c({ name: 'dアニメストア', serviceId: 'danime', category: 'video', amount: null, nextDate: null, status: 'review' }),
      c({ name: 'ChatGPT', serviceId: 'chatgpt', category: 'ai', amount: 20, currency: 'USD', nextDate: d(1), channel: 'appstore', since: m(14) }),
      c({ name: 'Claude', serviceId: 'claude', category: 'ai', amount: 20, currency: 'USD', nextDate: d(16), since: m(6) }),
      c({ name: 'Spotify', serviceId: 'spotify', category: 'music', amount: 980, nextDate: d(20), status: 'review', since: m(55) }),
      c({ name: 'iCloud+', serviceId: 'icloud', category: 'cloud', amount: 400, nextDate: d(8), channel: 'appstore', since: m(30) }),
      c({ name: 'Adobe', serviceId: 'adobe', category: 'cloud', amount: 26136, cycle: 'year', nextDate: d(24), status: 'review', since: m(23) }),
      c({ name: 'Nintendo Switch Online', serviceId: 'nso', category: 'game', amount: 2400, cycle: 'year', nextDate: d(150), since: m(31) }),
      c({ name: 'Amazonプライム', serviceId: 'amazonprime', category: 'other', amount: 600, nextDate: d(27), since: m(70) })
    ],
    former: [
      { ...newContract({ name: 'Hulu', serviceId: 'hulu', category: 'video', amount: 1026, since: m(20) }), cancelledAt: d(-95), sample: true }
    ]
  };
}

// 「サンプルの明細で試す」用の明細（6か月分）。定期課金・ドル建てのぶれ・値上げ・単発の買い物が混ざっている
export function sampleCsvText(today) {
  const start = addMonths(today.slice(0, 8) + '01', -6);
  const rows = [['ご利用日', 'ご利用店名', 'ご利用者', '支払方法', 'ご利用金額', '手数料', 'お支払金額']];
  const add = (date, shop, amount) => rows.push([date, shop, '本人', '1回払い', String(amount), '0', String(amount)]);
  const usd = [2985, 3062, 3010, 3128, 3044, 2996];
  for (let i = 0; i < 6; i++) {
    const m = addMonths(start, i);
    const at = (day) => ymd(new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, day)).replace(/-/g, '/');
    add(at(3), 'NETFLIX.COM', i < 3 ? 1490 : 1590);
    add(at(9), 'SPOTIFY JAPAN', 980);
    add(at(14), 'CLAUDE.AI SUBSCRIPTION ANTHROPIC', usd[i]);
    add(at(18), 'APPLE.COM/BILL', 400);
    add(at(18), 'APPLE.COM/BILL', 480);
    add(at(22), 'ｱﾏｿﾞﾝﾌﾟﾗｲﾑｶｲﾋ', 600);
    add(at(6 + i), 'セブン-イレブン', 300 + i * 137);
    add(at(11), 'AMAZON.CO.JP', [2380, 899, 4510, 1200, 3298, 760][i]);
    if (i % 2 === 0) add(at(25), 'スターバックス', 640 + i * 35);
  }
  add(addMonths(start, 2).replace(/-/g, '/').slice(0, 8) + '27', 'NINTENDO ESHOP', 7678);
  add(addMonths(start, 5).replace(/-/g, '/').slice(0, 8) + '02', 'DISNEY PLUS', 990);
  return rows.map((r) => r.join(',')).join('\r\n');
}
