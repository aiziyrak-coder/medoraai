
import React, { useState, useEffect } from 'react';
import type { FinalReport, PatientData } from '../types';
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

const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="animate-fade-in-up mt-8">
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-slate-100">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        </div>
        <div className="mt-3 pl-14 space-y-4 text-sm">
            {children}
        </div>
    </div>
);

const LifestylePlanCard: React.FC<{plan: FinalReport['lifestylePlan']}> = ({plan}) => {
    if (!plan) return null;
    return (
        <Section title="Hayot Tarzi va Ovqatlanish Rejasi" icon={<LightBulbIcon className="text-yellow-500 h-6 w-6"/>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                    <h4 className="font-semibold">Ovqatlanish Tavsiyalari:</h4>
                    <ul className="list-disc list-inside mt-1">
                        {plan.diet.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>
                <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                    <h4 className="font-semibold">Jismoniy Mashqlar:</h4>
                    <ul className="list-disc list-inside mt-1">
                        {plan.exercise.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>
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


const FinalReportCard: React.FC<{ report: FinalReport, patientData: Partial<PatientData>, isScenario?: boolean, onUpdateReport?: (updatedReport: Partial<FinalReport>) => void }> = ({ report, patientData, isScenario = false, onUpdateReport }) => {
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [editedPlan, setEditedPlan] = useState<string[]>(report.treatmentPlan);

    useEffect(() => {
        setEditedPlan(report.treatmentPlan);
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
        setEditedPlan(report.treatmentPlan);
        setIsEditingPlan(false);
    };

    return (
        <div className={`animate-fade-in-up mt-8 ${isScenario ? 'p-4 border-2 border-dashed border-purple-300 rounded-2xl bg-purple-50' : ''}`}>
            <h2 className={`text-3xl font-extrabold mb-6 pb-4 border-b-2 ${isScenario ? 'text-purple-700 border-purple-300' : 'text-transparent bg-clip-text animated-gradient-text border-border-color'}`}>
                {isScenario ? "Alternativ Senariy Natijasi" : "Yakuniy Xulosa: Konsilium Konsensusi"}
            </h2>
            <div className="space-y-10">
                {report.criticalFinding && (
                    <div className="p-4 bg-red-100 border-l-4 border-red-500 rounded-r-lg shadow-lg">
                        <div className="flex items-center gap-3">
                             <AlertTriangleIcon className="w-8 h-8 text-red-600"/>
                             <div>
                                 <h3 className="text-xl font-bold text-red-800">DIQQAT! KRITIK TOPILMA!</h3>
                                 <p className="font-semibold text-red-700">{report.criticalFinding.finding}</p>
                             </div>
                        </div>
                        <p className="mt-2 text-sm text-red-700 pl-11">{report.criticalFinding.implication}</p>
                    </div>
                )}
                
                <Section title="Konsensus Tashxis" icon={<ClipboardListIcon className="w-6 h-6 text-purple-600"/>}>
                    {report.consensusDiagnosis.map((diag, index) => (
                        <div key={index} className="p-4 bg-white/80 rounded-xl border border-border-color shadow-sm mb-3">
                            <div className="flex justify-between font-bold text-base text-text-primary">
                                <span className="text-lg text-blue-900">{diag.name}</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">{diag.probability}%</span>
                            </div>
                            
                            {/* Protocols */}
                            {diag.uzbekProtocolMatch && (
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
                                    <ShieldCheckIcon className="w-4 h-4" />
                                    {diag.uzbekProtocolMatch}
                                </div>
                            )}

                            {/* Deep Reasoning Chain */}
                            {diag.reasoningChain && diag.reasoningChain.length > 0 && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg border-l-4 border-blue-400">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Mantiqiy Zanjir (Reasoning):</p>
                                    <ol className="list-decimal list-inside text-sm text-text-secondary space-y-1">
                                        {diag.reasoningChain.map((step, i) => (
                                            <li key={i}>{step}</li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            <p className="text-sm text-text-secondary mt-3 font-medium">Asoslash: {diag.justification}</p>
                        </div>
                    ))}
                </Section>

                {report.imageAnalysis?.findings && (
                    <Section title="Tasvir Tahlili" icon={<ImageIcon className="w-6 h-6"/>}>
                        <div className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                            <p><span className='font-semibold'>Topilmalar:</span> {report.imageAnalysis.findings}</p>
                            <p className="mt-2"><span className='font-semibold'>Klinik bog'liqlik:</span> {report.imageAnalysis.correlation}</p>
                        </div>
                    </Section>
                )}

                <Section title="Tavsiya Etilgan Davolash Rejasi" icon={<BrainCircuitIcon className="w-6 h-6"/>}>
                    {!isEditingPlan ? (
                        <div className="space-y-3">
                            <ul className="list-disc list-inside space-y-2 text-text-primary">
                                {report.treatmentPlan.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
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
                     {report.medicationRecommendations.map((med, index) => (
                        <div key={index} className="p-4 bg-slate-50 rounded-xl border border-border-color shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 right-0 bg-blue-500 w-16 h-16 rounded-bl-full -mr-8 -mt-8 opacity-10"></div>
                           <p className="font-bold text-lg text-text-primary">{med.name}</p>
                           <p className="text-sm text-text-secondary mt-1"><span className="font-semibold">Doza:</span> {med.dosage}</p>
                           
                           {med.localAvailability && (
                               <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-xs text-green-800">
                                   <span className="font-bold">Mahalliy savdo nomlari:</span> {med.localAvailability}
                               </div>
                           )}
                           
                           {med.priceEstimate && (
                               <p className="text-xs text-slate-500 mt-1 italic">Taxminiy narxi: {med.priceEstimate}</p>
                           )}
                           
                           <p className="text-xs text-text-secondary mt-2 border-t pt-2">{med.notes}</p>
                        </div>
                    ))}
                    </div>
                </Section>

                <AdverseEventRiskCard risks={report.adverseEventRisks} />

                 <Section title="Qo'shimcha Tekshiruvlar" icon={<DocumentTextIcon className="w-6 h-6"/>}>
                    <ul className="list-disc list-inside space-y-2 text-text-primary">
                        {report.recommendedTests.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </Section>
                
                <PrognosisCard prognosis={report.prognosisReport} isLoading={false} />

                <LifestylePlanCard plan={report.lifestylePlan} />

                {report.followUpPlan && <FollowUpPlan tasks={report.followUpPlan} />}
                
                {report.referrals && <ReferralGenerator referrals={report.referrals} patientData={patientData} />}
                
                <ClinicalTrialsCard trials={report.matchedClinicalTrials} />
                
                <RelatedResearchCard research={report.relatedResearch} />

                 <Section title="Inkor Etilgan Gipotezalar" icon={<DocumentTextIcon className="text-slate-500 w-6 h-6" />}>
                     {report.rejectedHypotheses.map((hypo, index) => (
                        <div key={index} className="p-3 bg-slate-100/50 rounded-lg border border-border-color">
                           <p className="font-semibold text-text-primary line-through">{hypo.name}</p>
                           <p className="text-sm text-text-secondary mt-1">Sabab: {hypo.reason}</p>
                        </div>
                    ))}
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
