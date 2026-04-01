/**
 * Medora: eski PWA SW ni almashtiruvchi "sweep" skript.
 * - Barcha Cache API keshlarini o'chiradi
 * - O'zini unregister qiladi
 * - fetch handler YO'Q — hech qanday so'rov ushlanmaydi (503/login muammosi yo'q)
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
