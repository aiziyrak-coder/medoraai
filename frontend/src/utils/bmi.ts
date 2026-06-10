import type { TranslationKey } from '../i18n/translationKeys';

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese' | 'unknown';

export interface BmiResult {
  value: number;
  category: BmiCategory;
  categoryKey: TranslationKey;
}

const CATEGORY_KEYS: Record<BmiCategory, TranslationKey> = {
  underweight: 'bmi_category_underweight',
  normal: 'bmi_category_normal',
  overweight: 'bmi_category_overweight',
  obese: 'bmi_category_obese',
  unknown: 'bmi_category_unknown',
};

export function parsePositiveNumber(raw: string | number | undefined | null): number | null {
  if (raw === '' || raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** TMI (BMI) = vazn (kg) / bo'y (m)² */
export function calculateBmi(weightKg: string | number, heightCm: string | number): BmiResult | null {
  const weight = parsePositiveNumber(weightKg);
  const height = parsePositiveNumber(heightCm);
  if (!weight || !height) return null;
  const heightM = height / 100;
  if (heightM <= 0) return null;
  const value = Math.round((weight / (heightM * heightM)) * 10) / 10;
  if (!Number.isFinite(value) || value < 8 || value > 80) return null;

  let category: BmiCategory = 'unknown';
  if (value < 18.5) category = 'underweight';
  else if (value < 25) category = 'normal';
  else if (value < 30) category = 'overweight';
  else category = 'obese';

  return { value, category, categoryKey: CATEGORY_KEYS[category] };
}

export function bmiCategoryColor(category: BmiCategory): string {
  switch (category) {
    case 'underweight':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'normal':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'overweight':
      return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'obese':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}
