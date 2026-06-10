import React, { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import {
  runDoctorSupport,
  TASK_PRESCRIPTION_AUDIT,
  type DoctorSupportResult,
} from '../services/apiAiService';
import { calculateBmi } from '../utils/bmi';
import SpinnerIcon from './icons/SpinnerIcon';

interface MedicationRow {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

const emptyMed = (): MedicationRow => ({ name: '', dosage: '', frequency: '', duration: '' });

const inputCls =
  'w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/60';

const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';

function verdictColor(v: string): string {
  const u = v.toUpperCase();
  if (u.includes('COMPLIANT') || u.includes('APPROPRIATE') || u.includes('MATCH') || u.includes('CORRECT') || u.includes('CONTINUE')) {
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  }
  if (u.includes('PARTIAL') || u.includes('CAUTION') || u.includes('ADJUST') || u.includes('UNCLEAR')) {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }
  return 'text-red-700 bg-red-50 border-red-200';
}

function AuditResults({ result }: { result: DoctorSupportResult }) {
  const { t } = useTranslation();

  if (result.error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
        {result.error}
      </div>
    );
  }

  const dx = result.diagnosis_analysis;
  const compliance = result.protocol_compliance;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {result.critical_alert?.present && (
        <div className="rounded-2xl bg-red-50 border border-red-300 p-4">
          <p className="font-bold text-red-700">{t('prescription_audit_critical')}</p>
          <p className="text-red-600 text-sm mt-1">{result.critical_alert.message}</p>
        </div>
      )}

      {result.critical_alerts && result.critical_alerts.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <p className="font-bold text-red-700 mb-2">{t('prescription_audit_critical')}</p>
          <ul className="space-y-1">
            {result.critical_alerts.map((a, i) => (
              <li key={i} className="text-red-600 text-sm">• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {compliance && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h3 className="text-lg font-bold text-slate-800">{t('prescription_audit_protocol_compliance')}</h3>
            {compliance.score != null && (
              <span className="text-2xl font-black text-amber-600">{compliance.score}%</span>
            )}
            {compliance.verdict && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verdictColor(compliance.verdict)}`}>
                {compliance.verdict}
              </span>
            )}
          </div>
          {compliance.summary && <p className="text-slate-600 text-sm">{compliance.summary}</p>}
          {compliance.gaps && compliance.gaps.length > 0 && (
            <div className="mt-4 space-y-2">
              {compliance.gaps.map((g, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                  <p className="font-semibold text-slate-800">{g.gap}</p>
                  {g.protocol && <p className="text-amber-700 text-xs mt-1">{g.protocol}</p>}
                  {g.recommendation && <p className="text-slate-600 text-xs mt-1">{g.recommendation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dx && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h3 className="text-lg font-bold text-slate-800">{t('prescription_audit_diagnosis_section')}</h3>
            {dx.overall_assessment && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verdictColor(dx.overall_assessment)}`}>
                {dx.overall_assessment}
              </span>
            )}
          </div>
          {dx.assessment_summary && <p className="text-slate-600 text-sm mb-3">{dx.assessment_summary}</p>}
          {dx.protocol_reference && (
            <p className="text-sm text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-3">
              <span className="font-semibold">{t('prescription_audit_protocol_ref')}: </span>
              {dx.protocol_reference}
            </p>
          )}
          {dx.concerns && dx.concerns.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">{t('prescription_audit_concerns')}</p>
              {dx.concerns.map((c, i) => <p key={i} className="text-sm text-slate-600">• {c}</p>)}
            </div>
          )}
          {dx.missing_workup && dx.missing_workup.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">{t('prescription_audit_missing_workup')}</p>
              {dx.missing_workup.map((w, i) => <p key={i} className="text-sm text-slate-600">• {w}</p>)}
            </div>
          )}
        </div>
      )}

      {result.medications_review && result.medications_review.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{t('prescription_audit_medications_section')}</h3>
          <div className="space-y-3">
            {result.medications_review.map((med, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/80">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-bold text-slate-800">{med.name}</span>
                  {med.recommendation && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${verdictColor(med.recommendation)}`}>
                      {med.recommendation}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {[med.prescribed_dose, med.frequency, med.duration].filter(Boolean).join(' · ')}
                </p>
                {med.indication_match && (
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{t('prescription_audit_indication')}: </span>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${verdictColor(med.indication_match)}`}>
                      {med.indication_match}
                    </span>
                    {med.indication_comment && <span className="ml-1">{med.indication_comment}</span>}
                  </p>
                )}
                {med.dose_assessment && (
                  <p className="text-sm text-slate-700 mt-1">
                    <span className="font-semibold">{t('prescription_audit_dose')}: </span>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${verdictColor(med.dose_assessment)}`}>
                      {med.dose_assessment}
                    </span>
                    {med.dose_comment && <span className="ml-1">{med.dose_comment}</span>}
                  </p>
                )}
                {med.protocol_basis && (
                  <p className="text-xs text-sky-700 mt-2 bg-sky-50 border border-sky-100 rounded-lg px-2 py-1.5">
                    {med.protocol_basis}
                  </p>
                )}
                {med.adjustment_suggestion && (
                  <p className="text-xs text-amber-800 mt-2">{med.adjustment_suggestion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.interactions && result.interactions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <h3 className="text-lg font-bold text-amber-900 mb-3">{t('prescription_audit_interactions')}</h3>
          {result.interactions.map((ix, i) => (
            <div key={i} className="mb-2 p-3 rounded-xl bg-white border border-amber-100 text-sm">
              <p className="font-semibold text-slate-800">{ix.drugs?.join(' + ')}</p>
              <p className="text-xs text-amber-700 font-mono">{ix.severity}</p>
              <p className="text-slate-600 text-xs mt-1">{ix.description}</p>
              {ix.action && <p className="text-slate-700 text-xs mt-1 font-medium">{ix.action}</p>}
            </div>
          ))}
        </div>
      )}

      {result.overall_recommendations && result.overall_recommendations.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
          <h3 className="text-lg font-bold text-emerald-900 mb-2">{t('prescription_audit_recommendations')}</h3>
          <ol className="space-y-1">
            {result.overall_recommendations.map((r, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-emerald-600 font-mono shrink-0">{i + 1}.</span> {r}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const PrescriptionProtocolAudit: React.FC = () => {
  const { t, language } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [complaints, setComplaints] = useState('');
  const [history, setHistory] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [labResults, setLabResults] = useState('');
  const [diagnoses, setDiagnoses] = useState<string[]>(['']);
  const [medications, setMedications] = useState<MedicationRow[]>([emptyMed()]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DoctorSupportResult | null>(null);

  const bmiDisplay = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h) return null;
    const bmi = calculateBmi(w, h);
    if (!bmi) return null;
    return `${bmi.value} — ${t(bmi.gradeKey)}`;
  }, [weightKg, heightCm, t]);

  const updateDiagnosis = (idx: number, val: string) => {
    setDiagnoses((prev) => prev.map((d, i) => (i === idx ? val : d)));
  };

  const updateMed = (idx: number, field: keyof MedicationRow, val: string) => {
    setMedications((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  };

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);

    const validDiagnoses = diagnoses.map((d) => d.trim()).filter(Boolean);
    const validMeds = medications.filter((m) => m.name.trim());

    if (validDiagnoses.length === 0) {
      setError(t('prescription_audit_err_diagnoses'));
      return;
    }
    if (validMeds.length === 0) {
      setError(t('prescription_audit_err_medications'));
      return;
    }

    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    const bmi = w && h ? calculateBmi(w, h) : null;

    const patientData = {
      firstName: firstName.trim() || '—',
      lastName: lastName.trim() || '—',
      age: age.trim() || '—',
      gender: gender || '—',
      complaints: complaints.trim() || t('prescription_audit_no_complaints'),
      history: history.trim(),
      allergies: allergies.trim(),
      currentMedications: currentMedications.trim(),
      labResults: labResults.trim(),
      weightKg: w || undefined,
      heightCm: h || undefined,
      bmi: bmi?.value,
      doctorDiagnoses: validDiagnoses,
      prescribedMedications: validMeds,
    };

    setLoading(true);
    try {
      const res = await runDoctorSupport(patientData as never, {
        taskType: TASK_PRESCRIPTION_AUDIT,
        language,
        query: notes.trim(),
      });
      if (!res.success || !res.data) {
        setError(res.error?.message || t('prescription_audit_err_generic'));
        return;
      }
      setResult(res.data);
    } catch {
      setError(t('prescription_audit_err_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full min-w-0 px-4 py-6 space-y-6">
      <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white p-5 shadow-sm">
        <p className="text-xs font-mono font-bold tracking-widest uppercase text-amber-700 mb-1">
          {t('prescription_audit_badge')}
        </p>
        <p className="text-sm text-slate-600">{t('prescription_audit_intro')}</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">{t('prescription_audit_patient_section')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('prescription_audit_first_name')}</label>
            <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_last_name')}</label>
            <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_age')}</label>
            <input className={inputCls} type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_gender')}</label>
            <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">{t('prescription_audit_gender_unknown')}</option>
              <option value="male">{t('prescription_audit_gender_male')}</option>
              <option value="female">{t('prescription_audit_gender_female')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_weight')}</label>
            <input className={inputCls} type="number" min={0} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_height')}</label>
            <input className={inputCls} type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            {bmiDisplay && <p className="text-xs text-emerald-700 mt-1">BMI: {bmiDisplay}</p>}
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('prescription_audit_complaints')}</label>
          <textarea className={`${inputCls} min-h-[72px]`} value={complaints} onChange={(e) => setComplaints(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('prescription_audit_history')}</label>
            <textarea className={`${inputCls} min-h-[72px]`} value={history} onChange={(e) => setHistory(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_allergies')}</label>
            <textarea className={`${inputCls} min-h-[72px]`} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('prescription_audit_current_meds')}</label>
            <textarea className={`${inputCls} min-h-[72px]`} value={currentMedications} onChange={(e) => setCurrentMedications(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('prescription_audit_labs')}</label>
            <textarea className={`${inputCls} min-h-[72px]`} value={labResults} onChange={(e) => setLabResults(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800">{t('prescription_audit_diagnoses_input')}</h2>
          <button
            type="button"
            onClick={() => setDiagnoses((d) => [...d, ''])}
            className="text-xs font-bold text-amber-700 hover:underline"
          >
            + {t('prescription_audit_add')}
          </button>
        </div>
        {diagnoses.map((dx, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              placeholder={t('prescription_audit_diagnosis_placeholder')}
              value={dx}
              onChange={(e) => updateDiagnosis(i, e.target.value)}
            />
            {diagnoses.length > 1 && (
              <button
                type="button"
                onClick={() => setDiagnoses((d) => d.filter((_, j) => j !== i))}
                className="shrink-0 px-3 text-red-500 hover:bg-red-50 rounded-xl border border-red-100"
                aria-label={t('prescription_audit_remove')}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800">{t('prescription_audit_medications_input')}</h2>
          <button
            type="button"
            onClick={() => setMedications((m) => [...m, emptyMed()])}
            className="text-xs font-bold text-amber-700 hover:underline"
          >
            + {t('prescription_audit_add')}
          </button>
        </div>
        {medications.map((med, i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-slate-400">#{i + 1}</span>
              {medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMedications((m) => m.filter((_, j) => j !== i))}
                  className="text-xs text-red-500 hover:underline"
                >
                  {t('prescription_audit_remove')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>{t('prescription_audit_med_name')}</label>
                <input className={inputCls} value={med.name} onChange={(e) => updateMed(i, 'name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t('prescription_audit_med_dose')}</label>
                <input className={inputCls} value={med.dosage} onChange={(e) => updateMed(i, 'dosage', e.target.value)} placeholder="500 mg" />
              </div>
              <div>
                <label className={labelCls}>{t('prescription_audit_med_frequency')}</label>
                <input className={inputCls} value={med.frequency} onChange={(e) => updateMed(i, 'frequency', e.target.value)} placeholder="kuniga 2 marta" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>{t('prescription_audit_med_duration')}</label>
                <input className={inputCls} value={med.duration} onChange={(e) => updateMed(i, 'duration', e.target.value)} placeholder="7 kun" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div>
        <label className={labelCls}>{t('prescription_audit_notes')}</label>
        <textarea className={`${inputCls} min-h-[64px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
        }}
      >
        {loading ? (
          <>
            <SpinnerIcon className="w-5 h-5 animate-spin" />
            {t('prescription_audit_analyzing')}
          </>
        ) : (
          t('prescription_audit_submit')
        )}
      </button>

      {result && <AuditResults result={result} />}
    </div>
  );
};

export default PrescriptionProtocolAudit;
