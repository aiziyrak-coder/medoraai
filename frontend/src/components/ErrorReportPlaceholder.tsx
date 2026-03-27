/**
 * Tahlil xato bilan tugaganda o'ng panelda ko'rsatiladi — avvalgidek to'liq hisobot tuzilishi (bo'limlar) saqlanadi.
 * Davolash, dori-darmonlar, yakuniy xulosa bo'limlari bo'sh/placeholder bilan chiqadi.
 */

import React from 'react';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import PillIcon from './icons/PillIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

const Section: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200">
                {icon}
            </div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
        </div>
        <div className="p-4 space-y-4 text-sm">
            {children}
        </div>
    </div>
);

interface ErrorReportPlaceholderProps {
    /** Qisqa xato xabari (sarlavha ostida ko'rsatiladi) */
    message?: string;
}

const ErrorReportPlaceholder: React.FC<ErrorReportPlaceholderProps> = ({ message }) => {
    const defaultMessage = "Tahlil xato bilan tugadi. To'liq konsensus hisoboti olinmadi. Bemor ma'lumotlari va munozarani PDF/Word orqali yuklab olish mumkin.";

    return (
        <div className="animate-fade-in-up mt-4 space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">YAKUNIY KLINIK XULOSA</h1>
                <p className="text-sm text-slate-500 mt-1">Konsilium — xato tufayli to'liq hisobot tayyorlanmadi</p>
            </div>

            {/* Asosiy xulosa — xato xabari */}
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-amber-700 text-white">
                    <h2 className="text-lg font-bold uppercase tracking-wide">Asosiy xulosa</h2>
                    <p className="text-amber-100 text-sm mt-0.5">Tahlil jarayonida xato yuz berdi</p>
                </div>
                <div className="p-6">
                    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-amber-200">
                        <AlertTriangleIcon className="w-8 h-8 text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-slate-700">{message || defaultMessage}</p>
                    </div>
                </div>
            </div>

            {/* Davolash rejasi — placeholder */}
            <Section title="Tavsiya Etilgan Davolash Rejasi" icon={<BrainCircuitIcon className="w-6 h-6" />}>
                <p className="text-slate-500 text-sm italic">To'liq hisobot olinmadi. Konsiliumni qayta ishga tushiring yoki PDF/Word da bemor ma'lumotlari va munozarani yuklab oling.</p>
            </Section>

            {/* Dori-darmonlar — placeholder */}
            <Section title="Dori-Darmonlar bo'yicha Tavsiyalar" icon={<PillIcon className="w-6 h-6" />}>
                <p className="text-slate-500 text-sm italic">Tahlil xato bilan tugadi. To&apos;liq hisobotda tashxis asosida dori tavsiyalari (doza, qanday ichish) kiritiladi. Konsiliumni qayta ishga tushiring yoki PDF/Word orqali ma&apos;lumotni yuklab oling.</p>
            </Section>

            {/* Qo'shimcha tekshiruvlar — placeholder */}
            <Section title="Tavsiya Etiladigan Qo'shimcha Tekshiruvlar" icon={<DocumentTextIcon className="w-6 h-6" />}>
                <p className="text-slate-500 text-sm italic">Ma'lumot kiritilmagan.</p>
            </Section>
        </div>
    );
};

export default ErrorReportPlaceholder;
