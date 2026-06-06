/**
 * Patient API Service
 */
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload, type ApiResponse } from './api';
import type { ImagingStudyRecord, PatientData, UziUttReport } from '../types';

export interface Patient {
  id: number;
  registry_number: string;
  first_name: string;
  last_name: string;
  father_name?: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  phone?: string;
  address?: string;
  region_id?: string;
  district_id?: string;
  region_name?: string;
  district_name?: string;
  complaints: string;
  history?: string;
  objective_data?: string;
  lab_results?: string;
  allergies?: string;
  current_medications?: string;
  family_history?: string;
  additional_info?: string;
  structured_lab_results?: Record<string, unknown>;
  pharmacogenomics_report?: string;
  symptom_timeline?: unknown[];
  mental_health_scores?: Record<string, unknown>;
  attachments?: PatientAttachment[];
  created_by?: unknown;
  created_at: string;
  updated_at: string;
}

export interface PatientPassport {
  id: number;
  registry_number: string;
  first_name: string;
  last_name: string;
  father_name?: string;
  age: string;
  gender: string;
  phone: string;
  address: string;
  region_id: string;
  district_id: string;
  region_name: string;
  district_name: string;
  registered_by?: string;
  created_at?: string;
  updated_at?: string;
  analysis_count?: number;
  can_view_clinical?: boolean;
}

export interface PatientAttachment {
  id: number;
  name: string;
  file: string;
  mime_type: string;
  uploaded_at: string;
}

export interface PatientListParams {
  page?: number;
  page_size?: number;
  search?: string;
  patient_id?: number;
  gender?: string;
  ordering?: string;
}

export interface ClinicalTimelineAnalysis {
  id: number;
  date: string;
  physician?: string;
  complaints?: string;
  consensus_diagnoses?: string[];
  justification?: string;
  treatment_plan?: string[];
  recommended_tests?: string[];
  medications?: string[];
  follow_up?: string;
}

export interface SmartPatientHit extends PatientPassport {
  last_analysis_at: string;
  last_diagnosis: string;
  last_complaint: string;
  last_physician: string;
}

export interface DistrictSearchHit {
  district_id: string;
  district_name_uz: string;
  district_name_ru: string;
  region_id: string;
  region_name_uz: string;
  region_name_ru: string;
}

export interface RegionLocationStat {
  region_id: string;
  region_name: string;
  count: number;
}

export interface DistrictLocationStat {
  district_id: string;
  district_name: string;
  region_id: string;
  region_name: string;
  count: number;
}

export interface LocationStatsPayload {
  regions: RegionLocationStat[];
  districts: DistrictLocationStat[];
}

/** @deprecated use LocationStatsPayload */
export type LocationStat = RegionLocationStat;

export interface ClinicalTimeline {
  patient: Patient;
  analyses: ClinicalTimelineAnalysis[];
  analysis_count: number;
}

const patientDataToApi = (data: PatientData): Partial<Patient> => ({
  first_name: data.firstName,
  last_name: data.lastName,
  father_name: data.fatherName,
  age: data.age,
  gender: data.gender as 'male' | 'female' | 'other' | '',
  phone: data.phone,
  address: data.address,
  region_id: data.regionId,
  district_id: data.districtId,
  complaints: data.complaints,
  history: data.history,
  objective_data: data.objectiveData,
  lab_results: data.labResults,
  allergies: data.allergies,
  current_medications: data.currentMedications,
  family_history: data.familyHistory,
  additional_info: data.additionalInfo,
  structured_lab_results: data.structuredLabResults,
  pharmacogenomics_report: data.pharmacogenomicsReport,
  symptom_timeline: data.symptomTimeline,
  mental_health_scores: data.mentalHealthScores,
});

