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

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(registration => {
        // Service worker registered successfully
        logger.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        // Service worker registration failed - non-critical, app will still work
        logger.warn('ServiceWorker registration failed: ', error);
      });
  });
}