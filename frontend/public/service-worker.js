const CACHE_NAME = 'konsilium-cache-v4'; // Incremented cache version
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  // Add other static assets if any
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching essential assets');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (!cacheWhitelist.includes(cacheName)) {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Always bypass for non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  const url = new URL(request.url);

  // Use network-first for navigation and API calls
  // This ensures the user gets the freshest data, with an offline fallback.
  if (request.mode === 'navigate' || url.pathname.includes('/api/')) { // Assuming API calls could be identified
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the fetch is successful, clone it and cache it.
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If the network fails, try to serve from the cache.
          return caches.match(request).then(cachedResponse => {
            // For navigation, fallback to the root if the specific page isn't cached.
            if (request.mode === 'navigate' && !cachedResponse) {
                return caches.match('/');
            }
            return cachedResponse;
          });
        })
    );
    return;
  }
  
  // Use cache-first for static assets (app shell, fonts, etc.) for speed
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
