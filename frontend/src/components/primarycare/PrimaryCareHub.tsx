import React, { useCallback, useEffect, useState } from 'react';
import PopulationPanel from '../population/PopulationPanel';
import PopulationPrimaryCareProfile from './PopulationPrimaryCareProfile';
import { useTranslation } from '../../hooks/useTranslation';
import * as pc from '../../services/apiPrimaryCareService';
import { listBrigades, createBrigade, deleteBrigade } from '../../services/apiPrimaryCareService';

type HubTab = 'overview' | 'population' | 'brigades' | 'profile';

const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-2 text-sm w-full';
const btnPrimary = 'rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-700';

const PrimaryCareHub: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HubTab>('overview');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<pc.PrimaryCareStats | null>(null);
  const [brigades, setBrigades] = useState<pc.MedicalBrigade[]>([]);
  const [brigadeForm, setBrigadeForm] = useState({ name: '', code: '', target_population_size: 3000 });

  const loadOverview = useCallback(async () => {
    const res = await pc.getPrimaryCareStats();
    if (res.success && res.data) setStats(res.data);
  }, []);

  const loadBrigades = useCallback(async () => {
    const res = await listBrigades();
    if (res.success && res.data) setBrigades(res.data);
  }, []);

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    if (tab === 'brigades') loadBrigades();
  }, [tab, loadOverview, loadBrigades]);

  const openProfile = (id: number) => {
    setSelectedId(id);
    setTab('profile');
  };

  const saveBrigade = async () => {
    if (!brigadeForm.name.trim()) return;
    await createBrigade(brigadeForm);
    setBrigadeForm({ name: '', code: '', target_population_size: 3000 });
    loadBrigades();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <h2 className="text-lg font-black text-emerald-900">{t('pc_title')}</h2>
        <p className="text-xs text-emerald-800/80 mt-1">{t('pc_subtitle_integrated')}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([
          ['overview', 'pc_tab_overview'],
          ['population', 'population_title'],
          ['brigades', 'pc_tab_brigades'],
          ...(selectedId ? [['profile', 'pc_tab_profile'] as const] : []),
        ] as const).map(([id, labelKey]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as HubTab)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [t('pc_stat_population'), stats.population_total],
              [t('pc_stat_checkups_ytd'), stats.checkups_ytd],
              [t('pc_stat_patronage_ytd'), stats.patronage_visits_ytd],
              [t('pc_stat_overdue'), stats.overdue_checkups],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-2xl font-black text-slate-800">{val}</p>
              </div>
            ))}
          </div>
          {(stats as pc.PrimaryCareStats & { overdue_population?: Array<{ id: number; last_name: string; first_name: string; registry_number: string; next_checkup_date: string }> }).overdue_population?.length ? (
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
              <h3 className="font-bold text-red-800 text-sm mb-2">{t('pc_overdue_list')}</h3>
              <ul className="space-y-1">
                {(stats as pc.PrimaryCareStats & { overdue_population?: Array<{ id: number; last_name: string; first_name: string; registry_number: string; next_checkup_date: string }> }).overdue_population!.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="text-sm text-left w-full hover:bg-white/60 rounded px-2 py-1" onClick={() => openProfile(row.id)}>
                      <span className="font-medium">{row.last_name} {row.first_name}</span>
                      <span className="text-xs text-red-600 ml-2">{row.next_checkup_date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {stats.brigades.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm flex justify-between">
              <span className="font-semibold">{b.name}</span>
              <span className="text-slate-500">{b.assigned_population}/{b.target}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'population' && (
        <PopulationPanel onOpenProfile={openProfile} />
      )}

      {tab === 'profile' && selectedId && (
        <PopulationPrimaryCareProfile
          populationId={selectedId}
          onBack={() => setTab('population')}
        />
      )}

      {tab === 'brigades' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <h3 className="font-bold">{t('pc_add_brigade')}</h3>
            <input className={inputCls} value={brigadeForm.name} onChange={(e) => setBrigadeForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('pc_brigade_name')} />
            <input className={inputCls} value={brigadeForm.code} onChange={(e) => setBrigadeForm((f) => ({ ...f, code: e.target.value }))} />
            <button type="button" className={btnPrimary} onClick={saveBrigade}>{t('pc_save')}</button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {brigades.map((b) => (
              <div key={b.id} className="flex justify-between py-2 border-b text-sm">
                <span>{b.name} ({b.assigned_count}/{b.target_population_size})</span>
                <button type="button" className="text-red-600 text-xs" onClick={() => deleteBrigade(b.id).then(loadBrigades)}>{t('pc_delete')}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimaryCareHub;
