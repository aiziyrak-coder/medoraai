
import React, { useState, useEffect } from 'react';
import type {
  FinalReport,
  FolkMedicineSection,
  NutritionPreventionSection,
  PatientData,
  ProtocolComplianceGap,
  CareQualityAudit,
  ImagingInterpretation,
  ImagingModalityBlock,
} from '../types';
import { normalizeConsensusDiagnosis, getReasoningChainArray } from '../types';
import { sanitizeClinicalContent } from '../utils/sanitizeClinicalContent';
import ClipboardListIcon from './icons/ClipboardListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import ShieldWarningIcon from './icons/ShieldWarningIcon';
import ImageIcon from './icons/ImageIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import PillIcon from './icons/PillIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import LightBulbIcon from './icons/LightBulbIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import FlaskIcon from './icons/FlaskIcon';
import PrognosisCard from './report/PrognosisCard';
import ClinicalRedFlagsCard from './report/ClinicalRedFlagsCard';
import FollowUpPlan from './report/FollowUpPlan';
import ReferralGenerator from './report/ReferralGenerator';
import PatientRoutingCard from './report/PatientRoutingCard';
import RiskFactorsCard from './report/RiskFactorsCard';
import LinkifiedText from './common/LinkifiedText';
import GlobeIcon from './icons/GlobeIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import CheckIcon from './icons/CheckIcon';
import XIcon from './icons/XIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { useTranslation } from '../hooks/useTranslation';

/** Hujjat bo'limi — aniq chegaralangan, asosiy matn bilan aralashmasin */
const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200">
                {icon}
            </div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
        </div>
        <div className="p-4 space-y-4 text-sm">
            {children}
        </div>
    </div>
);

