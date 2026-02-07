import React, { useState } from 'react';
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
    const [drugs, setDrugs] = useState<string[]>(['', '']);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<DrugInteraction | null>(null);
    const [language] = useState<'uz-L'>('uz-L');

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
            alert('Kamida 2 ta dori kiriting');
            return;
        }
        setIsAnalyzing(true);
        try {
            const interaction = await checkDrugInteractions(validDrugs, language);
            setResult(interaction);
        } catch (error) {
            alert('Xatolik yuz berdi. Qayta urinib ko\'ring.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'High': return 'bg-red-100 text-red-800 border-red-300';
            case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'Low': return 'bg-blue-100 text-blue-800 border-blue-300';
            default: return 'bg-green-100 text-green-800 border-green-300';
        }
    };

    const getSeverityIcon = (severity: string) => {
        return severity === 'None' ? <CheckCircleIcon className="w-6 h-6" /> : <AlertTriangleIcon className="w-6 h-6" />;
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-2">💊 Dori O'zaro Tasiri</h2>
                <p className="text-sm text-slate-300 mb-6">Bir necha dori birgalikda ishlatilganda xavf-xatarlarni tekshiring</p>

                <div className="space-y-3">
                    {drugs.map((drug, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={drug}
                                onChange={(e) => handleDrugChange(index, e.target.value)}
                                placeholder={`Dori ${index + 1} nomi (masalan: Aspirin, Metformin...)`}
                                className="flex-1 px-4 py-3 bg-white/90 text-slate-900 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                            {drugs.length > 2 && (
                                <button
                                    onClick={() => handleRemoveDrug(index)}
                                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-bold"
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
                            + Dori qo'shish
                        </button>
                    )}
                    <button
                        onClick={handleCheck}
                        disabled={isAnalyzing || drugs.filter(d => d.trim()).length < 2}
                        className="flex-1 animated-gradient-button text-white font-bold py-3 rounded-xl disabled:opacity-50"
                    >
                        {isAnalyzing ? (
                            <span className="flex items-center justify-center gap-2">
                                <SpinnerIcon className="w-5 h-5" /> Tekshirilmoqda...
                            </span>
                        ) : 'Tekshirish'}
                    </button>
                </div>
            </div>

            {result && (
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-white/10 animate-fade-in-up">
                    <div className={`p-4 rounded-xl border-2 ${getSeverityColor(result.severity)} mb-4 flex items-center gap-3`}>
                        {getSeverityIcon(result.severity)}
                        <div>
                            <h3 className="font-bold text-lg">
                                {result.severity === 'None' ? 'Xavfsiz' : `Xavf darajasi: ${result.severity}`}
                            </h3>
                            <p className="text-sm mt-1">{result.description}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-white mb-2">🔬 Klinik ahamiyati:</h4>
                            <p className="text-slate-300">{result.clinicalSignificance}</p>
                        </div>

                        {result.recommendations.length > 0 && (
                            <div>
                                <h4 className="font-bold text-white mb-2">📋 Tavsiyalar:</h4>
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
