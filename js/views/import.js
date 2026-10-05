import { h, money, tile, toast, select, numberInput, undoable } from '../ui.js';
import { burstFrom, haptic } from '../feel.js';
import { readStatement, readStatementText } from '../csv.js';
import { detectRecurring, reconcile, sameSubscription, TOL } from '../detect.js';
import { parseFreeText } from '../freetext.js';
import { SUB_CATEGORIES, CHANNELS, newContract, uid, recordPrice } from '../model.js';
import { matchMerchant } from '../services.js';
import { sampleCsvText } from '../sample.js';
import { todayYmd } from '../dates.js';
import { compact } from '../text.js';

const CONF = { high: { label: '確度 高', cls: 'ok' }, mid: { label: '確度 中', cls: '' }, low: { label: '確度 低', cls: 'warn' } };
const CURRENCIES = [{ id: 'JPY', label: '円' }, { id: 'USD', label: 'ドル' }];
const CYCLES = [{ id: 'month', label: '毎月' }, { id: 'year', label: '毎年' }];

// 直近の取り込み結果（画面を開いているあいだだけ持つ）と、候補ごとの編集中の値
let lastRun = null;
const drafts = new Map();

const near = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(30, b * TOL);

// 明細 → 候補。登録済みの契約・「違う」にしたものと照合して、新しいものと金額の変化だけ候補に入れる
function addDetection(store, txs, metas, sample) {
  const today = todayYmd();
  const found = detectRecurring(txs, { today });
  const st = store.get();
  const { fresh, changes } = reconcile(found, st.contracts, st.ignored);
  const incoming = [...changes, ...fresh];
  store.update((s) => {
    s.candidates = s.candidates.filter((c) => !incoming.some((n) => n.key && n.key === c.key && near(n.amount, c.amount) && (n.type || '') === (c.type || '')));
    for (const c of incoming) s.candidates.push({ ...c, id: uid(), addedAt: today, ...(sample ? { sample: true } : {}) });
  });
  const dates = txs.map((t) => t.date).sort();
  lastRun = { metas, txCount: txs.length, found: found.length, fresh: fresh.length, changes: changes.length, known: found.length - fresh.length - changes.length, period: dates.length ? [dates[0], dates[dates.length - 1]] : null };
}

async function importFiles(store, files, rerender) {
  const metas = [];
  const txs = [];
  for (const f of files) {
    try {
      const r = readStatement(new Uint8Array(await f.arrayBuffer()));
      metas.push({ name: f.name, ...r });
      txs.push(...r.transactions);
    } catch (e) {
      metas.push({ name: f.name, ok: false, error: '読み込めませんでした' });
    }
  }
  addDetection(store, txs, metas, false);
  rerender();
}

function approve(store, c) {
  const d = drafts.get(c.id) || {};
  const name = (d.name ?? c.name).trim() || c.name;
  const contract = newContract({
    name,
    category: d.category ?? c.category,
    amount: d.amount !== undefined ? d.amount : c.amount,
    currency: d.currency ?? c.currency,
    cycle: d.cycle ?? c.cycle,
    nextDate: d.nextDate !== undefined ? d.nextDate : c.nextDate,
    channel: d.channel ?? c.channel ?? 'direct',
    serviceId: c.serviceId ?? matchMerchant(name)?.id ?? null,
    keys: c.key ? [c.key] : [],
    since: c.firstSeen ? c.firstSeen.slice(0, 7) : null,
    source: c.source,
    ...(c.sample ? { sample: true } : {})
  });
  recordPrice(contract, todayYmd());
  store.update((s) => {
    s.contracts.push(contract);
    s.candidates = s.candidates.filter((x) => x.id !== c.id);
  });
  drafts.delete(c.id);
  return contract;
}

function reject(store, c) {
  store.update((s) => {
    if (c.source === 'csv') s.ignored.push({ key: c.key, amount: c.type === 'change' ? c.to : c.amount, name: c.name, at: todayYmd() });
    s.candidates = s.candidates.filter((x) => x.id !== c.id);
  });
  drafts.delete(c.id);
}

function evidenceList(c) {
  if (!c.evidence?.length) return null;
  return h('details', { class: 'evidence' },
    h('summary', null, `明細 ${c.months || c.evidence.length}か月分の根拠`),
    h('ul', null, c.evidence.map((e) => h('li', null, h('span', null, e.date.replace(/-/g, '/')), h('span', { class: 'merchant' }, e.merchant), h('b', null, `${money(e.amount)}円`)))));
}

