import type { PatientData } from '../types';

const SESSION_KEY = 'aidoktor_active_patient';

export interface ActivePatientSession {
  linkedPatientKey: string;
  createdPatientId: number | null;
  userId: string | number;
}

export function saveActivePatientSession(userId: string | number, linkedKey: string, createdId: number | null): void {
  try {
    const payload: ActivePatientSession = {
      linkedPatientKey: linkedKey,
      createdPatientId: createdId,
      userId,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadActivePatientSession(userId: string | number): ActivePatientSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivePatientSession;
    if (String(parsed.userId) !== String(userId)) return null;
    if (!parsed.linkedPatientKey?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActivePatientSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Qayta qabul: bazadagi anamnez saqlanadi, faqat bugungi shikoyat/o'lchov yangilanadi. */
export function mergeReturnVisitData(baseline: PatientData, visit: PatientData): PatientData {
  return {
    ...baseline,
    ...visit,
    firstName: baseline.firstName || visit.firstName,
    lastName: baseline.lastName || visit.lastName,
    fatherName: baseline.fatherName || visit.fatherName,
    age: visit.age || baseline.age,
    gender: visit.gender || baseline.gender,
    history: baseline.history || visit.history,
    allergies: baseline.allergies || visit.allergies,
    familyHistory: baseline.familyHistory || visit.familyHistory,
    currentMedications: visit.currentMedications?.trim()
      ? visit.currentMedications
      : baseline.currentMedications,
    pharmacogenomicsReport: baseline.pharmacogenomicsReport || visit.pharmacogenomicsReport,
    structuredLabResults: visit.structuredLabResults ?? baseline.structuredLabResults,
    symptomTimeline: visit.symptomTimeline ?? baseline.symptomTimeline,
    mentalHealthScores: visit.mentalHealthScores ?? baseline.mentalHealthScores,
    complaints: visit.complaints,
    objectiveData: visit.objectiveData,
    labResults: visit.labResults?.trim() ? visit.labResults : baseline.labResults,
    additionalInfo: visit.additionalInfo,
    attachments: visit.attachments?.length ? visit.attachments : baseline.attachments,
  };
}

export function hasBaselineAnamnesis(data: PatientData | null | undefined): boolean {
  if (!data) return false;
  return !!(
    (data.history || '').trim()
    || (data.allergies || '').trim()
    || (data.familyHistory || '').trim()
    || (data.currentMedications || '').trim()
  );
}
