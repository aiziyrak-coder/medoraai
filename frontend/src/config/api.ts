/**
 * API Configuration
 */

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const API_CONFIG = {
  BASE_URL: rawBase.endsWith('/api') || rawBase.endsWith('/api/') ? rawBase.replace(/\/api\/?$/, '') + '/api' : rawBase,
  /** Base URL without /api for health check */
  HOST_BASE: rawBase.replace(/\/api\/?$/, '') || 'http://localhost:8000',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

/**
 * Check if API is configured
 */
export const isApiConfigured = (): boolean => {
  return !!import.meta.env.VITE_API_BASE_URL;
};
