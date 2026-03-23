const CACHE_NAME = 'contratae-static-v11-3-2';
const STATIC_ASSETS = ['/manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS).catch(() => null);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
function shouldBypass(request) {
  if (!request || !request.url) return true;
  if (request.method !== 'GET') return true;
  let url;
  try { url = new URL(request.url); } catch { return true; }
  if (url.origin !== self.location.origin) return true;
  if (!url.pathname || url.pathname === '') return true;
  if (request.mode === 'navigate') return true;
  if (request.headers.get('accept')?.includes('text/html')) return true;
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return true;
  return false;
}
self.addEventListener('fetch', event => {
  if (shouldBypass(event.request)) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/manifest.webmanifest')));
    return;
  }
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response && response.ok) cache.put(event.request, response.clone()).catch(() => null);
      return response;
    } catch {
      return fetch(event.request);
    }
  })());
});
