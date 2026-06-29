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

const appTree = (
  <LanguageProvider>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </LanguageProvider>
);

const root = ReactDOM.createRoot(rootElement);
// StrictMode faqat dev — productionda useEffect ikki marta ishlaydi va API storm yaratadi
root.render(import.meta.env.DEV ? <React.StrictMode>{appTree}</React.StrictMode> : appTree);
