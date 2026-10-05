import { h, money, tile, segmented } from '../ui.js';
import { STATUSES, CHANNELS, catLabel, monthlyYen } from '../model.js';
import { parseYmd } from '../dates.js';
import { openContractSheet } from './contract-sheet.js';

const priceLabel = (c) => {
  if (c.amount == null) return null;
  const p = c.currency === 'USD' ? `$${c.amount}` : `${money(c.amount)}円`;
  return `${p}/${c.cycle === 'year' ? '年' : '月'}`;
};

export function renderContracts(root, store) {
  const state = store.get();
  const year = state.ui.mode === 'year';
  const rate = state.settings.usdJpy;
  const list = state.contracts;
  const unknown = list.filter((c) => c.amount == null || !c.nextDate);
  const sum = list.reduce((a, c) => a + (monthlyYen(c, rate) ?? 0), 0);

  const row = (c) => {
    const date = c.nextDate ? parseYmd(c.nextDate) : null;
    return h('button', { type: 'button', class: 'row', onClick: () => openContractSheet(store, c) },
      tile(c.name),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, c.name),
        h('span', { class: 'row-sub' },
          h('span', { class: 'swatch mini', style: { background: `var(--cat-${c.category})` } }),
          `${catLabel(c.category)}・${CHANNELS.find((x) => x.id === c.channel)?.label ?? '直接'}`,
          date ? `・次回 ${date.getMonth() + 1}/${date.getDate()}` : h('span', { class: 'badge warn' }, '日付未確定'),
          c.trial?.on ? h('span', { class: 'badge warn' }, '体験中') : null,
          c.sample ? h('span', { class: 'badge' }, 'サンプル') : null)),
      h('span', { class: 'row-amount' },
        priceLabel(c) ? h('span', null, priceLabel(c)) : h('span', { class: 'badge warn' }, '金額未確定'),
        c.amount != null && (c.currency === 'USD' || c.cycle === 'year')
          ? h('small', null, `${year ? '年' : '月'} 約${money((monthlyYen(c, rate) ?? 0) * (year ? 12 : 1))}円`) : null));
  };

  const groups = STATUSES.map((st) => {
    const items = list.filter((c) => c.status === st.id).sort((a, b) => (monthlyYen(b, rate) ?? -1) - (monthlyYen(a, rate) ?? -1));
    if (!items.length) return null;
    return h('section', { class: 'group' },
      h('h3', null, st.label, h('span', { class: 'count' }, items.length)),
      h('div', { class: 'list' }, items.map(row)));
  });

  root.replaceChildren(...[
    h('section', { class: 'summary compact-summary' },
      h('div', { class: 'summary-top' },
        h('p', { class: 'eyebrow' }, `確認済みの契約 ${list.length}件`),
        segmented([{ id: 'month', label: '月額' }, { id: 'year', label: '年額' }], state.ui.mode, (m) => store.update((s) => { s.ui.mode = m; }), '表示する単位')),
      h('p', { class: 'big' }, h('span', { class: 'num' }, money(sum * (year ? 12 : 1))), h('span', { class: 'unit' }, year ? '円／年' : '円／月'))),
    unknown.length ? h('p', { class: 'notice' }, `金額か次回の支払日が未確定のものが ${unknown.length}件あります。タップして分かるところから埋めてください。`) : null,
    ...groups.filter(Boolean),
    !list.length ? h('p', { class: 'empty' }, 'まだ確認済みの契約はありません。') : null,
    h('button', { type: 'button', class: 'btn add-btn', onClick: () => openContractSheet(store, null) }, '＋ 手で追加する')
  ].filter(Boolean));
}
