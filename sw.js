// sw.js  v25.1
const CACHE_NAME = 'shiire-v25.1'; // ←ここを上げる
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192-v223i.png',
  './icons/icon-512-v223i.png'
];

// install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate（旧キャッシュの破棄）
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// fetch
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // HTMLはネット優先（落ちたらキャッシュ）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('/', copy));
        return res;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // それ以外はキャッシュ優先
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});

// 手動更新用
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
