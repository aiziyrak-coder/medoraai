import React, { useMemo, useState } from 'react';
import type { User } from '../types';
import { formatUzs, usdToUzsCeil } from '../constants/currency';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface SubscriptionPageProps {
  user: User;
  onSubscriptionPending: () => void;
  onLogout: () => void;
}

type PlanMode = 'clinic' | 'doctor';

const CONTACT_PHONE = '+998937773154';

type ClinicTariffDef = {
  title: string;
  users: string;
  usdPerUserMonth: number;
  uzsPerUserMonthOverride?: number;
  features: string[];
  highlight?: boolean;
};

const clinicTariffsUsd: ClinicTariffDef[] = [
  {
    title: 'Klinika Start',
    users: '10 nafargacha foydalanuvchi',
    usdPerUserMonth: 10,
    features: ['Asosiy AI konsilium', 'Bitta klinika kabineti', 'Standart texnik yordam'],
  },
  {
    title: 'Klinika Growth',
    users: '20 nafargacha foydalanuvchi',
    usdPerUserMonth: 8,
    highlight: true,
    features: ['Kengaytirilgan konsilium oqimi', 'Jamoaviy boshqaruv imkoniyati', 'Tezkor prioritet yordam'],
  },
  {
    title: 'Klinika Enterprise',
    users: '20+ foydalanuvchi',
    usdPerUserMonth: 5,
    uzsPerUserMonthOverride: 75_000,
    features: ['Yuqori yuklama uchun optimizatsiya', "Rahbariyat uchun ko'rsatkichlar paneli", "Alohida joriy etish ko'magi"],
  },
];

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ user, onLogout }) => {
  const [mode, setMode] = useState<PlanMode>('clinic');
  const doctorMonthlyUzs = useMemo(() => usdToUzsCeil(10), []);
  const clinicTariffs = useMemo(
    () =>
      clinicTariffsUsd.map((t) => {
        const uzs = t.uzsPerUserMonthOverride ?? usdToUzsCeil(t.usdPerUserMonth);
        return {
          ...t,
          priceLabel: formatUzs(uzs),
          priceUnit: "foydalanuvchi / oy",
        };
      }),
    [],
  );
  const heroTitle = useMemo(
    () => (mode === 'clinic' ? 'Klinikalar uchun korporativ obuna' : 'Yakka shifokor uchun obuna'),
    [mode],
  );

  return (
    <div className="min-h-[100dvh] min-h-screen w-full medical-mesh-bg flex items-stretch sm:items-center justify-center py-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto touch-scroll-y">
      <div className="w-full max-w-5xl my-auto animate-fade-in-up">
        <div className="rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 mb-1">MedoraAI</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Obuna markazi</h1>
                <p className="text-sm text-slate-600 mt-1.5">
                  Hisob: <span className="font-semibold text-slate-800">{user.name}</span>
                  {user.phone ? (
                    <span className="text-slate-500"> · {user.phone}</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="shrink-0 text-sm font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Chiqish
              </button>
            </div>

            <div className="mt-5 flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setMode('clinic')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                  mode === 'clinic'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Klinika tarifi
              </button>
              <button
                type="button"
                onClick={() => setMode('doctor')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                  mode === 'doctor'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yakka shifokor
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 sm:px-8 py-6 sm:py-8 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
            <div className="max-w-3xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">{heroTitle}</h2>
              <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
                {mode === 'doctor'
                  ? `Oylik obuna ${formatUzs(doctorMonthlyUzs)} (10 USD bazaviy, kurs bo'yicha yaxlitlangan). Faollashtirish uchun operator bilan bog'laning.`
                  : "Klinika jamoasi uchun mos tarifni tanlang. Ro'yxatdan o'tishda jamoa soniga qarab eng qulay paket tavsiya qilinadi."}
              </p>
            </div>

            {mode === 'doctor' ? (
              <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm p-6 sm:p-8">
                <p className="text-sm text-slate-200 leading-relaxed">
                  <span className="font-semibold text-white">Yakka shifokor uchun</span> oylik obuna narxi:
                </p>
                <p className="mt-3 text-3xl sm:text-4xl font-black text-white tabular-nums">
                  {formatUzs(doctorMonthlyUzs)}
                  <span className="text-base font-semibold text-slate-400 ml-2">/ oy</span>
                </p>
                <p className="text-sm text-slate-300 mt-4">Faollashtirish uchun quyidagi raqamga bog'laning:</p>
                <a
                  href={`tel:${CONTACT_PHONE}`}
                  className="inline-flex mt-3 items-center gap-2 text-xl sm:text-2xl font-bold text-sky-300 hover:text-white transition-colors"
                >
                  {CONTACT_PHONE}
                </a>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {clinicTariffs.map((tariff) => (
                  <div
                    key={tariff.title}
                    className={`relative flex flex-col rounded-2xl p-5 transition-shadow ${
                      tariff.highlight
                        ? 'bg-white text-slate-900 shadow-xl ring-2 ring-sky-400/80'
                        : 'bg-white/95 text-slate-900 shadow-lg border border-white/20'
                    }`}
                  >
                    {tariff.highlight && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Tavsiya etiladi
                      </span>
                    )}
                    <p className="text-lg font-bold text-slate-900">{tariff.title}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{tariff.users}</p>
                    <div className="mt-4 pb-4 border-b border-slate-100">
                      <p className="text-2xl sm:text-[1.65rem] font-black text-slate-900 tabular-nums leading-tight">
                        {tariff.priceLabel}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{tariff.priceUnit}</p>
                    </div>
                    <ul className="mt-4 space-y-2 flex-1">
                      {tariff.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 leading-snug">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-slate-200 leading-relaxed">
                Savdo va joriy etish bo&apos;yicha bog&apos;lanish markazi
              </p>
              <a
                href={`tel:${CONTACT_PHONE}`}
                className="inline-flex items-center justify-center shrink-0 rounded-xl bg-white px-5 py-2.5 text-base font-bold text-blue-700 hover:bg-sky-50 transition-colors shadow-sm"
              >
                {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
