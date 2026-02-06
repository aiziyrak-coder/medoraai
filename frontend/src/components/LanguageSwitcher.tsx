
import React, { useState, useRef, useEffect } from 'react';
import ChevronDownIcon from './icons/ChevronDownIcon';
import type { Language } from '../i18n/LanguageContext';

const languageOptions: { id: Language; label: string; short: string; }[] = [
    { id: 'uz-C', label: "Ўзбекча (Кирилл)", short: "ЎЗБ" },
    { id: 'uz-L', label: "O'zbekcha (Lotin)", short: "O'ZB" },
    { id: 'kaa', label: "Qaraqalpaq tili", short: "QQP" },
    { id: 'ru', label: "Русский", short: "РУС" },
    { id: 'en', label: "English", short: "ENG" },
];

interface LanguageSwitcherProps {
    language: Language;
    onLanguageChange: (lang: Language) => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ language, onLanguageChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const currentLang = languageOptions.find(l => l.id === language) || languageOptions[0];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    const handleSelect = (lang: Language) => {
        onLanguageChange(lang);
        setIsOpen(false);
    };

    return (
        <div className="relative z-50" ref={wrapperRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 transition-all shadow-md backdrop-blur-md"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label="Change language"
            >
                <span className="text-sm font-bold tracking-wide">{currentLang.short}</span>
                <ChevronDownIcon className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-fade-in-up origin-top-right">
                    <ul className="py-1">
                        {languageOptions.map(option => (
                            <li key={option.id}>
                                <button
                                    onClick={() => handleSelect(option.id)}
                                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between
                                        ${language === option.id 
                                            ? 'bg-blue-600 text-white font-bold' 
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <span>{option.label}</span>
                                    {language === option.id && <span className="text-white">✓</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
