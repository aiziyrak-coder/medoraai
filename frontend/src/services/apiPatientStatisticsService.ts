import { apiGet, getAuthToken, API_BASE_URL, type ApiResponse } from './api';

export interface StatCountRow {
  key: string;
  label: string;
  count: number;
}

export interface StatAgeRow extends StatCountRow {
  min: number | null;
  max: number | null;
}

export interface StatDistrictRow {
  district_id: string;
  district_name: string;
  region_id: string;
  region_name: string;
  count: number;
}

export interface StatRegionRow {
  region_id: string;
  region_name: string;
  count: number;
}

export interface StatCodeRow {
  code: string;
  chapter_key: string;
  chapter_label: string;
  count: number;
}

export interface DiseaseCatalogItem {
  key: string;
  roman: string;
  range: string;
  label: string;
}

export interface PatientStatisticsFilters {
  region_id?: string;
  district_id?: string;
  icd_chapter?: string;
  icd_code?: string;
  age_min?: string;
  age_max?: string;
  age_group?: string;
  /** '' | 'yes' | 'no' */
  disability?: string;
  /** '1' | '2' | '3' | 'child' */
  disability_group?: string;
  /** '' | 'yes' | 'no' */
  dispensary?: string;
  health_group?: string;
  gender?: string;
  search?: string;
}

export interface PatientStatistics {
  total: number;
  summary: {
    total: number;
    disabled: number;
    dispensary: number;
    no_dispensary: number;
    distinct_codes: number;
    distinct_districts: number;
  };
  age_groups: StatAgeRow[];
  districts: StatDistrictRow[];
  regions: StatRegionRow[];
  diseases: StatCountRow[];
  top_codes: StatCodeRow[];
  disability_groups: StatCountRow[];
  health_groups: StatCountRow[];
  genders: StatCountRow[];
  filters: Record<string, string | number | null>;
  catalogs: {
    diseases: DiseaseCatalogItem[];
    age_groups: StatAgeRow[];
    disability_groups: Array<{ key: string; label: string }>;
    health_groups: Array<{ key: string; label: string }>;
  };
}

/** UI tilini backend kutayotgan 'uz' | 'ru' | 'en' ga o'giradi. */
export const statisticsLangParam = (language: string): string => {
  if (language === 'ru') return 'ru';
  if (language === 'en') return 'en';
  return 'uz';
};

const toQuery = (filters: PatientStatisticsFilters, language: string): Record<string, string> => {
  const params: Record<string, string> = { lang: statisticsLangParam(language) };
  (Object.entries(filters) as Array<[string, string | undefined]>).forEach(([key, value]) => {
    const v = (value ?? '').trim();
    if (v) params[key] = v;
  });
  return params;
};

export const getPatientStatistics = async (
  filters: PatientStatisticsFilters,
  language: string,
): Promise<ApiResponse<PatientStatistics>> => {
  const res = await apiGet<PatientStatistics | { data?: PatientStatistics }>(
    '/patients/population/statistics/',
    toQuery(filters, language),
  );
  if (!res.success) return res as ApiResponse<PatientStatistics>;
  const raw = res.data as PatientStatistics | { data?: PatientStatistics };
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data?: PatientStatistics }).data) {
    return { success: true, data: (raw as { data: PatientStatistics }).data };
  }
  return { success: true, data: raw as PatientStatistics };
};

export const exportPatientStatisticsExcel = async (
  filters: PatientStatisticsFilters,
  language: string,
): Promise<void> => {
  const query = new URLSearchParams(toQuery(filters, language)).toString();
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}/patients/population/statistics/export/?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bemorlar_statistikasi.xlsx';
  a.click();
  URL.revokeObjectURL(url);
};
