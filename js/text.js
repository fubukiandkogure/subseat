// 文字の揺れ（全角・半角、大文字・小文字）をそろえる
export const nfkc = (s) => String(s ?? '').normalize('NFKC');

// 記号と空白を取り除いて大文字にしたもの。明細の利用先どうしを比べるときに使う
export const compact = (s) => nfkc(s).toUpperCase().replace(/[^\p{L}\p{N}]+/gu, '');

export const formatYen = (n) => Math.round(n).toLocaleString('ja-JP');
