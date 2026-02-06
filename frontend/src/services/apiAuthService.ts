/**
 * API-based Authentication Service
 * Replaces localStorage-based auth with backend API
 */
import { apiPost, apiGet, apiPatch, saveTokens, clearTokens, saveUserData, getUserData, type ApiResponse } from './api';
import type { User } from '../types';

/** API dan kelgan user (snake_case) ni frontend User (camelCase) ga o'giradi */
function normalizeUser(apiUser: Record<string, unknown>): User {
  return {
    phone: String(apiUser.phone ?? ''),
    name: String(apiUser.name ?? ''),
    role: (apiUser.role as User['role']) ?? 'doctor',
    specialties: Array.isArray(apiUser.specialties) ? apiUser.specialties as string[] : undefined,
    linkedDoctorId: apiUser.linked_doctor != null ? String(apiUser.linked_doctor) : undefined,
    subscriptionStatus: (apiUser.subscription_status as User['subscriptionStatus']) ?? apiUser.subscriptionStatus as User['subscriptionStatus'] ?? 'inactive',
    subscriptionExpiry: apiUser.subscription_expiry != null ? String(apiUser.subscription_expiry) : apiUser.subscriptionExpiry as string | undefined,
    subscriptionPlan: (apiUser.subscription_plan_detail ?? apiUser.subscriptionPlan) as User['subscriptionPlan'] ?? null,
    trialEndsAt: apiUser.trial_ends_at != null ? String(apiUser.trial_ends_at) : apiUser.trialEndsAt as string | null ?? null,
  };
}

/** Foydalanuvchining obunasi faolmi (trial yoki to'langan) */
export function hasActiveSubscription(user: User): boolean {
  if (user.role === 'staff') return true;
  if (user.subscriptionStatus !== 'active') return false;
  const now = new Date();
  if (user.trialEndsAt && new Date(user.trialEndsAt) > now) return true;
  if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) > now) return true;
  if (!user.trialEndsAt && !user.subscriptionExpiry) return true;
  return false;
}

export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface RegisterData {
  phone: string;
  name: string;
  password: string;
  password_confirm?: string;
  role: 'clinic' | 'doctor' | 'staff';
  specialties?: string[];
  linked_doctor?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

/**
 * Register new user
 */
export const register = async (data: RegisterData): Promise<{ success: boolean; message: string }> => {
  try {
    // Ensure password_confirm is set
    const registerData = {
      ...data,
      password_confirm: data.password_confirm || data.password,
    };
    
    const response = await apiPost<AuthResponse>('/auth/register/', registerData);
    
    if (response.success && response.data) {
      saveTokens(response.data.tokens.access, response.data.tokens.refresh);
      saveUserData(normalizeUser(response.data.user as Record<string, unknown>));
      return {
        success: true,
        message: "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi.",
      };
    }

    if (response.error?.message) {
      return { success: false, message: response.error.message };
    }
    
    // Fallback to local storage if API fails
    const { register: localRegister } = await import('./authService');
    const localResult = localRegister({
      phone: data.phone,
      name: data.name,
      password: data.password,
      role: data.role,
      specialties: data.specialties,
    });
    
    return localResult;
  } catch (error) {
    // Fallback to local storage
    try {
      const { register: localRegister } = await import('./authService');
      return localRegister({
        phone: data.phone,
        name: data.name,
        password: data.password,
        role: data.role,
        specialties: data.specialties,
      });
    } catch {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Ro'yxatdan o'tishda xatolik yuz berdi.",
      };
    }
  }
};

/**
 * Login user
 */
export const login = async (credentials: LoginCredentials): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiPost<AuthResponse>('/auth/login/', credentials);
    
    if (response.success && response.data) {
      saveTokens(response.data.tokens.access, response.data.tokens.refresh);
      saveUserData(normalizeUser(response.data.user as Record<string, unknown>));
      return {
        success: true,
        message: "Tizimga muvaffaqiyatli kirdingiz.",
      };
    }

    if (response.error?.message) {
      return { success: false, message: response.error.message };
    }
    
    // Fallback to local storage if API fails
    const { login: localLogin } = await import('./authService');
    const localResult = localLogin(credentials);
    
    if (localResult.success) {
      const user = getCurrentUser();
      if (user) {
        saveUserData(user);
      }
    }
    
    return localResult;
  } catch (error) {
    // Fallback to local storage
    try {
      const { login: localLogin } = await import('./authService');
      const result = localLogin(credentials);
      if (result.success) {
        const user = getCurrentUser();
        if (user) {
          saveUserData(user);
        }
      }
      return result;
    } catch {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Kirishda xatolik yuz berdi.",
      };
    }
  }
};

/**
 * Logout user
 */
export const logout = (): void => {
  clearTokens();
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  const userData = getUserData();
  return userData as User | null;
};

/**
 * Get user profile from API
 */
export const getProfile = async (): Promise<User | null> => {
  try {
    const response = await apiGet<Record<string, unknown>>('/auth/profile/');
    
    if (response.success && response.data) {
      const user = normalizeUser(response.data);
      saveUserData(user);
      return user;
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (data: Partial<User>): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiPatch<User>('/auth/profile/', data);
    
    if (response.success && response.data) {
      saveUserData(response.data);
      return {
        success: true,
        message: 'Profil yangilandi.',
      };
    }
    
    return {
      success: false,
      message: response.error?.message || 'Profil yangilashda xatolik yuz berdi.',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Profil yangilashda xatolik yuz berdi.',
    };
  }
};

/**
 * Change password
 */
export const changePassword = async (data: {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiPost('/auth/change-password/', data);
    
    if (response.success) {
      return {
        success: true,
        message: "Parol muvaffaqiyatli o'zgartirildi.",
      };
    }
    
    return {
      success: false,
      message: response.error?.message || "Parol o'zgartirishda xatolik yuz berdi.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Parol o'zgartirishda xatolik yuz berdi.",
    };
  }
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (phone: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiPost('/auth/password-reset/', { phone });
    
    return {
      success: response.success,
      message: response.error?.message || response.data?.message || 
        "Agar ushbu raqam uchun hisob mavjud bo'lsa, tiklash yo'riqnomasi yuborildi.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Parol tiklash so'rovida xatolik yuz berdi.",
    };
  }
};
