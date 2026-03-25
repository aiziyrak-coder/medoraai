
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import { Language } from '../i18n/LanguageContext';
import {
    INSTITUTE_NAME_FULL,
    INSTITUTE_NAME_SHORT,
    INSTITUTE_LOGO_TEXT,
    INSTITUTE_LOGO_SRC,
    INSTITUTE_PHONE_1,
    INSTITUTE_PHONE_2,
    INSTITUTE_EMAIL_1,
    INSTITUTE_EMAIL_2,
    INSTITUTE_ADDRESS,
    FOOTER_COPYRIGHT,
    PLATFORM_NAME,
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
    const [transitionDirection, setTransitionDirection] = useState<'next' | 'prev'>('next');
    const viewportRef = useRef<HTMLDivElement>(null);

    const goNext = useCallback(() => {
        if (isTransitioning) return;
        setTransitionDirection('next');
        setIsTransitioning(true);
        setCurrentSlide((prev) => (prev + 1) % SLIDE_COUNT);
        setTimeout(() => setIsTransitioning(false), 900);
    }, [isTransitioning]);
    const goPrev = useCallback(() => {
        if (isTransitioning) return;
        setTransitionDirection('prev');
        setIsTransitioning(true);
        setCurrentSlide((prev) => (prev - 1 + SLIDE_COUNT) % SLIDE_COUNT);
        setTimeout(() => setIsTransitioning(false), 900);
    }, [isTransitioning]);
    const goToSlide = useCallback((index: number) => {
        if (isTransitioning || index === currentSlide) return;
        setTransitionDirection(index > currentSlide ? 'next' : 'prev');
        setIsTransitioning(true);
        setCurrentSlide(index);
        setTimeout(() => setIsTransitioning(false), 900);
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

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (mobileMenuOpen || showContactModal) return;
            e.preventDefault();
            if (e.deltaY > 0) goNext();
            else if (e.deltaY < 0) goPrev();
        };
        const el = viewportRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [goNext, goPrev, mobileMenuOpen, showContactModal]);

    return (
        <div ref={viewportRef} className="h-screen max-h-screen w-full max-w-[100vw] font-sans overflow-hidden selection:bg-violet-500 selection:text-white flex flex-col landing-viewport landing-light-theme">
            {/* --- ANIMATED GRADIENT BACKGROUND --- */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-animated" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(168,85,247,0.12),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08),transparent_70%)]" />
                {/* Floating orbs */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl animate-float-1" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl animate-float-2" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-fuchsia-400/10 rounded-full blur-3xl animate-float-3" />
            </div>

            {/* --- CONTACT MODAL --- */}
            {showContactModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-8 relative shadow-2xl border border-violet-100" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors">
                            <XIcon className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <PhoneCallIcon className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('landing_contact_modal_title')}</h3>
                            <p className="text-slate-500 text-sm mb-8 leading-relaxed">{t('landing_contact_modal_desc')}</p>
                            <a href="tel:+998950442345" className="block w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold rounded-2xl text-lg mb-3 flex items-center justify-center gap-3 shadow-lg shadow-violet-500/25">
                                <PhoneCallIcon className="w-6 h-6" /> {INSTITUTE_PHONE_1}
                            </a>
                            <a href="tel:+998950482345" className="block w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-lg mb-4 flex items-center justify-center gap-3">
                                <PhoneCallIcon className="w-6 h-6" /> {INSTITUTE_PHONE_2}
                            </a>
                            <p className="text-slate-500 text-xs mb-1">
                                <a href={`mailto:${INSTITUTE_EMAIL_1}`} className="hover:text-violet-600">{INSTITUTE_EMAIL_1}</a>
                                {' · '}
                                <a href={`mailto:${INSTITUTE_EMAIL_2}`} className="hover:text-violet-600">{INSTITUTE_EMAIL_2}</a>
                            </p>
                            <p className="text-slate-400 text-xs">{INSTITUTE_ADDRESS}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MOBILE MENU --- */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-xl flex flex-col justify-center items-center lg:hidden animate-fade-in-up">
                    <button onClick={() => setMobileMenuOpen(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-slate-700">
                        <XIcon className="w-8 h-8" />
                    </button>
                    <div className="flex flex-col gap-6 text-center text-lg font-bold">
                        {[0, 1, 2, 3].map((i) => (
                            <button key={i} onClick={() => { goToSlide(i); setMobileMenuOpen(false); }} className="text-slate-700 hover:text-violet-600 transition-colors">
                                {i === 0 ? 'Bosh sahifa' : i === 1 ? t('nav_features') : i === 2 ? t('nav_how_it_works') : 'Boshlash'}
                            </button>
                        ))}
                        <button onClick={() => { onOpenGuide(); setMobileMenuOpen(false); }} className="text-slate-700 hover:text-blue-600 transition-colors">{t('nav_guide')}</button>
                        {onOpenAbout && <button onClick={() => { onOpenAbout(); setMobileMenuOpen(false); }} className="text-slate-700 hover:text-violet-600 transition-colors">Institut haqida</button>}
                        <div className="pt-6 border-t border-slate-200 w-48 mx-auto">
                            <button onClick={() => { onLogin(); setMobileMenuOpen(false); }} className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg">
                                {t('auth_login_button')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- FIXED NAV --- */}
            <nav className="flex-none fixed top-0 left-0 right-0 z-50 py-3 md:py-4 px-4 md:px-6 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
                <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <img src={INSTITUTE_LOGO_SRC} alt={INSTITUTE_LOGO_TEXT} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-contain flex-shrink-0 bg-violet-50 p-1" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs sm:text-sm font-black tracking-tight text-slate-800 truncate uppercase">{INSTITUTE_LOGO_TEXT}</span>
                            <span className="text-[10px] font-medium text-slate-500 hidden sm:block truncate">{INSTITUTE_NAME_FULL}</span>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center">
                        {onOpenAbout && (
                            <button
                                onClick={onOpenAbout}
                                className="group relative px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-violet-600 transition-all duration-300 border border-slate-200 hover:border-violet-300 bg-white hover:bg-violet-50 shadow-sm hover:shadow-md"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 group-hover:bg-violet-500 transition-all" />
                                    Institut haqida
                                </span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
                        <button onClick={onLogin} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs md:text-sm transition-all shadow-lg shadow-violet-500/25">
                            {t('auth_login_button')}
                        </button>
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-700">
                            <MenuIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- SLIDES CONTAINER --- */}
            <div className="flex-1 min-h-0 w-full overflow-hidden">
                <div
                    className="landing-slides-track flex h-full"
                    style={{ transform: `translateX(-${currentSlide * 100}vw)` }}
                >
                    {/* SLIDE 0: HERO */}
                    <section className={`landing-slide flex flex-col items-center justify-center relative px-4 sm:px-6 md:px-8 pt-16 pb-24 ${currentSlide === 0 ? 'landing-slide-active' : ''}`} data-slide-index={0}>
                        <div className="landing-slide-inner relative z-10 text-center max-w-4xl mx-auto">
                            <div className="landing-content-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider mb-4">
                                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                {t('landing_hero_badge')}
                            </div>
                            <img src={INSTITUTE_LOGO_SRC} alt="" className="landing-content-in landing-content-in-delay-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full object-contain mx-auto mb-3 ring-2 ring-violet-200 bg-white p-1" />
                            <p className="landing-content-in landing-content-in-delay-1 text-sm text-slate-600 font-semibold mb-2">{INSTITUTE_NAME_FULL}</p>
                            <div className="landing-content-in landing-content-in-delay-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-200 mb-6">
                                <span className="text-sm font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
                                    {PLATFORM_NAME}
                                </span>
                            </div>
                            <h1 className="landing-content-in landing-content-in-delay-3 text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-4 px-1 text-slate-800">
                                {t('landing_hero_title_1')} <br className="hidden sm:block" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600">{t('landing_hero_title_2')}</span>
                            </h1>
                            <p className="landing-content-in landing-content-in-delay-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-8 font-medium">
                                {t('landing_hero_desc')}
                            </p>
                            <div className="landing-content-in landing-content-in-delay-5 flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-lg shadow-xl shadow-violet-500/30 transition-all hover:scale-105 flex items-center justify-center gap-2">
                                    {t('landing_cta_start')} <ChevronRightIcon className="w-5 h-5" />
                                </button>
                                <button onClick={onOpenGuide} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all">
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
                                    <div key={i} className="text-center bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-slate-200/50">
                                        <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">{s.value}</p>
                                        <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* SLIDE 1: FEATURES */}
                    <section className={`landing-slide flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 pt-20 pb-20 overflow-hidden ${currentSlide === 1 ? 'landing-slide-active' : ''}`} data-slide-index={1}>
                        <div className="landing-slide-inner w-full max-w-5xl mx-auto">
                            <p className="text-xs font-bold text-violet-600 mb-2 uppercase tracking-wider text-center">{INSTITUTE_NAME_FULL}</p>
                            <h2 className="text-2xl sm:text-4xl font-bold mb-8 text-center text-slate-800">{t('landing_features_title')}</h2>
                            <p className="text-slate-600 text-sm sm:text-base text-center max-w-xl mx-auto mb-10">{t('landing_features_desc')}</p>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {[
                                    { icon: <UserGroupIcon className="w-8 h-8 sm:w-10 sm:h-10 text-violet-500" />, title: t('landing_feature_consultium'), desc: t('landing_feature_consultium_desc'), bg: 'bg-violet-100', border: 'border-violet-200' },
                                    { icon: <ShieldCheckIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500" />, title: t('landing_feature_safe'), desc: t('landing_feature_safe_desc'), bg: 'bg-emerald-100', border: 'border-emerald-200' },
                                    { icon: <GlobeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />, title: t('landing_feature_global'), desc: t('landing_feature_global_desc'), bg: 'bg-blue-100', border: 'border-blue-200' },
                                    { icon: <HeartPulseIcon className="w-8 h-8 sm:w-10 sm:h-10 text-rose-500" />, title: t('landing_feature_ecg'), desc: t('landing_feature_ecg_desc'), bg: 'bg-rose-100', border: 'border-rose-200' },
                                    { icon: <StethoscopeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500" />, title: t('landing_feature_drug'), desc: t('landing_feature_drug_desc'), bg: 'bg-orange-100', border: 'border-orange-200' },
                                    { icon: <ChartBarIcon className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-500" />, title: t('landing_feature_risk'), desc: t('landing_feature_risk_desc'), bg: 'bg-cyan-100', border: 'border-cyan-200' },
                                ].map((f, i) => (
                                    <div key={i} className={`landing-feature-card p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-sm border hover:bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${f.border}`} style={{ animationDelay: `${i * 0.08}s` }}>
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3 ${f.bg}`}>{f.icon}</div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight mb-1.5">{f.title}</h3>
                                        <p className="text-xs text-slate-500 leading-snug line-clamp-3">{f.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-10 p-4 sm:p-6 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200">
                                <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-4 text-center">Platforma samaradorligi</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { label: t('landing_stats_protocols'), pct: 94, color: 'bg-gradient-to-r from-violet-500 to-fuchsia-500' },
                                        { label: t('landing_stats_clinics'), pct: 88, color: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
                                        { label: t('landing_stats_analyses'), pct: 98, color: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
                                        { label: t('landing_stats_experts'), pct: 92, color: 'bg-gradient-to-r from-orange-500 to-amber-500' },
                                    ].map((s, i) => (
                                        <div key={i} className="text-center">
                                            <div className="h-2 sm:h-2.5 rounded-full bg-slate-200 overflow-hidden mb-2">
                                                <div className={`h-full rounded-full ${s.color} transition-all duration-1000`} style={{ width: `${s.pct}%` }} />
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SLIDE 2: HOW IT WORKS */}
                    <section className={`landing-slide flex flex-col items-center px-4 sm:px-6 md:px-8 pt-20 pb-24 overflow-y-auto ${currentSlide === 2 ? 'landing-slide-active' : ''}`} data-slide-index={2}>
                        <div className="landing-slide-inner w-full max-w-5xl mx-auto">
                            <h2 className="text-2xl sm:text-4xl font-bold mb-3 text-center text-slate-800">{t('landing_how_title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">{t('landing_how_subtitle')}</span></h2>
                            <p className="text-slate-600 text-sm sm:text-base text-center max-w-2xl mx-auto mb-8 leading-relaxed">
                                {t('landing_how_intro' as never)}
                            </p>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                {[
                                    { step: '01', title: t('landing_how_step1'), desc: t('landing_how_step1_desc' as never), points: [t('landing_how_step1_p1' as never), t('landing_how_step1_p2' as never), t('landing_how_step1_p3' as never), t('landing_how_step1_p4' as never)], Icon: DocumentTextIcon, bg: 'bg-violet-100', border: 'border-violet-300', iconColor: 'text-violet-600' },
                                    { step: '02', title: t('landing_how_step2'), desc: t('landing_how_step2_desc' as never), points: [t('landing_how_step2_p1' as never), t('landing_how_step2_p2' as never), t('landing_how_step2_p3' as never), t('landing_how_step2_p4' as never)], Icon: BrainCircuitIcon, bg: 'bg-fuchsia-100', border: 'border-fuchsia-300', iconColor: 'text-fuchsia-600' },
                                    { step: '03', title: t('landing_how_step3'), desc: t('landing_how_step3_desc' as never), points: [t('landing_how_step3_p1' as never), t('landing_how_step3_p2' as never), t('landing_how_step3_p3' as never), t('landing_how_step3_p4' as never)], Icon: ShieldCheckIcon, bg: 'bg-emerald-100', border: 'border-emerald-300', iconColor: 'text-emerald-600' },
                                ].map((item, i) => (
                                    <div key={i} className="landing-step-card flex flex-col p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200 hover:border-slate-300 transition-all text-left hover:shadow-lg">
                                        <div className={`w-14 h-14 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center mb-4 flex-shrink-0`}>
                                            <item.Icon className={`w-7 h-7 ${item.iconColor}`} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 mb-1">{item.step}</span>
                                        <h3 className="text-base font-bold text-slate-800 mb-2 leading-tight">{item.title}</h3>
                                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{item.desc}</p>
                                        <ul className="space-y-1.5 text-[11px] text-slate-500">
                                            {item.points.map((p, j) => (
                                                <li key={j} className="flex gap-2">
                                                    <span className="text-violet-500 flex-shrink-0">•</span>
                                                    <span>{p}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                            <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-2">
                                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">01</span>
                                <div className="flex-1 h-0.5 sm:h-1 min-w-[40px] rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
                                <span className="text-[10px] text-violet-600 font-semibold">2–5 min</span>
                                <div className="flex-1 h-0.5 sm:h-1 min-w-[40px] rounded-full bg-gradient-to-r from-fuchsia-400 to-emerald-400" />
                                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">02</span>
                                <div className="flex-1 h-0.5 sm:h-1 min-w-[40px] rounded-full bg-gradient-to-r from-fuchsia-400 to-emerald-400" />
                                <span className="text-[10px] text-emerald-600 font-semibold">5–15 min</span>
                                <div className="flex-1 h-0.5 sm:h-1 min-w-[40px] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300" />
                                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">03</span>
                            </div>
                            <p className="text-center text-xs text-slate-500 mb-6 px-2">
                                {t('landing_how_benefit' as never)}
                            </p>
                            <button onClick={onOpenGuide} className="text-violet-600 font-bold hover:text-violet-500 flex items-center gap-2 mx-auto">
                                {t('landing_how_cta')} <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </section>

                    {/* SLIDE 3: CTA + FOOTER */}
                    <section className={`landing-slide flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 pt-20 pb-20 ${currentSlide === 3 ? 'landing-slide-active' : ''}`} data-slide-index={3}>
                        <div className="landing-slide-inner flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                            <p className="text-xs font-bold text-violet-600 mb-3 uppercase tracking-wider">{INSTITUTE_NAME_FULL}</p>
                            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-6 tracking-tight text-slate-800">{t('landing_cta_bottom_title')}</h2>
                            <p className="text-base sm:text-lg text-slate-600 mb-10 font-medium">{t('landing_cta_bottom_desc')}</p>
                            <button onClick={onLogin} className="px-10 py-5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-lg rounded-full shadow-xl shadow-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/40 hover:scale-105 transition-all duration-300">
                                {t('landing_cta_bottom_btn')}
                            </button>
                            <div className="mt-12 pt-8 border-t border-slate-200 w-full">
                                <img src={INSTITUTE_LOGO_SRC} alt="" className="w-14 h-14 rounded-full object-contain mx-auto mb-2 bg-violet-50 p-1" />
                                <p className="text-slate-800 font-black text-sm uppercase mb-1">{INSTITUTE_LOGO_TEXT}</p>
                                <p className="text-slate-400 text-xs mb-3">{FOOTER_COPYRIGHT}</p>
                                <p className="text-slate-500 text-xs mb-4">{PLATFORM_NAME}</p>
                                <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 mb-4">
                                    <a href={`tel:+998950442345`} className="hover:text-violet-600">{INSTITUTE_PHONE_1}</a>
                                    <a href={`tel:+998950482345`} className="hover:text-violet-600">{INSTITUTE_PHONE_2}</a>
                                    <a href={`mailto:${INSTITUTE_EMAIL_1}`} className="hover:text-violet-600">{INSTITUTE_EMAIL_1}</a>
                                </div>
                                <p className="text-slate-400 text-xs mb-4">{INSTITUTE_ADDRESS}</p>
                                <div className="flex justify-center gap-6">
                                    <button onClick={() => setShowContactModal(true)} className="text-slate-500 hover:text-violet-600 text-xs font-medium">{t('landing_footer_contact')}</button>
                                    {onOpenAbout && <button onClick={onOpenAbout} className="text-violet-600 hover:text-violet-500 text-xs font-medium">Institut haqida</button>}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* --- NAV PILL --- */}
            <div className="flex-none fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4">
                <div className="landing-nav-pill flex items-center gap-2 sm:gap-4 py-2.5 px-4 sm:px-6 rounded-full bg-white/90 border border-slate-200 shadow-lg backdrop-blur-xl">
                    <button onClick={goPrev} className="landing-nav-arrow p-2 rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-100 transition-all duration-300" aria-label="Oldingi">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1.5 sm:gap-2 mx-1">
                        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToSlide(i)}
                                className={`landing-dot w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'landing-dot-active bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg' : 'bg-slate-300 hover:bg-slate-400'}`}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                    <button onClick={goNext} className="landing-nav-arrow p-2 rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-100 transition-all duration-300 flex items-center gap-1.5" aria-label="Keyingi">
                        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-slate-400">Keyingi</span>
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
