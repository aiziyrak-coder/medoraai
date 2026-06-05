/**
 * Aqlli validatsiya: bemor ma'lumotlari uchun tekshiruv va maslahatlar.
 */

import type { PatientData } from '../types';
import type { TranslationKey } from '../i18n/translationKeys';
import { scoreClinicalCompleteness, type ClinicalCompletenessResult } from './clinicalCompleteness';

export interface SmartValidationResult {
  valid: boolean;
  warningKeys: TranslationKey[];
  missingCriticalKeys: TranslationKey[];
  suggestionKeys: TranslationKey[];
  completeness: ClinicalCompletenessResult;
}

const EMPTY = (v: string | undefined) => !v || String(v).trim() === '';

/**
 * Bemor ma'lumotlarini aqlli tekshiradi: kritik bo'sh maydonlar, ogohlantirishlar, maslahatlar.
 */
export function validatePatientDataSmart(data: Partial<PatientData> | null): SmartValidationResult {
  const completeness = scoreClinicalCompleteness(data);
  const result: SmartValidationResult = {
    valid: true,
    warningKeys: [],
    missingCriticalKeys: [],
    suggestionKeys: [],
    completeness,
  };

  if (!data) {
    result.valid = false;
    result.missingCriticalKeys.push('smart_validation_field_patient_data');
    return result;
  }

  if (EMPTY(data.complaints)) {
    result.missingCriticalKeys.push('smart_validation_field_complaints');
    result.valid = false;
  }
  if (EMPTY(data.firstName) || EMPTY(data.lastName)) {
    result.missingCriticalKeys.push('smart_validation_field_name');
    result.valid = false;
  }
  if (EMPTY(data.age)) {
    result.warningKeys.push('smart_validation_missing_age');
  }

  if (EMPTY(data.allergies)) {
    result.warningKeys.push('smart_validation_missing_allergies');
  }
  if (EMPTY(data.currentMedications)) {
    result.warningKeys.push('smart_validation_missing_medications');
  }

  if (completeness.complaintOnly) {
    result.warningKeys.push('smart_validation_complaint_only');
  }

  if (data.complaints && data.complaints.length > 10 && EMPTY(data.history)) {
    result.suggestionKeys.push('smart_validation_suggest_history');
  }
  if (data.complaints && /og'riq|ogriq|pain|og'riq|боль/i.test(data.complaints) && EMPTY(data.objectiveData)) {
    result.suggestionKeys.push('smart_validation_suggest_objective');
  }
  if (data.complaints && /isitma|temperatura|fever|лих/i.test(data.complaints)) {
    result.suggestionKeys.push('smart_validation_suggest_fever_vitals');
  }
  if (data.age && parseInt(data.age, 10) < 18 && EMPTY(data.familyHistory)) {
    result.suggestionKeys.push('smart_validation_suggest_pediatric_family');
  }

  return result;
}

/**
 * Tekshiruv natijasidan foydalanuvchi uchun bitta qisqa xabar.
 */
export function getSmartValidationMessage(
  res: SmartValidationResult,
  t: (key: TranslationKey, replacements?: { [key: string]: string | number }) => string,
): string | null {
  if (res.missingCriticalKeys.length > 0) {
    const fields = res.missingCriticalKeys.map((k) => t(k)).join(', ');
    return t('smart_validation_critical_list', { fields });
  }
  if (res.warningKeys.length > 0) {
    return t(res.warningKeys[0]);
  }
  if (res.suggestionKeys.length > 0) {
    return t('smart_validation_suggestion') + t(res.suggestionKeys[0]);
  }
  return null;
}

export interface ComplaintConsistencyResult {
  consistent: boolean;
  messageKey?: TranslationKey;
  messageParams?: Record<string, string | number>;
}

/**
 * Bemor ma'lumotlari (yosh, jins) va shikoyat matnidagi tavsifni solishtiradi.
 */
export function checkPatientComplaintConsistency(data: Partial<PatientData> | null): ComplaintConsistencyResult {
  if (!data?.complaints?.trim()) return { consistent: true };
  const complaint = data.complaints.trim();
  const formAge = data.age ? parseInt(String(data.age).replace(/\D/g, ''), 10) : null;
  const formGender = data.gender;

  const ageMatch = complaint.match(/(\d{1,3})\s*yosh(li|da)?/i) || complaint.match(/yosh\s*[:\-]?\s*(\d{1,3})/i);
  const mentionedAge = ageMatch ? parseInt(ageMatch[1], 10) : null;
  if (mentionedAge != null && Number.isFinite(mentionedAge) && formAge != null && Number.isFinite(formAge)) {
    if (Math.abs(mentionedAge - formAge) > 5) {
      return {
        consistent: false,
        messageKey: 'validation_complaint_age_mismatch',
        messageParams: { mentioned: String(mentionedAge), form: String(formAge) },
      };
    }
  }

  const mentionsFemale = /\b(ayol|ayollik|qiz|аёл|женщин)/i.test(complaint);
  const mentionsMale = /\b(erkak|erkaklik|o'g'il|эркак|мужчин)/i.test(complaint);
  if (mentionsFemale && formGender === 'male') {
    return { consistent: false, messageKey: 'validation_complaint_gender_female' };
  }
  if (mentionsMale && formGender === 'female') {
    return { consistent: false, messageKey: 'validation_complaint_gender_male' };
  }

  return { consistent: true };
}
