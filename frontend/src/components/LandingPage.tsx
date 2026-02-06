
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import { Language } from '../i18n/LanguageContext';
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
}

// Inline Phone Icon
const PhoneIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
        <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
    </svg>
);

const PhoneCallIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.62-.2-1.12-.31-1.08-.65.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
    </svg>
);

const MenuIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onOpenGuide }) => {
    const { t, language, setLanguage } = useTranslation();
    const [scrolled, setScrolled] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Smooth scroll function to replace anchor tags
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const headerOffset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
        setMobileMenuOpen(false); // Close mobile menu if open
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden selection:bg-blue-500 selection:text-white">
            
            {/* --- CONTACT MODAL --- */}
            {showContactModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in-up">
                    <div 
                        className="bg-slate-900 border border-white/20 w-full max-w-sm rounded-3xl p-8 relative shadow-2xl transform transition-all scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowContactModal(false)}
                            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>

                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                <PhoneCallIcon className="w-10 h-10 text-green-500 animate-pulse" />
                            </div>
                            
                            <h3 className="text-2xl font-bold text-white mb-2">{t('landing_contact_modal_title')}</h3>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                                {t('landing_contact_modal_desc')}
                            </p>

                            <a 
                                href="tel:+998948788878"
                                className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl text-lg shadow-lg hover:shadow-green-500/25 transition-all transform hover:scale-105 mb-4 flex items-center justify-center gap-3"
                            >
                                <PhoneCallIcon className="w-6 h-6" />
                                +998 94 878 88 78
                            </a>

                            <p className="text-xs text-slate-500">
                                {t('landing_contact_modal_call')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MOBILE MENU OVERLAY --- */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-xl flex flex-col justify-center items-center lg:hidden animate-fade-in-up">
                    <button 
                        onClick={() => setMobileMenuOpen(false)}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white"
                    >
                        <XIcon className="w-8 h-8" />
                    </button>
                    <div className="flex flex-col gap-8 text-center text-xl font-bold">
                        <button onClick={() => scrollToSection('features')} className="hover:text-blue-400 transition-colors">{t('nav_features')}</button>
                        <button onClick={() => scrollToSection('how-it-works')} className="hover:text-blue-400 transition-colors">{t('nav_how_it_works')}</button>
                        <button onClick={() => scrollToSection('testimonials')} className="hover:text-blue-400 transition-colors">{t('nav_reviews')}</button>
                        <button onClick={() => { onOpenGuide(); setMobileMenuOpen(false); }} className="hover:text-blue-400 transition-colors">{t('nav_guide')}</button>
                        <div className="pt-8 border-t border-white/10 w-48 mx-auto">
                            <button 
                                onClick={onLogin}
                                className="w-full px-6 py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-blue-50 transition-all"
                            >
                                {t('auth_login_button')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- NAVBAR --- */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/90 backdrop-blur-xl border-b border-white/10 py-3 shadow-lg' : 'bg-transparent py-4 md:py-6'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {/* Icon removed based on request */}
                        <span className="text-2xl font-black tracking-tighter text-white">MedoraAi</span>
                    </div>
                    
                    {/* Desktop Menu */}
                    <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
                        <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">{t('nav_features')}</button>
                        <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">{t('nav_how_it_works')}</button>
                        <button onClick={() => scrollToSection('testimonials')} className="hover:text-white transition-colors">{t('nav_reviews')}</button>
                        <button onClick={onOpenGuide} className="hover:text-white transition-colors">{t('nav_guide')}</button>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        <LanguageSwitcher language={language} onLanguageChange={setLanguage as (lang: Language) => void} />
                        <button 
                            onClick={onLogin}
                            className="hidden lg:block px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-white text-slate-900 font-bold text-xs md:text-sm hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 transform duration-200"
                        >
                            {t('auth_login_button')}
                        </button>
                        
                        {/* Mobile Menu Button */}
                        <button 
                            onClick={() => setMobileMenuOpen(true)}
                            className="lg:hidden p-2 text-slate-300 hover:text-white transition-colors"
                        >
                            <MenuIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <header className="relative pt-32 pb-20 lg:pt-52 lg:pb-40 overflow-hidden">
                <div className="absolute inset-0 medical-mesh-bg opacity-60"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in-up backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        {t('landing_hero_badge')}
                    </div>
                    
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] mb-8 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                        {t('landing_hero_title_1')} <br className="hidden md:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">{t('landing_hero_title_2')}</span>
                    </h1>
                    
                    <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in-up font-light px-4" style={{animationDelay: '0.2s'}}>
                        {t('landing_hero_desc')}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 animate-fade-in-up px-4" style={{animationDelay: '0.3s'}}>
                        <button 
                            onClick={onLogin}
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-xl shadow-blue-600/30 transition-all hover:scale-105 flex items-center justify-center gap-2"
                        >
                            {t('landing_cta_start')} <ChevronRightIcon className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={onOpenGuide}
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg backdrop-blur-sm transition-all flex items-center justify-center gap-2"
                        >
                            <PlayIcon className="w-5 h-5" /> {t('landing_cta_guide')}
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto border-t border-white/10 pt-12 animate-fade-in-up px-4" style={{animationDelay: '0.4s'}}>
                        {[
                            { label: t('landing_stats_protocols'), value: "15,000+" },
                            { label: t('landing_stats_clinics'), value: "50+" },
                            { label: t('landing_stats_analyses'), value: "100K+" },
                            { label: t('landing_stats_experts'), value: "12+" },
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <p className="text-3xl md:text-4xl font-black text-white mb-1">{stat.value}</p>
                                <p className="text-xs md:text-sm text-slate-400 font-medium uppercase tracking-wide">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* --- FEATURES SECTION --- */}
            <section id="features" className="py-24 md:py-32 bg-slate-900 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">{t('landing_features_title')}</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto text-base md:text-lg">
                            {t('landing_features_desc')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                        {[
                            {
                                icon: <UserGroupIcon className="w-10 h-10 text-blue-400" />,
                                title: t('landing_feature_consultium'),
                                desc: t('landing_feature_consultium_desc'),
                                bg: "bg-blue-500/10",
                                border: "border-blue-500/20"
                            },
                            {
                                icon: <ShieldCheckIcon className="w-10 h-10 text-green-400" />,
                                title: t('landing_feature_safe'),
                                desc: t('landing_feature_safe_desc'),
                                bg: "bg-green-500/10",
                                border: "border-green-500/20"
                            },
                            {
                                icon: <GlobeIcon className="w-10 h-10 text-purple-400" />,
                                title: t('landing_feature_global'),
                                desc: t('landing_feature_global_desc'),
                                bg: "bg-purple-500/10",
                                border: "border-purple-500/20"
                            },
                            {
                                icon: <HeartPulseIcon className="w-10 h-10 text-red-400" />,
                                title: t('landing_feature_ecg'),
                                desc: t('landing_feature_ecg_desc'),
                                bg: "bg-red-500/10",
                                border: "border-red-500/20"
                            },
                            {
                                icon: <StethoscopeIcon className="w-10 h-10 text-orange-400" />,
                                title: t('landing_feature_drug'),
                                desc: t('landing_feature_drug_desc'),
                                bg: "bg-orange-500/10",
                                border: "border-orange-500/20"
                            },
                            {
                                icon: <ChartBarIcon className="w-10 h-10 text-cyan-400" />,
                                title: t('landing_feature_risk'),
                                desc: t('landing_feature_risk_desc'),
                                bg: "bg-cyan-500/10",
                                border: "border-cyan-500/20"
                            }
                        ].map((feature, i) => (
                            <div key={i} className={`group p-8 md:p-10 rounded-[2rem] bg-slate-800/50 border hover:bg-slate-800 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${feature.border}`}>
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-6 md:mb-8 transition-transform group-hover:scale-110 ${feature.bg}`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">{feature.title}</h3>
                                <p className="text-slate-400 leading-relaxed font-medium text-sm md:text-base">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- HOW IT WORKS --- */}
            <section id="how-it-works" className="py-24 md:py-32 bg-slate-950 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-900/10 to-transparent"></div>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                        <div className="w-full lg:w-1/2">
                            <h2 className="text-3xl md:text-5xl font-bold mb-10 leading-tight text-center lg:text-left">{t('landing_how_title')} <br/><span className="text-blue-500">{t('landing_how_subtitle')}</span></h2>
                            <div className="space-y-8 md:space-y-12">
                                {[
                                    { step: "01", title: t('landing_how_step1'), desc: t('landing_how_step1_desc'), icon: <DocumentTextIcon className="w-6 h-6 text-white"/> },
                                    { step: "02", title: t('landing_how_step2'), desc: t('landing_how_step2_desc'), icon: <BrainCircuitIcon className="w-6 h-6 text-white"/> },
                                    { step: "03", title: t('landing_how_step3'), desc: t('landing_how_step3_desc'), icon: <ShieldCheckIcon className="w-6 h-6 text-white"/> }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-6 md:gap-8 group">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold shadow-lg z-10 relative group-hover:bg-blue-600 group-hover:border-blue-500 transition-colors duration-300">
                                                {item.icon}
                                            </div>
                                            {i !== 2 && <div className="absolute top-12 md:top-16 left-1/2 -translate-x-1/2 w-0.5 h-16 md:h-20 bg-slate-800 group-hover:bg-blue-900 transition-colors delay-100"></div>}
                                        </div>
                                        <div className="pt-1 md:pt-2">
                                            <h4 className="text-xl md:text-2xl font-bold mb-2 md:mb-3 text-white">{item.title}</h4>
                                            <p className="text-slate-400 text-base md:text-lg leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={onOpenGuide} className="mt-12 md:mt-16 text-blue-400 font-bold hover:text-blue-300 flex items-center gap-3 text-lg transition-transform hover:translate-x-2 mx-auto lg:mx-0">
                                {t('landing_how_cta')} <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="w-full lg:w-1/2 relative hidden lg:block">
                            <div className="absolute inset-0 bg-blue-600/20 blur-[100px] rounded-full"></div>
                            <div className="relative bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500 ring-1 ring-white/10">
                                {/* Mock UI */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-5 border-b border-white/10 pb-6">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg">AI</div>
                                        <div className="space-y-2">
                                            <div className="h-3 w-40 bg-white/20 rounded-full"></div>
                                            <div className="h-2 w-24 bg-white/10 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-4 w-full bg-white/5 rounded-full"></div>
                                        <div className="h-4 w-5/6 bg-white/5 rounded-full"></div>
                                        <div className="h-4 w-4/6 bg-white/5 rounded-full"></div>
                                    </div>
                                    <div className="mt-6 p-6 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-4">
                                        <ShieldCheckIcon className="w-8 h-8 text-green-400" />
                                        <div>
                                            <p className="text-green-400 font-bold text-lg">Tashxis Tasdiqlandi</p>
                                            <p className="text-green-300/70 text-sm">Ishonch darajasi: 98%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- TESTIMONIALS --- */}
            <section id="testimonials" className="py-24 md:py-32 bg-slate-900">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 md:mb-20">{t('landing_testimonials_title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: "Dr. A. Karimov", role: "Kardiolog, 15 yillik tajriba", text: "MedoraAi murakkab holatlarda ikkinchi fikrni olish uchun ajoyib vosita. Ayniqsa EKG tahlili juda aniq va tezkor." },
                            { name: "Dr. S. Umarova", role: "Nevrolog", text: "Noyob kasalliklarni tashxislashda vaqtni tejashga yordam beradi. Tadqiqot bo'limi shunchaki xazina, eng so'nggi maqolalar doim qo'l ostida." },
                            { name: "Shifokorlar Assotsiatsiyasi", role: "Hamkor", text: "Biz ushbu platformani O'zbekistondagi barcha klinikalarga tavsiya qilamiz. Zamonaviy tibbiyot kelajagi aynan shu yerda." }
                        ].map((review, i) => (
                            <div key={i} className="p-8 md:p-10 bg-white/5 rounded-[2rem] border border-white/5 hover:bg-white/10 transition-colors relative">
                                <div className="absolute -top-6 left-8 text-6xl text-blue-500 opacity-30 font-serif">"</div>
                                <div className="flex gap-1 mb-6 text-yellow-500">
                                    {[1,2,3,4,5].map(s => <span key={s}>★</span>)}
                                </div>
                                <p className="text-slate-300 mb-8 italic text-lg leading-relaxed">"{review.text}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                                        <UserCircleIcon className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{review.name}</p>
                                        <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">{review.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- PARTNERS --- */}
            <section className="py-20 border-t border-white/5 bg-slate-950">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mb-12">{t('landing_partners_title')}</p>
                    <div className="flex flex-wrap justify-center gap-10 md:gap-16 opacity-40 hover:opacity-100 transition-opacity duration-500">
                        {/* Placeholders for logos */}
                        <div className="text-2xl md:text-3xl font-black text-white flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full"></div> AKFA MEDLINE</div>
                        <div className="text-2xl md:text-3xl font-black text-white flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full"></div> SHOX MED</div>
                        <div className="text-2xl md:text-3xl font-black text-white flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full"></div> EZGU NIYAT</div>
                        <div className="text-2xl md:text-3xl font-black text-white flex items-center gap-2"><div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full"></div> ERA MED</div>
                    </div>
                </div>
            </section>

            {/* --- CTA --- */}
            <section className="py-24 md:py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-600/20"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900"></div>
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl md:text-6xl font-black mb-6 md:mb-8 tracking-tight">{t('landing_cta_bottom_title')}</h2>
                    <p className="text-lg md:text-xl text-blue-100 mb-10 md:mb-12 font-light max-w-2xl mx-auto">
                        {t('landing_cta_bottom_desc')}
                    </p>
                    <button 
                        onClick={onLogin}
                        className="px-10 py-5 md:px-12 md:py-6 bg-white text-blue-900 font-black text-lg md:text-xl rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300"
                    >
                        {t('landing_cta_bottom_btn')}
                    </button>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="py-12 md:py-16 bg-slate-950 border-t border-white/10 text-sm text-slate-400">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left">
                    <div>
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
                            <BrainCircuitIcon className="w-8 h-8 text-blue-500" />
                            <span className="text-2xl font-bold text-white tracking-tight">MedoraAi</span>
                        </div>
                        <p className="leading-relaxed mb-6">{t('auth_marketing_desc').substring(0, 100)}...</p>
                        <div className="flex justify-center md:justify-start gap-4">
                            {/* Social Placeholders */}
                            {[1,2,3].map(i => <div key={i} className="w-8 h-8 bg-white/10 rounded-full hover:bg-blue-600 transition-colors cursor-pointer"></div>)}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">{t('landing_footer_platform')}</h4>
                        <ul className="space-y-4">
                            <li><button onClick={() => scrollToSection('features')} className="hover:text-blue-400 transition-colors">{t('nav_features')}</button></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Narxlar</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Xavfsizlik</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">API</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">{t('landing_footer_company')}</h4>
                        <ul className="space-y-4">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Biz haqimizda</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Karyera</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Blog</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Bog'lanish</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">{t('landing_footer_contact')}</h4>
                        <p className="mb-2">{t('landing_contact_address')}</p>
                        <a href="tel:+998948788878" className="block mb-2 text-white font-bold hover:text-blue-400 transition-colors text-lg">+998 94 878 88 78</a>
                        <a href="https://t.me/xazrat_bro" target="_blank" rel="noopener noreferrer" className="block mb-6 hover:text-blue-400 transition-colors flex items-center justify-center md:justify-start gap-2">
                             <TelegramIcon className="w-5 h-5"/> @xazrat_bro
                        </a>
                        <div 
                            onClick={() => setShowContactModal(true)}
                            className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/20 cursor-pointer hover:bg-blue-900/40 transition-colors group"
                        >
                            <p className="text-blue-300 font-bold group-hover:text-blue-200 transition-colors">{t('landing_contact_support')}</p>
                        </div>
                    </div>
                </div>
                
                <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p>&copy; 2025 MedoraAi. {t('footer_rights')}</p>
                    
                    {/* Modern Developer Credits */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 bg-white/5 px-6 py-2 rounded-full border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-2 group">
                            <span className="opacity-60 text-xs uppercase tracking-wide">{t('footer_creator')}:</span>
                            <a href="https://cdcgroup.uz" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:text-blue-400 transition-colors flex items-center gap-1">
                                CDCGroup
                            </a>
                        </div>
                        <span className="hidden sm:block w-px h-4 bg-white/20"></span>
                        <div className="flex items-center gap-2 group">
                            <span className="opacity-60 text-xs uppercase tracking-wide">{t('footer_support')}:</span>
                            <a href="https://cdcgroup.uz" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-bold hover:opacity-80 transition-opacity">
                                CraDev Company
                            </a>
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white transition-colors">{t('auth_privacy')}</a>
                        <a href="#" className="hover:text-white transition-colors">{t('auth_terms')}</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
