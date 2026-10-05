import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchMerchant, SERVICE_COUNT } from '../js/services.js';
import { parseFreeText } from '../js/freetext.js';

const id = (m) => matchMerchant(m)?.id ?? null;

test('辞書：カード明細の書き方で当たる（半角カナ・会社名・決済代行の書き方も）', () => {
  const cases = {
    'ﾆｺﾆｺﾌﾟﾚﾐｱﾑ': 'niconico', 'DWANGO CO.,LTD.': 'niconico', 'ドワンゴ': 'niconico',
    'DMM.COM': 'dmm', 'DMM英会話': 'dmmeikaiwa', 'DMM TV': 'dmmtv',
    'MICROSOFT*XBOX GAME PASS': 'gamepass', 'MICROSOFT*365 PERSONAL': 'm365', 'MICROSOFT*COPILOT PRO': 'mscopilot',
    'GOOGLE *Google Play Pass': 'playpass', 'GOOGLE *YouTubePremium': 'ytpremium', 'GOOGLE *Google One': 'googleone', 'GOOGLE *PLAY': 'googleplay',
    'AMAZON WEB SERVICES': 'aws', 'AMAZON PRIME': 'amazonprime', 'AMAZON MUSIC': 'amazonmusic',
    'ｴﾆﾀｲﾑﾌｨｯﾄﾈｽ ｼﾌﾞﾔ': 'anytime', 'ﾁｮｺｻﾞｯﾌﾟ': 'chocozap',
    'NHK': 'nhk', '日本放送協会': 'nhk', 'NHKオンデマンド': 'nhkod',
    'FOD': 'fod', 'FOD PREMIUM': 'fod', 'X CORP. PAID FEATURES': 'xpremium',
    'TELASA': 'telasa', 'WOWOW': 'wowow', 'ABEMA': 'abema', 'PIXIV FANBOX': 'pixivfanbox', 'FANTIA': 'fantia',
    'OPENAI *CHATGPT SUBSCR': 'chatgpt', 'CURSOR, AI POWERED IDE': 'cursor', 'GITHUB COPILOT': 'ghcopilot',
    'DISCORD* NITRO': 'discord', 'ROBLOX': 'roblox', 'COGNOSPHERE': 'hoyoverse',
    'ｽﾀﾃﾞｨｻﾌﾟﾘ': 'studysapuri', 'DUOLINGO': 'duolingo', 'UBER ONE': 'uberone', 'COSTCO WHOLESALE': 'costco',
    '少年ジャンプ+': 'jumpplus', 'ﾋﾟｯｺﾏ': 'piccoma', 'ｺﾐｯｸｼｰﾓｱ': 'cmoa', 'ﾏﾈｰﾌｫﾜｰﾄﾞ': 'moneyforward',
    'APPLE.COM/BILL': 'appstore', 'NORTONLIFELOCK': 'norton', 'ADOBE *CREATIVE CLOUD': 'adobe', 'CANVA': 'canva'
  };
  for (const [merchant, want] of Object.entries(cases)) assert.equal(id(merchant), want, merchant);
});

test('辞書：ほかの言葉の一部には当てない', () => {
  for (const m of ['REPAIRS SHOP', 'SCHOOL UNIFORM', 'FEDEX CORP', 'トヨタ シエンタ', 'ASAHI BEER', 'セブン-イレブン', 'スターバックス',
    'KAWASAKI', 'JCOMPANY', 'FREE ENTRY', 'SCIENCE MUSEUM', 'まちのパン屋', 'ドトールコーヒー', 'ENEOS', 'ユニクロ', 'スクール水着']) {
    assert.equal(id(m), null, m);
  }
});

test('辞書：雑入力でも、よくある呼び方で当たる', () => {
  const c = parseFreeText('ニコニコとDMMとFOD、あとネトフリとスポティとchocoZAPやってる');
  assert.deepEqual(c.map((x) => x.name), ['niconicoプレミアム', 'DMMプレミアム（DMM TV）', 'FODプレミアム', 'Netflix', 'Spotify', 'chocoZAP']);
  assert.ok(SERVICE_COUNT >= 250, `辞書のサービス数 ${SERVICE_COUNT}`);
});
