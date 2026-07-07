import React, { useCallback, useEffect, useRef, useState } from 'react';
import PopulationPanel from '../population/PopulationPanel';
import PopulationPrimaryCareProfile from './PopulationPrimaryCareProfile';
import PrimaryCareGuide from './PrimaryCareGuide';
import PrimaryCareOperationsTab from './PrimaryCareOperationsTab';
import { useTranslation } from '../../hooks/useTranslation';
import * as pc from '../../services/apiPrimaryCareService';

type HubTab = 'guide' | 'overview' | 'operations' | 'population' | 'brigades' | 'plans' | 'profile';
type ProfileSection = 'checkup' | 'screening' | 'patronage' | 'dispensary' | 'family';

const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-2 text-sm w-full';
const btnPrimary = 'rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-60';

interface StatsExt extends pc.PrimaryCareStats {
  workflow?: Array<{ step: number; title: string; description: string; action: string }>;
  needs_setup?: boolean;
  overdue_population?: Array<{
    id: number; last_name: string; first_name: string; registry_number: string; next_checkup_date: string;
  }>;
}

interface LeaderOption { id: number; name: string }

interface PrimaryCareHubProps {
  initialProfileId?: number | null;
  onProfileConsumed?: () => void;
  initialTab?: HubTab;
}

