import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';
import { ErrorBoundaryClass as ErrorBoundary } from './components/ErrorBoundary';
import { logger } from './utils/logger';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global unhandled rejection handler - log and avoid silent failures
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
  // In production you can report to Sentry: Sentry.captureException(event.reason);
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LanguageProvider>
  </React.StrictMode>
);

/**
 * Service Worker: "sweep" — eski SW/keshni majburan yangilash.
 * Yangi fayl nomi: eski /service-worker.js (50+ qator, fetch) kesh bilan aralashmaydi.
 */
const SW_CLEANUP_URL = '/medora-sw-cleanup.js?v=medora-sweep-6';

if ('serviceWorker' in navigator) {
  const clearWebCaches = async () => {
    if (!('caches' in window)) return;
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* ignore */
    }
  };

  const runSweep = () => {
    void navigator.serviceWorker.getRegistrations().then(async (regs) => {
      await Promise.all(regs.map((r) => r.unregister()));
      await clearWebCaches();
      try {
        const reg = await navigator.serviceWorker.register(SW_CLEANUP_URL, {
          scope: '/',
          updateViaCache: 'none',
        });
        await reg.update();
        if (import.meta.env.DEV) {
          logger.log('SW cleanup registered (dev)');
        }
      } catch {
        /* tarmoq yo'q — ilova baribir ishlaydi */
      }
    });
  };
  if (document.readyState === 'complete') {
    runSweep();
  } else {
    window.addEventListener('load', runSweep, { once: true });
  }
}