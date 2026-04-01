/**
 * Medora SW cleanup — v6 (yangi nom: eski /service-worker.js keshi bilan aralashmaydi)
 * Keshni tozalaydi va o'zini unregister qiladi. fetch handler yo'q.
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
