// Auto-updated by GitHub Actions — do not edit by hand.
// Must match APP_VERSION in js/version.js.
const CACHE = 'budget-1.3.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/version.js',
  './js/format.js',
  './js/db.js',
  './js/render.js',
  './js/modal.js',
  './js/bank.js',
  './js/app.js',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle same-origin requests
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      });
    })
  );
});

// Triggered by app.js when user confirms the update
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
