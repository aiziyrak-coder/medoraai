/**
 * Base API Configuration and Utilities
 */
import { API_CONFIG } from '../config/api';

export const API_BASE_URL = API_CONFIG.BASE_URL;
const HOST_BASE = API_CONFIG.HOST_BASE ?? (API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:8000');

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    details?: unknown;
  };
  summary?: Record<string, unknown>;
  pagination?: {
    count: number;
    next: string | null;
    previous: string | null;
    page_size: number;
    current_page: number;
    total_pages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: number;
    message: string;
    details?: unknown;
  };
}

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

/**
 * Get refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

/**
 * Save tokens to localStorage
 */
export const saveTokens = (access: string, refresh: string): void => {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

/**
 * Remove tokens from localStorage
 */
export const clearTokens = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_data');
};

/**
 * Save user data to localStorage
 */
export const saveUserData = (user: unknown): void => {
  localStorage.setItem('user_data', JSON.stringify(user));
};

/**
 * Get user data from localStorage
 */
export const getUserData = (): unknown | null => {
  const data = localStorage.getItem('user_data');
  return data ? JSON.parse(data) : null;
};

/**
 * Retry helper for network errors
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryFetch = async <T>(
  url: string,
  options: RequestInit,
  retries = 2,
  delay = 300
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(delay * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
};

/**
 * Base fetch function with authentication, error handling, and retry logic
 */
export const apiRequest = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await retryFetch(
      `${API_BASE_URL}${endpoint}`,
      { ...options, headers },
      API_CONFIG.RETRY_ATTEMPTS,
      API_CONFIG.RETRY_DELAY
    );

    // Handle 403 Forbidden - use backend detail if present
    if (response.status === 403) {
      const errData = await response.json().catch(() => ({}));
      const msg =
        (typeof errData.detail === 'string' ? errData.detail : null) ||
        errData.error?.message ||
        errData.message ||
        "Ushbu amal uchun ruxsat yo'q. Iltimos, hisobingizni tekshiring.";
      return {
        success: false,
        error: { code: 403, message: msg },
      };
    }

    // Handle 429 Too Many Requests - retry once after delay
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      await new Promise(r => setTimeout(r, delayMs));
      const retryResponse = await retryFetch(
        `${API_BASE_URL}${endpoint}`,
        { ...options, headers },
        1,
        delayMs / 1000
      );
      const retryResult = await handleResponse<T>(retryResponse);
      if (!retryResult.success && retryResponse.status === 429) {
        return {
          success: false,
          error: {
            code: 429,
            message: "So'rovlar soni cheklangan. Iltimos, bir daqiqa kuting va qayta urinib ko'ring.",
          },
        };
      }
      return retryResult;
    }

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry request with new token
        const newToken = getAuthToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await retryFetch(
            `${API_BASE_URL}${endpoint}`,
            { ...options, headers },
            1, // Single retry for token refresh
            API_CONFIG.RETRY_DELAY
          );
          return handleResponse<T>(retryResponse);
        }
      }
      // Refresh failed or session revoked
      clearTokens();
      const errData = await response.json().catch(() => ({}));
      const msg =
        (typeof errData.detail === 'string' ? errData.detail : null) ||
        errData.error?.message ||
        errData.message ||
        'Sessiya tugadi yoki boshqa qurilmada ochildi. Iltimos, qayta kiring.';
      return {
        success: false,
        error: { code: 401, message: msg },
      };
    }

    // 401 with no token - backend may return 401 or 403
    if (response.status === 401) {
      const errData = await response.json().catch(() => ({}));
      const msg =
        (typeof errData.detail === 'string' ? errData.detail : null) ||
        errData.error?.message ||
        errData.message ||
        'Kirish talab qilinadi. Iltimos, qayta kiring.';
      return {
        success: false,
        error: { code: 401, message: msg },
      };
    }

    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        success: false,
        error: {
          code: 0,
          message: 'Internet aloqasi bilan muammo. Iltimos, internetni tekshiring.',
        },
      };
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 0,
          message: 'So\'rov vaqti tugadi. Iltimos, qayta urinib ko\'ring.',
        },
      };
    }
    throw error;
  }
};

/**
 * Format Django REST framework validation errors (field -> list of messages) into one string.
 */
