import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface ErrorWithRetryProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

const ErrorWithRetry: React.FC<ErrorWithRetryProps> = ({ message, onRetry, className = '' }) => {
  const { t } = useTranslation();
  const displayMessage = message || t('error_connection_or_service');

  return (
    <div
      className={`p-4 text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 shadow-sm ${className}`}
      role="alert"
    >
      <p className="font-bold mb-1">{t('error_title')}</p>
      <p className="mb-3">{displayMessage}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="py-2 px-4 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
        >
          {t('error_retry_button')}
        </button>
      )}
    </div>
  );
};

export default ErrorWithRetry;