const LifestylePlanCard: React.FC<{plan: FinalReport['lifestylePlan']}> = ({plan}) => {
    const { t } = useTranslation();
    if (!plan) return null;
    const diet = Array.isArray(plan.diet) ? plan.diet : [];
    const exercise = Array.isArray(plan.exercise) ? plan.exercise : [];
    if (diet.length === 0 && exercise.length === 0) return null;
    return (
        <Section title={t('final_report_lifestyle_title')} icon={<LightBulbIcon className="text-yellow-500 h-6 w-6"/>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {diet.length > 0 && (
                    <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                        <h4 className="font-semibold">{t('final_report_diet_rec')}</h4>
                        <ul className="list-disc list-inside mt-1">
                            {diet.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                )}
                {exercise.length > 0 && (
                    <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                        <h4 className="font-semibold">{t('final_report_exercise_rec')}</h4>
                        <ul className="list-disc list-inside mt-1">
                            {exercise.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </Section>
    );
};

const ClinicalTrialsCard: React.FC<{trials: FinalReport['matchedClinicalTrials']}> = ({trials}) => {
    const { t } = useTranslation();
    if (!trials || trials.length === 0) return null;
    return (
        <Section title={t('final_report_clinical_trials_title')} icon={<FlaskIcon className="h-6 w-6"/>}>
            {trials.map((trial, i) => (
                <div key={i} className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                    <a href={trial.url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-color-blue hover:underline">{trial.title}</a>
                    <p className="text-xs text-text-secondary mt-1">ID: {trial.trialId}</p>
                </div>
            ))}
        </Section>
    );
};

const AdverseEventRiskCard: React.FC<{risks: FinalReport['adverseEventRisks']}> = ({risks}) => {
    const { t } = useTranslation();
    if (!risks || risks.length === 0) return null;
    return (
         <Section title={t('final_report_adverse_risks_title')} icon={<ShieldWarningIcon className="w-6 h-6"/>}>
            {risks.map((risk, i) => (
                <div key={i} className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                    <p className="font-semibold text-yellow-800">
                        {t('final_report_adverse_risk_item')
                            .replace('{drug}', String(risk.drug))
                            .replace('{risk}', String(risk.risk))
                            .replace('{prob}', String(Math.round(risk.probability * 100)))}
                    </p>
                </div>
            ))}
        </Section>
    )
}

const RelatedResearchCard: React.FC<{research: FinalReport['relatedResearch']}> = ({research}) => {
    const { t } = useTranslation();
    if (!research || research.length === 0) return null;
    const sourceUrl = (title: string, url?: string) => {
        const raw = (url || '').trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(title || raw || 'clinical guideline')}`;
    };
    return (
        <Section title={t('final_report_related_research_title')} icon={<GlobeIcon className="w-6 h-6"/>}>
            {research.map((item, i) => (
                <div key={i} className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                    {(() => {
                        const url = sourceUrl(item.title, item.url);
                        return (
                            <>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-color-blue hover:underline">{item.title}</a>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-accent-color-blue hover:underline break-all mt-1">{url}</a>
                            </>
                        );
                    })()}
                    <p className="text-xs text-text-secondary mt-1">{item.summary}</p>
                </div>
            ))}
        </Section>
    );
};

const FolkMedicineCard: React.FC<{ section: FolkMedicineSection }> = ({ section }) => {
    const { t } = useTranslation();
    const { intro, disclaimer, items } = section;
    if (!items?.length && !intro?.trim() && !disclaimer?.trim()) return null;
    return (
        <Section title={t('final_report_folk_title')} icon={<FlaskIcon className="h-6 w-6 text-emerald-600"/>}>
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm text-slate-800 space-y-2">
                <p className="text-xs font-semibold text-emerald-900">
                    {t('final_report_folk_disclaimer')}
                </p>
                {intro?.trim() && <LinkifiedText text={intro} className="text-sm" />}
                {disclaimer?.trim() && (
                    <p className="text-xs text-emerald-900/90 border-t border-emerald-200 pt-2 whitespace-pre-wrap">{disclaimer}</p>
                )}
            </div>
            {items.length > 0 && (
                <div className="space-y-3">
                    {items.map((it, i) => (
                        <div key={i} className="p-4 rounded-xl border border-emerald-100 bg-white shadow-sm">
                            <p className="font-bold text-slate-900">{it.plantName}</p>
                            {it.plantPart && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">{t('final_report_folk_part')}</span> {it.plantPart}</p>}
                            {it.preparationOrUsage && (
                                <p className="text-sm mt-2">
                                    <span className="font-semibold text-slate-700">{t('final_report_folk_usage')}</span>{' '}
                                    <LinkifiedText text={it.preparationOrUsage} className="inline" />
                                </p>
                            )}
                            {it.traditionalContext && (
                                <p className="text-sm text-slate-600 mt-1">
                                    <span className="font-semibold">{t('final_report_folk_context')}</span>{' '}
                                    <LinkifiedText text={it.traditionalContext} className="inline" />
                                </p>
                            )}
                            {it.precautions && (
                                <p className="text-sm mt-2 p-2 bg-amber-50 border border-amber-100 rounded-md text-amber-900">
                                    <span className="font-semibold">{t('final_report_folk_precautions')}</span>{' '}
                                    <LinkifiedText text={it.precautions} className="inline" />
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
};

const ModalityBlockView: React.FC<{ title: string; block?: ImagingModalityBlock }> = ({ title, block }) => {
    const { t } = useTranslation();
    if (!block?.summary && !(block?.keyFindings?.length)) return null;
    return (
        <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color space-y-2">
            <h4 className="font-bold text-slate-800">{title}</h4>
            {block.summary && <p className="text-sm">{block.summary}</p>}
            {block.keyFindings && block.keyFindings.length > 0 && (
                <ul className="list-disc list-inside text-sm text-slate-700">
                    {block.keyFindings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
            )}
            {block.clinicalSignificance && (
                <p className="text-sm"><span className="font-semibold">{t('final_report_imaging_significance')}:</span> {block.clinicalSignificance}</p>
            )}
            {block.limitations && (
                <p className="text-xs text-slate-500 italic">{t('final_report_imaging_limitations')}: {block.limitations}</p>
            )}
        </div>
    );
};

const ImagingInterpretationCard: React.FC<{ imaging?: ImagingInterpretation }> = ({ imaging }) => {
    const { t } = useTranslation();
    if (!imaging) return null;
    const hasAny = imaging.ecg || imaging.ultrasound || imaging.xray || imaging.ct || imaging.mri || imaging.generalCorrelation;
    if (!hasAny) return null;
    return (
        <Section title={t('final_report_imaging_title')} icon={<ImageIcon className="w-6 h-6"/>}>
            <ModalityBlockView title={t('final_report_imaging_ecg')} block={imaging.ecg} />
            <ModalityBlockView title={t('final_report_imaging_uzi')} block={imaging.ultrasound} />
            <ModalityBlockView title={t('final_report_imaging_xray')} block={imaging.xray} />
            <ModalityBlockView title={t('final_report_imaging_ct')} block={imaging.ct} />
            <ModalityBlockView title={t('final_report_imaging_mri')} block={imaging.mri} />
            {imaging.generalCorrelation && (
                <p className="text-sm mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <span className="font-semibold">{t('final_report_image_correlation')}:</span> {imaging.generalCorrelation}
                </p>
            )}
        </Section>
    );
};

const ProtocolComplianceGapsCard: React.FC<{ gaps?: ProtocolComplianceGap[] }> = ({ gaps }) => {
    const { t } = useTranslation();
    if (!gaps?.length) return null;
    const severityClass = (s: string) =>
        s === 'high' ? 'border-red-400 bg-red-50' : s === 'medium' ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50';
    return (
        <Section title={t('final_report_protocol_gaps_title')} icon={<ShieldWarningIcon className="w-6 h-6"/>}>
            {gaps.map((g, i) => (
                <div key={i} className={`p-4 rounded-xl border-l-4 ${severityClass(g.severity)}`}>
                    <p className="font-bold text-slate-900">{g.gap}</p>
                    {g.protocolReference && (
                        <p className="text-xs text-slate-600 mt-1">{t('final_report_protocol_ref')}: {g.protocolReference}</p>
                    )}
                    {g.consequences && (
                        <p className="text-sm text-red-800 mt-2"><span className="font-semibold">{t('final_report_consequences')}:</span> {g.consequences}</p>
                    )}
                    {g.recommendedCorrection && (
                        <p className="text-sm text-green-800 mt-2"><span className="font-semibold">{t('final_report_recommended_fix')}:</span> {g.recommendedCorrection}</p>
                    )}
                </div>
            ))}
        </Section>
    );
};

const GENERIC_QUALITY_STRENGTHS = new Set([
    'shikoyatlar aniq hujjatlashtirilgan',
    'anamnez mavjud',
    "ob'ektiv ko'rik/vital ko'rsatkichlar kiritilgan",
]);

const qualityCategoryLabel = (category: string, t: (k: string) => string): string => {
    const key = `quality_cat_${category}` as const;
    const mapped = t(key);
    return mapped !== key ? mapped : category;
};

const CareQualityAuditCard: React.FC<{ audit?: CareQualityAudit }> = ({ audit }) => {
    const { t } = useTranslation();
    if (!audit) return null;
    const strengths = (audit.strengths || []).filter(
        (s) => s.trim() && !GENERIC_QUALITY_STRENGTHS.has(s.trim().toLowerCase()),
    );
    return (
        <Section title={t('final_report_quality_audit_title')} icon={<ClipboardListIcon className="w-6 h-6"/>}>
            {audit.overallScore != null && (
                <div className="mb-3">
                    <p className="text-lg font-bold text-slate-800">
                        {t('final_report_quality_score')}: {audit.overallScore}/100
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{t('final_report_quality_score_help')}</p>
                </div>
            )}
            {audit.summary && <p className="text-sm text-slate-700 mb-4 whitespace-pre-wrap leading-relaxed">{audit.summary}</p>}
            {audit.errors?.length > 0 && (
                <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-bold text-red-800">{t('final_report_quality_errors')}</h4>
                    {audit.errors.map((e, i) => (
                        <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                            <p className="font-semibold">
                                <span className="text-red-900">{qualityCategoryLabel(e.category, t)}:</span>{' '}
                                {e.description}
                            </p>
                            {e.protocolReference && (
                                <p className="text-xs mt-1 text-slate-600">
                                    {t('final_report_protocol_ref')}: {e.protocolReference}
                                </p>
                            )}
                            {e.impact && (
                                <p className="text-xs mt-1 text-red-700">
                                    {t('final_report_consequences')}: {e.impact}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {strengths.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-green-800 mb-2">{t('final_report_quality_strengths')}</h4>
                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                        {strengths.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
                    </ul>
                </div>
            )}
        </Section>
    );
};

const NutritionPreventionCard: React.FC<{ section: NutritionPreventionSection }> = ({ section }) => {
    const { t } = useTranslation();
    const { intro, disclaimer, dietaryGuidelines, preventionMeasures, individualDietByDiagnosis } = section;
    const hasDiet = dietaryGuidelines.length > 0;
    const hasPrev = preventionMeasures.length > 0;
    const hasIndividual = (individualDietByDiagnosis?.length ?? 0) > 0;
    if (!hasDiet && !hasPrev && !hasIndividual && !intro?.trim() && !disclaimer?.trim()) return null;
    return (
        <Section title={t('final_report_nutrition_title')} icon={<ChartBarIcon className="h-6 w-6 text-sky-600"/>}>
            {intro?.trim() && <div className="text-sm text-slate-800 mb-3"><LinkifiedText text={intro} /></div>}
            {hasDiet && (
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-2">{t('final_report_nutrition_diet_title')}</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-sm text-text-primary">
                        {dietaryGuidelines.map((line, i) => (
                            <li key={i}><LinkifiedText text={line} className="inline" /></li>
                        ))}
                    </ul>
                </div>
            )}
            {hasPrev && (
                <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-2">{t('final_report_nutrition_prevention_title')}</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-sm text-text-primary">
                        {preventionMeasures.map((line, i) => (
                            <li key={i}><LinkifiedText text={line} className="inline" /></li>
                        ))}
                    </ul>
                </div>
            )}
            {hasIndividual && (
                <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-700">{t('final_report_individual_diet_title')}</h4>
                    {individualDietByDiagnosis!.map((plan, i) => (
                        <div key={i} className="p-4 rounded-xl border border-sky-200 bg-white">
                            <p className="font-bold text-sky-900">{plan.diagnosis}</p>
                            {plan.allowedFoods.length > 0 && (
                                <p className="text-sm mt-2"><span className="font-semibold text-green-700">{t('final_report_allowed_foods')}:</span> {plan.allowedFoods.join('; ')}</p>
                            )}
                            {plan.restrictedFoods.length > 0 && (
                                <p className="text-sm mt-1"><span className="font-semibold text-red-700">{t('final_report_restricted_foods')}:</span> {plan.restrictedFoods.join('; ')}</p>
                            )}
                            {plan.mealPlanNotes && (
                                <p className="text-sm mt-2 text-slate-600">{plan.mealPlanNotes}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {disclaimer?.trim() && (
                <p className="text-xs text-slate-600 mt-4 p-3 rounded-lg bg-sky-50 border border-sky-100 whitespace-pre-wrap">{disclaimer}</p>
            )}
        </Section>
    );
};

/** Normalize treatmentPlan item: Gemini sometimes returns objects {step,details,urgency} */
const planItemToString = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        return [o.step, o.details, o.urgency, o.action, o.description, o.text]
            .filter(v => v && typeof v === 'string')
            .join(' - ') || JSON.stringify(item);
    }
    return String(item ?? '');
};

/** Normalize recommendedTests item: API/AI may return string or object { testName, reason, urgency } */
const recommendedTestToDisplay = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const testName = o.testName ?? o.name ?? o.test;
        const reason = o.reason ?? o.reasoning;
        const urgency = o.urgency;
        const parts = [testName, reason, urgency].filter(v => v != null && String(v).trim());
        return parts.map(String).join(' - ') || JSON.stringify(item);
    }
    return String(item ?? '');
};

const FinalReportCard: React.FC<{
  report: FinalReport;
  patientData: Partial<PatientData>;
  isScenario?: boolean;
  onUpdateReport?: (updatedReport: Partial<FinalReport>) => void;
}> = ({ report, patientData, isScenario = false, onUpdateReport }) => {
    const { t } = useTranslation();
    const safePlan = (Array.isArray(report.treatmentPlan) ? report.treatmentPlan : []).map(planItemToString);
    const consensusDiagnoses = normalizeConsensusDiagnosis(report.consensusDiagnosis);
    const hasRealDiagnosis = consensusDiagnoses.some(
        (d) => d.name.trim() && !/^(tashxis aniqlanmadi|aniqlanmadi|timeout)$/i.test(d.name.trim()),
    );

    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [editedPlan, setEditedPlan] = useState<string[]>(safePlan);

    useEffect(() => {
        setEditedPlan((Array.isArray(report.treatmentPlan) ? report.treatmentPlan : []).map(planItemToString));
    }, [report.treatmentPlan]);
    
    const handlePlanChange = (index: number, value: string) => {
        const newPlan = [...editedPlan];
        newPlan[index] = value;
        setEditedPlan(newPlan);
    };

    const handleAddPlanStep = () => {
        setEditedPlan([...editedPlan, '']);
    };

    const handleRemovePlanStep = (index: number) => {
        const newPlan = editedPlan.filter((_, i) => i !== index);
        setEditedPlan(newPlan);
    };

    const handleSavePlan = () => {
        if (onUpdateReport) {
            onUpdateReport({ treatmentPlan: editedPlan.filter(item => item.trim() !== '') });
        }
        setIsEditingPlan(false);
    };

    const handleCancelEditPlan = () => {
        setEditedPlan((Array.isArray(report.treatmentPlan) ? report.treatmentPlan : []).map(planItemToString));
        setIsEditingPlan(false);
    };

    return (
        <div className={`animate-fade-in-up mt-8 ${isScenario ? 'p-4 border-2 border-dashed border-purple-300 rounded-2xl bg-purple-50' : ''}`}>
            {/* Asosiy sarlavha — hujjat uslubi */}
            <div className="mb-8">
                <h1 className={`text-2xl font-bold tracking-tight ${isScenario ? 'text-purple-700' : 'text-slate-800'}`}>
                    {isScenario ? t('final_report_scenario_result') : t('final_report_document_title')}
                </h1>
                <p className="text-sm text-slate-500 mt-1">{t('final_report_document_subtitle')}</p>
            </div>

            {/* ASOSIY XULOSA — bitta aniq blok, boshqa matn bilan aralashmasin */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white shadow-md overflow-hidden mb-10">
                <div className="px-6 py-4 bg-slate-800 text-white">
                    <h2 className="text-lg font-bold uppercase tracking-wide">{t('final_report_main_conclusion')}</h2>
                    <p className="text-slate-200 text-sm mt-0.5">{t('final_report_main_conclusion_subtitle')}</p>
                </div>
                <div className="p-6 space-y-6">
                    {report.criticalFinding && (
                        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                            <div className="flex items-center gap-3">
                                <AlertTriangleIcon className="w-8 h-8 text-red-600 flex-shrink-0"/>
                                <div>
                                    <h3 className="text-base font-bold text-red-800">{t('final_report_attention_critical')}</h3>
                                    <p className="font-semibold text-red-700 text-sm mt-1">{report.criticalFinding.finding}</p>
                                </div>
                            </div>
                            <p className="mt-2 text-sm text-red-700 pl-11">{report.criticalFinding.implication}</p>
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{t('final_report_consensus_diagnoses')}</h3>
                        {!hasRealDiagnosis && (
                            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 mb-4">
                                <p className="text-sm font-semibold text-amber-900">{t('final_report_consensus_pending')}</p>
                                {report.unexpectedFindings && String(report.unexpectedFindings).trim() && (
                                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{report.unexpectedFindings}</p>
                                )}
                            </div>
                        )}
                        {consensusDiagnoses.filter((d) => d.name.trim()).map((diag, index) => (
                            <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 mb-4 last:mb-0">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <span className="text-base font-bold text-slate-900">{diag.name}</span>
                                        {diag.icd10 && (
                                            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-mono font-semibold">
                                                {t('final_report_icd10')}: {diag.icd10}
                                            </span>
                                        )}
                                    </div>
                                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded text-sm font-semibold shrink-0">
                                        {Number.isFinite(diag.probability) ? `${diag.probability}%` : '-'}
                                    </span>
                                </div>
                                {diag.uzbekProtocolMatch && (
                                    <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 border border-green-200 rounded text-xs font-semibold text-green-700">
                                        <ShieldCheckIcon className="w-4 h-4" />
                                        {diag.uzbekProtocolMatch}
                                    </div>
                                )}
                                <p className="text-sm text-slate-700 mt-2 font-medium">
                                    {t('final_report_justification')}{' '}
                                    <LinkifiedText text={diag.justification} className="inline font-normal" />
                                </p>
                                {(() => {
                                    const chain = getReasoningChainArray(diag);
                                    return chain.length > 0 && (
                                        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">{t('final_report_reasoning_chain')}</p>
                                            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                                                {chain.map((step, i) => (
                                                    <li key={i}><LinkifiedText text={step} className="inline" /></li>
                                                ))}
                                            </ol>
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                    {report.simplifiedFamilyExplanation && String(report.simplifiedFamilyExplanation).trim() && (
                        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/60">
                            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-2">{t('final_report_family_explanation')}</h3>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{sanitizeClinicalContent(String(report.simplifiedFamilyExplanation))}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Qolgan bo'limlar — alohida hujjat bo'limlari */}
            <div className="space-y-10">

                <ImagingInterpretationCard imaging={report.imagingInterpretation} />

                <PatientRoutingCard routing={report.patientRouting} />
                <RiskFactorsCard riskFactors={report.riskFactors} severityAssessment={report.severityAssessment} />

                {!report.imagingInterpretation && report.imageAnalysis?.findings && (
                    <Section title={t('final_report_image_analysis_title')} icon={<ImageIcon className="w-6 h-6"/>}>
                        <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                            <p><span className='font-semibold'>{t('final_report_image_findings')}:</span> {report.imageAnalysis.findings}</p>
                            <p className="mt-2"><span className='font-semibold'>{t('final_report_image_correlation')}:</span> {report.imageAnalysis.correlation}</p>
                        </div>
                    </Section>
                )}

                <ProtocolComplianceGapsCard gaps={report.protocolComplianceGaps} />
                <CareQualityAuditCard audit={report.careQualityAudit} />

                {report.unexpectedFindings && String(report.unexpectedFindings).trim() && (
                    <Section title={t('final_report_unexpected_findings')} icon={<LightBulbIcon className="w-6 h-6 text-amber-500"/>}>
                        <div className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
                            <LinkifiedText text={sanitizeClinicalContent(String(report.unexpectedFindings))} />
                        </div>
                    </Section>
                )}

                <Section title={t('final_report_treatment_plan_title')} icon={<BrainCircuitIcon className="w-6 h-6"/>}>
                    {!isEditingPlan ? (
                        <div className="space-y-3">
                            {safePlan.length > 0 ? (
                            <ul className="list-disc list-inside space-y-2 text-text-primary">
                                {safePlan.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                            ) : (
                                <div className="space-y-2 text-sm text-slate-600">
                                    <p className="italic text-slate-500">
                                        {t('final_report_empty_plan_note')}
                                    </p>
                                    {(Array.isArray(report.medicationRecommendations) && report.medicationRecommendations.length > 0) && (
                                        <p className="text-xs text-slate-500">
                                            {t('final_report_empty_plan_hint')}
                                        </p>
                                    )}
                                </div>
                            )}
                            {onUpdateReport && !isScenario && (
                                <button onClick={() => setIsEditingPlan(true)} className="flex items-center gap-2 text-sm font-semibold text-accent-color-blue bg-slate-200/50 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors mt-3">
                                    <PencilIcon className="w-4 h-4" /> {t('final_report_edit')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {editedPlan.map((item, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <textarea
                                        value={item}
                                        onChange={(e) => handlePlanChange(index, e.target.value)}
                                        rows={2}
                                        className="flex-grow common-input"
                                        placeholder={t('final_report_edit_plan_placeholder')}
                                    />
                                    <button onClick={() => handleRemovePlanStep(index)} className="delete-button" title={t('final_report_delete_btn')}>
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button onClick={handleAddPlanStep} className="text-sm font-semibold text-accent-color-blue hover:underline">
                                {t('final_report_add_step')}
                            </button>
                            <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
                                <button onClick={handleCancelEditPlan} className="edit-control-button secondary">
                                    <XIcon className="w-4 h-4" /> {t('cancel')}
                                </button>
                                <button onClick={handleSavePlan} className="edit-control-button primary">
                                    <CheckIcon className="w-4 h-4" /> {t('save')}
                                </button>
                            </div>
                        </div>
                    )}
                    {report.costEffectivenessNotes && <p className="mt-3 text-xs italic p-2 bg-slate-100/50 rounded-md"><strong>{t('final_report_cost_effectiveness')}:</strong> {report.costEffectivenessNotes}</p>}
                </Section>
                
                {report.clinicalRedFlags && report.clinicalRedFlags.length > 0 && (
                    <ClinicalRedFlagsCard flags={report.clinicalRedFlags} />
                )}

                <Section title={t('final_report_medications_uz')} icon={<PillIcon className="w-6 h-6"/>}>
                    {report.pharmacologyWarnings && report.pharmacologyWarnings.length > 0 && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-sm font-bold text-amber-800 mb-1">{t('consilium_pharmacology_warnings')}</p>
                            <ul className="list-disc list-inside text-sm text-amber-900 space-y-1">
                                {report.pharmacologyWarnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {(Array.isArray(report.medicationRecommendations) && report.medicationRecommendations.length > 0) ? report.medicationRecommendations.map((med, index) => {
                        const drugName = (med.name && String(med.name).trim()) || (med.localAvailability && String(med.localAvailability).trim()) || 'Dori';
                        const hasRealName = med.name && String(med.name).trim() && !/^(doza|dori|tabletka|tavsiya)$/i.test(String(med.name).trim());
                        const showLocalAvailability = med.localAvailability && (hasRealName || !drugName.includes(med.localAvailability));
                        return (
                        <div key={index} className="p-4 bg-slate-50 rounded-xl border border-border-color shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 right-0 bg-blue-500 w-16 h-16 rounded-bl-full -mr-8 -mt-8 opacity-10"></div>
                           <p className="font-bold text-lg text-text-primary">{drugName}</p>
                           {(med.dosage && String(med.dosage).trim()) ? (
                               <p className="text-sm text-text-secondary mt-1"><span className="font-semibold">{t('final_report_dosage_inline')}</span> {med.dosage}</p>
                           ) : null}
                           
                           {showLocalAvailability && (
                               <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-xs text-green-800">
                                   <span className="font-bold">{t('final_report_local_names')}</span> {med.localAvailability}
                               </div>
                           )}
                           
                           {med.priceEstimate && (
                               <p className="text-xs text-slate-500 mt-1 italic">{t('final_report_estimated_price')} {med.priceEstimate}</p>
                           )}
                           
                           {med.notes && (
                               <p className="text-sm text-text-secondary mt-2 pt-2 border-t border-slate-200">
                                   <span className="font-semibold">{t('final_report_instructions_inline')}</span> {med.notes}
                               </p>
                           )}
                           {med.adverseEffects && med.adverseEffects.length > 0 && (
                               <p className="text-sm text-amber-800 mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                                   <span className="font-semibold">{t('final_report_adverse_effects')}:</span> {med.adverseEffects.join('; ')}
                               </p>
                           )}
                           {med.contraindications && (
                               <p className="text-xs text-red-700 mt-1"><span className="font-semibold">{t('final_report_contraindications')}:</span> {med.contraindications}</p>
                           )}
                           {med.monitoring && (
                               <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">{t('final_report_monitoring')}:</span> {med.monitoring}</p>
                           )}
                        </div>
                    ); }) : (
                        <p className="text-slate-500 text-sm italic">{t('final_report_medications_placeholder')}</p>
                    )}
                    </div>
                </Section>

                {report.folkMedicine && <FolkMedicineCard section={report.folkMedicine} />}

                {report.nutritionPrevention && <NutritionPreventionCard section={report.nutritionPrevention} />}

                <AdverseEventRiskCard risks={report.adverseEventRisks} />

                 <Section title={t('final_report_additional_tests_title')} icon={<DocumentTextIcon className="w-6 h-6"/>}>
                    <ul className="list-disc list-inside space-y-2 text-text-primary">
                        {(Array.isArray(report.recommendedTests) ? report.recommendedTests : []).map((item, index) => (
                            <li key={index}>{recommendedTestToDisplay(item)}</li>
                        ))}
                    </ul>
                </Section>
                
                <PrognosisCard prognosis={report.prognosisReport} isLoading={false} />

                <LifestylePlanCard plan={report.lifestylePlan} />

                {report.followUpPlan && <FollowUpPlan tasks={report.followUpPlan} />}
                
                {report.referrals && <ReferralGenerator referrals={report.referrals} patientData={patientData} />}
                
                <ClinicalTrialsCard trials={report.matchedClinicalTrials} />
                
                <RelatedResearchCard research={report.relatedResearch} />

                 <Section title={t('final_report_rejected_hypotheses_title')} icon={<DocumentTextIcon className="text-slate-500 w-6 h-6" />}>
                     {(Array.isArray(report.rejectedHypotheses) && report.rejectedHypotheses.length > 0) ? report.rejectedHypotheses.map((hypo, index) => (
                        <div key={index} className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                           <p className="font-semibold text-text-primary line-through">{hypo.name}</p>
                           <p className="text-sm text-text-secondary mt-1">{t('final_report_reason_inline')} {hypo.reason}</p>
                        </div>
                    )) : (
                        <p className="text-slate-500 text-sm italic">{t('final_report_no_data')}</p>
                    )}
                </Section>

                {/* Legal Disclaimer specific to Uzbekistan */}
                <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                    <p className="font-bold mb-1">{t('final_report_legal_note')}</p>
                    <p>
                        {t('final_report_legal_disclaimer')}
                        {report.uzbekistanLegislativeNote && <span className="block mt-1 font-semibold">{report.uzbekistanLegislativeNote}</span>}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FinalReportCard;