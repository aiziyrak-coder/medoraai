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
const planItemToStr = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    return [o.step, o.details, o.urgency, o.action, o.description, o.text]
      .filter(v => v != null && String(v).trim()).map(String).join(' - ') || JSON.stringify(item);
  }
  return String(item ?? '');
};

const apiToAnalysisRecord = (api: ApiAnalysisRecord): AnalysisRecord => {
  const fr = (api.final_report || {}) as Record<string, unknown>;
  const a = api as ApiAnalysisRecord & { patient_id?: string; patient?: number | { id?: number } };
  const patientId = a.patient_id ?? (typeof a.patient === 'object' && a.patient?.id != null ? String(a.patient.id) : String(a.patient ?? ''));
  const rawTreatmentPlan = Array.isArray(fr.treatmentPlan) ? fr.treatmentPlan : Array.isArray(fr.treatment_plan) ? fr.treatment_plan : [];
  const treatmentPlan = rawTreatmentPlan.map(planItemToStr).filter(s => s.trim());
  const rawMeds = Array.isArray(fr.medicationRecommendations) ? fr.medicationRecommendations : Array.isArray(fr.medication_recommendations) ? fr.medication_recommendations : [];
  const medicationRecommendations = rawMeds.map((m: Record<string, unknown>) => ({
    name: String(m?.name ?? m?.drug ?? ''),
    dosage: String(m?.dosage ?? ''),
    notes: String(m?.notes ?? ''),
    localAvailability: m?.localAvailability ?? m?.local_availability != null ? String(m.local_availability) : undefined,
    priceEstimate: m?.priceEstimate ?? m?.price_estimate != null ? String(m.price_estimate) : undefined,
  }));
  return {
    id: api.id.toString(),
    patientId,
    date: api.created_at,
    patientData: api.patient_data as unknown as AnalysisRecord['patientData'],
    debateHistory: api.debate_history || [],
    finalReport: {
      ...fr,
      consensusDiagnosis: normalizeConsensusDiagnosis(fr.consensusDiagnosis ?? fr.consensus_diagnosis),
      rejectedHypotheses: Array.isArray(fr.rejectedHypotheses) ? fr.rejectedHypotheses.map((h: { name?: unknown; reason?: unknown }) => ({ name: String(h?.name ?? ''), reason: String(h?.reason ?? '') }))
        : (Array.isArray(fr.rejected_hypotheses) ? fr.rejected_hypotheses : []).map((h: { name?: unknown; reason?: unknown }) => ({ name: String(h?.name ?? ''), reason: String(h?.reason ?? '') })),
      prognosisReport: fr.prognosisReport ?? fr.prognosis_report ?? undefined,
      treatmentPlan,
      medicationRecommendations,
      unexpectedFindings: String(fr.unexpectedFindings ?? fr.unexpected_findings ?? ''),
      criticalFinding: (fr.criticalFinding ?? fr.critical_finding) as FinalReport['criticalFinding'],
      recommendedTests: (Array.isArray(fr.recommendedTests) ? fr.recommendedTests : Array.isArray(fr.recommended_tests) ? fr.recommended_tests : []).map((t: unknown) => {
        if (typeof t === 'string') return t;
        if (t && typeof t === 'object') {
          const o = t as Record<string, unknown>;
          return [o.testName ?? o.name ?? o.test, o.reason, o.urgency].filter(Boolean).map(String).join(' - ') || JSON.stringify(t);
        }
        return String(t ?? '');
      }),
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
  if (obj === null || typeof obj === 'boolean') return obj;
  if (typeof obj === 'number') return Number.isFinite(obj) ? obj : 0;
  if (typeof obj === 'string') return obj.length > MAX_STRING ? obj.slice(0, MAX_STRING) : obj;
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
    recommendedTests: safeArr(fr.recommendedTests).slice(0, 30).map((t: unknown) => {
      if (typeof t === 'string') return t.slice(0, 500);
      if (t && typeof t === 'object') {
        const o = t as Record<string, unknown>;
        const part = [o.testName ?? o.name ?? o.test, o.reason ?? o.reasoning, o.urgency].filter(Boolean).map(String).join(' - ');
        return part.slice(0, 500) || JSON.stringify(t).slice(0, 500);
      }
      return String(t ?? '').slice(0, 500);
    }),
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

/** Extract list from API response (handles paginated { data: [] } or raw array) */
function getListFromResponse<T>(response: ApiResponse<unknown>): T[] {
  const d = response.data;
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === 'object' && Array.isArray((d as Record<string, unknown>).data))
    return (d as Record<string, T[]>).data;
  if (d && typeof d === 'object' && Array.isArray((d as Record<string, unknown>).results))
    return (d as Record<string, T[]>).results;
  return [];
}

/**
 * Get analyses list
 */
export const getAnalyses = async (params?: AnalysisListParams): Promise<ApiResponse<AnalysisRecord[]>> => {
  const queryParams: Record<string, string> = {
    page_size: (params?.page_size ?? 100).toString(),
  };
  
  if (params?.page) queryParams.page = params.page.toString();
  if (params?.search) queryParams.search = params.search;
  if (params?.patient) queryParams.patient = params.patient.toString();
  if (params?.ordering) queryParams.ordering = params.ordering;
  
  const response = await apiGet<ApiAnalysisRecord[] | { data?: ApiAnalysisRecord[]; results?: ApiAnalysisRecord[] }>('/analyses/', queryParams);
  
  const rawList = response.success ? getListFromResponse<ApiAnalysisRecord>(response as ApiResponse<unknown>) : [];
  const data = Array.isArray(rawList) ? rawList.map(apiToAnalysisRecord) : [];
  
  return {
    success: response.success,
    data,
    pagination: response.pagination,
    error: response.error,
  };
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
 * Create analysis record. Payload is limited to backend create serializer fields only.
 */
export const createAnalysis = async (
  patientId: number,
  record: Partial<AnalysisRecord>
): Promise<ApiResponse<AnalysisRecord>> => {
  const base = analysisRecordToApi(record);
  const patientIdNum = Number.isFinite(Number(patientId)) ? Number(patientId) : 0;
  if (patientIdNum <= 0) {
    return {
      success: false,
      error: { code: 400, message: "Bemor ID noto'g'ri. Avval bemor yaratilishi kerak." },
    };
  }
  const apiData: Record<string, unknown> = {
    patient: patientIdNum,
    external_patient_id: base.external_patient_id ?? '',
    patient_data: base.patient_data ?? {},
    debate_history: base.debate_history ?? [],
    final_report: base.final_report ?? {},
    follow_up_history: base.follow_up_history ?? [],
    selected_specialists: base.selected_specialists ?? [],
    detected_medications: base.detected_medications ?? [],
  };
  const sanitized = sanitizeForJson(apiData) as Record<string, unknown>;
  const response = await apiPost<ApiAnalysisRecord>('/analyses/', sanitized);
  
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

/**
 * Submit usefulness feedback (foydali / foydali emas + optional comment)
 */
export const submitUsefulnessFeedback = async (
  analysisId: number,
  useful: boolean,
  comment?: string
): Promise<ApiResponse<{ useful: boolean; comment: string; created: boolean }>> => {
  return apiPost(`/analyses/${analysisId}/usefulness-feedback/`, { useful, comment: comment || '' });
};

export interface AuditLogEntry {
  action: string;
  user: string;
  created_at: string;
  extra?: Record<string, unknown>;
}

/**
 * Get audit trail for analysis (kim, nima, qachon)
 */
export const getAnalysisAuditLog = async (analysisId: number): Promise<ApiResponse<AuditLogEntry[]>> => {
  const res = await apiGet<AuditLogEntry[]>(`/analyses/${analysisId}/audit/`);
  if (res.success && !Array.isArray(res.data)) {
    return { ...res, data: [] };
  }
  return res as ApiResponse<AuditLogEntry[]>;
};