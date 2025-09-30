// sw.js  —— v0.8.1
const CACHE = 'tlp-cache-v0.8.1';
const ASSETS = [
  '/',                      // ルートをオフラインで開ける
  '/index.html',
  '/manifest.webmanifest?v=0.8.1',
  '/icons/icon-192-v223i.png',
  '/icons/icon-512-v223i.png',
  '/icons/apple-touch-icon-180.png'
];

// 即時適用
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// cache-first（失敗時は index.html をフォールバック）
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});


