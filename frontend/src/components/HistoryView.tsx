import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { AnalysisRecord } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import DocumentReportIcon from './icons/DocumentReportIcon';
import VideoCameraIcon from './icons/VideoCameraIcon';
import BookOpenIcon from './icons/BookOpenIcon';
import SearchIcon from './icons/SearchIcon';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';

const PAGE_SIZE = 25;

type DatePreset = 'all' | '7d' | '30d' | '90d';
type SortKey = 'date_desc' | 'date_asc' | 'name_asc';
type GenderFilter = 'all' | 'male' | 'female' | 'other';

function getRecordSearchBlob(r: AnalysisRecord): string {
    const pd = r.patientData;
    const parts = [
        pd.firstName,
        pd.lastName,
        pd.fatherName,
        r.patientId,
        r.id,
        pd.complaints,
        pd.history,
        pd.objectiveData,
        pd.labResults,
    ];
    const dx = normalizeConsensusDiagnosis(r.finalReport?.consensusDiagnosis)
        .map(d => d.name)
        .join(' ');
    parts.push(dx);
    return parts.filter(Boolean).join(' ').toLowerCase();
}

function getCutoffMs(preset: DatePreset): number | null {
    if (preset === 'all') return null;
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    return Date.now() - days * 24 * 60 * 60 * 1000;
}

function matchesDate(record: AnalysisRecord, cutoff: number | null): boolean {
    if (cutoff === null) return true;
    const t = new Date(record.date).getTime();
    if (Number.isNaN(t)) return false;
    return t >= cutoff;
}

function matchesGender(record: AnalysisRecord, g: GenderFilter): boolean {
    if (g === 'all') return true;
    const pg = record.patientData.gender;
    if (g === 'other') return pg === 'other' || pg === '';
    return pg === g;
}

interface HistoryViewProps {
    analyses: AnalysisRecord[];
    onSelectAnalysis: (record: AnalysisRecord) => void;
    onStartConsultation: (record: AnalysisRecord) => void;
    onViewCaseLibrary: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ analyses, onSelectAnalysis, onStartConsultation, onViewCaseLibrary }) => {
    const { t } = useTranslation();
    if (analyses.length === 0) {
        return (
            <div className="text-center py-16 animate-fade-in-up">
                <DocumentReportIcon className="mx-auto w-16 h-16 text-slate-300" />
                <h3 className="mt-4 text-xl font-semibold text-text-primary">{t('history_empty_title')}</h3>
                <p className="mt-2 text-text-secondary">{t('history_empty_desc')}</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up space-y-5 md:space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">{t('history_title')}</h2>
                    <p className="text-text-secondary">{t('history_view_subtitle')}</p>
                </div>
                <button onClick={onViewCaseLibrary} className="flex items-center gap-2 text-sm font-semibold animated-gradient-button px-4 py-2">
                    <BookOpenIcon className="w-5 h-5"/>
                    <span>{t('history_case_library_btn')}</span>
                </button>
            </div>

            <div className="glass-panel p-4 md:p-5 space-y-4 border border-white/60">
                <label className="block">
                    <span className="sr-only">{t('archive_search_placeholder')}</span>
                    <div className="relative">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('archive_search_placeholder')}
                            className="w-full rounded-xl border border-slate-200/90 bg-white/90 pl-11 pr-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                </label>

                <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
                    <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('archive_filter_period')}</p>
                        <div className="flex flex-wrap gap-2">
                            {periodButtons.map(({ key, labelKey }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setDatePreset(key)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                        datePreset === key
                                            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-900/10'
                                            : 'bg-white/80 text-slate-600 border-slate-200 hover:border-sky-300 hover:bg-sky-50/80'
                                    }`}
                                >
                                    {t(labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 lg:w-[min(100%,420px)] shrink-0">
                        <div className="space-y-1.5">
                            <label htmlFor="archive-sort" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                {t('archive_sort_label')}
                            </label>
                            <select
                                id="archive-sort"
                                value={sort}
                                onChange={e => setSort(e.target.value as SortKey)}
                                className={selectClass + ' w-full'}
                            >
                                <option value="date_desc">{t('archive_sort_date_desc')}</option>
                                <option value="date_asc">{t('archive_sort_date_asc')}</option>
                                <option value="name_asc">{t('archive_sort_name_asc')}</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="archive-gender" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                {t('archive_gender_label')}
                            </label>
                            <select
                                id="archive-gender"
                                value={gender}
                                onChange={e => setGender(e.target.value as GenderFilter)}
                                className={selectClass + ' w-full'}
                            >
                                <option value="all">{t('archive_gender_all')}</option>
                                <option value="male">{t('archive_gender_male')}</option>
                                <option value="female">{t('archive_gender_female')}</option>
                                <option value="other">{t('archive_gender_other')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-slate-100">
                    <p className="text-sm text-slate-600" aria-live="polite">
                        <span className="font-semibold text-slate-800">
                            {t('archive_results_count', { filtered: totalFiltered, total: analyses.length })}
                        </span>
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="text-sm font-semibold text-sky-700 hover:text-sky-900 underline-offset-2 hover:underline self-start sm:self-auto"
                        >
                            {t('archive_reset_filters')}
                        </button>
                    )}
                </div>
            </div>

            {totalFiltered === 0 ? (
                <div className="text-center py-14 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80">
                    <p className="text-slate-600 font-medium">{t('archive_no_matches')}</p>
                    <button type="button" onClick={resetFilters} className="mt-3 text-sm font-semibold text-sky-700 hover:underline">
                        {t('archive_reset_filters')}
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-3 md:space-y-4">
                        {pageSlice.map(record => (
                            <div
                                key={record.id}
                                className="glass-panel p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                            >
                                <div className="flex items-center gap-4 flex-grow min-w-0">
                                    <DocumentReportIcon className="w-10 h-10 text-accent-color-blue flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-bold text-text-primary truncate">
                                            {record.patientData.firstName} {record.patientData.lastName}
                                        </p>
                                        <p className="text-sm text-text-secondary truncate">
                                            {normalizeConsensusDiagnosis(record.finalReport?.consensusDiagnosis)[0]?.name || "Noma'lum tashxis"}
                                        </p>
                                        <p className="text-xs text-text-secondary mt-1 font-mono">
                                            {new Date(record.date).toLocaleString('uz-UZ', { dateStyle: 'long', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2 self-end sm:self-center">
                                    <button
                                        type="button"
                                        onClick={() => onStartConsultation(record)}
                                        className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
                                        title="Telekonsultatsiya boshlash"
                                    >
                                        <VideoCameraIcon className="w-5 h-5" />
                                        <span className="hidden md:inline">Konsultatsiya</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onSelectAnalysis(record)}
                                        className="animated-gradient-button text-sm font-semibold px-4 py-2"
                                    >
                                        Ko'rish
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pageCount > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <button
                                type="button"
                                disabled={safePage <= 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 w-full sm:w-auto"
                            >
                                {t('archive_page_prev')}
                            </button>
                            <span className="text-sm text-slate-600 order-first sm:order-none">
                                {t('archive_page_info', { from, to, total: totalFiltered })}
                            </span>
                            <button
                                type="button"
                                disabled={safePage >= pageCount - 1}
                                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 w-full sm:w-auto"
                            >
                                {t('archive_page_next')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HistoryView;
