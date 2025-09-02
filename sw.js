/* sw.js — shiire app v22 */
/* ライフサイクル方針
   - 事前キャッシュ（App Shell）: 起動即オフライン化
   - ナビゲーション: Network-First（オフ時は index.html フォールバック）
   - 静的アセット: Cache-First（更新は新SW配信時に）
   - API/その他: Stale-While-Revalidate 風（まずキャッシュ、裏で更新）
*/

const VERSION = 'v22.0';
const PREFIX  = 'shiire-app';
const APP_SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const RUNTIME_CACHE   = `${PREFIX}-rt-${VERSION}`;

// 必要に応じてパスを調整（ルート相対推奨）
const APP_SHELL = [
  '/',                 // ルートに置く場合
  '/index.html',       // ファイル名でアクセスされる場合にも
  '/manifest.webmanifest',
  '/sw.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// === install: App Shell を事前キャッシュ ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// === activate: 古いキャッシュを掃除 & 乗り換え ===
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// === メッセージ: アプリ側からの SKIP_WAITING に対応 ===
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ユーティリティ
const isNavigationRequest = (req) =>
  req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

const isStaticAsset = (url) => {
  // sw/manifest/icons など“バージョン付きで更新されるもの”は Cache-First
  return [
    '/sw.js',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
  ].some(p => url.endsWith(p));
};

// === fetch: ルーティング＆戦略 ===
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // POST/PUT などは素通し（このアプリは基本GETのみ）
  if (request.method !== 'GET') return;

  // ナビゲーション: Network-First（失敗時 index.html）
  if (isNavigationRequest(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        // ナビゲーションはキャッシュ更新（任意）
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        // オフライン時は App Shell を返す
        const cache = await caches.open(APP_SHELL_CACHE);
        // ルート・index.html どちらにも対応
        return (await cache.match('/index.html')) ||
               (await cache.match('/')) ||
               Response.error();
      }
    })());
    return;
  }

  const url = request.url;

  // 同一オリジンの静的アセット: Cache-First
  if (sameOrigin(url) && isStaticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const res = await fetch(request);
      cache.put(request, res.clone());
      return res;
    })());
    return;
  }

  // それ以外（画像・JS・CSS・JSONなど）: Stale-While-Revalidate 風
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    const fetchAndUpdate = fetch(request)
      .then((res) => {
        // 成功したらキャッシュ更新
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(request, res.clone());
        }
        return res;
      })
      .catch(() => null);

    // まずキャッシュ、裏で更新。キャッシュ無ければネットを待つ
    return cached || (await fetchAndUpdate) || new Response('', { status: 504, statusText: 'Offline' });
  })());
});

// === 任意：キャッシュ肥大対策の簡易トリム（サイズ制限を雑に実装） ===
async function trimCache(cacheName, maxEntries = 200) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
  }
}
self.addEventListener('periodicsync', () => {
  // （対応ブラウザは限られる）起動時などに軽くトリム
  trimCache(RUNTIME_CACHE, 200);
});
