import React, { useState, useEffect } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';
import { useTranslation } from '../hooks/useTranslation';

interface FollowUpAnalysisProps {
    isAnalyzing: boolean;
    onSubmit: (question: string) => void;
    followUpHistory: { question: string, answer: string }[];
    isFinalized: boolean;
    onFinalize: () => void;
    isLive: boolean;
    compact?: boolean;
}

const FollowUpAnalysis: React.FC<FollowUpAnalysisProps> = ({ isAnalyzing, onSubmit, followUpHistory, isFinalized, onFinalize, isLive, compact }) => {
    const { t } = useTranslation();
    const [question, setQuestion] = useState('');
    const [showFinalizePrompt, setShowFinalizePrompt] = useState(false);
    
    // Using a ref to track the length to avoid re-triggering the effect unnecessarily
    const historyLengthRef = React.useRef(followUpHistory.length);

    useEffect(() => {
        // Show the prompt only when a new answer has been added and it's a live session
        if (isLive && followUpHistory.length > historyLengthRef.current) {
            setShowFinalizePrompt(true);
        }
        historyLengthRef.current = followUpHistory.length;
    }, [followUpHistory, isLive]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || isAnalyzing) return;
        onSubmit(question);
        setQuestion('');
        setShowFinalizePrompt(false);
    };

    const handleContinue = () => {
        setShowFinalizePrompt(false);
    };

    const handleFinalize = () => {
        setShowFinalizePrompt(false);
        onFinalize();
    };

    if (compact) {
        return (
            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">{t('follow_up_section_title')}</p>
                {followUpHistory.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {followUpHistory.map((item, index) => (
                            <div key={index} className="text-[11px] space-y-1">
                                <p className="text-blue-700 font-medium">Q: {item.question}</p>
                                <p className="text-slate-600 line-clamp-3">A: {item.answer}</p>
                            </div>
                        ))}
                    </div>
                )}
                {isLive && !isFinalized && (
                    showFinalizePrompt ? (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={handleContinue} className="px-2 py-1 text-xs rounded-md border border-slate-300 bg-white hover:bg-slate-50">
                                {t('follow_up_btn_yes')}
                            </button>
                            <button type="button" onClick={handleFinalize} className="px-2 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700">
                                {t('follow_up_btn_finalize')}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <input
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder={t('follow_up_placeholder_example')}
                                className="flex-1 min-w-0 rounded-md border border-slate-300 text-xs px-2 py-1.5 common-input"
                                disabled={isAnalyzing}
                            />
                            <button
                                type="submit"
                                disabled={isAnalyzing || !question.trim()}
                                className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-md text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-60"
                            >
                                {isAnalyzing ? '…' : t('follow_up_submit')}
                            </button>
                        </form>
                    )
                )}
                {isLive && isFinalized && followUpHistory.length > 0 && (
                    <p className="text-[11px] text-emerald-700 font-medium">{t('follow_up_session_done')}</p>
                )}
            </div>
        );
    }

    return (
        <div className="mt-8 pt-8 border-t-2 border-border-color animate-fade-in-up follow-up-section" style={{ animationDelay: '0.5s' }}>
            <h3 className="text-2xl font-bold text-text-primary mb-4">
                {t('follow_up_section_title')}
            </h3>
            
            {followUpHistory.length === 0 && (
                <p className="text-text-secondary mb-6">{t('follow_up_prompt')}</p>
            )}
            
            <div className="space-y-6 mb-6">
                {followUpHistory.map((item, index) => (
                    <div key={index} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s`}}>
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                            <p className="font-semibold text-accent-color-blue">{t('follow_up_your_question')}</p>
                            <p className="mt-1 text-text-primary whitespace-pre-wrap">{item.question}</p>
                        </div>
                        <div className="mt-2 p-4 rounded-lg bg-white border border-slate-200">
                            <p className="font-semibold text-slate-800">{t('follow_up_chair_answer')}</p>
                            <p className="mt-1 text-slate-700 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                        </div>
                    </div>
                ))}
            </div>
            
            {isLive && !isFinalized && (
                showFinalizePrompt ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center animate-fade-in-up">
                        <p className="font-semibold text-text-primary mb-4">{t('follow_up_more_questions_prompt')}</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={handleContinue} className="px-5 py-2 text-sm font-semibold text-cyan-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                                {t('follow_up_btn_yes')}
                            </button>
                            <button onClick={handleFinalize} className="px-5 py-2 text-sm font-semibold text-white bg-accent-color-blue border border-accent-color-blue/50 rounded-lg hover:bg-accent-color-blue/80 transition-colors">
                                {t('follow_up_btn_finalize')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={t('follow_up_placeholder_example')}
                            className="flex-grow block w-full rounded-lg sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition px-4 py-2.5"
                            disabled={isAnalyzing}
                        />
                        <button
                            type="submit"
                            disabled={isAnalyzing || !question.trim()}
                            className="flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all duration-300"
                        >
                            {isAnalyzing ? (
                                <>
                                    <SpinnerIcon className="w-4 h-4 text-white" />
                                    {t('follow_up_sending')}
                                </>
                            ) : (
                                t('follow_up_submit')
                            )}
                        </button>
                    </form>
                )
            )}
            
            {isLive && isFinalized && followUpHistory.length > 0 && (
                 <div className="p-4 bg-green-100 border border-green-200 rounded-lg text-center animate-fade-in-up">
                    <p className="font-semibold text-green-800">{t('follow_up_session_done')}</p>
                </div>
            )}
        </div>
    );
};

export default FollowUpAnalysis;