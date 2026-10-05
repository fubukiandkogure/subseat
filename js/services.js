import { compact } from './text.js';

// よくあるサブスクの辞書。
// re はカード明細の利用先（記号・空白を除いて大文字にしたもの）と、雑入力の文章の両方に当てる。
// 上から順に調べるので、具体的なもの（YouTube Music）をあいまいなもの（YouTube）より先に置く。
//   usd     : ドル建てで請求されることが多い（ヒントの表示だけに使う）
//   generic : App Store のように、中身が複数のサービスになりうる請求元
//   textOnly: 雑入力でだけ使う、あいまいな呼び方
// 金額は辞書に持たない（値上げで変わるので、推測で入れると数字が信用できなくなる）
const LIST = [
  { id: 'netflix', name: 'Netflix', cat: 'video', re: 'NETFLIX|ネットフリックス' },
  { id: 'unext', name: 'U-NEXT', cat: 'video', re: 'U\\s*-?\\s*NEXT|ユーネクスト' },
  { id: 'hulu', name: 'Hulu', cat: 'video', re: 'HULU|フールー' },
  { id: 'disneyplus', name: 'Disney+', cat: 'video', re: 'DISNEY|ディズニー\\s*(\\+|プラス)' },
  { id: 'dazn', name: 'DAZN', cat: 'video', re: 'DAZN|ダゾーン' },
  { id: 'abema', name: 'ABEMA', cat: 'video', re: 'ABEMA|アベマ' },
  { id: 'danime', name: 'dアニメストア', cat: 'video', re: 'D\\s*アニメ|DANIME' },
  { id: 'lemino', name: 'Lemino', cat: 'video', re: 'LEMINO|レミノ' },
  { id: 'ytmusic', name: 'YouTube Music', cat: 'music', re: 'YOUTUBE\\s*MUSIC|ユーチューブ\\s*ミュージック' },
  { id: 'ytpremium', name: 'YouTube Premium', cat: 'video', re: 'YOUTUBE|ユーチューブ' },
  { id: 'spotify', name: 'Spotify', cat: 'music', re: 'SPOTIFY|スポティファイ' },
  { id: 'applemusic', name: 'Apple Music', cat: 'music', re: 'APPLE\\s*MUSIC|アップル\\s*ミュージック' },
  { id: 'amazonmusic', name: 'Amazon Music Unlimited', cat: 'music', re: 'AMAZON\\s*MUSIC|アマゾン\\s*ミュージック' },
  { id: 'linemusic', name: 'LINE MUSIC', cat: 'music', re: 'LINE\\s*MUSIC|ライン\\s*ミュージック' },
  { id: 'chatgpt', name: 'ChatGPT', cat: 'ai', re: 'CHAT\\s*GPT|OPENAI|チャット\\s*GPT', usd: true },
  { id: 'claude', name: 'Claude', cat: 'ai', re: 'CLAUDE|ANTHROPIC|クロード', usd: true },
  { id: 'gemini', name: 'Gemini', cat: 'ai', re: 'GEMINI|ジェミニ|GOOGLE\\s*ONE\\s*AI' },
  { id: 'perplexity', name: 'Perplexity', cat: 'ai', re: 'PERPLEXITY|パープレキシティ', usd: true },
  { id: 'midjourney', name: 'Midjourney', cat: 'ai', re: 'MIDJOURNEY|ミッドジャーニー', usd: true },
  { id: 'copilot', name: 'GitHub Copilot', cat: 'ai', re: 'COPILOT|コパイロット', usd: true },
  { id: 'cursor', name: 'Cursor', cat: 'ai', re: 'CURSOR', usd: true },
  { id: 'icloud', name: 'iCloud+', cat: 'cloud', re: 'ICLOUD|アイクラウド' },
  { id: 'googleone', name: 'Google One', cat: 'cloud', re: 'GOOGLE\\s*ONE|グーグル\\s*ワン' },
  { id: 'dropbox', name: 'Dropbox', cat: 'cloud', re: 'DROPBOX|ドロップボックス' },
  { id: 'm365', name: 'Microsoft 365', cat: 'cloud', re: 'MICROSOFT|MSFT|OFFICE\\s*365|マイクロソフト' },
  { id: 'adobe', name: 'Adobe', cat: 'cloud', re: 'ADOBE|アドビ' },
  { id: 'notion', name: 'Notion', cat: 'cloud', re: 'NOTION|ノーション' },
  { id: 'canva', name: 'Canva', cat: 'cloud', re: 'CANVA' },
  { id: 'onepassword', name: '1Password', cat: 'cloud', re: '1\\s*PASSWORD' },
  { id: 'github', name: 'GitHub', cat: 'cloud', re: 'GITHUB|ギットハブ', usd: true },
  { id: 'nso', name: 'Nintendo Switch Online', cat: 'game', re: 'NINTENDO|ニンテンドー|任天堂|SWITCH\\s*ONLINE' },
  { id: 'psplus', name: 'PlayStation Plus', cat: 'game', re: 'PLAYSTATION|プレイステーション|プレステ' },
  { id: 'gamepass', name: 'Xbox Game Pass', cat: 'game', re: 'GAME\\s*PASS|XBOX|ゲームパス' },
  { id: 'kindleu', name: 'Kindle Unlimited', cat: 'other', re: 'KINDLE|キンドル' },
  { id: 'audible', name: 'Audible', cat: 'other', re: 'AUDIBLE|オーディブル' },
  { id: 'amazonprime', name: 'Amazonプライム', cat: 'other', re: 'AMAZON\\s*PRIME|AMZN\\s*PRIME|PRIME\\s*VIDEO|アマゾン\\s*プライム|プライム\\s*(会費|ビデオ)' },
  { id: 'dmagazine', name: 'dマガジン', cat: 'other', re: 'D\\s*マガジン|DMAGAZINE' },
  { id: 'rakutenmag', name: '楽天マガジン', cat: 'other', re: '楽天\\s*マガジン' },
  { id: 'nikkei', name: '日経電子版', cat: 'other', re: '日経電子版|NIKKEI' },
  { id: 'lyp', name: 'LYPプレミアム', cat: 'other', re: 'LYP|YAHOO\\s*プレミアム|ヤフー\\s*プレミアム' },
  { id: 'appstore', name: 'App Store の課金', cat: 'other', re: 'APPLE\\s*\\.?\\s*COM\\s*/?\\s*BILL|ITUNES', generic: true, channel: 'appstore' },
  { id: 'googleplay', name: 'Google Play の課金', cat: 'other', re: 'GOOGLE\\s*\\*?\\s*PLAY', generic: true, channel: 'googleplay' },
  { id: 'amazonprime', name: 'Amazonプライム', cat: 'other', re: 'AMAZON|アマゾン', textOnly: true, hint: 'Amazon の買い物ではなく、プライム会員の料金として仮登録しています' }
];

export const SERVICES = LIST.map((s) => ({ ...s, rx: new RegExp(s.re, 'iu') }));

export const serviceById = (id) => SERVICES.find((s) => s.id === id && !s.textOnly) || null;

// 明細の利用先（またはサービス名）から辞書のサービスを探す
export function matchMerchant(merchant) {
  const k = compact(merchant);
  if (!k) return null;
  return SERVICES.find((s) => !s.textOnly && s.rx.test(k)) || null;
}
