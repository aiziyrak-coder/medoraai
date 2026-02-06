/**
 * Analysis API Service
 */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, type ApiResponse } from './api';
import type { AnalysisRecord, DiagnosisFeedback, FinalReport, ChatMessage } from '../types';

export interface ApiAnalysisRecord {
  id: number;
  patient: number;
  patient_id: string;
  patient_data: Record<string, unknown>;
  debate_history: ChatMessage[];
  final_report: FinalReport;
  follow_up_history: Array<{ question: string; answer: string }>;
  selected_specialists: string[];
  detected_medications: Array<{ name: string; dosage: string }>;
  diagnosis_feedbacks?: DiagnosisFeedback[];
  created_by?: unknown;
  created_at: string;
  updated_at: string;
}

export interface AnalysisListParams {
  page?: number;
  page_size?: number;
  search?: string;
  patient?: number;
  ordering?: string;
}

/**
 * Convert API AnalysisRecord to frontend AnalysisRecord
 */
const apiToAnalysisRecord = (api: ApiAnalysisRecord): AnalysisRecord => {
  return {
    id: api.id.toString(),
    patientId: api.patient_id,
    date: api.created_at,
    patientData: api.patient_data as AnalysisRecord['patientData'],
    debateHistory: api.debate_history,
    finalReport: api.final_report,
    followUpHistory: api.follow_up_history,
    detectedMedications: api.detected_medications,
    selectedSpecialists: api.selected_specialists as AnalysisRecord['selectedSpecialists'],
  };
};

/**
 * Convert frontend AnalysisRecord to API format
 */
const analysisRecordToApi = (record: Partial<AnalysisRecord>): Partial<ApiAnalysisRecord> => {
  return {
    patient_id: record.patientId || '',
    patient_data: record.patientData || {},
    debate_history: record.debateHistory || [],
    final_report: record.finalReport || {} as FinalReport,
    follow_up_history: record.followUpHistory || [],
    selected_specialists: record.selectedSpecialists?.map(s => s.toString()) || [],
    detected_medications: record.detectedMedications || [],
  };
};

/**
 * Get analyses list
 */
export const getAnalyses = async (params?: AnalysisListParams): Promise<ApiResponse<AnalysisRecord[]>> => {
  const queryParams: Record<string, string> = {};
  
  if (params?.page) queryParams.page = params.page.toString();
  if (params?.page_size) queryParams.page_size = params.page_size.toString();
  if (params?.search) queryParams.search = params.search;
  if (params?.patient) queryParams.patient = params.patient.toString();
  if (params?.ordering) queryParams.ordering = params.ordering;
  
  const response = await apiGet<ApiAnalysisRecord[]>('/analyses/', queryParams);
  
  if (response.success && response.data) {
    return {
      ...response,
      data: response.data.map(apiToAnalysisRecord),
    };
  }
  
  return response as ApiResponse<AnalysisRecord[]>;
};

/**
 * Get analysis by ID
 */
export const getAnalysis = async (id: number): Promise<ApiResponse<AnalysisRecord>> => {
  const response = await apiGet<ApiAnalysisRecord>(`/analyses/${id}/`);
  
  if (response.success && response.data) {
    return {
      ...response,
      data: apiToAnalysisRecord(response.data),
    };
  }
  
  return response as ApiResponse<AnalysisRecord>;
};

/**
 * Create analysis record
 */
export const createAnalysis = async (
  patientId: number,
  record: Partial<AnalysisRecord>
): Promise<ApiResponse<AnalysisRecord>> => {
  const apiData = {
    ...analysisRecordToApi(record),
    patient: patientId,
  };
  
  const response = await apiPost<ApiAnalysisRecord>('/analyses/', apiData);
  
  if (response.success && response.data) {
    return {
      ...response,
      data: apiToAnalysisRecord(response.data),
    };
  }
  
  return response as ApiResponse<AnalysisRecord>;
};

/**
 * Update analysis record
 */
export const updateAnalysis = async (
  id: number,
  record: Partial<AnalysisRecord>
): Promise<ApiResponse<AnalysisRecord>> => {
  const apiData = analysisRecordToApi(record);
  
  const response = await apiPatch<ApiAnalysisRecord>(`/analyses/${id}/`, apiData);
  
  if (response.success && response.data) {
    return {
      ...response,
      data: apiToAnalysisRecord(response.data),
    };
  }
  
  return response as ApiResponse<AnalysisRecord>;
};

/**
 * Delete analysis record
 */
export const deleteAnalysis = async (id: number): Promise<ApiResponse<void>> => {
  return apiDelete<void>(`/analyses/${id}/`);
};

/**
 * Add diagnosis feedback
 */
export const addDiagnosisFeedback = async (
  analysisId: number,
  diagnosisName: string,
  feedback: DiagnosisFeedback
): Promise<ApiResponse<unknown>> => {
  return apiPost(`/analyses/${analysisId}/add-feedback/`, {
    diagnosis_name: diagnosisName,
    feedback: feedback,
  });
};

/**
 * Get analysis statistics
 */
export const getAnalysisStats = async (): Promise<ApiResponse<{
  total_analyses: number;
  common_diagnoses: Array<{ name: string; count: number }>;
  feedback_accuracy: number;
}>> => {
  return apiGet('/analyses/stats/');
};
