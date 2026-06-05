import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { AnalysisRecord, PatientEducationTopic } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { SeverityBadge } from './report/RiskFactorsCard';
import LinkifiedText from './common/LinkifiedText';
import SpinnerIcon from './icons/SpinnerIcon';
import { generatePatientEducationContent } from '../services/aiCouncilService';

type PortalTab = 'overview' | 'results' | 'medications' | 'reminders' | 'education';

interface PatientPortalViewProps {
  analyses: AnalysisRecord[];
  onStartConsultation?: () => void;
}

const URGENT_SYMPTOMS = [
  'portal_symptom_chest_pain',
  'portal_symptom_breathing',
  'portal_symptom_bleeding',
  'portal_symptom_consciousness',
  'portal_symptom_severe_pain',
] as const;

function formatPlanItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    return String(o.step ?? o.action ?? o.description ?? o.text ?? JSON.stringify(item));
  }
  return String(item);
}

function patientDisplayName(record: AnalysisRecord): string {
  const pd = record.patientData;
  return `${pd.firstName} ${pd.lastName}`.trim() || '—';
}

const StatCard: React.FC<{ icon: string; label: string; value: string; accent?: string }> = ({
  icon,
  label,
  value,
  accent = 'border-slate-200 bg-white',
}) => (
  <div className={`p-4 rounded-xl border ${accent}`}>
    <p className="text-xl">{icon}</p>
    <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2">{label}</p>
    <p className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2">{value}</p>
  </div>
);

