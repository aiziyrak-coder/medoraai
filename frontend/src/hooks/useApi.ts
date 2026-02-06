/**
 * Custom hook for API calls with loading and error states
 */
import { useState, useCallback } from 'react';
import type { ApiResponse } from '../services/api';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useApi = <T = unknown>() => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<ApiResponse<T>>) => {
    setState({ data: null, loading: true, error: null });
    
    try {
      const response = await apiCall();
      
      if (response.success && response.data !== undefined) {
        setState({ data: response.data, loading: false, error: null });
        return response.data;
      } else {
        const errorMessage = response.error?.message || 'Xatolik yuz berdi';
        setState({ data: null, loading: false, error: errorMessage });
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Noma\'lum xatolik';
      setState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
};
