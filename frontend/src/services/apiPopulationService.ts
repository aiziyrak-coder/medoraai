import {
  apiGet, apiPost, apiPatch, apiDelete, apiUpload, getAuthToken, API_BASE_URL,
  type ApiResponse,
} from './api';

export interface PopulationRecord {
  id: number;
  registry_number: string;
  first_name: string;
  last_name: string;
  father_name?: string;
  age: string;
  gender: '' | 'male' | 'female' | 'other';
  gender_label?: string;
  phone?: string;
  address?: string;
  region_id?: string;
  district_id?: string;
  region_name?: string;
  district_name?: string;
  anamnesis?: string;
  birth_date?: string | null;
  health_group?: string;
  brigade?: number | null;
  brigade_name?: string;
  next_checkup_date?: string | null;
  last_checkup_date?: string | null;
  dispensary_registered?: boolean;
  risk_pregnant?: boolean;
  risk_disabled?: boolean;
  risk_chronic?: boolean;
  risk_social_vulnerable?: boolean;
  risk_lone_elderly?: boolean;
  risk_needs_care?: boolean;
  primary_care_sync?: {
    brigade_assigned?: number | null;
    brigade_name?: string;
    screening_enrolled?: number;
    next_checkup_date?: string | null;
    health_group?: string;
  } | null;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PopulationImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

function unwrapOne<T>(res: ApiResponse<T | { data?: T }>): ApiResponse<T> {
  if (!res.success) return res as ApiResponse<T>;
  const raw = res.data as T | { data?: T };
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data?: T }).data !== undefined) {
    return { success: true, data: (raw as { data: T }).data };
  }
  return { success: true, data: raw as T };
}

function unwrapList<T>(res: ApiResponse<T[] | { data?: T[]; results?: T[] }>): ApiResponse<T[]> {
  if (!res.success) return res as ApiResponse<T[]>;
  const raw = res.data;
  if (Array.isArray(raw)) return { success: true, data: raw };
  if (raw && typeof raw === 'object') {
    if (Array.isArray((raw as { results?: T[] }).results)) {
      return { success: true, data: (raw as { results: T[] }).results };
    }
    if (Array.isArray((raw as { data?: T[] }).data)) {
      return { success: true, data: (raw as { data: T[] }).data };
    }
  }
  return { success: false, error: { code: 0, message: 'Ro\'yxat yuklanmadi' } };
}

export const listPopulation = async (params?: {
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<ApiResponse<PopulationRecord[]>> => {
  const q: Record<string, string> = {};
  if (params?.search) q.search = params.search;
  if (params?.page) q.page = String(params.page);
  if (params?.page_size) q.page_size = String(params.page_size);
  return unwrapList(await apiGet<PopulationRecord[] | { results?: PopulationRecord[] }>('/patients/population/', q));
};

export const createPopulation = async (
  payload: Partial<PopulationRecord> & { first_name: string; last_name: string; registry_number: string },
): Promise<ApiResponse<PopulationRecord>> =>
  unwrapOne(await apiPost<PopulationRecord | { data?: PopulationRecord }>('/patients/population/', payload));

export const updatePopulation = async (
  id: number,
  payload: Partial<PopulationRecord>,
): Promise<ApiResponse<PopulationRecord>> =>
  unwrapOne(await apiPatch<PopulationRecord | { data?: PopulationRecord }>(`/patients/population/${id}/`, payload));

export const deletePopulation = async (id: number): Promise<ApiResponse<void>> =>
  apiDelete<void>(`/patients/population/${id}/`);

export const searchPopulation = async (q: string): Promise<ApiResponse<PopulationRecord[]>> => {
  const query = q.trim();
  if (!query) return { success: true, data: [] };
  return unwrapList(
    await apiGet<PopulationRecord[] | { data?: PopulationRecord[] }>('/patients/population/search/', { q: query }),
  );
};

export const importPopulationExcel = async (file: File): Promise<ApiResponse<PopulationImportStats>> =>
  unwrapOne(
    await apiUpload<PopulationImportStats | { data?: PopulationImportStats }>(
      '/patients/population/import-excel/',
      file,
    ),
  );

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Yuklab olish muvaffaqiyatsiz');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportPopulationExcel = () => downloadFile('/patients/population/export-excel/', 'aholi.xlsx');
export const exportPopulationTemplate = () => downloadFile('/patients/population/export-template/', 'aholi_shablon.xlsx');

export interface PopulationPrimaryCareProfile {
  population: {
    id: number;
    registry_number: string;
    first_name: string;
    last_name: string;
    father_name?: string;
    age: string;
    age_years?: number | null;
    birth_date?: string | null;
    gender: string;
    phone?: string;
    address?: string;
    region_id?: string;
    district_id?: string;
    health_group?: string;
    health_group_label?: string;
    next_checkup_date?: string | null;
    last_checkup_date?: string | null;
    dispensary_registered?: boolean;
    overdue_checkup?: boolean;
    checkups_required_year?: number;
    checkups_done_year?: number;
    brigade?: { id: number | null; name: string };
    risk_pregnant?: boolean;
    risk_disabled?: boolean;
    risk_chronic?: boolean;
    risk_social_vulnerable?: boolean;
    risk_lone_elderly?: boolean;
    risk_needs_care?: boolean;
  };
  checkups: Array<Record<string, unknown>>;
  screening: Array<Record<string, unknown>>;
  patronage: Array<Record<string, unknown>>;
  dispensary: Array<Record<string, unknown>>;
  families: Array<Record<string, unknown>>;
  network_plan?: Record<string, unknown> | null;
  eligible_screening_programs: Array<{ id: number; code: string; name: string }>;
  generated_at: string;
}

export const getPopulationPrimaryCareProfile = async (id: number) => {
  const res = await apiGet<{ success?: boolean; data?: PopulationPrimaryCareProfile } | PopulationPrimaryCareProfile>(
    `/patients/population/${id}/primary-care-profile/`,
  );
  if (!res.success) return res as ApiResponse<PopulationPrimaryCareProfile>;
  const raw = res.data;
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data?: PopulationPrimaryCareProfile }).data) {
    return { success: true, data: (raw as { data: PopulationPrimaryCareProfile }).data };
  }
  return { success: true, data: raw as PopulationPrimaryCareProfile };
};

export const syncPopulationPrimaryCare = async (id: number): Promise<ApiResponse<{ sync?: unknown; profile?: PopulationPrimaryCareProfile }>> => {
  const res = await apiPost<{ sync?: unknown; profile?: PopulationPrimaryCareProfile } | { data?: { sync?: unknown; profile?: PopulationPrimaryCareProfile } }>(
    `/patients/population/${id}/sync-primary-care/`,
    {},
  );
  if (!res.success) return res as ApiResponse<{ sync?: unknown; profile?: PopulationPrimaryCareProfile }>;
  const raw = res.data;
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data?: { sync?: unknown; profile?: PopulationPrimaryCareProfile } }).data) {
    return { success: true, data: (raw as { data: { sync?: unknown; profile?: PopulationPrimaryCareProfile } }).data };
  }
  return { success: true, data: raw as { sync?: unknown; profile?: PopulationPrimaryCareProfile } };
};
