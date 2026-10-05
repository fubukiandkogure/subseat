import { h, openSheet, toast, field, select, numberInput, segmented, money, ask } from '../ui.js';
import { SUB_CATEGORIES, CHANNELS, STATUSES, newContract, monthlyYen, recordPrice } from '../model.js';
import { matchMerchant } from '../services.js';
import { todayYmd } from '../dates.js';

const CURRENCIES = [{ id: 'JPY', label: '円' }, { id: 'USD', label: 'ドル' }];
const CYCLES = [{ id: 'month', label: '毎月' }, { id: 'year', label: '毎年' }];

// 部屋（契約1件）の編集。新しく入居させるときにも使う
export function openContractSheet(store, existing) {
  const isNew = !existing;
  const d = structuredClone(existing || newContract());
  if (!d.trial) d.trial = { on: false, endDate: null };

  openSheet(isNew ? '手で入居させる' : `${d.name} を編集`, (close) => {
    const { usdJpy: rate } = store.get().settings;
    const note = h('span', { class: 'field-hint' });
    const refreshNote = () => {
      const m = monthlyYen(d, rate);
      note.textContent = d.amount == null
        ? '金額が未確定のあいだは、間取りにも合計にも入りません'
        : `月 ${d.currency === 'USD' || d.cycle === 'year' ? '約' : ''}${money(m)}円・年 ${money(m * 12)}円`;
    };
    refreshNote();

    const nameInput = h('input', { type: 'text', value: d.name, placeholder: '例：Netflix', autocomplete: 'off', onInput: (e) => { d.name = e.target.value; } });
    const trialDate = h('input', { type: 'date', value: d.trial.endDate || '', disabled: !d.trial.on, onInput: (e) => { d.trial.endDate = e.target.value || null; } });
    const urlInput = h('input', { type: 'url', value: d.cancelUrl || '', placeholder: 'https://…', inputmode: 'url', onInput: (e) => { d.cancelUrl = e.target.value.trim(); } });

    const save = () => {
      d.name = d.name.trim();
      if (!d.name) { nameInput.focus(); toast('サービス名を入れてください'); return; }
      if (d.trial.on && !d.trial.endDate) d.trial.on = false;
      if (!d.serviceId) d.serviceId = matchMerchant(d.name)?.id ?? null;
      recordPrice(d, todayYmd());
      store.update((s) => {
        const i = s.contracts.findIndex((c) => c.id === d.id);
        if (i >= 0) s.contracts[i] = d; else s.contracts.push(d);
      });
      close();
      toast(isNew ? `${d.name} が入居しました` : `${d.name} を保存しました`);
    };
    const remove = async () => {
      close();
      if (!(await ask(`${d.name} の部屋を消しますか？（解約した記録としては残りません。解約したときは部屋の画面の「解約した」を使ってください）`, { ok: '消す', danger: true }))) {
        openContractSheet(store, existing);
        return;
      }
      store.update((s) => { s.contracts = s.contracts.filter((c) => c.id !== d.id); });
      toast(`${d.name} の部屋を消しました`);
    };

    const validUrl = /^https?:\/\//.test(d.cancelUrl || '');
    return h('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); save(); } },
      d.sample ? h('p', { class: 'notice' }, 'これはサンプルの部屋です。') : null,
      field('サービス名', nameInput),
      field('カテゴリ', select(SUB_CATEGORIES, d.category, (v) => { d.category = v; })),
      h('div', { class: 'field-row' },
        field('金額', numberInput(d.amount, (v) => { d.amount = v; refreshNote(); }, { placeholder: '未確定' })),
        field('通貨', segmented(CURRENCIES, d.currency, (v) => { d.currency = v; refreshNote(); }, '通貨'))),
      note,
      field('支払いの周期', segmented(CYCLES, d.cycle, (v) => { d.cycle = v; refreshNote(); }, '周期')),
      field('次の支払日', h('input', { type: 'date', value: d.nextDate || '', onInput: (e) => { d.nextDate = e.target.value || null; } }), '空欄のままなら「未確定」として扱います'),
      field('入居（契約を始めた月・だいたいでOK）', h('input', { type: 'month', value: d.since || '', onInput: (e) => { d.since = e.target.value || null; } }), '入れると、これまでに払った額の目安が出ます'),
      field('契約経路', select(CHANNELS, d.channel, (v) => { d.channel = v; })),
      field('状態', segmented(STATUSES, d.status, (v) => { d.status = v; }, '状態')),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: !!d.trial.on, onChange: (e) => { d.trial.on = e.target.checked; trialDate.disabled = !e.target.checked; if (e.target.checked) trialDate.focus(); } }),
        h('span', null, '無料体験中（内見中）')),
      field('無料体験の終了日', trialDate),
      field('解約ページのURL（任意）', urlInput),
      validUrl ? h('a', { class: 'link', href: d.cancelUrl, target: '_blank', rel: 'noopener noreferrer' }, '解約ページを開く ↗') : null,
      h('div', { class: 'actions' },
        h('button', { type: 'submit', class: 'btn primary' }, isNew ? '入居させる' : '保存する'),
        isNew ? null : h('button', { type: 'button', class: 'btn danger-ghost', onClick: remove }, '部屋を消す'))
    );
  });
}
