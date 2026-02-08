/**
 * Centralized error handling utilities
 */

import { logger } from './logger';

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard error codes
 */
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Creates a user-friendly error message
 */
export const getUserFriendlyError = (error: unknown, defaultMessage: string = "Xatolik yuz berdi"): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return "Internet aloqasi bilan muammo. Iltimos, internetni tekshiring va qayta urinib ko'ring.";
    }
    
    // Gemini API key invalid (400 INVALID_ARGUMENT / API_KEY_INVALID)
    if (message.includes('api key not valid') || message.includes('api_key_invalid') || message.includes('invalid_argument')) {
      return "AI xizmati kaliti noto'g'ri yoki ishlamayapti. Administrator: Google AI Studio da yangi kalit yarating va serverda .env.production ni yangilang, keyin frontendni qayta build qiling.";
    }

    // 503 / model overloaded / UNAVAILABLE
    if (message.includes('503') || message.includes('overloaded') || message.includes('unavailable')) {
      return "AI server hozir band. Iltimos, 10–15 soniyadan keyin qayta urinib ko'ring.";
    }

    // Invalid/truncated JSON response
    if (message.includes("noto'g'ri javob") || message.includes('invalid json') || message.includes('failed to parse json')) {
      return "AI javobi to'liq kelmadi. Iltimos, qayta urinib ko'ring.";
    }

    // API errors
    if (message.includes('api') || message.includes('gemini')) {
      return "AI xizmati bilan muammo. Iltimos, biroz kuting va qayta urinib ko'ring.";
    }
    
    // Timeout errors
    if (message.includes('timeout')) {
      return "So'rov vaqti tugadi. Iltimos, qayta urinib ko'ring.";
    }
    
    // Rate limit errors
    if (message.includes('rate limit') || message.includes('quota') || message.includes('429')) {
      return "So'rovlar soni cheklangan. Iltimos, biroz kuting va qayta urinib ko'ring.";
    }

    // Forbidden / access denied
    if (message.includes('403') || message.includes('forbidden') || message.includes('huquq')) {
      return "Ushbu amal uchun ruxsat yo'q. Iltimos, hisobingizni tekshiring.";
    }
    
    // Return original message if it's already user-friendly
    return error.message;
  }
  
  return defaultMessage;
};

/**
 * Handles errors and logs them appropriately
 */
export const handleError = (error: unknown, context: string = 'Application'): AppError => {
  const appError: AppError = {
    code: ErrorCode.UNKNOWN_ERROR,
    message: getUserFriendlyError(error),
    details: error
  };
  
  // Determine error code
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      appError.code = ErrorCode.NETWORK_ERROR;
    } else if (message.includes('api') || message.includes('gemini')) {
      appError.code = ErrorCode.API_ERROR;
    } else if (message.includes('validation') || message.includes('invalid')) {
      appError.code = ErrorCode.VALIDATION_ERROR;
    } else if (message.includes('auth') || message.includes('login') || message.includes('password')) {
      appError.code = ErrorCode.AUTH_ERROR;
    } else if (message.includes('file') || message.includes('upload')) {
      appError.code = ErrorCode.FILE_ERROR;
    }
  }
  
  // Log error
  logger.error(`[${context}]`, appError);
  
  return appError;
};

/**
 * Wraps async functions with error handling
 */
export const withErrorHandling = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: string = 'Function'
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = handleError(error, context);
      throw new Error(appError.message);
    }
  }) as T;
};
