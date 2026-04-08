import React, { useCallback, useRef, useState } from 'react';
import { analyzeUziUttDocuments } from '../../services/aiCouncilService';
import { generateUziUttPdf } from '../../services/pdfGenerator';
import type { UziUttReport, UziUttUrgency } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import UploadCloudIcon from '../icons/UploadCloudIcon';
import DownloadIcon from '../icons/DownloadIcon';
import { useTranslation, type TranslationKey } from '../../hooks/useTranslation';
import { INSTITUTE_LOGO_SRC, INSTITUTE_NAME_FULL } from '../../constants/brand';

const MAX_FILES = 12;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
]);

function mimeForFile(f: File): string | null {
    if (f.type && ALLOWED_TYPES.has(f.type)) return f.type;
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return null;
}

async function getInstituteLogoDataUrl(): Promise<string | undefined> {
    try {
        const res = await fetch(INSTITUTE_LOGO_SRC);
        if (!res.ok) return undefined;
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    } catch {
        return undefined;
    }
}

function readFileBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
            const s = r.result as string;
            const i = s.indexOf(',');
            resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        r.onerror = () => reject(new Error('read'));
        r.readAsDataURL(file);
    });
}

const UziUttAnalyzer: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { t, language } = useTranslation();
    const [items, setItems] = useState<File[]>([]);
    const [context, setContext] = useState('');
    const [report, setReport] = useState<UziUttReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback(
        (list: FileList | null) => {
            if (!list?.length) return;
            setError(null);
            setReport(null);
            const next: File[] = [...items];
            let total = next.reduce((a, f) => a + f.size, 0);
            for (let i = 0; i < list.length; i++) {
                const f = list[i];
                if (!mimeForFile(f)) {
                    setError(t('uzi_utt_error_type'));
                    return;
                }
                if (f.size > MAX_FILE_BYTES) {
                    setError(t('uzi_utt_error_size'));
                    return;
                }
                if (total + f.size > MAX_TOTAL_BYTES) {
                    setError(t('uzi_utt_error_total'));
                    return;
                }
                if (next.length >= MAX_FILES) {
                    setError(t('uzi_utt_error_max_files'));
                    return;
                }
                next.push(f);
                total += f.size;
            }
            setItems(next);
        },
        [items, t],
    );

    const removeAt = (idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
        setReport(null);
        setError(null);
    };

    const handleAnalyze = async () => {
        if (items.length === 0) {
            setError(t('uzi_utt_error_no_files'));
            return;
        }
        setIsLoading(true);
        setError(null);
        setReport(null);
        try {
            const payload = await Promise.all(
                items.map(async (file) => {
                    const mime = mimeForFile(file);
                    return {
                        base64Data: await readFileBase64(file),
                        mimeType: mime || 'application/octet-stream',
                        fileName: file.name,
                    };
                }),
            );
            const result = await analyzeUziUttDocuments(payload, language, context.trim() || undefined);
            setReport(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('alert_error_generic'));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePdf = async () => {
        if (!report) return;
        setPdfLoading(true);
        try {
            const logo = await getInstituteLogoDataUrl();
            await generateUziUttPdf(report, { instituteName: INSTITUTE_NAME_FULL, instituteLogoDataUrl: logo }, (key) =>
                t(key as TranslationKey),
            );
        } catch {
            setError(t('alert_error_generic'));
        } finally {
            setPdfLoading(false);
        }
    };

    const urgencyClass = (u: UziUttUrgency): string => {
        switch (u) {
            case 'emergent':
                return 'bg-red-100 text-red-900 border-red-200';
            case 'urgent':
                return 'bg-amber-100 text-amber-900 border-amber-200';
            case 'soon':
                return 'bg-sky-100 text-sky-900 border-sky-200';
            default:
                return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const urgencyLabel = (u: UziUttUrgency): string => {
        const map: Record<UziUttUrgency, string> = {
            routine: t('uzi_utt_urgency_routine'),
            soon: t('uzi_utt_urgency_soon'),
            urgent: t('uzi_utt_urgency_urgent'),
            emergent: t('uzi_utt_urgency_emergent'),
        };
        return map[u] ?? u;
    };

    const fieldOrDash = (value: string | undefined) => {
        const v = (value ?? '').trim();
        return v.length > 0 ? v : t('uzi_utt_field_empty');
    };

    return (
        <div className="glass-panel p-6 md:p-8 max-w-5xl mx-auto w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-text-primary">{t('uzi_utt_page_title')}</h3>
                    <p className="text-sm text-text-secondary mt-1">{t('uzi_utt_page_subtitle')}</p>
                </div>
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white/80"
                    >
                        ← {t('back_to_home')}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div
                        className="border-2 border-dashed border-border-color rounded-2xl p-5 text-center cursor-pointer bg-slate-50/80 hover:bg-slate-100/90 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => addFiles(e.target.files)}
                            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,image/*,application/pdf"
                            multiple
                            className="hidden"
                        />
                        <UploadCloudIcon className="mx-auto h-10 w-10 text-sky-500" />
                        <p className="mt-2 font-semibold text-accent-color-blue">{t('uzi_utt_upload_cta')}</p>
                        <p className="text-xs text-text-secondary mt-1">{t('uzi_utt_upload_hint')}</p>
                    </div>

                    {items.length > 0 && (
                        <ul className="space-y-2">
                            {items.map((f, idx) => (
                                <li
                                    key={`${f.name}-${idx}`}
                                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/70 border border-slate-200 text-sm"
                                >
                                    <span className="truncate font-medium text-slate-800">{f.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAt(idx)}
                                        className="shrink-0 text-xs font-bold text-rose-600 hover:underline"
                                    >
                                        {t('uzi_utt_remove')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div>
                        <label htmlFor="uzi-context" className="block text-xs font-semibold text-slate-600 mb-1">
                            {t('uzi_utt_context_label')}
                        </label>
                        <textarea
                            id="uzi-context"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder={t('uzi_utt_context_placeholder')}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={isLoading || items.length === 0}
                        className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-60"
                    >
                        {isLoading ? (
                            <>
                                <SpinnerIcon className="w-5 h-5" />
                                {t('uzi_utt_analyzing')}
                            </>
                        ) : (
                            t('uzi_utt_analyze')
                        )}
                    </button>
                    {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                </div>

                <div className="space-y-3 min-h-[200px]">
                    {report ? (
                        <>
                            <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold border ${urgencyClass(report.urgencyLevel)}`}>
                                {t('uzi_utt_urgency')}: {urgencyLabel(report.urgencyLevel)}
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-border-color space-y-3">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('uzi_utt_study_type')}</h4>
                                    <p className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">{fieldOrDash(report.studyType)}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('uzi_utt_region')}</h4>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{fieldOrDash(report.regionOrOrgan)}</p>
                                </div>
                                {report.techniqueNotes && (
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('uzi_utt_technique')}</h4>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.techniqueNotes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-white rounded-xl border border-slate-200">
                                <h4 className="font-bold text-text-primary mb-2">{t('uzi_utt_findings')}</h4>
                                {report.keyFindings.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700">
                                        {report.keyFindings.map((x, i) => (
                                            <li key={i} className="whitespace-pre-wrap break-words">
                                                {x}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-slate-500">{t('uzi_utt_field_empty')}</p>
                                )}
                            </div>

                            {report.measurements && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-border-color">
                                    <h4 className="font-bold text-text-primary mb-1">{t('uzi_utt_measurements')}</h4>
                                    <p className="text-sm whitespace-pre-wrap text-slate-800">{report.measurements}</p>
                                </div>
                            )}

                            <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200">
                                <h4 className="font-bold text-accent-color-blue">{t('uzi_utt_impression')}</h4>
                                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{fieldOrDash(report.impression)}</p>
                            </div>

                            <div className="p-4 bg-emerald-50/90 rounded-xl border border-emerald-200">
                                <h4 className="font-bold text-emerald-800">{t('uzi_utt_conclusion')}</h4>
                                <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap break-words">{fieldOrDash(report.clinicalConclusion)}</p>
                            </div>

                            <div className="p-4 bg-white rounded-xl border border-slate-200">
                                <h4 className="font-bold text-text-primary mb-2">{t('uzi_utt_recommendations')}</h4>
                                {report.recommendations.length > 0 ? (
                                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-800">
                                        {report.recommendations.map((x, i) => (
                                            <li key={i} className="whitespace-pre-wrap break-words pl-1 marker:font-semibold">
                                                {x}
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-sm text-slate-500">{t('uzi_utt_field_empty')}</p>
                                )}
                            </div>

                            {report.differentialDiagnosis != null && report.differentialDiagnosis.trim() !== '' && (
                                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200">
                                    <h4 className="font-bold text-amber-900">{t('uzi_utt_ddx')}</h4>
                                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap break-words">{report.differentialDiagnosis}</p>
                                </div>
                            )}

                            {report.limitations && (
                                <div className="p-4 bg-slate-100 rounded-xl border border-slate-300">
                                    <h4 className="font-bold text-slate-700">{t('uzi_utt_limitations')}</h4>
                                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{report.limitations}</p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handlePdf}
                                disabled={pdfLoading}
                                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60"
                            >
                                {pdfLoading ? <SpinnerIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />}
                                {t('uzi_utt_download_pdf')}
                            </button>
                        </>
                    ) : (
                        <div className="h-full min-h-[220px] flex items-center justify-center text-center text-text-secondary bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
                            <p>{t('uzi_utt_empty_result')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UziUttAnalyzer;
