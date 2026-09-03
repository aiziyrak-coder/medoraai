/**
 * API-based Authentication Service
 * Replaces localStorage-based auth with backend API
 */
import { apiPost, apiGet, apiPatch, saveTokens, clearTokens, saveUserData, getUserData, getRefreshToken, getOrCreateDeviceId } from './api';
import type { User } from '../types';
import { asRecord } from '../utils/record';

/** Backend validatsiya xatolarini (details) bitta matnga yig'adi */
function formatErrorDetails(details: unknown): string {
  if (details == null) return '';
  if (typeof details === 'string') return details;
  if (Array.isArray(details)) return details.join('. ');
  if (typeof details === 'object') {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(details)) {
      const msg = Array.isArray(val) ? val.join('. ') : String(val);
      if (msg) parts.push(msg);
    }
    return parts.join('. ');
  }
  return '';
}

/** API dan kelgan user (snake_case) ni frontend User (camelCase) ga o'giradi */
function normalizeUser(apiUser: Record<string, unknown>): User {
  const hasSub =
    typeof apiUser.has_active_subscription === 'boolean'
      ? apiUser.has_active_subscription
      : typeof apiUser.hasActiveSubscription === 'boolean'
        ? apiUser.hasActiveSubscription
        : undefined;
  return {
    phone: String(apiUser.phone ?? ''),
    name: String(apiUser.name ?? ''),
    role: (apiUser.role === 'staff'
      ? 'staff'
      : apiUser.role === 'regional_stats'
        ? 'regional_stats'
        : 'clinic') as User['role'],
    specialties: Array.isArray(apiUser.specialties) ? apiUser.specialties as string[] : undefined,
    subscriptionStatus: (apiUser.subscription_status as User['subscriptionStatus']) ?? apiUser.subscriptionStatus as User['subscriptionStatus'] ?? 'inactive',
    subscriptionExpiry: apiUser.subscription_expiry != null ? String(apiUser.subscription_expiry) : apiUser.subscriptionExpiry as string | undefined,
    subscriptionPlan: (apiUser.subscription_plan_detail ?? apiUser.subscriptionPlan) as User['subscriptionPlan'] ?? null,
    trialEndsAt: apiUser.trial_ends_at != null ? String(apiUser.trial_ends_at) : apiUser.trialEndsAt as string | null ?? null,
    hasActiveSubscription: hasSub,
    isStaff: Boolean(apiUser.is_staff ?? apiUser.isStaff),
    isSuperuser: Boolean(apiUser.is_superuser ?? apiUser.isSuperuser),
    isClinicGroupAdmin: Boolean(apiUser.is_clinic_group_admin ?? apiUser.isClinicGroupAdmin),
    clinicGroupId: typeof apiUser.clinic_group === 'number' ? apiUser.clinic_group : undefined,
    clinicGroupName: apiUser.clinic_group_name != null
      ? String(apiUser.clinic_group_name)
      : apiUser.clinicGroupName != null
        ? String(apiUser.clinicGroupName)
        : undefined,
    scopedRegionId: apiUser.scoped_region_id != null
      ? String(apiUser.scoped_region_id)
      : apiUser.scopedRegionId != null
        ? String(apiUser.scopedRegionId)
        : undefined,
  };
}

const USER_ROLES: ReadonlyArray<User['role']> = ['clinic', 'staff', 'regional_stats'];

/**
 * localStorage'dagi user_data ishonchsiz manba — shakli tekshirilmasa,
 * ixtiyoriy odam `isSuperuser: true` yozib qo'yishi mumkin.
 * Shu sabab faqat kerakli maydonlari to'g'ri turdagi obyektnigina qabul qilamiz.
 */
