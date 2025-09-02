const VERSION = "v22.3";
const CACHE_CORE = `shiire-core-${VERSION}`;
const CACHE_ASSET = `shiire-asset-${VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event)=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_CORE).then(c=>c.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', (event)=>{
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('shiire-') && ![CACHE_CORE, CACHE_ASSET].includes(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

function isSameOrigin(url){ try{ return new URL(url).origin === self.location.origin; }catch{ return false; } }

self.addEventListener('fetch', (event)=>{
  const req = event.request; const url = new URL(req.url);
  const isHTML = req.mode==='navigate' || req.destination==='document' || (req.headers.get('accept')||'').includes('text/html');

  if (isHTML){
    event.respondWith((async()=>{
      try{
        const fresh = await fetch(new Request(url.toString(), { cache:'reload' }));
        const cache = await caches.open(CACHE_CORE); cache.put(req, fresh.clone());
        return fresh;
      }catch{
        const cached = await caches.match(req);
        return cached || caches.match('./index.html');
      }
    })());
    return;
  }

  if (req.method==='GET' && isSameOrigin(req.url)){
    event.respondWith((async()=>{
      const cached = await caches.match(req);
      const fetched = fetch(req).then(async res=>{ if(res && res.ok){ const c=await caches.open(CACHE_ASSET); c.put(req, res.clone()); } return res; }).catch(()=>null);
      return cached || (await fetched) || new Response('', {status:504});
    })());
  }
});

self.addEventListener('message', (event)=>{ if(event.data && event.data.type==='SKIP_WAITING'){ self.skipWaiting(); } });
