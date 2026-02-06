import React from 'react';
import type { ResearchReport, TreatmentStrategy } from '../types';

import LightBulbIcon from './icons/LightBulbIcon';
import GlobeIcon from './icons/GlobeIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import DnaIcon from './icons/DnaIcon';
import PatentIcon from './icons/PatentIcon';
import FlaskIcon from './icons/FlaskIcon';
import ScaleIcon from './icons/ScaleIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import UsersIcon from './icons/UsersIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import MoleculeViewer from './MoleculeViewer';
import RoadmapTimeline from './RoadmapTimeline';
import RiskBenefitChart from './RiskBenefitChart';
import ChartPieIcon from './icons/ChartPieIcon';
import TargetIcon from './icons/TargetIcon';

const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="relative mt-8">
        <div className="flex items-center gap-4">
            {icon}
            <h3 className="text-xl font-bold text-text-primary">{title}</h3>
        </div>
        <div className="mt-3 pl-11 space-y-3 text-text-secondary border-l-2 border-slate-200 ml-3.5">
            <div className="pl-6">
                {children}
            </div>
        </div>
    </div>
);

const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const XIcon: React.FC = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
     </svg>
);

const StrategyComparisonMatrix: React.FC<{strategies: TreatmentStrategy[]}> = ({ strategies }) => {
    return (
        <div className="overflow-x-auto bg-slate-50 p-2 rounded-lg">
            <table className="w-full text-sm text-left text-text-secondary">
                <thead className="text-xs text-text-primary uppercase bg-slate-100">
                    <tr>
                        <th scope="col" className="px-4 py-3 rounded-l-lg">Strategiya</th>
                        <th scope="col" className="px-4 py-3">Dalillar</th>
                        <th scope="col" className="px-4 py-3">Risk</th>
                        <th scope="col" className="px-4 py-3">Foyda</th>
                        <th scope="col" className="px-4 py-3 rounded-r-lg">Nishon</th>
                    </tr>
                </thead>
                <tbody>
                    {strategies.map((s, i) => (
                        <tr key={i} className="border-b border-border-color">
                            <th scope="row" className="px-4 py-4 font-medium text-text-primary whitespace-nowrap">{s.name}</th>
                            <td className="px-4 py-4">{s.evidence}</td>
                            <td className={`px-4 py-4 font-bold ${s.riskBenefit.risk.startsWith('High') || s.riskBenefit.risk.startsWith('Very') ? 'text-red-500' : 'text-yellow-500'}`}>{s.riskBenefit.risk}</td>
                             <td className={`px-4 py-4 font-bold ${s.riskBenefit.benefit === 'Breakthrough' ? 'text-green-500' : 'text-blue-500'}`}>{s.riskBenefit.benefit}</td>
                            <td className="px-4 py-4 truncate">{s.molecularTarget.name}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const ResearchReportCard: React.FC<{ report: ResearchReport }> = ({ report }) => {
    return (
        <div className="animate-fade-in-up mt-8">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text animated-gradient-text mb-6 pb-4 border-b-2 border-border-color">
                Tadqiqot Hisoboti: {report.diseaseName}
            </h2>
            <div className="space-y-6">
                 <Section title="Umumiy Xulosa" icon={<DocumentTextIcon />}>
                    <p className="text-base text-text-primary">{report.summary}</p>
                 </Section>

                 <Section title="Epidemiologiya va Patofiziologiya" icon={<ChartPieIcon />}>
                    <div className="p-4 bg-slate-50 rounded-lg border border-border-color space-y-4">
                        <div>
                            <h4 className="font-semibold text-text-primary">Epidemiologiya:</h4>
                            <ul className="list-disc list-inside mt-1 text-sm">
                                <li><span className="font-bold">Tarqalishi:</span> {report.epidemiology.prevalence}</li>
                                <li><span className="font-bold">Kasallanish:</span> {report.epidemiology.incidence}</li>
                                <li><span className="font-bold">Xavf Omillari:</span> {report.epidemiology.keyRiskFactors.join(', ')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-text-primary">Patofiziologiya:</h4>
                            <p className="text-sm">{report.pathophysiology}</p>
                        </div>
                    </div>
                </Section>

                <Section title="Yangi Istiqbolli Biomarkerlar" icon={<TargetIcon />}>
                    <div className="space-y-3">
                        {report.emergingBiomarkers.map((marker, index) => (
                            <div key={index} className="p-3 bg-slate-100 rounded-lg border border-border-color">
                                <p className="font-semibold text-text-primary">{marker.name} <span className="text-xs font-mono bg-slate-200 text-text-secondary px-2 py-0.5 rounded-full align-middle">{marker.type}</span></p>
                                <p className="text-sm text-text-secondary mt-1">{marker.description}</p>
                            </div>
                        ))}
                         {report.emergingBiomarkers.length === 0 && <p>Yangi istiqbolli biomarkerlar topilmadi.</p>}
                    </div>
                </Section>
                 
                {report.clinicalGuidelines && report.clinicalGuidelines.length > 0 && (
                    <Section title="Amaldagi Klinik Qo'llanmalar" icon={<DocumentTextIcon />}>
                        <div className="space-y-6">
                            {report.clinicalGuidelines.map((guideline, index) => (
                                <div key={index} className="p-4 bg-slate-50 rounded-lg border border-border-color">
                                    <h4 className="font-bold text-lg text-text-primary">{guideline.guidelineTitle}</h4>
                                    <p className="text-sm text-text-secondary font-semibold">Manba: {guideline.source}</p>
                                    <div className="mt-3 space-y-2">
                                        {guideline.recommendations.map((rec, recIndex) => (
                                            <div key={recIndex}>
                                                <h5 className="font-semibold text-text-primary">{rec.category}</h5>
                                                <ul className="list-disc list-inside text-sm text-text-secondary pl-2">
                                                    {rec.details.map((detail, detailIndex) => (
                                                        <li key={detailIndex}>{detail}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                 <Section title="Strategiyalarni Taqqoslash Matritsasi" icon={<ChartBarIcon />}>
                     <StrategyComparisonMatrix strategies={report.potentialStrategies} />
                 </Section>

                 <Section title="Risk/Foyda Tahlili" icon={<ScaleIcon />}>
                     <RiskBenefitChart strategies={report.potentialStrategies} />
                 </Section>

                <Section title="Potensial Davolash Strategiyalari Batafsil" icon={<LightBulbIcon className="h-7 w-7 text-accent-color-blue" />}>
                    {report.potentialStrategies.length > 0 ? (
                        <div className="space-y-8">
                            {report.potentialStrategies.map((strategy, index) => (
                                <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-border-color">
                                    <h4 className="font-bold text-xl text-text-primary">{index+1}. {strategy.name}</h4>
                                    
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <MoleculeViewer target={strategy.molecularTarget} />
                                        <div>
                                            <h5 className="font-semibold text-text-secondary">Ta'sir Mexanizmi:</h5>
                                            <p className="text-sm text-text-primary">{strategy.mechanism}</p>
                                        </div>
                                    </div>
                                    
                                     <div className="mt-6">
                                        <h5 className="font-semibold text-text-secondary mb-2">Rivojlanish Yo'l Xaritasi:</h5>
                                        <RoadmapTimeline roadmap={strategy.developmentRoadmap} />
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h5 className="font-semibold text-sm text-green-500 flex items-center gap-2"><CheckIcon /> Afzalliklari:</h5>
                                            <ul className="list-none space-y-1 mt-1 text-sm text-text-primary">
                                                {strategy.pros.map((pro, i) => <li key={i} className="flex items-start gap-2"><span className="text-green-500 mt-1">▪</span><span>{pro}</span></li>)}
                                            </ul>
                                        </div>
                                         <div>
                                            <h5 className="font-semibold text-sm text-red-500 flex items-center gap-2"><XIcon /> Kamchiliklari:</h5>
                                             <ul className="list-none space-y-1 mt-1 text-sm text-text-primary">
                                                {strategy.cons.map((con, i) => <li key={i} className="flex items-start gap-2"><span className="text-red-500 mt-1">▪</span><span>{con}</span></li>)}
                                            </ul>
                                        </div>
                                    </div>
                                     <div className="mt-6 space-y-4">
                                        <div>
                                            <h5 className="font-semibold text-sm text-text-secondary">Etik Masalalar:</h5>
                                            <ul className="text-sm text-text-primary/90 list-disc list-inside">
                                               {strategy.ethicalConsiderations.map((e,i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </div>
                                         <div>
                                            <h5 className="font-semibold text-sm text-text-secondary">Zaruriy Hamkorlar:</h5>
                                            <ul className="text-sm text-text-primary/90 list-disc list-inside">
                                               {strategy.requiredCollaborations.map((c,i) => <li key={i}>{c}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-sm text-text-secondary">Hamroh Diagnostika:</h5>
                                            <p className="text-sm text-text-primary/90">{strategy.companionDiagnosticNeeded}</p>
                                        </div>
                                     </div>
                                </div>
                            ))}
                        </div>
                    ) : <p>Potensial strategiyalar topilmadi.</p>}
                </Section>
                
                <Section title="Farmakogenomik Tahlil" icon={<DnaIcon />}>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-text-primary">Tegishli Genlar va Mutatsiyalar:</h4>
                            <ul className="list-disc list-inside mt-1">
                            {report.pharmacogenomics.relevantGenes.map((g,i) => <li key={i}><span className="font-bold">{g.gene} ({g.mutation}):</span> {g.impact}</li>)}
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-semibold text-text-primary">Maqsadli Bemorlar Guruhi:</h4>
                            <p>{report.pharmacogenomics.targetSubgroup}</p>
                        </div>
                    </div>
                </Section>
                
                 <Section title="Patent Landshafti" icon={<PatentIcon />}>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-text-primary">Raqobatchi Patentlar:</h4>
                            <ul className="list-disc list-inside mt-1">
                                {report.patentLandscape.competingPatents.map((p,i) => <li key={i}><span className="font-bold">{p.patentId}</span> ({p.assignee}): {p.title}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-text-primary">Ochish Mumkin Bo'lgan Yangi Imkoniyatlar (White Space):</h4>
                            <ul className="list-disc list-inside mt-1">
                               {report.patentLandscape.whitespaceOpportunities.map((o,i) => <li key={i}>{o}</li>)}
                            </ul>
                        </div>
                    </div>
                </Section>

                <Section title="Tegishli Klinik Sinovlar" icon={<FlaskIcon />}>
                    <ul className="list-disc list-inside space-y-2">
                        {report.relatedClinicalTrials.map((t,i) => (
                            <li key={i}>
                                <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-accent-color-blue hover:underline">
                                    <span className="font-bold">{t.trialId}</span> - {t.title}
                                </a> (<span className="italic">{t.status}</span>)
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Yakuniy Strategik Xulosa" icon={<ShieldCheckIcon />}>
                    <p className="text-base text-text-primary">{report.strategicConclusion}</p>
                </Section>
                
                 {report.sources && report.sources.length > 0 && (
                    <Section title="Ma'lumot Manbalari" icon={<GlobeIcon />}>
                        <ul className="space-y-2">
                            {report.sources.map((source, index) => (
                                <li key={index} className="text-sm truncate">
                                    <a 
                                        href={source.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent-color-blue hover:text-accent-color-cyan hover:underline transition-colors break-words"
                                        title={source.title}
                                    >
                                        - {source.title || source.uri}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Section>
                 )}
            </div>
        </div>
    );
};

export default ResearchReportCard;