function formatDrfErrors(errors: Record<string, string[] | unknown>): string {
  const parts: string[] = [];
  for (const [field, value] of Object.entries(errors)) {
    if (Array.isArray(value)) parts.push(...value.map((m) => `${field}: ${m}`));
    else if (typeof value === 'string') parts.push(`${field}: ${value}`);
  }
  return parts.length ? parts.join('. ') : '';
}

/**
 * Handle API response
 */
const handleResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  let data: Record<string, unknown> = {};
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // body not JSON or empty
  }

  if (!response.ok) {
    const errObj = data?.error as { message?: string; details?: unknown } | Record<string, unknown> | undefined;
    const errMessage = errObj && typeof errObj === 'object' && !Array.isArray(errObj) && 'message' in errObj
      ? (errObj as { message?: string }).message
      : typeof data?.error === 'string'
        ? (data.error as string)
        : undefined;
    const drfErrors = data && typeof data === 'object' && !errMessage && !data?.message && !data?.detail
      ? formatDrfErrors(data as Record<string, string[]>)
      : null;
    const message =
      errMessage ||
      (data?.message as string | undefined) ||
      drfErrors ||
      (typeof data?.detail === 'string' ? data.detail : null) ||
      (Array.isArray(data?.detail) ? (data.detail as string[]).join('. ') : null) ||
      (response.status === 400
        ? "Ma'lumotlar noto'g'ri. Maydonlarni tekshiring."
        : "Xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.");
    if (response.status === 400 && !errMessage && Object.keys(data).length === 0 && typeof console !== 'undefined' && console.warn) {
      console.warn("[Farg'ona JSTI] 400 javob (server tanasi bo'sh):", response.url);
    }
    const details = errObj && typeof errObj === 'object' && 'details' in errObj ? (errObj as { details?: unknown }).details : undefined;
    return {
      success: false,
      error: {
        code: response.status,
        message,
        details: details ?? (data && typeof data === 'object' ? (data.errors ?? data) : undefined),
      },
    };
  }

  // Handle paginated responses
  if (data.pagination) {
    return {
      success: true,
      data: data.data as T,
      pagination: data.pagination,
    };
  }

  // Handle standard responses
  if (data.success !== undefined) {
    return {
      success: data.success,
      data: data.data as T,
      error: data.error,
      summary: data.summary,
      pagination: data.pagination,
    };
  }

  // Direct data response
  return {
    success: true,
    data: data as T,
  };
};

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access) {
        // Keep the same refresh token or use new one if provided
        const newRefresh = data.refresh || refreshToken;
        saveTokens(data.access, newRefresh);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * GET request
 */
export const apiGet = <T = unknown>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> => {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiRequest<T>(`${endpoint}${queryString}`, { method: 'GET' });
};

/**
 * POST request
 */
export const apiPost = <T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> => {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * PUT request
 */
export const apiPut = <T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> => {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * PATCH request
 */
export const apiPatch = <T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> => {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * DELETE request
 */
export const apiDelete = <T = unknown>(endpoint: string): Promise<ApiResponse<T>> => {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
};

/**
 * Upload file
 */
export const apiUpload = async <T = unknown>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, string>
): Promise<ApiResponse<T>> => {
  const token = getAuthToken();
  const formData = new FormData();
  
  formData.append('file', file);
  
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return handleResponse<T>(response);
  } catch (error) {
    return {
      success: false,
      error: {
        code: 0,
        message: 'Fayl yuklashda xatolik yuz berdi',
      },
    };
  }
};

export interface HealthCheckResult {
  ok: boolean;
  status?: number;
}

/**
 * Check backend health (for connectivity banner / offline detection).
 * Uses same origin as the page so CORS/redirect do not cause false "offline".
 * On timeout/network error we report ok: true so the banner does not block the user.
 */
export const checkApiHealth = async (): Promise<HealthCheckResult> => {
  const healthUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/health/`
      : `${HOST_BASE}/health/`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    // 2xx: healthy. 400: DNS/redirect. 5xx: server error.
    const isServerUp = res.status < 500 && res.status !== 400;
    return { ok: isServerUp, status: res.status };
  } catch {
    // Vaqtinchalik tarmoq xatosi — banner ko'rsatmaymiz, saqlash o'zida xato chiqaradi
    return { ok: true, status: undefined };
  }
};