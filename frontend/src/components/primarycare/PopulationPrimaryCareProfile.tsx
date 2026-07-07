import React, { useCallback, useEffect, useState } from 'react';
import {
  getPopulationPrimaryCareProfile,
  syncPopulationPrimaryCare,
  searchPopulation,
  type PopulationPrimaryCareProfile as Profile,
} from '../../services/apiPopulationService';
import * as pc from '../../services/apiPrimaryCareService';
import Form30Editor, { emptyForm30, type Form30Data } from './Form30Editor';
import { useTranslation } from '../../hooks/useTranslation';

const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-2 text-sm w-full';
const btnPrimary = 'rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50';
const sectionCls = 'rounded-xl border border-slate-200 bg-white p-4 space-y-3';

interface Props {
  populationId: number;
  onBack?: () => void;
  initialSection?: 'checkup' | 'screening' | 'patronage' | 'dispensary' | 'family';
}

const PopulationPrimaryCareProfile: React.FC<Props> = ({ populationId, onBack, initialSection }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'checkup' | 'screening' | 'patronage' | 'dispensary' | 'family'>(initialSection || 'checkup');

  const [checkupForm, setCheckupForm] = useState({
    checkup_type: 'preventive', checkup_date: new Date().toISOString().slice(0, 10),
    location: 'clinic', health_group: '2', blood_pressure: '', height_cm: '', weight_kg: '', waist_cm: '',
    new_diagnoses: '', existing_diagnoses: '', recommendations: '', tactics: '',
    risk_smoking: '', risk_alcohol: '',
  });
  const [patronForm, setPatronForm] = useState({
    visit_date: new Date().toISOString().slice(0, 10), visit_type: 'routine',
    purpose: '', findings: '', recommendations: '',
  });
  const [screenResult, setScreenResult] = useState({
    enrollmentId: 0, result_status: 'negative', result_date: new Date().toISOString().slice(0, 10),
    notes: '', referral_specialist: '', lab_notes: '',
  });
  const [dispForm, setDispForm] = useState({
    diagnosis: '', icd10_code: '', registered_date: new Date().toISOString().slice(0, 10),
    visit_frequency: '', next_visit_date: '', form30: emptyForm30() as Form30Data,
  });
  const [editDispId, setEditDispId] = useState<number | null>(null);
  const [familyForm, setFamilyForm] = useState({ passport_number: '', relation: 'head' });
  const [addMemberRegistry, setAddMemberRegistry] = useState('');
  const [addMemberFamilyId, setAddMemberFamilyId] = useState<number | null>(null);
  const [familyMode, setFamilyMode] = useState<'create' | 'join'>('create');
  const [addMemberRelation, setAddMemberRelation] = useState('child');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getPopulationPrimaryCareProfile(populationId);
    if (res.success && res.data) {
      setProfile(res.data);
      const p = res.data.population;
      if (p.health_group) setCheckupForm((f) => ({ ...f, health_group: p.health_group || '2' }));
    } else {
      setError(res.error?.message || t('pc_load_error'));
    }
    setLoading(false);
  }, [populationId, t]);

  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection, populationId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    const res = await syncPopulationPrimaryCare(populationId);
    setSyncing(false);
    if (res.success) {
      if (res.data?.profile) {
        setProfile(res.data.profile);
        const p = res.data.profile.population;
        if (p.health_group) setCheckupForm((f) => ({ ...f, health_group: p.health_group || '2' }));
      } else await load();
      const enrolled = (res.data?.sync as { screening_enrolled?: number } | undefined)?.screening_enrolled;
      flash(enrolled ? t('pc_sync_done_with_screening', { n: enrolled }) : t('pc_sync_done'));
    } else {
      setError(res.error?.message || t('pc_save_error'));
    }
  };

  const handleAutoEnroll = async () => {
    setError(null);
    const res = await pc.autoEnrollScreening(populationId);
    if (res.success) {
      flash(t('pc_enrolled_count', { n: res.data?.created ?? 0 }));
      load();
    } else {
      setError(res.error?.message || t('pc_save_error'));
    }
  };

  const parseOptionalDecimal = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed.replace(',', '.'));
    return Number.isFinite(n) ? trimmed : undefined;
  };

  const saveCheckup = async () => {
    if (!profile?.population.brigade?.id) {
      setError(t('pc_no_brigade_hint'));
      return;
    }
    setError(null);
    const res = await pc.createCheckup({
      population: populationId,
      brigade: profile.population.brigade.id,
      checkup_type: checkupForm.checkup_type,
      checkup_date: checkupForm.checkup_date,
      location: checkupForm.location,
      health_group: checkupForm.health_group,
      blood_pressure: checkupForm.blood_pressure.trim() || undefined,
      height_cm: parseOptionalDecimal(checkupForm.height_cm),
      weight_kg: parseOptionalDecimal(checkupForm.weight_kg),
      waist_cm: parseOptionalDecimal(checkupForm.waist_cm),
      new_diagnoses: checkupForm.new_diagnoses.trim() || undefined,
      existing_diagnoses: checkupForm.existing_diagnoses.trim() || undefined,
      recommendations: checkupForm.recommendations.trim() || undefined,
      tactics: checkupForm.tactics.trim() || undefined,
      risk_factors: {
        smoking: checkupForm.risk_smoking.trim() || undefined,
        alcohol: checkupForm.risk_alcohol.trim() || undefined,
      },
    });
    if (res.success) { flash(t('pc_saved')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const savePatronage = async () => {
    const res = await pc.createPatronage({
      population: populationId,
      brigade: profile?.population.brigade?.id || undefined,
      ...patronForm,
    });
    if (res.success) { flash(t('pc_saved')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const saveScreeningResult = async () => {
    if (!screenResult.enrollmentId) { setError(t('pc_select_enrollment')); return; }
    const res = await pc.recordScreeningResult(screenResult.enrollmentId, {
      result_date: screenResult.result_date,
      result_status: screenResult.result_status,
      notes: screenResult.notes,
      referral_specialist: screenResult.referral_specialist.trim() || undefined,
      lab_data: screenResult.lab_notes.trim() ? { notes: screenResult.lab_notes.trim() } : undefined,
    });
    if (res.success) { flash(t('pc_screening_recorded')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const updateScreeningStatus = async (enrollmentId: number, status: string) => {
    let reason = '';
    if (status === 'excluded') {
      reason = window.prompt(t('pc_exclude_reason_prompt')) || '';
      if (!reason.trim()) return;
    }
    const res = await pc.updateScreeningEnrollment(enrollmentId, {
      status,
      ...(status === 'excluded' ? { exclude_reason: reason.trim() } : {}),
    });
    if (res.success) { flash(t('pc_saved')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const saveDispensary = async () => {
    if (!dispForm.diagnosis.trim()) { setError(t('pc_fields_required')); return; }
    const form30 = { ...dispForm.form30, main_diagnosis: dispForm.form30.main_diagnosis || dispForm.diagnosis };
    const payload = {
      population: populationId,
      diagnosis: dispForm.diagnosis,
      icd10_code: dispForm.icd10_code,
      registered_date: dispForm.registered_date,
      visit_frequency: dispForm.visit_frequency,
      next_visit_date: dispForm.next_visit_date || null,
      is_active: true,
      form30_data: form30,
      health_improvement_plan: String(form30.treatment_plan || ''),
    };
    const res = editDispId
      ? await pc.updateDispensary(editDispId, payload)
      : await pc.createDispensary(payload);
    if (res.success) {
      flash(t('pc_saved'));
      setEditDispId(null);
      setDispForm({
        diagnosis: '', icd10_code: '', registered_date: new Date().toISOString().slice(0, 10),
        visit_frequency: '', next_visit_date: '', form30: emptyForm30(),
      });
      load();
    } else setError(res.error?.message || t('pc_save_error'));
  };

  const deactivateDispensary = async (id: number) => {
    const res = await pc.updateDispensary(id, { is_active: false });
    if (res.success) { flash(t('pc_saved')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const addFamilyMember = async () => {
    if (!addMemberFamilyId || !addMemberRegistry.trim()) {
      setError(t('pc_family_member_required'));
      return;
    }
    setError(null);
    const searchRes = await searchPopulation(addMemberRegistry.trim());
    const member = searchRes.success && searchRes.data?.[0];
    if (!member) {
      setError(t('pc_family_member_not_found'));
      return;
    }
    const memRes = await pc.createFamilyMember({
      family: addMemberFamilyId,
      population: member.id,
      relation: addMemberRelation,
    });
    if (memRes.success) {
      flash(t('pc_family_member_added'));
      setAddMemberRegistry('');
      load();
    } else {
      setError(memRes.error?.message || t('pc_save_error'));
    }
  };

  const saveFamily = async () => {
    if (!familyForm.passport_number.trim()) {
      setError(t('pc_family_number_required'));
      return;
    }
    setError(null);
    if (familyMode === 'join') {
      const joinRes = await pc.joinFamilyPassport({
        passport_number: familyForm.passport_number.trim(),
        population_id: populationId,
        relation: familyForm.relation,
      });
      if (joinRes.success) {
        flash(t('pc_family_linked'));
        load();
      } else {
        setError(joinRes.error?.message || t('pc_save_error'));
      }
      return;
    }
    const fpRes = await pc.createFamilyPassport({
      passport_number: familyForm.passport_number.trim(),
      head: populationId,
      address: profile?.population.address,
      region_id: profile?.population.region_id || '',
      district_id: profile?.population.district_id || '',
    });
    if (!fpRes.success || !fpRes.data) {
      setError(fpRes.error?.message || t('pc_save_error'));
      return;
    }
    flash(t('pc_family_linked'));
    load();
  };

  const deleteCheckup = async (id: number) => {
    if (!window.confirm(t('pc_delete_confirm'))) return;
    const res = await pc.deleteCheckup(id);
    if (res.success) { flash(t('pc_deleted')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const deletePatronage = async (id: number) => {
    if (!window.confirm(t('pc_delete_confirm'))) return;
    const res = await pc.deletePatronage(id);
    if (res.success) { flash(t('pc_deleted')); load(); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  if (loading) return <p className="text-sm text-slate-400 p-4">{t('loading_text')}</p>;
  if (!profile) return <p className="text-sm text-red-600 p-4">{error || t('pc_load_error')}</p>;

  const p = profile.population;
  const plan = profile.network_plan as { targets?: Record<string, number>; completed?: Record<string, number>; completion_pct?: number } | null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {onBack && (
              <button type="button" onClick={onBack} className="text-xs text-emerald-700 font-semibold mb-2">← {t('back')}</button>
            )}
            <h2 className="text-xl font-black text-slate-800">
              {p.last_name} {p.first_name} {p.father_name}
            </h2>
            <p className="text-xs font-mono text-slate-500 mt-0.5">{p.registry_number}</p>
            <p className="text-sm text-slate-600 mt-1">
              {[p.age && `${p.age} yosh`, p.phone, p.address].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 disabled:opacity-50" onClick={handleSync} disabled={syncing}>
              {syncing ? t('loading_text') : t('pc_sync')}
            </button>
            {p.overdue_checkup && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-bold">{t('pc_overdue_badge')}</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
          <div className="bg-white/80 rounded-lg p-2 border border-slate-100">
            <span className="text-slate-400 block">{t('pc_brigade')}</span>
            <span className="font-bold text-slate-800">{p.brigade?.name || '—'}</span>
          </div>
          <div className="bg-white/80 rounded-lg p-2 border border-slate-100">
            <span className="text-slate-400 block">{t('pc_health_group')}</span>
            <span className="font-bold text-slate-800">{p.health_group_label || '—'}</span>
          </div>
          <div className="bg-white/80 rounded-lg p-2 border border-slate-100">
            <span className="text-slate-400 block">{t('pc_next_checkup')}</span>
            <span className={`font-bold ${p.overdue_checkup ? 'text-red-600' : 'text-slate-800'}`}>{p.next_checkup_date || '—'}</span>
          </div>
          <div className="bg-white/80 rounded-lg p-2 border border-slate-100">
            <span className="text-slate-400 block">{t('pc_checkups_year')}</span>
            <span className="font-bold text-slate-800">{p.checkups_done_year}/{p.checkups_required_year}</span>
          </div>
        </div>
        {(p.risk_pregnant || p.risk_chronic || p.risk_disabled || p.risk_lone_elderly || p.risk_social_vulnerable || p.risk_needs_care) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.risk_pregnant && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 text-pink-800">{t('pc_risk_pregnant')}</span>}
            {p.risk_chronic && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{t('pc_risk_chronic')}</span>}
            {p.risk_disabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">{t('pc_risk_disabled')}</span>}
            {p.risk_lone_elderly && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">{t('pc_risk_elderly')}</span>}
            {p.risk_social_vulnerable && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">{t('pc_risk_social')}</span>}
            {p.risk_needs_care && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{t('pc_risk_care')}</span>}
          </div>
        )}
      </div>

      {!p.brigade?.name && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>{t('pc_no_brigade_banner')}</span>
          <button type="button" className={btnPrimary} onClick={handleSync} disabled={syncing}>{t('pc_sync')}</button>
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{success}</div>}

      {plan && (
        <div className={sectionCls}>
          <h3 className="font-bold text-slate-800">{t('pc_brigade_plan')}</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(['checkups', 'patronage', 'screening', 'dispensary_visits'] as const).map((key) => {
              const target = plan.targets?.[key] ?? 0;
              const done = plan.completed?.[key] ?? 0;
              const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
              const label = key === 'dispensary_visits' ? t('pc_tab_dispensary') : key;
              return (
                <div key={key} className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-500 capitalize">{label}</p>
                  <p className="font-bold">{done}/{target}</p>
                  <div className="h-1.5 bg-slate-200 rounded-full mt-1"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {(['checkup', 'screening', 'patronage', 'dispensary', 'family'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setActiveSection(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${activeSection === s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {t(`pc_section_${s}`)}
          </button>
        ))}
      </div>

      {activeSection === 'checkup' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <p className="lg:col-span-2 text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">{t('pc_section_checkup_help')}</p>
          <div className={sectionCls}>
            <h3 className="font-bold">{t('pc_add_checkup')}</h3>
            <select className={inputCls} value={checkupForm.checkup_type} onChange={(e) => setCheckupForm((f) => ({ ...f, checkup_type: e.target.value }))}>
              {pc.CHECKUP_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={checkupForm.checkup_date} onChange={(e) => setCheckupForm((f) => ({ ...f, checkup_date: e.target.value }))} />
              <select className={inputCls} value={checkupForm.location} onChange={(e) => setCheckupForm((f) => ({ ...f, location: e.target.value }))}>
                {pc.LOCATION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <select className={inputCls} value={checkupForm.health_group} onChange={(e) => setCheckupForm((f) => ({ ...f, health_group: e.target.value }))}>
              {pc.HEALTH_GROUPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="grid grid-cols-4 gap-2">
              <input className={inputCls} placeholder="BP" value={checkupForm.blood_pressure} onChange={(e) => setCheckupForm((f) => ({ ...f, blood_pressure: e.target.value }))} />
              <input className={inputCls} placeholder="cm" value={checkupForm.height_cm} onChange={(e) => setCheckupForm((f) => ({ ...f, height_cm: e.target.value }))} />
              <input className={inputCls} placeholder="kg" value={checkupForm.weight_kg} onChange={(e) => setCheckupForm((f) => ({ ...f, weight_kg: e.target.value }))} />
              <input className={inputCls} placeholder={t('pc_waist')} value={checkupForm.waist_cm} onChange={(e) => setCheckupForm((f) => ({ ...f, waist_cm: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder={t('pc_risk_smoking')} value={checkupForm.risk_smoking} onChange={(e) => setCheckupForm((f) => ({ ...f, risk_smoking: e.target.value }))} />
              <input className={inputCls} placeholder={t('pc_risk_alcohol')} value={checkupForm.risk_alcohol} onChange={(e) => setCheckupForm((f) => ({ ...f, risk_alcohol: e.target.value }))} />
            </div>
            <textarea className={inputCls} rows={2} placeholder={t('pc_diagnosis')} value={checkupForm.new_diagnoses} onChange={(e) => setCheckupForm((f) => ({ ...f, new_diagnoses: e.target.value }))} />
            <textarea className={inputCls} rows={2} placeholder={t('pc_existing_diagnoses')} value={checkupForm.existing_diagnoses} onChange={(e) => setCheckupForm((f) => ({ ...f, existing_diagnoses: e.target.value }))} />
            <textarea className={inputCls} rows={2} placeholder={t('pc_tactics')} value={checkupForm.tactics} onChange={(e) => setCheckupForm((f) => ({ ...f, tactics: e.target.value }))} />
            <textarea className={inputCls} rows={2} placeholder={t('pc_recommendations')} value={checkupForm.recommendations} onChange={(e) => setCheckupForm((f) => ({ ...f, recommendations: e.target.value }))} />
            <button type="button" className={btnPrimary} onClick={saveCheckup}>{t('pc_save')}</button>
          </div>
          <div className={sectionCls}>
            <h3 className="font-bold">{t('pc_history_checkups')}</h3>
            {profile.checkups.length === 0 ? <p className="text-xs text-slate-400">{t('pc_empty')}</p> : (
              <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
                {profile.checkups.map((c) => (
                  <li key={String(c.id)} className="border-b border-slate-100 pb-2 flex justify-between gap-2">
                    <div>
                      <span className="font-medium">{String(c.checkup_date)}</span>
                      <span className="text-slate-500 text-xs ml-2">{String(c.health_group_label || c.health_group)}</span>
                      {c.blood_pressure && <p className="text-xs text-slate-500">BP: {String(c.blood_pressure)}</p>}
                    </div>
                    <button type="button" className="text-xs text-red-600 shrink-0" onClick={() => deleteCheckup(Number(c.id))}>{t('pc_delete')}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeSection === 'screening' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={sectionCls}>
            <h3 className="font-bold">{t('pc_record_screening')}</h3>
            <select
              className={inputCls}
              value={screenResult.enrollmentId}
              onChange={(e) => setScreenResult((f) => ({ ...f, enrollmentId: Number(e.target.value) }))}
            >
              <option value={0}>{t('pc_select_enrollment')}</option>
              {profile.screening.filter((s) => s.status === 'planned' || s.status === 'invited').map((s) => (
                <option key={String(s.id)} value={Number(s.id)}>{String(s.program_name)} ({String(s.status)})</option>
              ))}
            </select>
            <select className={inputCls} value={screenResult.result_status} onChange={(e) => setScreenResult((f) => ({ ...f, result_status: e.target.value }))}>
              <option value="negative">{t('pc_result_negative')}</option>
              <option value="suspected">{t('pc_result_suspected')}</option>
              <option value="positive">{t('pc_result_positive')}</option>
            </select>
            <input type="date" className={inputCls} value={screenResult.result_date} onChange={(e) => setScreenResult((f) => ({ ...f, result_date: e.target.value }))} />
            <input className={inputCls} placeholder={t('pc_referral_specialist')} value={screenResult.referral_specialist} onChange={(e) => setScreenResult((f) => ({ ...f, referral_specialist: e.target.value }))} />
            <textarea className={inputCls} rows={2} placeholder={t('pc_lab_data')} value={screenResult.lab_notes} onChange={(e) => setScreenResult((f) => ({ ...f, lab_notes: e.target.value }))} />
            <textarea className={inputCls} rows={2} value={screenResult.notes} onChange={(e) => setScreenResult((f) => ({ ...f, notes: e.target.value }))} />
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} onClick={saveScreeningResult}>{t('pc_save')}</button>
              <button type="button" className="rounded-lg border border-emerald-600 text-emerald-700 px-3 py-2 text-sm" onClick={handleAutoEnroll}>
                {t('pc_auto_enroll')}
              </button>
            </div>
          </div>
          <div className={sectionCls}>
            <h3 className="font-bold">{t('pc_enrollments')}</h3>
            {profile.screening.map((s) => (
              <div key={String(s.id)} className="py-2 border-b text-sm flex justify-between gap-2 items-start">
                <div>
                  <p className="font-medium">{String(s.program_name)}</p>
                  <p className="text-xs text-slate-500">
                    {String(s.status)}
                    {s.exclude_reason ? ` · ${String(s.exclude_reason)}` : ''}
                    {s.result ? ` · ${String((s.result as { result_status?: string }).result_status)}` : ''}
                  </p>
                </div>
                {(s.status === 'planned' || s.status === 'invited') && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-700" onClick={() => updateScreeningStatus(Number(s.id), 'invited')}>{t('pc_invite')}</button>
                    <button type="button" className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600" onClick={() => updateScreeningStatus(Number(s.id), 'excluded')}>{t('pc_exclude')}</button>
                  </div>
                )}
              </div>
            ))}
            {profile.eligible_screening_programs.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">{t('pc_eligible')}: {profile.eligible_screening_programs.map((e) => e.name).join(', ')}</p>
            )}
          </div>
        </div>
      )}

      {activeSection === 'patronage' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={sectionCls}>
            <h3 className="font-bold">{t('pc_add_patronage')}</h3>
            <select className={inputCls} value={patronForm.visit_type} onChange={(e) => setPatronForm((f) => ({ ...f, visit_type: e.target.value }))}>
              {pc.PATRONAGE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" className={inputCls} value={patronForm.visit_date} onChange={(e) => setPatronForm((f) => ({ ...f, visit_date: e.target.value }))} />
            <textarea className={inputCls} rows={2} value={patronForm.purpose} onChange={(e) => setPatronForm((f) => ({ ...f, purpose: e.target.value }))} placeholder={t('pc_purpose')} />
            <textarea className={inputCls} rows={2} value={patronForm.findings} onChange={(e) => setPatronForm((f) => ({ ...f, findings: e.target.value }))} placeholder={t('pc_findings')} />
            <textarea className={inputCls} rows={2} value={patronForm.recommendations} onChange={(e) => setPatronForm((f) => ({ ...f, recommendations: e.target.value }))} placeholder={t('pc_recommendations')} />
            <button type="button" className={btnPrimary} onClick={savePatronage}>{t('pc_save')}</button>
          </div>
          <div className={sectionCls}>
            {profile.patronage.map((v) => (
              <div key={String(v.id)} className="py-2 border-b text-sm flex justify-between gap-2">
                <div>
                  <p className="font-medium">{String(v.visit_date)}</p>
                  <p className="text-xs text-slate-500">{String(v.visit_type)}</p>
                </div>
                <button type="button" className="text-xs text-red-600" onClick={() => deletePatronage(Number(v.id))}>{t('pc_delete')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'dispensary' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={sectionCls}>
            <h3 className="font-bold">{editDispId ? t('pc_edit_dispensary') : t('pc_add_dispensary')}</h3>
            <input className={inputCls} value={dispForm.diagnosis} onChange={(e) => setDispForm((f) => ({ ...f, diagnosis: e.target.value }))} placeholder={t('pc_diagnosis')} />
            <input className={inputCls} value={dispForm.icd10_code} onChange={(e) => setDispForm((f) => ({ ...f, icd10_code: e.target.value }))} placeholder="ICD-10" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={dispForm.registered_date} onChange={(e) => setDispForm((f) => ({ ...f, registered_date: e.target.value }))} />
              <input type="date" className={inputCls} value={dispForm.next_visit_date} onChange={(e) => setDispForm((f) => ({ ...f, next_visit_date: e.target.value }))} title={t('pc_next_visit')} />
            </div>
            <input className={inputCls} value={dispForm.visit_frequency} onChange={(e) => setDispForm((f) => ({ ...f, visit_frequency: e.target.value }))} placeholder={t('pc_visit_freq')} />
            <Form30Editor value={dispForm.form30} onChange={(form30) => setDispForm((f) => ({ ...f, form30 }))} />
            <button type="button" className={btnPrimary} onClick={saveDispensary}>{t('pc_save')}</button>
          </div>
          <div className={sectionCls}>
            {profile.dispensary.map((d) => (
              <div key={String(d.id)} className="py-2 border-b text-sm">
                <p className="font-medium">{String(d.diagnosis)} {!d.is_active && <span className="text-xs text-slate-400">({t('pc_inactive')})</span>}</p>
                <p className="text-xs text-slate-500">{String(d.registered_date)} · {String(d.visit_frequency || '')} {d.next_visit_date ? `· ${t('pc_next_visit')}: ${d.next_visit_date}` : ''}</p>
                {d.is_active && (
                  <div className="flex gap-2 mt-1">
                    <button type="button" className="text-xs text-sky-700" onClick={() => {
                      setEditDispId(Number(d.id));
                      setDispForm({
                        diagnosis: String(d.diagnosis),
                        icd10_code: String(d.icd10_code || ''),
                        registered_date: String(d.registered_date),
                        visit_frequency: String(d.visit_frequency || ''),
                        next_visit_date: String(d.next_visit_date || ''),
                        form30: { ...emptyForm30(), ...(d.form30_data as Form30Data || {}) },
                      });
                    }}>{t('pc_edit')}</button>
                    <button type="button" className="text-xs text-red-600" onClick={() => deactivateDispensary(Number(d.id))}>{t('pc_deactivate')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'family' && (
        <div className={sectionCls}>
          {profile.families.length > 0 ? profile.families.map((fam) => (
            <div key={String(fam.id)} className="mb-3">
              <p className="font-bold text-sm">{String(fam.passport_number)}</p>
              <ul className="text-xs text-slate-600 ml-2">
                {(fam.members as Array<{ name: string; relation: string }> || []).map((m, i) => (
                  <li key={i}>• {m.name} ({m.relation})</li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2 items-end">
                <input className={inputCls + ' max-w-xs'} value={addMemberFamilyId === Number(fam.id) ? addMemberRegistry : ''} onFocus={() => setAddMemberFamilyId(Number(fam.id))} onChange={(e) => { setAddMemberFamilyId(Number(fam.id)); setAddMemberRegistry(e.target.value); }} placeholder={t('pc_member_passport')} />
                <select className={inputCls + ' max-w-[140px]'} value={addMemberFamilyId === Number(fam.id) ? addMemberRelation : 'child'} onChange={(e) => { setAddMemberFamilyId(Number(fam.id)); setAddMemberRelation(e.target.value); }}>
                  {pc.FAMILY_RELATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button type="button" className="text-xs px-3 py-2 rounded-lg bg-sky-600 text-white" onClick={addFamilyMember}>{t('pc_add_member')}</button>
              </div>
            </div>
          )) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('pc_no_family')}</p>
              <div className="flex gap-2 text-xs">
                <button type="button" className={`px-3 py-1 rounded-full ${familyMode === 'create' ? 'bg-sky-600 text-white' : 'bg-slate-100'}`} onClick={() => setFamilyMode('create')}>{t('pc_create_family')}</button>
                <button type="button" className={`px-3 py-1 rounded-full ${familyMode === 'join' ? 'bg-sky-600 text-white' : 'bg-slate-100'}`} onClick={() => setFamilyMode('join')}>{t('pc_join_family')}</button>
              </div>
              <input className={inputCls} value={familyForm.passport_number} onChange={(e) => setFamilyForm((f) => ({ ...f, passport_number: e.target.value }))} placeholder={t('pc_family_number')} />
              {familyMode === 'join' && (
                <select className={inputCls} value={familyForm.relation} onChange={(e) => setFamilyForm((f) => ({ ...f, relation: e.target.value }))}>
                  {pc.FAMILY_RELATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
              <button type="button" className={btnPrimary} onClick={saveFamily}>{familyMode === 'join' ? t('pc_join_family') : t('pc_create_family')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PopulationPrimaryCareProfile;
