// sw.js (v0 debug)
const CACHE = 'tlp-v0-20251012a';
const PRECACHE = [
  './',
  './index.html',
  // 必要ならここに CSS/JS を追加（例: './app.js', './style.css'）
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
// クロスオリジンはSWで触らない（GA等を壊さない）
  if (url.origin !== self.location.origin) return;
  
  // manifest / icon は常にネットワーク（＝キャッシュしない）
  if (/\bmanifest\.(webmanifest|json)$/.test(url.pathname) || url.pathname.includes('/icon/')) {
    e.respondWith(fetch(req));
    return;
  }

  // HTMLは network-first（オフライン時のみ index.html）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // それ以外は cache-first
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
