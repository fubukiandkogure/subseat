import { h, money, tile, toast, segmented, openSheet, shareOrSave, bigAmount, otherAmount, modeToggle, flipMode, undoable } from '../ui.js';
import { haptic, burstFrom, countUp } from '../feel.js';
import { facadeSvg } from '../facade.js';
import {
  totals, planRooms, takeHomeBreakdown, upcoming, relativeLabel, savings, CATEGORIES, chargeYen,
  inspectionDue, formerSaved, occurrencesInRange, recentRaise
} from '../model.js';
import { layoutSubs, planSvg, shareSvg, svgToPng, readPalette, amountText } from '../plan.js';
import { todayYmd, parseYmd, weekday, addMonths, daysInMonth, diffDays, pad2 } from '../dates.js';
import { hasSample, clearSample } from '../store.js';
import { openRoomSheet } from './room-sheet.js';
import { openContractSheet } from './contract-sheet.js';
import { openInspection } from './inspect.js';

// 模様替え（これをやめたら？）の状態。画面を離れたら消える
const remodel = { on: false, ids: new Set(), last: null };
let calMonth = null;
const W = 400;

export function startRemodel(ids) {
  remodel.on = true;
  remodel.ids = new Set(ids);
}

const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
// カレンダーの小さなマス用（2.6万 など）
const yenShort = (n) => (n >= 100000 ? `${Math.round(n / 10000)}万` : n >= 10000 ? `${(Math.round(n / 1000) / 10).toFixed(1)}万` : money(n));

