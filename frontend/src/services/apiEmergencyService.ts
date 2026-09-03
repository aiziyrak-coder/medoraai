/**
 * 103 — Tezkor triaj API.
 */
import { apiPost, type ApiResponse } from './api';
import { API_CONFIG } from '../config/api';
import type { AgeBandId } from '../constants/emergencyComplaints';

export type Disposition = 'reanimatsiya' | 'statsionar' | 'kuzatuv' | 'uyda_qoldirish';

export interface TriageAction {
  action: string;
  drug: string;
  dose: string;
  route: string;
  caution: string;
}

export interface TriageCondition {
  name: string;
  likelihood: string;
  why: string;
}

export interface EmergencyTriageResult {
  red_flags: string[];
  time_critical: boolean;
  probable_conditions: TriageCondition[];
  immediate_actions: TriageAction[];
  do_not: string[];
  disposition: Disposition;
  disposition_reason: string;
  clarify: string[];
  advisory: string;
}

export interface TriageInput {
  complaints: string[];
  note?: string;
  ageBand?: AgeBandId | '';
  ageYears?: number | null;
  sex?: 'male' | 'female' | '';
  language?: string;
}

/** Triaj so'rovi. Tezlik muhim — alohida, qisqaroq timeout. */
export const runEmergencyTriage = async (
  input: TriageInput,
): Promise<ApiResponse<EmergencyTriageResult>> =>
  apiPost<EmergencyTriageResult>(
    '/ziyrak/emergency-triage/',
    {
      complaints: input.complaints,
      note:       input.note || '',
      age_band:   input.ageBand || '',
      age_years:  input.ageYears ?? null,
      sex:        input.sex || '',
      language:   input.language || 'uz-L',
    },
    API_CONFIG.AI_TIMEOUT_MS,
  );
