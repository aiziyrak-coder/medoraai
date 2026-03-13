import React from 'react';
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

/** Compact ECG line across the hero bottom */
const EcgLine: React.FC = () => (
    <svg viewBox="0 0 600 50" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
            <linearGradient id="ecg2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#00D2FF" stopOpacity="0" />
                <stop offset="35%"  stopColor="#00D2FF" stopOpacity="0.9" />
                <stop offset="65%"  stopColor="#00FF87" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00FF87" stopOpacity="0" />
            </linearGradient>
            <filter id="ecgBlur2">
                <feGaussianBlur stdDeviation="1.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <path
            d="M0,25 L70,25 L80,25 L88,6 L98,44 L108,2 L118,48 L128,25 L180,25 L190,25 L198,8 L208,42 L218,4 L228,46 L238,25 L300,25 L310,8 L320,42 L330,25 L390,25 L398,6 L408,44 L418,2 L428,48 L438,25 L500,25 L508,10 L518,40 L528,25 L600,25"
            fill="none"
            stroke="url(#ecg2)"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#ecgBlur2)"
            strokeDasharray="700"
            strokeDashoffset="700"
            style={{ animation: 'ecg-draw 2.5s ease-out 0.5s forwards, ecg-loop 6s linear 3s infinite' }}
        />
    </svg>
);

