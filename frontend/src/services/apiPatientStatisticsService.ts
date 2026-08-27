import { apiGet, getAuthToken, API_BASE_URL, type ApiResponse } from './api';

export interface StatBucket {
  label: string;
  count: number;
}

export interface IcdChapterOption {
  code: string;
  range: string;
  label: string;
}

export interface PopulationStatistics {
  total: number;
  disabled_total: number;
  dispensary_total: number;
  by_region: StatBucket[];
  by_district: StatBucket[];
  by_age_group: StatBucket[];
  by_health_group: StatBucket[];
  by_gender: StatBucket[];
  by_disability_group: StatBucket[];
  by_disease_chapter: StatBucket[];
  top_icd_codes: Array<{ code: string; count: number }>;
  icd_chapters: IcdChapterOption[];
  age_buckets: string[];
}

export interface PopulationStatisticsFilters {
  region_id?: string;
  district_id?: string;
  brigade_id?: number;
  disease_chapter?: string;
  icd_code?: string;
  age_group?: string;
  age_min?: number | string;
  age_max?: number | string;
  disability?: '' | 'yes' | 'no';
  disability_group?: string;
  dispensary?: '' | 'yes' | 'no';
  health_group?: string;
  gender?: string;
  q?: string;
  lang?: string;
}

function unwrap<T>(res: ApiResponse<T | { data?: T }>): ApiResponse<T> {
  if (!res.success) return res as ApiResponse<T>;
  const raw = res.data as T | { data?: T };
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data?: T }).data !== undefined) {
    return { success: true, data: (raw as { data: T }).data };
  }
  return { success: true, data: raw as T };
}

export const fetchPopulationStatistics = async (
  filters: PopulationStatisticsFilters = {},
): Promise<ApiResponse<PopulationStatistics>> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v));
    }
  });
  const qs = params.toString();
  const path = qs ? `/patients/population/statistics/?${qs}` : '/patients/population/statistics/';
  const res = await apiGet<PopulationStatistics | { data: PopulationStatistics }>(path);
  return unwrap(res);
};

export const exportPopulationStatisticsExcel = async (
  filters: PopulationStatisticsFilters = {},
): Promise<void> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v));
    }
  });
  const token = getAuthToken();
  const url = `${API_BASE_URL}/patients/population/statistics/export/?${params.toString()}`;
  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error('Eksport xatolik');
  const blob = await resp.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bemorlar_statistika.xlsx';
  a.click();
  URL.revokeObjectURL(a.href);
};
