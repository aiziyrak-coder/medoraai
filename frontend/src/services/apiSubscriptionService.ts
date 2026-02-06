/**
 * Obuna (SaaS) API servisi
 */
import { apiGet, type ApiResponse } from './api';
import type { SubscriptionPlan, MySubscription } from '../types';

/** Barcha faol obuna rejalari */
export const getSubscriptionPlans = async (): Promise<ApiResponse<SubscriptionPlan[]>> => {
  return apiGet<SubscriptionPlan[]>('/auth/plans/');
};

/** Joriy foydalanuvchi obunasi (token kerak) */
export const getMySubscription = async (): Promise<ApiResponse<MySubscription>> => {
  return apiGet<MySubscription>('/auth/subscription/');
};
