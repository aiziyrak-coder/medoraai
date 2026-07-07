import { apiGet, apiPost, apiPatch, apiDelete, getAuthToken, getOrCreateDeviceId, API_BASE_URL, type ApiResponse } from './api';

export interface MedicalBrigade {
  id: number;
  name: string;
  code?: string;
  region_id?: string;
  district_id?: string;
  leader?: number | null;
  leader_name?: string;
  target_population_size: number;
  assigned_count?: number;
  notes?: string;
  is_active: boolean;
}

export interface PreventiveCheckup {
  id: number;
  population: number;
  population_name?: string;
  brigade?: number | null;
  brigade_name?: string;
  checkup_type: string;
  checkup_date: string;
  health_group?: string;
  location?: string;
  height_cm?: string | null;
  weight_kg?: string | null;
  waist_cm?: string | null;
  bmi?: string | null;
  blood_pressure?: string;
  risk_factors?: Record<string, unknown>;
  new_diagnoses?: string;
  existing_diagnoses?: string;
  recommendations?: string;
  tactics?: string;
  next_checkup_date?: string | null;
}

export interface ScreeningProgram {
  id: number;
  code: string;
  name: string;
  description?: string;
  target_gender?: string;
  age_min: number;
  age_max: number;
  frequency_months: number;
  is_active: boolean;
}

export interface ScreeningEnrollment {
  id: number;
  population: number;
  population_name?: string;
  program: number;
  program_name?: string;
  brigade?: number | null;
  status: string;
  planned_date?: string | null;
  exclude_reason?: string;
}

export interface PatronageVisit {
  id: number;
  population: number;
  population_name?: string;
  brigade?: number | null;
  visit_date: string;
  visit_type: string;
  purpose?: string;
  findings?: string;
  recommendations?: string;
}

export interface NetworkPlan {
  id: number;
  brigade: number;
  brigade_name?: string;
  plan_level: string;
  year: number;
  month?: number | null;
  week_number?: number | null;
  title?: string;
  targets?: Record<string, number>;
  completed?: Record<string, number>;
  notes?: string;
}

export interface DispensaryRecord {
  id: number;
  population: number;
  population_name?: string;
  brigade?: number | null;
  diagnosis: string;
  icd10_code?: string;
  registered_date: string;
  health_improvement_plan?: string;
  form30_data?: Record<string, unknown>;
  visit_frequency?: string;
  next_visit_date?: string | null;
  is_active: boolean;
}

export interface FamilyPassportMember {
  id: number;
  family: number;
  population: number;
  population_name?: string;
  relation: string;
}

export interface FamilyPassport {
  id: number;
  passport_number: string;
  address?: string;
  region_id?: string;
  district_id?: string;
  head?: number | null;
  head_name?: string;
  notes?: string;
  members?: FamilyPassportMember[];
}

export interface ScreeningResult {
  result_date: string;
  result_status: string;
  lab_data?: Record<string, unknown>;
  referral_specialist?: string;
  notes?: string;
}

export interface PrimaryCareStats {
  population_total: number;
  with_brigade: number;
  checkups_ytd: number;
  patronage_visits_ytd: number;
  screening_completed: number;
  screening_planned: number;
  dispensary_active: number;
  overdue_checkups: number;
  needs_setup?: boolean;
  workflow?: Array<{ step: number; title: string; description: string; action: string }>;
  overdue_population?: Array<{
    id: number; last_name: string; first_name: string; registry_number: string; next_checkup_date: string;
  }>;
  health_groups: Array<{ health_group: string; health_group_label?: string; count: number }>;
  risk_groups: Record<string, number>;
  brigades: Array<{
    id: number; name: string; assigned_population: number; target: number;
    plans_count: number; plan_completion_pct?: number; targets?: Record<string, number>; completed?: Record<string, number>;
  }>;
  generated_at: string;
}

