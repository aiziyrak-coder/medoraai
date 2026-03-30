import React, { useEffect, useState } from 'react';
import * as rectorService from '../services/apiRectorService';
import * as authService from '../services/apiAuthService';
import DeviceSessionBanner from './DeviceSessionBanner';

interface RectorDashboardProps {
  onBackToMain: () => void;
}

const MetricCard: React.FC<{ title: string; value: string | number; note?: string }> = ({ title, value, note }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <p className="mt-2 text-3xl font-black text-white">{value}</p>
    {note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}
  </div>
);

const RectorDashboard: React.FC<RectorDashboardProps> = ({ onBackToMain }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<rectorService.RectorStatsResponse | null>(null);
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await rectorService.getRectorStats();
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setError(res.error?.message || "Ma'lumotlarni yuklab bo'lmadi.");
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen w-full medical-mesh-bg p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-black text-white">Rektor paneli</h1>
            <p className="text-slate-300 mt-1">Foydalanuvchilar, obunalar va tushumlar monitoringi</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
            <DeviceSessionBanner variant="compact" tone="dark" />
            <button onClick={onBackToMain} className="text-sm font-semibold text-slate-300 hover:text-white">
              Asosiy sahifaga qaytish
            </button>
          </div>
        </div>

        {currentUser?.role !== 'clinic' && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Kirgan akkaunt: {currentUser?.name || currentUser?.phone}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">Yuklanmoqda...</div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">{error}</div>
        )}

        {!loading && !error && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard title="Jami foydalanuvchilar" value={stats.users.total} note={`Oxirgi 30 kunda: +${stats.users.new_last_30_days}`} />
              <MetricCard title="Faol obunalar" value={stats.subscriptions.active} />
              <MetricCard title="Kutilayotgan to'lovlar" value={stats.payments.pending} />
              <MetricCard
                title="Joriy oy tushumi (so'm)"
                value={Number(stats.payments.revenue_this_month_uzs || 0).toLocaleString('uz-UZ')}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-bold text-white mb-3">Rollar bo'yicha taqsimot</h3>
                <div className="space-y-2">
                  {stats.users.roles.map((r) => (
                    <div key={r.role} className="flex justify-between text-sm">
                      <span className="text-slate-300 capitalize">{r.role}</span>
                      <span className="text-white font-semibold">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-bold text-white mb-3">Tariflar bo'yicha tasdiqlangan to'lovlar</h3>
                <div className="space-y-2">
                  {stats.payments.approved_by_plan.map((p, idx) => (
                    <div key={`${p.plan__name || 'none'}-${idx}`} className="flex justify-between text-sm">
                      <span className="text-slate-300">{p.plan__name || 'Rejasiz'}</span>
                      <span className="text-white font-semibold">
                        {p.count} ta / {Number(p.amount || 0).toLocaleString('uz-UZ')} so'm
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RectorDashboard;