const apiToPatientData = (patient: Patient): PatientData => ({
  firstName: patient.first_name,
  lastName: patient.last_name,
  fatherName: patient.father_name,
  age: patient.age,
  gender: patient.gender,
  phone: patient.phone,
  address: patient.address,
  regionId: patient.region_id,
  districtId: patient.district_id,
  regionName: patient.region_name,
  districtName: patient.district_name,
  complaints: patient.complaints || '',
  history: patient.history,
  objectiveData: patient.objective_data,
  labResults: patient.lab_results,
  allergies: patient.allergies,
  currentMedications: patient.current_medications,
  familyHistory: patient.family_history,
  additionalInfo: patient.additional_info,
  structuredLabResults: patient.structured_lab_results as PatientData['structuredLabResults'],
  pharmacogenomicsReport: patient.pharmacogenomics_report,
  symptomTimeline: patient.symptom_timeline as PatientData['symptomTimeline'],
  mentalHealthScores: patient.mental_health_scores as PatientData['mentalHealthScores'],
  attachments: patient.attachments?.map((att) => ({
    name: att.name,
    base64Data: '',
    mimeType: att.mime_type,
  })),
});

export const passportToPatientData = (p: PatientPassport): PatientData => ({
  firstName: p.first_name,
  lastName: p.last_name,
  fatherName: p.father_name,
  age: p.age,
  gender: (p.gender as PatientData['gender']) || '',
  phone: p.phone,
  address: p.address,
  regionId: p.region_id,
  districtId: p.district_id,
  regionName: p.region_name,
  districtName: p.district_name,
  complaints: '',
  history: '',
  allergies: '',
  currentMedications: '',
  familyHistory: '',
  additionalInfo: '',
  labResults: '',
});

function unwrapArray<T>(res: ApiResponse<T[] | { data?: T[] }>): ApiResponse<T[]> {
  if (!res.success) return res as ApiResponse<T[]>;
  const d = res.data;
  if (Array.isArray(d)) return { ...res, data: d };
  if (d && typeof d === 'object' && Array.isArray((d as { data?: T[] }).data)) {
    return { ...res, data: (d as { data: T[] }).data };
  }
  return { ...res, data: [] };
}

function unwrapOne<T>(res: ApiResponse<T | { data?: T }>): ApiResponse<T> {
  if (!res.success || res.data == null) return res as ApiResponse<T>;
  const d = res.data;
  if (d && typeof d === 'object' && 'data' in (d as object) && (d as { data?: T }).data != null) {
    return { ...res, data: (d as { data: T }).data };
  }
  return res as ApiResponse<T>;
}

export const getPatients = async (params?: PatientListParams): Promise<ApiResponse<Patient[]>> => {
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams.page = params.page.toString();
  if (params?.page_size) queryParams.page_size = params.page_size.toString();
  if (params?.search) queryParams.search = params.search;
  if (params?.patient_id) queryParams.patient_id = params.patient_id.toString();
  if (params?.gender) queryParams.gender = params.gender;
  if (params?.ordering) queryParams.ordering = params.ordering;
  const res = await apiGet<Patient[] | { results?: Patient[] }>('/patients/', queryParams);
  if (!res.success || res.data == null) return res as ApiResponse<Patient[]>;
  const d = res.data;
  if (Array.isArray(d)) return { ...res, data: d };
  if (typeof d === 'object' && d && 'results' in d && Array.isArray((d as { results: Patient[] }).results)) {
    return { ...res, data: (d as { results: Patient[] }).results };
  }
  return { ...res, data: [] };
};

export const getPatient = async (id: number): Promise<ApiResponse<Patient>> =>
  apiGet<Patient>(`/patients/${id}/`);

export const getPatientPassport = async (id: number): Promise<ApiResponse<PatientPassport>> =>
  unwrapOne(await apiGet<PatientPassport | { data?: PatientPassport }>(`/patients/${id}/passport/`));

export const createPatient = async (data: PatientData): Promise<ApiResponse<Patient>> =>
  apiPost<Patient>('/patients/', patientDataToApi(data));

export const updatePatient = async (id: number, data: Partial<PatientData>): Promise<ApiResponse<Patient>> =>
  apiPatch<Patient>(`/patients/${id}/`, patientDataToApi(data as PatientData));

export const deletePatient = async (id: number): Promise<ApiResponse<void>> =>
  apiDelete<void>(`/patients/${id}/`);

export const uploadPatientAttachment = async (
  patientId: number,
  file: File,
): Promise<ApiResponse<PatientAttachment>> =>
  apiUpload<PatientAttachment>(`/patients/${patientId}/upload-attachment/`, file);

export const deletePatientAttachment = async (
  patientId: number,
  attachmentId: number,
): Promise<ApiResponse<void>> =>
  apiDelete<void>(`/patients/${patientId}/attachments/${attachmentId}/`);

export const convertPatientToPatientData = apiToPatientData;

export const registerPatientPassport = async (
  payload: Partial<PatientPassport> & {
    first_name: string;
    last_name: string;
    age: string;
  },
): Promise<ApiResponse<PatientPassport>> =>
  unwrapOne(await apiPost<PatientPassport | { data?: PatientPassport }>('/patients/registry/', payload));

export const registrySearchPatients = async (q: string): Promise<ApiResponse<PatientPassport[]>> => {
  const query = q.trim();
  if (!query) return { success: true, data: [] };
  return unwrapArray(await apiGet<PatientPassport[] | { data?: PatientPassport[] }>('/patients/registry-search/', { q: query }));
};

export interface AddressDistrictOption {
  id: string;
  region_id: string;
  name_uz: string;
  name_ru: string;
  name_en?: string;
}

export interface AddressRegionOption {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en?: string;
  districts: AddressDistrictOption[];
}

export const getAddressCatalog = async (): Promise<ApiResponse<AddressRegionOption[]>> => {
  const res = await apiGet<AddressRegionOption[] | { data?: AddressRegionOption[] }>('/patients/regions/');
  return unwrapArray(res);
};

export const searchDistricts = async (q: string): Promise<ApiResponse<DistrictSearchHit[]>> => {
  if (!q.trim()) return { success: true, data: [] };
  return unwrapArray(await apiGet<DistrictSearchHit[] | { data?: DistrictSearchHit[] }>('/patients/district-search/', { q }));
};

export const getLocationStats = async (): Promise<ApiResponse<LocationStatsPayload>> => {
  const res = await apiGet<LocationStatsPayload | { data?: LocationStatsPayload }>('/patients/location-stats/');
  if (!res.success || res.data == null) return res as ApiResponse<LocationStatsPayload>;
  const d = res.data;
  if (d && typeof d === 'object' && 'regions' in d && 'districts' in d) {
    return { ...res, data: d as LocationStatsPayload };
  }
  if (d && typeof d === 'object' && (d as { data?: LocationStatsPayload }).data) {
    return { ...res, data: (d as { data: LocationStatsPayload }).data };
  }
  // Eski API formati (faqat viloyat ro'yxati)
  if (Array.isArray(d)) {
    return { ...res, data: { regions: d as RegionLocationStat[], districts: [] } };
  }
  return { ...res, data: { regions: [], districts: [] } };
};

export const findPatientMatches = async (
  firstName: string,
  lastName: string,
  phone?: string,
  fatherName?: string,
): Promise<ApiResponse<Patient[]>> => {
  const queryParams: Record<string, string> = {};
  const fn = firstName.trim();
  const ln = lastName.trim();
  if (fn) queryParams.first_name = fn;
  if (ln) queryParams.last_name = ln;
  if (phone?.trim()) queryParams.phone = phone.trim();
  if (fatherName?.trim()) queryParams.father_name = fatherName.trim();
  return unwrapArray(await apiGet<Patient[] | { data?: Patient[] }>('/patients/match/', queryParams));
};

