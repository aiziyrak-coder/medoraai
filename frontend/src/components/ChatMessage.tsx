import React from 'react';
import { AIModel, type ChatMessage as ChatMessageProps } from '../types';
import { AI_SPECIALISTS } from '../constants';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import AIAvatar from './AIAvatar';
import SpinnerIcon from './icons/SpinnerIcon';
import InformationCircleIcon from './icons/InformationCircleIcon';

interface ChatMessageComponentProps {
    message: ChatMessageProps;
    onExplainRationale: (message: ChatMessageProps) => void;
    compact?: boolean;
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

const ChatMessage: React.FC<ChatMessageComponentProps> = ({ message, onExplainRationale, compact }) => {
    const { t } = useTranslation();
    const { author, content, isThinking, isUserIntervention, evidenceLevel, isSystemMessage } = message;
    const config = AI_SPECIALISTS[author];

    if (isThinking && !content) return null;
    const specialistName = t(`specialist_name_${String(author).toLowerCase()}` as TranslationKey) || config?.name || (author === 'Orchestrator' ? 'Konsilium Professori' : String(author));
    const animationDelay = `${Math.random() * 0.3}s`;
    
    if (isSystemMessage || isUserIntervention) {
        return (
            <div className={`animate-fade-in-up text-center ${compact ? 'my-2' : 'my-6'}`} style={{ animationDelay }}>
                 <div className={`inline-block max-w-2xl ${compact ? 'px-2 py-1 rounded-lg' : 'px-4 py-2 rounded-xl'}`}>
                    <p className={`text-text-secondary font-semibold ${compact ? 'text-[10px]' : 'text-xs'}`}>{isUserIntervention ? "Sizning aralashuvingiz" : specialistName}</p>
                    {content && <p className={`text-text-secondary italic text-center break-words ${compact ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}>{content}</p>}
                </div>
            </div>
        );
    }

    if (!config) return null;

    return (
        <div className={`flex items-start gap-2 animate-fade-in-up min-w-0 ${compact ? 'my-2' : 'my-4'}`} style={{ animationDelay }}>
            <AIAvatar model={author} size={compact ? 'xs' : 'sm'} />
            <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-center mb-0.5">
                    <p className={`font-semibold truncate ${compact ? 'text-[10px]' : 'text-xs'} ${config.text}`}>{specialistName}</p>
                    {author !== AIModel.SYSTEM && !isThinking && !compact && (
                        <button 
                            onClick={() => onExplainRationale(message)} 
                            title="Mantiqni tushuntirish"
                            className="text-slate-400 hover:text-accent-color-blue transition-colors flex-shrink-0"
                        >
                            <InformationCircleIcon className="w-5 h-5"/>
                        </button>
                    )}
                </div>
                <div className={`rounded-xl rounded-tl-lg bg-slate-200/50 min-w-0 overflow-hidden ${compact ? 'p-2' : 'p-3.5'}`}>
                    {isThinking ? (
                        <div className="flex items-center gap-2 text-text-secondary text-xs">
                            <SpinnerIcon className="w-3 h-3 text-accent-color-blue flex-shrink-0" />
                            <span className="break-words">{content || 'Fikrlanmoqda...'}</span>
                        </div>
                    ) : (
                        <>
                            <p className={`whitespace-pre-wrap text-text-primary break-words ${compact ? 'text-xs' : ''}`}>{content}</p>
                            {evidenceLevel && !compact && (
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