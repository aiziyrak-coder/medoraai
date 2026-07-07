import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import {
    getPatientDossier,
    smartSearchPatients,
    type PatientDossier,
    type DossierAnalysis,
    type SmartPatientHit,
} from '../services/apiPatientService';
import { apiToAnalysisRecord, type ApiAnalysisRecord } from '../services/apiAnalysisService';
import type { AnalysisRecord } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import FinalReportCard from './FinalReportCard';
import DownloadPanel from './DownloadPanel';

const DATE_LOCALE: Record<string, string> = {
    'uz-L': 'uz-Latn-UZ',
    'uz-C': 'uz-Cyrl-UZ',
    ru: 'ru-RU',
    en: 'en-GB',
    kaa: 'kk-KZ',
};

const fmtDate = (iso: string | undefined, language: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(DATE_LOCALE[language] ?? 'en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
};

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 6.15a7.5 7.5 0 0012.15 10.5z" />
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
);

const ChevronIcon: React.FC<{ className?: string; open?: boolean }> = ({ className, open }) => (
    <svg className={`${className ?? ''} transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

const sectionCls = 'rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm';

const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
    if (!value || !String(value).trim()) return null;
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-sm text-slate-800 break-words whitespace-pre-wrap">{value}</span>
        </div>
    );
};

const PatientDossierPage: React.FC = () => {
    const { t, language } = useTranslation();
    const tr = useCallback((key: string, fallback: string): string => {
        const v = t(key as TranslationKey);
        return v && v !== key ? v : fallback;
    }, [t]);

    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dossier, setDossier] = useState<PatientDossier | null>(null);
    const [suggestions, setSuggestions] = useState<SmartPatientHit[]>([]);
    const [showSuggest, setShowSuggest] = useState(false);
    const [openAnalysisId, setOpenAnalysisId] = useState<number | null>(null);
    const [openImagingId, setOpenImagingId] = useState<number | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Autocomplete — pasport/ism bo'yicha takliflar
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setSuggestions([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            smartSearchPatients(q)
                .then(res => {
                    if (res.success && Array.isArray(res.data)) {
                        setSuggestions(res.data.filter(h => h.is_patient || h.source === 'patient').slice(0, 8));
                    } else {
                        setSuggestions([]);
                    }
                })
                .catch(() => setSuggestions([]));
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const loadDossier = useCallback(async (registry: string) => {
        const q = (registry || '').trim();
        if (!q) return;
        setLoading(true);
        setError(null);
        setDossier(null);
        setShowSuggest(false);
        setOpenAnalysisId(null);
        setOpenImagingId(null);
        try {
            const res = await getPatientDossier(q);
            if (res.success && res.data) {
                setDossier(res.data);
            } else {
                setError(res.error?.message || tr('dossier_not_found', 'Bunday pasport ID bilan bemor topilmadi'));
            }
        } catch {
            setError(tr('dossier_not_found', 'Bunday pasport ID bilan bemor topilmadi'));
        } finally {
            setLoading(false);
        }
    }, [tr]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void loadDossier(query);
    };

    const analysisRecords: AnalysisRecord[] = useMemo(() => {
        if (!dossier) return [];
        return dossier.analyses.map((a: DossierAnalysis) =>
            apiToAnalysisRecord(a as unknown as ApiAnalysisRecord),
        );
    }, [dossier]);

    const p = dossier?.patient;
    const fullName = p ? `${p.last_name} ${p.first_name} ${p.father_name ?? ''}`.trim() : '';

    return (
        <div className="w-full min-w-0 max-w-6xl mx-auto space-y-4 animate-fade-in-up">
            {/* ── Qidiruv paneli ─────────────────────────── */}
            <div className={`${sectionCls} p-4 sm:p-5`}>
                <form onSubmit={onSubmit} className="relative">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                        {tr('dossier_search_label', "Bemor pasport seriya raqami (ID)")}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1 min-w-0">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
                                onFocus={() => setShowSuggest(true)}
                                placeholder={tr('dossier_search_placeholder', 'Masalan: AB1234567')}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400"
                                autoComplete="off"
                            />
                            {showSuggest && suggestions.length > 0 && (
                                <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                                    {suggestions.map((s) => (
                                        <button
                                            type="button"
                                            key={`${s.id}-${s.registry_number}`}
                                            onClick={() => { setQuery(s.registry_number); void loadDossier(s.registry_number); }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-cyan-50 transition-colors border-b border-slate-100 last:border-0"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold text-slate-800 truncate">
                                                    {s.last_name} {s.first_name}
                                                </span>
                                                <span className="text-[11px] font-mono font-bold text-cyan-700 shrink-0">
                                                    {s.registry_number}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 truncate">
                                                {[s.age && `${s.age}`, s.region_name, s.phone].filter(Boolean).join(' • ')}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#0891b2,#059669)' }}
                        >
                            <SearchIcon className="w-4 h-4" />
                            {loading ? tr('dossier_loading', 'Yuklanmoqda…') : tr('dossier_search_btn', 'Qidirish')}
                        </button>
                    </div>
                </form>
                {error && (
                    <p className="mt-3 text-sm text-red-600 font-medium" role="alert">{error}</p>
                )}
            </div>

            {loading && (
                <div className={`${sectionCls} p-10 text-center text-slate-400 text-sm`}>
                    {tr('dossier_loading', 'Yuklanmoqda…')}
                </div>
            )}

            {!loading && !dossier && !error && (
                <div className={`${sectionCls} p-10 text-center`}>
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-cyan-50 border border-cyan-100">
                        <SearchIcon className="w-8 h-8 text-cyan-400" />
                    </div>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                        {tr('dossier_empty_hint', "Bemorning barcha tashxislari, konsiliumlari, tasvir tahlillari va yuklangan fayllarini ko'rish uchun pasport seriya raqamini (ID) kiriting.")}
                    </p>
                </div>
            )}

            {dossier && p && (
                <>
                    {/* ── Bemor sarlavhasi ───────────────────── */}
                    <div className={`${sectionCls} overflow-hidden`}>
                        <div className="px-5 py-4 flex items-center gap-4"
                             style={{ background: 'linear-gradient(135deg, rgba(8,145,178,0.08), rgba(5,150,105,0.06))' }}>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0"
                                 style={{ background: 'linear-gradient(135deg,#0891b2,#059669)' }}>
                                {(p.first_name?.[0] ?? '?')}{(p.last_name?.[0] ?? '')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-black text-slate-900 truncate">{fullName}</h2>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                                    <span className="font-mono font-bold text-cyan-700">{p.registry_number}</span>
                                    {p.age && <span>{p.age}</span>}
                                    {p.gender && <span>{tr(`gender_${p.gender}`, p.gender)}</span>}
                                    {p.phone && <span>{p.phone}</span>}
                                </div>
                            </div>
                            <div className="hidden sm:flex gap-2 shrink-0">
                                {[
                                    { n: dossier.meta.analysis_count, l: tr('dossier_consiliums_short', 'Konsilium') },
                                    { n: dossier.meta.imaging_count, l: tr('dossier_imaging_short', 'Tasvir') },
                                    { n: dossier.meta.attachment_count, l: tr('dossier_files_short', 'Fayl') },
                                ].map((c, i) => (
                                    <div key={i} className="text-center px-3 py-1.5 rounded-xl bg-white/70 border border-slate-200 min-w-[64px]">
                                        <div className="text-lg font-black text-slate-800 leading-none">{c.n}</div>
                                        <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">{c.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            <InfoRow label={tr('dossier_address', 'Manzil')} value={[p.region_name, p.district_name, p.address].filter(Boolean).join(', ')} />
                            <InfoRow label={tr('dossier_home_clinic', "Ro'yxatga olgan tashkilot")} value={dossier.meta.home_clinic_group} />
                            <InfoRow label={tr('dossier_registered_by', "Ro'yxatga olgan shifokor")} value={dossier.meta.registered_by} />
                            <InfoRow label={tr('dossier_updated', 'Oxirgi yangilanish')} value={fmtDate(p.updated_at, language)} />
                        </div>
                    </div>

                    {/* ── Klinik ma'lumot ────────────────────── */}
                    {(p.complaints || p.history || p.allergies || p.current_medications || p.family_history || p.lab_results || p.additional_info) && (
                        <div className={`${sectionCls} p-5`}>
                            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#0891b2,#059669)' }} />
                                {tr('dossier_clinical_summary', 'Klinik ma\'lumot')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoRow label={tr('data_input_complaints_label', 'Shikoyatlar')} value={p.complaints} />
                                <InfoRow label={tr('dossier_history', 'Anamnez')} value={p.history} />
                                <InfoRow label={tr('dossier_allergies', 'Allergiya')} value={p.allergies} />
                                <InfoRow label={tr('dossier_medications', 'Qabul qilayotgan dorilar')} value={p.current_medications} />
                                <InfoRow label={tr('dossier_family_history', 'Oilaviy anamnez')} value={p.family_history} />
                                <InfoRow label={tr('dossier_lab', 'Laborator natijalar')} value={p.lab_results} />
                                <InfoRow label={tr('dossier_additional', "Qo'shimcha ma'lumot")} value={p.additional_info} />
                            </div>
                        </div>
                    )}

                    {/* ── Konsilium xulosalari ───────────────── */}
                    <div className={`${sectionCls} p-5`}>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#0891b2,#059669)' }} />
                            {tr('dossier_consiliums', 'Konsilium xulosalari')} ({analysisRecords.length})
                        </h3>
                        {analysisRecords.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">{tr('dossier_no_consiliums', 'Konsilium xulosalari topilmadi')}</p>
                        ) : (
                            <div className="space-y-2">
                                {analysisRecords.map((rec, idx) => {
                                    const meta = dossier.analyses[idx];
                                    const dx = normalizeConsensusDiagnosis(rec.finalReport?.consensusDiagnosis)[0]?.name;
                                    const open = openAnalysisId === Number(rec.id);
                                    return (
                                        <div key={rec.id} className="rounded-xl border border-slate-200 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setOpenAnalysisId(open ? null : Number(rec.id))}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                                            >
                                                <ChevronIcon className="w-4 h-4 text-slate-400 shrink-0" open={open} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                                        {dx || tr('unknown_diagnosis', 'Tashxis aniqlanmadi')}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                        {[fmtDate(meta?.created_at, language), meta?.physician, meta?.clinic_group].filter(Boolean).join(' • ')}
                                                    </p>
                                                </div>
                                            </button>
                                            {open && (
                                                <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50/50 space-y-3">
                                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                        <DownloadPanel record={rec} compact />
                                                    </div>
                                                    <FinalReportCard report={rec.finalReport} patientData={rec.patientData} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Tasvir tahlillari ──────────────────── */}
                    <div className={`${sectionCls} p-5`}>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#0891b2,#059669)' }} />
                            {tr('dossier_imaging', 'Tasvir tahlillari (UZI / UTT / Rengen)')} ({dossier.imaging_studies.length})
                        </h3>
                        {dossier.imaging_studies.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">{tr('dossier_no_imaging', 'Tasvir tahlillari topilmadi')}</p>
                        ) : (
                            <div className="space-y-2">
                                {dossier.imaging_studies.map((img) => {
                                    const open = openImagingId === img.id;
                                    return (
                                        <div key={img.id} className="rounded-xl border border-slate-200 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setOpenImagingId(open ? null : img.id)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                                            >
                                                <ChevronIcon className="w-4 h-4 text-slate-400 shrink-0" open={open} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 uppercase">{img.modality}</p>
                                                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                        {[fmtDate(img.created_at, language), img.physician].filter(Boolean).join(' • ')}
                                                    </p>
                                                </div>
                                            </button>
                                            {open && (
                                                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                                                        {img.summary_text || '—'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Yuklangan fayllar ──────────────────── */}
                    <div className={`${sectionCls} p-5`}>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#0891b2,#059669)' }} />
                            {tr('dossier_attachments', 'Yuklangan fayllar')} ({dossier.attachments.length})
                        </h3>
                        {dossier.attachments.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">{tr('dossier_no_attachments', 'Yuklangan fayllar topilmadi')}</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {dossier.attachments.map((att) => (
                                    <a
                                        key={att.id}
                                        href={att.file}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={att.name}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500 shrink-0 group-hover:bg-cyan-100 group-hover:text-cyan-600">
                                            <DownloadIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{att.name}</p>
                                            <p className="text-[10px] text-slate-400">{fmtDate(att.uploaded_at, language)}</p>
                                        </div>
                                        <span className="text-[11px] font-semibold text-cyan-600 shrink-0">
                                            {tr('dossier_download_file', 'Yuklab olish')}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default PatientDossierPage;
