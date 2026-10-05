import { nfkc, formatYen } from './text.js';
import { matchMerchant } from './services.js';
import { addMonths, addYears, diffDays, rollForward } from './dates.js';

// 金額の一致の幅。ドル建ては為替で毎月ぶれるので 10% までは同じ課金とみなす。
// App Store など中身が複数ありうる請求元は、別のサービスを混ぜないよう厳しくする。
export const TOL = 0.1;
const TOL_GENERIC = 0.01;
const MIN_ABS = 30;

// 利用先の名前を、比べやすい形にそろえる（決済代行の前置き・会社の種類・参照番号を落とす）
export function merchantKey(m) {
  let s = nfkc(m).toUpperCase();
  s = s.replace(/^(PAYPAL|PP)\s*\*\s*/u, '');
  s = s.replace(/株式会社|\(株\)|\(有\)/gu, '');
  s = s.replace(/\d{3,}/g, '');
  s = s.replace(/[^\p{L}\p{N}]+/gu, '');
  return s.slice(0, 24);
}

// 期間が重なる CSV を複数読んだときの二重計上を防ぐ
export function dedupeTransactions(txs) {
  const seen = new Set();
  return txs.filter((t) => {
    const k = `${t.date}|${t.amount}|${merchantKey(t.merchant)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const median = (xs) => {
  const a = [...xs].sort((x, y) => x - y), n = a.length;
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0;
};

// 同じ利用先の中で、金額が近いものどうしをまとめる
function clusterByAmount(list, tol) {
  const sorted = [...list].sort((a, b) => a.amount - b.amount);
  const out = [];
  for (const t of sorted) {
    const c = out[out.length - 1];
    if (c && t.amount <= c.min * (1 + tol) + (tol === TOL ? MIN_ABS : 0)) c.items.push(t);
    else out.push({ min: t.amount, items: [t] });
  }
  return out.map((c) => c.items);
}

// 金額の並び方：ずっと同じ / ある月から変わった（値上げ）/ 毎回少しずつ違う（為替）
function amountPattern(amounts) {
  const min = Math.min(...amounts), max = Math.max(...amounts);
  if (max - min <= 1) return { kind: 'stable' };
  let changes = 0;
  for (let i = 1; i < amounts.length; i++) if (Math.abs(amounts[i] - amounts[i - 1]) > 1) changes++;
  if (changes === 1) {
    const from = amounts[0], to = amounts[amounts.length - 1];
    const sides = Math.min(amounts.filter((a) => a === from).length, amounts.filter((a) => a === to).length);
    return { kind: 'step', from, to, sides };
  }
  return { kind: 'fx' };
}

// 辞書にない店でも定期課金とみなしてよい金額の並びか。
//   円のサブスクは毎回まったく同じ額になる。値上げなら前後どちらも2回以上同じ額。
//   毎回少しずつ違う（為替のぶれ）のは、海外からの請求（英字だけの利用先）に限る。
function plausibleForUnknown(pat, merchant) {
  if (pat.kind === 'stable') return true;
  if (pat.kind === 'step') return pat.sides >= 2;
  return /^[\x20-\x7e]+$/.test(nfkc(merchant));
}

function displayName(service, merchant, amount) {
  if (service && service.generic) return `${service.name}（${formatYen(amount)}円）`;
  if (service) return service.name;
  return nfkc(merchant).replace(/\s+/g, ' ').trim();
}

// 明細から「定期課金っぽいもの」を候補として拾う。
//   ・同じ利用先で、ほぼ同じ額が、2か月以上にまたがって出ている → 候補
//   ・1回しか出ていないもの → 辞書のサービス名に一致するときだけ「確度低め」の候補
export function detectRecurring(transactions, { today } = {}) {
  const txs = dedupeTransactions(transactions.filter((t) => t.amount > 0 && t.date && t.merchant));
  if (!txs.length) return [];
  const end = txs.reduce((m, t) => (t.date > m ? t.date : m), '');
  const groups = new Map();
  for (const t of txs) {
    const k = merchantKey(t.merchant);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }

  const out = [];
  for (const [key, list] of groups) {
    const service = matchMerchant(list[0].merchant);
    const tol = service?.generic ? TOL_GENERIC : TOL;
    for (const cluster of clusterByAmount(list, tol)) {
      const items = cluster.sort((a, b) => a.date.localeCompare(b.date));
      const byMonth = new Map();
      for (const t of items) {
        const m = t.date.slice(0, 7);
        byMonth.set(m, (byMonth.get(m) || []).concat(t));
      }
      const firsts = [...byMonth.values()].map((v) => v[0]);
      const last = items[items.length - 1];
      const notes = [];
      if (service?.usd) notes.push('ドル建てで請求されることが多いサービスです');
      const base = {
        source: 'csv', key, serviceId: service && !service.generic ? service.id : null, firstSeen: items[0].date,
        category: service?.cat ?? 'other', channel: service?.channel ?? 'direct', currency: 'JPY',
        evidence: items.slice(-6).map((t) => ({ date: t.date, amount: t.amount, merchant: t.merchant }))
      };

      if (firsts.length >= 2) {
        const gaps = [];
        for (let i = 1; i < firsts.length; i++) gaps.push(diffDays(firsts[i - 1].date, firsts[i].date));
        const cycle = median(gaps) >= 300 ? 'year' : 'month';
        const regular = cycle === 'year' ? gaps.every((g) => g >= 330 && g <= 400) : gaps.every((g) => g >= 24 && g <= 38);
        // 間隔がばらばらで辞書にもない店（カフェ・コンビニなど）は、たまたま額が近いだけとみなす
        if (!regular && !service && firsts.length < 3) continue;
        const amounts = firsts.map((t) => t.amount);
        const pat = amountPattern(amounts);
        if (!service && !plausibleForUnknown(pat, last.merchant)) continue;
        const amount = pat.kind === 'fx' ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : last.amount;
        if (pat.kind === 'step') notes.push(`途中で ${formatYen(pat.from)}円 → ${formatYen(pat.to)}円 に変わっています`);
        if (pat.kind === 'fx') notes.push('毎回少しずつ金額が違います（為替の影響かも）。平均の額で入れています');
        if ([...byMonth.values()].some((v) => v.length >= 2)) notes.push('同じ月に同じくらいの額の請求が2回以上あります');
        let confidence = !regular ? 'low' : firsts.length >= 3 ? 'high' : 'mid';
        if (!regular) notes.push('支払いの間隔が一定ではありません');
        if (cycle === 'month' && diffDays(last.date, end) > 45) {
          confidence = 'low';
          notes.push('最近は請求が出ていません（もう解約済みかも）');
        }
        const anchor = cycle === 'year' ? addYears(last.date, 1) : addMonths(last.date, 1);
        out.push({
          ...base, name: displayName(service, last.merchant, amount), amount, cycle,
          nextDate: today ? rollForward(anchor, cycle, today) : anchor,
          confidence, fx: pat.kind === 'fx', months: firsts.length, notes
        });
      } else if (service && !service.generic) {
        notes.push('1回しか出ていないので、単発の買い物か継続課金か分かりません');
        out.push({
          ...base, name: displayName(service, last.merchant, last.amount), amount: last.amount, cycle: 'month',
          nextDate: null, confidence: 'low', fx: false, months: 1, notes
        });
      }
    }
  }
  const rank = { high: 0, mid: 1, low: 2 };
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.amount - a.amount);
}

// ---------- 登録済みの契約との照合（2回目以降の取り込み） ----------
const isGeneric = (c) => c.channel === 'appstore' || c.channel === 'googleplay' ? !c.serviceId : false;

export function sameSubscription(contract, cand) {
  const keys = contract.keys || [];
  if (isGeneric(cand)) {
    return keys.includes(cand.key) && contract.amount != null &&
      Math.abs(contract.amount - cand.amount) <= Math.max(1, contract.amount * TOL_GENERIC);
  }
  if (cand.serviceId && contract.serviceId === cand.serviceId) return true;
  if (keys.includes(cand.key)) return true;
  const nameKey = merchantKey(contract.name);
  return !!nameKey && (nameKey === cand.key || (nameKey.length >= 4 && cand.key.startsWith(nameKey)));
}

// 新しい候補と、金額の変化（値上げなど）に分ける。登録済みで変化のないものは返さない
export function reconcile(cands, contracts, ignored = []) {
  const fresh = [], changes = [];
  for (const c of cands) {
    const skip = ignored.some((ig) => ig.key === c.key && Math.abs(ig.amount - c.amount) <= Math.max(MIN_ABS, ig.amount * TOL));
    if (skip) continue;
    const match = contracts.find((k) => sameSubscription(k, c));
    if (!match) { fresh.push(c); continue; }
    if (match.amount != null && match.currency === 'JPY' && !c.fx && c.confidence !== 'low' && Math.abs(match.amount - c.amount) >= 1) {
      changes.push({ ...c, type: 'change', contractId: match.id, name: match.name, from: match.amount, to: c.amount });
    }
  }
  return { fresh, changes };
}
