import React, { useState } from 'react';
import { expandAbbreviation } from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const AbbreviationExpander: React.FC = () => {
    const { language } = useTranslation();
    const [abbreviation, setAbbreviation] = useState('CABG');
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExpand = async () => {
        if (!abbreviation.trim()) {
            setError("Iltimos, qisqartmani kiriting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setExplanation(null);
        try {
            // FIX: Added missing 'language' argument.
            const result = await expandAbbreviation(abbreviation, language);
            setExplanation(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Qisqartmani izohlashda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Tibbiy Qisqartmalar Lug'ati</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Tibbiy qisqartmani kiriting va uning to'liq shakli va qisqacha tavsifini oling.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.target.value)}
                    placeholder="Qisqartmani kiriting..."
                    className="flex-grow block w-full rounded-lg sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition px-4 py-2.5"
                    disabled={isLoading}
                />
                <button
                    onClick={handleExpand}
                    disabled={isLoading}
                    className="flex-shrink-0 flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all"
                >
                    {isLoading ? <><SpinnerIcon className="w-4 h-4" /> Izlanmoqda...</> : "Izohlash"}
                </button>
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            
            <div className="mt-8">
                {isLoading && (
                    <div className="text-center">
                        <SpinnerIcon className="w-8 h-8 mx-auto text-accent-color-cyan" />
                    </div>
                )}
                {explanation && (
                    <div className="animate-fade-in-up">
                        <div className="p-4 bg-slate-50 rounded-lg border border-border-color prose prose-sm max-w-none prose-p:my-2 prose-p:text-text-primary whitespace-pre-wrap">
                            {explanation}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AbbreviationExpander;