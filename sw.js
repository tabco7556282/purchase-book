// sw.js — V24用シンプルキャッシュ
const CACHE_NAME = "tabco-purchase-v24-cache";
const urlsToCache = [
  "./",
  "./index.html",
  "./sw.js"
];

// インストール時にキャッシュを作成
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// リクエストがあればキャッシュ優先で返す
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// 古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});
