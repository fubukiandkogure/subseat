import { h, money, tile, toast, ask, openSheet, segmented } from '../ui.js';
import { STATUSES, CHANNELS, catLabel, monthlyYen, tatami, sizeLabel, paidSince, recentRaise, relativeLabel } from '../model.js';
import { todayYmd, parseYmd, rollForward } from '../dates.js';
import { openContractSheet } from './contract-sheet.js';

export const USAGE = { good: 'よく使った', some: 'たまに', none: '使ってない' };
const md = (d) => { const x = parseYmd(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
const price = (c) => (c.amount == null ? '未確定' : c.currency === 'USD' ? `$${c.amount}` : `${money(c.amount)}円`);

// 部屋（契約1件）の詳細。編集・状態の変更・退去（解約した）もここから
export function openRoomSheet(store, id) {
  const s = store.get();
  const c = s.contracts.find((x) => x.id === id);
  if (!c) return;
  const today = todayYmd();
  const rate = s.settings.usdJpy;
  const m = monthlyYen(c, rate);
  const jo = m == null ? null : tatami(m * 12, s.settings.joPrice);
  const raise = recentRaise(c, today);
  const next = c.nextDate ? rollForward(c.nextDate, c.cycle, today) : null;
  const paid = paidSince(c, today, rate);

  openSheet(c.name, (close) => {
    const row = (label, value) => h('div', { class: 'info-row' }, h('dt', null, label), h('dd', null, value));
    const signs = [
      c.trial?.on ? h('span', { class: 'badge warn' }, `内見中（${c.trial.endDate ? md(c.trial.endDate) + 'まで' : '終了日未入力'}）`) : null,
      c.status === 'cancel' ? h('span', { class: 'badge' }, '退去予定') : null,
      c.status === 'review' ? h('span', { class: 'badge' }, '様子見') : null,
      raise ? h('span', { class: 'badge accent' }, `値上げ ${money(raise.from)}→${money(raise.to)}`) : null,
      c.sample ? h('span', { class: 'badge' }, 'サンプル') : null
    ].filter(Boolean);
    const usage = (c.usage || []).slice(-4).reverse();
    const history = (c.history || []).slice(-6).reverse();

    return h('div', { class: 'room-sheet' },
      h('div', { class: 'room-hero', style: { '--room-c': `var(--cat-${c.category})` } },
        tile(c.name, 'l'),
        h('div', null,
          h('p', { class: 'room-jo' }, jo == null ? '広さ未確定' : [h('b', null, jo.toFixed(1)), h('span', null, '畳'), h('small', null, sizeLabel(jo))]),
          h('p', { class: 'room-yen' }, m == null ? '金額が分かると、部屋の広さが決まります' : `月 ${money(m)}円 ・ 年 ${money(m * 12)}円`))),
      signs.length ? h('div', { class: 'signs' }, signs) : null,
      h('dl', { class: 'info' },
        row('次の支払い', next ? `${md(next)}（${relativeLabel(next, today)}）` : '未確定'),
        row('支払い', `${c.cycle === 'year' ? '毎年' : '毎月'} ${price(c)}${c.currency === 'USD' && c.amount != null ? `（1ドル＝${rate}円）` : ''}`),
        row('経路・カテゴリ', `${CHANNELS.find((x) => x.id === c.channel)?.label ?? '直接'}・${catLabel(c.category)}`),
        row('入居', c.since
          ? `${c.since.replace('-', '年').replace(/^(\d+)年0?(\d+)$/, '$1年$2月')}から${paid ? `・これまで 約${money(paid.yen)}円（${paid.count}回）` : ''}`
          : '未入力（入れると、これまでに払った額が出ます）')),
      history.length >= 2 ? h('details', { class: 'mini-list' }, h('summary', null, '金額の推移'),
        h('ul', null, history.map((x) => h('li', null, h('span', null, x.date ? x.date.replace(/-/g, '/') : '—'), h('b', null, `${x.currency === 'USD' ? '$' + x.amount : money(x.amount) + '円'}/${x.cycle === 'year' ? '年' : '月'}`))))) : null,
      usage.length ? h('details', { class: 'mini-list' }, h('summary', null, '見回りの記録'),
        h('ul', null, usage.map((u) => h('li', null, h('span', null, u.month.replace('-', '年') + '月'), h('b', null, USAGE[u.answer] || u.answer))))) : null,
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '状態'),
        segmented(STATUSES, c.status, (v) => {
          store.update((st) => { const k = st.contracts.find((x) => x.id === c.id); if (k) k.status = v; });
          toast(v === 'cancel' ? `${c.name} を退去予定にしました` : `${c.name} を「${STATUSES.find((x) => x.id === v).label}」にしました`);
        }, '状態')),
      h('div', { class: 'actions stack-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => { close(); openContractSheet(store, store.get().contracts.find((x) => x.id === c.id)); } }, '編集する'),
        /^https?:\/\//.test(c.cancelUrl || '') ? h('a', { class: 'btn', href: c.cancelUrl, target: '_blank', rel: 'noopener noreferrer' }, '解約ページを開く ↗') : null,
        h('button', { type: 'button', class: 'btn primary', onClick: async () => {
          const ok = await ask(`${c.name} を解約しましたか？「退去済み」に移して、浮いたお金を記録します。`, { ok: '解約した', title: '退去の確認' });
          if (!ok) { openRoomSheet(store, c.id); return; }
          store.update((st) => {
            const i = st.contracts.findIndex((x) => x.id === c.id);
            if (i < 0) return;
            const [k] = st.contracts.splice(i, 1);
            st.former.unshift({ ...k, status: 'cancel', cancelledAt: today });
          });
          toast(m ? `${c.name} が退去しました。月 ${money(m)}円 浮きます` : `${c.name} が退去しました`);
        } }, '解約した（退去済みにする）')));
  });
}
