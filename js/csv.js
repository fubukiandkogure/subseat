import { nfkc } from './text.js';

// ---------- 文字コード ----------
// BOM → UTF-8（厳密）→ だめなら Shift_JIS、の順に試す。
// 日本語を含む Shift_JIS は、UTF-8 として読むとほぼ確実にエラーになるので見分けられる。
export function decodeBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('shift_jis').decode(bytes), encoding: 'Shift_JIS' };
  }
}

// ---------- CSV ----------
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const head = text.slice(0, 4000);
  const delim = (head.match(/\t/g) || []).length > (head.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') { quoted = true; continue; }
    if (ch === delim) { row.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

// ---------- セルの読み取り ----------
function mkDate(y, m, d) {
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 2026/09/05, 2026-9-5, 2026年9月5日, 26/09/05, 20260905 など
export function parseDate(s) {
  const t = nfkc(s).trim();
  let m = t.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?(?:\s|$|\(|（)/u) || t.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/u);
  if (m) return mkDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) return mkDate(2000 + +m[1], +m[2], +m[3]);
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return mkDate(+m[1], +m[2], +m[3]);
  return null;
}

// 1,980 / ￥1,980 / 1980円 / -1980 / △1980（マイナス）/ 12.34
export function parseAmount(s) {
  let t = nfkc(s).trim().replace(/[¥\\,\s円]/gu, '');
  if (!t) return null;
  let neg = false;
  if (/^[-−△▲]/u.test(t)) { neg = true; t = t.slice(1); }
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return neg ? -v : v;
}

const isTexty = (s) => !!s && /\p{L}/u.test(s) && parseDate(s) == null && parseAmount(s) == null;

// ---------- 列の推定 ----------
// カード会社ごとに列の並びが違うので、見出しの名前ではなく中身から決める。
//   日付  : 日付として読めるセルが一番多い列
//   金額  : 数字の列のうち「0でない・それなりの額」が多い列（支払回数や手数料の列を避ける）
//   利用先: 文字の列のうち、値の種類が多くて長い列（「本人」「1回払い」のような列を避ける）
export function inferColumns(rows) {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  const dateCount = Array(width).fill(0);
  for (const r of rows) r.forEach((c, i) => { if (parseDate(c)) dateCount[i]++; });
  let date = -1, best = 0;
  dateCount.forEach((n, i) => { if (n > best) { best = n; date = i; } });
  if (date < 0) return null;
  const data = rows.filter((r) => parseDate(r[date] ?? ''));
  if (!data.length) return null;

  const stats = [];
  for (let i = 0; i < width; i++) {
    if (i === date) continue;
    const vals = data.map((r) => r[i] ?? '');
    const nums = vals.map(parseAmount).filter((v) => v != null);
    const texts = vals.filter(isTexty);
    stats.push({
      i, nums, numRate: nums.length / data.length,
      textRate: texts.length / data.length,
      uniq: new Set(texts).size,
      avgLen: texts.reduce((a, t) => a + t.length, 0) / Math.max(1, texts.length)
    });
  }

  let amount = -1, aScore = 0;
  for (const s of stats) {
    if (s.numRate < 0.6) continue;
    const abs = s.nums.map(Math.abs).sort((a, b) => a - b);
    const med = abs[Math.floor(abs.length / 2)] ?? 0;
    if (med < 50 && (abs[abs.length - 1] ?? 0) < 1000) continue;
    const nonzero = abs.filter((v) => v > 0).length / data.length;
    const score = nonzero * Math.log10(med + 10) * s.numRate;
    if (score > aScore + 1e-9) { aScore = score; amount = s.i; }
  }

  let merchant = -1, mScore = 0;
  for (const s of stats) {
    if (s.i === amount || s.textRate < 0.5) continue;
    const score = (s.uniq / data.length) * Math.min(s.avgLen, 30) * s.textRate;
    if (score > mScore) { mScore = score; merchant = s.i; }
  }
  if (amount < 0 || merchant < 0) return null;

  // 見出しは「日付と金額がそろった最初の行」のすぐ上（会員情報の行に日付が入っていても惑わされない）
  const first = rows.findIndex((r) => parseDate(r[date] ?? '') && parseAmount(r[amount] ?? '') != null);
  let header = null;
  for (let k = first - 1; k >= 0; k--) {
    if (rows[k].filter(Boolean).length >= 2) { header = rows[k]; break; }
  }
  const label = (i) => (header && header[i]) || `${i + 1}列目`;
  return { date, amount, merchant, labels: { date: label(date), amount: label(amount), merchant: label(merchant) }, dataRows: data.length };
}

// ---------- まとめ ----------
// バイト列 → 明細（{date, amount, merchant}）。返金などのマイナスもそのまま返す
export function readStatement(bytes) {
  const { text, encoding } = decodeBytes(bytes);
  return readStatementText(text, encoding);
}

export function readStatementText(text, encoding = 'UTF-8') {
  const rows = parseCsv(text);
  const cols = inferColumns(rows);
  if (!cols) return { ok: false, encoding, transactions: [], error: '日付・金額・利用先の列を見つけられませんでした' };
  const transactions = [];
  for (const r of rows) {
    const date = parseDate(r[cols.date] ?? '');
    const amount = parseAmount(r[cols.amount] ?? '');
    const merchant = r[cols.merchant] ?? '';
    if (date && amount != null && merchant) transactions.push({ date, amount, merchant });
  }
  const dates = transactions.map((t) => t.date).sort();
  return { ok: true, encoding, columns: cols, transactions, period: dates.length ? [dates[0], dates[dates.length - 1]] : null };
}
