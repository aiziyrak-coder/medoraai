import React, { useState } from 'react';
import { searchClinicalGuidelines } from '../../services/aiCouncilService';
import type { GuidelineSearchResult } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import GlobeIcon from '../icons/GlobeIcon';
import { useTranslation } from '../../hooks/useTranslation';

const GuidelineNavigator: React.FC = () => {
    const { language } = useTranslation();
    const [query, setQuery] = useState('Type 2 Diabetes Mellitus treatment');
    const [result, setResult] = useState<GuidelineSearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) {
            setError("Iltimos, izlash uchun kasallik nomini kiriting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            // FIX: Added missing 'language' argument.
            const searchResult = await searchClinicalGuidelines(query, language);
            setResult(searchResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Noma'lum xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Klinik Qo'llanmalar Navigatori</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Kasallik nomini kiriting va so'nggi xalqaro klinik qo'llanmalar asosida AI tomonidan tayyorlangan xulosani oling.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kasallik yoki holatni kiriting..."
                    className="flex-grow block w-full rounded-lg sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition px-4 py-2.5"
                    disabled={isLoading}
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="flex-shrink-0 flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all"
                >
                    {isLoading ? <><SpinnerIcon className="w-4 h-4" /> Izlanmoqda...</> : "Qidirish"}
                </button>
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            
            <div className="mt-8">
                {isLoading && (
                    <div className="text-center">
                        <SpinnerIcon className="w-8 h-8 mx-auto text-accent-color-cyan" />
                        <p className="mt-2 font-semibold">Google Scholar va PubMed tahlil qilinmoqda...</p>
                    </div>
                )}
                {result && (
                    <div className="animate-fade-in-up">
                        <h4 className="text-lg font-bold text-text-primary mb-4">"{query}" bo'yicha xulosa:</h4>
                        <div className="p-4 bg-slate-50 rounded-lg border border-border-color prose prose-sm max-w-none prose-p:my-2 prose-p:text-text-primary whitespace-pre-wrap">
                           {result.summary}
                        </div>
                        
                        {result.sources.length > 0 && (
                            <div className="mt-6">
                                <h5 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                                    <GlobeIcon className="w-5 h-5 text-sky-500" />
                                    Manbalar:
                                </h5>
                                <ul className="space-y-2">
                                    {result.sources.map((source, index) => (
                                        <li key={index} className="text-sm truncate">
                                            <a
                                                href={source.uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-accent-color-blue hover:text-accent-color-cyan hover:underline transition-colors break-words"
                                                title={source.title}
                                            >
                                                - {source.title || source.uri}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuidelineNavigator;