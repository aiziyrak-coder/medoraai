import React, { useState } from 'react';
import { getIcd10Codes } from '../../services/aiCouncilService';
import type { Icd10Code } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const MedicalCodingAssistant: React.FC = () => {
    const { language } = useTranslation();
    const [diagnosis, setDiagnosis] = useState('O\'tkir miokard infarkti, oldingi devor');
    const [codes, setCodes] = useState<Icd10Code[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!diagnosis.trim()) {
            setError("Iltimos, kodlarni topish uchun tashxisni kiriting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setCodes(null);
        try {
            // FIX: Added missing 'language' argument.
            const result = await getIcd10Codes(diagnosis, language);
            setCodes(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Kodlarni olishda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Tibbiy Kodlash Yordamchisi (ICD-10)</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Tashxis yoki klinik holatni kiriting va mos keladigan ICD-10 kodlari ro'yxatini oling.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Tashxisni kiriting..."
                    className="flex-grow block w-full rounded-lg sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition px-4 py-2.5"
                    disabled={isLoading}
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="flex-shrink-0 flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all"
                >
                    {isLoading ? (
                        <>
                            <SpinnerIcon className="w-4 h-4" />
                            Izlanmoqda...
                        </>
                    ) : "Kodlarni Topish"}
                </button>
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            
            <div className="mt-8">
                {codes && codes.length > 0 && (
                    <div className="space-y-3">
                         <h4 className="text-lg font-semibold text-text-primary">Tavsiya etilgan kodlar:</h4>
                        {codes.map((item, index) => (
                            <div key={index} className="p-4 bg-slate-50 rounded-lg border border-border-color">
                                <p className="font-bold text-accent-color-blue text-lg font-mono">{item.code}</p>
                                <p className="text-text-primary">{item.description}</p>
                            </div>
                        ))}
                    </div>
                )}
                 {codes && codes.length === 0 && (
                     <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="font-semibold text-yellow-700">Ushbu so'rov uchun mos kodlar topilmadi.</p>
                        <p className="text-sm text-yellow-600">Iltimos, tashxisni aniqroq kiritib ko'ring.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MedicalCodingAssistant;