export function renderHome(root, store, go) {
  const state = store.get();
  const today = todayYmd();
  const { settings } = state;
  const rate = settings.usdJpy;
  const year = state.ui.mode === 'year';
  const t = totals(state);
  const rooms = planRooms(state, today);
  const subsYear = rooms.reduce((a, r) => a + r.value, 0);
  const contractById = new Map(state.contracts.map((c) => [c.id, c]));
  for (const id of [...remodel.ids]) if (!contractById.has(id)) remodel.ids.delete(id);
  const rerender = () => renderHome(root, store, go);
  const unit = year ? 'year' : 'month';

  // ---------- サンプルのお知らせ ----------
  const sampleBar = hasSample(state) ? h('div', { class: 'sample-bar' },
    h('span', null, 'いま見ているのはサンプルのサブスク荘です'),
    h('button', { class: 'btn small', type: 'button', onClick: async () => {
      undoable(store, 'サンプルを消しました', clearSample);
    } }, 'サンプルを消す')) : null;

  // ---------- 合計 ----------
  const subsMonth = subsYear / 12;
  const chips = [
    settings.rent > 0 && subsYear > 0 ? h('span', { class: 'stat-chip' }, `1年で家賃 ${(Math.round((subsYear / settings.rent) * 10) / 10).toFixed(1)}か月分`) : null
  ].filter(Boolean);
  // 外観：窓を押すとその部屋、空き部屋は入居希望へ
  const facade = h('div', { class: 'facade' });
  facade.innerHTML = facadeSvg(state.contracts.map((c) => ({ id: c.id, name: c.name, roomNo: c.roomNo, category: c.category, status: c.status, trial: !!c.trial?.on, raise: !!recentRaise(c, today) })));
  const openWindow = (el) => {
    const g = el?.closest('.fa-room');
    if (!g) return;
    if (g.dataset.id) { openRoomSheet(store, g.dataset.id); return; }
    toast('空き部屋です', { action: '入居者を探す', onAction: () => go('import') });
  };
  facade.addEventListener('click', (e) => openWindow(e.target));
  facade.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWindow(e.target); } });

  const summary = h('section', { class: 'summary hero' }, facade, h('div', { class: 'hero-body' },
    h('div', { class: 'summary-top' }, h('p', { class: 'eyebrow' }, 'サブスクに払っている額'), modeToggle(store)),
    bigAmount(subsMonth, year, { key: 'home-total', onTap: () => flipMode(store) }),
    h('p', { class: 'money-line' }, h('span', null, otherAmount(subsMonth, year)), h('span', { class: 'sep' }, '・'), h('span', null, `${rooms.length}部屋`)),
    nextPay(store, state, today),
    chips.length ? h('div', { class: 'stat-chips' }, chips) : null,
    breakdownView(takeHomeBreakdown(state), year, go)));

  // ---------- お知らせ ----------
  const alerts = [];
  const chip = (icon, text, onClick, tone = '') => h('button', { type: 'button', class: `alert ${tone}`, onClick }, h('span', { 'aria-hidden': 'true' }, icon), h('span', null, text));
  if (state.candidates.length) alerts.push(chip('🚪', `入居希望者が ${state.candidates.length}人 待っています`, () => go('import'), 'accent'));
  for (const c of state.contracts) {
    if (c.trial?.on && c.trial.endDate) {
      const d = diffDays(today, c.trial.endDate);
      if (d >= 0 && d <= 7) alerts.push(chip('⏰', `${c.name} の内見が${relativeLabel(c.trial.endDate, today)}で終わります`, () => openRoomSheet(store, c.id), 'warn'));
    }
  }
  if (inspectionDue(state, today)) alerts.push(chip('🔦', '今月の見回り（1分）', () => openInspection(store, { onRemodel: (ids) => {
    startRemodel(ids);
    rerender();
    requestAnimationFrame(() => document.querySelector('.plan-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } }), 'ok'));
  const raises = state.contracts.filter((c) => recentRaise(c, today));
  if (raises.length) alerts.push(chip('📈', `最近値上げした部屋 ${raises.length}件（${raises.map((c) => c.name).join('、')}）`, () => openRoomSheet(store, raises[0].id)));
  if (t.unknown) alerts.push(chip('❔', `金額が分からない部屋 ${t.unknown}件（入れると間取りに入ります）`, () => go('contracts')));
  const alertBox = alerts.length ? h('section', { class: 'board', 'aria-label': '管理人からのお知らせ' },
    h('p', { class: 'board-head' }, '管理人からのお知らせ'),
    h('div', { class: 'alerts' }, alerts)) : null;

  // ---------- 間取り ----------
  const H = rooms.length > 8 ? 500 : 440;
  const laid = layoutSubs(rooms, W, H);
  const wrap = h('div', { class: 'plan-wrap' });
  if (laid.length) {
    wrap.innerHTML = planSvg(laid, { w: W, h: H, vacant: remodel.on ? remodel.ids : new Set(), unit });
    // 画面に入ったときは部屋が順にぽんぽん出る。模様替えで押した部屋は少しはずむ
    if (root.classList.contains('enter')) {
      wrap.classList.add('enter');
      wrap.querySelectorAll('.room').forEach((g, i) => g.style.setProperty('--i', String(i)));
    }
    if (remodel.last) { wrap.querySelector(`[data-id="${CSS.escape(remodel.last)}"]`)?.classList.add('pop'); remodel.last = null; }
    const act = (el) => {
      const id = el?.closest('[data-id]')?.dataset.id;
      if (!id) return;
      if (remodel.on) {
        remodel.ids.has(id) ? remodel.ids.delete(id) : remodel.ids.add(id);
        remodel.last = id;
        haptic('select');
        rerender();
        return;
      }
      openRoomSheet(store, id);
    };
    wrap.addEventListener('click', (e) => act(e.target));
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e.target); } });
  }

  const legendCats = new Set(rooms.map((r) => r.category));
  const legend = h('ul', { class: 'legend' },
    CATEGORIES.filter((c) => legendCats.has(c.id)).map((c) => h('li', null, h('span', { class: 'swatch', style: { background: `var(--cat-${c.id})` } }), c.label)));

  let planBody;
  if (!laid.length) {
    planBody = h('div', { class: 'empty-plan' },
      h('p', { class: 'recruit', 'aria-hidden': 'true' }, '入居者募集中'),
      h('p', null, h('b', null, 'まだ入居者がいません')),
      h('p', { class: 'muted small' }, 'カード明細やメモから入居希望者を探すか、手で入居させてください。'),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onClick: () => go('import') }, '入居希望者を探す'),
        h('button', { type: 'button', class: 'btn', onClick: () => openContractSheet(store, null) }, '手で入居させる')));
  } else {
    planBody = [
      wrap,
      legend,
      h('div', { class: 'plan-actions' },
        h('button', { type: 'button', class: `btn remodel-btn${remodel.on ? ' on' : ''}`, onClick: () => {
          remodel.on = !remodel.on;
          remodel.ids.clear();
          rerender();
        } }, remodel.on ? '模様替えをやめる' : [h('b', null, '模様替え'), h('small', null, 'やめたらどうなる？')]),
        h('button', { type: 'button', class: 'btn', onClick: () => saveImage(laid, H, unit, subsYear, rooms.length) }, '画像で保存'))
    ];
  }

  const planCard = h('section', { class: 'plan-card' },
    h('div', { class: 'plan-head' }, h('h2', null, '間取り'), h('p', { class: 'plan-sub' }, '部屋の広さ＝払っている額。タップで詳しく')),
    planBody);

  // ---------- 模様替えの結果 ----------
  let bar = null;
  if (remodel.on) {
    const sv = savings(state, remodel.ids);
    bar = h('div', { class: 'whatif-bar', role: 'status' },
      remodel.ids.size
        ? h('div', { class: 'whatif-text' },
          h('p', null, `${remodel.ids.size}部屋を退去させると`),
          h('p', null, savedAmount(year ? sv.year : sv.month, year), h('span', null, '浮きます')),
          h('p', { class: 'whatif-sub' }, `${year ? `月 ${money(sv.month)}円` : `年 ${money(sv.year)}円`}・サブスク代の ${pct(sv.share)}`))
        : h('p', null, '退去させてみたい部屋をタップしてください'),
      h('div', { class: 'whatif-actions' },
        remodel.ids.size ? h('button', { type: 'button', class: 'btn small primary', onClick: (e) => {
          const n = remodel.ids.size;
          const ids = new Set(remodel.ids);
          burstFrom(e.currentTarget);
          haptic('success');
          remodel.on = false;
          remodel.ids.clear();
          undoable(store, `${n}部屋を「退去予定」にしました`, (s) => { for (const c of s.contracts) if (ids.has(c.id)) c.status = 'cancel'; });
        } }, '退去予定にする') : null,
        h('button', { type: 'button', class: 'btn small', onClick: () => { remodel.on = false; remodel.ids.clear(); rerender(); } }, '閉じる')));
  }

  // ---------- 支払い ----------
  const calView = state.ui.calView === 'calendar' ? 'calendar' : 'list';
  const payHead = h('div', { class: 'section-head' },
    h('h2', null, 'これからの支払い'),
    segmented([{ id: 'list', label: 'リスト' }, { id: 'calendar', label: 'カレンダー' }], calView, (v) => store.update((s) => { s.ui.calView = v; }), '支払いの見せ方'));
  const payments = h('section', { class: 'timeline', 'aria-label': 'これからの支払い' }, payHead,
    calView === 'list' ? paymentList(store, state, today) : calendar(store, state, today, rerender));

  // ---------- 退去の記録 ----------
  const fs = formerSaved(state.former, today, rate);
  const formerCard = fs.count ? h('button', { type: 'button', class: 'former-card', onClick: () => go('contracts') },
    h('span', { class: 'former-icon', 'aria-hidden': 'true' }, '🧹'),
    h('span', null,
      h('b', null, `これまでに ${fs.count}部屋が退去`),
      h('span', null, `月 ${money(fs.monthly)}円・年 ${money(fs.year)}円 が浮いています`),
      fs.saved > 0 ? h('span', { class: 'saved' }, `退去してから約 ${money(fs.saved)}円 浮きました`) : null)) : null;

  root.replaceChildren(...[sampleBar, summary, alertBox, planCard, payments, formerCard, bar].filter(Boolean));
  document.body.classList.toggle('has-whatif', remodel.on);
}

