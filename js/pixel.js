// サブスク荘のロゴ（ドット絵）。建物も文字も、ここで1ドットずつ描いている（フォントは使わない）。
// ヘッダーの看板・屋根の看板・アプリのアイコン・画像で保存のすみ、で同じものを使う。

// 建物（24×22）。窓に ▶ ✦ ♪ ☁（動画・AI・音楽・クラウド）
export const BUILDING = [
  '........................',
  '..........KKKK..........',
  '........KKKKKKKK........',
  '......KKKKKKKKKKKK......',
  '....KKKKKKKKKKKKKKKK....',
  '..KKKKKKKKKKKKKKKKKKKK..',
  '...CCCCCCCCCCCCCCCCCC...',
  '...CrRrrrCCCCCCppPppC...',
  '...CrRRrrCCCCCCppPppC...',
  '...CrRRRrCCCCCCPPPPPC...',
  '...CrRRrrCCCCCCppPppC...',
  '...CrRrrrCCCCCCppPppC...',
  '...LLLLLLLLLLLLLLLLLL...',
  '...CCCCCCCCCCCCCCCCCC...',
  '...CgggGgCCCCCCbbbbbC...',
  '...CgggGGCCDDCCbbBBbC...',
  '...CgggGgCCDDCCbBBBBC...',
  '...CgGGGgCCDDCCBBBBBC...',
  '...CgGGggCCDDCCbbbbbC...',
  '...CCCCCCCCDDCCCCCCCC...',
  '.LLLLLLLLLLLLLLLLLLLLLL.',
  '........................'
];

// 文字（12×12、線は1ドット）
export const GLYPHS = {
  サ: [
    '..#....#....',
    '..#....#....',
    '############',
    '..#....#....',
    '..#....#....',
    '..#....#....',
    '.......#....',
    '.......#....',
    '......#.....',
    '.....#......',
    '...##.......',
    '.##.........'
  ],
  ブ: [
    '........#..#',
    '........#..#',
    '#######.....',
    '......#.....',
    '......#.....',
    '......#.....',
    '.....#......',
    '.....#......',
    '....#.......',
    '...#........',
    '.##.........',
    '#...........'
  ],
  ス: [
    '............',
    '............',
    '.#########..',
    '.........#..',
    '........#...',
    '.......#....',
    '......##....',
    '.....#..#...',
    '....#....#..',
    '...#......#.',
    '.##........#',
    '#...........'
  ],
  ク: [
    '...#........',
    '..#.........',
    '.##########.',
    '.#........#.',
    '#.........#.',
    '..........#.',
    '.........#..',
    '........#...',
    '.......#....',
    '......#.....',
    '....##......',
    '.###........'
  ],
  荘: [
    '...#....#...',
    '############',
    '...#....#...',
    '............',
    '...#....#...',
    '#..#.#######',
    '.#.#....#...',
    '...#....#...',
    '..##....#...',
    '.#.#....#...',
    '#..#.######.',
    '...#........'
  ]
};
export const TEXT = 'サブスク荘';
const GW = 12, GAP = 1;
// ドットの太字：縦の線を2ドットにする（昔のゲームの太字と同じやり方）
const bold = (g) => g.map((row) => [...row, '.'].map((c, x, a) => (c === '#' || a[x - 1] === '#' ? '#' : '.')).join(''));
const BW = GW + 1; // 太字にした1文字の幅
export const TEXT_W = TEXT.length * BW + (TEXT.length - 1) * GAP + 1; // 影の1ドット分
export const TEXT_H = GW + 1;

export const PALETTE = {
  day: {
    K: '#3b302a', L: '#3b302a', C: '#f6e7cc', D: '#b98b5c',
    R: '#d4553f', P: '#6f5fc4', G: '#3c9a68', B: '#3a78b9', r: '#f7c9bd', p: '#ddd6f5', g: '#cfe8da', b: '#d3e2f2',
    ink: '#2b2420', shadow: '#f0b44a'
  },
  night: {
    K: '#15131b', L: '#5d566a', C: '#36323f', D: '#4b3d33',
    R: '#ffd27a', P: '#ffe39f', G: '#ffd27a', B: '#ffe39f', r: '#ff9f6e', p: '#b9a8ff', g: '#7fe0a8', b: '#8cc2ff',
    ink: '#ffd27a', shadow: '#d4462c'
  }
};

// 地図 → 横に続く同じ色をまとめた rect（要素の数を減らす）
export function rects(map, pal, ox = 0, oy = 0) {
  let out = '';
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n++;
      const fill = typeof pal === 'string' ? (ch === '#' ? pal : null) : pal[ch];
      if (fill && ch !== '.') out += `<rect x="${ox + x}" y="${oy + y}" width="${n}" height="1" fill="${fill}"/>`;
      x += n;
    }
  });
  return out;
}

// 文字（影つき）の rect
export function textRects(night = false, ox = 0, oy = 0) {
  const P = night ? PALETTE.night : PALETTE.day;
  let shadow = '', ink = '';
  [...TEXT].forEach((ch, i) => {
    const gx = ox + i * (BW + GAP);
    const g = bold(GLYPHS[ch]);
    shadow += rects(g, P.shadow, gx + 1, oy + 1);
    ink += rects(g, P.ink, gx, oy);
  });
  return `<g class="px-shadow">${shadow}</g><g class="px-ink">${ink}</g>`;
}

// ロゴ全体（建物＋文字）。scale は1ドットの大きさ（整数にするとくっきり）
export function logoSvg({ night = false, scale = 2, label = 'サブスク荘' } = {}) {
  const P = night ? PALETTE.night : PALETTE.day;
  const bw = BUILDING[0].length, bh = BUILDING.length;
  const gap = 4;
  const w = bw + gap + TEXT_W, h = bh;
  const ty = Math.round((bh - TEXT_H) / 2) + 1;
  return `<svg class="px-logo" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" role="img" aria-label="${label}">` +
    `<g class="px-building">${rects(BUILDING, P)}</g>${textRects(night, bw + gap, ty)}</svg>`;
}

// 文字だけ（屋根の看板・画像のすみ用）
export function wordSvg({ night = false, x = 0, y = 0, width, height } = {}) {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${TEXT_W} ${TEXT_H}" shape-rendering="crispEdges">${textRects(night)}</svg>`;
}

// 形のチェック（描き間違いで行の長さがずれていないか）
for (const [k, g] of Object.entries(GLYPHS)) if (g.length !== GW || g.some((r) => r.length !== GW)) throw new Error(`ドット文字 ${k} の大きさがずれています`);
if (BUILDING.some((r) => r.length !== BUILDING[0].length)) throw new Error('建物のドットの大きさがずれています');
