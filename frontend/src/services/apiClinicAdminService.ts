import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type { SubscriptionStatus } from '../types';

export interface ClinicAdminStats {
  group: { id: number | null; name: string };
  members: {
    total: number;
    active: number;
    admins: number;
    roles: Array<{ role: string; count: number }>;
  };
  subscriptions: { active: number; pending: number; inactive: number };
  payments: {
    pending: number;
    approved: number;
    rejected: number;
    revenue_total_uzs: number;
    revenue_this_month_uzs: number;
  };
  sessions: { active: number };
  generated_at: string;
}

export interface ClinicAdminUser {
  id: number;
  phone: string;
  name: string;
  role: 'clinic' | 'staff';
  specialties?: string[];
  clinic_group: number | null;
  clinic_group_name: string | null;
  subscription_plan: number | null;
  subscription_plan_detail?: { id: number; name: string; slug: string } | null;
  subscription_status: SubscriptionStatus;
  subscription_expiry: string | null;
  trial_ends_at: string | null;
  has_active_subscription: boolean;
  is_clinic_group_admin: boolean;
  is_active: boolean;
  active_session_count: number;
  date_joined: string;
  last_login: string | null;
}

export interface ClinicAdminPayment {
  id: number;
  user_id: number;
  user_phone: string;
  user_name: string;
  plan_id: number | null;
  plan_name: string | null;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  receipt_note: string;
  created_at: string | null;
  reviewed_at: string | null;
}

export interface ClinicAdminMe {
  is_clinic_group_admin: boolean;
  can_manage_clinic_group: boolean;
  clinic_group_id: number | null;
  clinic_group_name: string | null;
}

export function getClinicAdminMe() {
  return apiGet<ClinicAdminMe>('/auth/clinic-admin/me/');
}

export function getClinicAdminStats() {
  return apiGet<ClinicAdminStats>('/auth/clinic-admin/stats/');
}

export function getClinicAdminUsers() {
  return apiGet<ClinicAdminUser[]>('/auth/clinic-admin/users/');
}

export function createClinicAdminUser(data: {
  phone: string;
  name: string;
  password: string;
  role: 'clinic' | 'staff';
}) {
  return apiPost<ClinicAdminUser>('/auth/clinic-admin/users/', data);
}

export function updateClinicAdminUser(
  id: number,
  data: Partial<{
    name: string;
    role: 'clinic' | 'staff';
    is_active: boolean;
    is_clinic_group_admin: boolean;
    subscription_status: SubscriptionStatus;
    subscription_expiry: string | null;
    subscription_plan: number | null;
  }>,
) {
  return apiPatch<ClinicAdminUser>(`/auth/clinic-admin/users/${id}/`, data);
}

export function deleteClinicAdminUser(id: number) {
  return apiDelete(`/auth/clinic-admin/users/${id}/`);
}

export function resetClinicAdminPassword(id: number, new_password: string) {
  return apiPost(`/auth/clinic-admin/users/${id}/reset-password/`, { new_password });
}

export function logoutClinicAdminUser(id: number) {
  return apiPost(`/auth/clinic-admin/users/${id}/logout/`, {});
}

export function activateClinicAdminSubscription(
  id: number,
  data?: { plan_id?: number; duration_days?: number },
) {
  return apiPost<ClinicAdminUser>(`/auth/clinic-admin/users/${id}/activate-subscription/`, data ?? {});
}

export function getClinicAdminPayments(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiGet<ClinicAdminPayment[]>(`/auth/clinic-admin/payments${q}`);
}
