import React, { useState } from 'react';
import { generateInsurancePreAuth } from '../../services/aiCouncilService';
import type { PatientData, FinalReport } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const InsurancePreAuthTool: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { t, language } = useTranslation();
    const [procedure, setProcedure] = useState('');
    const [patientName, setPatientName] = useState('');
    const [age, setAge] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [justification, setJustification] = useState('');
    const [draft, setDraft] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!procedure.trim()) {
            setError('Muolaja nomini kiriting.');
            return;
        }
        if (!diagnosis.trim()) {
            setError('Tashxisni kiriting.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setDraft(null);
        const patientData: PatientData = {
            firstName: patientName,
            lastName: '',
            age,
            gender: '', // PatientData models 'not specified' as '' - this tool never collects gender
            complaints: justification,
            history: '',
        };
        const finalReport: FinalReport = {
            consensusDiagnosis: [
                { name: diagnosis, probability: 90, justification, evidenceLevel: 'Moderate' },
            ],
            rejectedHypotheses: [],
            recommendedTests: [],
            treatmentPlan: [procedure],
            medicationRecommendations: [],
            unexpectedFindings: '',
        };
        try {
            const result = await generateInsurancePreAuth(patientData, finalReport, procedure, language);
            setDraft(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Xat yaratishda xatolik.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 md:p-8">
            {onBack && (
                <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline mb-6">
                    &larr; Orqaga
                </button>
            )}
            <h3 className="text-xl font-bold text-text-primary">Sug'urta uchun ruxsatnoma xati</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">Bemor va muolaja ma'lumotlarini kiriting.</p>

            <div className="space-y-3 mb-4">
                <input className="common-input w-full" placeholder="Muolaja nomi *" value={procedure} onChange={(e) => setProcedure(e.target.value)} />
                <input className="common-input w-full" placeholder="Bemor ismi" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                <input className="common-input w-full" placeholder="Yosh" value={age} onChange={(e) => setAge(e.target.value)} />
                <input className="common-input w-full" placeholder="Tashxis *" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                <textarea className="common-input w-full" rows={3} placeholder="Klinik asos / shikoyatlar" value={justification} onChange={(e) => setJustification(e.target.value)} />
            </div>

            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button disabled:opacity-70"
            >
                {isLoading ? <><SpinnerIcon className="w-5 h-5" /> Yaratilmoqda...</> : 'Xat yaratish'}
            </button>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

            {draft && (
                <div className="mt-8 animate-fade-in-up">
                    <textarea readOnly value={draft} rows={16} className="block w-full sm:text-sm common-input bg-slate-50" />
                </div>
            )}
        </div>
    );
};

export default InsurancePreAuthTool;
