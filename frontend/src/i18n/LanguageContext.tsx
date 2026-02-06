
import React, { createContext, useState, ReactNode } from 'react';

export type Language = 'uz-L' | 'uz-C' | 'kaa' | 'ru' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (language: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Default language set to Uzbek Cyrillic ('uz-C') as requested
    const [language, setLanguage] = useState<Language>('uz-C');
    
    return (
        <LanguageContext.Provider value={{ language, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};
