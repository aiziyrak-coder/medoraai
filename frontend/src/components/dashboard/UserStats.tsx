import React, { useEffect, useRef } from 'react';
import type { UserStats } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

interface UserStatsProps {
    stats: UserStats;
}

/** SVG Radial progress ring */
const RadialRing: React.FC<{
    value: number;       // 0-100
    max?: number;
    label: string;
    sublabel: string;
    color: string;       // stroke color
    glowColor: string;
    size?: number;
}> = ({ value, max = 100, label, sublabel, color, glowColor, size = 80 }) => {
    const r = 32;
    const circ = 2 * Math.PI * r;       // ≈ 201
    const pct = Math.min(value / max, 1);
    const offset = circ * (1 - pct);

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    viewBox="0 0 80 80"
                    width={size}
                    height={size}
                    className="rotate-[-90deg]"
                >
                    {/* Track */}
                    <circle
                        cx="40" cy="40" r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="5"
                    />
                    {/* Fill */}
                    <circle
                        cx="40" cy="40" r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{
                            filter: `drop-shadow(0 0 6px ${glowColor})`,
                            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)',
                        }}
                    />
                </svg>
                {/* Center value */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="text-sm font-black"
                        style={{ color }}
                    >
                        {label}
                    </span>
                </div>
            </div>
            <p
                className="text-[9px] font-mono font-bold uppercase tracking-widest text-center"
                style={{ color: 'rgba(160,216,241,0.55)' }}
            >
                {sublabel}
            </p>
        </div>
    );
};

const UserStatsComponent: React.FC<UserStatsProps> = ({ stats }) => {
    const { t } = useTranslation();
    const accuracy = Math.round(stats.feedbackAccuracy * 100);
    const maxDiag = Math.max(...stats.commonDiagnoses.map(d => d.count), 1);

    return (
        <div
            className="dash-panel rounded-[24px] p-5 h-full flex flex-col gap-5 hex-grid-bg"
            style={{ minHeight: '260px' }}
        >
            {/* Title */}
            <div className="flex items-center gap-2">
                <div
                    className="w-1.5 h-4 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #00D2FF, #00FF87)' }}
                />
                <h2 className="text-sm font-bold tracking-wide text-white">
                    {t('dashboard_stats_title')}
                </h2>
            </div>

            {/* Radial rings row */}
            <div className="flex items-center justify-around gap-4">
                <RadialRing
                    value={Math.min(stats.totalAnalyses, 100)}
                    max={100}
                    label={String(stats.totalAnalyses)}
                    sublabel={t('stats_total_analyses')}
                    color="#00FF87"
                    glowColor="rgba(0,255,135,0.6)"
                />
                <div
                    className="w-px self-stretch"
                    style={{ background: 'rgba(0,210,255,0.1)' }}
                />
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
            <div
                className="h-px w-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.15), transparent)' }}
            />

            {/* Top diagnoses */}
            <div className="flex-1">
                <p
                    className="text-[9px] font-mono font-bold uppercase tracking-widest mb-3"
                    style={{ color: 'rgba(0,210,255,0.55)' }}
                >
                    {t('stats_top_diagnoses')}
                </p>
                <div className="space-y-2.5">
                    {stats.commonDiagnoses.length > 0
                        ? stats.commonDiagnoses.map((diag, i) => {
                            const pct = (diag.count / maxDiag) * 100;
                            const colors = ['#00FF87', '#00D2FF', '#7B61FF'];
                            const glows = [
                                'rgba(0,255,135,0.4)',
                                'rgba(0,210,255,0.4)',
                                'rgba(123,97,255,0.4)',
                            ];
                            return (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                        <p
                                            className="text-xs font-semibold truncate pr-2"
                                            style={{ color: 'rgba(200,230,255,0.85)' }}
                                        >
                                            {diag.name}
                                        </p>
                                        <span
                                            className="text-[10px] font-mono font-bold flex-shrink-0"
                                            style={{ color: colors[i % colors.length] }}
                                        >
                                            {diag.count}
                                        </span>
                                    </div>
                                    <div
                                        className="w-full h-1 rounded-full overflow-hidden"
                                        style={{ background: 'rgba(255,255,255,0.05)' }}
                                    >
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{
                                                width: `${pct}%`,
                                                background: colors[i % colors.length],
                                                boxShadow: `0 0 6px ${glows[i % glows.length]}`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })
                        : (
                            <div
                                className="text-center py-4 rounded-xl"
                                style={{
                                    border: '1px dashed rgba(0,210,255,0.15)',
                                    background: 'rgba(0,210,255,0.02)',
                                }}
                            >
                                <p className="text-xs font-mono" style={{ color: 'rgba(0,210,255,0.4)' }}>
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
