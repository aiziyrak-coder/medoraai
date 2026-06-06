import React from 'react';
import type { User } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import LanguageSwitcher from '../LanguageSwitcher';
import DeviceSessionBanner from '../DeviceSessionBanner';
import RegistrarPanel from './RegistrarPanel';
import { INSTITUTE_LOGO_SRC, INSTITUTE_NAME_SHORT } from '../../constants/brand';
import { Language } from '../../i18n/LanguageContext';

interface RegistrarAppProps {
    user: User;
    onLogout: () => void;
    language: Language;
    onLanguageChange: (lang: Language) => void;
}

const RegistrarApp: React.FC<RegistrarAppProps> = ({ user, onLogout, language, onLanguageChange }) => {
    const { t } = useTranslation();

    return (
        <div className="min-h-[100dvh] flex flex-col w-full bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50/30">
            <header className="flex-none border-b border-sky-100/80 bg-white/90 backdrop-blur-md shadow-sm">
                <div className="max-w-6xl mx-auto page-px py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <img
                            src={INSTITUTE_LOGO_SRC}
                            alt={INSTITUTE_NAME_SHORT}
                            className="w-10 h-10 rounded-xl object-contain bg-slate-50 shrink-0"
                        />
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600">
                                {t('staff_title')}
                            </p>
                            <h1 className="text-base font-black text-slate-800 leading-tight truncate">
                                {t('registrar_app_title')}
                            </h1>
                            <p className="text-[11px] text-slate-500 truncate">
                                {user.name}
                                {user.clinicGroupName ? ` · ${user.clinicGroupName}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <DeviceSessionBanner variant="compact" />
                        <LanguageSwitcher language={language} onLanguageChange={onLanguageChange} />
                        <button
                            type="button"
                            onClick={onLogout}
                            className="text-xs font-semibold text-slate-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100"
                        >
                            {t('logout')}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto">
                <RegistrarPanel user={user} />
            </main>

            <footer className="flex-none py-2 text-center text-[10px] text-slate-400 border-t border-slate-100/80 bg-white/60">
                {t('registrar_app_footer')}
            </footer>
        </div>
    );
};

export default RegistrarApp;