function changeCard(store, c) {
  return h('article', { class: 'cand change' },
    h('div', { class: 'cand-head' },
      tile(c.name),
      h('div', { class: 'row-main' },
        h('span', { class: 'row-title' }, c.name),
        h('span', { class: 'row-sub' }, '入居時の金額と、明細の金額がちがいます')),
      h('span', { class: 'badge accent' }, c.to > c.from ? '値上げ？' : '金額の変化')),
    h('p', { class: 'change-amount' }, h('s', null, `${money(c.from)}円`), h('span', { 'aria-hidden': 'true' }, '→'), h('b', null, `${money(c.to)}円`),
      h('small', null, `（月 ${c.to > c.from ? '+' : ''}${money(c.to - c.from)}円）`)),
    evidenceList(c),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary', onClick: () => {
        store.update((s) => {
          const k = s.contracts.find((x) => x.id === c.contractId);
          if (k) { k.amount = c.to; recordPrice(k, todayYmd()); if (c.key && !(k.keys || []).includes(c.key)) k.keys = [...(k.keys || []), c.key]; }
          s.candidates = s.candidates.filter((x) => x.id !== c.id);
        });
        toast(`${c.name} を ${money(c.to)}円 に更新しました`);
      } }, '新しい金額にする'),
      h('button', { type: 'button', class: 'btn', onClick: () => undoable(store, 'このままにしました', () => reject(store, c)) }, 'このまま')));
}

function candidateCard(store, c) {
  if (!drafts.has(c.id)) drafts.set(c.id, {});
  const d = drafts.get(c.id);
  const v = (k) => (d[k] !== undefined ? d[k] : c[k]);
  const conf = CONF[c.confidence] || CONF.mid;
  return h('article', { class: `cand conf-${c.confidence}` },
    h('div', { class: 'cand-head' },
      tile(v('name')),
      h('input', { class: 'cand-name', type: 'text', value: v('name'), 'aria-label': 'サービス名', onInput: (e) => { d.name = e.target.value; } }),
      h('span', { class: `badge ${conf.cls}` }, conf.label)),
    h('p', { class: 'cand-src' }, c.source === 'csv' ? `カード明細から・${c.months}か月分` : '雑入力から', c.sample ? '・サンプル' : ''),
    c.notes?.length ? h('ul', { class: 'cand-notes' }, c.notes.map((n) => h('li', null, n))) : null,
    evidenceList(c),
    h('div', { class: 'cand-fields' },
      h('label', { class: 'mini' }, h('span', null, '金額'), numberInput(v('amount'), (x) => { d.amount = x; }, { placeholder: '未確定' })),
      h('label', { class: 'mini' }, h('span', null, '通貨'), select(CURRENCIES, v('currency'), (x) => { d.currency = x; })),
      h('label', { class: 'mini' }, h('span', null, '周期'), select(CYCLES, v('cycle'), (x) => { d.cycle = x; })),
      h('label', { class: 'mini wide' }, h('span', null, '次回の支払日'), h('input', { type: 'date', value: v('nextDate') || '', onInput: (e) => { d.nextDate = e.target.value || null; } })),
      h('label', { class: 'mini' }, h('span', null, 'カテゴリ'), select(SUB_CATEGORIES, v('category'), (x) => { d.category = x; })),
      h('label', { class: 'mini' }, h('span', null, '経路'), select(CHANNELS, v('channel') || 'direct', (x) => { d.channel = x; }))),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary', onClick: (e) => {
        burstFrom(e.currentTarget);
        haptic('success');
        undoable(store, `${(d.name ?? c.name) || 'サブスク'} が入居しました`, () => approve(store, c));
      } }, '入居させる'),
      h('button', { type: 'button', class: 'btn', onClick: () => undoable(store, c.source === 'csv' ? 'お断りしました。次からは出しません' : 'お断りしました', () => reject(store, c)) }, 'お断り')));
}

