import { useContext } from 'react';
import { LanguageContext } from '../i18n/LanguageContext';
import { translations } from '../i18n/locales';
import type { uzL } from '../i18n/locales/uzL';

// A type for all possible translation keys, based on the uz-L (Latin) which is our primary set.
export type TranslationKey = keyof typeof uzL;

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  const { language, setLanguage } = context;

  const t = (key: TranslationKey, replacements?: { [key: string]: string | number }) => {
    // Fallback to Latin Uzbek if key is missing in the current language or if translations[language] is undefined.
    const languageStrings = translations[language] || translations['uz-L'];
    let translation = languageStrings[key] || translations['uz-L'][key] || key;
    
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = translation.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return translation;
  };

  return { t, setLanguage, language };
};
