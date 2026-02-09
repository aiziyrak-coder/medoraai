import React, { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { checkDrugInteractions } from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import AlertTriangleIcon from '../icons/AlertTriangleIcon';
import CheckCircleIcon from '../icons/CheckCircleIcon';

interface DrugInteraction {
    severity: 'High' | 'Moderate' | 'Low' | 'None';
    description: string;
    clinicalSignificance: string;
    recommendations: string[];
}

const DrugInteractionChecker: React.FC = () => {
    const { t, language } = useTranslation();
    const [drugs, setDrugs] = useState<string[]>(['', '']);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<DrugInteraction | null>(null);

    const handleAddDrug = () => {
        if (drugs.length < 10) {
            setDrugs([...drugs, '']);
        }
    };

    const handleRemoveDrug = (index: number) => {
        if (drugs.length > 2) {
            setDrugs(drugs.filter((_, i) => i !== index));
        }
    };

    const handleDrugChange = (index: number, value: string) => {
        const newDrugs = [...drugs];
        newDrugs[index] = value;
        setDrugs(newDrugs);
    };

    const handleCheck = async () => {
        const validDrugs = drugs.filter(d => d.trim());
        if (validDrugs.length < 2) {
            alert(t('alert_min_drugs'));
            return;
        }
        setIsAnalyzing(true);
        try {
            const interaction = await checkDrugInteractions(validDrugs, language);
            setResult(interaction);
        } catch (error) {
            alert(t('alert_error_generic'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        const s = severity.toLowerCase();
        if (s.includes('high') || s.includes('yuqori')) {
            return 'bg-red-100 text-red-800 border-red-300';
        }
        if (s.includes('moderate') || s.includes("o'rta") || s.includes('orta')) {
            return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        }
        if (s.includes('low') || s.includes('past')) {
            return 'bg-blue-100 text-blue-800 border-blue-300';
        }
        return 'bg-green-100 text-green-800 border-green-300';
    };

    const getSeverityIcon = (severity: string) => {
        const s = severity.toLowerCase();
        const isSafe = s.includes('none') || s.includes('xavfsiz') || s.includes("yo'q") || s.includes('yoq');
        return isSafe ? <CheckCircleIcon className="w-6 h-6" /> : <AlertTriangleIcon className="w-6 h-6" />;
    };

    return (
        <div className="w-full">
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/10 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
                        <span className="text-2xl">💊</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">{t('drug_interaction_title')}</h2>
                        <p className="text-xs text-slate-400">
                            {t('drug_interaction_desc')}
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    {drugs.map((drug, index) => (
                        <div key={index} className="flex gap-2">
                            <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center">
                                <span className="text-slate-400 font-bold text-sm">{index + 1}.</span>
                            </div>
                            <input
                                type="text"
                                value={drug}
                                onChange={(e) => handleDrugChange(index, e.target.value)}
                                placeholder={t('drug_name_placeholder')}
                                className="flex-1 px-3 py-2.5 bg-white text-slate-900 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm placeholder:text-slate-400"
                            />
                            {drugs.length > 2 && (
                                <button
                                    onClick={() => handleRemoveDrug(index)}
                                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 font-bold transition"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 mt-4">
                    {drugs.length < 10 && (
                        <button
                            onClick={handleAddDrug}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-semibold"
                        >
                            {t('drug_add_button')}
                        </button>
                    )}
                    <button
                        onClick={handleCheck}
                        disabled={isAnalyzing || drugs.filter(d => d.trim()).length < 2}
                        className="flex-1 animated-gradient-button text-white font-bold py-3 rounded-xl disabled:opacity-50"
                    >
                        {isAnalyzing ? (
                            <span className="flex items-center justify-center gap-2">
                                <SpinnerIcon className="w-5 h-5" /> {t('drug_checking')}
                            </span>
                        ) : t('drug_check_button')}
                    </button>
                </div>
            </div>

            {result && (
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-white/10 shadow-xl animate-fade-in-up mt-4">
                    <div className={`p-4 rounded-xl border-2 ${getSeverityColor(result.severity)} mb-4 flex items-center gap-3`}>
                        {getSeverityIcon(result.severity)}
                        <div>
                            <h3 className="font-bold text-lg">
                                {result.severity === 'None' ? t('drug_safe') : `${t('drug_severity_label')} ${result.severity}`}
                            </h3>
                            <p className="text-sm mt-1">{result.description}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-white mb-2">{t('drug_clinical_significance')}</h4>
                            <p className="text-slate-300">{result.clinicalSignificance}</p>
                        </div>

                        {result.recommendations.length > 0 && (
                            <div>
                                <h4 className="font-bold text-white mb-2">{t('drug_recommendations')}</h4>
                                <ul className="list-disc list-inside space-y-1 text-slate-300">
                                    {result.recommendations.map((rec, i) => (
                                        <li key={i}>{rec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrugInteractionChecker;
