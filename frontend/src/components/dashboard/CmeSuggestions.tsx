import React from 'react';
import type { CMETopic } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

interface CmeSuggestionsProps {
    topics: CMETopic[];
}

const icons = [
    // Stethoscope-like
    <svg key="s" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15m-8.8-1.5a2.25 2.25 0 104.5 0 2.25 2.25 0 00-4.5 0z" />
    </svg>,
    // Atom
    <svg key="a" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8z" />
    </svg>,
    // Brain
    <svg key="b" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>,
];

const CmeSuggestions: React.FC<CmeSuggestionsProps> = ({ topics }) => {
    const { t } = useTranslation();

    if (!topics || topics.length === 0) {
        return (
            <div
                className="dash-panel-purple rounded-[20px] p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px]"
            >
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                        background: 'rgba(123,97,255,0.12)',
                        border: '1px solid rgba(123,97,255,0.25)',
                        color: '#7B61FF',
                    }}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <p className="text-xs font-medium leading-relaxed" style={{ color: 'rgba(180,160,255,0.7)' }}>
                    {t('cme_recommendations_info')}
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(123,97,255,0.5)' }}>
                    {t('cme_recommendations_subtitle')}
                </p>
            </div>
        );
    }

    return (
        <div className="dash-panel-purple rounded-[20px] overflow-hidden">
            <div className="divide-y" style={{ borderColor: 'rgba(123,97,255,0.08)' }}>
                {topics.map((item, index) => (
                    <div
                        key={index}
                        className="px-5 py-4 transition-all duration-200 cursor-default"
                        style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(123,97,255,0.03)' }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(123,97,255,0.08)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.background =
                                index % 2 === 0 ? 'transparent' : 'rgba(123,97,255,0.03)';
                        }}
                    >
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div
                                className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5"
                                style={{
                                    background: 'rgba(123,97,255,0.15)',
                                    color: '#7B61FF',
                                    border: '1px solid rgba(123,97,255,0.25)',
                                }}
                            >
                                {icons[index % icons.length]}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* AI badge + topic */}
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span
                                        className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded tracking-widest uppercase"
                                        style={{
                                            background: 'rgba(123,97,255,0.2)',
                                            color: '#9B7FFF',
                                            border: '1px solid rgba(123,97,255,0.3)',
                                        }}
                                    >
                                        AI
                                    </span>
                                    <p
                                        className="text-xs font-semibold leading-snug"
                                        style={{ color: 'rgba(220,210,255,0.9)' }}
                                    >
                                        {item.topic}
                                    </p>
                                </div>
                                <p
                                    className="text-[10px] leading-relaxed"
                                    style={{ color: 'rgba(150,130,200,0.65)' }}
                                >
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
