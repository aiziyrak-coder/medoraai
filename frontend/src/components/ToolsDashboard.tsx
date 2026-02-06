import React, { useState } from 'react';
import ToolCard from './tools/ToolCard';
import DrugInteractionChecker from './tools/DrugInteractionChecker';
import EcgAnalyzer from './tools/EcgAnalyzer';
import PatientExplanationGenerator from './tools/PatientExplanationGenerator';
import MedicalCodingAssistant from './tools/MedicalCodingAssistant';
import GuidelineNavigator from './tools/GuidelineNavigator';
import LabValueInterpreter from './tools/LabValueInterpreter';
import AbbreviationExpander from './tools/AbbreviationExpander';
import DocumentGeneratorHub from './tools/DocumentGeneratorHub';
import PediatricDoseCalculator from './tools/PediatricDoseCalculator';
import RiskScoringTool from './tools/RiskScoringTool';


import StethoscopeIcon from './icons/StethoscopeIcon';
import HeartPulseIcon from './icons/HeartPulseIcon';
import UserHeartIcon from './icons/UserHeartIcon';
import FileCodeIcon from './icons/FileCodeIcon';
import BookmarkIcon from './icons/BookmarkIcon';
import FlaskIcon from './icons/FlaskIcon';
import TranslateIcon from './icons/TranslateIcon';
import DocumentReportIcon from './icons/DocumentReportIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ChildIcon from './icons/ChildIcon';
import ChartBarIcon from './icons/ChartBarIcon';


type Tool = 'drug-interactions' | 'ecg-analyzer' | 'patient-explainer' | 'coding-assistant' | 'guideline-navigator' | 'lab-interpreter' | 'abbreviation-expander' | 'document-generator' | 'pediatric-dose' | 'risk-scoring';

const toolsConfig: { id: Tool; title: string; description: string; icon: React.FC<{className?: string}>; color: string; component: React.FC<{onBack?: () => void}> }[] = [
    {
        id: 'guideline-navigator',
        title: "Klinik Qo'llanmalar",
        description: "Eng so'nggi xalqaro klinik qo'llanmalarni topish va umumlashtirish.",
        icon: BookmarkIcon,
        color: 'text-blue-500',
        component: GuidelineNavigator,
    },
    {
        id: 'drug-interactions',
        title: "Dori vositalari ta'siri",
        description: "Dori vositalarining potentsial xavfli ta'sirlarini tekshirish.",
        icon: StethoscopeIcon,
        color: 'text-rose-500',
        component: DrugInteractionChecker,
    },
    {
        id: 'ecg-analyzer',
        title: "EKG Tahlil Yordamchisi",
        description: "Yuklangan EKG tasviridan avtomatik xulosa va tahlil olish.",
        icon: HeartPulseIcon,
        color: 'text-red-600',
        component: EcgAnalyzer,
    },
     {
        id: 'risk-scoring',
        title: "Xavf Skoring Kalkulyatori",
        description: "ASCVD, CHADS-VASc kabi klinik xavf shkalalarini hisoblash.",
        icon: ChartBarIcon,
        color: 'text-orange-500',
        component: RiskScoringTool,
    },
    {
        id: 'document-generator',
        title: "Hujjatlar Generatori",
        description: "Ko'chirma xulosa va sug'urta ruxsatnomasi kabi hujjatlarni yaratish.",
        icon: DocumentReportIcon,
        color: 'text-green-600',
        component: DocumentGeneratorHub,
    },
    {
        id: 'pediatric-dose',
        title: "Pediatrik Doza Kalkulyatori",
        description: "Bolalar uchun dori vositalari dozasini tana vazni bo'yicha hisoblash.",
        icon: ChildIcon,
        color: 'text-pink-500',
        component: PediatricDoseCalculator,
    },
    {
        id: 'lab-interpreter',
        title: "Laboratoriya Tahlili",
        description: "Tahlil natijalarining klinik ahamiyatini tezda izohlash.",
        icon: FlaskIcon,
        color: 'text-cyan-500',
        component: LabValueInterpreter,
    },
    {
        id: 'patient-explainer',
        title: "Bemor uchun Tushuntirish",
        description: "Murakkab tibbiy xulosalarni sodda va tushunarli tilga o'girish.",
        icon: UserHeartIcon,
        color: 'text-teal-500',
        component: PatientExplanationGenerator,
    },
    {
        id: 'coding-assistant',
        title: "Tibbiy Kodlash (ICD-10)",
        description: "Tashxisga asosan ICD-10 kodlarini avtomatik taklif qilish.",
        icon: FileCodeIcon,
        color: 'text-indigo-500',
        component: MedicalCodingAssistant,
    },
    {
        id: 'abbreviation-expander',
        title: "Qisqartmalar Lug'ati",
        description: "Tibbiy qisqartmalarning to'liq shakli va ma'nosini topish.",
        icon: TranslateIcon,
        color: 'text-purple-500',
        component: AbbreviationExpander,
    },
];

const ToolsDashboard: React.FC = () => {
    const [activeTool, setActiveTool] = useState<Tool | null>(null);

    const ActiveToolComponent = toolsConfig.find(t => t.id === activeTool)?.component;

    return (
        <div className="animate-fade-in-up">
            {ActiveToolComponent ? (
                <ActiveToolComponent onBack={() => setActiveTool(null)} />
            ) : (
                <div>
                    <div className="text-left mb-8">
                        <h2 className="text-2xl font-bold text-text-primary">Tibbiy Yordamchi Instrumentlar</h2>
                        <p className="text-text-secondary">Kundalik vazifalarni tezlashtirish va aniqlikni oshirish uchun AI-vositalar to'plami.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {toolsConfig.map((tool, index) => (
                            <ToolCard
                                key={tool.id}
                                title={tool.title}
                                description={tool.description}
                                icon={<tool.icon className={`w-8 h-8 ${tool.color}`} />}
                                onClick={() => setActiveTool(tool.id)}
                                style={{ animationDelay: `${index * 50}ms` }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolsDashboard;