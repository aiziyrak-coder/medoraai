/**
 * AI Services API
 */
import { apiPost, type ApiResponse } from './api';
import type { PatientData, Diagnosis, AIModel } from '../types';

/**
 * Generate clarifying questions
 */
export const generateClarifyingQuestions = async (
  patientData: PatientData
): Promise<ApiResponse<string[]>> => {
  return apiPost<string[]>('/ai/clarifying-questions/', {
    patient_data: patientData,
  });
};

/**
 * Recommend specialists
 */
export const recommendSpecialists = async (
  patientData: PatientData
): Promise<ApiResponse<{ recommendations: Array<{ model: AIModel; reason: string }> }>> => {
  const response = await apiPost<{ recommendations: Array<{ model: string; reason: string }> }>>(
    '/ai/recommend-specialists/',
    { patient_data: patientData }
  );
  
  if (response.success && response.data) {
    return {
      ...response,
      data: {
        recommendations: response.data.recommendations.map(rec => ({
          model: rec.model as AIModel,
          reason: rec.reason,
        })),
      },
    };
  }
  
  return response as ApiResponse<{ recommendations: Array<{ model: AIModel; reason: string }> }>;
};

/**
 * Generate initial diagnoses
 */
export const generateInitialDiagnoses = async (
  patientData: PatientData
): Promise<ApiResponse<Diagnosis[]>> => {
  return apiPost<Diagnosis[]>('/ai/generate-diagnoses/', {
    patient_data: patientData,
  });
};

/**
 * Run council debate
 */
export const runCouncilDebate = async (
  patientData: PatientData,
  diagnoses: Diagnosis[],
  specialists: Array<{ role: AIModel; backEndModel: string }>,
  orchestrator: string
): Promise<ApiResponse<{ status: string; message: string }>> => {
  return apiPost('/ai/council-debate/', {
    patient_data: patientData,
    diagnoses: diagnoses,
    specialists: specialists.map(s => ({ model: s.role, backend_model: s.backEndModel })),
    orchestrator: orchestrator,
  });
};