// 浮く額（数字はカウントアップ）
function savedAmount(value, year) {
  const num = h('span', null, money(value));
  countUp(num, value, (v) => money(v), `whatif-${year ? 'y' : 'm'}`, 380);
  return h('b', null, year ? '年 ' : '月 ', num, '円');
}

// 次の支払い（ホームを開いたら、まずこれが分かる）
function nextPay(store, state, today) {
  const e = upcoming(state, today, 60)[0];
  if (!e) return null;
  const c = e.contract;
  const amt = c.amount == null ? '' : c.currency === 'USD' ? `$${c.amount}` : `${money(c.amount)}円`;
  const rel = relativeLabel(e.date, today);
  return h('button', { type: 'button', class: `next-pay${e.type === 'trialEnd' ? ' trial' : ''}`, onClick: () => openRoomSheet(store, c.id) },
    h('span', { class: 'next-label' }, e.type === 'trialEnd' ? '次に内見おわり' : '次の支払い'),
    h('span', { class: 'next-when' }, rel),
    tile(c.name),
    h('span', { class: 'next-name' }, c.name),
    h('b', null, amt));
}

// 手取りの内訳：1本の帯と、項目ごとの額・割合
function breakdownView(bd, year, go) {
  if (!bd) return h('button', { type: 'button', class: 'link-btn', onClick: () => go('settings') }, '手取りを入れると、手取りのうちサブスクが何%かが出ます →');
  const k = year ? 12 : 1;
  const rows = [...bd.parts, { id: 'free', label: '自由に使えるお金', monthly: bd.free }];
  return h('div', { class: 'breakdown' },
    h('p', { class: 'breakdown-head' }, h('span', null, '手取りの内訳'), h('span', null, `${year ? '年' : '月'} ${money(bd.take * k)}円`)),
    h('div', { class: 'breakdown-bar', role: 'img', 'aria-label': rows.map((r) => `${r.label} ${pct(r.monthly / bd.take)}`).join('、') },
      rows.filter((r) => r.monthly > 0).map((r) => h('span', { class: `bd-${r.id}`, style: { flexGrow: String(r.monthly) } }))),
    h('ul', { class: 'breakdown-list' }, rows.map((r) => h('li', { class: r.id === 'subs' ? 'em' : '' },
      h('i', { class: `bd-${r.id}`, 'aria-hidden': 'true' }),
      h('span', null, r.label),
      h('b', null, `${money(r.monthly * k)}円`),
      h('small', null, pct(r.monthly / bd.take))))),
    bd.over ? h('p', { class: 'notice' }, `手取りより ${year ? '年' : '月'} ${money(bd.over * k)}円 多く使う計算です`) : null);
}

