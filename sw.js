// ===============================
// 仕入れ管理アプリ PWA Service Worker
// v25.0
// ===============================

// キャッシュ名（バージョンアップ時はここを必ず変更！）
const CACHE_NAME = 'shiire-cache-v25';

// プリキャッシュするファイル一覧
const PRECACHE_FILES = [
  './',                        // ルート
  './index.html',              // メインHTML
  './manifest.webmanifest',    // PWAマニフェスト
  './sw.js',                   // 自分自身
  './icons/icon-192-v223i.png', // PWAアイコン(192)
  './icons/icon-512-v223i.png', // PWAアイコン(512)
  // 必要に応じてCSSや画像ファイルをここに追加
];

// インストール時：キャッシュを作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_FILES);
    }).then(() => self.skipWaiting()) // インストール後すぐアクティブ化
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // v25以外を削除
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim()) // 即時制御権取得
  );
});

// フェッチ時：キャッシュ優先＋バックグラウンド更新
self.addEventListener('fetch', event => {
  const { request } = event;

  // GET以外は無視
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(networkResponse => {
          // 成功したらキャッシュ更新
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch(() => cached); // オフライン時はキャッシュのみ

      return cached || fetchPromise;
    })
  );
});

// 即時更新用メッセージ（forceUpdateSW対応）
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

