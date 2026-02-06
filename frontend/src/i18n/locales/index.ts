
import { en, TranslationSet } from './en';
import { ru } from './ru';
import { uzC } from './uzC';
import { uzL } from './uzL';
import { kaa } from './kaa';
import type { Language } from '../LanguageContext';

export const translations: Record<Language, TranslationSet> = {
    'en': en,
    'ru': ru,
    'uz-C': uzC,
    'uz-L': uzL,
    'kaa': kaa,
};
