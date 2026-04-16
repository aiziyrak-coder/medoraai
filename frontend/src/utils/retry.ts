/**
 * Retry utility for API calls with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 200,
  maxDelay: 3000,
  backoffMultiplier: 1.5,
  retryableErrors: ['network', 'timeout', 'fetch', 'connection']
};

/**
 * Matn — Error, oddiy obyekt yoki JSON ichidagi status kodlari uchun.
 */
const errorMessageForRetry = (error: unknown): string => {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown; status?: number };
    const base = [error.message, typeof withCause.status === 'number' ? String(withCause.status) : '']
      .filter(Boolean)
      .join(' ');
    const cause = withCause.cause != null ? ` ${errorMessageForRetry(withCause.cause)}` : '';
    return (base + cause).trim();
  }
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

/**
 * Checks if an error is retryable
 */
const isRetryableError = (error: unknown, retryableErrors: string[]): boolean => {
  const message = errorMessageForRetry(error).toLowerCase();
  return retryableErrors.some(keyword => message.includes(keyword));
};

/**
 * Calculates delay with exponential backoff
 */
const calculateDelay = (attempt: number, initialDelay: number, maxDelay: number, multiplier: number): number => {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
};

/**
 * Retries a function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === opts.maxRetries || !isRetryableError(error, opts.retryableErrors)) {
        throw error;
      }
      
      // Wait before retrying
      const delay = calculateDelay(attempt, opts.initialDelay, opts.maxDelay, opts.backoffMultiplier);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};