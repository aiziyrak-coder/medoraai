/**
 * Aqlli validatsiya: bemor ma'lumotlari uchun tekshiruv va maslahatlar.
 * Platformani kuchli va aqlli qilish uchun.
 */

import type { PatientData } from '../types';

export interface SmartValidationResult {
  valid: boolean;
  warnings: string[];
  missingCritical: string[];
  suggestions: string[];
}

const EMPTY = (v: string | undefined) => !v || String(v).trim() === '';

/**
 * Bemor ma'lumotlarini aqlli tekshiradi: kritik bo'sh maydonlar, ogohlantirishlar, maslahatlar.
 */
export function validatePatientDataSmart(data: Partial<PatientData> | null): SmartValidationResult {
  const result: SmartValidationResult = {
    valid: true,
    warnings: [],
    missingCritical: [],
    suggestions: [],
  };

  if (!data) {
    result.valid = false;
    result.missingCritical.push('Bemor ma\'lumotlari kiritilmagan');
    return result;
  }

  // Kritik maydonlar
  if (EMPTY(data.complaints)) {
    result.missingCritical.push('Shikoyatlar');
    result.valid = false;
  }
  if (EMPTY(data.firstName) || EMPTY(data.lastName)) {
    result.missingCritical.push('Bemor ismi/familiyasi');
    result.valid = false;
  }
  if (EMPTY(data.age)) {
    result.warnings.push('Yosh kiritilmagan – dozani hisoblashda muhim');
  }

  // Xavfsizlik: allergiya va dori-darmonlar
  if (EMPTY(data.allergies)) {
    result.missingCritical.push('Allergiya (yo\'q bo\'lsa "Yo\'q" yozing)');
    result.valid = false;
  }
  if (EMPTY(data.currentMedications)) {
    result.warnings.push('Joriy dori-darmonlar – aralashuv xavfi uchun kiritish tavsiya etiladi');
  }

  // Aqlli maslahatlar
  if (data.complaints && data.complaints.length > 10 && EMPTY(data.history)) {
    result.suggestions.push('Anamnez qo\'shilsa tashxis aniqroq bo\'ladi');
  }
  if (data.complaints && /og'riq|ogriq|болит|pain/i.test(data.complaints) && EMPTY(data.objectiveData)) {
    result.suggestions.push('Ob\'ektiv tekshiruv (JAR, palpatsiya) natijasini qo\'shing');
  }
  if (data.complaints && /isitma|temperatura|лихорад|fever/i.test(data.complaints)) {
    result.suggestions.push('Harorat va pulsni ko\'rsatish foydali');
  }
  if (data.age && parseInt(data.age, 10) < 18 && EMPTY(data.familyHistory)) {
    result.suggestions.push('Bolalar uchun oilaviy anamnez muhim bo\'lishi mumkin');
  }

  return result;
}

/**
 * Tekshiruv natijasidan foydalanuvchi uchun bitta qisqa xabar.
 */
export function getSmartValidationMessage(
  res: SmartValidationResult,
  t: (key: string) => string
): string | null {
  if (res.missingCritical.length > 0) {
    return t('smart_validation_critical') || `Quyidagilarni to'ldiring: ${res.missingCritical.join(', ')}`;
  }
  if (res.warnings.length > 0) {
    return res.warnings[0];
  }
  if (res.suggestions.length > 0) {
    return (t('smart_validation_suggestion') || 'Maslahat: ') + res.suggestions[0];
  }
  return null;
}
