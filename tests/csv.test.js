import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStatement, readStatementText, parseDate, parseAmount, decodeBytes, parseCsv } from '../js/csv.js';
import { encodeSjis } from './helpers/sjis.js';

const sortTx = (txs) => [...txs].sort((a, b) => (a.date + a.merchant).localeCompare(b.date + b.merchant));

// 楽天カード風：日付・店名・利用者・支払方法・金額・手数料・支払総額
const layoutA = [
  '利用日,利用店名・商品名,利用者,支払方法,利用金額,支払手数料,支払総額',
  '2026/07/03,NETFLIX.COM,本人,1回払い,"1,590",0,"1,590"',
  '2026/07/09,スポティファイジャパン,本人,1回払い,980,0,980',
  '2026/07/15,セブン－イレブン　渋谷店,家族,1回払い,432,0,432',
  '2026/08/03,NETFLIX.COM,本人,1回払い,"1,590",0,"1,590"',
  '2026/08/09,スポティファイジャパン,本人,1回払い,980,0,980'
].join('\r\n');

// 別の会社風：先頭に会員情報の行、列の順番が違う（店名が先、日付が2列目）、金額に￥、最後に合計行
const layoutB = [
  'カード名称,ゴールドカード',
  'お支払日,2026/09/26',
  '',
  'ご利用店名,ご利用日,支払区分,ご利用金額,今回お支払金額,備考',
  'スポティファイジャパン,2026/07/09,１回,￥980,￥980,',
  'NETFLIX.COM,2026/07/03,１回,"￥1,590","￥1,590",',
  'セブン－イレブン　渋谷店,2026/07/15,１回,￥432,￥432,',
  'NETFLIX.COM,2026/08/03,１回,"￥1,590","￥1,590",',
  'スポティファイジャパン,2026/08/09,１回,￥980,￥980,',
  '合計,,,"￥5,572","￥5,572",'
].join('\r\n');

test('Shift_JIS の明細を自動判定して読める', () => {
  const r = readStatement(encodeSjis(layoutA));
  assert.equal(r.ok, true);
  assert.equal(r.encoding, 'Shift_JIS');
  assert.equal(r.transactions.length, 5);
  assert.deepEqual(r.transactions[1], { date: '2026-07-09', amount: 980, merchant: 'スポティファイジャパン' });
  assert.deepEqual(r.period, ['2026-07-03', '2026-08-09']);
});

test('UTF-8（BOM あり・なし）も読める', () => {
  const enc = new TextEncoder().encode(layoutA);
  assert.equal(readStatement(enc).encoding, 'UTF-8');
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...enc]);
  const r = readStatement(bom);
  assert.equal(r.encoding, 'UTF-8');
  assert.equal(r.transactions.length, 5);
});

test('列の順番が違っても、中身から日付・金額・利用先の列を当てる', () => {
  const a = readStatementText(layoutA);
  const b = readStatement(encodeSjis(layoutB));
  assert.equal(a.columns.date, 0);
  assert.equal(a.columns.merchant, 1);
  assert.equal(a.columns.amount, 4, '支払手数料（0ばかり）ではなく利用金額の列');
  assert.equal(b.columns.date, 1);
  assert.equal(b.columns.merchant, 0);
  assert.equal(b.columns.amount, 3);
  assert.equal(b.columns.labels.amount, 'ご利用金額');
  assert.deepEqual(sortTx(a.transactions), sortTx(b.transactions), '同じ明細になる（会員情報の行と合計行は入らない）');
});

test('タブ区切りや日付の書き方の違い', () => {
  const tsv = ['日付\t内容\t金額', '2026年7月3日\tNETFLIX.COM\t1590', '2026年8月3日\tNETFLIX.COM\t1590'].join('\n');
  const r = readStatementText(tsv);
  assert.equal(r.transactions.length, 2);
  assert.equal(r.transactions[0].date, '2026-07-03');
});

test('日付の読み取り', () => {
  assert.equal(parseDate('2026/09/05'), '2026-09-05');
  assert.equal(parseDate('2026-9-5'), '2026-09-05');
  assert.equal(parseDate('２０２６／０９／０５'), '2026-09-05');
  assert.equal(parseDate('26/09/05'), '2026-09-05');
  assert.equal(parseDate('20260905'), '2026-09-05');
  assert.equal(parseDate('2026/09/05 12:30'), '2026-09-05');
  assert.equal(parseDate('2026/13/05'), null);
  assert.equal(parseDate('1回払い'), null);
});

test('金額の読み取り', () => {
  assert.equal(parseAmount('1,980'), 1980);
  assert.equal(parseAmount('￥1,980'), 1980);
  assert.equal(parseAmount('1980円'), 1980);
  assert.equal(parseAmount('-500'), -500);
  assert.equal(parseAmount('△500'), -500);
  assert.equal(parseAmount('12.34'), 12.34);
  assert.equal(parseAmount('本人'), null);
  assert.equal(parseAmount(''), null);
});

test('CSV の引用符の中のカンマと改行', () => {
  const rows = parseCsv('a,"b,c","d\n""e"""\r\n1,2,3');
  assert.deepEqual(rows, [['a', 'b,c', 'd\n"e"'], ['1', '2', '3']]);
});

test('Shift_JIS の円記号（0x5C。読むと \\ になる）が付いた金額も読める', () => {
  const bytes = encodeSjis('利用日,店,金額\r\n2026/07/03,ＡＢＣ,"\\1,590"\r\n2026/08/03,ＡＢＣ,"\\1,590"\r\n');
  assert.equal(decodeBytes(bytes).encoding, 'Shift_JIS');
  const t = readStatement(bytes).transactions;
  assert.equal(t.length, 2);
  assert.equal(t[0].amount, 1590);
});