const PatientPortalView: React.FC<PatientPortalViewProps> = ({ analyses, onStartConsultation }) => {
  const { t, language } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(analyses[0]?.id ?? null);
  const [tab, setTab] = useState<PortalTab>('overview');
  const [symptomText, setSymptomText] = useState('');
  const [urgentFlags, setUrgentFlags] = useState<Record<string, boolean>>({});
  const [education, setEducation] = useState<PatientEducationTopic[]>([]);
  const [eduLoading, setEduLoading] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);

  const selected = useMemo(
    () => analyses.find((a) => a.id === selectedId) ?? analyses[0] ?? null,
    [analyses, selectedId],
  );

  const report = selected?.finalReport;
  const diagnoses = useMemo(
    () => normalizeConsensusDiagnosis(report?.consensusDiagnosis),
    [report?.consensusDiagnosis],
  );

  const meds = report?.medicationRecommendations ?? [];
  const tests = report?.recommendedTests ?? [];
  const hasUrgentSymptom = Object.values(urgentFlags).some(Boolean);

  const reminders = useMemo(() => {
    const items: { id: string; title: string; detail: string; type: 'followup' | 'screening' | 'medication' }[] = [];
    if (report?.patientRouting?.followUpTimeline) {
      items.push({
        id: 'followup',
        title: t('portal_reminder_followup'),
        detail: report.patientRouting.followUpTimeline,
        type: 'followup',
      });
    }
    (report?.checkUpRecommendations ?? []).forEach((c, i) => {
      items.push({
        id: `screen-${i}`,
        title: c.screeningName,
        detail: c.frequency || c.reason || '',
        type: 'screening',
      });
    });
    meds.forEach((m, i) => {
      if (m.duration || m.frequency) {
        items.push({
          id: `med-${i}`,
          title: m.name,
          detail: [m.frequency, m.duration, m.timing].filter(Boolean).join(' · '),
          type: 'medication',
        });
      }
    });
    return items;
  }, [report, meds, t]);

  const loadEducation = useCallback(async () => {
    if (!report || education.length > 0) return;
    setEduLoading(true);
    setEduError(null);
    try {
      const topics = await generatePatientEducationContent(report, language);
      setEducation(topics);
    } catch {
      setEduError(t('patient_education_load_error'));
    } finally {
      setEduLoading(false);
    }
  }, [report, education.length, language, t]);

  useEffect(() => {
    if (tab === 'education' && report) {
      void loadEducation();
    }
  }, [tab, report, loadEducation]);

  useEffect(() => {
    setEducation([]);
    setEduError(null);
  }, [selectedId]);

  const tabs: { key: PortalTab; label: string; badge?: number }[] = [
    { key: 'overview', label: t('portal_tab_overview') },
    { key: 'results', label: t('portal_tab_results'), badge: diagnoses.length || undefined },
    { key: 'medications', label: t('portal_tab_medications'), badge: meds.length || undefined },
    { key: 'reminders', label: t('portal_tab_reminders'), badge: reminders.length || undefined },
    { key: 'education', label: t('portal_tab_education') },
  ];

  if (!analyses.length) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 mx-auto rounded-full bg-teal-100 flex items-center justify-center text-4xl">🏥</div>
        <h3 className="text-xl font-bold text-slate-800">{t('portal_empty_title')}</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">{t('portal_empty_desc')}</p>
        {onStartConsultation && (
          <button
            type="button"
            onClick={onStartConsultation}
            className="px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700"
          >
            {t('portal_start_consultation')}
          </button>
        )}
        <p className="text-xs text-slate-400">{t('patient_portal_disclaimer')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">{t('patient_portal_intro')}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
        >
          {t('portal_print_summary')}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="🩺"
          label={t('portal_stat_diagnosis')}
          value={diagnoses[0]?.name ?? t('portal_stat_pending')}
          accent="border-teal-200 bg-teal-50/50"
        />
        <StatCard
          icon="💊"
          label={t('portal_stat_medications')}
          value={meds.length ? String(meds.length) : '—'}
        />
        <StatCard
          icon="🔬"
          label={t('portal_stat_tests')}
          value={tests.length ? String(tests.length) : '—'}
        />
        <StatCard
          icon="📅"
          label={t('portal_stat_followup')}
          value={report?.patientRouting?.followUpTimeline?.slice(0, 40) ?? '—'}
          accent="border-blue-200 bg-blue-50/50"
        />
      </div>

      {analyses.length > 1 && (
        <div className="glass-panel p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">{t('portal_visit_history')}</p>
          <div className="flex flex-wrap gap-2">
            {analyses.slice(0, 10).map((rec) => {
              const name = patientDisplayName(rec);
              const active = selected?.id === rec.id;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedId(rec.id)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    active
                      ? 'border-teal-500 bg-teal-50 text-teal-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                  }`}
                >
                  <span className="block font-medium">{name}</span>
                  <span className="text-[10px] opacity-70">{new Date(rec.date).toLocaleDateString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(report?.severityAssessment?.level === 'critical' || report?.severityAssessment?.level === 'urgent' || (report?.clinicalRedFlags?.length ?? 0) > 0) && (
        <div className="p-4 rounded-xl border-2 border-red-300 bg-red-50">
          <h4 className="font-bold text-red-800 flex items-center gap-2">
            <span>⚠</span> {t('portal_urgent_alert_title')}
          </h4>
          {report?.severityAssessment && <div className="mt-2"><SeverityBadge assessment={report.severityAssessment} /></div>}
          <ul className="mt-2 text-sm text-red-900 list-disc list-inside">
            {(report?.clinicalRedFlags ?? []).slice(0, 4).map((f, i) => (
              <li key={i}>{f.message || f.code}</li>
            ))}
            {(report?.severityAssessment?.redFlags ?? []).map((f, i) => (
              <li key={`rf-${i}`}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700 font-semibold">{t('portal_urgent_alert_action')}</p>
        </div>
      )}

      <div className="glass-panel p-5 print:hidden">
        <h3 className="font-bold text-slate-800">{t('portal_symptom_check_title')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('portal_symptom_check_desc')}</p>
        <textarea
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          className="mt-3 w-full common-input min-h-[72px] text-sm"
          placeholder={t('portal_symptom_placeholder')}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {URGENT_SYMPTOMS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setUrgentFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                urgentFlags[key]
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
        {(hasUrgentSymptom || symptomText.toLowerCase().includes('og\'riq') || symptomText.toLowerCase().includes('nafas')) && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            <p className="font-bold">{t('portal_symptom_urgent_title')}</p>
            <p className="mt-1">{t('portal_symptom_urgent_body')}</p>
          </div>
        )}
        {!hasUrgentSymptom && symptomText.trim() && (
          <p className="mt-3 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">{t('portal_symptom_mild_advice')}</p>
        )}
      </div>

      {selected && (
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-cyan-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{patientDisplayName(selected)}</h3>
                <p className="text-sm text-slate-500">
                  {t('patient_portal_last_visit')}: {new Date(selected.date).toLocaleString()}
                </p>
                {selected.patientData.complaints && (
                  <p className="text-sm text-slate-600 mt-1">
                    <span className="font-semibold">{t('portal_complaints')}:</span> {selected.patientData.complaints}
                  </p>
                )}
              </div>
              {report?.severityAssessment && <SeverityBadge assessment={report.severityAssessment} />}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 bg-slate-50/80 print:hidden">
            {tabs.map(({ key, label, badge }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tab === key ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {label}
                {badge != null && badge > 0 && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab === key ? 'bg-white/20' : 'bg-teal-100 text-teal-700'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {tab === 'overview' && (
              <>
                {report?.patientRouting && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('routing_title')}</h4>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      {report.patientRouting.disposition && (
                        <div className="p-3 rounded-lg bg-slate-50 border">
                          <p className="text-xs text-slate-500">{t('routing_disposition')}</p>
                          <p className="font-semibold text-slate-800">
                            {({
                              outpatient: t('routing_outpatient'),
                              observation: t('routing_observation'),
                              inpatient: t('routing_inpatient'),
                              emergency: t('routing_emergency'),
                            } as Record<string, string>)[report.patientRouting.disposition!] ?? report.patientRouting.disposition}
                          </p>
                          {report.patientRouting.dispositionReason && (
                            <p className="text-slate-600 mt-1">{report.patientRouting.dispositionReason}</p>
                          )}
                        </div>
                      )}
                      {report.patientRouting.hospitalizationIndicated && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="font-semibold text-amber-900">{t('routing_hospitalization')}</p>
                          <p className="text-amber-800 text-xs mt-1">
                            {report.patientRouting.hospitalizationReason || t('routing_hospitalization_default')}
                          </p>
                        </div>
                      )}
                    </div>
                    {(report.patientRouting.recommendedSpecialists?.length ?? 0) > 0 && (
                      <ul className="mt-3 space-y-2">
                        {report.patientRouting.recommendedSpecialists!.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-100 text-sm">
                            <span className="text-cyan-600 font-bold">→</span>
                            <div>
                              <p className="font-semibold text-slate-900">{s.specialty}</p>
                              <p className="text-slate-600">{s.reason}</p>
                              {s.urgency === 'urgent' && (
                                <span className="text-[10px] font-bold text-red-600 uppercase">{t('routing_urgent')}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {(report?.treatmentPlan?.length ?? 0) > 0 && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('patient_portal_recommendations')}</h4>
                    <ol className="space-y-2">
                      {report!.treatmentPlan.map((item, i) => (
                        <li key={i} className="flex gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-slate-800">{formatPlanItem(item)}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {report?.nutritionPrevention?.dietaryGuidelines && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('final_report_nutrition_title')}</h4>
                    <ul className="space-y-1.5 text-sm">
                      {report.nutritionPrevention.dietaryGuidelines.map((d, i) => (
                        <li key={i} className="flex gap-2 p-2 rounded-lg bg-green-50">
                          <span className="text-green-600">✓</span> {d}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {(report?.riskFactors?.length ?? 0) > 0 && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('risk_factors_title')}</h4>
                    <ul className="space-y-2 text-sm">
                      {report!.riskFactors!.map((r, i) => (
                        <li key={i} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                          <span className="font-semibold">{r.factor}</span>
                          {r.mitigation && <p className="text-slate-600 mt-0.5">{r.mitigation}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {tab === 'results' && (
              <>
                {diagnoses.length > 0 && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('portal_results_diagnosis')}</h4>
                    <div className="space-y-2">
                      {diagnoses.map((d, i) => (
                        <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-bold text-slate-900">{d.name}</p>
                            {d.probability != null && (
                              <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-800">
                                {d.probability}%
                              </span>
                            )}
                          </div>
                          {d.justification && (
                            <p className="text-sm text-slate-600 mt-2">{d.justification}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {tests.length > 0 && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('patient_portal_tests')}</h4>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {tests.map((test, i) => (
                        <li key={i} className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-sm font-medium text-slate-800">
                          🔬 {typeof test === 'string' ? test : String(test)}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {report?.patientRouting?.examPlan && report.patientRouting.examPlan.length > 0 && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('routing_exam_plan')}</h4>
                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                      {report.patientRouting.examPlan.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {selected.patientData.labResults && (
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">{t('portal_lab_results')}</h4>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-lg">
                      {selected.patientData.labResults}
                    </p>
                  </section>
                )}
              </>
            )}

            {tab === 'medications' && (
              <>
                {meds.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">{t('portal_no_medications')}</p>
                ) : (
                  <div className="space-y-4">
                    {meds.map((m, i) => (
                      <div key={i} className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                        <p className="font-bold text-lg text-slate-900">{m.name}</p>
                        <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
                          {m.dosage && (
                            <p><span className="text-slate-500">{t('portal_med_dose')}:</span> <strong>{m.dosage}</strong></p>
                          )}
                          {m.frequency && (
                            <p><span className="text-slate-500">{t('portal_med_frequency')}:</span> {m.frequency}</p>
                          )}
                          {m.timing && (
                            <p><span className="text-slate-500">{t('portal_med_timing')}:</span> {m.timing}</p>
                          )}
                          {m.duration && (
                            <p><span className="text-slate-500">{t('portal_med_duration')}:</span> {m.duration}</p>
                          )}
                        </div>
                        {m.instructions && <p className="text-sm mt-2 text-slate-700">{m.instructions}</p>}
                        {m.notes && <p className="text-sm mt-1 text-slate-600 italic">{m.notes}</p>}
                        {m.localAvailability && (
                          <p className="text-xs mt-2 text-emerald-700 font-medium">📍 {m.localAvailability}</p>
                        )}
                        {m.priceEstimate && (
                          <p className="text-xs text-slate-500 mt-1">💰 {m.priceEstimate}</p>
                        )}
                        {(m.adverseEffects?.length ?? 0) > 0 && (
                          <div className="mt-3 p-2 rounded-lg bg-amber-50 text-xs text-amber-900">
                            <span className="font-semibold">{t('portal_med_side_effects')}:</span>{' '}
                            {m.adverseEffects!.join('; ')}
                          </div>
                        )}
                        {m.contraindications && (
                          <p className="text-xs mt-2 text-red-700">
                            <span className="font-semibold">{t('portal_med_contraindications')}:</span> {m.contraindications}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(report?.pharmacologyWarnings?.length ?? 0) > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                    <p className="font-bold text-amber-900">{t('portal_pharm_warnings')}</p>
                    <ul className="mt-1 list-disc list-inside text-amber-800">
                      {report!.pharmacologyWarnings!.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {tab === 'reminders' && (
              <>
                {reminders.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">{t('portal_no_reminders')}</p>
                ) : (
                  <div className="space-y-3">
                    {reminders.map((r) => (
                      <div
                        key={r.id}
                        className={`p-4 rounded-xl border flex gap-3 ${
                          r.type === 'followup'
                            ? 'border-blue-200 bg-blue-50'
                            : r.type === 'medication'
                              ? 'border-violet-200 bg-violet-50'
                              : 'border-teal-200 bg-teal-50'
                        }`}
                      >
                        <span className="text-2xl">
                          {r.type === 'followup' ? '📅' : r.type === 'medication' ? '💊' : '🔍'}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{r.title}</p>
                          {r.detail && <p className="text-sm text-slate-600 mt-0.5">{r.detail}</p>}
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">
                            {r.type === 'followup'
                              ? t('portal_reminder_type_followup')
                              : r.type === 'medication'
                                ? t('portal_reminder_type_med')
                                : t('portal_reminder_type_screening')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {report?.checkUpRecommendations && report.checkUpRecommendations.length > 0 && (
                  <section className="mt-4">
                    <h4 className="font-bold text-slate-800 mb-2">{t('final_report_checkup_title')}</h4>
                    <ul className="space-y-2 text-sm">
                      {report.checkUpRecommendations.map((c, i) => (
                        <li key={i} className="p-3 rounded-lg bg-slate-50 border">
                          <p className="font-semibold">{c.screeningName}</p>
                          {c.frequency && <p className="text-slate-500">{c.frequency}</p>}
                          {c.reason && <p className="text-slate-600 mt-1">{c.reason}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {tab === 'education' && (
              <>
                {eduLoading && (
                  <div className="text-center py-8">
                    <SpinnerIcon className="w-8 h-8 mx-auto animate-spin text-teal-600" />
                    <p className="text-sm text-slate-500 mt-2">{t('portal_education_loading')}</p>
                  </div>
                )}
                {eduError && <p className="text-sm text-red-600">{eduError}</p>}
                {!eduLoading && !eduError && education.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">{t('patient_education_subtitle')}</p>
                    {education.map((topic, i) => (
                      <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
                        <h3 className="font-bold text-slate-800">{topic.title}</h3>
                        <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                          <LinkifiedText text={topic.content} />
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {!eduLoading && !eduError && education.length === 0 && (
                  <button
                    type="button"
                    onClick={() => void loadEducation()}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold"
                  >
                    {t('portal_education_load_btn')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {selected?.followUpHistory && selected.followUpHistory.length > 0 && (
        <div className="glass-panel p-4">
          <h4 className="font-bold text-slate-800 mb-3">{t('portal_qa_history')}</h4>
          <div className="space-y-3">
            {selected.followUpHistory.map((fq, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 border text-sm">
                <p className="font-semibold text-slate-800">Q: {fq.question}</p>
                <p className="text-slate-600 mt-1">A: {fq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 italic">{t('patient_portal_disclaimer')}</p>
    </div>
  );
};

export default PatientPortalView;
