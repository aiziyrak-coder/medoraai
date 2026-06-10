import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import {
  runDoctorSupport,
  TASK_PRESCRIPTION_AUDIT,
  type DoctorSupportResult,
} from '../services/apiAiService';
import {
  convertPatientToPatientData,
  getPatient,
  passportToPatientData,
  smartSearchPatients,
  type SmartPatientHit,
} from '../services/apiPatientService';
import { getAuthToken } from '../services/api';
import type { PatientData } from '../types';
import { calculateBmi } from '../utils/bmi';
import { formatPatientRegistryId } from '../utils/patientRegistryId';
import SpinnerIcon from './icons/SpinnerIcon';
import SearchIcon from './icons/SearchIcon';

interface MedicationRow {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

const emptyMed = (): MedicationRow => ({ name: '', dosage: '', frequency: '', duration: '' });

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300 shadow-sm';

const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

const sectionCls = 'rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm space-y-4';

function parseVitalsFromObjective(text: string | undefined): { weight?: string; height?: string } {
  const raw = (text || '').replace(/\s+/g, ' ');
  const out: { weight?: string; height?: string } = {};
  const weight = raw.match(/(?:vazn|weight|tana\s*vazni)[:\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i);
  if (weight) out.weight = weight[1].replace(',', '.');
  const height = raw.match(/(?:bo[''`]y|height|рост)[:\s]*(\d{2,3}(?:[.,]\d)?)\s*(?:cm|sm|см)?/i);
  if (height) out.height = height[1].replace(',', '.');
  return out;
}

function verdictColor(v: string): string {
  const u = v.toUpperCase();
  if (u.includes('COMPLIANT') || u.includes('APPROPRIATE') || u.includes('MATCH') || u.includes('CORRECT') || u.includes('CONTINUE')) {
    return 'text-emerald-800 bg-emerald-50 border-emerald-200';
  }
  if (u.includes('PARTIAL') || u.includes('CAUTION') || u.includes('ADJUST') || u.includes('UNCLEAR')) {
    return 'text-amber-800 bg-amber-50 border-amber-200';
  }
  return 'text-red-800 bg-red-50 border-red-200';
}

function AuditResults({ result }: { result: DoctorSupportResult }) {
  const { t } = useTranslation();

  if (result.error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
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
          <p className="font-bold text-red-800">{t('prescription_audit_critical')}</p>
          <p className="text-red-700 text-sm mt-1">{result.critical_alert.message}</p>
        </div>
      )}

      {result.critical_alerts && result.critical_alerts.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <p className="font-bold text-red-800 mb-2">{t('prescription_audit_critical')}</p>
          <ul className="space-y-1">
            {result.critical_alerts.map((a, i) => (
              <li key={i} className="text-red-700 text-sm">• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {compliance && (
        <div className={`${sectionCls}`}>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h3 className="text-lg font-bold text-slate-900">{t('prescription_audit_protocol_compliance')}</h3>
            {compliance.score != null && (
              <span className="text-2xl font-black text-amber-600">{compliance.score}%</span>
            )}
            {compliance.verdict && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verdictColor(compliance.verdict)}`}>
                {compliance.verdict}
              </span>
            )}
          </div>
          {compliance.summary && <p className="text-slate-700 text-sm leading-relaxed">{compliance.summary}</p>}
          {compliance.gaps && compliance.gaps.length > 0 && (
            <div className="mt-3 space-y-2">
              {compliance.gaps.map((g, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                  <p className="font-semibold text-slate-900">{g.gap}</p>
                  {g.protocol && <p className="text-amber-800 text-xs mt-1">{g.protocol}</p>}
                  {g.recommendation && <p className="text-slate-700 text-xs mt-1">{g.recommendation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dx && (
        <div className={sectionCls}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-900">{t('prescription_audit_diagnosis_section')}</h3>
            {dx.overall_assessment && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verdictColor(dx.overall_assessment)}`}>
                {dx.overall_assessment}
              </span>
            )}
          </div>
          {dx.assessment_summary && <p className="text-slate-700 text-sm mb-3 leading-relaxed">{dx.assessment_summary}</p>}
          {dx.protocol_reference && (
            <p className="text-sm text-sky-900 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-3">
              <span className="font-semibold">{t('prescription_audit_protocol_ref')}: </span>
              {dx.protocol_reference}
            </p>
          )}
          {dx.concerns && dx.concerns.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-amber-800 mb-1">{t('prescription_audit_concerns')}</p>
              {dx.concerns.map((c, i) => <p key={i} className="text-sm text-slate-700">• {c}</p>)}
            </div>
          )}
          {dx.missing_workup && dx.missing_workup.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">{t('prescription_audit_missing_workup')}</p>
              {dx.missing_workup.map((w, i) => <p key={i} className="text-sm text-slate-700">• {w}</p>)}
            </div>
          )}
        </div>
      )}

      {result.medications_review && result.medications_review.length > 0 && (
        <div className={sectionCls}>
          <h3 className="text-lg font-bold text-slate-900 mb-3">{t('prescription_audit_medications_section')}</h3>
          <div className="space-y-3">
            {result.medications_review.map((med, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-bold text-slate-900">{med.name}</span>
                  {med.recommendation && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${verdictColor(med.recommendation)}`}>
                      {med.recommendation}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  {[med.prescribed_dose, med.frequency, med.duration].filter(Boolean).join(' · ')}
                </p>
                {med.indication_match && (
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{t('prescription_audit_indication')}: </span>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${verdictColor(med.indication_match)}`}>
                      {med.indication_match}
                    </span>
                    {med.indication_comment && <span className="ml-1 text-slate-700">{med.indication_comment}</span>}
                  </p>
                )}
                {med.dose_assessment && (
                  <p className="text-sm text-slate-800 mt-1">
                    <span className="font-semibold">{t('prescription_audit_dose')}: </span>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${verdictColor(med.dose_assessment)}`}>
                      {med.dose_assessment}
                    </span>
                    {med.dose_comment && <span className="ml-1 text-slate-700">{med.dose_comment}</span>}
                  </p>
                )}
                {med.protocol_basis && (
                  <p className="text-xs text-sky-900 mt-2 bg-sky-50 border border-sky-100 rounded-lg px-2 py-1.5">
                    {med.protocol_basis}
                  </p>
                )}
                {med.adjustment_suggestion && (
                  <p className="text-xs text-amber-900 mt-2">{med.adjustment_suggestion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.interactions && result.interactions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
          <h3 className="text-lg font-bold text-amber-950 mb-3">{t('prescription_audit_interactions')}</h3>
          {result.interactions.map((ix, i) => (
            <div key={i} className="mb-2 p-3 rounded-xl bg-white border border-amber-100 text-sm">
              <p className="font-semibold text-slate-900">{ix.drugs?.join(' + ')}</p>
              <p className="text-xs text-amber-800 font-mono">{ix.severity}</p>
              <p className="text-slate-700 text-xs mt-1">{ix.description}</p>
              {ix.action && <p className="text-slate-800 text-xs mt-1 font-medium">{ix.action}</p>}
            </div>
          ))}
        </div>
      )}

      {result.overall_recommendations && result.overall_recommendations.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
          <h3 className="text-lg font-bold text-emerald-950 mb-2">{t('prescription_audit_recommendations')}</h3>
          <ol className="space-y-1">
            {result.overall_recommendations.map((r, i) => (
              <li key={i} className="text-sm text-slate-800 flex gap-2">
                <span className="text-emerald-700 font-mono shrink-0">{i + 1}.</span> {r}
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
  const [diagnoses, setDiagnoses] = useState<string[]>(['']);
  const [medications, setMedications] = useState<MedicationRow[]>([emptyMed()]);
  const [notes, setNotes] = useState('');

  const [linkedPatientId, setLinkedPatientId] = useState<number | null>(null);
  const [linkedRegistryNumber, setLinkedRegistryNumber] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [smartHits, setSmartHits] = useState<SmartPatientHit[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const applyPatientToForm = useCallback((pd: PatientData) => {
    setFirstName(pd.firstName || '');
    setLastName(pd.lastName || '');
    setAge(pd.age || '');
    setGender(pd.gender || '');
    const parsed = parseVitalsFromObjective(pd.objectiveData);
    setWeightKg(pd.weightKg || parsed.weight || '');
    setHeightCm(pd.heightCm || parsed.height || '');
  }, []);

  useEffect(() => {
    if (!getAuthToken()) return;
    const q = patientSearch.trim();
    const minLen = /^\d+$/.test(q) ? 1 : 2;
    if (q.length < minLen) {
      setSmartHits([]);
      setPatientSearchLoading(false);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setPatientSearchLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      smartSearchPatients(q)
        .then((res) => {
          if (res.success && Array.isArray(res.data)) setSmartHits(res.data);
          else setSmartHits([]);
        })
        .catch(() => setSmartHits([]))
        .finally(() => setPatientSearchLoading(false));
    }, 320);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [patientSearch]);

  const selectFromSmartHit = useCallback(
    (hit: SmartPatientHit) => {
      const passport = passportToPatientData(hit);
      setLinkedPatientId(hit.id);
      setLinkedRegistryNumber(formatPatientRegistryId(hit));
      setResult(null);
      setError(null);

      if (hit.can_view_clinical) {
        getPatient(hit.id)
          .then((res) => {
            if (res.success && res.data) {
              applyPatientToForm(convertPatientToPatientData(res.data));
            } else {
              applyPatientToForm(passport);
            }
          })
          .catch(() => {
            applyPatientToForm(passport);
          });
      } else {
        applyPatientToForm(passport);
      }
      setPatientSearch('');
      setSmartHits([]);
    },
    [applyPatientToForm],
  );

  const clearPatientLink = useCallback(() => {
    setLinkedPatientId(null);
    setLinkedRegistryNumber(null);
  }, []);

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

  const searchMinLen = /^\d+$/.test(patientSearch.trim()) ? 1 : 2;
  const showSearchDropdown = patientSearch.trim().length >= searchMinLen;

  return (
    <div className="glass-panel p-6 md:p-8 max-w-5xl mx-auto w-full min-w-0">
      <div className="mb-6">
        <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-amber-700 mb-1">
          {t('prescription_audit_badge')}
        </p>
        <h3 className="text-xl font-bold text-slate-900">{t('prescription_audit_page_title')}</h3>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{t('prescription_audit_intro')}</p>
      </div>

      <div className="space-y-5">
        {/* Bemor — smart qidiruv */}
        <section className={sectionCls}>
          <h2 className="text-base font-bold text-slate-900">{t('prescription_audit_patient_section')}</h2>

          {getAuthToken() && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-sky-950">{t('uzi_utt_smart_search_title')}</p>
                {linkedPatientId && (
                  <button
                    type="button"
                    onClick={clearPatientLink}
                    className="text-[10px] font-semibold text-rose-700 hover:underline"
                  >
                    {t('data_form_patient_clear_link')}
                  </button>
                )}
              </div>
              {linkedPatientId && linkedRegistryNumber && (
                <span className="inline-flex text-xs font-mono bg-white px-2 py-1 rounded border border-sky-100 text-sky-900">
                  {linkedRegistryNumber}
                </span>
              )}
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder={t('data_form_patient_search_placeholder')}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300/60"
                  autoComplete="off"
                />
                {patientSearchLoading && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    {t('data_form_patient_searching')}
                  </span>
                )}
                {showSearchDropdown && !patientSearchLoading && smartHits.length === 0 && (
                  <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
                    {t('data_form_smart_search_empty')}
                  </p>
                )}
                {showSearchDropdown && smartHits.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg text-sm">
                    {smartHits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-sky-50 border-b border-slate-50 last:border-0"
                          onClick={() => selectFromSmartHit(hit)}
                        >
                          <span className="font-semibold text-slate-900">
                            {hit.last_name} {hit.first_name} {hit.father_name}
                          </span>
                          <span className="text-slate-600 ml-1 text-xs">
                            · {formatPatientRegistryId(hit)} · {hit.age} {t('years_short')}
                          </span>
                          {hit.last_complaint && (
                            <span className="block text-slate-500 text-xs mt-0.5 truncate">{hit.last_complaint}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

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
              {bmiDisplay && (
                <p className="text-xs font-semibold text-emerald-800 mt-1.5 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-100">
                  BMI: {bmiDisplay}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Tashxislar */}
        <section className={`${sectionCls} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">{t('prescription_audit_diagnoses_input')}</h2>
            <button
              type="button"
              onClick={() => setDiagnoses((d) => [...d, ''])}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100"
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
                  className="shrink-0 px-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100 bg-white"
                  aria-label={t('prescription_audit_remove')}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </section>

        {/* Dorilar */}
        <section className={`${sectionCls} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">{t('prescription_audit_medications_input')}</h2>
            <button
              type="button"
              onClick={() => setMedications((m) => [...m, emptyMed()])}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100"
            >
              + {t('prescription_audit_add')}
            </button>
          </div>
          {medications.map((med, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/90 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono font-semibold text-slate-500">#{i + 1}</span>
                {medications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setMedications((m) => m.filter((_, j) => j !== i))}
                    className="text-xs text-rose-600 hover:underline font-semibold"
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
          <textarea className={`${inputCls} min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60 shadow-md hover:shadow-lg transition-shadow"
          style={{
            background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
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
    </div>
  );
};

export default PrescriptionProtocolAudit;
