import React, { useEffect, useRef } from 'react';
import type { AnalysisRecord, UserStats, CMETopic } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import UserStatsComponent from './dashboard/UserStats';
import CmeSuggestions from './dashboard/CmeSuggestions';
import { useTranslation } from '../hooks/useTranslation';

interface DashboardProps {
    userName: string;
    onNewAnalysis: () => void;
    onViewHistory: () => void;
    recentAnalyses: AnalysisRecord[];
    onSelectAnalysis: (record: AnalysisRecord) => void;
    stats: UserStats | null;
    cmeTopics: CMETopic[];
}

/** SVG ECG pulse path with animation */
const EcgLine: React.FC = () => (
    <svg
        viewBox="0 0 600 80"
        className="w-full h-full"
        preserveAspectRatio="none"
        aria-hidden="true"
    >
        <defs>
            <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D2FF" stopOpacity="0" />
                <stop offset="40%" stopColor="#00D2FF" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#00FF87" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00FF87" stopOpacity="0" />
            </linearGradient>
            <filter id="ecgGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        {/* Baseline */}
        <path
            d="M0,40 L80,40 L90,40 L95,10 L105,70 L115,5 L125,75 L135,40 L145,40 L155,40 L160,30 L165,50 L170,40 L220,40 L230,40 L235,15 L245,65 L255,8 L265,72 L275,40 L285,40 L340,40 L350,30 L355,50 L360,40 L410,40 L420,40 L425,12 L435,68 L445,6 L455,74 L465,40 L475,40 L530,40 L540,30 L545,50 L550,40 L600,40"
            fill="none"
            stroke="url(#ecgGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecgGlow)"
            strokeDasharray="600"
            strokeDashoffset="600"
            style={{
                animation: 'ecg-draw 2.5s ease-out 0.3s forwards, ecg-loop 5s linear 3s infinite',
            }}
        />
    </svg>
);

/** Floating tech particle dots */
const Particle: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
    <div
        className="absolute w-1 h-1 rounded-full bg-cyan-400 animate-float"
        style={style}
        aria-hidden="true"
    />
);

