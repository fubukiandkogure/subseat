// 保存データの形を新しい版にそろえる（古い端末のデータや、古いバックアップを読んだとき）
export const SCHEMA = 2;

export function migrate(input) {
  const s = { ...input };
  const v = s.schema || 1;
  if (v < 2) {
    // 1 → 2：座席表から間取りへ。契約に入居日・金額の推移・見回りの記録を足す
    s.contracts = (s.contracts || []).map((c) => ({
      since: null,
      usage: [],
      history: c.amount != null
        ? [{ date: typeof c.createdAt === 'string' ? c.createdAt.slice(0, 10) : null, amount: c.amount, currency: c.currency || 'JPY', cycle: c.cycle || 'month' }]
        : [],
      ...c
    }));
    s.former = s.former || [];
    s.lastInspection = s.lastInspection ?? null;
    if (s.settings) {
      const { seatUnit, ...rest } = s.settings;
      s.settings = { takeHomeMode: 'month', ...rest };
    }
    s.ui = { view: 'subs', calView: 'list', welcomed: false, ...(s.ui || {}) };
  }
  // 0.2 で使っていた「1畳あたりの額」は、金額表示に戻したのでもう使わない
  if (s.settings && 'joPrice' in s.settings) {
    const { joPrice, ...rest } = s.settings;
    s.settings = rest;
  }
  s.schema = SCHEMA;
  return s;
}
