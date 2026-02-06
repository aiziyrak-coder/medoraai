/**
 * API Adapter - Provides fallback to local storage when API is unavailable
 */
import type { User, AnalysisRecord } from '../types';
import * as localAuthService from './authService';
import * as apiAuthService from './apiAuthService';
import { getAuthToken } from './api';

/**
 * Check if API is available
 */
const isApiAvailable = (): boolean => {
  return !!getAuthToken() || import.meta.env.VITE_API_BASE_URL !== undefined;
};

/**
 * Get current user with API fallback
 */
export const getCurrentUser = (): User | null => {
  // Try API first
  const apiUser = apiAuthService.getCurrentUser();
  if (apiUser) {
    return apiUser;
  }
  
  // Fallback to local
  return localAuthService.getCurrentUser();
};

/**
 * Login with API fallback
 */
export const login = async (credentials: { phone: string; password?: string }): Promise<{ success: boolean; message: string }> => {
  // Try API first if available
  if (isApiAvailable()) {
    try {
      const result = await apiAuthService.login(credentials);
      if (result.success) {
        return result;
      }
    } catch {
      // Fall through to local
    }
  }
  
  // Fallback to local
  return localAuthService.login(credentials);
};

/**
 * Register with API fallback
 */
export const register = async (user: User): Promise<{ success: boolean; message: string }> => {
  // Try API first if available
  if (isApiAvailable()) {
    try {
      const result = await apiAuthService.register({
        phone: user.phone,
        name: user.name,
        password: user.password || '',
        password_confirm: user.password || '',
        role: user.role,
        specialties: user.specialties,
      });
      if (result.success) {
        return result;
      }
    } catch {
      // Fall through to local
    }
  }
  
  // Fallback to local
  return localAuthService.register(user);
};

/**
 * Logout
 */
export const logout = (): void => {
  apiAuthService.logout();
  localAuthService.logout();
};
