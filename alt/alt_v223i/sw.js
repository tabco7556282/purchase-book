/* sw.js — alt v22.3 */
const VERSION = 'v22.3-alt11';
const PREFIX  = 'shiire-alt';
const APP_SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const RUNTIME_CACHE   = `${PREFIX}-rt-${VERSION}`;

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192-v223i.png', './icons/icon-512-v223i.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(APP_SHELL_CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>![APP_SHELL_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  const isHTML = req.mode==='navigate' || (req.headers.get('accept')||'').includes('text/html');
  if (isHTML){
    e.respondWith((async()=>{
      try{
        const net = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE); cache.put(req, net.clone());
        return net;
      }catch{
        const shell = await caches.open(APP_SHELL_CACHE);
        return (await shell.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async()=>{
    const cache = await caches.open(RUNTIME_CACHE);
    const hit = await cache.match(req, {ignoreSearch:true});
    const net = await fetch(req).then(r=>{ if(r && r.status===200) cache.put(req, r.clone()); return r; }).catch(()=>null);
    return hit || net || new Response('',{status:504});
  })());
});
