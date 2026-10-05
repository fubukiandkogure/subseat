import { h, yen, money, tile, openSheet, toast, segmented } from '../ui.js';
import { totals, seatPlan, upcoming, relativeLabel, savings, catLabel, CATEGORIES, chargeYen } from '../model.js';
import { todayYmd, parseYmd, weekday } from '../dates.js';
import { hasSample, clearSample } from '../store.js';
import { openContractSheet } from './contract-sheet.js';

// 「これをやめたら？」の状態（画面を離れたら消える一時的なもの）
const whatIf = { on: false, ids: new Set() };

const COLS = 14;
const SHADES = [0, 22, 40];
const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function itemColor(it, freed) {
  if (freed) return 'var(--freed)';
  const base = `var(--cat-${it.category})`;
  const shaded = it.shade ? `color-mix(in oklab, ${base} ${100 - SHADES[it.shade]}%, var(--shade-mix))` : base;
  return it.status === 'cancel' ? `color-mix(in oklab, ${shaded} 45%, transparent)` : shaded;
}

function seatFill(seat, byId) {
  let acc = 0;
  const stops = [];
  for (const g of seat.segs) {
    const it = byId.get(g.id);
    const c = itemColor(it, whatIf.on && whatIf.ids.has(g.id));
    const a = (acc * 100).toFixed(2), b = ((acc + g.frac) * 100).toFixed(2);
    stops.push(`${c} ${a}% ${b}%`);
    acc += g.frac;
  }
  if (!stops.length) return 'transparent';
  stops.push(`transparent ${(acc * 100).toFixed(2)}% 100%`);
  return `linear-gradient(to top, ${stops.join(', ')})`;
}

