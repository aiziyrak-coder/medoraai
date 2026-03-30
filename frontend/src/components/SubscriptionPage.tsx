import React, { useMemo, useState } from 'react';
import type { User } from '../types';
import { formatUzs, usdToUzsCeil } from '../constants/currency';

interface SubscriptionPageProps {
  user: User;
  onSubscriptionPending: () => void;
  onLogout: () => void;
}

type PlanMode = 'clinic' | 'doctor';

const CONTACT_PHONE = '+998907863888';

type ClinicTariffDef = {
  title: string;
  users: string;
  /** Bazaviy USD (kurs bo'yicha so'm); `uzsPerUserMonthOverride` bo'lsa u ustun. */
  usdPerUserMonth: number;
  uzsPerUserMonthOverride?: number;
  features: string[];
};

const clinicTariffsUsd: ClinicTariffDef[] = [
  {
    title: 'Klinika Start',
    users: "10 nafargacha foydalanuvchi",
    usdPerUserMonth: 10,
    features: ['Asosiy AI konsilium', 'Bitta klinika kabineti', 'Standart texnik yordam'],
  },
  {
    title: 'Klinika Growth',
    users: "20 nafargacha foydalanuvchi",
    usdPerUserMonth: 8,
    features: ['Kengaytirilgan konsilium oqimi', 'Jamoaviy boshqaruv imkoniyati', 'Tezkor prioritet yordam'],
  },
  {
    title: 'Klinika Enterprise',
    users: "20+ foydalanuvchi",
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
        const uzs =
          t.uzsPerUserMonthOverride ?? usdToUzsCeil(t.usdPerUserMonth);
        return {
          ...t,
          priceLabel: `${formatUzs(uzs)} / foydalanuvchi / oy`,
        };
      }),
    [],
  );
  const heroTitle = useMemo(
    () => (mode === 'clinic' ? 'Klinikalar uchun korporativ obuna' : 'Yakka shifokor uchun obuna'),
    [mode],
  );

  return (
    <div className="min-h-screen w-full medical-mesh-bg flex items-center justify-center p-4">
      <div className="glass-panel max-w-4xl w-full p-6 md:p-10 animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-white">Obuna markazi</h1>
          <button onClick={onLogout} className="text-sm text-slate-400 hover:text-white">Chiqish</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Hisob: {user.name} ({user.phone})</p>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-1 flex gap-1">
          <button
            onClick={() => setMode('clinic')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === 'clinic' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}
          >
            Klinika tarifi
          </button>
          <button
            onClick={() => setMode('doctor')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === 'doctor' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}
          >
            Yakka shifokor
          </button>
        </div>

        <div className="rounded-3xl p-6 md:p-8 text-white bg-gradient-to-br from-blue-600 to-indigo-700 border border-white/10">
          <h2 className="text-2xl font-bold">{heroTitle}</h2>
          <p className="text-blue-100 mt-2">
            {mode === 'doctor'
              ? `Oylik obuna qiymati ${formatUzs(doctorMonthlyUzs)} (10 USD bazaviy, kurs bo'yicha yaxlitlangan). To'lov jarayoni va aktivatsiya bo'yicha operator bilan bog'laning.`
              : "Klinika jamoasi uchun mos tarifni tanlang. Ro'yxatdan o'tishda jamoa soniga qarab eng qulay paket tavsiya qilinadi."}
          </p>

          {mode === 'doctor' ? (
            <div className="mt-5 rounded-2xl border border-white/20 bg-black/20 p-5">
              <p className="text-sm text-blue-100">
                <strong>Yakka shifokor uchun:</strong> oylik obuna {formatUzs(doctorMonthlyUzs)}.
              </p>
              <p className="text-sm text-blue-100 mt-2">
                Faollashtirish uchun quyidagi raqamga bog'laning:
              </p>
              <a href={`tel:${CONTACT_PHONE}`} className="block mt-3 text-2xl font-black hover:underline">
                {CONTACT_PHONE}
              </a>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {clinicTariffs.map((tariff) => (
                <div key={tariff.title} className="rounded-2xl border border-white/20 bg-black/20 p-4">
                  <p className="text-lg font-bold">{tariff.title}</p>
                  <p className="text-xs text-blue-200 mt-1">{tariff.users}</p>
                  <p className="text-xl font-black mt-2">{tariff.priceLabel}</p>
                  <ul className="mt-3 space-y-1 text-xs text-blue-100">
                    {tariff.features.map((f) => (
                      <li key={f}>- {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4">
            <p className="text-sm text-yellow-100">
              Savdo va joriy etish bo'yicha bog'lanish markazi: <a href={`tel:${CONTACT_PHONE}`} className="font-bold underline">{CONTACT_PHONE}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
