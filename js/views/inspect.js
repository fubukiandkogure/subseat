import { h, money, tile, openSheet, toast } from '../ui.js';
import { yearlyYen } from '../model.js';
import { todayYmd } from '../dates.js';
import { USAGE } from './room-sheet.js';

// 月1回の見回り（棚卸し）：部屋をひとつずつ回って「今月使った？」に答える。
// 使っていない部屋が分かったら、そのまま模様替えで「退去させたらいくら浮くか」を見られる。
export function openInspection(store, { onRemodel } = {}) {
  const today = todayYmd();
  const month = today.slice(0, 7);
  const st = store.get();
  const rate = st.settings.usdJpy;
  const list = st.contracts.filter((c) => c.amount != null).sort((a, b) => yearlyYen(b, rate) - yearlyYen(a, rate));
  if (!list.length) { toast('見回る部屋がまだありません'); return; }
  const answers = new Map();
  let i = 0;

  openSheet('今月の見回り', (close) => {
    const body = h('div', { class: 'inspect' });

    const finish = () => {
      store.update((s) => {
        for (const k of s.contracts) {
          const a = answers.get(k.id);
          if (a) k.usage = [...(k.usage || []).filter((u) => u.month !== month), { month, answer: a }].slice(-12);
        }
        s.lastInspection = today;
      });
      const none = list.filter((c) => answers.get(c.id) === 'none');
      const some = list.filter((c) => answers.get(c.id) === 'some');
      const year = none.reduce((a, c) => a + yearlyYen(c, rate), 0);
      body.replaceChildren(
        h('p', { class: 'inspect-done' }, '見回りおわり'),
        h('ul', { class: 'inspect-stats' },
          h('li', null, h('b', null, list.filter((c) => answers.get(c.id) === 'good').length), 'よく使った'),
          h('li', null, h('b', null, some.length), 'たまに'),
          h('li', { class: none.length ? 'warn' : '' }, h('b', null, none.length), '使ってない')),
        none.length
          ? h('p', { class: 'notice' }, `使っていない ${none.length}部屋（${none.map((c) => c.name).join('、')}）で、月 ${money(year / 12)}円・年 ${money(year)}円 です。`)
          : h('p', { class: 'muted' }, 'どの部屋もちゃんと使われていました。また来月。'),
        h('div', { class: 'actions stack-actions' },
          none.length && onRemodel ? h('button', { type: 'button', class: 'btn primary', onClick: () => { close(); onRemodel(new Set(none.map((c) => c.id))); } }, '退去させたら？を模様替えで見る') : null,
          none.length ? h('button', { type: 'button', class: 'btn', onClick: () => {
            store.update((s) => { for (const k of s.contracts) if (none.some((n) => n.id === k.id) && k.status === 'keep') k.status = 'review'; });
            close();
            toast('使っていない部屋を「見直す」にしました');
          } }, '使っていない部屋を「見直す」にする') : null,
          h('button', { type: 'button', class: 'btn', onClick: close }, '閉じる')));
    };

    const render = () => {
      if (i >= list.length) return finish();
      const c = list[i];
      const y = yearlyYen(c, rate);
      body.replaceChildren(
        h('div', { class: 'inspect-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(list.length), 'aria-valuenow': String(i) },
          h('span', { style: { width: `${(i / list.length) * 100}%` } })),
        h('p', { class: 'muted small' }, `${i + 1} / ${list.length} 部屋目`),
        h('div', { class: 'inspect-card' }, tile(c.name, 'l'),
          h('p', { class: 'inspect-name' }, c.name),
          h('p', { class: 'muted small' }, `月 ${money(y / 12)}円・年 ${money(y)}円`)),
        h('p', { class: 'inspect-q' }, '今月、使いましたか？'),
        h('div', { class: 'inspect-answers' }, Object.entries(USAGE).map(([k, label]) =>
          h('button', { type: 'button', class: `btn answer ${k}`, onClick: () => { answers.set(c.id, k); i++; render(); } }, label))),
        h('div', { class: 'inspect-nav' },
          i > 0 ? h('button', { type: 'button', class: 'btn ghost small', onClick: () => { i--; render(); } }, '← もどる') : h('span'),
          h('button', { type: 'button', class: 'btn ghost small', onClick: () => { i++; render(); } }, 'とばす →')));
    };
    render();
    return body;
  });
}
