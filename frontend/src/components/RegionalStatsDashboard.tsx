import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as regionalStatsService from '../services/apiRegionalStatsService';
import DeviceSessionBanner from './DeviceSessionBanner';
import type { User } from '../types';

interface RegionalStatsDashboardProps {
  user: User;
  onLogout: () => void;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  note?: string;
  accent?: string;
}> = ({ title, value, note, accent = 'from-cyan-500/20 to-emerald-500/10' }) => (
  <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-5 backdrop-blur-sm`}>
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <p className="mt-2 text-3xl font-black text-white tabular-nums">{value}</p>
    {note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}
  </div>
);

const BarRow: React.FC<{ label: string; sub?: string; count: number; max: number; color: string }> = ({
  label, sub, count, max, color,
}) => (
  <div className="flex items-center gap-2 text-xs">
    <div className="w-28 sm:w-36 shrink-0 min-w-0">
      <span className="block truncate text-slate-200 font-medium" title={label}>{label}</span>
      {sub && <span className="block truncate text-[10px] text-slate-500" title={sub}>{sub}</span>}
    </div>
    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(count > 0 ? 8 : 0, (count / max) * 100)}%` }} />
    </div>
    <span className="font-mono font-bold text-white w-8 text-right tabular-nums">{count}</span>
  </div>
);

const WEEKDAY_UZ = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

const RegionalStatsDashboard: React.FC<RegionalStatsDashboardProps> = ({ user, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<regionalStatsService.RegionalStatsResponse | null>(null);
  const [districtFilter, setDistrictFilter] = useState('');

  const load = useCallback(async (districtId?: string) => {
    setLoading(true);
    setError(null);
    const res = await regionalStatsService.getRegionalStats(districtId || undefined);
    if (res.success && res.data) {
      setStats(res.data);
    } else {
      setError(res.error?.message || "Statistikani yuklab bo'lmadi.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDistrictChange = (id: string) => {
    setDistrictFilter(id);
    load(id || undefined);
  };

  const maxDistrictPatients = useMemo(
    () => Math.max(...(stats?.districts.map((d) => d.patient_count) ?? [0]), 1),
    [stats],
  );
  const maxDiagnosis = useMemo(
    () => Math.max(...(stats?.common_diagnoses.map((d) => d.count) ?? [0]), 1),
    [stats],
  );
  const maxWeekly = useMemo(
    () => Math.max(...(stats?.weekly_activity.map((d) => d.count) ?? [0]), 1),
    [stats],
  );
  const maxMonthly = useMemo(
    () => Math.max(...(stats?.monthly_trend.map((d) => d.count) ?? [0]), 1),
    [stats],
  );

  const feedbackPct = stats?.summary.feedback_accuracy != null
    ? Math.round(stats.summary.feedback_accuracy * 100)
    : null;

  const shortDistrict = (name: string) => name.replace(/ tumani| shahri/gi, '').trim();

  return (
    <div className="min-h-[100dvh] min-h-screen w-full medical-mesh-bg p-4 sm:p-6 md:p-8 overflow-y-auto touch-scroll-y pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/80 mb-1">
              Viloyat sog&apos;liqni saqlash boshqarmasi
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight">
              {stats?.region_name || user.name}
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              {user.name} · {user.phone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
            <DeviceSessionBanner variant="compact" tone="dark" />
            <button
              onClick={onLogout}
              className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
            >
              Chiqish
            </button>
          </div>
        </div>

        {/* District filter */}
        {stats && stats.districts.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400 font-medium">Tuman bo&apos;yicha filtr:</label>
            <select
              value={districtFilter}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 text-white text-sm px-3 py-2 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="" className="bg-slate-900">Barcha tumanlar</option>
              {stats.districts.map((d) => (
                <option key={d.district_id} value={d.district_id} className="bg-slate-900">
                  {shortDistrict(d.district_name)} ({d.patient_count})
                </option>
              ))}
            </select>
            {districtFilter && (
              <button
                onClick={() => handleDistrictChange('')}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Filtrni tozalash
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-slate-300">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
            Statistika yuklanmoqda...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">{error}</div>
        )}

        {!loading && !error && stats && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <MetricCard title="Jami bemorlar" value={stats.summary.total_patients.toLocaleString('uz-UZ')} accent="from-violet-500/25 to-indigo-500/10" />
              <MetricCard title="Jami tahlillar" value={stats.summary.total_analyses.toLocaleString('uz-UZ')} accent="from-cyan-500/25 to-blue-500/10" />
              <MetricCard title="Oxirgi 30 kun" value={stats.summary.count_last_30d} note="yangi tahlillar" accent="from-emerald-500/25 to-teal-500/10" />
              <MetricCard title="Yangi bemorlar" value={stats.summary.new_patients_30d} note="oxirgi 30 kunda" accent="from-amber-500/20 to-orange-500/10" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard title="Bugun" value={stats.summary.count_last_24h} note="tahlil" accent="from-sky-500/20 to-cyan-500/10" />
              <MetricCard title="7 kun" value={stats.summary.count_last_7d} note="tahlil" accent="from-teal-500/20 to-emerald-500/10" />
              <MetricCard
                title="Aniqlik"
                value={feedbackPct != null ? `${feedbackPct}%` : '—'}
                note={stats.summary.feedback_count > 0 ? `${stats.summary.feedback_count} baho` : 'baho yo\'q'}
                accent="from-pink-500/20 to-rose-500/10"
              />
              <MetricCard title="Tumanlar" value={stats.districts.length} note="bemorlar bilan" accent="from-slate-500/20 to-slate-600/10" />
            </div>

            {stats.primary_care_210 && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <h3 className="text-lg font-bold text-white mb-1">210-buyruq — birlamchi tibbiy yordam</h3>
                <p className="text-xs text-slate-500 mb-4">Profilaktika, skrining, patronaj, dispanser</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard title="Aholi" value={stats.primary_care_210.population_total} accent="from-emerald-500/20 to-green-500/10" />
                  <MetricCard title="Ko'riklar (yil)" value={stats.primary_care_210.checkups_ytd} accent="from-teal-500/20 to-cyan-500/10" />
                  <MetricCard title="Patronaj (yil)" value={stats.primary_care_210.patronage_visits_ytd} accent="from-blue-500/20 to-indigo-500/10" />
                  <MetricCard title="Muddat o'tgan" value={stats.primary_care_210.overdue_checkups} note="keyingi ko'rik" accent="from-amber-500/20 to-orange-500/10" />
                  <MetricCard title="Skrining" value={stats.primary_care_210.screening_completed} note={`rejada: ${stats.primary_care_210.screening_planned}`} accent="from-violet-500/20 to-purple-500/10" />
                  <MetricCard title="Dispanser" value={stats.primary_care_210.dispensary_active} accent="from-rose-500/20 to-pink-500/10" />
                  <MetricCard title="Brigadaga biriktirilgan" value={stats.primary_care_210.with_brigade} accent="from-slate-500/20 to-slate-600/10" />
                  <MetricCard title="Brigadalar" value={stats.primary_care_210.brigades.length} accent="from-cyan-500/20 to-sky-500/10" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Districts */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-bold text-white mb-1">Tumanlar bo&apos;yicha bemorlar</h3>
                <p className="text-xs text-slate-500 mb-4">Viloyat bo&apos;ylab taqsimot</p>
                {stats.districts.length > 0 ? (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {stats.districts.map((d) => (
                      <BarRow
                        key={d.district_id}
                        label={shortDistrict(d.district_name)}
                        sub={`${d.analysis_count} tahlil`}
                        count={d.patient_count}
                        max={maxDistrictPatients}
                        color="bg-gradient-to-r from-emerald-400 to-cyan-500"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-6 text-center">Hozircha ma&apos;lumot yo&apos;q</p>
                )}
              </div>

              {/* Diagnoses */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-bold text-white mb-1">Kasalliklar statistikasi</h3>
                <p className="text-xs text-slate-500 mb-4">Eng ko&apos;p qo&apos;yilgan tashxislar</p>
                {stats.common_diagnoses.length > 0 ? (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {stats.common_diagnoses.map((d, i) => (
                      <BarRow
                        key={`${d.name}-${i}`}
                        label={d.name}
                        count={d.count}
                        max={maxDiagnosis}
                        color="bg-gradient-to-r from-violet-400 to-purple-500"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-6 text-center">Tashxis ma&apos;lumotlari yo&apos;q</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Gender */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-base font-bold text-white mb-3">Jins bo&apos;yicha</h3>
                {stats.gender_breakdown.length > 0 ? (
                  <div className="space-y-2">
                    {stats.gender_breakdown.map((g) => (
                      <div key={g.gender} className="flex justify-between text-sm">
                        <span className="text-slate-300">{g.label}</span>
                        <span className="text-white font-semibold tabular-nums">{g.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Ma&apos;lumot yo&apos;q</p>
                )}
              </div>

              {/* Age */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-base font-bold text-white mb-3">Yosh guruhi</h3>
                {stats.age_breakdown.length > 0 ? (
                  <div className="space-y-2">
                    {stats.age_breakdown.map((a) => (
                      <div key={a.group} className="flex justify-between text-sm">
                        <span className="text-slate-300">{a.group} yosh</span>
                        <span className="text-white font-semibold tabular-nums">{a.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Ma&apos;lumot yo&apos;q</p>
                )}
              </div>

              {/* Weekly activity */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-base font-bold text-white mb-3">Haftalik faollik</h3>
                <div className="flex items-end justify-between gap-1 h-24">
                  {stats.weekly_activity.map((day) => {
                    const dt = new Date(day.date);
                    const label = WEEKDAY_UZ[dt.getDay()] ?? day.date.slice(5);
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <span className="text-[10px] font-mono text-slate-400">{day.count || ''}</span>
                        <div className="w-full flex items-end justify-center h-14">
                          <div
                            className="w-full max-w-[1.5rem] rounded-t-md bg-gradient-to-t from-cyan-600 to-emerald-400"
                            style={{ height: `${Math.max(8, (day.count / maxWeekly) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-500">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Monthly trend */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-bold text-white mb-4">Oylik dinamika (6 oy)</h3>
              <div className="flex items-end justify-between gap-2 h-32">
                {stats.monthly_trend.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-xs font-mono text-slate-300">{m.count}</span>
                    <div className="w-full flex items-end justify-center h-20">
                      <div
                        className="w-full max-w-[2.5rem] rounded-t-lg bg-gradient-to-t from-indigo-600 to-violet-400"
                        style={{ height: `${Math.max(8, (m.count / maxMonthly) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 truncate w-full text-center">{m.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clinics */}
            {stats.clinics.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-bold text-white mb-1">Klinikalar bo&apos;yicha</h3>
                <p className="text-xs text-slate-500 mb-4">Viloyatdagi faol klinika guruhlari</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-white/10">
                        <th className="pb-2 font-medium">Klinika</th>
                        <th className="pb-2 font-medium text-right">Bemorlar</th>
                        <th className="pb-2 font-medium text-right">Tahlillar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.clinics.map((c, i) => (
                        <tr key={`${c.clinic_name}-${i}`} className="border-b border-white/5">
                          <td className="py-2.5 text-slate-200 pr-4">{c.clinic_name}</td>
                          <td className="py-2.5 text-right text-white font-semibold tabular-nums">{c.patient_count}</td>
                          <td className="py-2.5 text-right text-cyan-300 font-semibold tabular-nums">{c.analysis_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 text-center">
              Yangilangan: {new Date(stats.generated_at).toLocaleString('uz-UZ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionalStatsDashboard;
