import React from 'react';
import type { RiskFactor, SeverityAssessment } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import AlertTriangleIcon from '../icons/AlertTriangleIcon';

export const SeverityBadge: React.FC<{ assessment?: SeverityAssessment }> = ({ assessment }) => {
  const { t } = useTranslation();
  if (!assessment?.level) return null;
  const colors: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    urgent: 'bg-orange-500 text-white',
    moderate: 'bg-amber-400 text-slate-900',
    low: 'bg-emerald-100 text-emerald-800',
  };
  const labels: Record<string, string> = {
    critical: t('severity_critical'),
    urgent: t('severity_urgent'),
    moderate: t('severity_moderate'),
    low: t('severity_low'),
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${colors[assessment.level] || colors.moderate}`}>
      <AlertTriangleIcon className="w-4 h-4" />
      {t('severity_label')}: {labels[assessment.level] || assessment.level}
      {assessment.score != null ? ` (${assessment.score}/10)` : ''}
    </div>
  );
};

const RiskFactorsCard: React.FC<{
  riskFactors?: RiskFactor[];
  severityAssessment?: SeverityAssessment;
}> = ({ riskFactors, severityAssessment }) => {
  const { t } = useTranslation();
  const hasRisks = (riskFactors?.length ?? 0) > 0;
  const hasSeverity = !!severityAssessment?.level;
  if (!hasRisks && !hasSeverity) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
      <div className="px-4 py-3 bg-amber-100/80 border-b border-amber-200 flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold text-amber-900">{t('risk_factors_title')}</h3>
        <SeverityBadge assessment={severityAssessment} />
      </div>
      <div className="p-4 space-y-3 text-sm">
        {severityAssessment?.rationale && (
          <p className="text-slate-700">{severityAssessment.rationale}</p>
        )}
        {severityAssessment?.redFlags && severityAssessment.redFlags.length > 0 && (
          <ul className="list-disc list-inside text-red-800">
            {severityAssessment.redFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
        {hasRisks && (
          <ul className="space-y-2">
            {riskFactors!.map((r, i) => (
              <li key={i} className="p-2 bg-white rounded border border-amber-100">
                <span className="font-semibold">{r.factor}</span>
                {r.severity && <span className="text-xs ml-2 text-amber-700">({r.severity})</span>}
                {r.mitigation && <p className="text-slate-600 mt-1">{r.mitigation}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RiskFactorsCard;
