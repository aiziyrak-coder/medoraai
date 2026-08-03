import type { Language } from '../i18n/LanguageContext';
import { resolveTranslation } from '../i18n/resolveTranslation';
import type { TranslationKey } from '../i18n/translationKeys';
import type { ExportTr } from './exportReportSections';
import { parseObjectiveData } from '../components/analysis/ObjectiveVitalsCards';

/** jsPDF 4.x requires string arguments for doc.text */
export function pdfText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(pdfText).filter(Boolean).join(', ');
  return String(value);
}

const DATE_LOCALES: Record<Language, string> = {
  'uz-L': 'uz-UZ',
  'uz-C': 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-GB',
  kaa: 'uz-UZ',
};

export function formatExportDate(language: Language, date = new Date()): string {
  const locale = DATE_LOCALES[language] ?? 'en-GB';
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function createExportTr(
  language: Language,
  t?: (key: TranslationKey, replacements?: { [key: string]: string | number }) => string,
): ExportTr {
  return (key: string, fallback?: string) => {
    if (t) {
      const fromHook = t(key as TranslationKey);
      if (fromHook && fromHook !== key) return fromHook;
    }
    const resolved = resolveTranslation(language, key as TranslationKey);
    if (resolved && resolved !== key) return resolved;
    // RU/EN/KAA: o'zbekcha hardcoded fallback o'rniga inglizcha
    if (language !== 'uz-L' && language !== 'uz-C') {
      const en = resolveTranslation('en', key as TranslationKey);
      if (en && en !== key) return en;
    }
    if (fallback) return fallback;
    const en = resolveTranslation('en', key as TranslationKey);
    return en !== key ? en : key;
  };
}

/** PDF/DOCX uchun vital matnni joriy til yorliqlari bilan formatlash */
export function formatObjectiveForExport(
  objectiveData: string | undefined,
  tr: (key: string, fallback?: string) => string,
): string {
  if (!objectiveData?.trim()) return '';
  const v = parseObjectiveData(objectiveData);
  if (v.raw) return String(v.raw);
  const lines: string[] = [];
  const push = (key: keyof typeof v, labelKey: string, fb: string, unit?: string) => {
    const val = v[key];
    if (!val || key === 'raw') return;
    const clean = String(val).replace(/\s+(mm\.Hg|bpm|°C|%|\/min|kg|cm)\s*$/i, '').trim();
    lines.push(`${tr(labelKey, fb)}: ${clean}${unit ? ` ${unit}` : ''}`);
  };
  push('bp', 'data_form_vitals_summary_bp', 'Blood pressure', 'mm.Hg');
  push('pulse', 'data_form_vitals_summary_pulse', 'Pulse', 'bpm');
  push('temp', 'data_form_vitals_summary_temp', 'Temperature', '°C');
  push('spo2', 'data_form_vitals_summary_spo2', 'SpO2', '%');
  push('respiration', 'data_form_vitals_summary_resp', 'Respiration', '/min');
  push('weight', 'data_form_vitals_summary_weight', 'Weight', 'kg');
  push('height', 'data_form_vitals_summary_height', 'Height', 'cm');
  push('bmi', 'data_form_vitals_summary_bmi', 'BMI');
  return lines.length ? lines.join('\n') : objectiveData.trim();
}

export function exportFileSlug(language: Language): string {
  const slugs: Record<Language, string> = {
    'uz-L': 'Konsilium',
    'uz-C': 'Konsilium',
    ru: 'Konsilium',
    en: 'Consilium',
    kaa: 'Konsilium',
  };
  return slugs[language] ?? 'Consilium';
}

export function sanitizeExportFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'report';
}
