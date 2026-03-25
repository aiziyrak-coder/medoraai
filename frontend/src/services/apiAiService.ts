/**
 * AI Services API - Azure AI Foundry
 *
 * Ikki asosiy rejim:
 *   1. Consilium Mode   ->  /api/ai/consilium/     (5 professor, 3 faza)
 *   2. Doctor Support   ->  /api/ai/doctor-support/ (GPT-4o, tezkor)
 *   3. Doctor Stream    ->  /api/ai/doctor-stream/  (SSE)
 */
import { apiPost, API_BASE_URL, type ApiResponse } from './api';
import type { PatientData, Diagnosis, AIModel } from '../types';

// ---
export const TASK_QUICK_CONSULT  = 'quick_consult';
export const TASK_DIAGNOSIS      = 'diagnosis';
export const TASK_TREATMENT      = 'treatment_plan';
export const TASK_DRUG_CHECK     = 'drug_check';
export const TASK_LAB_INTERPRET  = 'lab_interpretation';
export const TASK_FOLLOW_UP      = 'follow_up';

export type DoctorTaskType =
  | typeof TASK_QUICK_CONSULT
  | typeof TASK_DIAGNOSIS
  | typeof TASK_TREATMENT
  | typeof TASK_DRUG_CHECK
  | typeof TASK_LAB_INTERPRET
  | typeof TASK_FOLLOW_UP;

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

/** Multi-Agent Medical Consilium (3 faza: Independent  ->  Debate  ->  Consensus) */
export const runConsilium = async (
  patientData: PatientData,
  language: string = 'uz-L',
): Promise<ApiResponse<ConsiliumResult>> => {
  return apiPost<ConsiliumResult>('/ai/consilium/', {
    patient_data: patientData,
    language,
  });
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
  return apiPost<DoctorSupportResult>('/ai/doctor-support/', {
    patient_data: patientData,
    query:        options.query     || '',
    task_type:    options.taskType  || TASK_QUICK_CONSULT,
    language:     options.language  || 'uz-L',
  });
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

  fetch(`${API_BASE_URL}/ai/doctor-stream/`, {
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
  return apiPost<string[]>('/ai/clarifying-questions/', { patient_data: patientData });
};

export const recommendSpecialists = async (
  patientData: PatientData,
  differentialDiagnoses?: Diagnosis[],
): Promise<ApiResponse<{ recommendations: Array<{ model: AIModel; reason: string }> }>> => {
  const response = await apiPost<{ recommendations: Array<{ model: string; reason: string }> }>(
    '/ai/recommend-specialists/',
    {
      patient_data: patientData,
      differential_diagnoses: differentialDiagnoses ?? [],
    },
  );
  if (response.success && response.data) {
    const recs = Array.isArray(response.data.recommendations) ? response.data.recommendations : [];
    return {
      ...response,
      data: {
        recommendations: recs.map((rec: { model?: string; reason?: string }) => ({
          model:  (rec?.model ?? 'Gemini') as AIModel,
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
  const response = await apiPost<Diagnosis[]>('/ai/generate-diagnoses/', { patient_data: patientData });
  if (!response.success && response.error?.code === 503) {
    return {
      success: true,
      data: [],
      warning: "AI xizmati vaqtincha band. Bo'sh ro'yxat bilan davom eting yoki keyinroq qayta urinib ko'ring.",
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
  return apiPost('/ai/council-debate/', { patient_data: patientData });
};