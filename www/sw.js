// SuperCoin Vault — offline service worker
const CACHE = 'supercoin-vault-v1';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/db.js',
  './js/parser.js',
  './js/app.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
