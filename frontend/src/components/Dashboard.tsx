import React from 'react';
import type { AnalysisRecord, UserStats } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import AnalyticsHubPanel from './dashboard/AnalyticsHubPanel';
import { useTranslation } from '../hooks/useTranslation';

interface DashboardProps {
    userName: string;
    onNewAnalysis: () => void;
    onViewHistory: () => void;
    onOpenUziUtt?: () => void;
    recentAnalyses: AnalysisRecord[];
    allAnalyses: AnalysisRecord[];
    onSelectAnalysis: (record: AnalysisRecord) => void;
    stats: UserStats | null;
}

const EcgLine: React.FC = () => (
    <svg viewBox="0 0 600 50" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
            <linearGradient id="ecgG" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#00D2FF" stopOpacity="0" />
                <stop offset="35%"  stopColor="#00D2FF" stopOpacity="0.9" />
                <stop offset="65%"  stopColor="#00FF87" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#00FF87" stopOpacity="0" />
            </linearGradient>
            <filter id="ecgBlur">
                <feGaussianBlur stdDeviation="1.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <path
            d="M0,25 L70,25 L80,25 L88,6 L98,44 L108,2 L118,48 L128,25 L180,25 L190,25 L198,8 L208,42 L218,4 L228,46 L238,25 L300,25 L310,8 L320,42 L330,25 L390,25 L398,6 L408,44 L418,2 L428,48 L438,25 L500,25 L508,10 L518,40 L528,25 L600,25"
            fill="none"
            stroke="url(#ecgG)"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#ecgBlur)"
            strokeDasharray="700"
            strokeDashoffset="700"
            style={{ animation: 'ecg-draw 2.5s ease-out 0.5s forwards, ecg-loop 6s linear 3s infinite' }}
        />
    </svg>
);

function getDateStr() {
    const d = new Date();
    const days   = ['Yak', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha'];
    const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Nov', 'Dek'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}
function getTimeStr() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* Glassmorphism panel style - och oq shaffof */
const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.62)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.75)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.8) inset',
};

