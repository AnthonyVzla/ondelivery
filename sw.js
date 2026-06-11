const CACHE_NAME = 'ondelivery-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './timbre.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
