import React, { useState } from 'react';
import type { Diagnosis, DiagnosisFeedback } from '../types';
import ThumbUpIcon from './icons/ThumbUpIcon';
import ThumbDownIcon from './icons/ThumbDownIcon';
import QuestionMarkCircleIcon from './icons/QuestionMarkCircleIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';

interface DifferentialDiagnosisPanelProps {
    diagnoses: Diagnosis[];
    onFeedback: (diagnosisName: string, feedback: DiagnosisFeedback) => void;
    feedbackState: Record<string, DiagnosisFeedback>;
    onStartDebate: () => void;
    isDebateStarted: boolean;
    onInjectHypothesis: (hypothesis: Diagnosis) => void;
}

interface FeedbackButtonProps {
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className: string;
    title: string;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({ isActive, onClick, children, className, title }) => (
    <button
        onClick={onClick}
        title={title}
        className={`p-1.5 rounded-full transition-colors ${isActive ? className : 'bg-slate-200/50 text-slate-400 hover:bg-slate-200'}`}
    >
        {children}
    </button>
);


const DifferentialDiagnosisPanel: React.FC<DifferentialDiagnosisPanelProps> = ({ diagnoses, onFeedback, feedbackState, onStartDebate, isDebateStarted, onInjectHypothesis }) => {
    const [isInjecting, setIsInjecting] = useState(false);
    const [newHypothesis, setNewHypothesis] = useState('');

    const handleInject = () => {
        if (newHypothesis.trim()) {
            onInjectHypothesis({
                name: newHypothesis.trim(),
                probability: 50, // Default probability for user-injected
                justification: 'Foydalanuvchi tomonidan qo\'shilgan gipoteza.',
                evidenceLevel: 'Foydalanuvchi tajribasi',
                isUserInjected: true,
            });
            setNewHypothesis('');
            setIsInjecting(false);
        }
    };

    return (
        <div className="mb-6 animate-fade-in-up">
            <h4 className="font-bold text-sm text-text-primary mb-3">Dastlabki Differensial Tashxislar</h4>
            <div className="space-y-4">
                {diagnoses.map((diag, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-xl border border-border-color">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold text-text-primary truncate ${diag.isUserInjected ? 'italic' : ''}`}>
                                    {diag.name}
                                    {diag.isUserInjected && <span className="text-xs text-blue-500"> (Siz qo'shdingiz)</span>}
                                </p>
                                <p className="text-xs text-text-secondary truncate">{diag.justification}</p>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1.5 -mt-1">
                                <span className="font-bold text-lg text-accent-color-blue">{diag.probability}%</span>
                                {!isDebateStarted && (
                                    <div className="flex gap-1.5 ml-2">
                                        <FeedbackButton
                                            isActive={feedbackState[diag.name] === 'more-likely'}
                                            onClick={() => onFeedback(diag.name, 'more-likely')}
                                            className="bg-green-100 text-green-600"
                                            title="Ehtimoli yuqori"
                                        >
                                            <ThumbUpIcon className="w-4 h-4" />
                                        </FeedbackButton>
                                        <FeedbackButton
                                            isActive={feedbackState[diag.name] === 'less-likely'}
                                            onClick={() => onFeedback(diag.name, 'less-likely')}
                                            className="bg-red-100 text-red-600"
                                            title="Ehtimoli past"
                                        >
                                            <ThumbDownIcon className="w-4 h-4" />
                                        </FeedbackButton>
                                        <FeedbackButton
                                            isActive={feedbackState[diag.name] === 'needs-review'}
                                            onClick={() => onFeedback(diag.name, 'needs-review')}
                                            className="bg-yellow-100 text-yellow-600"
                                            title="Qo'shimcha tekshiruv kerak"
                                        >
                                            <QuestionMarkCircleIcon className="w-4 h-4" />
                                        </FeedbackButton>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {!isDebateStarted && (
                <div className="mt-4 space-y-2">
                    {isInjecting ? (
                        <div className="flex gap-2">
                            <input type="text" value={newHypothesis} onChange={e => setNewHypothesis(e.target.value)} placeholder="O'z gipotezangizni kiriting..." className="common-input flex-grow" />
                            <button onClick={handleInject} className="animated-gradient-button px-3">Qo'shish</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsInjecting(true)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 py-2 rounded-lg">
                            <PlusCircleIcon className="w-5 h-5" /> Gipoteza qo'shish
                        </button>
                    )}
                    <button onClick={onStartDebate} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform transition-all hover:scale-105 active:scale-95">
                        Munozarani Boshlash
                    </button>
                </div>
            )}
             <hr className="my-6 border-border-color" />
        </div>
    );
};

export default DifferentialDiagnosisPanel;