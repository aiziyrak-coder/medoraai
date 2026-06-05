import React from 'react';
import type { ResearchReport, TreatmentStrategy } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import LinkifiedText from './common/LinkifiedText';
import LightBulbIcon from './icons/LightBulbIcon';
import GlobeIcon from './icons/GlobeIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import DnaIcon from './icons/DnaIcon';
import PatentIcon from './icons/PatentIcon';
import FlaskIcon from './icons/FlaskIcon';
import ScaleIcon from './icons/ScaleIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import ChartPieIcon from './icons/ChartPieIcon';
import TargetIcon from './icons/TargetIcon';
import MoleculeViewer from './MoleculeViewer';
import RoadmapTimeline from './RoadmapTimeline';
import RiskBenefitChart from './RiskBenefitChart';

const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({
  title,
  children,
  icon,
}) => (
  <div className="relative mt-8">
    <div className="flex items-center gap-4">
      {icon}
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
    </div>
    <div className="mt-3 pl-11 space-y-3 text-slate-600 border-l-2 border-slate-200 ml-3.5">
      <div className="pl-6">{children}</div>
    </div>
  </div>
);

const StrategyComparisonMatrix: React.FC<{
  strategies: TreatmentStrategy[];
  t: (k: string) => string;
}> = ({ strategies, t }) => (
  <div className="overflow-x-auto bg-slate-50 p-2 rounded-lg">
    <table className="w-full text-sm text-left text-slate-600">
      <thead className="text-xs text-slate-800 uppercase bg-slate-100">
        <tr>
          <th className="px-4 py-3 rounded-l-lg">{t('research_col_strategy')}</th>
          <th className="px-4 py-3">{t('research_col_evidence')}</th>
          <th className="px-4 py-3">{t('research_col_risk')}</th>
          <th className="px-4 py-3">{t('research_col_benefit')}</th>
          <th className="px-4 py-3 rounded-r-lg">{t('research_col_target')}</th>
        </tr>
      </thead>
      <tbody>
        {strategies.map((s, i) => (
          <tr key={i} className="border-b border-slate-200">
            <th className="px-4 py-4 font-medium text-slate-900 whitespace-nowrap">{s.name}</th>
            <td className="px-4 py-4">{s.evidence}</td>
            <td
              className={`px-4 py-4 font-bold ${
                s.riskBenefit?.risk?.startsWith('High') || s.riskBenefit?.risk?.startsWith('Very')
                  ? 'text-red-500'
                  : 'text-amber-500'
              }`}
            >
              {s.riskBenefit?.risk || '—'}
            </td>
            <td
              className={`px-4 py-4 font-bold ${
                s.riskBenefit?.benefit === 'Breakthrough' ? 'text-green-500' : 'text-blue-500'
              }`}
            >
              {s.riskBenefit?.benefit || '—'}
            </td>
            <td className="px-4 py-4 truncate">{s.molecularTarget?.name || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ResearchReportCard: React.FC<{ report: ResearchReport }> = ({ report }) => {
  const { t } = useTranslation();
  const noData = t('research_no_data');

  return (
    <div className="animate-fade-in-up mt-4">
      <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-cyan-600 mb-6 pb-4 border-b-2 border-slate-200">
        {t('research_report_title')}: {report.diseaseName}
      </h2>

      <div className="space-y-2">
        <Section title={t('research_section_summary')} icon={<DocumentTextIcon />}>
          <p className="text-base text-slate-800 leading-relaxed">
            <LinkifiedText text={report.summary} />
          </p>
        </Section>

        <Section title={t('research_section_epidemiology')} icon={<ChartPieIcon />}>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
            <div>
              <h4 className="font-semibold text-slate-800">{t('research_epidemiology')}:</h4>
              <ul className="list-disc list-inside mt-1 text-sm">
                <li>
                  <span className="font-bold">{t('research_prevalence')}:</span>{' '}
                  {report.epidemiology?.prevalence || noData}
                </li>
                <li>
                  <span className="font-bold">{t('research_incidence')}:</span>{' '}
                  {report.epidemiology?.incidence || noData}
                </li>
                <li>
                  <span className="font-bold">{t('research_risk_factors')}:</span>{' '}
                  {(report.epidemiology?.keyRiskFactors || []).join(', ') || noData}
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">{t('research_pathophysiology')}:</h4>
              <p className="text-sm mt-1">{report.pathophysiology || noData}</p>
            </div>
          </div>
        </Section>

        <Section title={t('research_section_biomarkers')} icon={<TargetIcon />}>
          <div className="space-y-3">
            {(report.emergingBiomarkers || []).map((marker, index) => (
              <div key={index} className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">
                  {marker.name}{' '}
                  <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full align-middle">
                    {marker.type}
                  </span>
                </p>
                <p className="text-sm text-slate-600 mt-1">{marker.description}</p>
              </div>
            ))}
            {(!report.emergingBiomarkers || report.emergingBiomarkers.length === 0) && (
              <p className="text-sm text-slate-500">{t('research_no_biomarkers')}</p>
            )}
          </div>
        </Section>

        {report.clinicalGuidelines && report.clinicalGuidelines.length > 0 && (
          <Section title={t('research_section_guidelines')} icon={<DocumentTextIcon />}>
            <div className="space-y-6">
              {report.clinicalGuidelines.map((guideline, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-lg text-slate-900">{guideline.guidelineTitle}</h4>
                  <p className="text-sm text-slate-500 font-semibold">
                    {t('research_source')}: {guideline.source}
                  </p>
                  <div className="mt-3 space-y-2">
                    {guideline.recommendations.map((rec, recIndex) => (
                      <div key={recIndex}>
                        <h5 className="font-semibold text-slate-800">{rec.category}</h5>
                        <ul className="list-disc list-inside text-sm text-slate-600 pl-2">
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

        {(report.potentialStrategies || []).length > 0 && (
          <>
            <Section title={t('research_section_matrix')} icon={<ChartBarIcon />}>
              <StrategyComparisonMatrix strategies={report.potentialStrategies || []} t={t} />
            </Section>

            <Section title={t('research_section_risk_benefit')} icon={<ScaleIcon />}>
              <RiskBenefitChart strategies={report.potentialStrategies || []} />
            </Section>
          </>
        )}

        <Section
          title={t('research_section_strategies')}
          icon={<LightBulbIcon className="h-7 w-7 text-violet-600" />}
        >
          {(report.potentialStrategies || []).length > 0 ? (
            <div className="space-y-8">
              {(report.potentialStrategies || []).map((strategy, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-xl text-slate-900">
                    {index + 1}. {strategy.name}
                  </h4>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MoleculeViewer target={strategy.molecularTarget} />
                    <div>
                      <h5 className="font-semibold text-slate-600">{t('research_mechanism')}:</h5>
                      <p className="text-sm text-slate-800 mt-1">{strategy.mechanism}</p>
                      {strategy.evidence && (
                        <>
                          <h5 className="font-semibold text-slate-600 mt-3">{t('research_col_evidence')}:</h5>
                          <p className="text-sm text-slate-800">{strategy.evidence}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-6">
                    <h5 className="font-semibold text-slate-600 mb-2">{t('research_roadmap')}:</h5>
                    <RoadmapTimeline roadmap={strategy.developmentRoadmap} />
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h5 className="font-semibold text-green-600">{t('research_pros')}:</h5>
                      <ul className="list-none space-y-1 mt-1">
                        {strategy.pros.map((pro, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-green-500">+</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-red-600">{t('research_cons')}:</h5>
                      <ul className="list-none space-y-1 mt-1">
                        {strategy.cons.map((con, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-500">-</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('research_no_strategies')}</p>
          )}
        </Section>

        <Section title={t('research_section_pharmacogenomics')} icon={<DnaIcon />}>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-slate-800">{t('research_genes')}:</h4>
              <ul className="list-disc list-inside mt-1">
                {(report.pharmacogenomics?.relevantGenes || []).map((g, i) => (
                  <li key={i}>
                    <span className="font-bold">
                      {g.gene} ({g.mutation}):
                    </span>{' '}
                    {g.impact}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">{t('research_target_subgroup')}:</h4>
              <p>{report.pharmacogenomics?.targetSubgroup || noData}</p>
            </div>
          </div>
        </Section>

        <Section title={t('research_section_patents')} icon={<PatentIcon />}>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-slate-800">{t('research_competing_patents')}:</h4>
              <ul className="list-disc list-inside mt-1">
                {(report.patentLandscape?.competingPatents || []).map((p, i) => (
                  <li key={i}>
                    <span className="font-bold">{p.patentId}</span> ({p.assignee}): {p.title}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">{t('research_whitespace')}:</h4>
              <ul className="list-disc list-inside mt-1">
                {(report.patentLandscape?.whitespaceOpportunities || []).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title={t('research_section_trials')} icon={<FlaskIcon />}>
          <ul className="list-disc list-inside space-y-2 text-sm">
            {(report.relatedClinicalTrials || []).map((trial, i) => (
              <li key={i}>
                {trial.url ? (
                  <a
                    href={trial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 hover:underline font-medium"
                  >
                    <span className="font-bold">{trial.trialId}</span> — {trial.title}
                  </a>
                ) : (
                  <span>
                    <span className="font-bold">{trial.trialId}</span> — {trial.title}
                  </span>
                )}
                <span className="italic text-slate-500 ml-1">({trial.status})</span>
              </li>
            ))}
            {!report.relatedClinicalTrials?.length && (
              <li className="list-none text-slate-500">{t('research_no_trials')}</li>
            )}
          </ul>
        </Section>

        <Section title={t('research_section_conclusion')} icon={<ShieldCheckIcon />}>
          <p className="text-base text-slate-800 leading-relaxed">
            <LinkifiedText text={report.strategicConclusion} />
          </p>
        </Section>

        {report.sources && report.sources.length > 0 && (
          <Section title={t('research_section_sources')} icon={<GlobeIcon />}>
            <ul className="space-y-2">
              {report.sources.map((source, index) => (
                <li key={index} className="text-sm">
                  <a
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 hover:underline break-all"
                    title={source.title}
                  >
                    {source.title || source.uri}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <p className="mt-8 text-[11px] text-slate-400 italic">{t('research_disclaimer')}</p>
    </div>
  );
};

export default ResearchReportCard;
