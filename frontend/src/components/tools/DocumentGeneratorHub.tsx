import React, { useState } from 'react';
import ToolCard from './ToolCard';
import DischargeSummaryTool from './DischargeSummaryTool';
import InsurancePreAuthTool from './InsurancePreAuthTool';
import DocumentReportIcon from '../icons/DocumentReportIcon';
import ShieldCheckIcon from '../icons/ShieldCheckIcon';

const DocumentGeneratorHub: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [subTool, setSubTool] = useState<'select' | 'discharge' | 'insurance'>('select');

    if (subTool === 'discharge') {
        return <DischargeSummaryTool onBack={() => setSubTool('select')} />;
    }
    if (subTool === 'insurance') {
        return <InsurancePreAuthTool onBack={() => setSubTool('select')} />;
    }

    return (
        <div className="animate-fade-in-up max-w-4xl mx-auto">
            {onBack && (
                 <button onClick={onBack} className="text-sm font-semibold text-accent-color-blue hover:underline mb-6">
                    &larr; Barcha instrumentlarga qaytish
                </button>
            )}
            <div className="glass-panel p-6 md:p-8">
                <h3 className="text-xl font-bold text-text-primary text-center">Hujjatlar Generatori</h3>
                <p className="text-sm text-text-secondary mt-1 mb-10 text-center">
                    Kerakli hujjat turini tanlang.
                </p>
                <div className="flex flex-col md:flex-row justify-center items-stretch gap-8">
                    <div className="w-full md:w-80 lg:w-96">
                        <ToolCard
                            title="Ko'chirma Xulosa"
                            description="Bemor ma'lumotlari asosida kasalxonadan chiqish xulosasi loyihasini yaratish."
                            icon={<DocumentReportIcon className="w-8 h-8 text-green-600" />}
                            onClick={() => setSubTool('discharge')}
                        />
                    </div>
                    <div className="w-full md:w-80 lg:w-96">
                        <ToolCard
                            title="Sug'urta uchun Ruxsatnoma"
                            description="Tavsiya etilgan muolajalar uchun sug'urta ruxsatnomasi xati loyihasini tuzish."
                            icon={<ShieldCheckIcon className="w-8 h-8 text-teal-500" />}
                            onClick={() => setSubTool('insurance')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentGeneratorHub;