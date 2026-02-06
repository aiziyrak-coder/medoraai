/**
 * Patient API Service
 */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload, type ApiResponse } from './api';
import type { PatientData, AnalysisRecord } from '../types';

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  phone?: string;
  address?: string;
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
  gender?: string;
  ordering?: string;
}

/**
 * Convert PatientData to API format
 */
const patientDataToApi = (data: PatientData): Partial<Patient> => {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    age: data.age,
    gender: data.gender as 'male' | 'female' | 'other' | '',
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
  };
};

/**
 * Convert API Patient to PatientData
 */
const apiToPatientData = (patient: Patient): PatientData => {
  return {
    firstName: patient.first_name,
    lastName: patient.last_name,
    age: patient.age,
    gender: patient.gender,
    complaints: patient.complaints,
    history: patient.history,
    objectiveData: patient.objective_data,
    labResults: patient.lab_results,
    allergies: patient.allergies,
    currentMedications: patient.current_medications,
    familyHistory: patient.family_history,
    additionalInfo: patient.additional_info,
    structuredLabResults: patient.structured_lab_results,
    pharmacogenomicsReport: patient.pharmacogenomics_report,
    symptomTimeline: patient.symptom_timeline as PatientData['symptomTimeline'],
    mentalHealthScores: patient.mental_health_scores as PatientData['mentalHealthScores'],
    attachments: patient.attachments?.map(att => ({
      name: att.name,
      base64Data: '', // Will be fetched separately if needed
      mimeType: att.mime_type,
    })),
  };
};

/**
 * Get patients list
 */
export const getPatients = async (params?: PatientListParams): Promise<ApiResponse<Patient[]>> => {
  const queryParams: Record<string, string> = {};
  
  if (params?.page) queryParams.page = params.page.toString();
  if (params?.page_size) queryParams.page_size = params.page_size.toString();
  if (params?.search) queryParams.search = params.search;
  if (params?.gender) queryParams.gender = params.gender;
  if (params?.ordering) queryParams.ordering = params.ordering;
  
  return apiGet<Patient[]>('/patients/', queryParams);
};

/**
 * Get patient by ID
 */
export const getPatient = async (id: number): Promise<ApiResponse<Patient>> => {
  return apiGet<Patient>(`/patients/${id}/`);
};

/**
 * Create patient
 */
export const createPatient = async (data: PatientData): Promise<ApiResponse<Patient>> => {
  const apiData = patientDataToApi(data);
  return apiPost<Patient>('/patients/', apiData);
};

/**
 * Update patient
 */
export const updatePatient = async (id: number, data: Partial<PatientData>): Promise<ApiResponse<Patient>> => {
  const apiData = patientDataToApi(data as PatientData);
  return apiPatch<Patient>(`/patients/${id}/`, apiData);
};

/**
 * Delete patient
 */
export const deletePatient = async (id: number): Promise<ApiResponse<void>> => {
  return apiDelete<void>(`/patients/${id}/`);
};

/**
 * Upload patient attachment
 */
export const uploadPatientAttachment = async (
  patientId: number,
  file: File
): Promise<ApiResponse<PatientAttachment>> => {
  return apiUpload<PatientAttachment>(`/patients/${patientId}/upload-attachment/`, file);
};

/**
 * Delete patient attachment
 */
export const deletePatientAttachment = async (
  patientId: number,
  attachmentId: number
): Promise<ApiResponse<void>> => {
  return apiDelete<void>(`/patients/${patientId}/attachments/${attachmentId}/`);
};

/**
 * Convert Patient to PatientData for frontend use
 */
export const convertPatientToPatientData = apiToPatientData;
