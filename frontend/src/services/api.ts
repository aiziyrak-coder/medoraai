/**
 * Base API Configuration and Utilities
 */
import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;
const HOST_BASE = API_CONFIG.HOST_BASE ?? (API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:8000');

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    details?: unknown;
  };
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
  retries = 3,
  delay = 1000
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

    // Handle 403 Forbidden
    if (response.status === 403) {
      return {
        success: false,
        error: {
          code: 403,
          message: "Ushbu amal uchun ruxsat yo'q. Iltimos, hisobingizni tekshiring.",
        },
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
      // Refresh failed or session revoked (boshqa qurilmada ochilgan)
      clearTokens();
      return {
        success: false,
        error: {
          code: 401,
          message: 'Sessiya tugadi yoki boshqa qurilmada ochildi. Iltimos, qayta kiring.',
        },
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
 * Handle API response
 */
const handleResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    return {
      success: false,
      error: {
        code: response.status,
        message: `Server xatolik qaytardi: ${response.statusText}`,
      },
    };
  }

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: response.status,
        message: data.error?.message || data.message || 'Xatolik yuz berdi',
        details: data.error?.details || data.errors || data,
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

/**
 * Check backend health (for connectivity banner / offline detection)
 */
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${HOST_BASE}/health/`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
};
