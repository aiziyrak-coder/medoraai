/**
 * API Configuration
 *
 * Sahifa aidoktor.uz da ochilganda build noto'g'ri API host qo'ygan bo'lsa — fjstiapi ga tuzatiladi.
 */

const rawFromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000/api';

/** Front hostname → haqiqiy API (split domen) */
const API_BASE_BY_PAGE_HOST: Record<string, string> = {
  'aidoktor.uz': 'https://api.aidoktor.uz/api',
};

function stripApiSuffix(u: string): string {
  return u.replace(/\/api\/?$/, '');
}

function normalizeTrailingApi(url: string): string {
  const t = url.trim() || 'http://localhost:8000/api';
  if (t.endsWith('/api') || t.endsWith('/api/')) {
    return stripApiSuffix(t) + '/api';
  }
  return t;
}

/**
 * Build vaqtidagi URL ni sahifa hosti bilan solishtirib, noto'g'ri front-domen API ni tuzatadi.
 */
function resolveApiBaseUrl(): string {
  let base = normalizeTrailingApi(rawFromEnv);

  if (typeof window === 'undefined') {
    return base;
  }

  const pageHost = window.location.hostname;
  const preferred = API_BASE_BY_PAGE_HOST[pageHost];
  if (!preferred) {
    return base;
  }

  try {
    const apiUrl = new URL(base.endsWith('/') ? base : `${base}/`);
    const wrongHosts = new Set([pageHost, 'aidoktor.uz']);
    // API URL front bilan bir xil host yoki fjsti front host — fjstiapi ga almashtiramiz
    if (wrongHosts.has(apiUrl.hostname) && apiUrl.hostname !== new URL(preferred).hostname) {
      return preferred;
    }
  } catch {
    return preferred;
  }

  return base;
}

const resolvedBase = resolveApiBaseUrl();

export const API_CONFIG = {
  BASE_URL: resolvedBase,
  HOST_BASE: stripApiSuffix(resolvedBase) || stripApiSuffix(rawFromEnv) || 'http://localhost:8000',
  /** Oddiy API (CRUD); Gemini kutadigan so‘rovlar alohida timeout */
  TIMEOUT: 30000,
  /** /api/ai/* — backend Gemini uzoq javob berishi mumkin */
  AI_TIMEOUT_MS: 180000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 350,
};

/**
 * Check if API is configured
 */
export const isApiConfigured = (): boolean => {
  return true;
};
