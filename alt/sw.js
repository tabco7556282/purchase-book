/* sw.js — alt v22.3 */
const VERSION = 'v22.3-alt';
const PREFIX  = 'shiire-alt';
const APP_SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const RUNTIME_CACHE   = `${PREFIX}-rt-${VERSION}`;

const BASE = new URL('./', self.location).pathname;
const path = (p)=> BASE + p;

const APP_SHELL = [
  path(''), path('index.html'),
  path('manifest.webmanifest'),
  path('sw.js?ver=22.3-alt'),
  path('icons/icon-192.png'), path('icons/icon-512.png'),
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(APP_SHELL_CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>![APP_SHELL_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', e=>{ if(e.data?.type==='SKIP_WAITING') self.skipWaiting(); });

const isNav = (req)=> req.mode==='navigate' || (req.method==='GET' && req.headers.get('accept')?.includes('text/html'));

self.addEventListener('fetch', (event)=>{
  const {request} = event;
  if(request.method!=='GET') return;

  if (isNav(request)) {
    event.respondWith((async()=>{
      try{
        const fresh = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE); cache.put(request, fresh.clone());
        return fresh;
      }catch{
        const shell = await caches.open(APP_SHELL_CACHE);
        return (await shell.match(new Request(path('index.html'),{ignoreSearch:true})))
            || (await shell.match(new Request(path(''),{ignoreSearch:true})))
            || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request,{ignoreSearch:true});
    const fresh = await fetch(request).then(res=>{
      if(res && res.status===200 && res.type==='basic') cache.put(request,res.clone());
      return res;
    }).catch(()=>null);
    return cached || fresh || new Response('',{status:504});
  })());
});

