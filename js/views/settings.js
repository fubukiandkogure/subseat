import { h, toast, download, segmented, field } from '../ui.js';
import { hasSample, clearSample, exportJson, parseBackup, emptyState } from '../store.js';
import { buildIcs } from '../ics.js';
import { todayYmd } from '../dates.js';

const UNITS = [
  { id: 'auto', label: '自動' }, { id: '500', label: '500円' }, { id: '1000', label: '1,000円' },
  { id: '2000', label: '2,000円' }, { id: '5000', label: '5,000円' }
];
const THEMES = [{ id: 'auto', label: '端末に合わせる' }, { id: 'light', label: 'ライト' }, { id: 'dark', label: 'ダーク' }];

// 入力し終わったとき（フォーカスが外れたとき）に保存する。打っている途中で画面を作り直さない
function moneyInput(store, key, placeholder) {
  return h('input', {
    type: 'number', inputmode: 'numeric', min: '0', step: '1', value: store.get().settings[key] ?? '', placeholder,
    onChange: (e) => {
      const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
      store.update((s) => { s.settings[key] = v; delete s.settings.sample; });
      toast('保存しました');
    }
  });
}

export function renderSettings(root, store) {
  const st = store.get();
  const s = st.settings;
  const jsonInput = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'json-input',
    onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const next = parseBackup(await f.text());
        if (!confirm(`契約 ${next.contracts.length}件のバックアップを読み込みます。今のデータは置き換わります。よろしいですか？`)) return;
        store.replace(next);
        toast('バックアップを読み込みました');
      } catch (err) {
        toast(err.message || '読み込めませんでした');
      } finally {
        e.target.value = '';
      }
    } });

  root.replaceChildren(...[
    h('section', { class: 'card' },
      h('h2', null, 'お金'),
      field('手取り（月額）', moneyInput(store, 'takeHome', '例：240000'), '入れると、席全体が手取りの大きさになり、空席が見えます'),
      h('div', { class: 'field-row' },
        field('家賃', moneyInput(store, 'rent', '0')),
        field('通信費', moneyInput(store, 'phone', '0'))),
      h('p', { class: 'muted small' }, '固定費はこの2つだけにしています（細かく入れ始めると家計簿になってしまうので）。'),
      field('ドル円レート', moneyInput(store, 'usdJpy', '150'), 'ドル建ての契約を円にするときに使います'),
      field('1席の金額', segmented(UNITS, String(s.seatUnit), (v) => store.update((x) => { x.settings.seatUnit = v === 'auto' ? 'auto' : Number(v); }), '1席の金額'))),

    h('section', { class: 'card' },
      h('h2', null, '表示'),
      field('テーマ', segmented(THEMES, s.theme, (v) => store.update((x) => { x.settings.theme = v; }), 'テーマ'))),

    h('section', { class: 'card' },
      h('h2', null, 'データ'),
      h('p', { class: 'muted small' }, 'データはこの端末のブラウザの中にだけ保存しています。別の端末に移すときや、念のための控えに、ファイルに書き出せます。'),
      h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'btn', onClick: () => {
          download(`subseat-backup-${todayYmd().replace(/-/g, '')}.json`, exportJson(store.get()), 'application/json');
        } }, 'バックアップを書き出す（JSON）'),
        jsonInput,
        h('label', { class: 'btn', for: 'json-input', role: 'button', tabindex: '0' }, 'バックアップを読み込む'),
        h('button', { type: 'button', class: 'btn', onClick: () => {
          const cs = store.get().contracts.filter((c) => c.nextDate || (c.trial?.on && c.trial.endDate));
          if (!cs.length) { toast('支払日が入っている契約がありません'); return; }
          download('subseat-payments.ics', buildIcs(cs, { rate: store.get().settings.usdJpy }), 'text/calendar');
          toast(`${cs.length}件の支払日を書き出しました`);
        } }, '支払日をカレンダーに書き出す（.ics）')),
      h('p', { class: 'muted small' }, '.ics を開くとカレンダーに予定が入り、支払いの前日に通知が出ます（サーバーを使わないので、アプリからは通知を送れません）。')),

    hasSample(st) ? h('section', { class: 'card' },
      h('h2', null, 'サンプル'),
      h('button', { type: 'button', class: 'btn', onClick: () => {
        if (!confirm('サンプルの契約・候補・設定を消しますか？')) return;
        store.update(clearSample);
        toast('サンプルを消しました');
      } }, 'サンプルデータを消す')) : null,

    h('section', { class: 'card danger-zone' },
      h('h2', null, 'すべて消す'),
      h('p', { class: 'muted small' }, '契約・候補・設定をこの端末から消します。元に戻せないので、先にバックアップを書き出しておくと安心です。'),
      h('button', { type: 'button', class: 'btn danger-ghost', onClick: () => {
        if (!confirm('すべてのデータを消します。よろしいですか？')) return;
        const theme = store.get().settings.theme;
        const next = emptyState();
        next.settings.theme = theme;
        store.replace(next);
        toast('すべて消しました');
      } }, 'すべてのデータを消す')),

    h('p', { class: 'about' }, 'サブスク席 0.1.0・データは外に送りません')
  ].filter(Boolean));
}
