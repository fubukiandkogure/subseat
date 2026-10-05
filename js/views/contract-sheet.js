import { h, openSheet, toast, field, select, numberInput, segmented, money } from '../ui.js';
import { SUB_CATEGORIES, CHANNELS, STATUSES, newContract, monthlyYen } from '../model.js';
import { matchMerchant } from '../services.js';

const CURRENCIES = [{ id: 'JPY', label: '円' }, { id: 'USD', label: 'ドル' }];
const CYCLES = [{ id: 'month', label: '毎月' }, { id: 'year', label: '毎年' }];

// 契約1件の詳細と編集。新規追加にも使う
export function openContractSheet(store, existing) {
  const isNew = !existing;
  const d = structuredClone(existing || newContract());
  if (!d.trial) d.trial = { on: false, endDate: null };

  openSheet(isNew ? '契約を追加' : d.name, (close) => {
    const rate = store.get().settings.usdJpy;
    const note = h('span', { class: 'field-hint' });
    const refreshNote = () => {
      const m = monthlyYen(d, rate);
      note.textContent = d.amount == null
        ? '金額が未確定のあいだは、席と合計に入りません'
        : d.currency === 'USD' || d.cycle === 'year' ? `月あたり 約${money(m)}円 として席に入ります` : '';
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
      store.update((s) => {
        const i = s.contracts.findIndex((c) => c.id === d.id);
        if (i >= 0) s.contracts[i] = d; else s.contracts.push(d);
      });
      close();
      toast(isNew ? `${d.name} を追加しました` : `${d.name} を保存しました`);
    };
    const remove = () => {
      if (!confirm(`${d.name} を削除しますか？`)) return;
      store.update((s) => { s.contracts = s.contracts.filter((c) => c.id !== d.id); });
      close();
      toast(`${d.name} を削除しました`);
    };

    const validUrl = /^https?:\/\//.test(d.cancelUrl || '');
    return h('form', { class: 'form', onSubmit: (e) => { e.preventDefault(); save(); } },
      d.sample ? h('p', { class: 'notice' }, 'これはサンプルの契約です。') : null,
      field('サービス名', nameInput),
      field('カテゴリ', select(SUB_CATEGORIES, d.category, (v) => { d.category = v; })),
      h('div', { class: 'field-row' },
        field('金額', numberInput(d.amount, (v) => { d.amount = v; refreshNote(); }, { placeholder: '未確定' })),
        field('通貨', segmented(CURRENCIES, d.currency, (v) => { d.currency = v; refreshNote(); }, '通貨'))),
      note,
      field('支払いの周期', segmented(CYCLES, d.cycle, (v) => { d.cycle = v; refreshNote(); }, '周期')),
      field('次回の支払日', h('input', { type: 'date', value: d.nextDate || '', onInput: (e) => { d.nextDate = e.target.value || null; } }), '空欄のままなら「未確定」として扱います'),
      field('契約経路', select(CHANNELS, d.channel, (v) => { d.channel = v; })),
      field('状態', segmented(STATUSES, d.status, (v) => { d.status = v; }, '状態')),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: !!d.trial.on, onChange: (e) => { d.trial.on = e.target.checked; trialDate.disabled = !e.target.checked; if (e.target.checked) trialDate.focus(); } }),
        h('span', null, '無料体験中')),
      field('無料体験の終了日', trialDate),
      field('解約ページのURL（任意）', urlInput),
      validUrl ? h('a', { class: 'link', href: d.cancelUrl, target: '_blank', rel: 'noopener noreferrer' }, '解約ページを開く ↗') : null,
      h('div', { class: 'actions' },
        h('button', { type: 'submit', class: 'btn primary' }, isNew ? '追加する' : '保存する'),
        isNew ? null : h('button', { type: 'button', class: 'btn danger-ghost', onClick: remove }, '削除'))
    );
  });
}
