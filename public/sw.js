const CONTRATAE_SW_VERSION = 'v11.3.38';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
// Sem cache de páginas/dados nesta fase: evita servir dashboard ou perfil desatualizado.
self.addEventListener('fetch', () => {});
