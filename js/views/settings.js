import { h, toast, download, segmented, field, ask, money, undoable } from '../ui.js';
import { hasSample, clearSample, exportJson, parseBackup, emptyState } from '../store.js';
import { buildIcs } from '../ics.js';
import { todayYmd } from '../dates.js';
import { openTutorial } from './tutorial.js';

const THEMES = [{ id: 'auto', label: '端末に合わせる' }, { id: 'light', label: 'ライト' }, { id: 'dark', label: 'ダーク' }];
const MODES = [{ id: 'month', label: '月で入れる' }, { id: 'year', label: '年で入れる（ボーナス込み）' }];

// 入力し終わったとき（フォーカスが外れたとき）に保存する。打っている途中で画面を作り直さない
function moneyInput(store, key, placeholder, { toStore = (v) => v, fromStore = (v) => v } = {}) {
  const v = store.get().settings[key];
  return h('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1', value: v == null ? '' : Math.round(fromStore(v)), placeholder,
    onChange: (e) => {
      const raw = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
      store.update((s) => { s.settings[key] = raw == null ? null : toStore(raw); delete s.settings.sample; });
      toast('保存しました');
    }
  });
}

// アプリの URL だけを共有する（共有メニューがなければコピー）
async function shareApp() {
  const url = location.origin + location.pathname;
  if (navigator.share) {
    try { await navigator.share({ title: 'サブスク荘', text: 'サブスクを間取り図で見るアプリ。データはスマホの中だけに保存されます。', url }); } catch { /* 閉じただけ */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('URL をコピーしました');
  } catch {
    toast(url);
  }
}

export function renderSettings(root, store) {
  const st = store.get();
  const s = st.settings;
  const yearMode = s.takeHomeMode === 'year';
  const jsonInput = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'json-input',
    onChange: async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const next = parseBackup(await f.text());
        if (!(await ask(`部屋 ${next.contracts.length}件のバックアップを読み込みます。今のデータは置き換わります。`, { ok: '読み込む' }))) return;
        store.replace(next);
        toast('バックアップを読み込みました');
      } catch (err) {
        toast(err.message || '読み込めませんでした');
      }
    } });

  root.replaceChildren(...[
    h('section', { class: 'card' },
      h('h2', null, 'お金'),
      field('手取りの入れ方', segmented(MODES, s.takeHomeMode, (v) => store.update((x) => { x.settings.takeHomeMode = v; }), '手取りの入れ方')),
      field(yearMode ? '年の手取り（ボーナス込み）' : '月の手取り',
        moneyInput(store, 'takeHome', yearMode ? '例：3200000' : '例：240000', yearMode ? { toStore: (v) => Math.round(v / 12), fromStore: (v) => v * 12 } : {}),
        s.takeHome ? `月 ${money(s.takeHome)}円・年 ${money(s.takeHome * 12)}円 として計算しています` : '入れると、ホームに手取りの内訳（サブスク・家賃・通信費・自由に使えるお金）が出ます'),
      h('div', { class: 'field-row two' },
        field('家賃（月）', moneyInput(store, 'rent', '0')),
        field('通信費（月）', moneyInput(store, 'phone', '0'))),
      h('p', { class: 'muted small' }, '固定費はこの2つだけにしています（細かく入れ始めると家計簿になってしまうので）。'),
      field('ドル円レート', moneyInput(store, 'usdJpy', '150'), 'ドル建ての部屋を円にするときに使います')),

    h('section', { class: 'card' },
      h('h2', null, '表示'),
      field('テーマ', segmented(THEMES, s.theme, (v) => store.update((x) => { x.settings.theme = v; }), 'テーマ')),
      field('押したときの振動', segmented([{ id: 'on', label: 'あり' }, { id: 'off', label: 'なし' }], s.haptics === false ? 'off' : 'on', (v) => store.update((x) => { x.settings.haptics = v === 'on'; }), '押したときの振動'), '対応している端末だけ（Android など）'),
      h('button', { type: 'button', class: 'btn', onClick: () => openTutorial(store) }, 'はじめての説明をもう一度見る')),

    h('section', { class: 'card' },
      h('h2', null, 'データ'),
      h('p', { class: 'muted small' }, 'データはこの端末のブラウザの中にだけ保存しています。別の端末に移すときや、念のための控えに、ファイルに書き出せます。'),
      h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'btn', onClick: () => {
          download(`subsou-backup-${todayYmd().replace(/-/g, '')}.json`, exportJson(store.get()), 'application/json');
        } }, 'バックアップを書き出す（JSON）'),
        jsonInput,
        h('label', { class: 'btn', for: 'json-input', role: 'button', tabindex: '0' }, 'バックアップを読み込む'),
        h('button', { type: 'button', class: 'btn', onClick: () => {
          const cs = store.get().contracts.filter((c) => c.nextDate || (c.trial?.on && c.trial.endDate));
          if (!cs.length) { toast('支払日が入っている部屋がありません'); return; }
          download('subsou-payments.ics', buildIcs(cs, { rate: store.get().settings.usdJpy }), 'text/calendar');
          toast(`${cs.length}部屋の支払日を書き出しました`);
        } }, '支払日をカレンダーに書き出す（.ics）')),
      h('p', { class: 'muted small' }, '.ics を開くとカレンダーに予定が入り、支払いの前日（内見おわりは2日前）に通知が出ます。サーバーを使わないので、アプリからは通知を送れません。')),

    h('section', { class: 'card' },
      h('h2', null, '友達に教える'),
      h('p', { class: 'muted small' }, '送るのはアプリの URL だけです。あなたの部屋や金額は送られません。'),
      h('button', { type: 'button', class: 'btn', onClick: shareApp }, 'URL を送る')),

    hasSample(st) ? h('section', { class: 'card' },
      h('h2', null, 'サンプル'),
      h('button', { type: 'button', class: 'btn', onClick: async () => {
        undoable(store, 'サンプルを消しました', clearSample);
      } }, 'サンプルデータを消す')) : null,

    h('section', { class: 'card danger-zone' },
      h('h2', null, 'すべて消す'),
      h('p', { class: 'muted small' }, '部屋・候補・退去の記録・設定をこの端末から消します。元に戻せないので、先にバックアップを書き出しておくと安心です。'),
      h('button', { type: 'button', class: 'btn danger-ghost', onClick: async () => {
        if (!(await ask('すべてのデータを消します。元に戻せません。', { ok: 'すべて消す', danger: true }))) return;
        const theme = store.get().settings.theme;
        const next = emptyState();
        next.settings.theme = theme;
        next.ui.welcomed = true;
        store.replace(next);
        toast('すべて消しました');
      } }, 'すべてのデータを消す')),

    h('p', { class: 'about' }, 'サブスク荘 0.5.0・データは外に送りません')
  ].filter(Boolean));
}
