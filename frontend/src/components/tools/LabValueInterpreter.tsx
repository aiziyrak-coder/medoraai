import React, { useState } from 'react';
import { interpretLabValue } from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const LabValueInterpreter: React.FC = () => {
    const { language } = useTranslation();
    const [labValue, setLabValue] = useState('K+ 5.9 mEq/L');
    const [interpretation, setInterpretation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInterpret = async () => {
        if (!labValue.trim()) {
            setError("Iltimos, tahlil natijasini kiriting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setInterpretation(null);
        try {
            // FIX: Added missing 'language' argument.
            const result = await interpretLabValue(labValue, language);
            setInterpretation(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Natijani izohlashda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Laboratoriya Tahlili Interpreteri</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Tahlil natijasini (masalan, "ALT 150 U/L" yoki "Gemoglobin 9.1 g/dL") kiriting va uning klinik ahamiyati haqida tezkor ma'lumot oling.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={labValue}
                    onChange={(e) => setLabValue(e.target.value)}
                    placeholder="Tahlil natijasini kiriting..."
                    className="flex-grow block w-full rounded-lg sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition px-4 py-2.5"
                    disabled={isLoading}
                />
                <button
                    onClick={handleInterpret}
                    disabled={isLoading}
                    className="flex-shrink-0 flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all"
                >
                    {isLoading ? <><SpinnerIcon className="w-4 h-4" /> Izohlanmoqda...</> : "Izohlash"}
                </button>
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            
            <div className="mt-8">
                {isLoading && (
                    <div className="text-center">
                        <SpinnerIcon className="w-8 h-8 mx-auto text-accent-color-cyan" />
                    </div>
                )}
                {interpretation && (
                    <div className="animate-fade-in-up">
                        <h4 className="text-lg font-semibold text-text-primary mb-2">Klinik Izoh:</h4>
                        <div className="p-4 bg-slate-50 rounded-lg border border-border-color prose prose-sm max-w-none prose-p:my-2 prose-p:text-text-primary whitespace-pre-wrap">
                            {interpretation}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LabValueInterpreter;