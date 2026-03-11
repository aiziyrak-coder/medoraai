import React from 'react';
import { AIModel, type ChatMessage as ChatMessageProps } from '../types';
import { AI_SPECIALISTS } from '../constants';
import AIAvatar from './AIAvatar';
import SpinnerIcon from './icons/SpinnerIcon';
import InformationCircleIcon from './icons/InformationCircleIcon';

interface ChatMessageComponentProps {
    message: ChatMessageProps;
    onExplainRationale: (message: ChatMessageProps) => void;
}

const EvidenceBadge: React.FC<{level: ChatMessageProps['evidenceLevel']}> = ({ level }) => {
    if (!level) return null;

    const styles = {
        'High': 'bg-green-100 text-green-700',
        'Moderate': 'bg-yellow-100 text-yellow-700',
        'Low': 'bg-orange-100 text-orange-700',
        'Anecdotal': 'bg-slate-200 text-slate-600'
    };

    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[level] || styles['Anecdotal']}`}>
            {level} Dalil
        </span>
    );
}

const ChatMessage: React.FC<ChatMessageComponentProps> = ({ message, onExplainRationale }) => {
    const { author, content, isThinking, isUserIntervention, evidenceLevel, isSystemMessage } = message;
    const config = AI_SPECIALISTS[author];

    if (!config) return null;
    if (isThinking && !content) return null;
    
    const animationDelay = `${Math.random() * 0.3}s`;
    const specialistName = config.name;
    
    if (isSystemMessage || isUserIntervention) {
        return (
            <div className="my-6 text-center animate-fade-in-up" style={{ animationDelay }}>
                 <div className="inline-block px-4 py-2 rounded-xl max-w-2xl">
                    <p className="text-xs text-text-secondary font-semibold">{isUserIntervention ? "Sizning aralashuvingiz" : specialistName}</p>
                    <p className="text-sm text-text-secondary italic mt-1 text-center">{content}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3 my-4 animate-fade-in-up" style={{ animationDelay }}>
            <AIAvatar model={author} size="sm" />
            <div className="flex-1">
                 <div className="flex justify-between items-center mb-1">
                    <p className={`font-semibold text-xs ${config.text}`}>{specialistName}</p>
                    {author !== AIModel.SYSTEM && !isThinking && (
                        <button 
                            onClick={() => onExplainRationale(message)} 
                            title="Mantiqni tushuntirish"
                            className="text-slate-400 hover:text-accent-color-blue transition-colors"
                        >
                            <InformationCircleIcon className="w-5 h-5"/>
                        </button>
                    )}
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-lg bg-slate-200/50">
                    {isThinking ? (
                        <div className="flex items-center gap-3 text-text-secondary">
                            <SpinnerIcon className="w-4 h-4 text-accent-color-blue" />
                            <span>{content || 'Fikrlanmoqda...'}</span>
                        </div>
                    ) : (
                        <>
                            <p className="whitespace-pre-wrap text-text-primary">{content}</p>
                            {evidenceLevel && (
                                <div className="mt-3 pt-2 border-t border-slate-300/50">
                                    <EvidenceBadge level={evidenceLevel} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatMessage;