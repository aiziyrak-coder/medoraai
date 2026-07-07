import React, { useCallback, useEffect, useState } from 'react';
import * as pc from '../../services/apiPrimaryCareService';
import { useTranslation } from '../../hooks/useTranslation';

const sectionCls = 'rounded-xl border border-slate-200 bg-white p-4 space-y-3';

interface Props {
  onOpenProfile: (id: number) => void;
  brigadeId?: number;
}

const PrimaryCareOperationsTab: React.FC<Props> = ({ onOpenProfile, brigadeId }) => {
  const { t } = useTranslation();
  const [sub, setSub] = useState<'overdue' | 'screening' | 'checkups' | 'patronage' | 'dispensary'>('overdue');
  const [loading, setLoading] = useState(false);
  const [overdue, setOverdue] = useState<Array<{ id: number; last_name: string; first_name: string; registry_number: string; next_checkup_date: string }>>([]);
  const [screening, setScreening] = useState<pc.ScreeningEnrollment[]>([]);
  const [checkups, setCheckups] = useState<pc.PreventiveCheckup[]>([]);
  const [patronage, setPatronage] = useState<pc.PatronageVisit[]>([]);
  const [dispensary, setDispensary] = useState<pc.DispensaryRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    if (sub === 'overdue') {
      const stats = await pc.getPrimaryCareStats(brigadeId ? { brigade_id: brigadeId } : undefined);
      setOverdue(stats.success && stats.data?.overdue_population ? stats.data.overdue_population : []);
    } else if (sub === 'screening') {
      const res = await pc.listScreeningEnrollments(brigadeId ? { brigade: brigadeId } : undefined);
      setScreening(res.success && res.data ? res.data.filter((e) => ['planned', 'invited'].includes(e.status)).slice(0, 100) : []);
    } else if (sub === 'checkups') {
      const res = await pc.listCheckups(brigadeId ? { brigade: brigadeId } : undefined);
      setCheckups(res.success && res.data ? res.data.slice(0, 100) : []);
    } else if (sub === 'patronage') {
      const res = await pc.listPatronage(brigadeId ? { brigade: brigadeId } : undefined);
      setPatronage(res.success && res.data ? res.data.slice(0, 100) : []);
    } else {
      const res = await pc.listDispensary(brigadeId ? { brigade: brigadeId, is_active: true } : { is_active: true });
      setDispensary(res.success && res.data ? res.data.slice(0, 100) : []);
    }
    setLoading(false);
  }, [sub, brigadeId]);

  useEffect(() => { load(); }, [load]);

  const subs: Array<{ id: typeof sub; labelKey: string }> = [
    { id: 'overdue', labelKey: 'pc_overdue_list' },
    { id: 'screening', labelKey: 'pc_tab_screening' },
    { id: 'checkups', labelKey: 'pc_tab_checkups' },
    { id: 'patronage', labelKey: 'pc_tab_patronage' },
    { id: 'dispensary', labelKey: 'pc_tab_dispensary' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3">{t('pc_operations_help')}</p>
      <div className="flex flex-wrap gap-1">
        {subs.map(({ id, labelKey }) => (
          <button key={id} type="button" onClick={() => setSub(id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${sub === id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {t(labelKey)}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">{t('loading_text')}</p>
      ) : (
        <div className={sectionCls}>
          {sub === 'overdue' && (
            overdue.length === 0 ? <p className="text-sm text-slate-400">{t('pc_no_overdue')}</p> : (
              <ul className="space-y-1 max-h-96 overflow-y-auto">
                {overdue.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="w-full text-left text-sm py-2 px-2 hover:bg-slate-50 rounded-lg flex justify-between" onClick={() => onOpenProfile(row.id)}>
                      <span>{row.last_name} {row.first_name} <span className="text-slate-400 font-mono text-xs">{row.registry_number}</span></span>
                      <span className="text-red-600 text-xs">{row.next_checkup_date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
          {sub === 'screening' && (screening.length === 0 ? <p className="text-sm text-slate-400">{t('pc_empty_screening')}</p> : screening.map((e) => (
            <div key={e.id} className="flex justify-between py-2 border-b text-sm">
              <button type="button" className="text-left hover:text-emerald-700" onClick={() => onOpenProfile(e.population)}>
                {e.population_name || `#${e.population}`} — {e.program_name}
              </button>
              <span className="text-xs text-slate-500">{e.status}</span>
            </div>
          )))}
          {sub === 'checkups' && (checkups.length === 0 ? <p className="text-sm text-slate-400">{t('pc_empty_checkups')}</p> : checkups.map((c) => (
            <div key={c.id} className="flex justify-between py-2 border-b text-sm">
              <button type="button" className="text-left" onClick={() => onOpenProfile(c.population)}>{c.population_name}</button>
              <span className="text-xs text-slate-500">{c.checkup_date}</span>
            </div>
          )))}
          {sub === 'patronage' && (patronage.length === 0 ? <p className="text-sm text-slate-400">{t('pc_empty_patronage')}</p> : patronage.map((v) => (
            <div key={v.id} className="flex justify-between py-2 border-b text-sm">
              <button type="button" className="text-left" onClick={() => onOpenProfile(v.population)}>{v.population_name}</button>
              <span className="text-xs text-slate-500">{v.visit_date}</span>
            </div>
          )))}
          {sub === 'dispensary' && (dispensary.length === 0 ? <p className="text-sm text-slate-400">{t('pc_empty_dispensary')}</p> : dispensary.map((d) => (
            <div key={d.id} className="flex justify-between py-2 border-b text-sm">
              <button type="button" className="text-left" onClick={() => onOpenProfile(d.population)}>{d.population_name || d.diagnosis}</button>
              <span className="text-xs text-slate-500">{d.diagnosis}</span>
            </div>
          )))}
        </div>
      )}
    </div>
  );
};

export default PrimaryCareOperationsTab;
