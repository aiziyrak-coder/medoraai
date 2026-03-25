
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
import {
    LANDING_CONTACT_PHONE_DISPLAY,
    LANDING_CONTACT_PHONE_E164,
} from '../constants/platformBranding';

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

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.318.023.46.14.097.073.156.162.195.258.036.09.06.21.07.36.012.16.012.37.012.62v4.88c0 .25 0 .46-.012.62-.01.15-.034.27-.07.36a.65.65 0 0 1-.195.258c-.142.117-.36.142-.46.14-.16-.002-.31-.014-.46-.065l-3.09-1.16v2.44c0 .21-.084.41-.234.56-.15.15-.35.234-.56.234h-1.5c-.21 0-.41-.084-.56-.234a.795.795 0 0 1-.234-.56v-2.44l-3.09 1.16c-.15.05-.3.063-.46.065-.1.002-.318-.023-.46-.14a.65.65 0 0 1-.195-.258c-.036-.09-.06-.21-.07-.36-.012-.16-.012-.37-.012-.62v-4.88c0-.25 0-.46.012-.62.01-.15.034-.27.07-.36a.65.65 0 0 1 .195-.258c.142-.117.36-.142.46-.14.16.002.31.014.46.065l3.09 1.16V8.5c0-.21.084-.41.234-.56.15-.15.35-.234.56-.234h1.5c.21 0 .41.084.56.234.15.15.234.35.234.56v2.44l3.09-1.16c.15-.05.3-.063.46-.065z"/>
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
    const [scrolled, setScrolled] = useState(false);
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

    // Scroll listener for navbar background
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    /** Scroll qilsa ham boshqa slaydga o'tadi: pastga = keyingi, yuqoriga = oldingi */
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
        <div className="relative min-h-screen text-slate-900 font-sans overflow-x-hidden selection:bg-blue-200 selection:text-slate-900">
            <div className="fixed inset-0 -z-10 landing-animated-bg" aria-hidden />
            <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-white/25 via-transparent to-white/30" aria-hidden />

            {/* --- CONTACT MODAL --- */}
            {showContactModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in-up">
                    <div 
                        className="bg-white border border-slate-200/90 w-full max-w-sm rounded-3xl p-8 relative shadow-2xl shadow-slate-300/50 transform transition-all scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowContactModal(false)}
                            className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-200 shadow-lg shadow-emerald-200/60">
                                <PhoneCallIcon className="w-10 h-10 text-emerald-600 animate-pulse" />
                            </div>
                            
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('landing_contact_modal_title')}</h3>
                            <p className="text-slate-600 text-sm mb-8 leading-relaxed">
                                {t('landing_contact_modal_desc')}
                            </p>

                            <a 
                                href={`tel:${LANDING_CONTACT_PHONE_E164}`}
                                className="block w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-300/50 transition-all transform hover:scale-[1.02] mb-4 flex items-center justify-center gap-3"
                            >
                                <PhoneCallIcon className="w-6 h-6" />
                                {LANDING_CONTACT_PHONE_DISPLAY}
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
                <div className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-xl flex flex-col justify-center items-center lg:hidden animate-fade-in-up border-b border-slate-100">
                    <button 
                        onClick={() => setMobileMenuOpen(false)}
                        className="absolute top-6 right-6 p-2 text-slate-500 hover:text-slate-900"
                    >
                        <XIcon className="w-8 h-8" />
                    </button>
                    <div className="flex flex-col gap-8 text-center text-xl font-bold text-slate-800">
                        <button onClick={() => scrollToSection('features')} className="hover:text-blue-600 transition-colors">{t('nav_features')}</button>
                        <button onClick={() => scrollToSection('how-it-works')} className="hover:text-blue-600 transition-colors">{t('nav_how_it_works')}</button>
                        <button onClick={() => scrollToSection('testimonials')} className="hover:text-blue-600 transition-colors">{t('nav_reviews')}</button>
                        <button onClick={() => { onOpenGuide(); setMobileMenuOpen(false); }} className="hover:text-blue-600 transition-colors">{t('nav_guide')}</button>
                        <div className="pt-8 border-t border-slate-200 w-48 mx-auto">
                            <button 
                                onClick={onLogin}
                                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg"
                            >
                                {t('auth_login_button')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- NAVBAR --- */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200/80 py-3 shadow-md shadow-slate-200/40' : 'bg-transparent py-4 md:py-6'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-blue-700 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">MedoraAi</span>
                    </div>
                    
                    {/* Desktop Menu */}
                    <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-700">
                        <button onClick={() => scrollToSection('features')} className="hover:text-blue-600 transition-colors">{t('nav_features')}</button>
                        <button onClick={() => scrollToSection('how-it-works')} className="hover:text-blue-600 transition-colors">{t('nav_how_it_works')}</button>
                        <button onClick={() => scrollToSection('testimonials')} className="hover:text-blue-600 transition-colors">{t('nav_reviews')}</button>
                        <button onClick={onOpenGuide} className="hover:text-blue-600 transition-colors">{t('nav_guide')}</button>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} variant="light" />
                        <button 
                            onClick={onLogin}
                            className="hidden lg:block px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs md:text-sm hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-400/30 hover:scale-105 transform duration-200"
                        >
                            {t('auth_login_button')}
                        </button>
                        
                        {/* Mobile Menu Button */}
                        <button 
                            onClick={() => setMobileMenuOpen(true)}
                            className="lg:hidden p-2 text-slate-700 hover:text-blue-600 transition-colors"
                        >
                            <MenuIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <header className="relative pt-32 pb-20 lg:pt-52 lg:pb-40 overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[min(90vw,720px)] h-[420px] bg-gradient-to-br from-sky-300/50 via-fuchsia-200/40 to-amber-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-blue-200/80 text-blue-800 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in-up shadow-md shadow-blue-100/80">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        {t('landing_hero_badge')}
                    </div>
                    
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] mb-8 text-slate-900 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                        {t('landing_hero_title_1')} <br className="hidden md:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600">{t('landing_hero_title_2')}</span>
                    </h1>
                    
                    <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in-up font-medium px-4" style={{animationDelay: '0.2s'}}>
                        {t('landing_hero_desc')}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 animate-fade-in-up px-4" style={{animationDelay: '0.3s'}}>
                        <button 
                            onClick={onLogin}
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg shadow-xl shadow-blue-400/40 transition-all hover:scale-105 flex items-center justify-center gap-2"
                        >
                            {t('landing_cta_start')} <ChevronRightIcon className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={onOpenGuide}
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/90 hover:bg-white border-2 border-slate-200 text-slate-800 font-semibold text-lg shadow-lg shadow-slate-200/60 transition-all flex items-center justify-center gap-2"
                        >
                            <PlayIcon className="w-5 h-5 text-violet-600" /> {t('landing_cta_guide')}
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto border-t border-slate-200/80 pt-12 animate-fade-in-up px-4" style={{animationDelay: '0.4s'}}>
                        {[
                            { label: t('landing_stats_protocols'), value: "15,000+" },
                            { label: t('landing_stats_clinics'), value: "50+" },
                            { label: t('landing_stats_analyses'), value: "100K+" },
                            { label: t('landing_stats_experts'), value: "12+" },
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-700 to-violet-700 bg-clip-text text-transparent mb-1">{stat.value}</p>
                                <p className="text-xs md:text-sm text-slate-600 font-semibold uppercase tracking-wide">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* --- FEATURES SECTION --- */}
            <section id="features" className="py-24 md:py-32 relative">
                <div className="absolute inset-0 bg-white/45 backdrop-blur-[2px] -z-10" aria-hidden />
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-slate-900">{t('landing_features_title')}</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto text-base md:text-lg font-medium">
                            {t('landing_features_desc')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                        {[
                            {
                                icon: <UserGroupIcon className="w-10 h-10 text-blue-600" />,
                                title: t('landing_feature_consultium'),
                                desc: t('landing_feature_consultium_desc'),
                                bg: "bg-blue-100",
                                border: "border-blue-200/80"
                            },
                            {
                                icon: <ShieldCheckIcon className="w-10 h-10 text-emerald-600" />,
                                title: t('landing_feature_safe'),
                                desc: t('landing_feature_safe_desc'),
                                bg: "bg-emerald-100",
                                border: "border-emerald-200/80"
                            },
                            {
                                icon: <GlobeIcon className="w-10 h-10 text-violet-600" />,
                                title: t('landing_feature_global'),
                                desc: t('landing_feature_global_desc'),
                                bg: "bg-violet-100",
                                border: "border-violet-200/80"
                            },
                            {
                                icon: <HeartPulseIcon className="w-10 h-10 text-rose-600" />,
                                title: t('landing_feature_ecg'),
                                desc: t('landing_feature_ecg_desc'),
                                bg: "bg-rose-100",
                                border: "border-rose-200/80"
                            },
                            {
                                icon: <StethoscopeIcon className="w-10 h-10 text-orange-600" />,
                                title: t('landing_feature_drug'),
                                desc: t('landing_feature_drug_desc'),
                                bg: "bg-orange-100",
                                border: "border-orange-200/80"
                            },
                            {
                                icon: <ChartBarIcon className="w-10 h-10 text-cyan-600" />,
                                title: t('landing_feature_risk'),
                                desc: t('landing_feature_risk_desc'),
                                bg: "bg-cyan-100",
                                border: "border-cyan-200/80"
                            }
                        ].map((feature, i) => (
                            <div key={i} className={`group p-8 md:p-10 rounded-[2rem] bg-white/90 border-2 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-violet-200/40 transition-all duration-300 hover:-translate-y-2 ${feature.border}`}>
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-6 md:mb-8 transition-transform group-hover:scale-110 ${feature.bg}`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-slate-900">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed font-medium text-sm md:text-base">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- HOW IT WORKS --- */}
            <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-300/20 via-transparent to-fuchsia-200/25 -z-10" aria-hidden />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="w-full lg:w-1/2">
                            <h2 className="text-3xl md:text-5xl font-bold mb-10 leading-tight text-center lg:text-left text-slate-900">{t('landing_how_title')} <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">{t('landing_how_subtitle')}</span></h2>
                            <div className="space-y-8 md:space-y-12">
                                {[
                                    { step: "01", title: t('landing_how_step1'), desc: t('landing_how_step1_desc'), icon: <DocumentTextIcon className="w-6 h-6 text-white"/> },
                                    { step: "02", title: t('landing_how_step2'), desc: t('landing_how_step2_desc'), icon: <BrainCircuitIcon className="w-6 h-6 text-white"/> },
                                    { step: "03", title: t('landing_how_step3'), desc: t('landing_how_step3_desc'), icon: <ShieldCheckIcon className="w-6 h-6 text-white"/> }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-6 md:gap-8 group">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 border-2 border-white shadow-lg flex items-center justify-center text-xl font-bold z-10 relative group-hover:from-blue-500 group-hover:to-indigo-500 transition-colors duration-300">
                                                {item.icon}
                                            </div>
                                            {i !== 2 && <div className="absolute top-12 md:top-16 left-1/2 -translate-x-1/2 w-0.5 h-16 md:h-20 bg-gradient-to-b from-blue-200 to-violet-200 group-hover:from-blue-300 transition-colors delay-100"></div>}
                                        </div>
                                        <div className="pt-1 md:pt-2">
                                            <h4 className="text-xl md:text-2xl font-bold mb-2 md:mb-3 text-slate-900">{item.title}</h4>
                                            <p className="text-slate-600 text-base md:text-lg leading-relaxed font-medium">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={onOpenGuide} className="mt-12 md:mt-16 text-blue-600 font-bold hover:text-violet-600 flex items-center gap-3 text-lg transition-transform hover:translate-x-2 mx-auto lg:mx-0">
                                {t('landing_how_cta')} <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="w-full lg:w-1/2 relative hidden lg:block">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-violet-400/30 blur-[80px] rounded-full"></div>
                            <div className="relative bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-200/50 transform rotate-3 hover:rotate-0 transition-transform duration-500 ring-1 ring-white/80">
                                {/* Mock UI */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-5 border-b border-slate-200 pb-6">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-lg">AI</div>
                                        <div className="space-y-2">
                                            <div className="h-3 w-40 bg-slate-200 rounded-full"></div>
                                            <div className="h-2 w-24 bg-slate-100 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-4 w-full bg-slate-100 rounded-full"></div>
                                        <div className="h-4 w-5/6 bg-slate-100 rounded-full"></div>
                                        <div className="h-4 w-4/6 bg-slate-100 rounded-full"></div>
                                    </div>
                                    <div className="mt-6 p-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-4">
                                        <ShieldCheckIcon className="w-8 h-8 text-emerald-600" />
                                        <div>
                                            <p className="text-emerald-800 font-bold text-lg">Tashxis Tasdiqlandi</p>
                                            <p className="text-emerald-600/90 text-sm">Ishonch darajasi: 98%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- TESTIMONIALS --- */}
            <section id="testimonials" className="py-24 md:py-32 relative">
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm -z-10" aria-hidden />
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 md:mb-20 text-slate-900">{t('landing_testimonials_title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { 
                                name: t('testimonial_1_name'), 
                                role: t('testimonial_1_role'), 
                                text: t('testimonial_1_text') 
                            },
                            { 
                                name: t('testimonial_2_name'), 
                                role: t('testimonial_2_role'), 
                                text: t('testimonial_2_text') 
                            },
                            { 
                                name: t('testimonial_3_name'), 
                                role: t('testimonial_3_role'), 
                                text: t('testimonial_3_text') 
                            }
                        ].map((review, i) => (
                            <div key={i} className="p-8 md:p-10 bg-white rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:border-violet-200 transition-all relative">
                                <div className="absolute -top-6 left-8 text-6xl text-blue-400/40 font-serif">"</div>
                                <div className="flex gap-1 mb-6 text-amber-400">
                                    {[1,2,3,4,5].map(s => <span key={s}>★</span>)}
                                </div>
                                <p className="text-slate-700 mb-8 italic text-lg leading-relaxed font-medium">"{review.text}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                                        <UserCircleIcon className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-lg">{review.name}</p>
                                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">{review.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- PARTNERS --- */}
            <section className="py-20 border-t border-slate-200/80 bg-white/40 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-[0.2em] mb-12">{t('landing_partners_title')}</p>
                    <div className="flex flex-wrap justify-center gap-10 md:gap-16 text-slate-700">
                        <div className="text-xl md:text-2xl font-black flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full"></div> AKFA MEDLINE</div>
                        <div className="text-xl md:text-2xl font-black flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full"></div> SHOX MED</div>
                        <div className="text-xl md:text-2xl font-black flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full"></div> EZGU NIYAT</div>
                        <div className="text-xl md:text-2xl font-black flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-full"></div> ERA MED</div>
                    </div>
                </div>
            </section>

            {/* --- CTA --- */}
            <section className="py-24 md:py-32 relative overflow-hidden">
                <div
                    className="absolute inset-0 animate-cta-gradient"
                    style={{
                        background:
                            'linear-gradient(125deg, #0ea5e9 0%, #2563eb 25%, #7c3aed 50%, #db2777 75%, #06b6d4 100%)',
                        backgroundSize: '300% 300%',
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/20" />
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl md:text-6xl font-black mb-6 md:mb-8 tracking-tight text-white drop-shadow-md">{t('landing_cta_bottom_title')}</h2>
                    <p className="text-lg md:text-xl text-blue-50 mb-10 md:mb-12 font-medium max-w-2xl mx-auto">
                        {t('landing_cta_bottom_desc')}
                    </p>
                    <button 
                        onClick={onLogin}
                        className="px-10 py-5 md:px-12 md:py-6 bg-white text-indigo-700 font-black text-lg md:text-xl rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:shadow-[0_16px_50px_rgba(255,255,255,0.35)] hover:scale-105 transition-all duration-300"
                    >
                        {t('landing_cta_bottom_btn')}
                    </button>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="py-12 md:py-16 bg-white/80 backdrop-blur-md border-t border-slate-200 text-sm text-slate-600">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left">
                    <div>
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
                            <BrainCircuitIcon className="w-8 h-8 text-blue-600" />
                            <span className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-violet-700 bg-clip-text text-transparent tracking-tight">MedoraAi</span>
                        </div>
                        <p className="leading-relaxed mb-6 text-slate-600">{t('auth_marketing_desc').substring(0, 100)}...</p>
                        <div className="flex justify-center md:justify-start gap-4">
                            {[1,2,3].map(i => (
                                <div key={i} className="w-8 h-8 bg-slate-200 rounded-full hover:bg-blue-500 transition-colors cursor-pointer" />
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider">{t('landing_footer_platform')}</h4>
                        <ul className="space-y-4">
                            <li>
                                <button onClick={() => scrollToSection('features')} className="hover:text-blue-600 transition-colors font-medium">
                                    {t('nav_features')}
                                </button>
                            </li>
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_price')}
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_security')}
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_api')}
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider">{t('landing_footer_company')}</h4>
                        <ul className="space-y-4">
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_about')}
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_careers')}
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_blog')}
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-blue-600 transition-colors font-medium">
                                    {t('landing_footer_contact_link')}
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider">{t('landing_footer_contact')}</h4>
                        <p className="mb-2">{t('landing_contact_address')}</p>
                        <a href={`tel:${LANDING_CONTACT_PHONE_E164}`} className="block mb-2 text-slate-900 font-bold hover:text-blue-600 transition-colors text-lg">{LANDING_CONTACT_PHONE_DISPLAY}</a>
                        <a href="https://t.me/xazrat_bro" target="_blank" rel="noopener noreferrer" className="block mb-6 hover:text-blue-600 transition-colors flex items-center justify-center md:justify-start gap-2 font-medium">
                             <TelegramIcon className="w-5 h-5 text-sky-500"/> @xazrat_bro
                        </a>
                        <div 
                            onClick={() => setShowContactModal(true)}
                            className="p-4 bg-blue-50 rounded-xl border-2 border-blue-100 cursor-pointer hover:bg-blue-100/80 transition-colors group"
                        >
                            <p className="text-blue-700 font-bold group-hover:text-blue-800 transition-colors">{t('landing_contact_support')}</p>
                        </div>
                    </div>
                </div>
                
                <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-slate-600">&copy; 2025 MedoraAi. {t('footer_rights')}</p>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 bg-slate-100/90 px-6 py-2 rounded-full border border-slate-200 backdrop-blur-sm">
                        <div className="flex items-center gap-2 group">
                            <span className="text-slate-500 text-xs uppercase tracking-wide">{t('footer_creator')}:</span>
                            <a href="https://cdcgroup.uz" target="_blank" rel="noopener noreferrer" className="text-slate-900 font-bold hover:text-blue-600 transition-colors flex items-center gap-1">
                                CDCGroup
                            </a>
                        </div>
                        <span className="hidden sm:block w-px h-4 bg-slate-300"></span>
                        <div className="flex items-center gap-2 group">
                            <span className="text-slate-500 text-xs uppercase tracking-wide">{t('footer_support')}:</span>
                            <a href="https://cdcgroup.uz" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent font-bold hover:opacity-90 transition-opacity">
                                CraDev Company
                            </a>
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <a href="#" className="hover:text-blue-600 transition-colors font-medium">{t('auth_privacy')}</a>
                        <a href="#" className="hover:text-blue-600 transition-colors font-medium">{t('auth_terms')}</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
