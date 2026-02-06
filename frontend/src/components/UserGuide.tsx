
import React, { useState } from 'react';
import HomeIcon from './icons/HomeIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import LightBulbIcon from './icons/LightBulbIcon';
import UsersIcon from './icons/UsersIcon';
import { useTranslation } from '../hooks/useTranslation';

interface UserGuideProps {
    onBack: () => void;
}

const UserGuide: React.FC<UserGuideProps> = ({ onBack }) => {
    const [activeSection, setActiveSection] = useState('getting-started');
    const { t } = useTranslation();

    const sections = [
        { id: 'getting-started', title: 'Boshlash', icon: <HomeIcon className="w-5 h-5"/> },
        { id: 'analysis', title: 'Tahlil Jarayoni', icon: <PlusCircleIcon className="w-5 h-5"/> },
        { id: 'results', title: 'Xulosa va Hujjatlar', icon: <DocumentTextIcon className="w-5 h-5"/> },
        { id: 'research', title: 'Tadqiqot va Ta\'lim', icon: <LightBulbIcon className="w-5 h-5"/> },
        { id: 'staff', title: 'Navbat Tizimi (Registrator)', icon: <UsersIcon className="w-5 h-5"/> },
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'getting-started':
                return (
                    <div className="space-y-6 animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-white mb-4">MedoraAi Tizimiga Xush Kelibsiz</h2>
                        <p className="text-slate-300 leading-relaxed">
                            MedoraAi - bu tibbiyot xodimlari uchun yaratilgan ilg'or klinik qarorlarni qo'llab-quvvatlash tizimi. 
                            U sun'iy intellekt kuchidan foydalanib, tashxis qo'yish aniqligini oshirish, davolash rejalarini optimallashtirish va so'nggi tibbiy bilimlarni taqdim etishga xizmat qiladi.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="p-5 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="font-bold text-blue-400 mb-2">Shifokorlar uchun</h3>
                                <ul className="list-disc list-inside text-slate-400 space-y-1 text-sm">
                                    <li>AI Konsilium o'tkazish</li>
                                    <li>EKG va rentgen tahlili</li>
                                    <li>Dori vositalari tekshiruvi</li>
                                    <li>Bemorlar tarixi va arxivi</li>
                                </ul>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="font-bold text-green-400 mb-2">Klinikalar uchun</h3>
                                <ul className="list-disc list-inside text-slate-400 space-y-1 text-sm">
                                    <li>Elektron navbat boshqaruvi</li>
                                    <li>Registrator paneli</li>
                                    <li>TV monitor integratsiyasi</li>
                                    <li>Xodimlar boshqaruvi</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                );
            case 'analysis':
                return (
                    <div className="space-y-6 animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-white mb-4">AI Konsilium: Tahlil Jarayoni</h2>
                        <div className="space-y-8">
                            <div className="relative pl-8 border-l-2 border-blue-500/30">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
                                <h3 className="text-xl font-bold text-white mb-2">1. Ma'lumotlarni Kiritish</h3>
                                <p className="text-slate-300 text-sm">
                                    "Yangi Holat" bo'limiga o'ting. Bemor shikoyatlari, anamnez va obyektiv ko'rik natijalarini kiriting. 
                                    Siz shuningdek laboratoriya qog'ozlari, EKG yoki rentgen rasmlarini yuklashingiz mumkin. Tizim ularni avtomatik o'qiydi.
                                </p>
                            </div>
                            
                            <div className="relative pl-8 border-l-2 border-blue-500/30">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
                                <h3 className="text-xl font-bold text-white mb-2">2. Aniqlashtirish va Jamoa</h3>
                                <p className="text-slate-300 text-sm">
                                    AI sizga qo'shimcha aniqlashtiruvchi savollar berishi mumkin. So'ngra, holatga mos keladigan "Virtual Mutaxassislar" (Kardiolog, Nevrolog va h.k.) jamoasini taklif qiladi.
                                </p>
                            </div>

                            <div className="relative pl-8 border-l-2 border-blue-500/30">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
                                <h3 className="text-xl font-bold text-white mb-2">3. Interaktiv Munozara</h3>
                                <p className="text-slate-300 text-sm">
                                    Konsilium boshlanadi. Virtual ekspertlar o'z fikrlarini bildiradilar va o'zaro bahslashadilar. Siz jarayonga aralashib, o'z gipotezangizni qo'shishingiz yoki savol berishingiz mumkin.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            case 'results':
                return (
                    <div className="space-y-6 animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-white mb-4">Yakuniy Xulosa va Hujjatlar</h2>
                        <p className="text-slate-300">
                            Tahlil yakunida tizim **Yakuniy Konsensus Hisoboti**ni shakllantiradi. Bu hisobot quyidagilarni o'z ichiga oladi:
                        </p>
                        <div className="grid grid-cols-1 gap-4">
                            {[
                                { t: "Aniq Tashxis", d: "Ehtimollik foizi va asoslari bilan." },
                                { t: "Davolash Rejasi", d: "Qadamma-qadam ko'rsatmalar va dori vositalari (O'zbekistonda mavjud nomlari bilan)." },
                                { t: "Retsept", d: "Avtomatik shakllantirilgan elektron retsept." },
                                { t: "Qo'shimcha Tekshiruvlar", d: "Zarur bo'lgan laborator va instrumental tahlillar." }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                                    <DocumentTextIcon className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-white">{item.t}</h4>
                                        <p className="text-sm text-slate-400">{item.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <p className="text-sm text-yellow-200">
                                <strong>Eslatma:</strong> Barcha hujjatlarni PDF yoki DOCX formatida yuklab olish va chop etish mumkin.
                            </p>
                        </div>
                    </div>
                );
            case 'staff':
                return (
                    <div className="space-y-6 animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-white mb-4">Registrator va Navbat Tizimi</h2>
                        <p className="text-slate-300 mb-4">
                            Klinikalar uchun elektron navbatni boshqarish moduli.
                        </p>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="text-lg font-bold text-white mb-2">Bemor Qo'shish</h3>
                                <p className="text-slate-400 text-sm">
                                    Registrator bemor ism-familiyasi va yoshini kiritadi. Tizim avtomatik <strong>Chek (Ticket)</strong> va <strong>QR Kod</strong> generatsiya qiladi.
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h3 className="text-lg font-bold text-white mb-2">TV Monitor</h3>
                                <p className="text-slate-400 text-sm">
                                    Kutish zalidagi TV ekranda navbatdagi bemor raqami va ismi chiqadi. Shifokor o'z xonasidan "Keyingi bemor" tugmasini bosganda, TV da chaqiruv ovozi yangraydi.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            default: // Research
                return (
                    <div className="space-y-6 animate-fade-in-up">
                        <h2 className="text-3xl font-bold text-white mb-4">Tadqiqot va Asboblar</h2>
                        <p className="text-slate-300">
                            Kundalik faoliyat uchun yordamchi vositalar to'plami:
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <li className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> Dori vositalari o'zaro ta'siri</li>
                            <li className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><span className="w-2 h-2 bg-purple-500 rounded-full"></span> EKG Tahlil Yordamchisi</li>
                            <li className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Klinik Qo'llanmalar (Guidelines)</li>
                            <li className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><span className="w-2 h-2 bg-red-500 rounded-full"></span> ICD-10 Kodlash</li>
                        </ul>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col animate-fade-in-up">
            {/* Header */}
            <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">M</div>
                        <span className="font-bold text-lg">MedoraAi Dokumentatsiya</span>
                    </div>
                    <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                        <HomeIcon className="w-4 h-4" /> Asosiy Sahifa
                    </button>
                </div>
            </div>

            <div className="flex-grow flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
                {/* Sidebar Navigation */}
                <div className="w-64 flex-shrink-0 hidden md:block">
                    <div className="sticky top-24 space-y-1 bg-slate-800/50 p-2 rounded-2xl border border-white/5">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                    activeSection === section.id 
                                    ? 'bg-blue-600 text-white shadow-lg' 
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                {section.icon}
                                {section.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow max-w-3xl">
                    <div className="bg-slate-800/30 border border-white/10 rounded-3xl p-8 min-h-[500px]">
                        {renderContent()}
                    </div>
                    
                    {/* Mobile Nav (Visible only on small screens) */}
                    <div className="md:hidden grid grid-cols-2 gap-2 mt-8">
                         {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`p-3 rounded-lg text-xs font-bold text-center border ${
                                    activeSection === section.id 
                                    ? 'bg-blue-600 border-blue-500 text-white' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}
                            >
                                {section.title}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserGuide;