export function renderImport(root, store) {
  const rerender = () => renderImport(root, store);
  const state = store.get();

  // ---------- CSV ----------
  const fileInput = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', multiple: true, class: 'visually-hidden', id: 'csv-input',
    onChange: (e) => { if (e.target.files.length) importFiles(store, [...e.target.files], rerender); } });
  const drop = h('label', { class: 'dropzone', for: 'csv-input',
    onDragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
    onDragleave: () => drop.classList.remove('over'),
    onDrop: (e) => { e.preventDefault(); drop.classList.remove('over'); const files = [...e.dataTransfer.files]; if (files.length) importFiles(store, files, rerender); } },
    h('b', null, 'カード明細のCSVを選ぶ'),
    h('span', null, '数か月分をまとめて選べます（PCならここにドラッグ）'));

  const runInfo = lastRun ? h('div', { class: 'run' },
    h('p', null, lastRun.period
      ? `${lastRun.txCount}件の明細（${lastRun.period[0].replace(/-/g, '/')}〜${lastRun.period[1].replace(/-/g, '/')}）から、入居希望者 ${lastRun.fresh}人・金額の変化 ${lastRun.changes}件を見つけました。`
      : '明細を読み取れませんでした。'),
    lastRun.known ? h('p', { class: 'muted small' }, `入居済みの ${lastRun.known}部屋は、変化がないので出していません。`) : null,
    h('details', { class: 'files' }, h('summary', null, '読み取った列を確認する'),
      h('ul', null, lastRun.metas.map((m) => h('li', null,
        h('b', null, m.name),
        m.ok
          ? h('span', null, `文字コード ${m.encoding}・${m.transactions.length}件・日付＝「${m.columns.labels.date}」・金額＝「${m.columns.labels.amount}」・利用先＝「${m.columns.labels.merchant}」`)
          : h('span', { class: 'warn' }, m.error || '読み込めませんでした')))))) : null;

  const csvCard = h('section', { class: 'card' },
    h('h2', null, 'カード明細から探す'),
    h('p', { class: 'muted small' }, '同じお店で、ほぼ同じ額が毎月出ているものを「入居希望者」として見つけます。ファイルはこの端末の中だけで読み、どこにも送りません。'),
    fileInput, drop,
    h('button', { type: 'button', class: 'btn ghost small', onClick: () => {
      const r = readStatementText(sampleCsvText(todayYmd()));
      addDetection(store, r.transactions, [{ name: 'サンプル明細.csv', ...r }], true);
      rerender();
    } }, 'サンプルの明細で試す'),
    runInfo);

  // ---------- 雑入力 ----------
  const ta = h('textarea', { rows: 3, placeholder: '例：ChatGPTとClaudeとYouTube、あとAmazonも払ってると思う', 'aria-label': '契約していそうなサービス' });
  const textCard = h('section', { class: 'card' },
    h('h2', null, '思いつくまま書く（メモから探す）'),
    h('p', { class: 'muted small' }, '金額や更新日が分からなくても大丈夫です（入居させたあとで埋められます）。'),
    ta,
    h('button', { type: 'button', class: 'btn', onClick: () => {
      const items = parseFreeText(ta.value);
      if (!items.length) { toast('サービス名を見つけられませんでした'); return; }
      const st = store.get();
      const already = (it) => st.contracts.some((k) => sameSubscription(k, { ...it, key: compact(it.name) })) ||
        st.candidates.some((k) => (it.serviceId && k.serviceId === it.serviceId) || k.name === it.name);
      const fresh = items.filter((it) => !already(it));
      store.update((s) => { for (const it of fresh) s.candidates.push({ ...it, id: uid(), key: compact(it.name), addedAt: todayYmd() }); });
      ta.value = '';
      toast(fresh.length ? `${fresh.length}人を入居希望者にしました${items.length > fresh.length ? `（入居済み・待っている ${items.length - fresh.length}件は除きました）` : ''}` : 'どれも入居済みか、すでに待っています');
    } }, '入居希望者にする'));

  // ---------- 候補 ----------
  const changes = state.candidates.filter((c) => c.type === 'change');
  const cands = state.candidates.filter((c) => c.type !== 'change');
  const highs = cands.filter((c) => c.confidence === 'high');
  const candSection = h('section', { class: 'cands', 'aria-label': '入居希望者' },
    h('div', { class: 'section-head' },
      h('h2', null, '入居希望者', state.candidates.length ? h('span', { class: 'count' }, state.candidates.length) : null),
      highs.length > 1 ? h('button', { type: 'button', class: 'btn small primary', onClick: (e) => {
        burstFrom(e.currentTarget);
        haptic('success');
        undoable(store, `確度の高い ${highs.length}人が入居しました`, () => { for (const c of highs) approve(store, c); });
      } }, `確度 高 の${highs.length}人をまとめて入居`) : null),
    h('p', { class: 'muted small' }, '入居させるまで、合計や部屋には入りません。金額や日付を直してから入居させられます。'),
    changes.map((c) => changeCard(store, c)),
    cands.map((c) => candidateCard(store, c)),
    !state.candidates.length ? h('p', { class: 'empty' }, 'いまは誰も待っていません。上の2つのどちらかから探してください。') : null);

  root.replaceChildren(csvCard, textCard, candSection);
}
