/**
 * API Configuration
 *
 * Ba'zi production buildlar API ni front domeniga (medora.cdcgroup.uz) qo'yib yuboradi —
 * DNS `medoraapi` da. Sahifa hostiga qarab to'g'ri API bazasini tanlaymiz.
 */

const rawFromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000/api';

/** Front hostname → haqiqiy API (split domen) */
const API_BASE_BY_PAGE_HOST: Record<string, string> = {
  'medora.cdcgroup.uz': 'https://medoraapi.cdcgroup.uz/api',
  'fjsti.ziyrak.org': 'https://fjstiapi.ziyrak.org/api',
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
    const wrongHosts = new Set([pageHost, 'medora.cdcgroup.uz', 'fjsti.ziyrak.org']);
    // API URL front bilan bir xil host yoki ma'lum xato hostlar — almashtiramiz
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
  TIMEOUT: 20000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 350,
};

/**
 * Check if API is configured
 */
export const isApiConfigured = (): boolean => {
  return true;
};
