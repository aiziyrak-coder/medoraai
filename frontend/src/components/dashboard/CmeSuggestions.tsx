import React from 'react';
import { CMETopic } from '../../types';
import LightBulbIcon from '../icons/LightBulbIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface CmeSuggestionsProps {
    topics: CMETopic[];
}

const CmeSuggestions: React.FC<CmeSuggestionsProps> = ({ topics }) => {
    const { t } = useTranslation();
    return (
        <div className="glass-panel p-4 h-full">
            {topics.length > 0 ? (
                <ul className="space-y-3">
                    {topics.map((item, index) => (
                        <li key={index} className="p-3 bg-slate-100/70 rounded-lg border border-border-color">
                            <p className="font-semibold text-text-primary text-sm flex items-start gap-2">
                                <LightBulbIcon className="w-5 h-5 text-accent-color-yellow flex-shrink-0 mt-0.5" />
                                <span>{item.topic}</span>
                            </p>
                            <p className="text-xs text-text-secondary mt-1 pl-7">{item.relevance}</p>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center h-full flex flex-col justify-center items-center text-text-secondary">
                    <p>{t('cme_recommendations_info')}</p>
                    <p className="text-xs">{t('cme_recommendations_subtitle')}</p>
                </div>
            )}
        </div>
    );
};

export default CmeSuggestions;