function isValidStoredUser(value: unknown): value is User {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const u = value as Record<string, unknown>;
  if (typeof u.phone !== 'string' || !u.phone) return false;
  if (typeof u.name !== 'string') return false;
  if (typeof u.role !== 'string' || !USER_ROLES.includes(u.role as User['role'])) return false;
  const optionalBooleans = ['isStaff', 'isSuperuser', 'isClinicGroupAdmin', 'hasActiveSubscription'] as const;
  for (const key of optionalBooleans) {
    if (u[key] !== undefined && typeof u[key] !== 'boolean') return false;
  }
  const optionalStrings = ['subscriptionStatus', 'subscriptionExpiry', 'clinicGroupName', 'scopedRegionId'] as const;
  for (const key of optionalStrings) {
    if (u[key] !== undefined && u[key] !== null && typeof u[key] !== 'string') return false;
  }
  if (u.specialties !== undefined && !Array.isArray(u.specialties)) return false;
  return true;
}

/**
 * Serverdan (login / register / profile) kelgan yagona ishonchli holat.
 * localStorage faqat UI'ni tez ko'rsatish uchun kesh — huquq qarori uchun emas.
 */
let verifiedUser: User | null = null;

/** Serverdan tasdiqlangan profil (yo'q bo'lsa null) */
export function getVerifiedUser(): User | null {
  return verifiedUser;
}

/** Server profili shu sessiyada tasdiqlanganmi */
export function isSessionVerified(): boolean {
  return verifiedUser !== null;
}

function setVerifiedUser(user: User | null): void {
  verifiedUser = user;
}

/** Faqat serverdan tasdiqlangan bayroqlar asosida imtiyozli panellarga ruxsat */
export function isAdminPanelUser(): boolean {
  const u = verifiedUser;
  if (!u) return false;
  return Boolean(u.isClinicGroupAdmin || u.isStaff || u.isSuperuser);
}

/**
 * @param trusted `user` serverdan kelganmi. Kesh uchun `false` — u holda imtiyozli
 *   bayroqlar (isSuperuser va h.k.) e'tiborga olinmaydi, chunki ularni localStorage'da yozib qo'yish mumkin.
 */
function computeActiveSubscription(user: User, trusted: boolean): boolean {
  if (user.role === 'staff' || user.role === 'regional_stats') return true;
  if (trusted && (user.isStaff || user.isSuperuser)) return true;
  if (trusted && user.isClinicGroupAdmin) return true;
  if (typeof user.hasActiveSubscription === 'boolean') return user.hasActiveSubscription;
  if (user.subscriptionStatus === 'pending') return false;
  if (user.subscriptionStatus !== 'active') return false;
  const now = new Date();
  if (user.subscriptionExpiry && new Date(user.subscriptionExpiry) > now) return true;
  if (!user.trialEndsAt && !user.subscriptionExpiry) return true;
  return false;
}

/**
 * Foydalanuvchining obunasi faolmi (backend has_active_subscription bilan mos; trial yo'q).
 * Serverdan tasdiqlangan profil bo'lsa — qaror faqat o'sha profildan olinadi;
 * bo'lmasa (birinchi render / tarmoq kutilmoqda) kesh optimistik ishlatiladi.
 */
export function hasActiveSubscription(user: User): boolean {
  if (verifiedUser) return computeActiveSubscription(verifiedUser, true);
  if (!user) return false;
  return computeActiveSubscription(user, false);
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
  role: 'clinic';
  specialties?: string[];
}

export interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

function getStoredDeviceIdOnly(): string {
  try {
    return (
      (localStorage.getItem('medora_device_id') || sessionStorage.getItem('medora_device_id') || '').trim()
    );
  } catch {
    return '';
  }
}

/**
 * Register new user
 */
export const register = async (data: RegisterData): Promise<{ success: boolean; message: string }> => {
  try {
    const registerData = {
      phone: data.phone,
      name: data.name,
      password: data.password,
      password_confirm: data.password_confirm ?? data.password,
      role: data.role,
      specialties: Array.isArray(data.specialties) ? data.specialties : [],
      device_id: getOrCreateDeviceId(),
      device_info: navigator.userAgent || 'web',
    };
    const response = await apiPost<AuthResponse>('/auth/register/', registerData);
    
    if (response.success && response.data) {
      saveTokens(response.data.tokens.access, response.data.tokens.refresh);
      const user = normalizeUser(asRecord(response.data.user));
      saveUserData(user);
      setVerifiedUser(user);
      return {
        success: true,
        message: "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi.",
      };
    }

    if (response.error) {
      const err = response.error as { message?: string; details?: unknown };
      const detailsMsg = formatErrorDetails(err.details);
      const message = err.message || detailsMsg || "Ma'lumotlar noto'g'ri. Telefon va parolni tekshiring.";
      return { success: false, message };
    }
    
    return {
      success: false,
      message: "Serverga ulanib bo'lmadi. Iltimos, internetni tekshiring.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Ro'yxatdan o'tishda xatolik yuz berdi.",
    };
  }
};