const Dashboard: React.FC<DashboardProps> = ({
    userName,
    onNewAnalysis,
    onViewHistory,
    recentAnalyses,
    onSelectAnalysis,
    stats,
    cmeTopics,
}) => {
    const { t } = useTranslation();
    const now = new Date();
    const currentDate = now.toLocaleDateString('uz-UZ', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    const firstName = userName.split(' ')[0];

    const particles = [
        { top: '15%', left: '12%', animationDelay: '0s',   opacity: 0.6 },
        { top: '60%', left: '8%',  animationDelay: '1.2s', opacity: 0.4 },
        { top: '30%', left: '90%', animationDelay: '2.1s', opacity: 0.7 },
        { top: '75%', left: '85%', animationDelay: '0.7s', opacity: 0.5 },
        { top: '45%', left: '50%', animationDelay: '1.8s', opacity: 0.3 },
    ];

    return (
        <div className="animate-fade-in-up space-y-5 w-full min-w-0 pb-6">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
                <div>
                    <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase mb-1"
                       style={{ color: 'rgba(0,210,255,0.7)' }}>
                        {currentDate}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                        <span className="text-white">Salom, </span>
                        <span
                            className="animate-neon-blue"
                            style={{
                                background: 'linear-gradient(90deg, #00D2FF 0%, #00FF87 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {firstName}!
                        </span>
                    </h1>
                </div>

                {/* AI Status badge */}
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center gap-2.5 px-4 py-2 rounded-full"
                        style={{
                            background: 'rgba(0,255,135,0.08)',
                            border: '1px solid rgba(0,255,135,0.25)',
                        }}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full animate-dot-pulse"
                            style={{ background: '#00FF87', boxShadow: '0 0 8px #00FF87' }}
                        />
                        <span className="text-xs font-mono font-bold tracking-widest uppercase"
                              style={{ color: '#00FF87' }}>
                            AI ONLINE
                        </span>
                    </div>
                    <div
                        className="px-3 py-2 rounded-full font-mono text-xs font-semibold"
                        style={{
                            background: 'rgba(0,210,255,0.08)',
                            border: '1px solid rgba(0,210,255,0.2)',
                            color: 'rgba(0,210,255,0.8)',
                        }}
                    >
                        {timeStr}
                    </div>
                </div>
            </div>

            {/* ── Main Grid ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">

                {/* Hero Card ─ span 8 */}
                <div
                    onClick={onNewAnalysis}
                    className="lg:col-span-8 relative overflow-hidden rounded-[28px] cursor-pointer group"
                    style={{
                        background: 'linear-gradient(135deg, #060B18 0%, #0A1628 40%, #0D2040 100%)',
                        border: '1px solid rgba(0,210,255,0.2)',
                        minHeight: '260px',
                        boxShadow: '0 0 40px rgba(0,210,255,0.08), 0 20px 60px rgba(0,0,0,0.4)',
                        transition: 'all 0.4s ease',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                            '0 0 60px rgba(0,210,255,0.18), 0 0 120px rgba(0,255,135,0.08), 0 20px 60px rgba(0,0,0,0.5)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,210,255,0.4)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                            '0 0 40px rgba(0,210,255,0.08), 0 20px 60px rgba(0,0,0,0.4)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,210,255,0.2)';
                    }}
                >
                    {/* Hex grid background */}
                    <div className="absolute inset-0 hex-grid-bg opacity-100" aria-hidden="true" />

                    {/* Gradient orbs */}
                    <div
                        className="absolute top-[-40%] right-[-5%] w-96 h-96 rounded-full pointer-events-none"
                        style={{
                            background: 'radial-gradient(circle, rgba(0,210,255,0.12) 0%, transparent 70%)',
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute bottom-[-30%] left-[10%] w-72 h-72 rounded-full pointer-events-none"
                        style={{
                            background: 'radial-gradient(circle, rgba(0,255,135,0.08) 0%, transparent 70%)',
                        }}
                        aria-hidden="true"
                    />

                    {/* Floating particles */}
                    {particles.map((p, i) => (
                        <Particle
                            key={i}
                            style={{
                                top: p.top,
                                left: p.left,
                                animationDelay: p.animationDelay,
                                opacity: p.opacity,
                            }}
                        />
                    ))}

                    {/* ECG strip */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-60" aria-hidden="true">
                        <EcgLine />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 h-full min-h-[260px]">
                        <div className="flex-1 space-y-5">
                            {/* Badge */}
                            <div
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest uppercase"
                                style={{
                                    background: 'rgba(0,255,135,0.1)',
                                    border: '1px solid rgba(0,255,135,0.3)',
                                    color: '#00FF87',
                                }}
                            >
                                <span
                                    className="w-1.5 h-1.5 rounded-full animate-dot-pulse"
                                    style={{ background: '#00FF87' }}
                                />
                                {t('dashboard_hero_badge')}
                            </div>

                            {/* Title */}
                            <div>
                                <h2
                                    className="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #ffffff 0%, #a0d8f1 60%, #00D2FF 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    {t('dashboard_new_analysis_title')}
                                </h2>
                                <p className="text-sm leading-relaxed max-w-md"
                                   style={{ color: 'rgba(160,216,241,0.75)' }}>
                                    {t('dashboard_new_analysis_desc')}
                                </p>
                            </div>

                            {/* CTA Button */}
                            <button
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 group-hover:gap-3"
                                style={{
                                    background: 'linear-gradient(135deg, #00D2FF 0%, #00FF87 100%)',
                                    color: '#060B18',
                                    boxShadow: '0 0 20px rgba(0,210,255,0.3)',
                                }}
                            >
                                {t('dashboard_start')}
                                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>

                        {/* Pulsing ring icon */}
                        <div className="flex-shrink-0 relative">
                            {[1, 2, 3].map(ring => (
                                <div
                                    key={ring}
                                    className="absolute rounded-full"
                                    style={{
                                        inset: `${-(ring * 14)}px`,
                                        border: `1px solid rgba(0,210,255,${0.15 - ring * 0.04})`,
                                        animation: `neon-glow-green ${2 + ring * 0.5}s ease-in-out infinite`,
                                        animationDelay: `${ring * 0.3}s`,
                                    }}
                                    aria-hidden="true"
                                />
                            ))}
                            <div
                                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                                style={{
                                    background: 'rgba(0,210,255,0.08)',
                                    border: '1.5px solid rgba(0,210,255,0.4)',
                                    boxShadow: '0 0 30px rgba(0,210,255,0.2), inset 0 0 30px rgba(0,210,255,0.05)',
                                }}
                            >
                                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats ─ span 4 */}
                <div className="lg:col-span-4">
                    {stats
                        ? <UserStatsComponent stats={stats} />
                        : (
                            <div
                                className="dash-panel rounded-[24px] p-8 h-full flex flex-col items-center justify-center text-center gap-4"
                                style={{ minHeight: '260px' }}
                            >
                                <div
                                    className="w-10 h-10 rounded-full border-2 animate-spin"
                                    style={{ borderColor: 'rgba(0,210,255,0.2)', borderTopColor: '#00D2FF' }}
                                />
                                <p className="text-xs font-mono tracking-widest uppercase"
                                   style={{ color: 'rgba(0,210,255,0.6)' }}>
                                    {t('dashboard_stats_loading')}
                                </p>
                            </div>
                        )
                    }
                </div>

                {/* Recent Analyses ─ span 8 */}
                <div className="lg:col-span-8">
                    <div className="flex justify-between items-center mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-1.5 h-5 rounded-full"
                                style={{ background: 'linear-gradient(180deg, #00D2FF, #00FF87)' }}
                            />
                            <h2 className="text-base font-bold tracking-wide text-white">
                                {t('dashboard_recent_analyses_title')}
                            </h2>
                        </div>
                        <button
                            onClick={onViewHistory}
                            className="text-xs font-mono font-semibold tracking-widest uppercase px-4 py-2 rounded-full transition-all"
                            style={{
                                color: 'rgba(0,210,255,0.8)',
                                border: '1px solid rgba(0,210,255,0.2)',
                                background: 'rgba(0,210,255,0.05)',
                            }}
                        >
                            {t('view')} {t('nav_archive')} →
                        </button>
                    </div>

                    <div className="dash-panel rounded-[20px] overflow-hidden">
                        {recentAnalyses.length > 0 ? (
                            <div className="divide-y" style={{ borderColor: 'rgba(0,210,255,0.06)' }}>
                                {recentAnalyses.map((record, idx) => {
                                    const diag = normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis)[0]?.name;
                                    const initials = `${record.patientData.firstName?.[0] ?? '?'}${record.patientData.lastName?.[0] ?? ''}`;
                                    const gradients = [
                                        'linear-gradient(135deg, #00D2FF, #00FF87)',
                                        'linear-gradient(135deg, #7B61FF, #00D2FF)',
                                        'linear-gradient(135deg, #00FF87, #7B61FF)',
                                    ];
                                    return (
                                        <button
                                            key={record.id}
                                            onClick={() => onSelectAnalysis(record)}
                                            className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-200 dash-row-hover"
                                            style={{ border: '1px solid transparent' }}
                                        >
                                            {/* Avatar */}
                                            <div
                                                className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                                                style={{
                                                    background: gradients[idx % gradients.length],
                                                    color: '#060B18',
                                                    boxShadow: '0 0 12px rgba(0,210,255,0.2)',
                                                }}
                                            >
                                                {initials}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-white text-sm truncate">
                                                    {record.patientData.firstName} {record.patientData.lastName}
                                                </p>
                                                <p className="text-xs truncate mt-0.5"
                                                   style={{ color: 'rgba(160,216,241,0.6)' }}>
                                                    {diag || t('unknown_diagnosis')}
                                                </p>
                                            </div>

                                            {/* Date + arrow */}
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span
                                                    className="text-[10px] font-mono px-2 py-1 rounded-md"
                                                    style={{
                                                        background: 'rgba(0,210,255,0.08)',
                                                        color: 'rgba(0,210,255,0.7)',
                                                        border: '1px solid rgba(0,210,255,0.15)',
                                                    }}
                                                >
                                                    {new Date(record.date).toLocaleDateString('uz-UZ', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                                <svg
                                                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="rgba(0,210,255,0.5)"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16 px-6">
                                {/* Empty state with ECG */}
                                <div
                                    className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                                    style={{
                                        background: 'rgba(0,210,255,0.06)',
                                        border: '1px solid rgba(0,210,255,0.15)',
                                    }}
                                >
                                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="rgba(0,210,255,0.5)" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium mb-4" style={{ color: 'rgba(160,216,241,0.6)' }}>
                                    {t('dashboard_no_recent_analyses')}
                                </p>
                                <button
                                    onClick={onNewAnalysis}
                                    className="text-xs font-mono font-bold px-5 py-2.5 rounded-xl transition-all"
                                    style={{
                                        background: 'rgba(0,210,255,0.1)',
                                        border: '1px solid rgba(0,210,255,0.3)',
                                        color: '#00D2FF',
                                    }}
                                >
                                    {t('dashboard_new_analysis_title')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CME ─ span 4 */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1">
                        <div
                            className="w-1.5 h-5 rounded-full"
                            style={{ background: 'linear-gradient(180deg, #7B61FF, #00D2FF)' }}
                        />
                        <h2 className="text-base font-bold tracking-wide text-white">
                            {t('dashboard_cme_title')}
                        </h2>
                        <span
                            className="ml-auto text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                            style={{
                                background: 'rgba(123,97,255,0.15)',
                                color: '#7B61FF',
                                border: '1px solid rgba(123,97,255,0.3)',
                            }}
                        >
                            AI
                        </span>
                    </div>
                    <CmeSuggestions topics={cmeTopics} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