export function renderHome(root, store, go) {
  const state = store.get();
  const today = todayYmd();
  const year = state.ui.mode === 'year';
  const k = year ? 12 : 1;
  const t = totals(state);
  const plan = seatPlan(state);
  const itemById = new Map(plan.items.map((it) => [it.id, it]));
  const contractById = new Map(state.contracts.map((c) => [c.id, c]));
  if (whatIf.on) for (const id of whatIf.ids) if (!contractById.has(id)) whatIf.ids.delete(id);

  const openItem = (id) => {
    if (id.startsWith('fixed:')) { toast('固定費は「設定」で変えられます'); return; }
    if (whatIf.on) { whatIf.ids.has(id) ? whatIf.ids.delete(id) : whatIf.ids.add(id); renderHome(root, store, go); return; }
    openContractSheet(store, contractById.get(id));
  };

  // ---------- サンプルのお知らせ ----------
  const sampleBar = hasSample(state) ? h('div', { class: 'sample-bar' },
    h('span', null, '表示しているのはサンプルデータです'),
    h('button', { class: 'btn small', type: 'button', onClick: () => {
      if (!confirm('サンプルの契約と設定を消しますか？（自分で入れたものは消えません）')) return;
      store.update(clearSample);
      toast('サンプルを消しました');
    } }, 'サンプルを消す')) : null;

  // ---------- 合計 ----------
  const big = t.takeHome ? t.reserved : t.subs;
  const pct = t.takeHome ? Math.round((t.reserved / t.takeHome) * 100) : null;
  const summary = h('section', { class: 'summary' },
    h('div', { class: 'summary-top' },
      h('p', { class: 'eyebrow' }, year ? '1年で使い道が決まっているお金' : '毎月、使い道が決まっているお金'),
      segmented([{ id: 'month', label: '月額' }, { id: 'year', label: '年額' }], state.ui.mode, (m) => store.update((s) => { s.ui.mode = m; }), '表示する単位')),
    h('p', { class: `big ${year ? 'big-year' : ''}` }, h('span', { class: 'num' }, money(big * k)), h('span', { class: 'unit' }, '円')),
    t.takeHome
      ? h('p', { class: 'summary-sub' },
        h('span', null, `手取り ${money(t.takeHome * k)}円 の `, h('b', null, `${pct}%`)),
        h('span', { class: 'dot' }, '・'),
        t.free >= 0 ? h('span', null, '空席 ', h('b', { class: 'free' }, `${money(t.free * k)}円`)) : h('span', { class: 'warn' }, `手取りを ${money(-t.free * k)}円 こえています`))
      : h('p', { class: 'summary-sub' }, `サブスク ${state.contracts.length}件`),
    t.takeHome ? h('p', { class: 'summary-mini' }, `うちサブスク ${money(t.subs * k)}円・固定費 ${money(t.fixed * k)}円`) : null,
    !t.takeHome ? h('button', { class: 'prompt', type: 'button', onClick: () => go('settings') },
      h('b', null, '手取りを入れると、空席も見えます'), h('span', null, '設定で月の手取りを入れる →')) : null,
    t.unknown ? h('button', { class: 'hint-row', type: 'button', onClick: () => go('contracts') },
      `金額が未確定の契約が ${t.unknown}件（席には入っていません）→`) : null
  );

  // ---------- 座席表 ----------
  const grid = h('div', { class: 'seatgrid', role: 'group', 'aria-label': `座席表。1席 ${money(plan.unit)}円` });
  const rows = Math.ceil(plan.seats.length / COLS);
  for (let r = 0; r < rows; r++) {
    const label = ROWS[r % 26] + (r >= 26 ? Math.floor(r / 26) : '');
    grid.append(h('span', { class: 'rowlabel', 'aria-hidden': 'true' }, label));
    for (let c = 0; c < COLS; c++) {
      if (c === COLS / 2) grid.append(h('span', { class: 'aisle', 'aria-hidden': 'true' }));
      const seat = plan.seats[r * COLS + c];
      if (!seat) { grid.append(h('span', { class: 'seat-gap' })); continue; }
      const ids = seat.segs.map((g) => g.id);
      const names = [...new Set(ids)].map((id) => itemById.get(id).name);
      const freed = whatIf.on && ids.some((id) => whatIf.ids.has(id));
      grid.append(h('button', {
        type: 'button',
        class: `seat${seat.over ? ' over' : ''}${ids.length ? ' taken' : ''}${freed ? ' freed' : ''}`,
        style: { '--fill': seatFill(seat, itemById), '--d': `${Math.min(seat.index, 120) * 9}ms` },
        'aria-label': `${label}${c + 1}席：${names.length ? names.join('、') : '空席'}`,
        onClick: () => {
          const uniq = [...new Set(ids)];
          if (!uniq.length) { toast(whatIf.on ? 'サブスクの席を選ぶと、やめたときの額が出ます' : `空席です（1席 ${money(plan.unit)}円）`); return; }
          if (uniq.length === 1) return openItem(uniq[0]);
          openSheet(`${label}${c + 1}席にいるもの`, (close) => h('div', { class: 'list' },
            uniq.map((id) => {
              const it = itemById.get(id);
              return h('button', { class: 'row', type: 'button', onClick: () => { close(); openItem(id); } },
                tile(it.name), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, it.name), h('span', { class: 'row-sub' }, catLabel(it.category))),
                h('span', { class: 'row-amount' }, `${money(it.yen * k)}円`));
            })));
        }
      }, h('span', { class: 'f', 'aria-hidden': 'true' })));
    }
    grid.append(h('span', { class: 'rowlabel', 'aria-hidden': 'true' }, label));
  }

  // カテゴリごとの合計（凡例）
  const catTotals = new Map();
  for (const it of plan.items) catTotals.set(it.category, (catTotals.get(it.category) || 0) + it.yen);
  const legend = h('ul', { class: 'legend' },
    CATEGORIES.filter((c) => catTotals.has(c.id)).map((c) => h('li', null,
      h('span', { class: 'swatch', style: { background: `var(--cat-${c.id})` } }),
      h('span', null, c.label), h('b', null, money(catTotals.get(c.id) * k)))),
    h('li', null, h('span', { class: 'swatch vacant' }), h('span', null, '空席')));

  // サブスクの一覧（席が小さくて押しにくいとき用。やめたらモードではここでも選べる）
  const subs = plan.items.filter((it) => it.kind === 'sub');
  const subList = h('div', { class: 'list compact' }, subs.map((it) => {
    const c = contractById.get(it.id);
    const picked = whatIf.ids.has(it.id);
    return h('button', { type: 'button', class: `row${whatIf.on ? ' pickable' : ''}${picked ? ' picked' : ''}`, 'aria-pressed': whatIf.on ? String(picked) : null, onClick: () => openItem(it.id) },
      whatIf.on ? h('span', { class: 'pick', 'aria-hidden': 'true' }, picked ? '✓' : '') : null,
      tile(it.name),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, it.name),
        h('span', { class: 'row-sub' }, h('span', { class: 'swatch mini', style: { background: `var(--cat-${it.category})` } }), catLabel(it.category),
          c.cycle === 'year' ? h('span', { class: 'badge accent' }, '年払い') : null,
          c.trial?.on ? h('span', { class: 'badge warn' }, '体験中') : null,
          c.status === 'review' ? h('span', { class: 'badge' }, '見直す') : null,
          c.status === 'cancel' ? h('span', { class: 'badge' }, '解約予定') : null)),
      h('span', { class: 'row-amount' }, `${money(it.yen * k)}円`));
  }));

  const theater = h('section', { class: 'theater', 'aria-label': '予約席' },
    h('div', { class: 'theater-head' },
      h('h2', null, '予約席'),
      h('span', { class: 'unit-note' }, `1席 ＝ ${money(plan.unit)}円`)),
    h('div', { class: 'screen', 'aria-hidden': 'true' }, 'SCREEN'),
    grid,
    legend,
    h('button', { type: 'button', class: `btn whatif-btn${whatIf.on ? ' on' : ''}`, onClick: () => {
      whatIf.on = !whatIf.on;
      whatIf.ids.clear();
      renderHome(root, store, go);
      if (whatIf.on) toast('やめてみたいサブスクを選んでください');
    } }, whatIf.on ? '席を元に戻す' : 'これをやめたら？'),
    subs.length ? subList : h('p', { class: 'empty' }, 'まだ契約がありません。「取り込み」から明細を読み込むか、思いつくものを書いてみてください。')
  );

  // ---------- やめたら？の結果 ----------
  let bar = null;
  if (whatIf.on) {
    const sv = savings(state, whatIf.ids);
    bar = h('div', { class: 'whatif-bar', role: 'status' },
      whatIf.ids.size
        ? h('p', null, h('span', null, `${whatIf.ids.size}件をやめると`), h('b', null, `月 ${money(sv.month)}円`), h('span', { class: 'sep' }, '／'), h('b', { class: 'year' }, `年 ${money(sv.year)}円`), h('span', null, 'の席が空きます'))
        : h('p', null, '席か一覧から、やめてみたいものを選んでください'),
      h('div', { class: 'whatif-actions' },
        whatIf.ids.size ? h('button', { type: 'button', class: 'btn small primary', onClick: () => {
          const n = whatIf.ids.size;
          store.update((s) => { for (const c of s.contracts) if (whatIf.ids.has(c.id)) c.status = 'cancel'; });
          whatIf.on = false; whatIf.ids.clear();
          toast(`${n}件を「解約予定」にしました`);
        } }, '解約予定にする') : null,
        h('button', { type: 'button', class: 'btn small', onClick: () => { whatIf.on = false; whatIf.ids.clear(); renderHome(root, store, go); } }, '閉じる')));
  }

  // ---------- 支払いタイムライン ----------
  const events = upcoming(state, today, 30);
  const undated = state.contracts.filter((c) => !c.nextDate).length;
  const timeline = h('section', { class: 'timeline', 'aria-label': 'これから30日の支払い' },
    h('h2', null, 'これから30日の支払い'),
    events.length ? h('ol', { class: 'events' }, events.map((e) => {
      const c = e.contract;
      const dt = parseYmd(e.date);
      const rel = relativeLabel(e.date, today);
      const isTrial = e.type === 'trialEnd';
      const yearly = !isTrial && c.cycle === 'year';
      const amount = c.amount == null ? '金額未確定' : c.currency === 'USD' ? `$${c.amount}` : `${money(c.amount)}円`;
      const approx = c.amount != null && c.currency === 'USD' ? `約${money(chargeYen(c, state.settings.usdJpy))}円` : null;
      return h('li', { class: `event${isTrial ? ' trial' : ''}${yearly ? ' yearly' : ''}` },
        h('button', { type: 'button', class: 'event-btn', onClick: () => openContractSheet(store, c) },
          h('span', { class: 'event-date' }, h('b', null, `${dt.getMonth() + 1}/${dt.getDate()}`), h('span', null, weekday(e.date))),
          tile(c.name),
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, c.name),
            h('span', { class: 'row-sub' },
              h('span', { class: 'rel' }, isTrial ? `${rel}で無料体験おわり` : yearly ? `${rel}に年払い` : `${rel}に支払い`),
              isTrial ? h('span', { class: 'badge warn' }, 'このあと有料') : null,
              yearly ? h('span', { class: 'badge accent' }, '年払い') : null)),
          h('span', { class: 'row-amount' }, h('span', null, amount), approx ? h('small', null, approx) : null)));
    })) : h('p', { class: 'empty' }, 'これから30日の支払いはありません'),
    undated ? h('p', { class: 'muted small' }, `次回の支払日が未確定の契約（${undated}件）は、ここには出ません`) : null
  );

  root.replaceChildren(...[sampleBar, summary, theater, timeline, bar].filter(Boolean));
  document.body.classList.toggle('has-whatif', whatIf.on);
}

export function leaveHome() {
  whatIf.on = false;
  whatIf.ids.clear();
  document.body.classList.remove('has-whatif');
}
