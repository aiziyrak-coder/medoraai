
import React, { useState, useEffect, useMemo } from 'react';
import { AIModel } from '../types';
import { AI_SPECIALISTS } from '../constants';
import AIAvatar from './AIAvatar';
import SpinnerIcon from './icons/SpinnerIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import UsersIcon from './icons/UsersIcon';
import SearchIcon from './icons/SearchIcon';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';

interface TeamRecommendationViewProps {
    recommendations: { model: AIModel; reason: string }[] | null;
    isProcessing: boolean;
    onConfirm: (confirmedTeam: { role: AIModel, backEndModel: string }[], orchestratorModel: string) => void;
}

// Internal constant for the most powerful model - not shown to user
const INTERNAL_BEST_MODEL = "Gemini 3.0 Pro";

const TeamRecommendationView: React.FC<TeamRecommendationViewProps> = ({ recommendations, isProcessing, onConfirm }) => {
    const { t } = useTranslation();
    const [selectedSpecialists, setSelectedSpecialists] = useState<Set<AIModel>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    // Initialize state when recommendations load
    useEffect(() => {
        if (recommendations) {
            const initialSelection = new Set<AIModel>();

            // Pre-select recommended specialists
            recommendations.forEach(r => {
                initialSelection.add(r.model);
            });

            setSelectedSpecialists(initialSelection);
        }
    }, [recommendations]);

    const toggleSpecialist = (model: AIModel) => {
        const newSelection = new Set(selectedSpecialists);
        if (newSelection.has(model)) {
            newSelection.delete(model);
        } else {
            if (newSelection.size >= 10) {
                alert("Maksimal 10 ta mutaxassis tanlash mumkin.");
                return;
            }
            newSelection.add(model);
        }
        setSelectedSpecialists(newSelection);
    };

    const handleConfirm = () => {
        if (selectedSpecialists.size < 4) {
            alert("Iltimos, kamida 4 ta mutaxassis tanlang.");
            return;
        }
        // Automatically assign the best model to all selected roles
        const teamPayload = Array.from(selectedSpecialists).map(role => ({
            role,
            backEndModel: INTERNAL_BEST_MODEL
        }));
        onConfirm(teamPayload, INTERNAL_BEST_MODEL);
    };

    // Filter and Sort Specialists
    const filteredSpecialists = useMemo(() => {
        const allSpecialists = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM);
        return allSpecialists.filter(model => {
            const specInfo = AI_SPECIALISTS[model];
            const searchLower = searchTerm.toLowerCase();
            // Type assertion is safe here - translation function has fallback to return key if not found
            const specialtyTranslation = t(`specialty_${model.toLowerCase()}` as TranslationKey);
            return (
                specInfo.name.toLowerCase().includes(searchLower) ||
                specInfo.specialty.toLowerCase().includes(searchLower) ||
                specialtyTranslation.toLowerCase().includes(searchLower)
            );
        }).sort((a, b) => {
            // Sort: Selected first, then Recommended, then Alphabetical
            const isSelA = selectedSpecialists.has(a);
            const isSelB = selectedSpecialists.has(b);
            if (isSelA !== isSelB) return isSelA ? -1 : 1;

            const isRecA = recommendations?.some(r => r.model === a);
            const isRecB = recommendations?.some(r => r.model === b);
            if (isRecA !== isRecB) return isRecA ? -1 : 1;

            return AI_SPECIALISTS[a].name.localeCompare(AI_SPECIALISTS[b].name);
        });
    }, [recommendations, selectedSpecialists, searchTerm, t]);

    if (isProcessing || !recommendations) {
        return (
            <div className="glass-panel animate-fade-in-up p-12 text-center flex flex-col items-center justify-center h-full">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
                    <SpinnerIcon className="w-16 h-16 text-accent-color-cyan relative z-10" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-text-primary">Ekspertlar tahlil qilinmoqda...</h3>
                <p className="text-text-secondary mt-2">Bemor ma'lumotlariga asoslangan eng kuchli jamoa shakllantirilmoqda.</p>
            </div>
        );
    }

    return (
        <div className="glass-panel p-6 animate-fade-in-up flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 mb-4 text-center">
                <h2 className="text-2xl font-black text-transparent bg-clip-text animated-gradient-text tracking-tight mb-2">
                    Konsilium Tarkibini Shakllantirish
                </h2>
                <p className="text-sm text-text-secondary max-w-2xl mx-auto">
                    Tanlangan: <span className="font-bold text-accent-color-blue">{selectedSpecialists.size}</span> (Min: 4, Max: 10).
                    <br/>
                    <span className="text-xs opacity-70">Barcha mutaxassislar eng so'nggi va kuchli sun'iy intellekt modeli asosida ishlaydi.</span>
                </p>
            </div>

            {/* Orchestrator Info (Fixed, no selection) */}
            <div className="flex-shrink-0 mb-4 p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-center justify-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <UsersIcon className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-text-primary">Konsilium Raisi (Orkestrator)</h4>
                    <p className="text-[10px] text-text-secondary">Munozarani boshqaruvchi bosh tizim</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex-shrink-0 mb-4 relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Mutaxassisni qidirish (masalan: Kardiolog)..."
                    className="common-input w-full pl-10 py-2.5"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>

            {/* Specialists List */}
            <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar bg-slate-50/50 rounded-xl border border-border-color">
                <div className="divide-y divide-slate-200">
                    {filteredSpecialists.map((model) => {
                        const specialistInfo = AI_SPECIALISTS[model];
                        const recommendation = recommendations.find(r => r.model === model);
                        const isSelected = selectedSpecialists.has(model);

                        return (
                            <div 
                                key={model}
                                onClick={() => toggleSpecialist(model)}
                                className={`
                                    relative p-3 flex items-center gap-3 transition-colors cursor-pointer group
                                    ${isSelected ? 'bg-blue-50/60' : 'hover:bg-white'}
                                `}
                            >
                                {/* Checkbox */}
                                <div className={`
                                    w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all
                                    ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300 group-hover:border-blue-400'}
                                `}>
                                    {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                                </div>

                                {/* Avatar */}
                                <AIAvatar model={model} size="sm" />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`font-bold text-sm truncate ${isSelected ? 'text-blue-800' : 'text-text-primary'}`}>
                                            {specialistInfo.name.split('(')[0].trim()} {/* Removes AI model name from display name if present in brackets */}
                                        </p>
                                        {recommendation && (
                                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold uppercase rounded tracking-wide">
                                                Tavsiya
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-secondary truncate">{specialistInfo.specialty}</p>
                                    {recommendation && isSelected && (
                                        <p className="text-[10px] text-blue-600 mt-0.5 leading-tight">
                                            {recommendation.reason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredSpecialists.length === 0 && (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            Mutaxassis topilmadi.
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Action */}
            <div className="flex-shrink-0 pt-4 mt-2 border-t border-border-color bg-white/50 backdrop-blur-sm">
                <button
                    onClick={handleConfirm}
                    disabled={selectedSpecialists.size < 4}
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-6 shadow-lg shadow-blue-500/30 text-base font-bold text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {selectedSpecialists.size < 4 
                        ? `Kamida 4 ta tanlang (${selectedSpecialists.size}/4)`
                        : `${selectedSpecialists.size} ta mutaxassis bilan Konsiliumni Boshlash`
                    }
                </button>
            </div>
        </div>
    );
};

export default TeamRecommendationView;
