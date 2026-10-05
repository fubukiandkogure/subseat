// オフラインでも開けるように、アプリ本体（同じサイトのファイル）をキャッシュする。
// 開くときはキャッシュをすぐ返しつつ、裏で新しい版を取りに行く（次に開いたときに反映）。
// ファイルを増やしたら ASSETS に足し、大きく変えたら VERSION を上げる。
const VERSION = 'subsou-v2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/model.js', 'js/dates.js', 'js/text.js', 'js/services.js',
  'js/csv.js', 'js/detect.js', 'js/freetext.js', 'js/ics.js', 'js/sample.js', 'js/migrate.js', 'js/plan.js',
  'js/views/home.js', 'js/views/import.js', 'js/views/contracts.js', 'js/views/settings.js', 'js/views/contract-sheet.js',
  'js/views/room-sheet.js', 'js/views/inspect.js', 'js/views/tutorial.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => undefined);
    if (cached) {
      e.waitUntil(network);
      return cached;
    }
    return (await network) || new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