export const getPatientClinicalTimeline = async (
  patientId: number,
  limit = 200,
): Promise<ApiResponse<ClinicalTimeline>> => {
  const res = await apiGet<ClinicalTimeline | { data?: ClinicalTimeline }>(
    `/patients/${patientId}/clinical-timeline/`,
    { limit: String(limit) },
  );
  if (!res.success || !res.data) return res as ApiResponse<ClinicalTimeline>;
  const d = res.data;
  if (d && typeof d === 'object' && 'patient' in d && 'analyses' in d) {
    return { ...res, data: d as ClinicalTimeline };
  }
  if (d && typeof d === 'object' && (d as { data?: ClinicalTimeline }).data) {
    return { ...res, data: (d as { data: ClinicalTimeline }).data };
  }
  return res as ApiResponse<ClinicalTimeline>;
};

export const smartSearchPatients = async (q: string): Promise<ApiResponse<SmartPatientHit[]>> => {
  const query = q.trim();
  if (!query) return { success: true, data: [] };
  return unwrapArray(await apiGet<SmartPatientHit[] | { data?: SmartPatientHit[] }>('/patients/smart-search/', { q: query }));
};

export const getRecentImagingStudies = async (
  patientId: number,
  days = 30,
): Promise<ApiResponse<ImagingStudyRecord[]>> => {
  const res = await apiGet<ImagingStudyRecord[] | { data?: ImagingStudyRecord[] }>(
    `/patients/${patientId}/imaging-studies/`,
    { days: String(days) },
  );
  if (!res.success || !res.data) return res as ApiResponse<ImagingStudyRecord[]>;
  const d = res.data;
  if (Array.isArray(d)) return { ...res, data: d };
  if (d && typeof d === 'object' && Array.isArray((d as { data?: ImagingStudyRecord[] }).data)) {
    return { ...res, data: (d as { data: ImagingStudyRecord[] }).data };
  }
  return { ...res, data: [] };
};

export const hasRecentImagingStudies = async (
  patientId: number,
  days = 30,
): Promise<ApiResponse<{ has_recent: boolean; count: number; days: number }>> => {
  const res = await apiGet<{ has_recent: boolean; count: number; days: number } | { data?: { has_recent: boolean; count: number; days: number } }>(
    `/patients/${patientId}/imaging-studies/has-recent/`,
    { days: String(days) },
  );
  if (!res.success || !res.data) return res as ApiResponse<{ has_recent: boolean; count: number; days: number }>;
  const d = res.data;
  if (d && typeof d === 'object' && 'has_recent' in d) {
    return { ...res, data: d as { has_recent: boolean; count: number; days: number } };
  }
  if (d && typeof d === 'object' && (d as { data?: { has_recent: boolean; count: number } }).data) {
    const inner = (d as { data: { has_recent: boolean; count: number; days?: number } }).data;
    return { ...res, data: { ...inner, days: inner.days ?? days } };
  }
  return { ...res, data: { has_recent: false, count: 0, days } };
};

export const saveImagingStudy = async (
  patientId: number,
  report: UziUttReport,
  modality: 'auto' | 'ultrasound' | 'xray' | 'mixed' = 'auto',
): Promise<ApiResponse<ImagingStudyRecord>> => {
  const res = await apiPost<ImagingStudyRecord | { data?: ImagingStudyRecord }>(
    `/patients/${patientId}/imaging-studies/`,
    { report, modality },
  );
  if (!res.success || !res.data) return res as ApiResponse<ImagingStudyRecord>;
  const d = res.data;
  if (d && typeof d === 'object' && 'id' in d) {
    return { ...res, data: d as ImagingStudyRecord };
  }
  if (d && typeof d === 'object' && (d as { data?: ImagingStudyRecord }).data) {
    return { ...res, data: (d as { data: ImagingStudyRecord }).data };
  }
  return res as ApiResponse<ImagingStudyRecord>;
};
