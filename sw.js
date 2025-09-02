// sw.js (shiire v22)
// - 旧SWの重複 activate を整理
// - 即時有効化対応（SKIP_WAITING）
// - 同一オリジン GET のみキャッシュ
// - index.html は install時にno-cache取得して最新化
// - stale-while-revalidate（表示は速く、裏で更新）
// - 旧キャッシュの掃除

const CACHE_NAME = "shiire-cache-v22-2025-09-02"; // ← 日付 or バージョンを上げれば確実に更新
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Install: 先に最新 index.html を no-cache で取りに行ってから precache
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // index.html を最新版で確保（キャッシュ汚染防止）
    try {
      const fresh = await fetch("./index.html", { cache: "no-cache" });
      if (fresh.ok) await cache.put("./index.html", fresh.clone());
    } catch (_) {
      // オフラインなら後続の addAll に期待
    }

    // 残りもプリキャッシュ
    await cache.addAll(PRECACHE_ASSETS);
  })());
});

// Activate: 旧キャッシュを削除して即制御
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// メッセージ: すぐ有効化（forceUpdateSW が使う）
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch: 同一オリジン GET のみハンドル
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // POST/PUT等や別オリジンは素通し
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ナビゲーション（SPA対応・アプリは単一HTML）: index.html を返す
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match("./index.html");
      const network = fetch("./index.html", { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok) cache.put("./index.html", res.clone());
          return res;
        })
        .catch(() => null);
      // 先にキャッシュ（速い）、裏でネット更新
      return cached || network || new Response("Offline", { status: 503 });
    })());
    return;
  }

  // 通常静的アセット: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    const networkPromise = fetch(req)
      .then((res) => {
        // Opaque or 200系のみ保存（CDN等はopaqueになることあり）
        if (res && (res.ok || res.type === "opaque")) {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      })
      .catch(() => null);

    // キャッシュがあれば即返し、裏で更新。なければネット、ダメならキャッシュ。
    return cached || networkPromise || new Response("Offline", { status: 503 });
  })());
});
