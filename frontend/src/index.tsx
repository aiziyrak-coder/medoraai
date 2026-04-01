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
 * Service Worker: faqat "sweep" — eski SW ni yangilab, keshni tozalaydi va o'zini o'chiradi.
 * fetch handler yo'q. Haqiqiy PWA kesh kerak bo'lsa: alohida loyiha yoki VITE_ENABLE_SW (keyinroq).
 */
if ('serviceWorker' in navigator) {
  const runSweep = () => {
    void navigator.serviceWorker.getRegistrations().then(async (regs) => {
      await Promise.all(regs.map((r) => r.unregister()));
      try {
        const reg = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        await reg.update();
        if (import.meta.env.DEV) {
          logger.log('SW sweep registered (dev)');
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