const PrimaryCareHub: React.FC<PrimaryCareHubProps> = ({ initialProfileId, onProfileConsumed, initialTab }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HubTab>(initialTab ?? 'guide');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [profileSection, setProfileSection] = useState<ProfileSection>('checkup');
  const [filterBrigadeId, setFilterBrigadeId] = useState<number | ''>('');
  const [stats, setStats] = useState<StatsExt | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [brigades, setBrigades] = useState<pc.MedicalBrigade[]>([]);
  const [leaders, setLeaders] = useState<LeaderOption[]>([]);
  const [plans, setPlans] = useState<pc.NetworkPlan[]>([]);
  const [programs, setPrograms] = useState<pc.ScreeningProgram[]>([]);
  const [brigadeForm, setBrigadeForm] = useState({
    name: '', code: '', target_population_size: 3000, region_id: '', district_id: '', leader: '' as string | number,
  });
  const [editBrigadeId, setEditBrigadeId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({ brigade: '', plan_level: 'annual', year: new Date().getFullYear(), month: '', week_number: '' });

  const brigadesLoadedRef = useRef(false);
  const plansLoadedRef = useRef(false);

  const statsParams = filterBrigadeId ? { brigade_id: Number(filterBrigadeId) } : undefined;

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pc.getPrimaryCareStats(statsParams);
      if (res.success && res.data) {
        setStats(res.data as StatsExt);
        setStatsLoaded(true);
      } else if (res.error?.code === 429) {
        setError(res.error.message || t('pc_rate_limit'));
      } else {
        setStats(null);
        setStatsLoaded(false);
        setError(res.error?.message || t('pc_load_error'));
      }
    } finally {
      setLoading(false);
    }
  }, [t, filterBrigadeId]);

  const loadBrigades = useCallback(async () => {
    const res = await pc.listBrigades();
    if (res.success && res.data) setBrigades(res.data);
    else if (!res.success) setError(res.error?.message || t('pc_load_error'));
    const staffRes = await pc.listBrigadeStaffOptions();
    if (staffRes.success && staffRes.data) setLeaders(staffRes.data);
  }, [t]);

  const loadPlans = useCallback(async () => {
    const [pRes, prRes] = await Promise.all([pc.listNetworkPlans(), pc.listScreeningPrograms()]);
    if (pRes.success && pRes.data) setPlans(pRes.data);
    if (prRes.success && prRes.data) setPrograms(prRes.data);
    if (!pRes.success && !prRes.success) setError(t('pc_load_error'));
  }, [t]);

  useEffect(() => {
    if (initialProfileId) {
      setSelectedId(initialProfileId);
      setTab('profile');
      onProfileConsumed?.();
    }
  }, [initialProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (tab === 'brigades' && !brigadesLoadedRef.current) {
      brigadesLoadedRef.current = true;
      loadBrigades();
    }
    if (tab === 'plans' && !plansLoadedRef.current) {
      plansLoadedRef.current = true;
      loadPlans();
      loadBrigades();
    }
    if ((tab === 'overview' || tab === 'operations') && brigades.length === 0) {
      pc.listBrigades().then((res) => { if (res.success && res.data) setBrigades(res.data); });
    }
  }, [tab, loadBrigades, loadPlans, brigades.length]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const runSetup = async () => {
    setSettingUp(true);
    setError(null);
    const res = await pc.setupPrimaryCare();
    setSettingUp(false);
    if (res.success && res.data) {
      const d = res.data as { brigade_name?: string; population_synced?: number; stats?: StatsExt };
      flash(t('pc_setup_done', { brigade: d.brigade_name || '—', n: d.population_synced ?? 0 }));
      if (d.stats) setStats(d.stats as StatsExt);
      else loadOverview();
      loadBrigades();
    } else setError(res.error?.message || t('pc_save_error'));
  };

  const openProfile = (id: number, section?: ProfileSection) => {
    setSelectedId(id);
    if (section) setProfileSection(section);
    setTab('profile');
  };

  const goFromWorkflow = (action: string) => {
    if (action === 'brigades') setTab('brigades');
    else if (action === 'population') setTab('population');
    else if (action === 'plans') setTab('plans');
    else if (action === 'operations') setTab('operations');
    else if (action === 'family') {
      if (selectedId) {
        setProfileSection('family');
        setTab('profile');
      } else setTab('population');
    } else if (action === 'profile') {
      if (selectedId) setTab('profile');
      else setTab('population');
    } else setTab('overview');
  };

  const saveBrigade = async () => {
    if (!brigadeForm.name.trim()) { setError(t('pc_name_required')); return; }
    setError(null);
    const payload = {
      name: brigadeForm.name,
      code: brigadeForm.code,
      target_population_size: brigadeForm.target_population_size,
      region_id: brigadeForm.region_id,
      district_id: brigadeForm.district_id,
      leader: brigadeForm.leader ? Number(brigadeForm.leader) : null,
    };
    const res = editBrigadeId ? await pc.updateBrigade(editBrigadeId, payload) : await pc.createBrigade(payload);
    if (res.success) {
      flash(t('pc_saved'));
      setBrigadeForm({ name: '', code: '', target_population_size: 3000, region_id: '', district_id: '', leader: '' });
      setEditBrigadeId(null);
      loadBrigades();
      loadOverview();
    } else setError(res.error?.message || t('pc_save_error'));
  };

  const deleteBrigade = async (id: number) => {
    if (!window.confirm(t('pc_delete_brigade_confirm'))) return;
    setError(null);
    const res = await pc.deleteBrigade(id);
    if (res.success) { loadBrigades(); loadOverview(); flash(t('pc_deleted')); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const refreshPlan = async (id: number) => {
    const res = await pc.refreshNetworkPlan(id);
    if (res.success) { loadPlans(); loadOverview(); flash(t('pc_plan_refreshed')); }
    else setError(res.error?.message || t('pc_save_error'));
  };

  const createPlan = async () => {
    if (!planForm.brigade) { setError(t('pc_select_brigade')); return; }
    const res = await pc.createNetworkPlan({
      brigade: Number(planForm.brigade),
      plan_level: planForm.plan_level,
      year: planForm.year,
      month: planForm.month ? Number(planForm.month) : null,
      week_number: planForm.week_number ? Number(planForm.week_number) : null,
      title: `${planForm.plan_level} ${planForm.year}`,
    });
    if (res.success && res.data?.id) {
      flash(t('pc_saved'));
      loadPlans();
      loadOverview();
    } else if (res.success) {
      flash(t('pc_saved'));
      loadPlans();
    } else setError(res.error?.message || t('pc_save_error'));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await pc.exportPrimaryCareReport(filterBrigadeId ? { brigade_id: Number(filterBrigadeId) } : undefined);
      flash(t('pc_export_done'));
    } catch {
      setError(t('pc_export_error'));
    } finally {
      setExporting(false);
    }
  };

  const riskLabels: Record<string, string> = {
    pregnant: t('pc_risk_pregnant'),
    disabled: t('pc_risk_disabled'),
    chronic: t('pc_risk_chronic'),
    social_vulnerable: t('pc_risk_social'),
    lone_elderly: t('pc_risk_elderly'),
    needs_care: t('pc_risk_care'),
  };

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'guide', label: t('pc_tab_guide') },
    { id: 'overview', label: t('pc_tab_overview') },
    { id: 'operations', label: t('pc_tab_operations') },
    { id: 'population', label: t('population_title') },
    { id: 'brigades', label: t('pc_tab_brigades') },
    { id: 'plans', label: t('pc_tab_network') },
    ...(selectedId ? [{ id: 'profile' as HubTab, label: t('pc_tab_profile') }] : []),
  ];

  const brigadeFilter = (
    <select
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
      value={filterBrigadeId}
      onChange={(e) => setFilterBrigadeId(e.target.value ? Number(e.target.value) : '')}
    >
      <option value="">{t('pc_all_brigades')}</option>
      {brigades.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
      {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">{success}</div>}

      <div className="flex flex-wrap gap-1.5 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {(tab === 'overview' || tab === 'operations' || tab === 'population') && brigadeFilter}
      </div>

      {tab === 'guide' && (
        <PrimaryCareGuide workflow={stats?.workflow} needsSetup={statsLoaded ? Boolean(stats?.needs_setup) : false}
          onSetup={runSetup} settingUp={settingUp} onGoTo={goFromWorkflow} />
      )}

      {tab === 'overview' && (
        <div className="space-y-4">
          {loading ? <p className="text-sm text-slate-400 p-4">{t('loading_text')}</p> : stats ? (
            <>
              {stats.needs_setup && (
                <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-amber-900 text-sm">{t('pc_setup_needed')}</p>
                    <p className="text-xs text-amber-800 mt-1">{t('pc_setup_needed_desc')}</p>
                  </div>
                  <button type="button" className={btnPrimary} disabled={settingUp} onClick={runSetup}>
                    {settingUp ? t('pc_setup_running') : t('pc_setup_button')}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  [t('pc_stat_population'), stats.population_total],
                  [t('pc_stat_brigade_assigned'), stats.with_brigade],
                  [t('pc_stat_checkups_ytd'), stats.checkups_ytd],
                  [t('pc_stat_overdue'), stats.overdue_checkups],
                  [t('pc_stat_patronage_ytd'), stats.patronage_visits_ytd],
                  [t('pc_stat_screening_done'), stats.screening_completed],
                  [t('pc_stat_screening_plan'), stats.screening_planned],
                  [t('pc_stat_dispensary'), stats.dispensary_active],
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-black text-slate-800 mt-1 tabular-nums">{val}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2">
                <p className="text-xs text-slate-500">{t('pc_report_hint')}</p>
                <button type="button" disabled={exporting} className="text-xs font-semibold px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  onClick={handleExport}>
                  {exporting ? t('loading_text') : t('pc_export_report')}
                </button>
              </div>

              {stats.health_groups && stats.health_groups.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-sm mb-3">{t('pc_health_groups_chart')}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {stats.health_groups.map((hg) => (
                      <div key={hg.health_group} className="rounded-lg bg-slate-50 p-2 text-center">
                        <p className="text-[10px] text-slate-500">{hg.health_group_label || pc.healthGroupLabel(hg.health_group)}</p>
                        <p className="text-lg font-black text-slate-800">{hg.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.risk_groups && Object.values(stats.risk_groups).some((n) => (n as number) > 0) && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-sm mb-3">{t('pc_risk_groups_chart')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.risk_groups).filter(([, n]) => (n as number) > 0).map(([key, n]) => (
                      <span key={key} className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-900 border border-amber-100">
                        {riskLabels[key] || key}: <strong>{n as number}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {stats.overdue_population && stats.overdue_population.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                  <h3 className="font-bold text-red-800 text-sm mb-2">{t('pc_overdue_list')}</h3>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {stats.overdue_population.map((row) => (
                      <li key={row.id}>
                        <button type="button" className="text-sm text-left w-full hover:bg-white/70 rounded-lg px-2 py-1.5 flex justify-between gap-2"
                          onClick={() => openProfile(row.id, 'checkup')}>
                          <span className="font-medium">{row.last_name} {row.first_name}</span>
                          <span className="text-xs text-red-600 shrink-0">{row.next_checkup_date}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stats.brigades.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-sm mb-3">{t('pc_tab_brigades')}</h3>
                  {stats.brigades.map((b) => (
                    <div key={b.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="font-medium">{b.name}</span>
                      <span className="text-slate-500 tabular-nums">
                        {b.assigned_population}/{b.target}
                        {(b as { plan_completion_pct?: number }).plan_completion_pct != null && (
                          <span className="ml-2 text-emerald-600 text-xs">{(b as { plan_completion_pct?: number }).plan_completion_pct}%</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {stats.population_total === 0 && (
                <div className="text-center py-8 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-slate-600 text-sm mb-3">{t('pc_no_population_hint')}</p>
                  <button type="button" className={btnPrimary} onClick={() => setTab('population')}>{t('pc_add_first_population')}</button>
                </div>
              )}
            </>
          ) : <p className="text-sm text-red-600">{t('pc_load_error')}</p>}
        </div>
      )}

      {tab === 'operations' && (
        <PrimaryCareOperationsTab onOpenProfile={(id) => openProfile(id)} brigadeId={filterBrigadeId ? Number(filterBrigadeId) : undefined} />
      )}

      <div className={tab === 'population' ? '' : 'hidden'}>
        <PopulationPanel onOpenProfile={(id) => openProfile(id)} brigadeFilter={filterBrigadeId ? Number(filterBrigadeId) : undefined} brigades={brigades} hubEmbedded />
      </div>

      {selectedId && (
        <div className={tab === 'profile' ? '' : 'hidden'}>
          <PopulationPrimaryCareProfile populationId={selectedId} initialSection={profileSection}
            onBack={() => setTab('population')} />
        </div>
      )}

      {tab === 'brigades' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{t('pc_brigade_help')}</p>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="font-bold">{editBrigadeId ? t('pc_edit_brigade') : t('pc_add_brigade')}</h3>
              <input className={inputCls} value={brigadeForm.name} onChange={(e) => setBrigadeForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('pc_brigade_name')} />
              <input className={inputCls} value={brigadeForm.code} onChange={(e) => setBrigadeForm((f) => ({ ...f, code: e.target.value }))} placeholder={t('pc_brigade_code')} />
              <select className={inputCls} value={String(brigadeForm.leader)} onChange={(e) => setBrigadeForm((f) => ({ ...f, leader: e.target.value }))}>
                <option value="">{t('pc_brigade_leader')}</option>
                {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} value={brigadeForm.region_id} onChange={(e) => setBrigadeForm((f) => ({ ...f, region_id: e.target.value }))} placeholder={t('pc_region_id')} />
                <input className={inputCls} value={brigadeForm.district_id} onChange={(e) => setBrigadeForm((f) => ({ ...f, district_id: e.target.value }))} placeholder={t('pc_district_id')} />
              </div>
              <input type="number" className={inputCls} value={brigadeForm.target_population_size} onChange={(e) => setBrigadeForm((f) => ({ ...f, target_population_size: Number(e.target.value) }))} />
              <div className="flex gap-2">
                <button type="button" className={btnPrimary} onClick={saveBrigade}>{t('pc_save')}</button>
                {editBrigadeId && (
                  <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onClick={() => { setEditBrigadeId(null); setBrigadeForm({ name: '', code: '', target_population_size: 3000, region_id: '', district_id: '', leader: '' }); }}>
                    {t('cancel')}
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              {brigades.length === 0 ? <p className="text-sm text-slate-400">{t('pc_empty_brigade')}</p> : brigades.map((b) => (
                <div key={b.id} className="flex justify-between py-2 border-b text-sm">
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-xs text-slate-500">{b.assigned_count ?? 0} / {b.target_population_size} {t('pc_assigned')}</p>
                    {b.leader_name && <p className="text-xs text-emerald-700">{t('pc_brigade_leader')}: {b.leader_name}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="text-sky-600 text-xs" onClick={() => {
                      setEditBrigadeId(b.id);
                      setBrigadeForm({ name: b.name, code: b.code || '', target_population_size: b.target_population_size,
                        region_id: b.region_id || '', district_id: b.district_id || '', leader: b.leader || '' });
                    }}>{t('pc_edit')}</button>
                    <button type="button" className="text-red-600 text-xs" onClick={() => deleteBrigade(b.id)}>{t('pc_delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{t('pc_plan_help')}</p>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="font-bold text-sm">{t('pc_add_plan')}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <select className={inputCls} value={planForm.brigade} onChange={(e) => setPlanForm((f) => ({ ...f, brigade: e.target.value }))}>
                <option value="">{t('pc_select_brigade')}</option>
                {brigades.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className={inputCls} value={planForm.plan_level} onChange={(e) => setPlanForm((f) => ({ ...f, plan_level: e.target.value }))}>
                {pc.PLAN_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input type="number" className={inputCls} value={planForm.year} onChange={(e) => setPlanForm((f) => ({ ...f, year: Number(e.target.value) }))} placeholder={t('pc_plan_year')} />
              <input type="number" className={inputCls} value={planForm.month} onChange={(e) => setPlanForm((f) => ({ ...f, month: e.target.value }))} placeholder={t('pc_month_optional')} />
              <input type="number" className={inputCls} value={planForm.week_number} onChange={(e) => setPlanForm((f) => ({ ...f, week_number: e.target.value }))} placeholder={t('pc_week_optional')} />
            </div>
            <button type="button" className={btnPrimary} onClick={createPlan}>{t('pc_save')}</button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-bold text-sm mb-2">{t('pc_programs')}</h3>
            <ul className="text-xs space-y-1 text-slate-600 mb-4">
              {programs.map((p) => <li key={p.id}>• {p.name} ({p.age_min}–{p.age_max})</li>)}
            </ul>
            <h3 className="font-bold text-sm mb-2">{t('pc_tab_network')}</h3>
            {plans.length === 0 ? <p className="text-sm text-slate-400">{t('pc_empty_plans')}</p> : plans.map((plan) => (
              <div key={plan.id} className="border-b border-slate-100 py-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold">{plan.brigade_name} — {plan.plan_level} {plan.year}{plan.month ? `/${plan.month}` : ''}{plan.week_number ? ` h${plan.week_number}` : ''}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                      {(['checkups', 'patronage', 'screening', 'dispensary_visits'] as const).map((k) => (
                        <div key={k} className="bg-slate-50 rounded p-1.5">
                          <span className="text-slate-500">{pc.planMetricLabel(k)}: </span>
                          <span className="font-bold">{plan.completed?.[k] ?? 0}/{plan.targets?.[k] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="text-xs text-emerald-700 font-bold shrink-0" onClick={() => refreshPlan(plan.id)}>{t('pc_refresh_plan')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimaryCareHub;
