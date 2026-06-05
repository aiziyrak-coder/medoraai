import React from 'react';
import type { PatientRouting } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

const PatientRoutingCard: React.FC<{ routing?: PatientRouting }> = ({ routing }) => {
  const { t } = useTranslation();
  if (!routing) return null;
  const hasContent =
    (routing.recommendedSpecialists?.length ?? 0) > 0 ||
    (routing.examPlan?.length ?? 0) > 0 ||
    routing.disposition ||
    routing.hospitalizationIndicated;
  if (!hasContent) return null;

  const dispositionLabel: Record<string, string> = {
    outpatient: t('routing_outpatient'),
    observation: t('routing_observation'),
    inpatient: t('routing_inpatient'),
    emergency: t('routing_emergency'),
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden">
      <div className="px-4 py-3 bg-indigo-100/80 border-b border-indigo-200">
        <h3 className="text-base font-bold text-indigo-900">{t('routing_title')}</h3>
      </div>
      <div className="p-4 space-y-3 text-sm">
        {routing.disposition && (
          <p>
            <span className="font-semibold">{t('routing_disposition')}:</span>{' '}
            {dispositionLabel[routing.disposition] || routing.disposition}
            {routing.dispositionReason ? ` — ${routing.dispositionReason}` : ''}
          </p>
        )}
        {routing.hospitalizationIndicated && (
          <p className="text-red-800 font-medium">
            {t('routing_hospitalization')}: {routing.hospitalizationReason || t('routing_hospitalization_default')}
          </p>
        )}
        {routing.recommendedSpecialists && routing.recommendedSpecialists.length > 0 && (
          <div>
            <p className="font-semibold text-slate-800 mb-1">{t('routing_specialists')}</p>
            <ul className="list-disc list-inside space-y-1">
              {routing.recommendedSpecialists.map((s, i) => (
                <li key={i}>
                  {s.specialty} — {s.reason}
                  {s.urgency === 'urgent' ? ` (${t('routing_urgent')})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {routing.examPlan && routing.examPlan.length > 0 && (
          <div>
            <p className="font-semibold text-slate-800 mb-1">{t('routing_exam_plan')}</p>
            <ul className="list-decimal list-inside space-y-1">
              {routing.examPlan.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        )}
        {routing.followUpTimeline && (
          <p className="text-slate-700">
            <span className="font-semibold">{t('routing_followup')}:</span> {routing.followUpTimeline}
          </p>
        )}
      </div>
    </div>
  );
};

export default PatientRoutingCard;
