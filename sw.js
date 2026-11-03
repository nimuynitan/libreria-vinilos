// Service Worker — Vinilos
// Estrategia: cache-first para assets de la app, network-first y sin cache para APIs externas.
// Al subir una nueva versión del app, incrementar CACHE_VERSION para forzar refresh.

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'vinilos-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png',
];

// Install: pre-cachear los assets del app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('vinilos-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first solo para same-origin GET.
// Las llamadas a api.discogs.com y a i.discogs.com (portadas) pasan derecho a la red.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // External: no interceptar (fetch directo del browser).
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Si tenemos cache, lo devolvemos. En paralelo intentamos actualizar en background.
        fetch(req).then((fresh) => {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(req, fresh.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      // No está en cache → fetch y cachear.
      return fetch(req).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Mensaje desde el app para forzar skipWaiting (cuando el user acepta actualizar)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