function paymentList(store, state, today) {
  const events = upcoming(state, today, 30);
  const undated = state.contracts.filter((c) => !c.nextDate).length;
  return h('div', null,
    events.length ? h('ol', { class: 'events' }, events.map((e) => eventRow(store, state, e, today))) : h('p', { class: 'empty' }, 'これから30日の支払いはありません'),
    undated ? h('p', { class: 'muted small' }, `次の支払日が未確定の部屋（${undated}件）は、ここには出ません`) : null);
}

function eventRow(store, state, e, today, showDate = true) {
  const c = e.contract;
  const dt = parseYmd(e.date);
  const rel = relativeLabel(e.date, today);
  const isTrial = e.type === 'trialEnd';
  const yearly = !isTrial && c.cycle === 'year';
  const amount = c.amount == null ? '金額未確定' : c.currency === 'USD' ? `$${c.amount}` : `${money(c.amount)}円`;
  const approx = c.amount != null && c.currency === 'USD' ? `約${money(chargeYen(c, state.settings.usdJpy))}円` : null;
  return h('li', { class: `event${isTrial ? ' trial' : ''}${yearly ? ' yearly' : ''}` },
    h('button', { type: 'button', class: 'event-btn', onClick: () => openRoomSheet(store, c.id) },
      showDate ? h('span', { class: 'event-date' }, h('b', null, `${dt.getMonth() + 1}/${dt.getDate()}`), h('span', null, weekday(e.date))) : null,
      tile(c.name),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, c.name),
        h('span', { class: 'row-sub' },
          h('span', { class: 'rel' }, isTrial ? `${rel}で内見おわり` : yearly ? `${rel}に年払い` : `${rel}に支払い`),
          isTrial ? h('span', { class: 'badge warn' }, 'このあと有料') : null,
          yearly ? h('span', { class: 'badge accent' }, '年払い') : null)),
      h('span', { class: 'row-amount' }, h('span', null, amount), approx ? h('small', null, approx) : null)));
}

