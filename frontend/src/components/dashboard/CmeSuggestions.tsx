import React from 'react';
import type { CMETopic } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

interface CmeSuggestionsProps {
    topics: CMETopic[];
}

const icons = [
    <svg key="s" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>,
    <svg key="a" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>,
    <svg key="b" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>,
];

const CmeSuggestions: React.FC<CmeSuggestionsProps> = ({ topics }) => {
    const { t } = useTranslation();

    const panelStyle: React.CSSProperties = {
        background: 'linear-gradient(145deg, #130A2E 0%, #0F0820 100%)',
        border: '1px solid rgba(123,97,255,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(123,97,255,0.08)',
    };

    if (!topics || topics.length === 0) {
        return (
            <div className="rounded-[20px] p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[160px]"
                 style={panelStyle}>
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{
                         background: 'rgba(123,97,255,0.18)',
                         border: '1px solid rgba(123,97,255,0.35)',
                         color: '#B09FFF',
                     }}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(220,210,255,0.95)' }}>
                        {t('cme_recommendations_info')}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(180,160,255,0.75)' }}>
                        {t('cme_recommendations_subtitle')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-[20px] overflow-hidden" style={panelStyle}>
            <div className="divide-y" style={{ borderColor: 'rgba(123,97,255,0.12)' }}>
                {topics.map((item, index) => (
                    <div
                        key={index}
                        className="px-5 py-4 transition-all duration-200 cursor-default"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(123,97,255,0.12)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }}
                    >
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                                 style={{
                                     background: 'rgba(123,97,255,0.2)',
                                     color: '#C4B5FD',
                                     border: '1px solid rgba(123,97,255,0.35)',
                                 }}>
                                {icons[index % icons.length]}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* AI badge + topic */}
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded tracking-widest uppercase"
                                          style={{
                                              background: 'rgba(123,97,255,0.3)',
                                              color: '#C4B5FD',
                                              border: '1px solid rgba(123,97,255,0.4)',
                                          }}>
                                        AI
                                    </span>
                                    <p className="text-xs font-semibold leading-snug text-white">
                                        {item.topic}
                                    </p>
                                </div>
                                <p className="text-[11px] leading-relaxed"
                                   style={{ color: 'rgba(200,185,255,0.75)' }}>
                                    {item.relevance}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CmeSuggestions;
