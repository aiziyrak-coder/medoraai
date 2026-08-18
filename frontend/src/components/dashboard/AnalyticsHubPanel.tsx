import React, { useEffect, useMemo, useState } from 'react';
import type { AnalysisRecord, UserStats } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import type { Language } from '../../i18n/LanguageContext';
import { feedbackAccuracyToDisplayPercent, FEEDBACK_ACCURACY_SAMPLE_PERCENT } from '../../services/caseService';
import {
    getLocationStats,
    type DistrictLocationStat,
    type RegionLocationStat,
} from '../../services/apiPatientService';

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

    const firstSeen = new Map<string, number>();
    for (const r of analyses) {
        const t = new Date(r.date).getTime();
        if (Number.isNaN(t)) continue;
        const key = patientKey(r);
        const prev = firstSeen.get(key);
        if (prev === undefined || t < prev) firstSeen.set(key, t);
    }

    let newPatients = 0;
    for (const firstT of firstSeen.values()) {
        if (now - firstT <= ms30) newPatients += 1;
    }

    const recent = analyses.filter((a) => {
        const t = new Date(a.date).getTime();
        return !Number.isNaN(t) && now - t <= ms30;
    });
    const visits = new Map<string, number>();
    for (const r of recent) {
        const key = patientKey(r);
        visits.set(key, (visits.get(key) ?? 0) + 1);
    }
    let returnPatients = 0;
    for (const n of visits.values()) {
        if (n > 1) returnPatients += 1;
    }

    return { newPatients, returnPatients };
}

const LocationBar: React.FC<{
    label: string;
    sublabel?: string;
    count: number;
    max: number;
    gradient: string;
}> = ({ label, sublabel, count, max, gradient }) => (
    <div className="flex items-center gap-2 text-[10px]">
        <div className="w-[7.5rem] sm:w-32 shrink-0 min-w-0">
            <span className="block truncate text-slate-700 font-semibold" title={label}>
                {label}
            </span>
            {sublabel && (
                <span className="block truncate text-[9px] text-slate-400" title={sublabel}>
                    {sublabel}
                </span>
            )}
        </div>
        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
                className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                style={{ width: `${Math.max(count > 0 ? 10 : 0, (count / max) * 100)}%` }}
            />
        </div>
        <span className="font-mono font-bold text-slate-700 w-7 text-right tabular-nums">{count}</span>
    </div>
);

