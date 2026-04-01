/**
 * Medora SW sweep — v4 (2026-04-01)
 * Eski PWA keshini tozalaydi va o'zini o'chiradi. fetch handler yo'q.
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