function unwrapList<T>(res: ApiResponse<T[] | { results?: T[]; data?: T[] }>): ApiResponse<T[]> {
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

function unwrapOne<T>(res: ApiResponse<T | { data?: T }>): ApiResponse<T> {
  if (!res.success) return res as ApiResponse<T>;
  const raw = res.data as T | { data?: T };
  if (raw && typeof raw === 'object' && 'data' in raw && (raw as { data?: T }).data !== undefined) {
    return { success: true, data: (raw as { data: T }).data };
  }
  return { success: true, data: raw as T };
}

const BASE = '/patients/primary-care';

export const getPrimaryCareStats = async (params?: { region_id?: string; district_id?: string; brigade_id?: number }) => {
  const q: Record<string, string> = {};
  if (params?.region_id) q.region_id = params.region_id;
  if (params?.district_id) q.district_id = params.district_id;
  if (params?.brigade_id) q.brigade_id = String(params.brigade_id);
  return unwrapOne<PrimaryCareStats>(await apiGet(`${BASE}/stats/overview/`, Object.keys(q).length ? q : undefined));
};

export const setupPrimaryCare = async () =>
  unwrapOne<{
    brigade_created?: number | null;
    brigade_name?: string;
    population_synced?: number;
    screening_programs?: number;
    stats?: PrimaryCareStats;
    workflow?: PrimaryCareStats['workflow'];
  }>(await apiPost(`${BASE}/stats/setup/`, {}));

export const listBrigades = async () =>
  unwrapList<MedicalBrigade>(await apiGet(`${BASE}/brigades/`));

export const listBrigadeStaffOptions = async () =>
  unwrapList<{ id: number; name: string }>(await apiGet(`${BASE}/brigades/staff-options/`));

export const createBrigade = async (payload: Partial<MedicalBrigade>) =>
  unwrapOne(await apiPost<MedicalBrigade>(`${BASE}/brigades/`, payload));

export const updateBrigade = async (id: number, payload: Partial<MedicalBrigade>) =>
  unwrapOne(await apiPatch<MedicalBrigade>(`${BASE}/brigades/${id}/`, payload));

export const deleteBrigade = async (id: number) => apiDelete(`${BASE}/brigades/${id}/`);

export const listCheckups = async (params?: { population?: number; brigade?: number }) => {
  const q: Record<string, string> = {};
  if (params?.population) q.population = String(params.population);
  if (params?.brigade) q.brigade = String(params.brigade);
  return unwrapList<PreventiveCheckup>(await apiGet(`${BASE}/checkups/`, Object.keys(q).length ? q : undefined));
};

export const createCheckup = async (payload: Partial<PreventiveCheckup>) =>
  unwrapOne(await apiPost<PreventiveCheckup>(`${BASE}/checkups/`, payload));

export const deleteCheckup = async (id: number) => apiDelete(`${BASE}/checkups/${id}/`);

export const listScreeningPrograms = async () =>
  unwrapList<ScreeningProgram>(await apiGet(`${BASE}/screening-programs/`));

export const seedScreeningPrograms = async () =>
  apiPost(`${BASE}/screening-programs/seed-defaults/`, {});

export const listScreeningEnrollments = async (params?: { population?: number; brigade?: number; status?: string }) => {
  const q: Record<string, string> = {};
  if (params?.population) q.population = String(params.population);
  if (params?.brigade) q.brigade = String(params.brigade);
  if (params?.status) q.status = params.status;
  return unwrapList<ScreeningEnrollment>(await apiGet(`${BASE}/screening-enrollments/`, Object.keys(q).length ? q : undefined));
};

export const updateScreeningEnrollment = async (id: number, payload: Partial<ScreeningEnrollment>) =>
  unwrapOne(await apiPatch<ScreeningEnrollment>(`${BASE}/screening-enrollments/${id}/`, payload));

export const recordScreeningResult = async (enrollmentId: number, payload: Partial<ScreeningResult>) =>
  unwrapOne(await apiPost<{ data?: ScreeningResult; enrollment?: ScreeningEnrollment }>(
    `${BASE}/screening-enrollments/${enrollmentId}/record-result/`,
    payload,
  ));

export const createScreeningEnrollment = async (payload: Partial<ScreeningEnrollment>) =>
  unwrapOne(await apiPost<ScreeningEnrollment>(`${BASE}/screening-enrollments/`, payload));

export const autoEnrollScreening = async (populationId: number) =>
  unwrapOne<{ created: number; population_id: number }>(
    await apiPost<{ created: number; population_id: number } | { data?: { created: number; population_id: number } }>(
      `${BASE}/screening-enrollments/auto-enroll/`,
      { population_id: populationId },
    ),
  );

export const listPatronage = async (params?: { population?: number; brigade?: number }) => {
  const q: Record<string, string> = {};
  if (params?.population) q.population = String(params.population);
  if (params?.brigade) q.brigade = String(params.brigade);
  return unwrapList<PatronageVisit>(await apiGet(`${BASE}/patronage/`, Object.keys(q).length ? q : undefined));
};

export const listPatronageVisits = listPatronage;

export const createPatronage = async (payload: Partial<PatronageVisit>) =>
  unwrapOne(await apiPost<PatronageVisit>(`${BASE}/patronage/`, payload));

export const deletePatronage = async (id: number) => apiDelete(`${BASE}/patronage/${id}/`);

export const listNetworkPlans = async () =>
  unwrapList<NetworkPlan>(await apiGet(`${BASE}/network-plans/`));

export const createNetworkPlan = async (payload: Partial<NetworkPlan>) =>
  unwrapOne(await apiPost<NetworkPlan>(`${BASE}/network-plans/`, payload));

export const deleteNetworkPlan = async (id: number) => apiDelete(`${BASE}/network-plans/${id}/`);

export const refreshNetworkPlan = async (id: number) =>
  unwrapOne(await apiPost<NetworkPlan>(`${BASE}/network-plans/${id}/refresh-completed/`, {}));

export const listDispensary = async (params?: { population?: number; brigade?: number; is_active?: boolean | string }) => {
  const q: Record<string, string> = {};
  if (params?.population) q.population = String(params.population);
  if (params?.brigade) q.brigade = String(params.brigade);
  if (params?.is_active !== undefined) q.is_active = String(params.is_active);
  return unwrapList<DispensaryRecord>(await apiGet(`${BASE}/dispensary/`, Object.keys(q).length ? q : undefined));
};

export const createDispensary = async (payload: Partial<DispensaryRecord>) =>
  unwrapOne(await apiPost<DispensaryRecord>(`${BASE}/dispensary/`, payload));

export const deleteDispensary = async (id: number) => apiDelete(`${BASE}/dispensary/${id}/`);

export const listFamilyPassports = async () =>
  unwrapList<FamilyPassport>(await apiGet(`${BASE}/family-passports/`));

export const createFamilyPassport = async (payload: Partial<FamilyPassport>) =>
  unwrapOne(await apiPost<FamilyPassport>(`${BASE}/family-passports/`, payload));

export const createFamilyMember = async (payload: { family: number; population: number; relation: string }) =>
  unwrapOne(await apiPost<FamilyPassportMember>(`${BASE}/family-members/`, payload));

export const deleteFamilyMember = async (id: number) => apiDelete(`${BASE}/family-members/${id}/`);

export const updateDispensary = async (id: number, payload: Partial<DispensaryRecord>) =>
  unwrapOne(await apiPatch<DispensaryRecord>(`${BASE}/dispensary/${id}/`, payload));

export const deleteFamilyPassport = async (id: number) => apiDelete(`${BASE}/family-passports/${id}/`);

export const exportPrimaryCareReport = async (params?: { brigade_id?: number }): Promise<void> => {
  const token = getAuthToken();
  const deviceId = getOrCreateDeviceId();
  const qs = new URLSearchParams();
  if (params?.brigade_id) qs.set('brigade_id', String(params.brigade_id));
  const endpoint = `${API_BASE_URL}${BASE}/stats/export-report/`;
  const url = qs.toString() ? `${endpoint}?${qs.toString()}` : endpoint;
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
    },
  });
  if (!res.ok) throw new Error('Hisobot yuklab olish muvaffaqiyatsiz');
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = '210_hisobot.xlsx';
  a.click();
  URL.revokeObjectURL(blobUrl);
};

