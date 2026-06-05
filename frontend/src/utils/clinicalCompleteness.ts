import type { PatientData } from '../types';
import type { TranslationKey } from '../i18n/translationKeys';

export type CompletenessLevel = 'low' | 'medium' | 'high';

export interface ClinicalCompletenessResult {
  score: number;
  level: CompletenessLevel;
  warningKeys: TranslationKey[];
  complaintOnly: boolean;
}

const EMPTY = (v: string | undefined) => !v || String(v).trim() === '';

function hasVitals(data: Partial<PatientData>): boolean {
  const obj = (data.objectiveData || '').trim();
  if (!obj) return false;
  if (/\d{2,3}\s*\/\s*\d{2,3}/.test(obj)) return true;
  if (/(puls|pulse|HR|bpm|SpO|harorat|°C|temp)/i.test(obj)) return true;
  return obj.length > 25;
}

function hasRealLabs(data: Partial<PatientData>): boolean {
  const lab = (data.labResults || '').trim();
  if (lab && !/yuklangan|uploaded|fayl|файл|загруж/i.test(lab)) return true;
  const struct = data.structuredLabResults;
  return !!struct && Object.keys(struct).length > 0;
}

function hasImaging(data: Partial<PatientData>): boolean {
  return !!(data.attachments && data.attachments.length > 0);
}

/** Backend clinical_completeness.py bilan mos ball */
export function scoreClinicalCompleteness(data: Partial<PatientData> | null): ClinicalCompletenessResult {
  const d = data || {};
  let score = 0;
  const warningKeys: TranslationKey[] = [];

  if (!EMPTY(d.complaints)) score += 20;
  if (!EMPTY(d.history)) score += 10;
  if (hasVitals(d)) score += 20;
  if (hasRealLabs(d)) score += 15;
  if (hasImaging(d)) score += 15;
  if (!EMPTY(d.allergies)) score += 5;
  if (!EMPTY(d.currentMedications)) score += 5;
  if (!EMPTY(d.familyHistory)) score += 5;
  if (!EMPTY(d.age) && d.gender) score += 5;

  const complaintOnly = !hasVitals(d) && !hasRealLabs(d) && !hasImaging(d);
  if (complaintOnly) {
    warningKeys.push('smart_validation_complaint_only');
  }

  let level: CompletenessLevel = 'low';
  if (score >= 75) level = 'high';
  else if (score >= 50) level = 'medium';

  return { score: Math.min(100, score), level, warningKeys, complaintOnly };
}
