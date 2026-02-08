import React, { useState, useEffect, useRef } from 'react';
import type { User, SubscriptionPlan } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import * as telegramService from '../services/telegramService';
import * as apiSubscription from '../services/apiSubscriptionService';
import * as authService from '../services/authService';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import UploadCloudIcon from './icons/UploadCloudIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface SubscriptionPageProps {
    user: User;
    onSubscriptionPending: () => void;
    onLogout: () => void;
}

/** Klinika: 500$/oy, hisob raqam */
const CLINIC_PRICE_USD = 500;
/** Shifokor: 10$/oy, chek */
const DOCTOR_PRICE_USD = 10;

/** Bank rekvizitlari – klinikalar uchun hisob raqamdan o'tkazma (500$/oy). Haqiqiy ma'lumotlarni qo'ying. */
const BANK_ACCOUNT = {
    bankName: 'Bank nomi',
    accountNumber: '20214000901234567890',
    mfo: '00447',
    inn: '123456789',
    receiver: 'MEDORA AI',
};

/** Shifokor uchun default reja (API dan kelmasa) */
const DEFAULT_DOCTOR_PLAN: SubscriptionPlan = {
    id: 0,
    name: 'Shifokor (oylik)',
    slug: 'doctor',
    plan_type: 'doctor',
    description: 'Chek yuborish orqali. Admin tasdiqlagach 30 kun faol.',
    price_monthly: DOCTOR_PRICE_USD,
    price_currency: 'USD',
    duration_days: 30,
    features: ['Oylik obuna 10$', 'Chek yuborish orqali to\'lov', 'Admin tasdiqlagach 30 kun faol'],
    is_trial: false,
    trial_days: 0,
    max_analyses_per_month: null,
    sort_order: 0,
};

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ user, onSubscriptionPending, onLogout }) => {
    const [doctorPlan, setDoctorPlan] = useState<SubscriptionPlan | null>(null);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiSubscription.getSubscriptionPlans();
                if (res.success && res.data && res.data.length > 0) {
                    const doctor = res.data.find((p) => p.slug === 'doctor' || p.plan_type === 'doctor');
                    setDoctorPlan(doctor || res.data[0] || DEFAULT_DOCTOR_PLAN);
                } else {
                    setDoctorPlan(DEFAULT_DOCTOR_PLAN);
                }
            } catch {
                setDoctorPlan(DEFAULT_DOCTOR_PLAN);
            } finally {
                setLoadingPlans(false);
            }
        };
        load();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setError("Fayl hajmi 5MB dan oshmasligi kerak.");
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError(null);
        }
    };

    const handleCopyAccount = () => {
        navigator.clipboard.writeText(BANK_ACCOUNT.accountNumber);
        alert(t('alert_copied'));
    };

    const handleCopyCard = () => {
        navigator.clipboard.writeText("9860356627000702");
        alert(t('alert_copied'));
    };

    const doctorAmount = doctorPlan ? Number(doctorPlan.price_monthly) : DOCTOR_PRICE_USD;

    const handleSubmit = async () => {
        if (!selectedFile) {
            setError("Iltimos, to'lov chekini yuklang.");
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const result = await telegramService.sendPaymentReceipt(
                selectedFile,
                user,
                doctorAmount,
                doctorPlan?.id || undefined
            );

            if (result.success) {
                authService.updateUserSubscription(user.phone, 'pending');
                onSubscriptionPending();
            } else {
                setError(result.message || "Xatolik yuz berdi.");
            }
        } catch (err) {
            setError("Tizim xatoligi. Qayta urinib ko'ring.");
        } finally {
            setIsUploading(false);
        }
    };

    if (user.subscriptionStatus === 'pending') {
        return (
            <div className="min-h-screen w-full medical-mesh-bg flex items-center justify-center p-4">
                <div className="glass-panel max-w-lg w-full p-8 text-center animate-fade-in-up">
                    <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <SpinnerIcon className="w-10 h-10 text-yellow-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Tekshirilmoqda</h2>
                    <p className="text-slate-300 mb-6">
                        {user.role === 'clinic'
                            ? "To'lovingiz qabul qilindi. Admin hisob raqamni tekshirgach obunani faollashtiradi."
                            : "Chekingiz qabul qilindi va adminlar tomonidan tekshirilmoqda. Odatda 5–10 daqiqa vaqt oladi."}
                    </p>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-6 text-sm text-slate-400">
                        Sahifani yangilang yoki birozdan so'ng qayta kiring.
                    </div>
                    <button onClick={onLogout} className="text-sm font-bold text-blue-400 hover:text-white">
                        Chiqish
                    </button>
                </div>
            </div>
        );
    }

    // --- KLINIKA: Shartnoma asosida, 500$/oy, hisob raqamdan o'tkazma ---
    if (user.role === 'clinic') {
        return (
            <div className="min-h-screen w-full medical-mesh-bg flex items-center justify-center p-4">
                <div className="glass-panel max-w-2xl w-full p-8 md:p-12 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-black text-white">Konsilium – shartnoma asosida</h1>
                        <button onClick={onLogout} className="text-sm text-slate-400 hover:text-white">Chiqish</button>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <ShieldCheckIcon className="w-16 h-16 mx-auto mb-4 text-white/90" />
                        <h2 className="text-2xl font-bold mb-2">Oylik obuna: {CLINIC_PRICE_USD} $</h2>
                        <p className="text-blue-100 mb-6">
                            Klinikalar uchun konsilium shartnoma asosida. To'lovni hisob raqamdan o'tkazing.
                        </p>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 space-y-3">
                            <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">Hisob raqam (o'tkazma)</p>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-black/20 p-3 rounded-lg">
                                <span className="font-mono font-bold text-lg break-all">{BANK_ACCOUNT.accountNumber}</span>
                                <button onClick={handleCopyAccount} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors flex-shrink-0">
                                    Nusxa olish
                                </button>
                            </div>
                            <p className="text-xs text-blue-200">{BANK_ACCOUNT.bankName} • MFO: {BANK_ACCOUNT.mfo} • INN: {BANK_ACCOUNT.inn}</p>
                            <p className="text-xs text-blue-200">Qabul qiluvchi: {BANK_ACCOUNT.receiver}</p>
                        </div>
                        <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-sm text-yellow-100">
                            <strong>Muhim:</strong> To'lovni hisob raqamdan o'tkazing. Admin to'lovni tekshirgach 30 kunga obunani faollashtiradi.
                        </div>
                        <div className="mt-6 text-center">
                            <p className="text-sm text-blue-200 mb-1">Savollar bo'lsa:</p>
                            <a href="tel:+998948788878" className="text-xl font-bold hover:underline">+998 94 878 88 78</a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- SHIFOKOR: Oylik 10$, chek yuborish, admin tasdiqlagach 30 kun ---
    return (
        <div className="min-h-screen w-full medical-mesh-bg flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
            <div className="glass-panel max-w-5xl w-full p-6 md:p-10 flex flex-col lg:flex-row gap-10 animate-fade-in-up my-auto">
                <div className="lg:w-1/2 flex flex-col justify-between order-2 lg:order-1">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Oylik obuna: 10 $</h1>
                        <p className="text-slate-300 text-lg mb-6">
                            To'lov chekini yuboring. Admin tasdiqlagach obuna 30 kunga faollashadi.
                        </p>

                        {loadingPlans ? (
                            <div className="flex items-center justify-center py-12">
                                <SpinnerIcon className="w-10 h-10 text-blue-400" />
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                <h3 className="text-xl font-bold text-white mb-2">Shifokor obunasi</h3>
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-4xl font-black text-blue-400">{DOCTOR_PRICE_USD} $</span>
                                    <span className="text-slate-400">/ oyiga</span>
                                </div>
                                <ul className="space-y-2">
                                    {['Chek yuborish orqali to\'lov', 'Admin tasdiqlagach 30 kun faol', 'Barcha AI konsilium imkoniyatlari'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-slate-200">
                                            <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-6">
                            <p className="text-xs font-bold text-blue-300 uppercase mb-2">To'lov uchun karta (10 $):</p>
                            <div className="flex flex-col sm:flex-row justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5 gap-3">
                                <span className="text-xl font-mono font-bold text-white tracking-wider break-all text-center sm:text-left">
                                    9860 3566 2700 0702
                                </span>
                                <button
                                    onClick={handleCopyCard}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-colors flex-shrink-0"
                                >
                                    Nusxa olish
                                </button>
                            </div>
                            <div className="flex items-start gap-2 mt-4">
                                <AlertTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-200 leading-relaxed">
                                    <strong>Muhim:</strong> Aynan <strong className="text-white">10 $</strong> to'lang va chek (skrinshot)ni quyida yuklang. Admin tasdiqlagach 30 kunga obuna faollashadi.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onLogout}
                            className="text-sm text-slate-500 hover:text-white mt-6 md:mt-8 underline text-left"
                        >
                            Chiqish va keyinroq to'lash
                        </button>
                    </div>
                </div>

                <div className="lg:w-1/2 bg-white rounded-3xl p-8 text-slate-800 shadow-2xl flex flex-col justify-center order-1 lg:order-2">
                    <h3 className="text-xl font-bold mb-2">To'lov chekini yuklash</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        10 $ to'lovni amalga oshiring va chek (skrinshot)ni bu yerga yuklang. Admin tasdiqlagach 30 kun obuna faol bo'ladi.
                    </p>

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all h-64 flex flex-col items-center justify-center ${
                            selectedFile ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        {previewUrl ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img
                                    src={previewUrl}
                                    alt="Chek"
                                    className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg text-white font-bold">
                                    O'zgartirish
                                </div>
                            </div>
                        ) : (
                            <>
                                <UploadCloudIcon className="w-16 h-16 text-slate-300 mb-4" />
                                <p className="font-bold text-slate-600">Chekni tanlash uchun bosing</p>
                                <p className="text-xs text-slate-400 mt-2">JPG, PNG</p>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 text-sm rounded-lg border border-red-200">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={isUploading || !selectedFile}
                        className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <SpinnerIcon className="w-5 h-5 text-white" />
                                Yuborilmoqda...
                            </>
                        ) : (
                            "Chekni yuborish (admin tasdiqlagach 30 kun faol)"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
