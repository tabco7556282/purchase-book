/* sw.js — v22.2 (subpath-safe) */
const VERSION = 'v22.2';
const PREFIX  = 'shiire-app';
const APP_SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const RUNTIME_CACHE   = `${PREFIX}-rt-${VERSION}`;

// 今のsw.jsの場所から“基準パス”を作る（サブパス対応）
const BASE = new URL('./', self.location).pathname;   // 例: "/repo/" または "/"
const path = (p) => BASE + p;                         // 相対で組み立て

const APP_SHELL = [
  path(''),                     // "/repo/" or "/"
  path('index.html'),
  path('manifest.webmanifest'),
  path('sw.js?ver=22.2'),
  path('icons/icon-192.png'),
  path('icons/icon-512.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((c) => c.addAll(APP_SHELL))
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

const isNav = (req) =>
  req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // ナビゲーション: Network-First（失敗時 index.html を相対で返す）
  if (isNav(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const shell = await caches.open(APP_SHELL_CACHE);
        return (await shell.match(new Request(path('index.html'), {ignoreSearch:true})))
            || (await shell.match(new Request(path(''), {ignoreSearch:true})))
            || Response.error();
      }
    })());
    return;
  }

  // 静的アセット: Cache-First（検索クエリ無視）
  if (request.url.startsWith(self.location.origin)) {
    const url = new URL(request.url);
    const isShell = APP_SHELL.some(p => url.pathname + (url.search||'').endsWith(p.replace(BASE,'')));
    if (isShell) {
      event.respondWith((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        const hit = await cache.match(request, {ignoreSearch:true});
        if (hit) return hit;
        const res = await fetch(request);
        cache.put(request, res.clone());
        return res;
      })());
      return;
    }
  }

  // その他: Stale-While-Revalidate
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request, {ignoreSearch:true});
    const fetchAndUpdate = fetch(request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await fetchAndUpdate) || new Response('', {status:504});
  })());
});
