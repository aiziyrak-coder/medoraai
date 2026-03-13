import React from 'react';
import type { UserStats } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

interface UserStatsProps {
    stats: UserStats;
}

const RadialRing: React.FC<{
    value: number;
    max?: number;
    label: string;
    sublabel: string;
    color: string;
    glowColor: string;
    size?: number;
}> = ({ value, max = 100, label, sublabel, color, glowColor, size = 88 }) => {
    const r = 32;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(value / max, 1);
    const offset = circ * (1 - pct);

    return (
        <div className="flex flex-col items-center gap-2.5">
            <div className="relative" style={{ width: size, height: size }}>
                <svg viewBox="0 0 80 80" width={size} height={size} className="rotate-[-90deg]">
                    {/* Track */}
                    <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                    {/* Fill */}
                    <circle
                        cx="40" cy="40" r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={pct === 0 ? circ * 0.97 : offset}
                        style={{
                            filter: `drop-shadow(0 0 8px ${glowColor})`,
                            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)',
                            opacity: pct === 0 ? 0.25 : 1,
                        }}
                    />
                </svg>
                {/* Center value */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="text-base font-black"
                        style={{
                            color,
                            textShadow: `0 0 12px ${glowColor}`,
                        }}
                    >
                        {label}
                    </span>
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center"
               style={{ color: 'rgba(200,230,255,0.75)' }}>
                {sublabel}
            </p>
        </div>
    );
};

const UserStatsComponent: React.FC<UserStatsProps> = ({ stats }) => {
    const { t } = useTranslation();
    const accuracy = Math.round(stats.feedbackAccuracy * 100);
    const maxDiag = Math.max(...stats.commonDiagnoses.map(d => d.count), 1);
    const colors = ['#00FF87', '#00D2FF', '#7B61FF'];
    const glows  = ['rgba(0,255,135,0.5)', 'rgba(0,210,255,0.5)', 'rgba(123,97,255,0.5)'];

    return (
        <div
            className="rounded-[24px] p-5 h-full flex flex-col gap-4"
            style={{
                background: 'linear-gradient(145deg, #0D1E32 0%, #0A1628 100%)',
                border: '1px solid rgba(0,210,255,0.18)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                minHeight: '260px',
            }}
        >
            {/* Title */}
            <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full"
                     style={{ background: 'linear-gradient(180deg, #00D2FF, #00FF87)' }} />
                <h2 className="text-sm font-bold text-white tracking-wide">
                    {t('dashboard_stats_title')}
                </h2>
            </div>

            {/* Rings */}
            <div className="flex items-center justify-around py-2">
                <RadialRing
                    value={Math.min(stats.totalAnalyses, 100)}
                    max={100}
                    label={String(stats.totalAnalyses)}
                    sublabel={t('stats_total_analyses')}
                    color="#00FF87"
                    glowColor="rgba(0,255,135,0.6)"
                />
                <div className="w-px h-16 self-center"
                     style={{ background: 'rgba(0,210,255,0.15)' }} />
                <RadialRing
                    value={accuracy}
                    max={100}
                    label={`${accuracy}%`}
                    sublabel={t('stats_feedback_accuracy')}
                    color="#00D2FF"
                    glowColor="rgba(0,210,255,0.6)"
                />
            </div>

            {/* Divider */}
            <div className="h-px"
                 style={{ background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.2), transparent)' }} />

            {/* Top diagnoses */}
            <div className="flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-3"
                   style={{ color: '#00D2FF' }}>
                    {t('stats_top_diagnoses')}
                </p>
                <div className="space-y-2.5">
                    {stats.commonDiagnoses.length > 0
                        ? stats.commonDiagnoses.map((diag, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <p className="text-xs font-semibold truncate pr-2 text-white">
                                        {diag.name}
                                    </p>
                                    <span className="text-[10px] font-mono font-bold flex-shrink-0"
                                          style={{ color: colors[i % colors.length] }}>
                                        {diag.count}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden"
                                     style={{ background: 'rgba(255,255,255,0.08)' }}>
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${(diag.count / maxDiag) * 100}%`,
                                            background: colors[i % colors.length],
                                            boxShadow: `0 0 8px ${glows[i % glows.length]}`,
                                            transition: 'width 1.2s ease',
                                        }}
                                    />
                                </div>
                            </div>
                        ))
                        : (
                            <div className="text-center py-5 rounded-xl"
                                 style={{
                                     border: '1px dashed rgba(0,210,255,0.25)',
                                     background: 'rgba(0,210,255,0.04)',
                                 }}>
                                <p className="text-xs font-medium" style={{ color: 'rgba(160,220,255,0.85)' }}>
                                    {t('stats_no_data')}
                                </p>
                            </div>
                        )
                    }
                </div>
            </div>
        </div>
    );
};

export default UserStatsComponent;
