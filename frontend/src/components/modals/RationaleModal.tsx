import React, { useState, useEffect } from 'react';
import { ChatMessage, PatientData } from '../../types';
import * as aiService from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface RationaleModalProps {
    message: ChatMessage;
    patientData: PatientData;
    debateHistory: ChatMessage[];
    onClose: () => void;
}

const RationaleModal: React.FC<RationaleModalProps> = ({ message, patientData, debateHistory, onClose }) => {
    const { language } = useTranslation();
    const [rationale, setRationale] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // FIX: Added missing 'language' argument.
        aiService.explainRationale(message, patientData, debateHistory, language)
            .then(setRationale)
            .catch(err => setRationale(`Xatolik: ${err.message}`))
            .finally(() => setIsLoading(false));
    }, [message, patientData, debateHistory, language]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="max-w-2xl w-full bg-panel-bg-solid rounded-2xl shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border-color">
                    <h3 className="text-lg font-bold text-text-primary">AI Mantiq Tushuntirishi</h3>
                    <p className="text-sm text-text-secondary">AI ushbu xulosaga qanday kelganini tahlil qiling.</p>
                </div>
                 <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center"><SpinnerIcon className="w-8 h-8 mx-auto" /></div>
                    ) : (
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                            <h4>Asl Xabar:</h4>
                            <blockquote>{message.content}</blockquote>
                            <h4>Fikrlash Zanjiri:</h4>
                            <p>{rationale}</p>
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-slate-50 border-t border-border-color text-right">
                     <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-slate-200 hover:bg-slate-300 rounded-lg">Yopish</button>
                 </div>
            </div>
        </div>
    );
};

export default RationaleModal;