const Dashboard: React.FC<DashboardProps> = ({
    userName, onNewAnalysis, onViewHistory, onOpenUziUtt,
    recentAnalyses, allAnalyses, onSelectAnalysis, stats,
}) => {
    const { t } = useTranslation();

    const avatarGrads = [
        'linear-gradient(135deg,#06b6d4,#10b981)',
        'linear-gradient(135deg,#6366f1,#06b6d4)',
        'linear-gradient(135deg,#10b981,#3b82f6)',
        'linear-gradient(135deg,#f59e0b,#ef4444)',
        'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    ];

    return (
        <div className="space-y-5 w-full min-w-0 animate-fade-in-up pb-4">

            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                <div>
                    <p className="text-xs font-mono font-bold tracking-[0.22em] uppercase mb-2"
                       style={{ color: '#0891b2' }}>
                        {getDateStr()}
                    </p>
                    <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight leading-tight sm:leading-none">
                        <span className="text-slate-700">Salom Doktor </span>
                        <span style={{
                            background: 'linear-gradient(90deg, #0891b2 0%, #059669 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 8px rgba(8,145,178,0.25))',
                        }}>
                            {userName || 'Hamkasb!'}
                        </span>
                    </h1>
                </div>

                {/* Status pills */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                         style={{
                             background: 'rgba(209,250,229,0.8)',
                             border: '1px solid rgba(16,185,129,0.35)',
                             backdropFilter: 'blur(12px)',
                         }}>
                        <span className="w-2.5 h-2.5 rounded-full animate-dot-pulse"
                              style={{ background: '#059669', boxShadow: '0 0 8px #059669' }} />
                        <span className="text-xs font-mono font-black tracking-widest uppercase text-emerald-700">
                            AI ONLINE
                        </span>
                    </div>
                    <div className="px-3 py-2 rounded-full text-xs font-mono font-bold text-sky-700"
                         style={{
                             background: 'rgba(224,242,254,0.85)',
                             border: '1px solid rgba(14,165,233,0.3)',
                             backdropFilter: 'blur(12px)',
                         }}>
                        {getTimeStr()}
                    </div>
                </div>
            </div>

            {/* ── Grid ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:items-stretch">

                {/* Yangi konsilium (hero) */}
                <div className="lg:col-span-4 flex flex-col gap-3 min-w-0">
                    <div
                        onClick={onNewAnalysis}
                        className="relative overflow-hidden rounded-[24px] cursor-pointer flex-1 min-h-0"
                        style={{
                            background: 'linear-gradient(135deg, #071322 0%, #0c1e3a 55%, #082040 100%)',
                            border: '1px solid rgba(0,210,255,0.25)',
                            minHeight: '230px',
                            boxShadow: '0 0 40px rgba(0,210,255,0.1), 0 16px 48px rgba(0,0,0,0.25)',
                            transition: 'box-shadow .3s, border-color .3s',
                        }}
                        onMouseEnter={e => {
                            const d = e.currentTarget as HTMLDivElement;
                            d.style.boxShadow = '0 0 70px rgba(0,210,255,0.22), 0 16px 48px rgba(0,0,0,0.3)';
                            d.style.borderColor = 'rgba(0,210,255,0.5)';
                        }}
                        onMouseLeave={e => {
                            const d = e.currentTarget as HTMLDivElement;
                            d.style.boxShadow = '0 0 40px rgba(0,210,255,0.1), 0 16px 48px rgba(0,0,0,0.25)';
                            d.style.borderColor = 'rgba(0,210,255,0.25)';
                        }}
                    >
                        <div className="absolute inset-0 hex-grid-bg" aria-hidden="true" />
                        <div className="absolute top-[-30%] right-[-5%] w-72 h-72 rounded-full pointer-events-none"
                             style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 70%)' }} aria-hidden="true" />
                        <div className="absolute bottom-[-25%] left-[8%] w-56 h-56 rounded-full pointer-events-none"
                             style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)' }} aria-hidden="true" />
                        <div className="absolute bottom-0 left-0 right-0 h-14" aria-hidden="true">
                            <EcgLine />
                        </div>

                        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 min-h-[230px]">
                            <div className="flex-1 space-y-5">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest uppercase"
                                     style={{ background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.35)', color: '#00FF87' }}>
                                    <span className="w-1.5 h-1.5 rounded-full animate-dot-pulse" style={{ background: '#00FF87' }} />
                                    {t('dashboard_hero_badge')}
                                </div>
                                <div>
                                    <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-2"
                                        style={{
                                            background: 'linear-gradient(135deg,#ffffff 0%,#b0dcf5 50%,#00D2FF 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                        }}>
                                        {t('dashboard_new_analysis_title')}
                                    </h2>
                                    <p className="text-sm leading-relaxed max-w-md"
                                       style={{ color: 'rgba(180,220,245,0.85)' }}>
                                        {t('dashboard_new_analysis_desc')}
                                    </p>
                                </div>
                                <button type="button" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm"
                                        style={{
                                            background: 'linear-gradient(135deg,#00D2FF 0%,#00FF87 100%)',
                                            color: '#06111F',
                                            boxShadow: '0 0 24px rgba(0,210,255,0.35)',
                                        }}>
                                    {t('dashboard_start')}
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-shrink-0 relative hidden md:flex">
                                {[1,2,3].map(r=>(
                                    <div key={r} className="absolute rounded-full" aria-hidden="true"
                                         style={{ inset:`${-(r*16)}px`, border:`1px solid rgba(0,210,255,${0.18-r*0.05})` }} />
                                ))}
                                <div className="w-24 h-24 rounded-full flex items-center justify-center"
                                     style={{
                                         background:'rgba(0,210,255,0.08)',
                                         border:'1.5px solid rgba(0,210,255,0.45)',
                                         boxShadow:'0 0 40px rgba(0,210,255,0.25)',
                                     }}>
                                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analitika Hub — katta (UTT bloki olib tashlangan) */}
                <div className="lg:col-span-8 flex min-h-0">
                    <div className="w-full flex flex-col min-h-0 lg:min-h-[420px]">
                        <AnalyticsHubPanel stats={stats} allAnalyses={allAnalyses} />
                    </div>
                </div>

                {/* UTT/UZI — hero va analitikadan keyin, so‘nggi tahlillardan oldin */}
                {onOpenUziUtt && (
                    <div className="lg:col-span-12">
                        <button
                            type="button"
                            onClick={() => onOpenUziUtt()}
                            className="group w-full text-left rounded-xl border border-slate-200/90 bg-white/75 hover:bg-white backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow transition-all duration-200"
                        >
                            <span
                                className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-sky-50 border border-sky-200/90 flex items-center justify-center text-lg sm:text-xl"
                                aria-hidden
                            >
                                📡
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-mono font-bold tracking-wider uppercase text-sky-700/90 leading-none mb-0.5">
                                    {t('uzi_utt_badge')}
                                </p>
                                <p className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                                    {t('uzi_utt_strip_title')}
                                </p>
                                <p className="text-[10px] sm:text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2 sm:line-clamp-none">
                                    {t('uzi_utt_strip_subtitle')}
                                </p>
                            </div>
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs sm:text-sm font-bold text-sky-600 group-hover:text-sky-700">
                                {t('uzi_utt_open')}
                                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </span>
                        </button>
                    </div>
                )}

                {/* So‘nggi tahlillar — to‘liq kenglik */}
                <div className="lg:col-span-12">
                    <div className="flex justify-between items-center mb-3 px-1">
                        <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 rounded-full"
                                 style={{ background:'linear-gradient(180deg,#0891b2,#059669)' }} />
                            <h2 className="text-base font-bold text-slate-700 tracking-wide">
                                {t('dashboard_recent_analyses_title')}
                            </h2>
                        </div>
                        <button onClick={onViewHistory}
                                className="text-xs font-mono font-semibold tracking-widest uppercase px-4 py-2 rounded-full text-sky-600 transition-all hover:bg-sky-50"
                                style={{ border:'1px solid rgba(14,165,233,0.3)', background:'rgba(224,242,254,0.6)' }}>
                            {t('view')} {t('nav_archive')} →
                        </button>
                    </div>

                    <div className="rounded-[20px] overflow-hidden" style={glass}>
                        {recentAnalyses.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {recentAnalyses.map((record, idx) => {
                                    const diag    = normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis)[0]?.name;
                                    const initials= `${record.patientData.firstName?.[0]??'?'}${record.patientData.lastName?.[0]??''}`;
                                    return (
                                        <button
                                            key={record.id}
                                            onClick={() => onSelectAnalysis(record)}
                                            className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-200 hover:bg-white/60"
                                        >
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
                                                 style={{ background: avatarGrads[idx % avatarGrads.length], boxShadow:'0 2px 10px rgba(0,0,0,0.12)' }}>
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 truncate">
                                                    {record.patientData.firstName} {record.patientData.lastName}
                                                </p>
                                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                                    {diag || t('unknown_diagnosis')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg font-semibold text-sky-600"
                                                      style={{ background:'rgba(224,242,254,0.8)', border:'1px solid rgba(14,165,233,0.2)' }}>
                                                    {new Date(record.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                                                </span>
                                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-14 px-6">
                                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                                     style={{ background:'rgba(224,242,254,0.8)', border:'1px solid rgba(14,165,233,0.25)' }}>
                                    <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                                    </svg>
                                </div>
                                <p className="text-sm font-semibold text-slate-600 mb-5">
                                    {t('dashboard_no_recent_analyses')}
                                </p>
                                <button onClick={onNewAnalysis}
                                        className="text-xs font-bold px-6 py-2.5 rounded-xl text-sky-600 transition-all hover:bg-sky-50"
                                        style={{ background:'rgba(224,242,254,0.8)', border:'1px solid rgba(14,165,233,0.35)' }}>
                                    {t('dashboard_new_analysis_title')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
