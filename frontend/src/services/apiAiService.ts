/**
 * AI Services API — Farg'ona JSTI Ziyrak AI
 *
 * Barcha AI so'rovlar faqat FJSTI server orqali:
 *   /api/ziyrak/consilium/
 *   /api/ziyrak/doctor-support/
 *   /api/ziyrak/inference/
 */
import { apiPost, API_BASE_URL, type ApiResponse } from './api';
import { API_CONFIG } from '../config/api';
import type { PatientData, Diagnosis, AIModel } from '../types';
import { mapApiSpecialistToAIModel } from '../utils/specialistDisplay';

// ---
export const TASK_QUICK_CONSULT  = 'quick_consult';
export const TASK_DIAGNOSIS      = 'diagnosis';
export const TASK_TREATMENT      = 'treatment_plan';
export const TASK_DRUG_CHECK     = 'drug_check';
export const TASK_LAB_INTERPRET  = 'lab_interpretation';
export const TASK_FOLLOW_UP      = 'follow_up';
export const TASK_PRESCRIPTION_AUDIT = 'prescription_audit';

export type DoctorTaskType =
  | typeof TASK_QUICK_CONSULT
  | typeof TASK_DIAGNOSIS
  | typeof TASK_TREATMENT
  | typeof TASK_DRUG_CHECK
  | typeof TASK_LAB_INTERPRET
  | typeof TASK_FOLLOW_UP
  | typeof TASK_PRESCRIPTION_AUDIT;

// ---
export interface DebateMessage {
  id:          string;
  author:      string;
  authorTitle: string;
  phase:       'independent' | 'debate';
  content:     string;
}

export interface ProfessorSummary {
  name:             string;
  title:            string;
  initialDiagnosis: string;
  deployment:       string;
}

export interface ConsiliumReport {
  consensusDiagnosis:       Diagnosis[];
  rejectedHypotheses:       Array<{ name: string; reason: string }>;
  treatmentPlan:            string[];
  medicationRecommendations: Array<Record<string, string>>;
  recommendedTests:         string[];
  criticalFinding?:         { finding: string; implication: string; urgency: string };
  debateHistory:            DebateMessage[];
  professorSummary:         ProfessorSummary[];
  pharmacologyWarnings:     string[];
  drugInteractions:         string[];
  dissentingOpinions:       string[];
  followUpPlan:             string;
  unexpectedFindings:       string;
  uzbekistanLegislativeNote: string;
  generatedBy:              string;
}

export interface ConsiliumResult {
  session_id:   string;
  started_at:   string;
  language:     string;
  professors:   ProfessorSummary[];
  phases:       {
    phase1_independent?: Record<string, unknown>[];
    phase2_debate?:      Record<string, unknown>[];
    phase3_consensus_raw?: Record<string, unknown>;
  };
  final_report: ConsiliumReport;
  completed_at: string;
}

// ---
export interface DoctorSupportResult {
  _task_type:   string;
  _language:    string;
  // quick_consult
  summary?:              string;
  primary_diagnosis?:    string;
  probability?:          number;
  immediate_actions?:    string[];
  medications?:          Array<Record<string, string>>;
  recommended_tests?:    string[];
  follow_up?:            string;
  critical_alert?:       { present: boolean; message: string };
  // diagnosis
  diagnoses?:            Array<{
    name: string; probability: number; justification: string;
    evidence_level: string; reasoning_chain: string[]; uzbek_protocol: string;
  }>;
  red_flags?:            string[];
  // treatment
  treatment_plan?:       string[];
  non_pharmacological?:  string[];
  monitoring?:           string[];
  uzbek_protocol_ref?:   string;
  // drug_check
  drugs_analyzed?:       Array<Record<string, unknown>>;
  interactions?:         Array<{ drugs: string[]; severity: string; description: string }>;
  overall_safety?:       string;
  recommendations?:      string[];
  // lab_interpretation
  interpretations?:      Array<Record<string, unknown>>;
  urgent_findings?:      string[];
  // prescription_audit
  diagnosis_analysis?: {
    doctor_diagnoses?: string[];
    overall_assessment?: string;
    assessment_summary?: string;
    protocol_reference?: string;
    icd_suggestions?: string[];
    concerns?: string[];
    missing_workup?: string[];
  };
  medications_review?: Array<{
    name: string;
    prescribed_dose?: string;
    frequency?: string;
    duration?: string;
    registered_in_uzbekistan?: boolean;
    indication_match?: string;
    indication_comment?: string;
    dose_assessment?: string;
    dose_comment?: string;
    protocol_basis?: string;
    contraindications?: string;
    recommendation?: string;
    adjustment_suggestion?: string;
  }>;
  protocol_compliance?: {
    score?: number;
    verdict?: string;
    summary?: string;
    gaps?: Array<{ gap: string; protocol?: string; severity?: string; recommendation?: string }>;
  };
  overall_recommendations?: string[];
  critical_alerts?: string[];
  // generic
  error?:                string;
}

// ---
export interface FilteredError {
  filtered:      boolean;
  filter_level:  string;
  message:       string;
}

// ---

export type ConsiliumContextExtra = {
  differentialDiagnoses?: Diagnosis[];
  selectedSpecialists?: string[];
  specialistDebateSummary?: string;
  regionalContext?: string;
  allowIncomplete?: boolean;
};

