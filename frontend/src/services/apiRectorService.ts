import { apiGet } from './api';

export interface RectorStatsResponse {
  users: {
    total: number;
    new_last_30_days: number;
    roles: Array<{ role: string; count: number }>;
  };
  subscriptions: {
    active: number;
    pending: number;
  };
  payments: {
    pending: number;
    rejected: number;
    revenue_total_uzs: number;
    revenue_this_month_uzs: number;
    approved_by_plan: Array<{ plan__name: string | null; count: number; amount: number }>;
  };
  generated_at: string;
}

export async function getRectorStats() {
  return apiGet<RectorStatsResponse>('/auth/rektorga/stats/');
}
