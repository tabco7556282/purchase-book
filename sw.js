/* sw.js — shiire app v22.2 */
const VERSION = 'v22.2';
const PREFIX  = 'shiire-app';
const APP_SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const RUNTIME_CACHE   = `${PREFIX}-rt-${VERSION}`;

const APP_SHELL = [
  '/',                  // GitHub Pages ルート
  '/index.html',
  '/manifest.webmanifest',
  '/sw.js?ver=22.2',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k))
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const isNavigationRequest = (req) =>
  req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

const isStaticAsset = (url) =>
  ['/sw.js?ver=22.2','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png']
    .some(p => url.endsWith(p));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // 1) ナビゲーション: Network-First（失敗時 index.html with ignoreSearch）
  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const shell = await caches.open(APP_SHELL_CACHE);
        // クエリ差分を無視して index.html を返す
        return (await shell.match(new Request('/index.html', {ignoreSearch:true})))
            || (await shell.match(new Request('/', {ignoreSearch:true})))
            || Response.error();
      }
    })());
    return;
  }

  const url = request.url;

  // 2) 静的アセット: Cache-First
  if (sameOrigin(url) && isStaticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      const cached = await cache.match(request, {ignoreSearch:true});
      if (cached) return cached;
      const res = await fetch(request);
      cache.put(request, res.clone());
      return res;
    })());
    return;
  }

  // 3) その他: SWR 風
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request, {ignoreSearch:true});
    const fetchAndUpdate = fetch(request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await fetchAndUpdate) || new Response('', {status:504, statusText:'Offline'});
  })());
});
