/**
 * API Adapter - Server-only storage (no local fallback)
 */
import type { User, AnalysisRecord } from '../types';
import * as apiAuthService from './apiAuthService';
import { getAuthToken } from './api';

/**
 * Check if API is available
 */
const isApiAvailable = (): boolean => {
  return !!getAuthToken() || import.meta.env.VITE_API_BASE_URL !== undefined;
};

/**
 * Get current user (API only)
 */
export const getCurrentUser = (): User | null => {
  return apiAuthService.getCurrentUser();
};

/**
 * Login (API only)
 */
export const login = async (credentials: { phone: string; password?: string }): Promise<{ success: boolean; message: string }> => {
  if (isApiAvailable()) {
    return await apiAuthService.login({ phone: credentials.phone, password: credentials.password ?? '' });
  }
  return { success: false, message: 'Serverga ulanish yo\'q. Iltimos, internetni tekshiring.' };
};

/**
 * Register (API only)
 */
export const register = async (user: User): Promise<{ success: boolean; message: string }> => {
  if (isApiAvailable()) {
    return await apiAuthService.register({
      phone: user.phone,
      name: user.name,
      password: user.password || '',
      password_confirm: user.password || '',
      role: user.role,
      specialties: user.specialties,
    });
  }
  return { success: false, message: 'Serverga ulanish yo\'q. Iltimos, internetni tekshiring.' };
};

/**
 * Logout
 */
export const logout = (): void => {
  apiAuthService.logout();
};