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

// Service Worker: productionda o'chiq (suntiy 503, login fetch, eski kesh). PWA kerak bo'lsa:
// .env da VITE_ENABLE_SW=true
const enableServiceWorker =
  import.meta.env.DEV
    ? import.meta.env.VITE_ENABLE_SW !== 'false'
    : import.meta.env.VITE_ENABLE_SW === 'true';

if (enableServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        registration.update();
        logger.log('ServiceWorker registered:', registration.scope);
      })
      .catch((error) => {
        logger.warn('ServiceWorker registration failed:', error);
      });
  });
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const dropSw = () =>
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister());
    });
  dropSw();
  window.addEventListener('load', () => void dropSw());
}