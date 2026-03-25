import React, { useMemo, useState } from 'react';
import ToolCard from './tools/ToolCard';
import { useTranslation } from '../hooks/useTranslation';
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
import ChildIcon from './icons/ChildIcon';
import ChartBarIcon from './icons/ChartBarIcon';


type Tool = 'drug-interactions' | 'ecg-analyzer' | 'patient-explainer' | 'coding-assistant' | 'guideline-navigator' | 'lab-interpreter' | 'abbreviation-expander' | 'document-generator' | 'pediatric-dose' | 'risk-scoring';

type ToolConfig = { id: Tool; title: string; description: string; icon: React.FC<{className?: string}>; color: string; component: React.FC<{onBack?: () => void}> };

const ToolsDashboard: React.FC = () => {
    const { t, language } = useTranslation();
    const [activeTool, setActiveTool] = useState<Tool | null>(null);

    const toolsConfig: ToolConfig[] = useMemo(() => [
        {
            id: 'guideline-navigator',
            title: t('tools_guideline_navigator_title'),
            description: t('tools_guideline_navigator_desc'),
            icon: BookmarkIcon,
            color: 'text-blue-500',
            component: GuidelineNavigator,
        },
        {
            id: 'drug-interactions',
            title: t('tools_drug_interactions_title'),
            description: t('tools_drug_interactions_desc'),
            icon: StethoscopeIcon,
            color: 'text-rose-500',
            component: DrugInteractionChecker,
        },
        {
            id: 'ecg-analyzer',
            title: t('tools_ecg_analyzer_title'),
            description: t('tools_ecg_analyzer_desc'),
            icon: HeartPulseIcon,
            color: 'text-red-600',
            component: EcgAnalyzer,
        },
        {
            id: 'risk-scoring',
            title: t('tools_risk_scoring_title'),
            description: t('tools_risk_scoring_desc'),
            icon: ChartBarIcon,
            color: 'text-orange-500',
            component: RiskScoringTool,
        },
        {
            id: 'document-generator',
            title: t('tools_document_generator_title'),
            description: t('tools_document_generator_desc'),
            icon: DocumentReportIcon,
            color: 'text-green-600',
            component: DocumentGeneratorHub,
        },
        {
            id: 'pediatric-dose',
            title: t('tools_pediatric_dose_title'),
            description: t('tools_pediatric_dose_desc'),
            icon: ChildIcon,
            color: 'text-pink-500',
            component: PediatricDoseCalculator,
        },
        {
            id: 'lab-interpreter',
            title: t('tools_lab_interpreter_title'),
            description: t('tools_lab_interpreter_desc'),
            icon: FlaskIcon,
            color: 'text-cyan-500',
            component: LabValueInterpreter,
        },
        {
            id: 'patient-explainer',
            title: t('tools_patient_explainer_title'),
            description: t('tools_patient_explainer_desc'),
            icon: UserHeartIcon,
            color: 'text-teal-500',
            component: PatientExplanationGenerator,
        },
        {
            id: 'coding-assistant',
            title: t('tools_coding_assistant_title'),
            description: t('tools_coding_assistant_desc'),
            icon: FileCodeIcon,
            color: 'text-indigo-500',
            component: MedicalCodingAssistant,
        },
        {
            id: 'abbreviation-expander',
            title: t('tools_abbreviation_expander_title'),
            description: t('tools_abbreviation_expander_desc'),
            icon: TranslateIcon,
            color: 'text-purple-500',
            component: AbbreviationExpander,
        },
    ], [language, t]);

    const ActiveToolComponent = toolsConfig.find(tool => tool.id === activeTool)?.component;

    return (
        <div className="animate-fade-in-up">
            {ActiveToolComponent ? (
                <ActiveToolComponent onBack={() => setActiveTool(null)} />
            ) : (
                <div>
                    <div className="text-left mb-8">
                        <h2 className="text-2xl font-bold text-text-primary">{t('tools_page_title')}</h2>
                        <p className="text-text-secondary">{t('tools_page_subtitle')}</p>
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