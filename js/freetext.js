import { nfkc } from './text.js';
import { SERVICES } from './services.js';

// 雑入力：「ChatGPTとClaudeとYouTube、あとAmazonも払ってると思う」をサービスごとの候補に分ける。
// 金額や周期が書いてあれば拾い、なければ未確定のまま候補にする。

const SEP = /[、,，。・/\n&＆+＋()（）「」]|それから|それと|あと|とか|および|と|\s+|\band\b/iu;
const STOP = /^(サブスク|プラン|有料|月額|年額|会員|全部|ぜんぶ|アプリ|サービス)$/u;
const AMOUNT = /^[\s:：は=]*(?:月額?|年額?)?\s*(?:[¥￥]\s*(\d[\d,]*)|(\d[\d,]*)\s*円|\$\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:ドル|USD))/iu;
const YEARLY = /年額|年払|\/\s*年|年間/u;

function readAmount(tail) {
  const m = tail.match(AMOUNT);
  if (!m) return { amount: null, currency: 'JPY' };
  if (m[3] || m[4]) return { amount: Number(m[3] || m[4]), currency: 'USD' };
  return { amount: Number((m[1] || m[2]).replace(/,/g, '')), currency: 'JPY' };
}

export function parseFreeText(text) {
  const src = nfkc(text);
  const taken = [];
  const found = [];
  const overlaps = (a, b) => taken.some(([s, e]) => a < e && b > s);

  for (const s of SERVICES) {
    if (s.generic) continue;
    for (const m of src.matchAll(new RegExp(s.re, 'giu'))) {
      const a = m.index, b = a + m[0].length;
      if (overlaps(a, b)) continue;
      taken.push([a, b]);
      if (found.some((f) => f.serviceId === s.id)) continue;
      const tail = src.slice(b, b + 24);
      found.push({
        at: a, source: 'text', serviceId: s.id, name: s.name, category: s.cat,
        ...readAmount(tail), cycle: YEARLY.test(tail.slice(0, 14)) ? 'year' : 'month',
        nextDate: null, confidence: s.textOnly ? 'low' : 'mid', notes: s.hint ? [s.hint] : []
      });
    }
  }

  // 辞書にない名前（英字かカタカナのまとまり）も、名前だけの候補にする
  let rest = '';
  for (let i = 0; i < src.length; i++) rest += taken.some(([s, e]) => i >= s && i < e) ? '、' : src[i];
  let cursor = 0;
  for (const raw of rest.split(SEP)) {
    if (raw == null) continue;
    const at = rest.indexOf(raw, cursor);
    if (at >= 0) cursor = at + raw.length;
    const t = raw.trim()
      .replace(/^(たぶん|多分|あとは|一応|いちおう|確か|たしか|ほかに|他に)+/u, '')
      .replace(/(も|は|が|を)?(やって|払って|入って|使って|加入|契約|登録|してる|ている|と思う|かも|気がする).*$/u, '')
      .replace(/(も|は|が|を|に|で|の|って|など)+$/u, '')
      .trim();
    if (t.length < 2 || STOP.test(t)) continue;
    if (!/[A-Za-z]{2,}|[ァ-ヶー]{3,}/u.test(t)) continue;
    if (found.some((f) => f.name.toUpperCase() === t.toUpperCase())) continue;
    found.push({
      at: at < 0 ? src.length : at, source: 'text', serviceId: null, name: t, category: 'other',
      amount: null, currency: 'JPY', cycle: 'month', nextDate: null, confidence: 'low',
      notes: ['辞書にない名前です。サービス名を確認してください']
    });
  }
  return found.sort((a, b) => a.at - b.at).map(({ at, ...rest }) => rest);
}
