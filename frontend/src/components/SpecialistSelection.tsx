import React, { useState } from 'react';
import { AIModel } from '../constants/specialists';
import { AI_SPECIALISTS } from '../constants';
import AIAvatar from './AIAvatar';

interface SpecialistSelectionProps {
    onContinue: (selectedSpecialists: AIModel[]) => void;
}

const SpecialistSelection: React.FC<SpecialistSelectionProps> = ({ onContinue }) => {
    const specialistModels = Object.values(AIModel).filter(m => m !== AIModel.SYSTEM);
    const [selected, setSelected] = useState<AIModel[]>(specialistModels);

    const toggleSpecialist = (model: AIModel) => {
        setSelected(prev => 
            prev.includes(model) 
                ? prev.filter(m => m !== model) 
                : [...prev, model]
        );
    };

    return (
        <div className="max-w-3xl mx-auto glass-panel p-8 animate-fade-in-up">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-text-primary">Konsilium Tarkibini Tanlang</h2>
                <p className="text-text-secondary mt-2">Klinik holatga eng mos keladigan AI-mutaxassislarni tanlang. Barchasini tanlash kengroq muhokamani ta'minlaydi.</p>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {specialistModels.map(model => {
                    const specialist = AI_SPECIALISTS[model];
                    const isSelected = selected.includes(model);
                    return (
                        <button
                            key={model}
                            onClick={() => toggleSpecialist(model)}
                            className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 ${isSelected ? 'border-accent-color-blue bg-blue-500/10 shadow-lg' : 'border-border-color bg-slate-50 hover:border-slate-300'}`}
                        >
                            <AIAvatar model={model} size="md" />
                            <p className="font-semibold text-text-primary mt-3 text-sm">{specialist.name.split('(')[0].trim()}</p>
                            <p className="text-xs text-text-secondary">{specialist.specialty}</p>
                        </button>
                    );
                })}
            </div>
            
            <div className="mt-8">
                <button
                    onClick={() => onContinue(selected)}
                    disabled={selected.length === 0}
                    className="w-full animated-gradient-button text-white font-bold py-3 rounded-lg disabled:opacity-50"
                >
                    {selected.length} ta mutaxassis bilan davom etish
                </button>
            </div>
        </div>
    );
};

export default SpecialistSelection;