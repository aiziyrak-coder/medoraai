import React, { useEffect, useMemo, useState } from 'react';
import type { AnalysisRecord, UserStats } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import type { Language } from '../../i18n/LanguageContext';
import { feedbackAccuracyToDisplayPercent, FEEDBACK_ACCURACY_SAMPLE_PERCENT } from '../../services/caseService';
import { getLocationStats, type LocationStat } from '../../services/apiPatientService';

const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.62)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.75)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.8) inset',
};

const WEEKDAY_LOCALE: Record<Language, string> = {
    'uz-L': 'uz-Latn-UZ',
    'uz-C': 'uz-Cyrl-UZ',
    ru: 'ru-RU',
    en: 'en-GB',
    kaa: 'kk-KZ',
};

interface AnalyticsHubPanelProps {
    stats: UserStats | null;
    allAnalyses: AnalysisRecord[];
    onNewAnalysis?: () => void;
    onOpenTools?: () => void;
    onOpenUziUtt?: () => void;
    onViewHistory?: () => void;
}

function patientKey(record: AnalysisRecord): string {
    const id = String(record.patientId ?? '').trim();
    if (id) return `id:${id}`;
    const pd = record.patientData;
    return `name:${(pd.lastName || '')}|${(pd.firstName || '')}`.trim().toLowerCase();
}

function buildWeeklyActivity(analyses: AnalysisRecord[], language: Language) {
    const locale = WEEKDAY_LOCALE[language] ?? 'en-GB';
    const now = new Date();
    const buckets: { label: string; count: number; isToday: boolean }[] = [];

    for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const count = analyses.filter((a) => {
            const dt = new Date(a.date);
            return !Number.isNaN(dt.getTime()) && dt >= dayStart && dt < dayEnd;
        }).length;

        buckets.push({
            label: dayStart.toLocaleDateString(locale, { weekday: 'short' }),
            count,
            isToday: i === 0,
        });
    }

    return buckets;
}

function buildPracticeInsights(analyses: AnalysisRecord[]) {
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recent = analyses.filter((a) => {
        const t = new Date(a.date).getTime();
        return !Number.isNaN(t) && now - t <= ms30;
    });

    const visits = new Map<string, number>();
    for (const r of recent) {
        const key = patientKey(r);
        visits.set(key, (visits.get(key) ?? 0) + 1);
    }

    let returnVisits = 0;
    for (const n of visits.values()) {
        if (n > 1) returnVisits += 1;
    }

    return {
        uniquePatients: visits.size,
        returnPatients: returnVisits,
    };
}