const AnalyticsHubPanel: React.FC<AnalyticsHubPanelProps> = ({ stats, allAnalyses }) => {
    const { t, language } = useTranslation();

    const weekly = useMemo(() => buildWeeklyActivity(allAnalyses, language), [allAnalyses, language]);
    const insights = useMemo(() => buildPracticeInsights(allAnalyses), [allAnalyses]);
    const maxWeek = Math.max(...weekly.map((d) => d.count), 1);

    const [districtStats, setDistrictStats] = useState<DistrictLocationStat[]>([]);
    const [regionStats, setRegionStats] = useState<RegionLocationStat[]>([]);

    useEffect(() => {
        getLocationStats()
            .then((res) => {
                if (res.success && res.data) {
                    setDistrictStats(res.data.districts ?? []);
                    setRegionStats(res.data.regions ?? []);
                }
            })
            .catch(() => {
                setDistrictStats([]);
                setRegionStats([]);
            });
    }, []);

    const maxDistrict = Math.max(...districtStats.map((l) => l.count), 1);
    const maxRegion = Math.max(...regionStats.map((l) => l.count), 1);

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
    const newPatients = stats.newPatients30d ?? insights.newPatients;
    const returnPatients = stats.returnPatients30d ?? insights.returnPatients;
    const acc =
        stats.feedbackEvalCount === 0
            ? FEEDBACK_ACCURACY_SAMPLE_PERCENT
            : feedbackAccuracyToDisplayPercent(stats.feedbackAccuracy);

    const avgWeek = week > 0 ? (week / 7).toFixed(1) : null;
    const avgMonth = month > 0 ? (month / 30).toFixed(1) : null;
    const weekEmpty = weekly.every((d) => d.count === 0);

    const MetricCard: React.FC<{
        label: string;
        value: number | string;
        sub: string;
        className: string;
        dark?: boolean;
        emptyHint?: string;
    }> = ({ label, value, sub, className, dark, emptyHint }) => {
        const isEmpty = value === 0 || value === '0';
        return (
            <div className={`rounded-xl px-3 py-3 md:py-3.5 border ${className}`}>
                <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {label}
                </p>
                {isEmpty ? (
                    <>
                        <p className={`mt-1.5 text-lg md:text-xl font-semibold tracking-wide ${dark ? 'text-slate-400' : 'text-slate-300'}`}>
                            —
                        </p>
                        <p className={`text-[9px] mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {emptyHint || t('dashboard_analytics_empty')}
                        </p>
                    </>
                ) : (
                    <>
                        <p className="mt-1 text-2xl md:text-3xl xl:text-4xl font-black tabular-nums leading-none text-inherit">
                            {value}
                        </p>
                        <p className={`text-[9px] mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>
                    </>
                )}
            </div>
        );
    };

    const PatientStatCard: React.FC<{
        label: string;
        hint: string;
        value: number;
        accent: 'violet' | 'teal';
        icon: React.ReactNode;
    }> = ({ label, hint, value, accent, icon }) => {
        const empty = value === 0;
        const wrap =
            accent === 'violet'
                ? 'border-violet-100 bg-gradient-to-br from-violet-50/90 to-white'
                : 'border-teal-100 bg-gradient-to-br from-teal-50/90 to-white';
        const labelClr = accent === 'violet' ? 'text-violet-600/80' : 'text-teal-700/80';
        const numClr = accent === 'violet' ? 'text-violet-800' : 'text-teal-800';
        const hintClr = accent === 'violet' ? 'text-violet-600/70' : 'text-teal-700/70';
        const iconBg = accent === 'violet' ? 'bg-violet-100 text-violet-600' : 'bg-teal-100 text-teal-700';
        return (
            <div className={`rounded-xl px-3 py-3 border ${wrap} min-h-[5.5rem] flex flex-col`}>
                <div className="flex items-start justify-between gap-2">
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${labelClr} leading-tight`}>
                        {label}
                    </p>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                        {icon}
                    </span>
                </div>
                {empty ? (
                    <div className="mt-auto pt-2">
                        <p className="text-sm font-semibold text-slate-400">{t('dashboard_analytics_empty')}</p>
                        <p className={`text-[8px] mt-0.5 ${hintClr}`}>{hint}</p>
                    </div>
                ) : (
                    <div className="mt-auto pt-1">
                        <p className={`text-2xl font-black tabular-nums ${numClr}`}>{value}</p>
                        <p className={`text-[8px] mt-0.5 ${hintClr}`}>{hint}</p>
                    </div>
                )}
            </div>
        );
    };

    const shortRegion = (name: string) => name.replace(/ viloyati| shahri| Respublikasi/gi, '').trim();

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
                        emptyHint={t('dashboard_analytics_empty_today')}
                        className="bg-sky-50 border-sky-100/80"
                    />
                    <MetricCard
                        label={t('stats_range_week')}
                        value={week}
                        sub={t('stats_total_analyses')}
                        emptyHint={t('dashboard_analytics_empty_period')}
                        className="bg-emerald-50 border-emerald-100/80"
                    />
                    <MetricCard
                        label={t('stats_range_month')}
                        value={month}
                        sub={t('stats_total_analyses')}
                        emptyHint={t('dashboard_analytics_empty_period')}
                        className="bg-indigo-50 border-indigo-100/80"
                    />
                    <MetricCard
                        label={t('stats_range_all')}
                        value={total.toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU')}
                        sub={t('stats_total_analyses')}
                        className="bg-slate-900 text-white border-slate-800"
                        dark
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                    <div className="rounded-lg px-2.5 py-2.5 bg-white/70 border border-slate-100">
                        <span className="font-semibold text-slate-500">{t('dashboard_analytics_avg_week')}</span>
                        <span className={`float-right font-mono font-bold text-sm ${avgWeek ? 'text-sky-700' : 'text-slate-300'}`}>
                            {avgWeek ?? '—'}
                        </span>
                    </div>
                    <div className="rounded-lg px-2.5 py-2.5 bg-white/70 border border-slate-100">
                        <span className="font-semibold text-slate-500">{t('dashboard_analytics_avg_month')}</span>
                        <span className={`float-right font-mono font-bold text-sm ${avgMonth ? 'text-emerald-700' : 'text-slate-300'}`}>
                            {avgMonth ?? '—'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <PatientStatCard
                        label={t('dashboard_analytics_new_patients')}
                        hint={t('dashboard_analytics_new_patients_hint')}
                        value={newPatients}
                        accent="violet"
                        icon={
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        }
                    />
                    <PatientStatCard
                        label={t('dashboard_analytics_return_patients')}
                        hint={t('dashboard_analytics_return_patients_hint')}
                        value={returnPatients}
                        accent="teal"
                        icon={
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        }
                    />
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
                <div className="rounded-xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/50 to-white/60 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700/90 mb-1">
                        {t('dashboard_analytics_district_heading')}
                    </p>
                    <p className="text-[10px] text-slate-500 mb-3">{t('dashboard_analytics_district_hint')}</p>
                    {districtStats.length > 0 ? (
                        <div className="space-y-2">
                            {districtStats.map((loc) => (
                                <LocationBar
                                    key={loc.district_id}
                                    label={loc.district_name.replace(/ tumani| shahri/gi, '')}
                                    sublabel={shortRegion(loc.region_name)}
                                    count={loc.count}
                                    max={maxDistrict}
                                    gradient="from-emerald-400 to-teal-500"
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 py-4 text-center">{t('dashboard_analytics_location_empty')}</p>
                    )}
                </div>

                {regionStats.length > 0 && (
                    <div className="rounded-xl border border-violet-100/80 bg-white/40 p-3.5">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600/90 mb-2">
                            {t('dashboard_analytics_location_heading')}
                        </p>
                        <div className="space-y-1.5">
                            {regionStats.map((loc) => (
                                <LocationBar
                                    key={loc.region_id}
                                    label={shortRegion(loc.region_name)}
                                    count={loc.count}
                                    max={maxRegion}
                                    gradient="from-violet-400 to-indigo-500"
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
                        {t('dashboard_analytics_activity_heading')}
                    </p>
                    <div className="rounded-xl border border-slate-100 bg-white/50 p-4 flex-1 flex flex-col justify-end min-h-[120px] relative">
                        {weekEmpty && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center pointer-events-none">
                                <p className="text-xs font-semibold text-slate-400">{t('dashboard_analytics_activity_empty')}</p>
                                <p className="text-[10px] text-slate-300">{t('dashboard_analytics_empty_hint')}</p>
                            </div>
                        )}
                        <div className={`flex items-end justify-between gap-1.5 sm:gap-2 h-24 ${weekEmpty ? 'opacity-25' : ''}`}>
                            {weekly.map((day) => (
                                <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                                    <span className="text-[10px] font-mono font-bold text-slate-600 tabular-nums h-4">
                                        {day.count > 0 ? day.count : ''}
                                    </span>
                                    <div className="w-full flex items-end justify-center h-16">
                                        <div
                                            className="w-full max-w-[2.25rem] rounded-t-lg transition-all duration-500"
                                            style={{
                                                height: day.count === 0 ? '4px' : `${Math.max(14, (day.count / maxWeek) * 100)}%`,
                                                background: day.count === 0
                                                    ? 'rgba(148,163,184,0.25)'
                                                    : day.isToday
                                                    ? 'linear-gradient(180deg, #06b6d4 0%, #059669 100%)'
                                                    : 'linear-gradient(180deg, rgba(8,145,178,0.55) 0%, rgba(5,150,105,0.35) 100%)',
                                                boxShadow: day.isToday && day.count > 0 ? '0 0 12px rgba(6,182,212,0.35)' : undefined,
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
