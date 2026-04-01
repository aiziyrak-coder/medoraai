
import React, { useState, useEffect } from 'react';
import type { FinalReport, FolkMedicineSection, NutritionPreventionSection, PatientData } from '../types';
import { normalizeConsensusDiagnosis, getReasoningChainArray } from '../types';
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
import FollowUpPlan from './report/FollowUpPlan';
import ReferralGenerator from './report/ReferralGenerator';
import GlobeIcon from './icons/GlobeIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import CheckIcon from './icons/CheckIcon';
import XIcon from './icons/XIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';

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
    if (!plan) return null;
    const diet = Array.isArray(plan.diet) ? plan.diet : [];
    const exercise = Array.isArray(plan.exercise) ? plan.exercise : [];
    if (diet.length === 0 && exercise.length === 0) return null;
    return (
        <Section title="Hayot Tarzi va Ovqatlanish Rejasi" icon={<LightBulbIcon className="text-yellow-500 h-6 w-6"/>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {diet.length > 0 && (
                    <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                        <h4 className="font-semibold">Ovqatlanish Tavsiyalari:</h4>
                        <ul className="list-disc list-inside mt-1">
                            {diet.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                )}
                {exercise.length > 0 && (
                    <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                        <h4 className="font-semibold">Jismoniy Mashqlar:</h4>
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
    if (!trials || trials.length === 0) return null;
    return (
        <Section title="Mos Keluvchi Klinik Sinovlar" icon={<FlaskIcon className="h-6 w-6"/>}>
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
    if (!risks || risks.length === 0) return null;
    return (
         <Section title="Dori vositalarining nojo'ya ta'sir xavfi" icon={<ShieldWarningIcon className="w-6 h-6"/>}>
            {risks.map((risk, i) => (
                <div key={i} className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                    <p className="font-semibold text-yellow-800">{risk.drug}: {risk.risk} (ehtimollik ~{Math.round(risk.probability * 100)}%)</p>
                </div>
            ))}
        </Section>
    )
}

const RelatedResearchCard: React.FC<{research: FinalReport['relatedResearch']}> = ({research}) => {
    if (!research || research.length === 0) return null;
    return (
        <Section title="Tegishli Ilmiy Maqolalar" icon={<GlobeIcon className="w-6 h-6"/>}>
            {research.map((item, i) => (
                <div key={i} className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-color-blue hover:underline">{item.title}</a>
                    <p className="text-xs text-text-secondary mt-1">{item.summary}</p>
                </div>
            ))}
        </Section>
    );
};

const FolkMedicineCard: React.FC<{ section: FolkMedicineSection }> = ({ section }) => {
    const { intro, disclaimer, items } = section;
    if (!items?.length && !intro?.trim() && !disclaimer?.trim()) return null;
    return (
        <Section title="Xalq tabobati va dorivor o'simliklar (qo'shimcha)" icon={<FlaskIcon className="h-6 w-6 text-emerald-600"/>}>
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 text-sm text-slate-800 space-y-2">
                <p className="text-xs font-semibold text-emerald-900">
                    Bu bo'lim rasmiy dori-darmonlar va shifokor ko'rsatmasining o'rnini bosmaydi; faqat ma'lumot va qo'shimcha yo'nalish sifatida.
                </p>
                {intro?.trim() && <p className="whitespace-pre-wrap">{intro}</p>}
                {disclaimer?.trim() && (
                    <p className="text-xs text-emerald-900/90 border-t border-emerald-200 pt-2 whitespace-pre-wrap">{disclaimer}</p>
                )}
            </div>
            {items.length > 0 && (
                <div className="space-y-3">
                    {items.map((it, i) => (
                        <div key={i} className="p-4 rounded-xl border border-emerald-100 bg-white shadow-sm">
                            <p className="font-bold text-slate-900">{it.plantName}</p>
                            {it.plantPart && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">Qismi:</span> {it.plantPart}</p>}
                            {it.preparationOrUsage && <p className="text-sm mt-2"><span className="font-semibold text-slate-700">Tayyorlash / qo'llash:</span> {it.preparationOrUsage}</p>}
                            {it.traditionalContext && <p className="text-sm text-slate-600 mt-1"><span className="font-semibold">An'anaviy kontekst:</span> {it.traditionalContext}</p>}
                            {it.precautions && (
                                <p className="text-sm mt-2 p-2 bg-amber-50 border border-amber-100 rounded-md text-amber-900">
                                    <span className="font-semibold">Ehtiyotkorlik:</span> {it.precautions}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
};

const NutritionPreventionCard: React.FC<{ section: NutritionPreventionSection }> = ({ section }) => {
    const { intro, disclaimer, dietaryGuidelines, preventionMeasures } = section;
    const hasDiet = dietaryGuidelines.length > 0;
    const hasPrev = preventionMeasures.length > 0;
    if (!hasDiet && !hasPrev && !intro?.trim() && !disclaimer?.trim()) return null;
    return (
        <Section title="To'g'ri ovqatlanish va kasalliklarni oldini olish (profilaktika)" icon={<ChartBarIcon className="h-6 w-6 text-sky-600"/>}>
            {intro?.trim() && <p className="text-sm text-slate-800 whitespace-pre-wrap mb-3">{intro}</p>}
            {hasDiet && (
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-2">To'g'ri ovqatlanish bo'yicha</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-sm text-text-primary">
                        {dietaryGuidelines.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>
                </div>
            )}
            {hasPrev && (
                <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-2">Profilaktika va oldini olish</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-sm text-text-primary">
                        {preventionMeasures.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>
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
    const safePlan = (Array.isArray(report.treatmentPlan) ? report.treatmentPlan : []).map(planItemToString);

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
                    {isScenario ? "Alternativ Senariy Natijasi" : "YAKUNIY KLINIK XULOSA"}
                </h1>
                <p className="text-sm text-slate-500 mt-1">Konsilium konsensusi asosida - tibbiy hujjat</p>
            </div>

            {/* ASOSIY XULOSA — bitta aniq blok, boshqa matn bilan aralashmasin */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white shadow-md overflow-hidden mb-10">
                <div className="px-6 py-4 bg-slate-800 text-white">
                    <h2 className="text-lg font-bold uppercase tracking-wide">Asosiy xulosa</h2>
                    <p className="text-slate-200 text-sm mt-0.5">Konsensus tashxis va kritik topilmalar</p>
                </div>
                <div className="p-6 space-y-6">
                    {report.criticalFinding && (
                        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                            <div className="flex items-center gap-3">
                                <AlertTriangleIcon className="w-8 h-8 text-red-600 flex-shrink-0"/>
                                <div>
                                    <h3 className="text-base font-bold text-red-800">DIQQAT! KRITIK TOPILMA!</h3>
                                    <p className="font-semibold text-red-700 text-sm mt-1">{report.criticalFinding.finding}</p>
                                </div>
                            </div>
                            <p className="mt-2 text-sm text-red-700 pl-11">{report.criticalFinding.implication}</p>
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Konsensus tashxis(lar)</h3>
                        {normalizeConsensusDiagnosis(report.consensusDiagnosis).map((diag, index) => (
                            <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 mb-4 last:mb-0">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="text-base font-bold text-slate-900">{diag.name}</span>
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
                                <p className="text-sm text-slate-700 mt-2 font-medium">Asoslash: {diag.justification}</p>
                                {(() => {
                                    const chain = getReasoningChainArray(diag);
                                    return chain.length > 0 && (
                                        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Mantiqiy zanjir</p>
                                            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
                                                {chain.map((step, i) => (
                                                    <li key={i}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                    {report.folkMedicine && (report.folkMedicine.intro?.trim() || (report.folkMedicine.items?.length ?? 0) > 0) && (
                        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70">
                            <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2">Xalq tabobati (qo'shimcha)</h3>
                            {report.folkMedicine.intro?.trim() ? (
                                <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.folkMedicine.intro}</p>
                            ) : (
                                <p className="text-sm text-slate-800">
                                    Dorivor o'simliklar va an'anaviy qo'llanmalar — quyidagi alohida bo'limda keltirilgan.
                                </p>
                            )}
                            <p className="text-xs text-emerald-900 mt-2 font-medium">
                                To'liq ro'yxat va ehtiyot choralar — «Xalq tabobati va dorivor o'simliklar (qo'shimcha)» bo'limida.
                            </p>
                        </div>
                    )}
                    {report.nutritionPrevention && (
                        (report.nutritionPrevention.intro?.trim() ||
                            (report.nutritionPrevention.dietaryGuidelines?.length ?? 0) > 0 ||
                            (report.nutritionPrevention.preventionMeasures?.length ?? 0) > 0 ||
                            report.nutritionPrevention.disclaimer?.trim()) && (
                        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/70">
                            <h3 className="text-sm font-bold text-sky-900 uppercase tracking-wider mb-2">Ovqatlanish va profilaktika</h3>
                            {report.nutritionPrevention.intro?.trim() ? (
                                <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.nutritionPrevention.intro}</p>
                            ) : (
                                <p className="text-sm text-slate-800">
                                    Kasalliklarni oldini olish, to'g'ri ovqatlanish va profilaktika bo'yicha tavsiyalar quyidagi alohida bo'limda keltirilgan.
                                </p>
                            )}
                            <p className="text-xs text-sky-900 mt-2 font-medium">
                                Batafsil — «To'g'ri ovqatlanish va kasalliklarni oldini olish (profilaktika)» bo'limida.
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Qolgan bo'limlar — alohida hujjat bo'limlari */}
            <div className="space-y-10">

                {report.imageAnalysis?.findings && (
                    <Section title="Tasvir Tahlili" icon={<ImageIcon className="w-6 h-6"/>}>
                        <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                            <p><span className='font-semibold'>Topilmalar:</span> {report.imageAnalysis.findings}</p>
                            <p className="mt-2"><span className='font-semibold'>Klinik bog'liqlik:</span> {report.imageAnalysis.correlation}</p>
                        </div>
                    </Section>
                )}

                {report.unexpectedFindings && String(report.unexpectedFindings).trim() && (
                    <Section title="Kutilmagan topilmalar va gipotezalar" icon={<LightBulbIcon className="w-6 h-6 text-amber-500"/>}>
                        <p className="text-text-primary whitespace-pre-wrap">{report.unexpectedFindings}</p>
                    </Section>
                )}

                <Section title="Tavsiya Etilgan Davolash Rejasi" icon={<BrainCircuitIcon className="w-6 h-6"/>}>
                    {!isEditingPlan ? (
                        <div className="space-y-3">
                            {safePlan.length > 0 ? (
                            <ul className="list-disc list-inside space-y-2 text-text-primary">
                                {safePlan.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                            ) : (
                                <div className="space-y-2 text-sm text-slate-600">
                                    <p className="italic text-slate-500">
                                        Yakuniy JSONda davolash rejasi bo‘sh kelgan. Quyidagi «Dori-darmonlar» bo‘limi va konsensus tashxisiga qarab, «Tahrirlash» orqali 3–5 ta aniq qadamni qo‘lda yozishingiz mumkin.
                                    </p>
                                    {(Array.isArray(report.medicationRecommendations) && report.medicationRecommendations.length > 0) && (
                                        <p className="text-xs text-slate-500">
                                            Masalan, dori blokidagi tavsiyalar asosida: birinchi qadam — tashxisni tasdiqlash / qo‘shimcha tekshiruv; keyingi qadamlar — dori rejasi va kuzatuv.
                                        </p>
                                    )}
                                </div>
                            )}
                            {onUpdateReport && !isScenario && (
                                <button onClick={() => setIsEditingPlan(true)} className="flex items-center gap-2 text-sm font-semibold text-accent-color-blue bg-slate-200/50 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors mt-3">
                                    <PencilIcon className="w-4 h-4" /> Tahrirlash
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
                                        placeholder="Davolash bosqichini kiriting..."
                                    />
                                    <button onClick={() => handleRemovePlanStep(index)} className="delete-button" title="O'chirish">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button onClick={handleAddPlanStep} className="text-sm font-semibold text-accent-color-blue hover:underline">
                                + Yangi qadam qo'shish
                            </button>
                            <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
                                <button onClick={handleCancelEditPlan} className="edit-control-button secondary">
                                    <XIcon className="w-4 h-4" /> Bekor qilish
                                </button>
                                <button onClick={handleSavePlan} className="edit-control-button primary">
                                    <CheckIcon className="w-4 h-4" /> Saqlash
                                </button>
                            </div>
                        </div>
                    )}
                    {report.costEffectivenessNotes && <p className="mt-3 text-xs italic p-2 bg-slate-100/50 rounded-md"><strong>Iqtisodiy samaradorlik:</strong> {report.costEffectivenessNotes}</p>}
                </Section>
                
                <Section title="Dori-Darmonlar bo'yicha Tavsiyalar (O'zbekiston)" icon={<PillIcon className="w-6 h-6"/>}>
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
                               <p className="text-sm text-text-secondary mt-1"><span className="font-semibold">Doza:</span> {med.dosage}</p>
                           ) : null}
                           
                           {showLocalAvailability && (
                               <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-xs text-green-800">
                                   <span className="font-bold">Mahalliy savdo nomlari:</span> {med.localAvailability}
                               </div>
                           )}
                           
                           {med.priceEstimate && (
                               <p className="text-xs text-slate-500 mt-1 italic">Taxminiy narxi: {med.priceEstimate}</p>
                           )}
                           
                           {med.notes && (
                               <p className="text-sm text-text-secondary mt-2 pt-2 border-t border-slate-200">
                                   <span className="font-semibold">Qanday qabul qilish (yo&apos;riqnoma):</span> {med.notes}
                               </p>
                           )}
                        </div>
                    ); }) : (
                        <p className="text-slate-500 text-sm italic">Dori tavsiyalari tashxis asosida hisobotga kiritiladi. Konsiliumni qayta ishga tushiring yoki bir oz kuting.</p>
                    )}
                    </div>
                </Section>

                {report.folkMedicine && <FolkMedicineCard section={report.folkMedicine} />}

                {report.nutritionPrevention && <NutritionPreventionCard section={report.nutritionPrevention} />}

                <AdverseEventRiskCard risks={report.adverseEventRisks} />

                 <Section title="Qo'shimcha Tekshiruvlar" icon={<DocumentTextIcon className="w-6 h-6"/>}>
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

                 <Section title="Inkor Etilgan Gipotezalar" icon={<DocumentTextIcon className="text-slate-500 w-6 h-6" />}>
                     {(Array.isArray(report.rejectedHypotheses) && report.rejectedHypotheses.length > 0) ? report.rejectedHypotheses.map((hypo, index) => (
                        <div key={index} className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                           <p className="font-semibold text-text-primary line-through">{hypo.name}</p>
                           <p className="text-sm text-text-secondary mt-1">Sabab: {hypo.reason}</p>
                        </div>
                    )) : (
                        <p className="text-slate-500 text-sm italic">Ma'lumot kiritilmagan.</p>
                    )}
                </Section>

                {/* Legal Disclaimer specific to Uzbekistan */}
                <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                    <p className="font-bold mb-1">Yuridik Eslatma (O'zbekiston Respublikasi):</p>
                    <p>
                        Ushbu xulosa faqat maslahat xarakteriga ega. Yakuniy tashxis va davolash uchun javobgarlik davolovchi shifokor zimmasida. 
                        Retsept bilan beriladigan dori vositalarini faqat shifokor ko'rsatmasi bilan qabul qiling.
                        {report.uzbekistanLegislativeNote && <span className="block mt-1 font-semibold">{report.uzbekistanLegislativeNote}</span>}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FinalReportCard;