import { useContext } from 'react';
import { LanguageContext } from '../i18n/LanguageContext';
import { resolveTranslation } from '../i18n/resolveTranslation';
import type { TranslationKey } from '../i18n/translationKeys';

export type { TranslationKey };

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  const { language, setLanguage } = context;

  const t = (key: TranslationKey, replacements?: { [key: string]: string | number }) => {
    let translation = resolveTranslation(language, key);

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = translation.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return translation;
  };

  return { t, setLanguage, language };
};