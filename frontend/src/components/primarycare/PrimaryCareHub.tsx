import React, { useCallback, useEffect, useState } from 'react';
import PopulationPanel from '../population/PopulationPanel';
import PopulationPrimaryCareProfile from './PopulationPrimaryCareProfile';
import PrimaryCareGuide from './PrimaryCareGuide';
import { useTranslation } from '../../hooks/useTranslation';
import * as pc from '../../services/apiPrimaryCareService';

type HubTab = 'guide' | 'overview' | 'population' | 'brigades' | 'plans' | 'profile';

const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-2 text-sm w-full';
const btnPrimary = 'rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-60';

interface StatsExt extends pc.PrimaryCareStats {
  workflow?: Array<{ step: number; title: string; description: string; action: string }>;
  needs_setup?: boolean;
  overdue_population?: Array<{
    id: number; last_name: string; first_name: string; registry_number: string; next_checkup_date: string;
  }>;
}

interface PrimaryCareHubProps {
  initialProfileId?: number | null;
  onProfileConsumed?: () => void;
}

const PrimaryCareHub: React.FC<PrimaryCareHubProps> = ({ initialProfileId, onProfileConsumed }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HubTab>('guide');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<StatsExt | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [brigades, setBrigades] = useState<pc.MedicalBrigade[]>([]);
  const [plans, setPlans] = useState<pc.NetworkPlan[]>([]);
  const [programs, setPrograms] = useState<pc.ScreeningProgram[]>([]);
  const [brigadeForm, setBrigadeForm] = useState({ name: '', code: '', target_population_size: 3000 });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await pc.getPrimaryCareStats();
    if (res.success && res.data) {
      setStats(res.data as StatsExt);
      setStatsLoaded(true);
    } else {
      setStats(null);
      setStatsLoaded(false);
      setError(res.error?.message || t('pc_load_error'));
    }
    setLoading(false);
  }, [t]);

  const loadBrigades = useCallback(async () => {
    const res = await pc.listBrigades();
    if (res.success && res.data) setBrigades(res.data);
  }, []);

  const loadPlans = useCallback(async () => {
    const [pRes, prRes] = await Promise.all([pc.listNetworkPlans(), pc.listScreeningPrograms()]);
    if (pRes.success && pRes.data) setPlans(pRes.data);
    if (prRes.success && prRes.data) setPrograms(prRes.data);
  }, []);

  useEffect(() => {
    if (initialProfileId) {
      setSelectedId(initialProfileId);
      setTab('profile');
      onProfileConsumed?.();
    }
  }, [initialProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'brigades') loadBrigades();
    if (tab === 'plans') loadPlans();
  }, [tab, loadBrigades, loadPlans]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const runSetup = async () => {
    setSettingUp(true);
    setError(null);
    const res = await pc.setupPrimaryCare();
    setSettingUp(false);
    if (res.success && res.data) {
      const d = res.data as { brigade_name?: string; population_synced?: number; stats?: StatsExt };
      flash(
        t('pc_setup_done', {
          brigade: d.brigade_name || '—',
          n: d.population_synced ?? 0,
        }),
      );
      if (d.stats) setStats(d.stats as StatsExt);
      else loadOverview();
      loadBrigades();
    } else {
      setError(res.error?.message || t('pc_save_error'));
    }
  };

  const openProfile = (id: number) => {
    setSelectedId(id);
    setTab('profile');
  };

  const goFromWorkflow = (action: string) => {
    if (action === 'brigades') setTab('brigades');
    else if (action === 'population') setTab('population');
    else if (action === 'plans') setTab('plans');
    else if (action === 'profile') setTab(selectedId ? 'profile' : 'population');
    else setTab('overview');
  };

  const saveBrigade = async () => {
    if (!brigadeForm.name.trim()) { setError(t('pc_name_required')); return; }
    setError(null);
    const res = await pc.createBrigade(brigadeForm);
    if (res.success) {
      flash(t('pc_saved'));
      setBrigadeForm({ name: '', code: '', target_population_size: 3000 });
      loadBrigades();
      loadOverview();
    } else setError(res.error?.message || t('pc_save_error'));
  };

  const refreshPlan = async (id: number) => {
    setError(null);
    const res = await pc.refreshNetworkPlan(id);
    if (res.success) {
      loadPlans();
      loadOverview();
      flash(t('pc_plan_refreshed'));
    } else {
      setError(res.error?.message || t('pc_save_error'));
    }
  };

  const deleteBrigade = async (id: number) => {
    setError(null);
    const res = await pc.deleteBrigade(id);
    if (res.success) {
      loadBrigades();
      loadOverview();
      flash(t('pc_deleted'));
    } else {
      setError(res.error?.message || t('pc_save_error'));
    }
  };

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'guide', label: t('pc_tab_guide') },
    { id: 'overview', label: t('pc_tab_overview') },
    { id: 'population', label: t('population_title') },
    { id: 'brigades', label: t('pc_tab_brigades') },
    { id: 'plans', label: t('pc_tab_network') },
    ...(selectedId ? [{ id: 'profile' as HubTab, label: t('pc_tab_profile') }] : []),
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">{success}</div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'guide' && (
        <PrimaryCareGuide
          workflow={stats?.workflow}
          needsSetup={statsLoaded ? Boolean(stats?.needs_setup) : false}
          onSetup={runSetup}
          settingUp={settingUp}
          onGoTo={goFromWorkflow}
        />
      )}

      {tab === 'overview' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400 p-4">{t('loading_text')}</p>
          ) : stats ? (
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

              {stats.overdue_population && stats.overdue_population.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                  <h3 className="font-bold text-red-800 text-sm mb-2">{t('pc_overdue_list')}</h3>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {stats.overdue_population.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className="text-sm text-left w-full hover:bg-white/70 rounded-lg px-2 py-1.5 flex justify-between gap-2"
                          onClick={() => openProfile(row.id)}
                        >
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
                  <div className="space-y-2">
                    {stats.brigades.map((b) => (
                      <div key={b.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                        <span className="font-medium">{b.name}</span>
                        <span className="text-slate-500 tabular-nums">
                          {b.assigned_population}/{b.target}
                          {(b as { plan_completion_pct?: number }).plan_completion_pct != null && (
                            <span className="ml-2 text-emerald-600 text-xs">
                              {(b as { plan_completion_pct?: number }).plan_completion_pct}%
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.population_total === 0 && (
                <div className="text-center py-8 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-slate-600 text-sm mb-3">{t('pc_no_population_hint')}</p>
                  <button type="button" className={btnPrimary} onClick={() => setTab('population')}>
                    {t('pc_add_first_population')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-red-600">{t('pc_load_error')}</p>
          )}
        </div>
      )}

      {tab === 'population' && <PopulationPanel onOpenProfile={openProfile} />}

      {tab === 'profile' && selectedId && (
        <PopulationPrimaryCareProfile
          populationId={selectedId}
          onBack={() => setTab('population')}
        />
      )}

      {tab === 'brigades' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{t('pc_brigade_help')}</p>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="font-bold">{t('pc_add_brigade')}</h3>
              <input className={inputCls} value={brigadeForm.name} onChange={(e) => setBrigadeForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('pc_brigade_name')} />
              <input className={inputCls} value={brigadeForm.code} onChange={(e) => setBrigadeForm((f) => ({ ...f, code: e.target.value }))} placeholder={t('pc_brigade_code')} />
              <input type="number" className={inputCls} value={brigadeForm.target_population_size} onChange={(e) => setBrigadeForm((f) => ({ ...f, target_population_size: Number(e.target.value) }))} />
              <button type="button" className={btnPrimary} onClick={saveBrigade}>{t('pc_save')}</button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              {brigades.length === 0 ? (
                <p className="text-sm text-slate-400">{t('pc_empty_brigade')}</p>
              ) : brigades.map((b) => (
                <div key={b.id} className="flex justify-between py-2 border-b text-sm">
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-xs text-slate-500">{b.assigned_count ?? 0} / {b.target_population_size} {t('pc_assigned')}</p>
                  </div>
                  <button type="button" className="text-red-600 text-xs" onClick={() => deleteBrigade(b.id)}>
                    {t('pc_delete')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">{t('pc_plan_help')}</p>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-bold text-sm mb-2">{t('pc_programs')}</h3>
            <ul className="text-xs space-y-1 text-slate-600 mb-4">
              {programs.map((p) => (
                <li key={p.id}>• {p.name} ({p.age_min}–{p.age_max} yosh)</li>
              ))}
            </ul>
            <h3 className="font-bold text-sm mb-2">{t('pc_tab_network')}</h3>
            {plans.length === 0 ? (
              <p className="text-sm text-slate-400">{t('pc_empty_plans')}</p>
            ) : plans.map((plan) => (
              <div key={plan.id} className="border-b border-slate-100 py-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold">{plan.brigade_name} — {plan.plan_level} {plan.year}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      {(['checkups', 'patronage', 'screening'] as const).map((k) => (
                        <div key={k} className="bg-slate-50 rounded p-1.5">
                          <span className="text-slate-500">{k}: </span>
                          <span className="font-bold">{plan.completed?.[k] ?? 0}/{plan.targets?.[k] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="text-xs text-emerald-700 font-bold shrink-0" onClick={() => refreshPlan(plan.id)}>
                    {t('pc_refresh_plan')}
                  </button>
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
