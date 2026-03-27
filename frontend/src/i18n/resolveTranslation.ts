import type { Language } from './LanguageContext';
import { translations } from './locales';
import type { TranslationKey } from './translationKeys';

/**
 * Resolves a translation without falling back to Uzbek when English or Russian is active.
 */
export function resolveTranslation(language: Language, key: TranslationKey): string {
  const chain: Language[] = (() => {
    switch (language) {
      case 'en':
        return ['en'];
      case 'ru':
        return ['ru', 'en'];
      case 'uz-C':
        return ['uz-C', 'uz-L', 'en'];
      case 'uz-L':
        return ['uz-L', 'en'];
      case 'kaa':
        return ['kaa', 'en'];
      default:
        return ['en'];
    }
  })();

  for (const lang of chain) {
    const bundle = translations[lang];
    const val = bundle[key];
    if (typeof val === 'string' && val.length > 0) {
      return val;
    }
  }
  return String(key);
}
