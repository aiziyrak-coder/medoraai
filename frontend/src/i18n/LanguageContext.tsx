
import React, { createContext, useState, ReactNode } from 'react';

export type Language = 'uz-L' | 'uz-C' | 'kaa' | 'ru' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (language: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Default: Uzbek Latin (uz-L)
    // Check localStorage for saved preference, otherwise default to uz-L
    const getInitialLanguage = (): Language => {
        // Try to get saved language from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('preferred_language') as Language | null;
            
            // Migration: If Russian is saved, clear it and default to Uzbek (new default)
            // This ensures all users see Uzbek by default after this update
            if (saved === 'ru') {
                localStorage.removeItem('preferred_language');
                return 'uz-L';
            }
            
            if (saved && ['uz-L', 'uz-C', 'kaa', 'ru', 'en'].includes(saved)) {
                return saved;
            }
        }
        // Default to Uzbek Latin if no saved preference
        return 'uz-L';
    };
    
    const [language, setLanguageState] = useState<Language>(getInitialLanguage());
    
    const setLanguage = (newLanguage: Language) => {
        setLanguageState(newLanguage);
        // Save preference to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('preferred_language', newLanguage);
        }
    };
    
    return (
        <LanguageContext.Provider value={{ language, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};