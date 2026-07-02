import React from 'react';
import { AIModel, type ChatMessage as ChatMessageProps } from '../types';
import { AI_SPECIALISTS } from '../constants';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { resolveSpecialistI18nKey, stripAiParentheticals } from '../utils/specialistDisplay';
import ClinicalDebateContent from './common/ClinicalDebateContent';
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
    const { author, content, isThinking, isUserIntervention, evidenceLevel, isSystemMessage, phase, id } = message;
    const config = AI_SPECIALISTS[author];

    if (isThinking && !content) return null;
    const nameKey = resolveSpecialistI18nKey(String(author));
    const specialistName =
        t(`specialist_name_${nameKey}` as TranslationKey) ||
        stripAiParentheticals(config?.name || '') ||
        (author === 'Orchestrator' ? t('chat_consilium_professor') : String(author));
    const animationDelay = `${Math.random() * 0.3}s`;
    
    if (isSystemMessage || isUserIntervention) {
        const isOrchestratorOpening = author === AIModel.SYSTEM && !isUserIntervention && !compact
            && (phase === 'opening' || String(id || '').startsWith('chair-opening'));
        return (
            <div className={`animate-fade-in-up ${compact ? 'my-2' : isOrchestratorOpening ? 'my-4' : 'my-6'}`} style={{ animationDelay }}>
                 <div className={`inline-block max-w-3xl w-full ${compact ? 'px-2 py-1 rounded-lg' : isOrchestratorOpening ? 'px-5 py-4 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 shadow-sm text-left' : 'px-4 py-2 rounded-xl'}`}>
                    <p className={`font-semibold ${compact ? 'text-[10px]' : 'text-xs'} ${isOrchestratorOpening ? 'text-sky-900' : 'text-text-secondary'}`}>{isUserIntervention ? t('chat_user_intervention') : specialistName}</p>
                    {content && (
                        <ClinicalDebateContent
                            text={content}
                            className={`${isOrchestratorOpening ? 'text-slate-800 text-left not-italic text-sm mt-2' : `text-text-secondary italic text-center ${compact ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}`}
                        />
                    )}
                </div>
            </div>
        );
    }

    if (!config && author === AIModel.SYSTEM) {
        return (
            <div className={`animate-fade-in-up ${compact ? 'my-2' : 'my-4'}`} style={{ animationDelay }}>
                <div className="max-w-3xl mx-auto px-5 py-4 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 shadow-sm">
                    <p className="text-xs font-bold text-sky-900 uppercase tracking-wide">{t('chat_consilium_professor')}</p>
                    {content && <ClinicalDebateContent text={content} className="text-sm text-slate-800 mt-2" />}
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
                <div className={`rounded-xl rounded-tl-lg min-w-0 border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 shadow-sm ${compact ? 'p-2' : 'p-3.5'}`}>
                    {isThinking ? (
                        <div className="flex items-center gap-2 text-text-secondary text-xs">
                            <SpinnerIcon className="w-3 h-3 text-accent-color-blue flex-shrink-0" />
                            <span className="break-words">{content || 'Fikrlanmoqda...'}</span>
                        </div>
                    ) : (
                        <>
                            <ClinicalDebateContent text={content} className={`text-text-primary ${compact ? 'text-xs' : 'text-sm'}`} />
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