/** Multi-Agent Medical Consilium (3 faza: Independent  ->  Debate  ->  Consensus) */
export const runConsilium = async (
  patientData: PatientData,
  language: string = 'uz-L',
  contextExtra?: ConsiliumContextExtra,
): Promise<ApiResponse<ConsiliumResult>> => {
  return apiPost<ConsiliumResult>(
    '/ziyrak/consilium/',
    {
      patient_data: { ...patientData, language, preferredLanguage: language },
      language,
      allow_incomplete: contextExtra?.allowIncomplete ?? patientData.allowIncompleteClinical ?? false,
      differential_diagnoses: contextExtra?.differentialDiagnoses,
      selected_specialists: contextExtra?.selectedSpecialists,
      specialist_debate_summary: contextExtra?.specialistDebateSummary ?? patientData.specialistDebateSummary,
      regional_context: contextExtra?.regionalContext ?? patientData.regionalContext,
    },
    API_CONFIG.AI_TIMEOUT_MS,
  );
};

/** Doctor Support Mode - synchronous (GPT-4o) */
export const runDoctorSupport = async (
  patientData: PatientData,
  options: {
    query?:     string;
    taskType?:  DoctorTaskType;
    language?:  string;
  } = {},
): Promise<ApiResponse<DoctorSupportResult>> => {
  return apiPost<DoctorSupportResult>(
    '/ziyrak/doctor-support/',
    {
      patient_data: patientData,
      query:        options.query     || '',
      task_type:    options.taskType  || TASK_QUICK_CONSULT,
      language:     options.language  || 'uz-L',
    },
    API_CONFIG.AI_TIMEOUT_MS,
  );
};

/**
 * Doctor Support Mode - SSE streaming.
 * onChunk(text) har token kelganda chaqiriladi.
 * onDone() stream tugaganda chaqiriladi.
 */
export const runDoctorSupportStream = (
  patientData: PatientData,
  options: { query?: string; taskType?: DoctorTaskType; language?: string } = {},
  onChunk: (text: string) => void,
  onDone:  (fullText: string) => void,
  onError: (err: string) => void,
): (() => void) => {
  let aborted = false;
  let fullText = '';

  const accessToken = localStorage.getItem('access_token') || '';

  fetch(`${API_BASE_URL}/ziyrak/doctor-stream/`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      patient_data: patientData,
      query:        options.query    || '',
      task_type:    options.taskType || TASK_QUICK_CONSULT,
      language:     options.language || 'uz-L',
    }),
  })
    .then(async (resp) => {
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        onError((body as { error?: { message?: string } })?.error?.message || `HTTP ${resp.status}`);
        return;
      }
      const reader  = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { onError('Stream reader unavailable'); return; }

      while (!aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        // Parse SSE: "data: {...}\n\n"
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            onDone(fullText);
            return;
          }
          try {
            const obj = JSON.parse(payload) as { chunk?: string; error?: string };
            if (obj.error) { onError(obj.error); return; }
            if (obj.chunk) {
              fullText += obj.chunk;
              onChunk(fullText);
            }
          } catch {
            // ignore parse errors mid-stream
          }
        }
      }
      onDone(fullText);
    })
    .catch((err: unknown) => {
      if (!aborted) onError(String(err));
    });

  return () => { aborted = true; };
};

// ---

export const generateClarifyingQuestions = async (
  patientData: PatientData,
): Promise<ApiResponse<string[]>> => {
  return apiPost<string[]>('/ziyrak/clarifying-questions/', { patient_data: patientData }, API_CONFIG.AI_TIMEOUT_MS);
};

export const recommendSpecialists = async (
  patientData: PatientData,
  differentialDiagnoses?: Diagnosis[],
): Promise<ApiResponse<{ recommendations: Array<{ model: AIModel; reason: string }> }>> => {
  const response = await apiPost<{ recommendations: Array<{ model: string; reason: string }> }>(
    '/ziyrak/recommend-specialists/',
    {
      patient_data: patientData,
      differential_diagnoses: differentialDiagnoses ?? [],
    },
    API_CONFIG.AI_TIMEOUT_MS,
  );
  if (response.success && response.data) {
    const recs = Array.isArray(response.data.recommendations) ? response.data.recommendations : [];
    return {
      ...response,
      data: {
        recommendations: recs.map((rec: { model?: string; reason?: string }) => ({
          model: mapApiSpecialistToAIModel(rec?.model ?? 'Internal Medicine'),
          reason: typeof rec?.reason === 'string' ? rec.reason : '',
        })),
      },
    };
  }
  return response as ApiResponse<{ recommendations: Array<{ model: AIModel; reason: string }> }>;
};

export const generateInitialDiagnoses = async (
  patientData: PatientData,
): Promise<ApiResponse<Diagnosis[]>> => {
  const response = await apiPost<Diagnosis[]>(
    '/ziyrak/generate-diagnoses/',
    { patient_data: patientData },
    API_CONFIG.AI_TIMEOUT_MS,
  );
  if (!response.success && (response.error?.code === 503 || response.error?.code === 0)) {
    return {
      success: true,
      data: [],
      warning:
        response.error?.code === 0
          ? "AI so'rovi uzoq tushdi yoki tarmoq uzildi. Qayta urinib ko'ring."
          : "AI xizmati vaqtincha band. Bo'sh ro'yxat bilan davom eting yoki keyinroq qayta urinib ko'ring.",
    };
  }
  return response;
};

/** Backwards-compat - now calls consilium */
export const runCouncilDebate = async (
  patientData: PatientData,
  _diagnoses: Diagnosis[],
  _specialists: Array<{ role: AIModel; backEndModel: string }>,
  _orchestrator: string,
): Promise<ApiResponse<{ status: string; message: string }>> => {
  return apiPost('/ziyrak/consilium/', { patient_data: patientData }, API_CONFIG.AI_TIMEOUT_MS);
};