export const LOCATION_TYPES = [
  { value: 'clinic', label: 'Poliklinika' },
  { value: 'home', label: 'Uyda' },
  { value: 'school', label: 'Maktab/MTT' },
];

export const joinFamilyPassport = async (payload: { passport_number: string; population_id: number; relation: string }) =>
  unwrapOne(await apiPost<{ family: FamilyPassport; member: FamilyPassportMember }>(`${BASE}/family-passports/join/`, payload));

export const healthGroupLabel = (code: string) =>
  HEALTH_GROUPS.find((g) => g.value === code)?.label || code || '—';

export const planMetricLabel = (key: string) => {
  const map: Record<string, string> = {
    checkups: 'Ko\'riklar',
    patronage: 'Patronaj',
    screening: 'Skrining',
    dispensary_visits: 'Dispanser',
  };
  return map[key] || key;
};

export const FAMILY_RELATIONS = [
  { value: 'head', label: 'Boshliq' },
  { value: 'spouse', label: 'Turmush o\'rtog\'i' },
  { value: 'child', label: 'Farzand' },
  { value: 'parent', label: 'Ota-ona' },
  { value: 'other', label: 'Boshqa' },
];

export const HEALTH_GROUPS = [
  { value: '1', label: 'I — Tayanch' },
  { value: '2', label: 'II — Past xavf' },
  { value: '3', label: 'III — O\'rta xavf' },
  { value: '4', label: 'IV — Yuqori xavf' },
  { value: 'child_1', label: 'Bola I' },
  { value: 'child_2', label: 'Bola II' },
  { value: 'child_3', label: 'Bola III' },
];

export const CHECKUP_TYPES = [
  { value: 'preventive', label: 'Profilaktik ko\'rik' },
  { value: 'in_depth', label: 'Chuqurlashtirilgan' },
  { value: 'targeted', label: 'Maqsadli' },
  { value: 'dispensary', label: 'Dispanser' },
];

export const PATRONAGE_TYPES = [
  { value: 'universal_progressive', label: 'Universal-progressiv' },
  { value: 'routine', label: 'Rejadagi' },
  { value: 'high_risk', label: 'Yuqori xavf' },
  { value: 'home_hospital', label: 'Uy shifoxonasi' },
];

export const PLAN_LEVELS = [
  { value: 'annual', label: 'Yillik' },
  { value: 'monthly', label: 'Oylik' },
  { value: 'weekly', label: 'Haftalik' },
];

export const SCREENING_STATUSES = [
  { value: 'planned', label: 'Rejada' },
  { value: 'invited', label: 'Taklif' },
  { value: 'completed', label: 'Bajarilgan' },
  { value: 'excluded', label: 'Chiqarilgan' },
];