/** Get readable date string without broken locale */
function getDateStr() {
    const d = new Date();
    const days   = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha'];
    const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Nov', 'Dek'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}
function getTimeStr() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const Dashboard: React.FC<DashboardProps> = ({
    userName, onNewAnalysis, onViewHistory,
    recentAnalyses, onSelectAnalysis, stats, cmeTopics,
}) => {
    const { t } = useTranslation();
    const firstName = userName.split(' ')[0];

    const gradientAccents = [
        'linear-gradient(135deg,#00D2FF,#00FF87)',
        'linear-gradient(135deg,#7B61FF,#00D2FF)',
        'linear-gradient(135deg,#00FF87,#7B61FF)',
        'linear-gradient(135deg,#FF6B6B,#FF8E53)',
        'linear-gradient(135deg,#4FACFE,#00F2FE)',
    ];

    return (
        /* ── Dark full-area wrapper ─────────────────────────── */
        <div
            className="min-h-full w-full rounded-2xl"
            style={{
                background: 'linear-gradient(160deg, #06111F 0%, #080E1A 40%, #0B1525 100%)',
                padding: '28px 24px 32px',
            }}
        >
            <div className="space-y-6 w-full min-w-0 animate-fade-in-up">

                {/* ── Header ──────────────────────────────── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <p
                            className="text-xs font-mono font-bold tracking-[0.22em] uppercase mb-2"
                            style={{ color: 'rgba(0,210,255,0.75)' }}
                        >
                            {getDateStr()}
                        </p>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
                            <span style={{ color: 'rgba(220,240,255,0.95)' }}>Salom, </span>
                            <span
                                style={{
                                    background: 'linear-gradient(90deg, #00D2FF 0%, #00FF87 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    filter: 'drop-shadow(0 0 16px rgba(0,210,255,0.4))',
                                }}
                            >
                                {firstName}!
                            </span>
                        </h1>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div
                            className="flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{
                                background: 'rgba(0,255,135,0.1)',
                                border: '1px solid rgba(0,255,135,0.3)',
                            }}
                        >
                            <span
                                className="w-2.5 h-2.5 rounded-full animate-dot-pulse"
                                style={{ background: '#00FF87', boxShadow: '0 0 8px #00FF87' }}
                            />
                            <span className="text-xs font-mono font-black tracking-widest uppercase"
                                  style={{ color: '#00FF87' }}>
                                AI ONLINE
                            </span>
                        </div>
                        <div
                            className="px-3 py-2 rounded-full text-xs font-mono font-bold"
                            style={{
                                background: 'rgba(0,210,255,0.1)',
                                border: '1px solid rgba(0,210,255,0.25)',
                                color: '#00D2FF',
                            }}
                        >
                            {getTimeStr()}
                        </div>
                    </div>
                </div>

                {/* ── Main Grid ───────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                    {/* ─ Hero ─ span 8 */}
                    <div
                        onClick={onNewAnalysis}
                        className="lg:col-span-8 relative overflow-hidden rounded-[24px] cursor-pointer"
                        style={{
                            background: 'linear-gradient(135deg, #071322 0%, #0C1D38 50%, #0A2444 100%)',
                            border: '1px solid rgba(0,210,255,0.22)',
                            minHeight: '240px',
                            boxShadow: '0 0 40px rgba(0,210,255,0.1), 0 20px 60px rgba(0,0,0,0.5)',
                            transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 70px rgba(0,210,255,0.22), 0 0 140px rgba(0,255,135,0.08), 0 20px 60px rgba(0,0,0,0.5)';
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,210,255,0.45)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 40px rgba(0,210,255,0.1), 0 20px 60px rgba(0,0,0,0.5)';
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,210,255,0.22)';
                        }}
                    >
                        {/* Hex bg */}
                        <div className="absolute inset-0 hex-grid-bg" aria-hidden="true" />

                        {/* Orbs */}
                        <div className="absolute top-[-30%] right-[-5%] w-80 h-80 rounded-full pointer-events-none"
                             style={{ background: 'radial-gradient(circle, rgba(0,210,255,0.14) 0%, transparent 70%)' }} />
                        <div className="absolute bottom-[-25%] left-[8%] w-64 h-64 rounded-full pointer-events-none"
                             style={{ background: 'radial-gradient(circle, rgba(0,255,135,0.1) 0%, transparent 70%)' }} />

                        {/* ECG strip */}
                        <div className="absolute bottom-0 left-0 right-0 h-14" aria-hidden="true">
                            <EcgLine />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 min-h-[240px]">
                            <div className="flex-1 space-y-5">
                                {/* Live badge */}
                                <div
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest uppercase"
                                    style={{ background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.35)', color: '#00FF87' }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full animate-dot-pulse" style={{ background: '#00FF87' }} />
                                    {t('dashboard_hero_badge')}
                                </div>

                                {/* Title */}
                                <div>
                                    <h2
                                        className="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-2"
                                        style={{
                                            background: 'linear-gradient(135deg, #ffffff 0%, #b0dcf5 50%, #00D2FF 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                        }}
                                    >
                                        {t('dashboard_new_analysis_title')}
                                    </h2>
                                    <p className="text-sm leading-relaxed max-w-md"
                                       style={{ color: 'rgba(180,220,245,0.8)' }}>
                                        {t('dashboard_new_analysis_desc')}
                                    </p>
                                </div>

                                {/* CTA */}
                                <button
                                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm"
                                    style={{
                                        background: 'linear-gradient(135deg, #00D2FF 0%, #00FF87 100%)',
                                        color: '#060B18',
                                        boxShadow: '0 0 24px rgba(0,210,255,0.35)',
                                    }}
                                >
                                    {t('dashboard_start')}
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>

                            {/* Pulsing rings */}
                            <div className="flex-shrink-0 relative hidden md:flex">
                                {[1, 2, 3].map(r => (
                                    <div
                                        key={r}
                                        className="absolute rounded-full"
                                        aria-hidden="true"
                                        style={{
                                            inset: `${-(r * 16)}px`,
                                            border: `1px solid rgba(0,210,255,${0.18 - r * 0.05})`,
                                        }}
                                    />
                                ))}
                                <div
                                    className="w-24 h-24 rounded-full flex items-center justify-center"
                                    style={{
                                        background: 'rgba(0,210,255,0.08)',
                                        border: '1.5px solid rgba(0,210,255,0.45)',
                                        boxShadow: '0 0 40px rgba(0,210,255,0.25), inset 0 0 30px rgba(0,210,255,0.06)',
                                    }}
                                >
                                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─ Stats ─ span 4 */}
                    <div className="lg:col-span-4">
                        {stats
                            ? <UserStatsComponent stats={stats} />
                            : (
                                <div
                                    className="rounded-[24px] p-8 h-full flex flex-col items-center justify-center text-center gap-4"
                                    style={{
                                        background: 'linear-gradient(145deg, #0D1E32 0%, #0A1628 100%)',
                                        border: '1px solid rgba(0,210,255,0.18)',
                                        minHeight: '240px',
                                    }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-full border-2 animate-spin"
                                        style={{ borderColor: 'rgba(0,210,255,0.15)', borderTopColor: '#00D2FF' }}
                                    />
                                    <p className="text-sm font-mono tracking-widest uppercase"
                                       style={{ color: 'rgba(0,210,255,0.75)' }}>
                                        {t('dashboard_stats_loading')}
                                    </p>
                                </div>
                            )
                        }
                    </div>

                    {/* ─ Recent Analyses ─ span 8 */}
                    <div className="lg:col-span-8">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-1 h-5 rounded-full"
                                     style={{ background: 'linear-gradient(180deg, #00D2FF, #00FF87)' }} />
                                <h2 className="text-base font-bold tracking-wide"
                                    style={{ color: 'rgba(220,240,255,0.95)' }}>
                                    {t('dashboard_recent_analyses_title')}
                                </h2>
                            </div>
                            <button
                                onClick={onViewHistory}
                                className="text-xs font-mono font-semibold tracking-widest uppercase px-4 py-2 rounded-full transition-all hover:border-cyan-400"
                                style={{
                                    color: '#00D2FF',
                                    border: '1px solid rgba(0,210,255,0.3)',
                                    background: 'rgba(0,210,255,0.07)',
                                }}
                            >
                                {t('view')} {t('nav_archive')} →
                            </button>
                        </div>

                        <div
                            className="rounded-[20px] overflow-hidden"
                            style={{
                                background: 'linear-gradient(145deg, #0D1E32 0%, #0A1628 100%)',
                                border: '1px solid rgba(0,210,255,0.18)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            }}
                        >
                            {recentAnalyses.length > 0 ? (
                                <div className="divide-y" style={{ borderColor: 'rgba(0,210,255,0.08)' }}>
                                    {recentAnalyses.map((record, idx) => {
                                        const diag = normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis)[0]?.name;
                                        const initials = `${record.patientData.firstName?.[0] ?? '?'}${record.patientData.lastName?.[0] ?? ''}`;
                                        return (
                                            <button
                                                key={record.id}
                                                onClick={() => onSelectAnalysis(record)}
                                                className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-200 dash-row-hover"
                                                style={{ border: '1px solid transparent' }}
                                            >
                                                {/* Avatar */}
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                                                    style={{
                                                        background: gradientAccents[idx % gradientAccents.length],
                                                        color: '#06111F',
                                                        boxShadow: '0 0 12px rgba(0,210,255,0.2)',
                                                    }}
                                                >
                                                    {initials}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate"
                                                       style={{ color: 'rgba(220,240,255,0.95)' }}>
                                                        {record.patientData.firstName} {record.patientData.lastName}
                                                    </p>
                                                    <p className="text-xs truncate mt-0.5"
                                                       style={{ color: 'rgba(160,210,240,0.8)' }}>
                                                        {diag || t('unknown_diagnosis')}
                                                    </p>
                                                </div>

                                                {/* Meta */}
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span
                                                        className="text-[10px] font-mono px-2.5 py-1 rounded-lg font-bold"
                                                        style={{
                                                            background: 'rgba(0,210,255,0.12)',
                                                            color: '#00D2FF',
                                                            border: '1px solid rgba(0,210,255,0.25)',
                                                        }}
                                                    >
                                                        {new Date(record.date).toLocaleDateString('en-GB', {
                                                            day: 'numeric', month: 'short',
                                                        })}
                                                    </span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                                                         stroke="#00D2FF" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-14 px-6">
                                    <div
                                        className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                                        style={{ background: 'rgba(0,210,255,0.1)', border: '1px solid rgba(0,210,255,0.3)' }}
                                    >
                                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none"
                                             stroke="#00D2FF" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-semibold mb-5"
                                       style={{ color: 'rgba(200,230,255,0.9)' }}>
                                        {t('dashboard_no_recent_analyses')}
                                    </p>
                                    <button
                                        onClick={onNewAnalysis}
                                        className="text-xs font-bold px-6 py-2.5 rounded-xl"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(0,210,255,0.2), rgba(0,255,135,0.12))',
                                            border: '1px solid rgba(0,210,255,0.4)',
                                            color: '#00D2FF',
                                        }}
                                    >
                                        {t('dashboard_new_analysis_title')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─ CME ─ span 4 */}
                    <div className="lg:col-span-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 rounded-full"
                                 style={{ background: 'linear-gradient(180deg, #7B61FF, #00D2FF)' }} />
                            <h2 className="text-base font-bold tracking-wide"
                                style={{ color: 'rgba(220,210,255,0.95)' }}>
                                {t('dashboard_cme_title')}
                            </h2>
                            <span
                                className="ml-auto text-[9px] font-mono font-black px-2 py-0.5 rounded tracking-widest uppercase"
                                style={{
                                    background: 'rgba(123,97,255,0.2)',
                                    color: '#B09FFF',
                                    border: '1px solid rgba(123,97,255,0.35)',
                                }}
                            >
                                AI
                            </span>
                        </div>
                        <CmeSuggestions topics={cmeTopics} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
