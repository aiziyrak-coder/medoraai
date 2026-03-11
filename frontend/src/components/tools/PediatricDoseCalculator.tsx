import React, { useState } from 'react';
import { calculatePediatricDose } from '../../services/aiCouncilService';
import type { PediatricDose } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const PediatricDoseCalculator: React.FC = () => {
    const { language } = useTranslation();
    const [drugName, setDrugName] = useState('Amoxicillin');
    const [weight, setWeight] = useState('10');
    const [result, setResult] = useState<PediatricDose | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCalculate = async () => {
        const weightNum = parseFloat(weight);
        if (!drugName.trim() || isNaN(weightNum) || weightNum <= 0) {
            setError("Iltimos, dori nomi va to'g'ri tana vaznini kiriting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            // FIX: Added missing 'language' argument.
            const doseResult = await calculatePediatricDose(drugName, weightNum, language);
            setResult(doseResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Dozani hisoblashda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Pediatrik Doza Kalkulyatori</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Dori nomi va bolaning tana vaznini (kg) kiriting va tavsiya etilgan dozani oling.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                    <label htmlFor="drugName" className="block text-sm font-medium text-text-secondary mb-1">Dori Nomi</label>
                    <input type="text" id="drugName" value={drugName} onChange={e => setDrugName(e.target.value)} className="block w-full sm:text-sm common-input" />
                </div>
                <div>
                     <label htmlFor="weight" className="block text-sm font-medium text-text-secondary mb-1">Tana vazni (kg)</label>
                     <input type="number" id="weight" value={weight} onChange={e => setWeight(e.target.value)} className="block w-full sm:text-sm common-input" />
                </div>
            </div>
            
             <button
                onClick={handleCalculate}
                disabled={isLoading}
                className="w-full mt-4 flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button disabled:opacity-70"
            >
                {isLoading ? <><SpinnerIcon className="w-5 h-5" /> Hisoblanmoqda...</> : "Dozani Hisoblash"}
            </button>


            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            
            <div className="mt-8">
                {result && (
                    <div className="animate-fade-in-up space-y-4">
                        <div className="text-center p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <p className="text-sm font-semibold text-blue-700">{result.drugName} uchun tavsiya etilgan doza:</p>
                            <p className="text-3xl font-bold text-blue-800 my-2">{result.dose}</p>
                            <p className="text-xs text-slate-500 italic">({result.calculation})</p>
                        </div>
                        {result.warnings.length > 0 && (
                            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                                <h4 className="font-semibold text-yellow-800">Ogohlantirishlar:</h4>
                                <ul className="list-disc list-inside text-sm text-yellow-700">
                                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PediatricDoseCalculator;