const AnalyticsHubPanel: React.FC<AnalyticsHubPanelProps> = ({
    stats,
    allAnalyses,
    onNewAnalysis,
    onOpenTools,
    onOpenUziUtt,
    onViewHistory,
}) => {
    const { t, language } = useTranslation();

    const weekly = useMemo(() => buildWeeklyActivity(allAnalyses, language), [allAnalyses, language]);
    const insights = useMemo(() => buildPracticeInsights(allAnalyses), [allAnalyses]);
    const maxWeek = Math.max(...weekly.map((d) => d.count), 1);
    const [locationStats, setLocationStats] = useState<LocationStat[]>([]);

    useEffect(() => {
        getLocationStats()
            .then((res) => {
                if (res.success && res.data) setLocationStats(res.data.slice(0, 6));
            })
            .catch(() => setLocationStats([]));
    }, []);
    const maxLoc = Math.max(...locationStats.map((l) => l.count), 1);

    const quickActions = [
        onNewAnalysis && {
            key: 'new',
            icon: '⚕️',
            title: t('dashboard_quick_new_title'),
            desc: t('dashboard_quick_new_desc'),
            onClick: onNewAnalysis,
            gradient: 'from-sky-500/10 to-cyan-500/5',
            border: 'border-sky-200/80',
        },
        onOpenUziUtt && {
            key: 'imaging',
            icon: '📡',
            title: t('dashboard_quick_imaging_title'),
            desc: t('dashboard_quick_imaging_desc'),
            onClick: onOpenUziUtt,
            gradient: 'from-indigo-500/10 to-violet-500/5',
            border: 'border-indigo-200/80',
        },
        onOpenTools && {
            key: 'tools',
            icon: '🧰',
            title: t('mod_tools_title'),
            desc: t('dashboard_quick_tools_desc'),
            onClick: onOpenTools,
            gradient: 'from-emerald-500/10 to-teal-500/5',
            border: 'border-emerald-200/80',
        },
        onViewHistory && {
            key: 'history',
            icon: '📋',
            title: t('dashboard_quick_history_title'),
            desc: t('dashboard_quick_history_desc'),
            onClick: onViewHistory,
            gradient: 'from-amber-500/10 to-orange-500/5',
            border: 'border-amber-200/80',
        },
    ].filter(Boolean) as Array<{
        key: string;
        icon: string;
        title: string;
        desc: string;
        onClick: () => void;
        gradient: string;
        border: string;
    }>;

    if (!stats) {
        return (
            <div
                className="rounded-[22px] p-8 h-full min-h-[320px] flex flex-col items-center justify-center text-center gap-4"
                style={glass}
            >
                <div
                    className="w-12 h-12 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(8,145,178,0.2)', borderTopColor: '#0891b2' }}
                />
                <p className="text-sm font-semibold text-slate-500">{t('dashboard_stats_loading')}</p>
            </div>
        );
    }

    const now = new Date();
    const msInDay = 1000 * 60 * 60 * 24;
    const inLast = (days: number) =>
        allAnalyses.filter((a) => {
            const dt = new Date(a.date);
            if (Number.isNaN(dt.getTime())) return false;
            return (now.getTime() - dt.getTime()) / msInDay <= days;
        }).length;

    const sc = stats.serverCounts;
    const today = sc ? sc.last24h : inLast(1);
    const week = sc ? sc.last7d : inLast(7);
    const month = sc ? sc.last30d : inLast(30);
    const total = stats.totalAnalyses;
    const acc =
        stats.feedbackEvalCount === 0
            ? FEEDBACK_ACCURACY_SAMPLE_PERCENT
            : feedbackAccuracyToDisplayPercent(stats.feedbackAccuracy);

    const avgWeek = week > 0 ? (week / 7).toFixed(1) : '—';
    const avgMonth = month > 0 ? (month / 30).toFixed(1) : '—';

    const MetricCard: React.FC<{
        label: string;
        value: number | string;
        sub: string;
        className: string;
        dark?: boolean;
    }> = ({ label, value, sub, className, dark }) => (
        <div className={`rounded-xl px-3 py-3 md:py-3.5 border ${className}`}>
            <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-slate-300' : ''}`}>
                {label}
            </p>
            <p className="mt-1 text-2xl md:text-3xl xl:text-4xl font-black tabular-nums leading-none text-inherit">
                {value}
            </p>
            <p className={`text-[9px] mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>
        </div>
    );

    return (
        <div
            className="rounded-[22px] p-4 md:p-6 flex flex-col xl:flex-row xl:items-stretch gap-5 xl:gap-6 w-full min-h-0 flex-1"
            style={glass}
        >
            <div className="flex flex-col gap-4 min-w-0 xl:w-[44%] xl:max-w-md shrink-0">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-1 h-6 rounded-full shrink-0"
                            style={{ background: 'linear-gradient(180deg,#6366f1,#0891b2)' }}
                        />
                        <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                            {t('dashboard_analytics_title')}
                        </h2>
                    </div>
                    <p className="text-[11px] md:text-sm text-slate-500 leading-relaxed pl-3 border-l-2 border-sky-100">
                        {t('dashboard_analytics_subtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                    <MetricCard
                        label={t('stats_range_day')}
                        value={today}
                        sub={t('stats_total_analyses')}
                        className="bg-sky-50 border-sky-100/80"
                    />
                    <MetricCard
                        label={t('stats_range_week')}
                        value={week}
                        sub={t('stats_total_analyses')}
                        className="bg-emerald-50 border-emerald-100/80"
                    />
                    <MetricCard
                        label={t('stats_range_month')}
                        value={month}
                        sub={t('stats_total_analyses')}
                        className="bg-indigo-50 border-indigo-100/80"
                    />
                    <MetricCard
                        label={t('stats_range_all')}
                        value={total}
                        sub={t('stats_total_analyses')}
                        className="bg-slate-900 text-white border-slate-800"
                        dark
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                    <div className="rounded-lg px-2.5 py-2.5 bg-white/70 border border-slate-100">
                        <span className="font-semibold text-slate-500">{t('dashboard_analytics_avg_week')}</span>
                        <span className="float-right font-mono font-bold text-sky-700 text-sm">{avgWeek}</span>
                    </div>
                    <div className="rounded-lg px-2.5 py-2.5 bg-white/70 border border-slate-100">
                        <span className="font-semibold text-slate-500">{t('dashboard_analytics_avg_month')}</span>
                        <span className="float-right font-mono font-bold text-emerald-700 text-sm">{avgMonth}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl px-3 py-3 border border-violet-100 bg-gradient-to-br from-violet-50/90 to-white/80">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-violet-600/80">
                            {t('dashboard_analytics_unique_patients')}
                        </p>
                        <p className="text-2xl font-black text-violet-800 tabular-nums mt-1">{insights.uniquePatients}</p>
                    </div>
                    <div className="rounded-xl px-3 py-3 border border-teal-100 bg-gradient-to-br from-teal-50/90 to-white/80">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-teal-700/80">
                            {t('dashboard_analytics_return_patients')}
                        </p>
                        <p className="text-2xl font-black text-teal-800 tabular-nums mt-1">{insights.returnPatients}</p>
                    </div>
                </div>

                <div className="rounded-xl px-4 py-3.5 flex items-center justify-between gap-2 border border-slate-100 bg-gradient-to-r from-sky-50/80 to-emerald-50/50 mt-auto">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {t('stats_feedback_accuracy')}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t('dashboard_analytics_feedback_hint')}</p>
                    </div>
                    <p className="text-3xl font-black text-sky-700 tabular-nums">{acc}%</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 min-h-0 flex-1 min-w-0 xl:border-l xl:border-slate-100 xl:pl-6">
                {quickActions.length > 0 && (
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                            {t('dashboard_analytics_quick_heading')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {quickActions.map((action) => (
                                <button
                                    key={action.key}
                                    type="button"
                                    onClick={action.onClick}
                                    className={`text-left p-3 rounded-xl border bg-gradient-to-br ${action.gradient} ${action.border} transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}
                                >
                                    <span className="text-lg" aria-hidden>{action.icon}</span>
                                    <p className="text-xs font-bold text-slate-800 mt-1 leading-tight">{action.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{action.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {locationStats.length > 0 && (
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                            {t('dashboard_analytics_location_heading')}
                        </p>
                        <div className="space-y-1.5">
                            {locationStats.map((loc) => (
                                <div key={loc.region_id} className="flex items-center gap-2 text-[10px]">
                                    <span className="w-28 truncate text-slate-600 font-medium" title={loc.region_name}>
                                        {loc.region_name.replace(/ viloyati| shahri/gi, '')}
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500"
                                            style={{ width: `${Math.max(8, (loc.count / maxLoc) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="font-mono font-bold text-slate-700 w-6 text-right">{loc.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
                        {t('dashboard_analytics_activity_heading')}
                    </p>
                    <div className="rounded-xl border border-slate-100 bg-white/50 p-4 flex-1 flex flex-col justify-end min-h-[140px]">
                        <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-28">
                            {weekly.map((day) => (
                                <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                                    <span className="text-[10px] font-mono font-bold text-slate-600 tabular-nums">
                                        {day.count > 0 ? day.count : ''}
                                    </span>
                                    <div className="w-full flex items-end justify-center h-20">
                                        <div
                                            className="w-full max-w-[2.25rem] rounded-t-lg transition-all duration-500"
                                            style={{
                                                height: `${Math.max(12, (day.count / maxWeek) * 100)}%`,
                                                background: day.isToday
                                                    ? 'linear-gradient(180deg, #06b6d4 0%, #059669 100%)'
                                                    : 'linear-gradient(180deg, rgba(8,145,178,0.55) 0%, rgba(5,150,105,0.35) 100%)',
                                                boxShadow: day.isToday ? '0 0 12px rgba(6,182,212,0.35)' : undefined,
                                            }}
                                        />
                                    </div>
                                    <span
                                        className={`text-[9px] font-semibold truncate w-full text-center ${
                                            day.isToday ? 'text-cyan-700' : 'text-slate-400'
                                        }`}
                                    >
                                        {day.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-snug border-t border-slate-100 pt-3 shrink-0">
                    {t('dashboard_analytics_source_note')}
                </p>
            </div>
        </div>
    );
};

export default AnalyticsHubPanel;
