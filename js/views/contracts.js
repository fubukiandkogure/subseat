import { h, money, tile, toast, ask } from '../ui.js';
import { STATUSES, CHANNELS, catLabel, monthlyYen, yearlyYen, tatami, recentRaise, formerSaved } from '../model.js';
import { parseYmd, todayYmd, diffDays } from '../dates.js';
import { openRoomSheet } from './room-sheet.js';
import { openContractSheet } from './contract-sheet.js';

const GROUP_LABEL = { keep: '住んでいる部屋', review: '様子見の部屋', cancel: '退去予定の部屋' };

export function renderContracts(root, store) {
  const state = store.get();
  const today = todayYmd();
  const { usdJpy: rate, joPrice } = state.settings;
  const list = state.contracts;
  const unknown = list.filter((c) => c.amount == null || !c.nextDate);
  const sumYear = list.reduce((a, c) => a + (yearlyYen(c, rate) ?? 0), 0);

  const row = (c) => {
    const m = monthlyYen(c, rate);
    const date = c.nextDate ? parseYmd(c.nextDate) : null;
    return h('button', { type: 'button', class: 'row', onClick: () => openRoomSheet(store, c.id) },
      tile(c.name),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, c.name),
        h('span', { class: 'row-sub' },
          h('span', { class: 'swatch mini', style: { background: `var(--cat-${c.category})` } }),
          `${catLabel(c.category)}・${CHANNELS.find((x) => x.id === c.channel)?.label ?? '直接'}`,
          date ? `・次 ${date.getMonth() + 1}/${date.getDate()}` : h('span', { class: 'badge warn' }, '日付未確定'),
          c.trial?.on ? h('span', { class: 'badge warn' }, '内見中') : null,
          recentRaise(c, today) ? h('span', { class: 'badge accent' }, '値上げ') : null,
          c.sample ? h('span', { class: 'badge' }, 'サンプル') : null)),
      h('span', { class: 'row-amount' },
        m == null ? h('span', { class: 'badge warn' }, '金額未確定') : h('span', null, `${tatami(m * 12, joPrice).toFixed(1)}畳`),
        m == null ? null : h('small', null, `年 ${money(m * 12)}円`)));
  };

  const groups = STATUSES.map((st) => {
    const items = list.filter((c) => c.status === st.id).sort((a, b) => (yearlyYen(b, rate) ?? -1) - (yearlyYen(a, rate) ?? -1));
    if (!items.length) return null;
    return h('section', { class: 'group' },
      h('h3', null, GROUP_LABEL[st.id], h('span', { class: 'count' }, items.length)),
      h('div', { class: 'list' }, items.map(row)));
  });

  const fs = formerSaved(state.former, today, rate);
  const former = state.former.length ? h('section', { class: 'group former' },
    h('h3', null, '退去済み', h('span', { class: 'count' }, state.former.length)),
    h('p', { class: 'muted small former-sum' }, `月 ${money(fs.monthly)}円・年 ${money(fs.year)}円 が浮いています。退去してから約 ${money(fs.saved)}円。`),
    h('div', { class: 'list' }, state.former.map((f) => h('div', { class: 'row static' },
      tile(f.name),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, f.name),
        h('span', { class: 'row-sub' }, `${f.cancelledAt.replace(/-/g, '/')} に退去・${Math.max(0, Math.floor(diffDays(f.cancelledAt, today) / 30.44))}か月前`, f.sample ? h('span', { class: 'badge' }, 'サンプル') : null)),
      h('button', { type: 'button', class: 'btn small ghost', onClick: async () => {
        if (!(await ask(`${f.name} をまた入居させますか？`, { ok: '再入居' }))) return;
        store.update((s) => {
          const i = s.former.findIndex((x) => x.id === f.id);
          if (i < 0) return;
          const [k] = s.former.splice(i, 1);
          delete k.cancelledAt;
          s.contracts.push({ ...k, status: 'keep' });
        });
        toast(`${f.name} が再入居しました`);
      } }, '再入居'))))) : null;

  root.replaceChildren(...[
    h('section', { class: 'summary compact-summary' },
      h('p', { class: 'eyebrow' }, `入居中の部屋 ${list.length}件`),
      h('p', { class: 'big' }, h('span', { class: 'num' }, tatami(sumYear, joPrice).toFixed(1)), h('span', { class: 'unit' }, '畳')),
      h('p', { class: 'money-line' }, h('span', { class: 'on' }, '年 ', h('b', null, money(sumYear)), '円'), h('span', { class: 'sep' }, '・'), h('span', null, '月 ', h('b', null, money(sumYear / 12)), '円'))),
    unknown.length ? h('p', { class: 'notice' }, `金額か次の支払日が未確定の部屋が ${unknown.length}件あります。タップして分かるところから埋めてください。`) : null,
    ...groups.filter(Boolean),
    !list.length ? h('p', { class: 'empty' }, 'まだ入居中の部屋はありません。') : null,
    h('button', { type: 'button', class: 'btn add-btn', onClick: () => openContractSheet(store, null) }, '＋ 手で入居させる'),
    former
  ].filter(Boolean));
}
