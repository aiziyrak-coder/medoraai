import React, { useState } from 'react';
import { generateDischargeSummary } from '../../services/aiCouncilService';
import type { PatientData, FinalReport } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const DischargeSummaryTool: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { t, language } = useTranslation();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [complaints, setComplaints] = useState('');
    const [history, setHistory] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [treatmentPlan, setTreatmentPlan] = useState('');
    const [medications, setMedications] = useState('');
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!diagnosis.trim()) {
            setError('Tashxisni kiriting.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSummary(null);
        const patientData: PatientData = {
            firstName,
            lastName,
            age,
            gender: 'unknown',
            complaints,
            history,
        };
        const finalReport: FinalReport = {
            consensusDiagnosis: [
                { name: diagnosis, probability: 90, justification: complaints, evidenceLevel: 'Moderate' },
            ],
            rejectedHypotheses: [],
            recommendedTests: [],
            treatmentPlan: treatmentPlan.split('\n').map((s) => s.trim()).filter(Boolean),
            medicationRecommendations: medications
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((line) => ({ name: line, dosage: '', notes: '' })),
            unexpectedFindings: '',
        };
        try {
            const result = await generateDischargeSummary(patientData, finalReport, language);
            setSummary(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Xulosa yaratishda xatolik yuz berdi.');
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
            <h3 className="text-xl font-bold text-text-primary">{t('tools_document_generator_title')}</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">Bemor ma'lumotlarini kiriting va chiqish xulosasini yarating.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <input className="common-input" placeholder="Ism" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className="common-input" placeholder="Familiya" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                <input className="common-input" placeholder="Yosh" value={age} onChange={(e) => setAge(e.target.value)} />
                <input className="common-input md:col-span-2" placeholder="Shikoyatlar" value={complaints} onChange={(e) => setComplaints(e.target.value)} />
                <textarea className="common-input md:col-span-2" rows={2} placeholder="Anamnez" value={history} onChange={(e) => setHistory(e.target.value)} />
                <input className="common-input md:col-span-2" placeholder="Asosiy tashxis *" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                <textarea className="common-input md:col-span-2" rows={3} placeholder="Davolash rejasi (har qator — bitta qadam)" value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} />
                <textarea className="common-input md:col-span-2" rows={2} placeholder="Dorilar (har qator — bitta dori)" value={medications} onChange={(e) => setMedications(e.target.value)} />
            </div>

            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button disabled:opacity-70"
            >
                {isLoading ? <><SpinnerIcon className="w-5 h-5" /> Generatsiya qilinmoqda...</> : 'Xulosa yaratish'}
            </button>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

            {summary && (
                <div className="mt-8 animate-fade-in-up">
                    <h4 className="text-lg font-semibold text-text-primary mb-2">Xulosa:</h4>
                    <textarea readOnly value={summary} rows={15} className="block w-full sm:text-sm common-input bg-slate-50" />
                </div>
            )}
        </div>
    );
};

export default DischargeSummaryTool;
