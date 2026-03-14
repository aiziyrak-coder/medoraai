
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import { Language } from '../i18n/LanguageContext';
import {
    INSTITUTE_NAME_FULL,
    INSTITUTE_NAME_SHORT,
    INSTITUTE_LOGO_TEXT,
    INSTITUTE_PHONE_1,
    INSTITUTE_PHONE_2,
    INSTITUTE_EMAIL_1,
    INSTITUTE_EMAIL_2,
    INSTITUTE_ADDRESS,
    FOOTER_COPYRIGHT,
    PLATFORM_NAME,
    PLATFORM_VERSION,
} from '../constants/brand';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import GlobeIcon from './icons/GlobeIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PlayIcon from './icons/PlayIcon';
import HeartPulseIcon from './icons/HeartPulseIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import StethoscopeIcon from './icons/StethoscopeIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import XIcon from './icons/XIcon';

interface LandingPageProps {
    onLogin: () => void;
    onOpenGuide: () => void;
    onOpenAbout?: () => void;
}

const PhoneCallIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
);

const MenuIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

const ChevronLeftIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const SLIDE_COUNT = 4;

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onOpenGuide, onOpenAbout }) => {
    const { t, language, setLanguage } = useTranslation();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showContactModal, setShowContactModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const goNext = useCallback(() => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentSlide((prev) => (prev + 1) % SLIDE_COUNT);
        setTimeout(() => setIsTransitioning(false), 500);
    }, [isTransitioning]);
    const goPrev = useCallback(() => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentSlide((prev) => (prev - 1 + SLIDE_COUNT) % SLIDE_COUNT);
        setTimeout(() => setIsTransitioning(false), 500);
    }, [isTransitioning]);
    const goToSlide = useCallback((index: number) => {
        if (isTransitioning || index === currentSlide) return;
        setIsTransitioning(true);
        setCurrentSlide(index);
        setTimeout(() => setIsTransitioning(false), 500);
    }, [currentSlide, isTransitioning]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (mobileMenuOpen || showContactModal) return;
            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    goNext();
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    goPrev();
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [goNext, goPrev, mobileMenuOpen, showContactModal]);

    return (
        <div className="h-screen max-h-screen w-full max-w-[100vw] bg-slate-950 text-white font-sans overflow-hidden selection:bg-blue-500 selection:text-white flex flex-col landing-viewport">
            {/* --- CONTACT MODAL --- */}
            {showContactModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-slate-900 border border-white/20 w-full max-w-sm rounded-3xl p-8 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                            <XIcon className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                <PhoneCallIcon className="w-10 h-10 text-green-500 animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">{t('landing_contact_modal_title')}</h3>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed">{t('landing_contact_modal_desc')}</p>
                            <a href="tel:+998950442345" className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl text-lg mb-3 flex items-center justify-center gap-3">
                                <PhoneCallIcon className="w-6 h-6" /> {INSTITUTE_PHONE_1}
                            </a>
                            <a href="tel:+998950482345" className="block w-full py-4 bg-green-600/80 hover:bg-green-500/90 text-white font-bold rounded-2xl text-lg mb-4 flex items-center justify-center gap-3">
                                <PhoneCallIcon className="w-6 h-6" /> {INSTITUTE_PHONE_2}
                            </a>
                            <p className="text-slate-400 text-xs mb-1">
                                <a href={`mailto:${INSTITUTE_EMAIL_1}`} className="hover:text-white">{INSTITUTE_EMAIL_1}</a>
                                {' · '}
                                <a href={`mailto:${INSTITUTE_EMAIL_2}`} className="hover:text-white">{INSTITUTE_EMAIL_2}</a>
                            </p>
                            <p className="text-slate-500 text-xs">{INSTITUTE_ADDRESS}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MOBILE MENU --- */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-xl flex flex-col justify-center items-center lg:hidden animate-fade-in-up">
                    <button onClick={() => setMobileMenuOpen(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white">
                        <XIcon className="w-8 h-8" />
                    </button>
                    <div className="flex flex-col gap-6 text-center text-lg font-bold">
                        {[0, 1, 2, 3].map((i) => (
                            <button key={i} onClick={() => { goToSlide(i); setMobileMenuOpen(false); }} className="hover:text-cyan-400 transition-colors">
                                {i === 0 ? t('nav_features').replace(/.*/, 'Bosh sahifa') : i === 1 ? t('nav_features') : i === 2 ? t('nav_how_it_works') : t('landing_cta_bottom_title').slice(0, 20) + '…'}
                            </button>
                        ))}
                        <button onClick={() => { onOpenGuide(); setMobileMenuOpen(false); }} className="hover:text-blue-400 transition-colors">{t('nav_guide')}</button>
                        {onOpenAbout && <button onClick={() => { onOpenAbout(); setMobileMenuOpen(false); }} className="hover:text-blue-400 transition-colors">Institut haqida</button>}
                        <div className="pt-6 border-t border-white/10 w-48 mx-auto">
                            <button onClick={() => { onLogin(); setMobileMenuOpen(false); }} className="w-full px-6 py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-blue-50 transition-all">
                                {t('auth_login_button')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- FIXED NAV --- */}
            <nav className="flex-none fixed top-0 left-0 right-0 z-50 py-3 md:py-4 px-4 md:px-6 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                <div className="flex justify-between items-center gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs sm:text-sm font-black tracking-tight text-white truncate uppercase">{INSTITUTE_LOGO_TEXT}</span>
                        <span className="text-[10px] font-medium text-slate-500 hidden sm:block truncate">{INSTITUTE_NAME_FULL}</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-4 text-sm font-medium text-slate-400">
                        <button onClick={() => goToSlide(1)} className="hover:text-cyan-400 transition-colors">{t('nav_features')}</button>
                        <button onClick={() => goToSlide(2)} className="hover:text-cyan-400 transition-colors">{t('nav_how_it_works')}</button>
                        {onOpenAbout && <button onClick={onOpenAbout} className="text-cyan-400 hover:text-cyan-300">Institut haqida</button>}
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
                        <button onClick={onLogin} className="px-4 py-2 rounded-full bg-white text-slate-900 font-bold text-xs md:text-sm hover:bg-blue-50 transition-all">
                            {t('auth_login_button')}
                        </button>
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
                            <MenuIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- SCAN-LINE OVERLAY (medical/tech transition) --- */}
            {isTransitioning && <div className="landing-scan-overlay" aria-hidden />}

            {/* --- SLIDES CONTAINER (no scroll) --- */}
            <div className="flex-1 min-h-0 w-full overflow-hidden">
                <div
                    className="landing-slides-track flex h-full"
                    style={{ transform: `translateX(-${currentSlide * 100}vw)` }}
                >
                    {/* SLIDE 0: HERO */}
                    <section className="landing-slide flex flex-col items-center justify-center relative px-4 sm:px-6 md:px-8 pt-16 pb-24">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-1/4 left-1/4 w-[40vmax] h-[40vmax] rounded-full bg-blue-600/20 blur-[80px] landing-orb" />
                            <div className="absolute bottom-1/4 right-1/4 w-[30vmax] h-[30vmax] rounded-full bg-cyan-500/15 blur-[60px] landing-orb" style={{ animationDelay: '-6s' }} />
                            <div className="absolute top-1/2 left-1/2 w-[25vmax] h-[25vmax] rounded-full bg-indigo-500/10 blur-[50px] landing-orb" style={{ animationDelay: '-12s' }} />
                        </div>
                        <div className="relative z-10 text-center max-w-4xl mx-auto">
                            <div className="landing-content-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                {t('landing_hero_badge')}
                            </div>
                            <p className="landing-content-in landing-content-in-delay-1 text-sm text-slate-400 font-semibold mb-2">{INSTITUTE_NAME_FULL}</p>
                            <div className="landing-content-in landing-content-in-delay-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 mb-6">
                                <span className="text-sm font-black uppercase" style={{ background: 'linear-gradient(90deg,#38bdf8,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    {PLATFORM_NAME} {PLATFORM_VERSION}
                                </span>
                            </div>
                            <h1 className="landing-content-in landing-content-in-delay-3 text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-4 px-1">
                                {t('landing_hero_title_1')} <br className="hidden sm:block" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">{t('landing_hero_title_2')}</span>
                            </h1>
                            <p className="landing-content-in landing-content-in-delay-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto mb-8 font-light">
                                {t('landing_hero_desc')}
                            </p>
                            <div className="landing-content-in landing-content-in-delay-5 flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-xl shadow-blue-600/30 transition-all hover:scale-105 flex items-center justify-center gap-2">
                                    {t('landing_cta_start')} <ChevronRightIcon className="w-5 h-5" />
                                </button>
                                <button onClick={onOpenGuide} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold flex items-center justify-center gap-2">
                                    <PlayIcon className="w-5 h-5" /> {t('landing_cta_guide')}
                                </button>
                            </div>
                            <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-2xl mx-auto">
                                {[
                                    { label: t('landing_stats_protocols'), value: '15,000+' },
                                    { label: t('landing_stats_clinics'), value: '50+' },
                                    { label: t('landing_stats_analyses'), value: '100K+' },
                                    { label: t('landing_stats_experts'), value: '12+' },
                                ].map((s, i) => (
                                    <div key={i} className="text-center">
                                        <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                                        <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* SLIDE 1: FEATURES */}
                    <section className="landing-slide flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 pt-20 pb-20 overflow-hidden">
                        <div className="w-full max-w-5xl mx-auto">
                            <p className="text-xs font-bold text-blue-400/90 mb-2 uppercase tracking-wider text-center">{INSTITUTE_NAME_FULL}</p>
                            <h2 className="text-2xl sm:text-4xl font-bold mb-8 text-center">{t('landing_features_title')}</h2>
                            <p className="text-slate-400 text-sm sm:text-base text-center max-w-xl mx-auto mb-10">{t('landing_features_desc')}</p>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {[
                                    { icon: <UserGroupIcon className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />, title: t('landing_feature_consultium'), bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                                    { icon: <ShieldCheckIcon className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />, title: t('landing_feature_safe'), bg: 'bg-green-500/10', border: 'border-green-500/20' },
                                    { icon: <GlobeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />, title: t('landing_feature_global'), bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
                                    { icon: <HeartPulseIcon className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />, title: t('landing_feature_ecg'), bg: 'bg-red-500/10', border: 'border-red-500/20' },
                                    { icon: <StethoscopeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400" />, title: t('landing_feature_drug'), bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                                    { icon: <ChartBarIcon className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400" />, title: t('landing_feature_risk'), bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
                                ].map((f, i) => (
                                    <div key={i} className={`p-4 sm:p-5 rounded-2xl bg-slate-800/50 border hover:bg-slate-800/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${f.border}`}>
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3 ${f.bg}`}>{f.icon}</div>
                                        <h3 className="text-sm sm:text-base font-bold text-white leading-tight">{f.title}</h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* SLIDE 2: HOW IT WORKS */}
                    <section className="landing-slide flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 pt-20 pb-20">
                        <div className="w-full max-w-3xl mx-auto text-center">
                            <h2 className="text-2xl sm:text-4xl font-bold mb-4">{t('landing_how_title')} <span className="text-blue-500">{t('landing_how_subtitle')}</span></h2>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 mt-10">
                                {[
                                    { step: '01', title: t('landing_how_step1'), icon: <DocumentTextIcon className="w-6 h-6 text-white" /> },
                                    { step: '02', title: t('landing_how_step2'), icon: <BrainCircuitIcon className="w-6 h-6 text-white" /> },
                                    { step: '03', title: t('landing_how_step3'), icon: <ShieldCheckIcon className="w-6 h-6 text-white" /> },
                                ].map((item, i) => (
                                    <div key={i} className="flex flex-col items-center gap-3">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-lg font-bold group-hover:bg-blue-600 transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{item.step}</span>
                                        <p className="text-sm sm:text-base font-bold text-white max-w-[140px]">{item.title}</p>
                                    </div>
                                ))}
                            </div>
                            <button onClick={onOpenGuide} className="mt-10 text-blue-400 font-bold hover:text-blue-300 flex items-center gap-2 mx-auto">
                                {t('landing_how_cta')} <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </section>

                    {/* SLIDE 3: CTA + FOOTER */}
                    <section className="landing-slide flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 pt-20 pb-20">
                        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                            <p className="text-xs font-bold text-blue-200/90 mb-3 uppercase tracking-wider">{INSTITUTE_NAME_FULL}</p>
                            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-6 tracking-tight">{t('landing_cta_bottom_title')}</h2>
                            <p className="text-base sm:text-lg text-slate-300 mb-10 font-light">{t('landing_cta_bottom_desc')}</p>
                            <button onClick={onLogin} className="px-10 py-5 bg-white text-blue-900 font-black text-lg rounded-full shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-105 transition-all duration-300">
                                {t('landing_cta_bottom_btn')}
                            </button>
                            <div className="mt-12 pt-8 border-t border-white/10 w-full">
                                <p className="text-white font-black text-sm uppercase mb-1">{INSTITUTE_LOGO_TEXT}</p>
                                <p className="text-slate-500 text-xs mb-3">{FOOTER_COPYRIGHT}</p>
                                <p className="text-slate-600 text-xs mb-4">{PLATFORM_NAME} {PLATFORM_VERSION}</p>
                                <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400 mb-4">
                                    <a href={`tel:+998950442345`} className="hover:text-white">{INSTITUTE_PHONE_1}</a>
                                    <a href={`tel:+998950482345`} className="hover:text-white">{INSTITUTE_PHONE_2}</a>
                                    <a href={`mailto:${INSTITUTE_EMAIL_1}`} className="hover:text-white">{INSTITUTE_EMAIL_1}</a>
                                </div>
                                <p className="text-slate-500 text-xs mb-4">{INSTITUTE_ADDRESS}</p>
                                <div className="flex justify-center gap-6">
                                    <button onClick={() => setShowContactModal(true)} className="text-slate-400 hover:text-white text-xs font-medium">{t('landing_footer_contact')}</button>
                                    {onOpenAbout && <button onClick={onOpenAbout} className="text-blue-400 hover:text-blue-300 text-xs font-medium">Institut haqida</button>}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* --- NAV: bitta pill (meditsina + texnologiya uygun) --- */}
            <div className="flex-none fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4">
                <div className="landing-nav-pill flex items-center gap-2 sm:gap-4 py-2.5 px-4 sm:px-6 rounded-full bg-slate-900/90 border border-cyan-500/20 shadow-[0_0_24px_rgba(6,182,212,0.12)] backdrop-blur-xl">
                    <button onClick={goPrev} className="landing-nav-arrow p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-300" aria-label="Oldingi">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1.5 sm:gap-2 mx-1">
                        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToSlide(i)}
                                className={`landing-dot w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'landing-dot-active bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'bg-white/25 hover:bg-white/45'}`}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                    <button onClick={goNext} className="landing-nav-arrow p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-300 flex items-center gap-1.5" aria-label="Keyingi">
                        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-slate-500">Keyingi</span>
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
