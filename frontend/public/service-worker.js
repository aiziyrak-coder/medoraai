const CACHE_NAME = 'konsilium-cache-v8';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache and caching essential assets');
      return Promise.allSettled(urlsToCache.map(url => cache.add(url).catch(() => {})));
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
  const sameOrigin = url.origin === self.location.origin;

  // Cross-origin (e.g. API): do not intercept — let browser handle (CORS works normally)
  if (!sameOrigin) {
    return;
  }

  // Same-origin: never cache health or API paths
  if (url.pathname.startsWith('/health') || url.pathname.includes('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503, statusText: 'Service Unavailable' })));
    return;
  }

  // Use network-first for navigation
  if (request.mode === 'navigate') {
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
      return fetch(request)
        .then(networkResponse => {
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => new Response('', { status: 504, statusText: 'Gateway Timeout' }));
    })
  );
});
