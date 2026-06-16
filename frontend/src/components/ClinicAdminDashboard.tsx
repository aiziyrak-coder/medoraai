import React, { useCallback, useEffect, useState } from 'react';
import * as clinicAdmin from '../services/apiClinicAdminService';
import * as authService from '../services/apiAuthService';
import DeviceSessionBanner from './DeviceSessionBanner';
import { PhoneInputWith998 } from './PhoneInputWith998';

interface ClinicAdminDashboardProps {
  onBackToMain: () => void;
}

type Tab = 'overview' | 'users' | 'payments';

const MetricCard: React.FC<{ title: string; value: string | number; note?: string }> = ({ title, value, note }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <p className="mt-2 text-3xl font-black text-white">{value}</p>
    {note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}
  </div>
);

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
    inactive: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    approved: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-200 border-red-500/30',
  };
  return map[status] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
};

const ClinicAdminDashboard: React.FC<ClinicAdminDashboardProps> = ({ onBackToMain }) => {
  const currentUser = authService.getCurrentUser();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<clinicAdmin.ClinicAdminStats | null>(null);
  const [users, setUsers] = useState<clinicAdmin.ClinicAdminUser[]>([]);
  const [payments, setPayments] = useState<clinicAdmin.ClinicAdminPayment[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState<clinicAdmin.ClinicAdminUser | null>(null);
  const [newUser, setNewUser] = useState({ phone: '', name: '', password: '', role: 'clinic' as 'clinic' | 'staff' });
  const [resetPwd, setResetPwd] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [meRes, statsRes, usersRes, payRes] = await Promise.all([
      clinicAdmin.getClinicAdminMe(),
      clinicAdmin.getClinicAdminStats(),
      clinicAdmin.getClinicAdminUsers(),
      clinicAdmin.getClinicAdminPayments(),
    ]);

    if (!meRes.success || !meRes.data?.can_manage_clinic_group) {
      setError(meRes.error?.message || 'Ushbu panel faqat klinika guruhi administratori uchun.');
      setLoading(false);
      return;
    }
    if (!statsRes.success || !statsRes.data) {
      setError(statsRes.error?.message || "Ma'lumotlarni yuklab bo'lmadi.");
      setLoading(false);
      return;
    }
    setStats(statsRes.data);
    if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    if (payRes.success && payRes.data) setPayments(payRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await clinicAdmin.createClinicAdminUser(newUser);
    if (res.success) {
      flash('Foydalanuvchi qo\'shildi.');
      setShowAddUser(false);
      setNewUser({ phone: '', name: '', password: '', role: 'clinic' });
      loadAll();
    } else {
      flash(res.error?.message || 'Xatolik yuz berdi.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const res = await clinicAdmin.updateClinicAdminUser(editUser.id, {
      name: editUser.name,
      role: editUser.role,
      is_active: editUser.is_active,
      is_clinic_group_admin: editUser.is_clinic_group_admin,
      subscription_status: editUser.subscription_status,
    });
    if (res.success) {
      flash('Foydalanuvchi yangilandi.');
      setEditUser(null);
      loadAll();
    } else {
      flash(res.error?.message || 'Xatolik yuz berdi.');
    }
  };

  const handleActivate = async (u: clinicAdmin.ClinicAdminUser) => {
    const res = await clinicAdmin.activateClinicAdminSubscription(u.id, { duration_days: 30 });
    flash(res.success ? 'Obuna faollashtirildi.' : (res.error?.message || 'Xatolik.'));
    if (res.success) loadAll();
  };

  const handleLogoutUser = async (u: clinicAdmin.ClinicAdminUser) => {
    if (!window.confirm(`${u.name} barcha qurilmalardan chiqarilsinmi?`)) return;
    const res = await clinicAdmin.logoutClinicAdminUser(u.id);
    flash(res.success ? 'Qurilmalardan chiqarildi.' : (res.error?.message || 'Xatolik.'));
    if (res.success) loadAll();
  };

  const handleDeleteUser = async (u: clinicAdmin.ClinicAdminUser) => {
    if (!window.confirm(`${u.name} o'chirilsinmi? Bu qaytarib bo'lmaydi.`)) return;
    const res = await clinicAdmin.deleteClinicAdminUser(u.id);
    flash(res.success ? 'Foydalanuvchi o\'chirildi.' : (res.error?.message || 'Xatolik.'));
    if (res.success) loadAll();
  };

  const handleResetPassword = async () => {
    if (!editUser || resetPwd.length < 8) {
      flash('Parol kamida 8 belgidan iborat bo\'lishi kerak.');
      return;
    }
    const res = await clinicAdmin.resetClinicAdminPassword(editUser.id, resetPwd);
    flash(res.success ? 'Parol yangilandi.' : (res.error?.message || 'Xatolik.'));
    if (res.success) setResetPwd('');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Umumiy' },
    { id: 'users', label: 'Foydalanuvchilar' },
    { id: 'payments', label: 'To\'lovlar' },
  ];

  return (
    <div className="min-h-[100dvh] min-h-screen w-full medical-mesh-bg p-4 sm:p-6 md:p-10 overflow-y-auto touch-scroll-y pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">Klinika boshqaruvi</p>
            <h1 className="text-3xl md:text-4xl font-black text-white">
              {stats?.group.name || currentUser?.clinicGroupName || 'Klinika guruhi'}
            </h1>
            <p className="text-slate-300 mt-1">Jamoa, obuna va to'lovlarni boshqarish</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
            <DeviceSessionBanner variant="compact" tone="dark" />
            <button type="button" onClick={onBackToMain} className="text-sm font-semibold text-slate-300 hover:text-white">
              Asosiy sahifaga qaytish
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="mb-4 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
            {actionMsg}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">Yuklanmoqda...</div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">{error}</div>
        )}

        {!loading && !error && stats && (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <MetricCard title="Jamoa a'zolari" value={stats.members.total} note={`Faol: ${stats.members.active}`} />
                  <MetricCard title="Guruh adminlari" value={stats.members.admins} />
                  <MetricCard title="Faol obunalar" value={stats.subscriptions.active} note={`Kutilmoqda: ${stats.subscriptions.pending}`} />
                  <MetricCard
                    title="Joriy oy tushumi (so'm)"
                    value={Number(stats.payments.revenue_this_month_uzs || 0).toLocaleString('uz-UZ')}
                  />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-lg font-bold text-white mb-3">Rollar</h3>
                    <div className="space-y-2">
                      {stats.members.roles.map((r) => (
                        <div key={r.role} className="flex justify-between text-sm">
                          <span className="text-slate-300 capitalize">{r.role === 'staff' ? 'Registrator' : 'Shifokor/Klinika'}</span>
                          <span className="text-white font-semibold">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-lg font-bold text-white mb-3">To'lovlar</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-300">Kutilmoqda</span><span className="text-white font-semibold">{stats.payments.pending}</span></div>
                      <div className="flex justify-between"><span className="text-slate-300">Tasdiqlangan</span><span className="text-white font-semibold">{stats.payments.approved}</span></div>
                      <div className="flex justify-between"><span className="text-slate-300">Rad etilgan</span><span className="text-white font-semibold">{stats.payments.rejected}</span></div>
                      <div className="flex justify-between pt-2 border-t border-white/10">
                        <span className="text-slate-300">Jami tushum</span>
                        <span className="text-white font-semibold">{Number(stats.payments.revenue_total_uzs || 0).toLocaleString('uz-UZ')} so'm</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(true)}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold"
                  >
                    + Yangi foydalanuvchi
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-white/10">
                        <th className="p-3">Ism</th>
                        <th className="p-3">Telefon</th>
                        <th className="p-3">Rol</th>
                        <th className="p-3">Obuna</th>
                        <th className="p-3">Holat</th>
                        <th className="p-3">Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 text-slate-200">
                          <td className="p-3">
                            <div className="font-semibold text-white">{u.name}</div>
                            {u.is_clinic_group_admin && (
                              <span className="text-[10px] uppercase tracking-wide text-teal-300">Admin</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs">{u.phone}</td>
                          <td className="p-3">{u.role === 'staff' ? 'Registrator' : 'Shifokor'}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${statusBadge(u.subscription_status)}`}>
                              {u.subscription_status}
                            </span>
                          </td>
                          <td className="p-3">
                            {u.is_active ? (
                              <span className="text-emerald-300">Faol</span>
                            ) : (
                              <span className="text-red-300">Nofaol</span>
                            )}
                            {u.active_session_count > 0 && (
                              <span className="ml-1 text-xs text-slate-400">({u.active_session_count} sessiya)</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              <button type="button" onClick={() => { setEditUser({ ...u }); setResetPwd(''); }} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs">Tahrir</button>
                              {!u.has_active_subscription && u.role === 'clinic' && (
                                <button type="button" onClick={() => handleActivate(u)} className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-xs">Obuna</button>
                              )}
                              <button type="button" onClick={() => handleLogoutUser(u)} className="px-2 py-1 rounded bg-amber-600/60 hover:bg-amber-500 text-xs">Chiqarish</button>
                              {u.id !== (currentUser as { id?: number })?.id && (
                                <button type="button" onClick={() => handleDeleteUser(u)} className="px-2 py-1 rounded bg-red-600/60 hover:bg-red-500 text-xs">O'chirish</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'payments' && (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/10">
                      <th className="p-3">Sana</th>
                      <th className="p-3">Foydalanuvchi</th>
                      <th className="p-3">Reja</th>
                      <th className="p-3">Summa</th>
                      <th className="p-3">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-400">To'lovlar topilmadi</td></tr>
                    ) : payments.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 text-slate-200">
                        <td className="p-3 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString('uz-UZ') : '—'}</td>
                        <td className="p-3">
                          <div className="font-medium text-white">{p.user_name}</div>
                          <div className="text-xs text-slate-400 font-mono">{p.user_phone}</div>
                        </td>
                        <td className="p-3">{p.plan_name || '—'}</td>
                        <td className="p-3">{Number(p.amount).toLocaleString('uz-UZ')} so'm</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs ${statusBadge(p.status)}`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleAddUser} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Yangi foydalanuvchi</h3>
            <div>
              <label className="text-xs text-slate-400">Ism</label>
              <input required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Telefon</label>
              <PhoneInputWith998 value={newUser.phone} onChange={(phone) => setNewUser({ ...newUser, phone })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Parol</label>
              <input required type="password" minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Rol</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'clinic' | 'staff' })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white">
                <option value="clinic">Shifokor / Klinika</option>
                <option value="staff">Registrator</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 rounded-xl text-slate-300 hover:text-white">Bekor</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold">Saqlash</button>
            </div>
          </form>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleUpdateUser} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Foydalanuvchini tahrirlash</h3>
            <div>
              <label className="text-xs text-slate-400">Ism</label>
              <input required value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Rol</label>
              <select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'clinic' | 'staff' })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white">
                <option value="clinic">Shifokor / Klinika</option>
                <option value="staff">Registrator</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={editUser.is_active} onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })} />
              Faol hisob
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={editUser.is_clinic_group_admin} onChange={(e) => setEditUser({ ...editUser, is_clinic_group_admin: e.target.checked })} />
              Klinika guruhi admini
            </label>
            <div>
              <label className="text-xs text-slate-400">Obuna holati</label>
              <select value={editUser.subscription_status} onChange={(e) => setEditUser({ ...editUser, subscription_status: e.target.value as clinicAdmin.ClinicAdminUser['subscription_status'] })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white">
                <option value="active">Faol</option>
                <option value="pending">Kutilmoqda</option>
                <option value="inactive">Nofaol</option>
              </select>
            </div>
            <div className="border-t border-white/10 pt-4">
              <label className="text-xs text-slate-400">Yangi parol (ixtiyoriy)</label>
              <div className="flex gap-2 mt-1">
                <input type="password" minLength={8} value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white" placeholder="Kamida 8 belgi" />
                <button type="button" onClick={handleResetPassword} className="px-3 py-2 rounded-xl bg-amber-600/80 text-white text-sm">Parol</button>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 rounded-xl text-slate-300 hover:text-white">Bekor</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold">Saqlash</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClinicAdminDashboard;
