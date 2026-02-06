import React, { useState } from 'react';
import { calculateRiskScore } from '../../services/aiCouncilService';
import type { PatientData, RiskScore } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const mockPatientData: PatientData = {
    firstName: 'Test',
    lastName: 'Bemor',
    age: '68',
    gender: 'male',
    complaints: '',
    history: 'Gipertoniya, Qandli diabet',
};


const RiskScoringTool: React.FC = () => {
    const { language } = useTranslation();
    const [scoreType, setScoreType] = useState('CHADS-VASc');
    const [result, setResult] = useState<RiskScore | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCalculate = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            // FIX: Added missing 'language' argument.
            const scoreResult = await calculateRiskScore(scoreType, mockPatientData, language);
            setResult(scoreResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Xavfni hisoblashda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Klinik Xavf Skoring Kalkulyatori</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Kerakli xavf shkalasini tanlang va bemor ma'lumotlari asosida hisoblash uchun bosing (hozirda demo ma'lumotlar ishlatilmoqda).
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-grow">
                     <label htmlFor="scoreType" className="block text-sm font-medium text-text-secondary mb-1">Xavf Shkalasi</label>
                    <select id="scoreType" value={scoreType} onChange={e => setScoreType(e.target.value)} className="w-full common-input custom-select">
                        <option value="CHADS-VASc">CHADS-VASc (Insult xavfi)</option>
                        <option value="ASCVD">ASCVD (Yurak-qon tomir xavfi)</option>
                        <option value="HEART">HEART Score (Ko'krak og'rig'i)</option>
                    </select>
                </div>
                 <button
                    onClick={handleCalculate}
                    disabled={isLoading}
                    className="w-full sm:w-auto flex-shrink-0 flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button disabled:opacity-70"
                >
                    {isLoading ? <><SpinnerIcon className="w-4 h-4" /> Hisoblanmoqda...</> : "Hisoblash"}
                </button>
            </div>


            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            
            <div className="mt-8">
                {result && (
                    <div className="animate-fade-in-up p-4 bg-slate-50 rounded-lg border border-border-color">
                        <h4 className="text-lg font-bold text-text-primary">{result.name} Natijasi</h4>
                        <p className="text-3xl font-extrabold text-accent-color-blue my-2">{result.score}</p>
                        <p className="text-sm text-text-secondary">{result.interpretation}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RiskScoringTool;