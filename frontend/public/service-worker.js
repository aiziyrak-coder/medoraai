/**
 * DEPRECATED: brauzer keshida qolgan eski URL.
 * fetch handler YO'Q — faqat kesh tozalab o'chadi. Yangi: /medora-sw-cleanup.js
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {
        /* ignore */
      }
      try {
        await self.clients.claim();
      } catch (_) {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch (_) {
        /* ignore */
      }
    })()
  );
});
