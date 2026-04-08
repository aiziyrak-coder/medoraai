
import React from 'react';
import { UserStats } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import {
    FEEDBACK_ACCURACY_SAMPLE_PERCENT,
    feedbackAccuracyToDisplayPercent,
} from '../../services/caseService';

interface UserStatsProps {
    stats: UserStats;
}

const StatItem: React.FC<{
    label: string;
    value: string | number;
    color?: string;
    subtitle?: string;
}> = ({ label, value, color = "text-text-primary", subtitle }) => (
    <div className="p-4 bg-white/50 backdrop-blur-sm rounded-2xl text-center border border-white/60 shadow-sm flex flex-col justify-center h-full">
        <p className={`text-3xl font-black ${color} tracking-tight`}>{value}</p>
        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-1">{label}</p>
        {subtitle ? (
            <p className="text-[9px] text-text-secondary/85 leading-snug mt-1.5 px-0.5 font-medium normal-case tracking-normal">
                {subtitle}
            </p>
        ) : null}
    </div>
);

const UserStatsComponent: React.FC<UserStatsProps> = ({ stats }) => {
    const { t, language } = useTranslation();
    const feedbackDisplayPct =
        stats.feedbackEvalCount === 0
            ? FEEDBACK_ACCURACY_SAMPLE_PERCENT
            : feedbackAccuracyToDisplayPercent(stats.feedbackAccuracy);
    const feedbackDisplayPctText = Number(feedbackDisplayPct).toLocaleString(
        language === 'ru' ? 'ru-RU' : language?.startsWith('uz') ? 'uz-UZ' : 'en-US',
        { maximumFractionDigits: 1 },
    );
    const feedbackSubtitle =
        stats.feedbackEvalCount === 0
            ? `${t('stats_feedback_accuracy_sub')} (${t('stats_feedback_sample_note')})`
            : t('stats_feedback_accuracy_sub');

    return (
        <div className="glass-panel p-5 h-full flex flex-col">
            <h2 className="text-xl font-bold text-text-primary mb-4 px-1">{t('dashboard_stats_title')}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6 flex-shrink-0">
                <StatItem label={t('stats_total_analyses')} value={stats.totalAnalyses} color="text-[#007AFF]" />
                <StatItem
                    label={t('stats_feedback_accuracy')}
                    value={`${feedbackDisplayPctText}%`}
                    color="text-[#34C759]"
                    subtitle={feedbackSubtitle}
                />
            </div>
            
            <div className="flex-grow flex flex-col">
                 <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 px-1">{t('stats_top_diagnoses')}</h4>
                 <div className="space-y-2 flex-grow">
                    {stats.commonDiagnoses.map((diag, index) => (
                        <div key={index} className="text-sm p-3 bg-white/40 rounded-xl flex justify-between items-center border border-white/40">
                            <span className="font-semibold text-text-primary truncate pr-2">{diag.name}</span>
                            <span className="font-bold text-slate-600 bg-white/50 px-2 py-1 rounded-lg text-xs">{t('stats_case', { count: diag.count })}</span>
                        </div>
                    ))}
                    {stats.commonDiagnoses.length === 0 && (
                        <div className="h-full flex items-center justify-center text-center p-4 bg-white/20 rounded-xl border border-dashed border-white/40">
                            <p className="text-xs text-text-secondary font-medium">{t('stats_no_data')}</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};

export default UserStatsComponent;
