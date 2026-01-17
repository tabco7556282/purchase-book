/* TLP DEMO Service Worker
   - scope: /demo/
   - pass-through (no caching) to avoid affecting the production app.
*/
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
// No fetch handler => browser default network behavior