/**
 * Login user
 */
export const login = async (credentials: LoginCredentials): Promise<{ success: boolean; message: string }> => {
  const phone = credentials.phone != null ? String(credentials.phone).trim() : '';
  const password = credentials.password != null ? String(credentials.password) : '';
  if (!phone) {
    return { success: false, message: "Telefon raqami kiritilishi shart." };
  }
  if (!password) {
    return { success: false, message: "Parol kiritilishi shart." };
  }
  try {
    const response = await apiPost<AuthResponse>('/auth/login/', {
      phone,
      password,
      device_id: getOrCreateDeviceId(),
      device_info: navigator.userAgent || 'web',
    });
    
    if (response.success && response.data) {
      saveTokens(response.data.tokens.access, response.data.tokens.refresh);
      const user = normalizeUser(asRecord(response.data.user));
      saveUserData(user);
      setVerifiedUser(user);
      return {
        success: true,
        message: "Tizimga muvaffaqiyatli kirdingiz.",
      };
    }

    if (response.error) {
      const detailsMsg = formatErrorDetails((response.error as { details?: unknown }).details);
      const message = detailsMsg || response.error.message || "Telefon raqami yoki parol noto'g'ri.";
      return { success: false, message };
    }
    
    return {
      success: false,
      message: "Serverga ulanib bo'lmadi. Iltimos, internetni tekshiring.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Kirishda xatolik yuz berdi.",
    };
  }
};

/**
 * Logout user
 */
export const logout = (): void => {
  const refresh = getRefreshToken();
  const deviceId = getStoredDeviceIdOnly();
  if (refresh || deviceId) {
    apiPost('/auth/logout-session/', { refresh, device_id: deviceId }).catch(() => null);
  }
  setVerifiedUser(null);
  clearTokens();
};

/**
 * Get current user (keshdan). Shakli buzilgan bo'lsa — tizimdan chiqqan deb hisoblaymiz.
 */
export const getCurrentUser = (): User | null => {
  if (verifiedUser) return verifiedUser;
  let userData: unknown = null;
  try {
    userData = getUserData();
  } catch {
    userData = null;
  }
  if (!isValidStoredUser(userData)) {
    if (userData != null) {
      try {
        localStorage.removeItem('user_data');
      } catch {
        /* storage o'chirilgan bo'lishi mumkin */
      }
    }
    return null;
  }
  return userData;
};

/**
 * Get user profile from API — imtiyoz va obuna uchun yagona ishonchli manba.
 */
export const getProfile = async (): Promise<User | null> => {
  const cached = getCurrentUser();
  try {
    const response = await apiGet<Record<string, unknown>>('/auth/profile/');

    if (response.success && response.data) {
      const user = normalizeUser(response.data);
      saveUserData(user);
      setVerifiedUser(user);
      return user;
    }

    const code = response.error?.code;
    // Faqat aniq autentifikatsiya rad etilganda sessiyani yopamiz
    if (code === 401 || code === 403) {
      setVerifiedUser(null);
      return null;
    }
    // 0 = tarmoq, 5xx va hokazo — foydalanuvchini saqlab qolamiz (bo'sh sahifa / chiqish emas)
    return cached;
  } catch {
    return cached;
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (data: Partial<User>): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiPatch<User>('/auth/profile/', data);
    
    if (response.success && response.data) {
      const user = normalizeUser(asRecord(response.data));
      saveUserData(user);
      setVerifiedUser(user);
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
      message: response.error?.message || (response.data as { message?: string } | null)?.message || 
        "Agar ushbu raqam uchun hisob mavjud bo'lsa, tiklash yo'riqnomasi yuborildi.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Parol tiklash so'rovida xatolik yuz berdi.",
    };
  }
};