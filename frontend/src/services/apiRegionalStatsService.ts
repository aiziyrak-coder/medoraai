import { apiGet } from './api';

export interface RegionalStatsSummary {
  total_patients: number;
  total_analyses: number;
  count_last_24h: number;
  count_last_7d: number;
  count_last_30d: number;
  new_patients_30d: number;
  feedback_accuracy: number | null;
  feedback_count: number;
}

export interface RegionalDistrictStat {
  district_id: string;
  district_name: string;
  patient_count: number;
  analysis_count: number;
}

export interface RegionalStatsResponse {
  region_id: string;
  region_name: string;
  filter_district_id: string;
  summary: RegionalStatsSummary;
  gender_breakdown: Array<{ gender: string; label: string; count: number }>;
  age_breakdown: Array<{ group: string; count: number }>;
  districts: RegionalDistrictStat[];
  common_diagnoses: Array<{ name: string; count: number }>;
  weekly_activity: Array<{ date: string; count: number }>;
  monthly_trend: Array<{ month: string; count: number }>;
  clinics: Array<{ clinic_name: string; patient_count: number; analysis_count: number }>;
  generated_at: string;
}

export async function getRegionalStats(districtId?: string) {
  const url = districtId
    ? `/auth/regional-stats/overview/?district_id=${encodeURIComponent(districtId)}`
    : '/auth/regional-stats/overview/';
  return apiGet<RegionalStatsResponse>(url);
}

export async function getRegionalStatsMe() {
  return apiGet<{ name: string; phone: string; role: string; region_id: string; region_name: string }>(
    '/auth/regional-stats/me/',
  );
}