function calendar(store, state, today, rerender) {
  const month = calMonth || today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`, end = `${month}-${pad2(daysInMonth(y, m - 1))}`;
  const byDay = new Map();
  let sum = 0;
  for (const c of state.contracts) {
    for (const d of occurrencesInRange(c, start, end)) {
      const yen = chargeYen(c, state.settings.usdJpy);
      sum += yen ?? 0;
      (byDay.get(d) || byDay.set(d, []).get(d)).push({ date: d, type: 'pay', contract: c, yen, charged: true });
    }
    const te = c.trial?.on && c.trial.endDate;
    if (te && te >= start && te <= end) {
      const list = byDay.get(te) || byDay.set(te, []).get(te);
      const same = list.find((e) => e.contract === c);
      if (same) same.type = 'trialEnd';
      else list.push({ date: te, type: 'trialEnd', contract: c, yen: chargeYen(c, state.settings.usdJpy), charged: false });
    }
  }
  const firstDow = new Date(y, m - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(h('span', { class: 'cal-cell out' }));
  for (let d = 1; d <= daysInMonth(y, m - 1); d++) {
    const date = `${month}-${pad2(d)}`;
    const evs = byDay.get(date) || [];
    const daySum = evs.reduce((a, e) => a + (e.charged ? e.yen ?? 0 : 0), 0);
    const hasTrial = evs.some((e) => e.type === 'trialEnd');
    cells.push(h('button', {
      type: 'button',
      class: `cal-cell${date === today ? ' today' : ''}${evs.length ? ' has' : ''}${hasTrial ? ' trial' : ''}${date < today ? ' past' : ''}`,
      'aria-label': `${m}月${d}日${evs.length ? `、支払い ${evs.length}件 ${money(daySum)}円` : ''}`,
      onClick: () => {
        if (!evs.length) return;
        openSheet(`${m}月${d}日（${weekday(date)}）`, () => h('ol', { class: 'events' }, evs.map((e) => eventRow(store, state, e, today, false))));
      }
    },
    h('span', { class: 'cal-d' }, d),
    daySum ? h('span', { class: 'cal-yen' }, yenShort(daySum)) : null,
    evs.length ? h('span', { class: 'cal-dots' }, evs.slice(0, 3).map((e) => h('i', { style: { background: `var(--cat-${e.contract.category})` } })), evs.length > 3 ? h('small', null, `+${evs.length - 3}`) : null) : null));
  }
  const shift = (n) => { calMonth = addMonths(`${month}-01`, n).slice(0, 7); rerender(); };
  return h('div', { class: 'cal' },
    h('div', { class: 'cal-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '前の月', onClick: () => shift(-1) }, '‹'),
      h('p', null, h('b', null, `${y}年${m}月`), h('span', null, `支払い ${money(sum)}円`)),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '次の月', onClick: () => shift(1) }, '›')),
    h('div', { class: 'cal-grid cal-wd', 'aria-hidden': 'true' }, [...'日月火水木金土'].map((w) => h('span', null, w))),
    h('div', { class: 'cal-grid' }, cells));
}

// 間取り図を画像にして共有・保存する（金額を出すか選べる）
function saveImage(laid, H, unit, subsYear, count) {
  openSheet('画像で保存', (close) => {
    const make = async (hide) => {
      close();
      try {
        const P = readPalette();
        const title = 'わたしのサブスク荘';
        const sub = hide ? `${count}部屋` : `${count}部屋・${amountText(subsYear, unit)}`;
        const svg = shareSvg(laid, { w: W, h: H, title, sub, footer: '部屋の広さ＝払っている額', unit: hide ? 'none' : unit, palette: P });
        const blob = await svgToPng(svg);
        const r = await shareOrSave(blob, `subsou-${todayYmd().replace(/-/g, '')}.png`, title);
        if (r === 'saved') toast('画像を保存しました');
      } catch (e) {
        toast(e.message || '画像にできませんでした');
      }
    };
    return h('div', { class: 'form' },
      h('p', { class: 'muted' }, 'SNS に載せるときは、金額を隠すこともできます。'),
      h('div', { class: 'actions stack-actions' },
        h('button', { type: 'button', class: 'btn primary', onClick: () => make(false) }, '金額も入れる'),
        h('button', { type: 'button', class: 'btn', onClick: () => make(true) }, '金額を隠す')));
  });
}

export function leaveHome() {
  remodel.on = false;
  remodel.ids.clear();
  document.body.classList.remove('has-whatif');
}
