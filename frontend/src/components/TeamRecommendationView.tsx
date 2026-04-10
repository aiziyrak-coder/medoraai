
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AIModel } from '../types';
import { AI_SPECIALISTS } from '../constants';
import AIAvatar from './AIAvatar';
import SpinnerIcon from './icons/SpinnerIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import UsersIcon from './icons/UsersIcon';
import SearchIcon from './icons/SearchIcon';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { LIMITS } from '../constants/timeouts';

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
    const listScrollRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Partial<Record<AIModel, HTMLDivElement | null>>>({});

    // Initialize state when recommendations load - with null safety
    useEffect(() => {
        if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
            const initialSelection = new Set<AIModel>();
            // Pre-select top 6 recommended (max 10, min 4)
            recommendations.slice(0, Math.min(6, recommendations.length)).forEach(r => {
                if (r?.model) {
                    initialSelection.add(r.model);
                }
            });
            setSelectedSpecialists(initialSelection);
        }
    }, [recommendations]);

    const scrollToItem = useCallback((model: AIModel) => {
        const el = itemRefs.current[model];
        const container = listScrollRef.current;
        if (!el || !container) return;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        if (elTop < containerTop) {
            container.scrollTo({ top: elTop - 8, behavior: 'smooth' });
        } else if (elBottom > containerBottom) {
            container.scrollTo({ top: elBottom - container.clientHeight + 8, behavior: 'smooth' });
        }
    }, []);

    const toggleSpecialist = (model: AIModel) => {
        const newSelection = new Set(selectedSpecialists);
        if (newSelection.has(model)) {
            newSelection.delete(model);
        } else {
            if (newSelection.size >= LIMITS.MAX_SPECIALISTS) {
                alert(t('alert_max_specialists').replace('{max}', String(LIMITS.MAX_SPECIALISTS)));
                return;
            }
            newSelection.add(model);
            // Tanlangan cardga scroll qilamiz
            requestAnimationFrame(() => scrollToItem(model));
        }
        setSelectedSpecialists(newSelection);
    };

    const handleConfirm = () => {
        if (selectedSpecialists.size < LIMITS.MIN_SPECIALISTS) {
            alert(t('alert_min_specialists').replace('{min}', String(LIMITS.MIN_SPECIALISTS)));
            return;
        }
        // Automatically assign the best model to all selected roles
        const teamPayload = Array.from(selectedSpecialists).map(role => ({
            role,
            backEndModel: INTERNAL_BEST_MODEL
        }));
        onConfirm(teamPayload, INTERNAL_BEST_MODEL);
    };

    // Filter and Sort Specialists - with null safety
    const filteredSpecialists = useMemo(() => {
        const allSpecialists = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM);
        const safeRecommendations = recommendations && Array.isArray(recommendations) ? recommendations : [];
        
        return allSpecialists.filter(model => {
            const specInfo = AI_SPECIALISTS[model];
            if (!specInfo) return false;
            const searchLower = (searchTerm ?? '').toLowerCase();
            const specialtyTranslation = t(`specialty_${model.toLowerCase()}` as TranslationKey);
            return (
                (specInfo.name ?? '').toLowerCase().includes(searchLower) ||
                (specInfo.specialty ?? '').toLowerCase().includes(searchLower) ||
                (specialtyTranslation ?? '').toLowerCase().includes(searchLower)
            );
        }).sort((a, b) => {
            // Sort: Selected first, then Recommended, then Alphabetical
            const isSelA = selectedSpecialists.has(a);
            const isSelB = selectedSpecialists.has(b);
            if (isSelA !== isSelB) return isSelA ? -1 : 1;

            const isRecA = safeRecommendations.some(r => r?.model === a);
            const isRecB = safeRecommendations.some(r => r?.model === b);
            if (isRecA !== isRecB) return isRecA ? -1 : 1;

            return AI_SPECIALISTS[a].name.localeCompare(AI_SPECIALISTS[b].name);
        });
    }, [recommendations, selectedSpecialists, searchTerm, t]);

    // Faqat boshlang'ich jamoa hali yo'q va kutilyapti — to'liq ekran spinner (DDX/AI fonda bo'lsa ham ko'rinmaydi)
    const waitingInitialTeam =
        isProcessing && (!recommendations || recommendations.length === 0);

    if (waitingInitialTeam) {
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

    if (!recommendations || recommendations.length === 0) {
        return (
            <div className="glass-panel animate-fade-in-up p-8 text-center text-text-secondary text-sm">
                Shikoyat va klinik ma&apos;lumotlarga mos mutaxassis topilmadi. Iltimos, shikoyatni batafsilroq yozing yoki qayta urinib ko&apos;ring.
            </div>
        );
    }

    return (
        <div className="glass-panel p-4 sm:p-6 animate-fade-in-up flex flex-col h-full min-h-0 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 mb-3 text-center">
                <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text animated-gradient-text tracking-tight mb-1">
                    Konsilium Tarkibini Shakllantirish
                </h2>
                <p className="text-sm text-text-secondary">
                    <span className="font-bold text-accent-color-blue">{selectedSpecialists.size}</span> / 10 mutaxassis tanlandi (Min: 4)
                </p>
            </div>

            {/* Orchestrator */}
            <div className="flex-shrink-0 mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <div>
                    <p className="font-bold text-xs text-indigo-900">Konsilium Professori (Orkestrator)</p>
                    <p className="text-[9px] text-indigo-600">Munozarani boshqaradi</p>
                </div>
            </div>

            {/* Main Content: 2 columns — flex-1 min-h-0 to fill remaining height */}
            <div className="flex-1 min-h-0 flex gap-3 sm:gap-4 overflow-hidden">
                {/* LEFT: Specialist List */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="relative mb-2">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Qidirish..."
                            className="common-input w-full pl-9 py-2 text-sm"
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                    <div ref={listScrollRef} className="flex-1 min-h-0 overflow-y-auto touch-scroll-y bg-slate-50 rounded-lg border border-slate-200">
                        {filteredSpecialists.map((model) => {
                            const specialistInfo = AI_SPECIALISTS[model];
                            const safeRecommendations = recommendations && Array.isArray(recommendations) ? recommendations : [];
                            const recommendation = safeRecommendations.find(r => r?.model === model);
                            const isSelected = selectedSpecialists.has(model);
                            return (
                                <div
                                    key={model}
                                    ref={el => { itemRefs.current[model] = el; }}
                                    onClick={() => toggleSpecialist(model)}
                                    className={`p-2 flex items-center gap-2 border-b border-slate-100 cursor-pointer transition ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-white'}`}
                                >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                        {isSelected && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                    </div>
                                    <AIAvatar model={model} size="xs" />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                                            {t(`specialist_name_${model.toLowerCase()}` as TranslationKey) || specialistInfo.name.split('(')[0].trim()}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate">
                                            {t(`specialty_${model.toLowerCase()}` as TranslationKey) || specialistInfo.specialty}
                                        </p>
                                    </div>
                                    {recommendation && (
                                        <span className="px-1 py-0.5 bg-green-100 text-green-700 text-[8px] font-bold uppercase rounded">AI</span>
                                    )}
                                </div>
                            );
                        })}
                        {filteredSpecialists.length === 0 && (
                            <div className="p-6 text-center text-slate-500 text-xs">Topilmadi.</div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Selected Specialists */}
                <div className="w-52 sm:w-64 flex-shrink-0 flex flex-col min-h-0 bg-blue-50/30 rounded-lg border-2 border-blue-200 p-3">
                    <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1 flex-shrink-0">
                        <UsersIcon className="w-4 h-4" />
                        Tanlangan ({selectedSpecialists.size})
                    </h3>
                    {selectedSpecialists.size === 0 ? (
                        <p className="text-xs text-slate-500 text-center mt-8">Hali mutaxassis tanlanmagan</p>
                    ) : (
                        <div className="flex-1 min-h-0 space-y-1 overflow-y-auto touch-scroll-y">
                            {Array.from(selectedSpecialists).map((model: AIModel) => {
                                const spec = AI_SPECIALISTS[model];
                                return (
                                    <div key={model} className="flex items-center gap-2 p-1.5 bg-white rounded border border-blue-100">
                                        <AIAvatar model={model} size="xs" />
                                        <p className="text-xs font-semibold text-blue-900 flex-1 truncate">{t(`specialist_name_${model.toLowerCase()}` as TranslationKey) || spec.name.split('(')[0].trim()}</p>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); toggleSpecialist(model); }} className="text-red-500 hover:text-red-700 text-xs font-bold" aria-label="O'chirish">x</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 pt-4 mt-4 border-t border-border-color">
                <button
                    onClick={handleConfirm}
                    disabled={selectedSpecialists.size < LIMITS.MIN_SPECIALISTS || selectedSpecialists.size > LIMITS.MAX_SPECIALISTS}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {selectedSpecialists.size < LIMITS.MIN_SPECIALISTS 
                        ? `Kamida ${LIMITS.MIN_SPECIALISTS} ta tanlang (${selectedSpecialists.size}/${LIMITS.MIN_SPECIALISTS})`
                        : `Konsiliumni Boshlash (${selectedSpecialists.size} mutaxassis)`
                    }
                </button>
            </div>
        </div>
    );
};

export default TeamRecommendationView;