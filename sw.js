// ==== Service Worker for Shiire v22.x ====
// HTMLはNetwork-firstで常に最新化、静的アセットはStale-while-revalidateで高速表示

const VERSION = "v22.2";                         // ← デプロイごとに上げる
const CACHE_CORE = `shiire-core-${VERSION}`;
const CACHE_ASSET = `shiire-asset-${VERSION}`;

// GitHub Pagesでも相対パスでOK
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_CORE).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![CACHE_CORE, CACHE_ASSET].includes(k) && k.startsWith("shiire-"))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// helper: 同一オリジンのみ対象
function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; }
  catch { return false; }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 画面遷移 or HTML は Network-first
  const isHTML =
    req.mode === "navigate" ||
    (req.destination === "document") ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          // index.html は常に最新を取りに行く（キャッシュへも保存）
          const fresh = await fetch(new Request(url.toString(), { cache: "reload" }));
          const cache = await caches.open(CACHE_CORE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          // オフライン時はキャッシュから
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // それ以外（同一オリジンのGET）の静的資産は Stale-while-revalidate
  if (req.method === "GET" && isSameOrigin(req.url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const fetchPromise = fetch(req)
          .then(async (res) => {
            const cache = await caches.open(CACHE_ASSET);
            // 成功レスポンスのみキャッシュ
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await fetchPromise) || new Response("", { status: 504 });
      })()
    );
  }
});

// 新SWを即時有効化（アプリの forceUpdateSW から postMessage）
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
