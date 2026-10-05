// テスト用の Shift_JIS エンコーダ。
// 標準の TextDecoder('shift_jis') で全コードを読み、「文字 → バイト」の逆引き表を作る（追加のライブラリ不要）。
let table = null;

function build() {
  table = new Map();
  const dec = new TextDecoder('shift_jis');
  for (let b = 0x00; b < 0x80; b++) table.set(String.fromCharCode(b), [b]);
  for (let b = 0xa1; b <= 0xdf; b++) table.set(dec.decode(Uint8Array.of(b)), [b]);
  const leads = [];
  for (let b = 0x81; b <= 0x9f; b++) leads.push(b);
  for (let b = 0xe0; b <= 0xfc; b++) leads.push(b);
  for (const lead of leads) {
    for (let t = 0x40; t <= 0xfc; t++) {
      if (t === 0x7f) continue;
      const ch = dec.decode(Uint8Array.of(lead, t));
      if (ch.length === 1 && ch !== '�' && !table.has(ch)) table.set(ch, [lead, t]);
    }
  }
}

export function encodeSjis(str) {
  if (!table) build();
  const out = [];
  for (const ch of str) {
    const b = table.get(ch);
    if (!b) throw new Error(`Shift_JIS にない文字: ${ch}`);
    out.push(...b);
  }
  return Uint8Array.from(out);
}
