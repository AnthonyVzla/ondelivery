const CACHE_NAME = 'ondelivery-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
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

// Escuchar notificaciones Push
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: 'https://i.postimg.cc/GhX8YJCV/Screenshot-20260611-123137-Instagram.jpg',
    badge: 'https://i.postimg.cc/GhX8YJCV/Screenshot-20260611-123137-Instagram.jpg'
  };
  event.waitUntil(
    self.registration.showNotification('On Delivery', options)
  );
});