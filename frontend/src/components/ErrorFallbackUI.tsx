import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface Props {
  error: Error | null;
  onReload: () => void;
}

/**
 * Functional fallback so we can use `t()` under LanguageProvider.
 */
const ErrorFallbackUI: React.FC<Props> = ({ error, onReload }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full medical-mesh-bg flex items-center justify-center p-4">
      <div className="glass-panel max-w-lg w-full p-8 text-center animate-fade-in-up">
        <h2 className="text-2xl font-bold text-white mb-4">{t('error_boundary_title')}</h2>
        <p className="text-slate-300 mb-6">{t('error_boundary_message')}</p>
        <button
          type="button"
          onClick={onReload}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
        >
          {t('error_boundary_reload')}
        </button>
        {import.meta.env.DEV && error && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-slate-400 cursor-pointer">{t('error_boundary_details_dev')}</summary>
            <pre className="mt-2 text-xs text-red-400 overflow-auto p-4 bg-black/20 rounded">
              {error.toString()}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorFallbackUI;
