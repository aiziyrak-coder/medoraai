import React from 'react';
import type { AnalysisRecord } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { SeverityBadge } from './report/RiskFactorsCard';

interface PatientPortalViewProps {
  analyses: AnalysisRecord[];
}

const PatientPortalView: React.FC<PatientPortalViewProps> = ({ analyses }) => {
  const { t } = useTranslation();
  const latest = analyses[0];
  const report = latest?.finalReport;
  const diagnoses = normalizeConsensusDiagnosis(report?.consensusDiagnosis);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <p className="text-sm text-slate-600">{t('patient_portal_intro')}</p>

      <div className="glass-panel p-4 space-y-3">
        <h3 className="font-bold text-slate-800">{t('patient_portal_symptoms_title')}</h3>
        <p className="text-sm text-slate-600">{t('patient_portal_symptoms_hint')}</p>
      </div>

      {latest ? (
        <div className="glass-panel p-4 space-y-4">
          <h3 className="font-bold text-slate-800">{t('patient_portal_last_visit')}</h3>
          <p className="text-sm text-slate-500">{new Date(latest.date).toLocaleDateString()}</p>

          {report?.severityAssessment && (
            <div>
              <SeverityBadge assessment={report.severityAssessment} />
            </div>
          )}

          {diagnoses[0] && (
            <p className="text-sm">
              <span className="font-semibold">{t('docx_diagnosis')}:</span> {diagnoses[0].name}
            </p>
          )}

          {report?.patientRouting?.recommendedSpecialists && report.patientRouting.recommendedSpecialists.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700">{t('routing_specialists')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                {report.patientRouting.recommendedSpecialists.slice(0, 4).map((s, i) => (
                  <li key={i}>{s.specialty}: {s.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {report?.treatmentPlan && report.treatmentPlan.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700">{t('patient_portal_recommendations')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                {report.treatmentPlan.slice(0, 5).map((s, i) => (
                  <li key={i}>{typeof s === 'string' ? s : JSON.stringify(s)}</li>
                ))}
              </ul>
            </div>
          )}

          {report?.recommendedTests && report.recommendedTests.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700">{t('patient_portal_tests')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                {report.recommendedTests.slice(0, 5).map((test, i) => (
                  <li key={i}>{typeof test === 'string' ? test : String(test)}</li>
                ))}
              </ul>
            </div>
          )}

          {report?.checkUpRecommendations && report.checkUpRecommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700">{t('final_report_checkup_title')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                {report.checkUpRecommendations.slice(0, 4).map((c, i) => (
                  <li key={i}>{c.screeningName}{c.frequency ? ` — ${c.frequency}` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {report?.riskFactors && report.riskFactors.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700">{t('risk_factors_title')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                {report.riskFactors.slice(0, 4).map((r, i) => (
                  <li key={i}>{r.factor}{r.mitigation ? ` — ${r.mitigation}` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {report?.nutritionPrevention?.dietaryGuidelines && (
            <div>
              <h4 className="text-sm font-bold text-slate-700">{t('final_report_nutrition_title')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 mt-1">
                {report.nutritionPrevention.dietaryGuidelines.slice(0, 4).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {report?.patientRouting?.followUpTimeline && (
            <p className="text-sm p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="font-semibold">{t('patient_portal_reminder')}:</span>{' '}
              {report.patientRouting.followUpTimeline}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">{t('patient_portal_no_data')}</p>
      )}

      <p className="text-xs text-slate-400">{t('patient_portal_disclaimer')}</p>
    </div>
  );
};

export default PatientPortalView;
