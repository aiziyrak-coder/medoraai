/**
 * API Helper Functions
 */
import type { ApiResponse } from '../services/api';
import { logger } from './logger';

/**
 * Extract error message from API response
 */
export const getErrorMessage = (response: ApiResponse<unknown>): string => {
  if (response.error) {
    return response.error.message || 'Xatolik yuz berdi';
  }
  return 'Noma\'lum xatolik';
};

/**
 * Check if response is successful
 */
export const isSuccess = (response: ApiResponse<unknown>): boolean => {
  return response.success === true;
};

/**
 * Handle API response with fallback
 */
export const handleApiResponse = <T>(
  response: ApiResponse<T>,
  onSuccess: (data: T) => void,
  onError?: (message: string) => void
): void => {
  if (isSuccess(response) && response.data !== undefined) {
    onSuccess(response.data);
  } else {
      const errorMessage = getErrorMessage(response);
      if (onError) {
        onError(errorMessage);
      } else {
        logger.error('[API Error]', errorMessage);
      }
  }
};
