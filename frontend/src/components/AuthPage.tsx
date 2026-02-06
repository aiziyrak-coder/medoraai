
import React, { useState, useEffect } from 'react';
import * as authService from '../services/apiAuthService';
import type { User, UserRole } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import XIcon from './icons/XIcon';
import { AIModel } from '../constants/specialists';
import { AI_SPECIALISTS } from '../constants';
import LanguageSwitcher from './LanguageSwitcher';
import { Language } from '../i18n/LanguageContext';

interface AuthPageProps {
    onLoginSuccess: (user: User) => void;
}

// --- LEGAL MODAL COMPONENT ---
const LegalModal: React.FC<{ title: string; content: React.ReactNode; onClose: () => void; closeText: string }> = ({ title, content, onClose, closeText }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheckIcon className="w-6 h-6 text-blue-500"/> {title}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6"/>
                </button>
            </div>
            <div className="p-6 overflow-y-auto text-slate-300 text-sm leading-relaxed space-y-4 custom-scrollbar">
                {content}
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end">
                <button onClick={onClose} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors">
                    {closeText}
                </button>
            </div>
        </div>
    </div>
);

// --- ROTATING CARD COMPONENT ---
const RotatingSpecialtyCard: React.FC<{ initialIndex: number, options: string[] }> = ({ initialIndex, options }) => {
    const [index, setIndex] = useState(initialIndex);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const intervalDuration = 3000 + Math.random() * 3000;
        const interval = setInterval(() => {
            setIsVisible(false);
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % options.length);
                setIsVisible(true);
            }, 500); 
        }, intervalDuration);

        return () => clearInterval(interval);
    }, [options.length]);

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 shadow-sm min-w-[140px] hover:bg-white/20 transition-colors">
            <div className="p-1 rounded-full bg-blue-500/20">
                <CheckCircleIcon className="w-3 h-3 text-blue-300" />
            </div>
            <span className={`text-xs font-medium text-slate-100 tracking-wide transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                {options[index]}
            </span>
        </div>
    );
};

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
    const { t, language, setLanguage } = useTranslation();
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [role, setRole] = useState<UserRole>('clinic');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const [isAgreedTerms, setIsAgreedTerms] = useState(false);
    const [isAgreedPrivacy, setIsAgreedPrivacy] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [legalModalContent, setLegalModalContent] = useState<{ title: string, content: React.ReactNode } | null>(null);

    // Dynamic specialties based on current language
    // We map over AI_SPECIALISTS to ensure we get the 'specialty' field, which is the translation key base
    const availableSpecialties = Object.values(AIModel)
        .filter(m => m !== AIModel.SYSTEM)
        .map(m => {
            const specConfig = AI_SPECIALISTS[m];
            if (!specConfig) return m;
            
            // Transform "Allergy & Immunology" -> "allergy_immunology" to match translation keys in locales
            const keySlug = specConfig.specialty
                .toLowerCase()
                .replace(/ & /g, '_')
                .replace(/ /g, '_')
                .replace(/[^a-z0-9_]/g, '');
                
            // Type assertion is safe here - translation function has fallback to return key if not found
            return t(`specialty_${keySlug}` as TranslationKey);
        })
        // Remove duplicates and sort alphabetically in current language
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a.localeCompare(b));

    // Create pools for rotating cards from available specialties
    const specialtyPools = [];
    for (let i = 0; i < 5; i++) {
        const pool = [];
        for (let j = 0; j < 3; j++) {
            const index = (i * 3 + j) % availableSpecialties.length;
            pool.push(availableSpecialties[index]);
        }
        specialtyPools.push(pool);
    }

    // Auto-fill credentials on mount for the default role
    useEffect(() => {
        // If mobile, default to doctor
        if (window.innerWidth < 768) {
            handleRoleSelect('doctor');
        } else {
            handleRoleSelect('clinic');
        }
    }, []);

    const handleSpecialtyToggle = (spec: string) => {
        setSelectedSpecialties(prev => 
            prev.includes(spec) 
                ? prev.filter(s => s !== spec) 
                : prev.length < 5 ? [...prev, spec] : prev
        );
    };

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const result = authService.requestPasswordReset(phone);
            if (result.success) {
                setMessage(result.message);
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('error_try_again'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            if (mode === 'login') {
                // Try API first, fallback to local
                const result = await authService.login({ phone, password });
                if (result.success) {
                    const user = authService.getCurrentUser();
                    // Validation for correct role login
                    if (user && user.role !== role) {
                        setError(`Siz noto'g'ri bo'limdasiz. Sizning rolingiz: ${user.role === 'clinic' ? 'Klinika' : user.role === 'doctor' ? 'Shifokor' : 'Registrator'}`);
                        authService.logout();
                    } else if (user) {
                        onLoginSuccess(user);
                    }
                } else {
                    setError(result.message);
                }
            } else { 
                if (!isAgreedTerms || !isAgreedPrivacy) {
                    setError(t('auth_agree_required'));
                    setIsLoading(false);
                    return;
                }
                // Try API first, fallback to local
                const result = await authService.register({ 
                    phone, 
                    password, 
                    password_confirm: password,
                    name, 
                    role,
                    specialties: role === 'doctor' ? selectedSpecialties : undefined
                });
                 if (result.success) {
                    setMessage(result.message + " Endi tizimga kirishingiz mumkin.");
                    setMode('login');
                } else {
                    setError(result.message);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('error_try_again'));
        } finally {
            setIsLoading(false);
        }
    };
    
    // Auto-fill credentials based on role selection
    const handleRoleSelect = (selectedRole: UserRole) => {
        // Mobile restriction check
        if (selectedRole === 'clinic' && window.innerWidth < 768) {
            alert("Iltimos, kompyuter yoki planshet orqali kiring. Telefon orqali faqat Shifokor va Registrator rejimi ishlaydi.");
            return;
        }

        setRole(selectedRole);
        setMode('login');
        setError('');
        setPassword('');
        
        if (selectedRole === 'clinic') {
            setPhone('+998901234567');
            setPassword('clinic_demo');
        } else if (selectedRole === 'doctor') {
            // Default to ACTIVE subscription user for better first impression
            setPhone('+998901111111');
            setPassword('demo');
        } else if (selectedRole === 'staff') {
            setPhone('+998901112233'); // Demo for staff
            setPassword('staff_demo');
        }
    };

    // --- LEGAL TEXT CONTENT GENERATORS ---
    const showTerms = () => setLegalModalContent({
        title: "Foydalanish Shartlari va Ommaviy Oferta",
        content: (
            <>
                <p><strong className="text-white">1. Umumiy qoidalar:</strong> Ushbu platforma faqat tibbiy ma'lumotga ega bo'lgan mutaxassislar (shifokorlar, rezidentlar, talabalar) uchun mo'ljallangan yordamchi vositadir.</p>
                <p><strong className="text-white">2. Mas'uliyatni cheklash:</strong> "MedoraAi" tizimi (keyingi o'rinlarda "Tizim") tomonidan taqdim etilgan har qanday tashxis, davolash rejasi yoki tavsiya faqat axborot xarakteriga ega. Tizim shifokor o'rnini bosmaydi. Yakuniy klinik qaror uchun to'liq javobgarlik foydalanuvchi (shifokor) zimmasidadir.</p>
                <p><strong className="text-white">3. Ma'lumotlar xavfsizligi:</strong> Biz foydalanuvchi kiritgan bemor ma'lumotlarini (F.I.Sh va boshqa shaxsiy identifikatorlar) anonimlashtirishga harakat qilamiz, ammo internet tarmog'idagi xavfsizlik uchun mutlaq kafolat berilmaydi.</p>
                <p><strong className="text-white">4. Rozilik:</strong> Tizimdan foydalanish orqali siz sun'iy intellekt tomonidan yuzaga kelishi mumkin bo'lgan xatoliklar (gallyutsinatsiyalar) ehtimolini tushunasiz va qabul qilasiz.</p>
            </>
        )
    });

    const showPrivacy = () => setLegalModalContent({
        title: t('auth_agree_privacy'),
        content: (
            <>
                <p><strong className="text-white">1. Ma'lumotlarni to'plash:</strong> Biz telefon raqamingiz, ismingiz, rol va mutaxassislik ma'lumotlaringizni faqat hisob yaratish va xizmat ko'rsatish uchun saqlaymiz.</p>
                <p><strong className="text-white">2. Ma'lumotlardan foydalanish:</strong> Shaxsiy ma'lumotlaringiz faqat tizim ishlashi, xavfsizlik va qonuniy talablar uchun ishlatiladi. Uchinchi tomonlarga sotilmaydi.</p>
                <p><strong className="text-white">3. Himoya:</strong> Ma'lumotlaringiz shifrlash va xavfsiz saqlash orqali himoyalanadi. Faqat avtorizatsiya qilingan xodimlar kirishi mumkin.</p>
                <p><strong className="text-white">4. Huquqlaringiz:</strong> Hisobingizni o'chirish yoki ma'lumotlaringizni ko'rish/o'zgartirish so'rovini yuborishingiz mumkin.</p>
            </>
        )
    });
    const showFAQ = () => setLegalModalContent({ title: "Ko'p so'raladigan savollar (FAQ)", content: (<><p>Tizim noto'g'ri tashxis qo'yishi mumkinmi? Ha. AI yordamchi vositadir.</p></>) });

    return (
        <div className="h-[100dvh] w-full relative flex overflow-hidden font-sans bg-slate-900">
            {/* Language Switcher Overlay */}
            <div className="absolute top-6 right-6 z-50">
                <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
            </div>

            {legalModalContent && (
                <LegalModal 
                    title={legalModalContent.title} 
                    content={legalModalContent.content} 
                    onClose={() => setLegalModalContent(null)}
                    closeText={t('close')}
                />
            )}
            
            <div className="absolute inset-0 z-0">
                <img 
                    src="https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=2070&auto=format&fit=crop" 
                    alt="Medical Council Team Meeting" 
                    className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/60 to-slate-900/30"></div>
            </div>

            <div className="w-full h-full relative z-10 flex">
                {/* LEFT SIDE: Information */}
                <div className="hidden lg:flex w-1/2 flex-col justify-between p-8 xl:p-12 h-full">
                    <div className="animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_#60a5fa]"></span>
                            <span className="text-[10px] font-bold text-blue-100 tracking-wide uppercase">MedoraAi Tizimi v1.0</span>
                        </div>
                        <h1 className="text-4xl xl:text-6xl font-black text-white tracking-tighter mb-3 drop-shadow-xl uppercase">
                            MEDORA AI
                        </h1>
                        <p className="text-xl text-blue-100 font-light border-l-4 border-blue-500 pl-4">
                            {t('auth_marketing_title')}
                        </p>
                    </div>

                    <div className="max-w-xl animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                        <p className="text-slate-100 text-sm leading-relaxed font-medium drop-shadow-lg">
                            {t('auth_marketing_desc')}
                        </p>
                        
                        <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                            <h4 className="text-white text-xs font-bold mb-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                {t('auth_mode_select')}
                            </h4>
                            <ul className="text-slate-300 text-xs space-y-0.5">
                                <li>• <strong>{t('auth_mode_clinic')}:</strong> {t('auth_mode_clinic_desc')}</li>
                                <li>• <strong>{t('auth_mode_doctor')}:</strong> {t('auth_mode_doctor_desc')}</li>
                                <li>• <strong>{t('auth_mode_staff')}:</strong> {t('auth_mode_staff_desc')}</li>
                            </ul>
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {[1,2,3,4,5].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full border border-slate-900 bg-slate-700 flex items-center justify-center text-[10px] text-white shadow-lg font-bold">AI</div>
                                ))}
                            </div>
                            <span className="text-xs text-blue-200 font-bold tracking-wide drop-shadow-md">{t('auth_virtual_team')}</span>
                        </div>
                    </div>

                    <div className="animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                        <div className="flex flex-wrap gap-2">
                            {specialtyPools.map((pool, i) => (
                                <RotatingSpecialtyCard key={i} initialIndex={i % pool.length} options={pool} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: Login Form */}
                <div className="w-full lg:w-1/2 h-full bg-slate-900/50 backdrop-blur-xl border-l border-white/10 flex flex-col justify-center p-6 lg:p-12 overflow-y-auto shadow-2xl transition-all">
                    <div className="max-w-sm w-full mx-auto space-y-4 animate-fade-in-up">
                        
                        {/* Role Switcher */}
                        <div className="bg-slate-800 p-1 rounded-xl flex mb-4 border border-slate-700">
                            <button
                                onClick={() => handleRoleSelect('clinic')}
                                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all duration-300 ${role === 'clinic' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('auth_mode_clinic')}
                            </button>
                            <button
                                onClick={() => handleRoleSelect('doctor')}
                                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all duration-300 ${role === 'doctor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('auth_mode_doctor')}
                            </button>
                            <button
                                onClick={() => handleRoleSelect('staff')}
                                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all duration-300 ${role === 'staff' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('auth_mode_staff')}
                            </button>
                        </div>

                        <div className="text-center lg:text-left">
                            <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                                {mode === 'login' ? t('auth_login_title') : t('auth_register_title')}
                            </h2>
                            <p className="mt-1 text-slate-300 font-medium text-xs sm:text-sm">
                                {role === 'clinic' && t('auth_clinic_login_help')}
                                {role === 'doctor' && t('auth_doctor_login_help')}
                                {role === 'staff' && t('auth_staff_login_help')}
                            </p>
                        </div>

                        <form onSubmit={mode === 'forgot' ? handleResetRequest : handleAuthSubmit} className="space-y-3">
                            {mode === 'register' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                            {role === 'clinic' ? t('auth_org_name_label') : t('auth_fullname_label')}
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="block w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium backdrop-blur-sm text-sm"
                                            required
                                            placeholder={role === 'clinic' ? t('auth_org_placeholder') : t('auth_fullname_placeholder')}
                                        />
                                    </div>
                                    {role === 'doctor' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                                {t('auth_specialties_label')}
                                            </label>
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {selectedSpecialties.map(s => (
                                                    <span key={s} className="px-1.5 py-0.5 bg-blue-600 rounded-md text-[10px] text-white flex items-center gap-1">
                                                        {s} <button type="button" onClick={() => handleSpecialtyToggle(s)}>&times;</button>
                                                    </span>
                                                ))}
                                            </div>
                                            <select 
                                                onChange={(e) => handleSpecialtyToggle(e.target.value)} 
                                                className="block w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white outline-none text-sm bg-slate-800"
                                                value=""
                                            >
                                                <option value="" disabled className="text-slate-500">{t('auth_select_specialty')}</option>
                                                {availableSpecialties.map(s => (
                                                    <option key={s} value={s} className="text-white bg-slate-800">{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                    {t('auth_phone_label')}
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="block w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium backdrop-blur-sm text-sm"
                                    required
                                    placeholder={t('auth_phone_placeholder')}
                                />
                            </div>
                            
                            {mode !== 'forgot' && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                                            {t('auth_password_label')}
                                        </label>
                                        {mode === 'login' && (
                                            <button type="button" onClick={() => setMode('forgot')} className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                                                {t('auth_forgot_password_link')}
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium backdrop-blur-sm text-sm"
                                        required
                                    />
                                </div>
                            )}

                            {mode === 'register' && (
                                <div className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-start gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="agree-terms"
                                            checked={isAgreedTerms}
                                            onChange={(e) => setIsAgreedTerms(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white/10"
                                        />
                                        <label htmlFor="agree-terms" className="text-[10px] text-slate-300 leading-tight select-none cursor-pointer">
                                            {t('auth_agree_terms_label')}{' '}
                                            <button type="button" onClick={showTerms} className="text-blue-400 hover:underline font-bold">{t('auth_agree_terms')}</button>
                                        </label>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="agree-privacy"
                                            checked={isAgreedPrivacy}
                                            onChange={(e) => setIsAgreedPrivacy(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white/10"
                                        />
                                        <label htmlFor="agree-privacy" className="text-[10px] text-slate-300 leading-tight select-none cursor-pointer">
                                            {t('auth_agree_privacy_label')}{' '}
                                            <button type="button" onClick={showPrivacy} className="text-blue-400 hover:underline font-bold">{t('auth_agree_privacy')}</button>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded-lg border border-red-900/50">{error}</p>}
                            {message && <p className="text-xs text-green-400 bg-green-900/20 p-2 rounded-lg border border-green-900/50">{message}</p>}

                            <button
                                type="submit"
                                disabled={isLoading || (mode === 'register' && (!isAgreedTerms || !isAgreedPrivacy))}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-base shadow-lg transition-all duration-300 disabled:opacity-50"
                            >
                                {isLoading ? <SpinnerIcon className="w-5 h-5 text-white mx-auto" /> : (mode === 'login' ? t('auth_login_button') : mode === 'register' ? t('auth_register_button') : t('auth_reset_button'))}
                            </button>
                        </form>

                        <div className="text-center pt-1">
                            {role !== 'staff' && (
                                <p className="text-xs text-slate-400 font-medium">
                                    {mode === 'login' ? t('auth_no_account_prompt') : t('auth_have_account_prompt')}{' '}
                                    <button 
                                        onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); setMessage(''); setIsAgreedTerms(false); setIsAgreedPrivacy(false); }} 
                                        className="text-white hover:text-blue-300 font-bold transition-colors ml-1 underline decoration-slate-600 hover:decoration-blue-400 underline-offset-4"
                                    >
                                        {mode === 'login' ? t('auth_register_link') : t('auth_login_link')}
                                    </button>
                                </p>
                            )}
                            {mode === 'forgot' && (
                                 <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="mt-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
                                    &larr; {t('auth_back_to_login')}
                                </button>
                            )}
                        </div>
                        
                        <div className="pt-4 border-t border-white/10 mt-auto text-center">
                            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 text-left shadow-lg">
                                <p className="text-[10px] text-red-200 font-medium leading-relaxed">
                                    <span className="block font-black text-red-100 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <ShieldCheckIcon className="w-3 h-3"/> {t('auth_attention')}
                                    </span>
                                    {t('auth_disclaimer_short')}
                                </p>
                            </div>
                            <div className="flex justify-center gap-3 text-[10px] text-slate-500 font-medium">
                                <button onClick={showTerms}>{t('auth_terms')}</button><span>|</span>
                                <button onClick={showPrivacy}>{t('auth_privacy')}</button><span>|</span>
                                <button onClick={showFAQ}>{t('auth_faq')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
