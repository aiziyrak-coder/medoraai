/**
 * Analysis API Service
 */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, type ApiResponse } from './api';
import type { AnalysisRecord, DiagnosisFeedback, FinalReport, ChatMessage } from '../types';
import { normalizeConsensusDiagnosis } from '../types';

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
  const fr = api.final_report || {};
  const a = api as ApiAnalysisRecord & { patient_id?: string; patient?: number | { id?: number } };
  const patientId = a.patient_id ?? (typeof a.patient === 'object' && a.patient?.id != null ? String(a.patient.id) : String(a.patient ?? ''));
  return {
    id: api.id.toString(),
    patientId,
    date: api.created_at,
    patientData: api.patient_data as unknown as AnalysisRecord['patientData'],
    debateHistory: api.debate_history || [],
    finalReport: {
      ...fr,
      consensusDiagnosis: normalizeConsensusDiagnosis(fr.consensusDiagnosis),
      rejectedHypotheses: Array.isArray(fr.rejectedHypotheses) ? fr.rejectedHypotheses : [],
      treatmentPlan: Array.isArray(fr.treatmentPlan) ? fr.treatmentPlan : [],
      medicationRecommendations: Array.isArray(fr.medicationRecommendations) ? fr.medicationRecommendations : [],
      recommendedTests: Array.isArray(fr.recommendedTests) ? fr.recommendedTests : [],
    } as FinalReport,
    followUpHistory: api.follow_up_history,
    detectedMedications: api.detected_medications,
    selectedSpecialists: api.selected_specialists as AnalysisRecord['selectedSpecialists'],
  };
};

/**
 * Convert frontend AnalysisRecord to API format
 */
const safeArr = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : []);

const MAX_MSG_LEN = 4000;
const MAX_DEBATE_ITEMS = 60;
const MAX_STRING = 8000;

/** Recursively sanitize for JSON: remove undefined, truncate long strings, avoid non-serializable values */
function sanitizeForJson(obj: unknown, depth = 0): unknown {
  if (depth > 15) return null;
  if (obj === undefined) return null;
  if (obj === null || typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (typeof obj === 'string') return obj.length > MAX_STRING ? obj.slice(0, MAX_STRING) : obj;
  if (typeof obj === 'number') return Number.isFinite(obj) ? obj : 0;
  if (Array.isArray(obj)) return obj.slice(0, 200).map(item => sanitizeForJson(item, depth + 1));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      if (typeof v === 'function' || (typeof v === 'object' && v !== null && (v as object).constructor?.name === 'File')) continue;
      out[k] = sanitizeForJson(v, depth + 1);
    }
    return out;
  }
  return null;
}

const analysisRecordToApi = (record: Partial<AnalysisRecord>): Partial<ApiAnalysisRecord> & { external_patient_id?: string } => {
  const fr = record.finalReport || {} as FinalReport;
  const pd = record.patientData || {};
  // Strip large binary fields (attachments) from patient_data before sending to backend
  const { attachments: _att, ...patientDataClean } = pd as Record<string, unknown> & { attachments?: unknown };
  const patientDataSanitized = sanitizeForJson(patientDataClean) as Record<string, unknown>;

  const rawDh = safeArr(record.debateHistory).slice(-MAX_DEBATE_ITEMS);
  const debate_history = rawDh.map((m: ChatMessage) => ({
    id: m.id,
    author: m.author,
    content: typeof m.content === 'string' ? (m.content.length > MAX_MSG_LEN ? m.content.slice(0, MAX_MSG_LEN) : m.content) : String(m.content ?? ''),
    isSystemMessage: !!m.isSystemMessage,
    isUserIntervention: !!m.isUserIntervention,
    evidenceLevel: m.evidenceLevel,
  }));

  const consensusDiagnosis = safeArr(fr.consensusDiagnosis).slice(0, 25).map((d: { name?: unknown; probability?: unknown; justification?: unknown; evidenceLevel?: unknown; reasoningChain?: unknown; uzbekProtocolMatch?: unknown }) => {
    const p = Number(d?.probability ?? 0);
    return {
    name: String(d?.name ?? ''),
    probability: Number.isFinite(p) ? p : 0,
    justification: String(d?.justification ?? '').slice(0, 3000),
    evidenceLevel: String(d?.evidenceLevel ?? 'Moderate'),
    reasoningChain: Array.isArray(d?.reasoningChain) ? (d.reasoningChain as string[]).slice(0, 12).map(s => String(s).slice(0, 500)) : [],
    uzbekProtocolMatch: String(d?.uzbekProtocolMatch ?? '').slice(0, 1000),
  };
  });

  const final_report = sanitizeForJson({
    criticalFinding: fr.criticalFinding,
    consensusDiagnosis,
    rejectedHypotheses: safeArr(fr.rejectedHypotheses).slice(0, 20).map((h: { name?: unknown; reason?: unknown }) => ({ name: String(h?.name ?? ''), reason: String(h?.reason ?? '').slice(0, 2000) })),
    imageAnalysis: fr.imageAnalysis,
    prognosisReport: fr.prognosisReport,
    recommendedTests: safeArr(fr.recommendedTests).slice(0, 30),
    treatmentPlan: safeArr(fr.treatmentPlan).map(s => typeof s === 'string' ? s.slice(0, 2000) : JSON.stringify(s).slice(0, 2000)),
    medicationRecommendations: safeArr(fr.medicationRecommendations).slice(0, 30).map((med: Record<string, unknown>) => ({
      name: String(med?.name ?? ''),
      dosage: String(med?.dosage ?? ''),
      frequency: med?.frequency,
      timing: med?.timing,
      duration: med?.duration,
      instructions: med?.instructions,
      notes: String(med?.notes ?? '').slice(0, 1500),
      localAvailability: med?.localAvailability,
      priceEstimate: med?.priceEstimate,
    })),
    followUpPlan: fr.followUpPlan,
    referrals: fr.referrals,
    unexpectedFindings: String(fr.unexpectedFindings ?? '').slice(0, 3000),
    costEffectivenessNotes: fr.costEffectivenessNotes != null ? String(fr.costEffectivenessNotes).slice(0, 1500) : undefined,
    lifestylePlan: fr.lifestylePlan,
    matchedClinicalTrials: fr.matchedClinicalTrials,
    adverseEventRisks: fr.adverseEventRisks,
    simplifiedFamilyExplanation: fr.simplifiedFamilyExplanation,
    relatedResearch: fr.relatedResearch,
    uzbekistanLegislativeNote: fr.uzbekistanLegislativeNote != null ? String(fr.uzbekistanLegislativeNote).slice(0, 1000) : undefined,
  }) as FinalReport;

  return {
    external_patient_id: record.patientId || '',
    patient_data: patientDataSanitized,
    debate_history,
    final_report: final_report as FinalReport,
    follow_up_history: safeArr(record.followUpHistory).slice(0, 50),
    selected_specialists: safeArr(record.selectedSpecialists).map(s => String(s)),
    detected_medications: safeArr(record.detectedMedications).slice(0, 50),
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
  
  return response as unknown as ApiResponse<AnalysisRecord[]>;
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
  
  return response as unknown as ApiResponse<AnalysisRecord>;
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
  
  return response as unknown as ApiResponse<AnalysisRecord>;
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
  
  return response as unknown as ApiResponse<AnalysisRecord>;
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