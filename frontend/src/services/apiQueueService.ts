/**
 * Navbat API — server orqali navbat (barcha qurilmalarda sinxron).
 * queueService.ts API mavjud va token bor bo'lsa shu xizmatni chaqiradi.
 */
import type { PatientQueueItem } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';

const QUEUE_BASE = '/auth/queue';

export interface QueueListResponse {
  success: boolean;
  data?: PatientQueueItem[];
  error?: { code: number; message: string };
}

export interface QueueAddPayload {
  firstName: string;
  lastName: string;
  age: string;
  address?: string;
  complaints?: string;
  arrivalTime?: string;
}

/** Navbat ro'yxatini serverdan olish */
export const apiGetQueue = async (): Promise<{ ok: boolean; data?: PatientQueueItem[]; error?: string }> => {
  const res = await apiGet<PatientQueueItem[]>(QUEUE_BASE + '/');
  if (!res.success || res.data === undefined) {
    return { ok: false, error: res.error?.message || 'Navbat yuklanmadi' };
  }
  return { ok: true, data: res.data };
};

/** Navbatga bemor qo'shish */
export const apiAddToQueue = async (
  payload: QueueAddPayload
): Promise<{ ok: boolean; data?: PatientQueueItem; error?: string }> => {
  const res = await apiPost<PatientQueueItem>(QUEUE_BASE + '/add/', payload);
  if (!res.success || res.data === undefined) {
    return { ok: false, error: res.error?.message || 'Qo\'shish amalga oshmadi' };
  }
  return { ok: true, data: res.data };
};

/** Navbat elementini yangilash (status yoki boshqa maydonlar) */
export const apiUpdateQueueItem = async (
  itemId: string,
  updates: { status?: PatientQueueItem['status'] } & Partial<Pick<PatientQueueItem, 'firstName' | 'lastName' | 'age' | 'address' | 'complaints'>>
): Promise<{ ok: boolean; data?: PatientQueueItem; error?: string }> => {
  const res = await apiPatch<PatientQueueItem>(QUEUE_BASE + `/${itemId}/`, updates);
  if (!res.success || res.data === undefined) {
    return { ok: false, error: res.error?.message || 'Yangilash amalga oshmadi' };
  }
  return { ok: true, data: res.data };
};

/** Navbatdan o'chirish */
export const apiRemoveFromQueue = async (itemId: string): Promise<{ ok: boolean; error?: string }> => {
  const res = await apiDelete<unknown>(QUEUE_BASE + `/${itemId}/`);
  if (!res.success) {
    return { ok: false, error: res.error?.message || 'O\'chirish amalga oshmadi' };
  }
  return { ok: true };
};
