import type { TranslationKey } from '../i18n/translationKeys';

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese' | 'unknown';

export type BmiGrade =
  | 'severe_thinness'
  | 'moderate_thinness'
  | 'mild_thinness'
  | 'normal'
  | 'overweight'
  | 'obesity_1'
  | 'obesity_2'
  | 'obesity_3'
  | 'unknown';

export interface BmiResult {
  value: number;
  category: BmiCategory;
  categoryKey: TranslationKey;
  grade: BmiGrade;
  gradeKey: TranslationKey;
}

const CATEGORY_KEYS: Record<BmiCategory, TranslationKey> = {
  underweight: 'bmi_category_underweight',
  normal: 'bmi_category_normal',
  overweight: 'bmi_category_overweight',
  obese: 'bmi_category_obese',
  unknown: 'bmi_category_unknown',
};

const GRADE_KEYS: Record<BmiGrade, TranslationKey> = {
  severe_thinness: 'bmi_grade_severe_thinness',
  moderate_thinness: 'bmi_grade_moderate_thinness',
  mild_thinness: 'bmi_grade_mild_thinness',
  normal: 'bmi_grade_normal',
  overweight: 'bmi_grade_overweight',
  obesity_1: 'bmi_grade_obesity_1',
  obesity_2: 'bmi_grade_obesity_2',
  obesity_3: 'bmi_grade_obesity_3',
  unknown: 'bmi_category_unknown',
};

export function parsePositiveNumber(raw: string | number | undefined | null): number | null {
  if (raw === '' || raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** WHO bo'yicha TMI darajasi */
export function classifyBmiGrade(value: number): { category: BmiCategory; grade: BmiGrade } {
  if (value < 16) return { category: 'underweight', grade: 'severe_thinness' };
  if (value < 17) return { category: 'underweight', grade: 'moderate_thinness' };
  if (value < 18.5) return { category: 'underweight', grade: 'mild_thinness' };
  if (value < 25) return { category: 'normal', grade: 'normal' };
  if (value < 30) return { category: 'overweight', grade: 'overweight' };
  if (value < 35) return { category: 'obese', grade: 'obesity_1' };
  if (value < 40) return { category: 'obese', grade: 'obesity_2' };
  return { category: 'obese', grade: 'obesity_3' };
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

  const { category, grade } = classifyBmiGrade(value);

  return {
    value,
    category,
    categoryKey: CATEGORY_KEYS[category],
    grade,
    gradeKey: GRADE_KEYS[grade],
  };
}

export function bmiCategoryColor(category: BmiCategory, grade?: BmiGrade): string {
  if (grade === 'obesity_3') {
    return 'text-red-900 bg-red-100 border-red-300';
  }
  if (grade === 'obesity_2') {
    return 'text-red-800 bg-red-50 border-red-200';
  }
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
