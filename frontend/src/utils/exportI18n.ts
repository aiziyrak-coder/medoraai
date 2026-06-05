import type { Language } from '../i18n/LanguageContext';
import { resolveTranslation } from '../i18n/resolveTranslation';
import type { TranslationKey } from '../i18n/translationKeys';
import type { ExportTr } from './exportReportSections';

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
    if (fallback) return fallback;
    const en = resolveTranslation('en', key as TranslationKey);
    return en !== key ? en : key;
  };
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
