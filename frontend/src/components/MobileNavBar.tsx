import React from 'react';
import PlusCircleIcon from './icons/PlusCircleIcon';
import DocumentReportIcon from './icons/DocumentReportIcon';
import HomeIcon from './icons/HomeIcon';
import { useTranslation } from '../hooks/useTranslation';

type AppView = 'dashboard' | 'new_analysis' | 'history';

interface MobileNavBarProps {
    activeView: string;
    onNavigate: (view: AppView) => void;
}

const NavButton: React.FC<{
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ isActive, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center gap-1 w-full h-16 transition-colors duration-200 focus:outline-none ${
            isActive ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
        }`}
        aria-current={isActive ? 'page' : undefined}
    >
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
        {isActive && (
            <span className="absolute bottom-0 w-8 h-0.5 rounded-t-full"
                  style={{ background: 'linear-gradient(90deg, #0891b2, #059669)' }} />
        )}
    </button>
);

const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeView, onNavigate }) => {
    const { t } = useTranslation();
    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-safe"
            style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.7)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
            }}
        >
            <div className="flex justify-around items-center h-16 px-4">
                <NavButton
                    isActive={activeView === 'dashboard'}
                    onClick={() => onNavigate('dashboard')}
                    icon={<HomeIcon className="w-6 h-6" />}
                    label={t('nav_dashboard')}
                />
                <NavButton
                    isActive={['new_analysis', 'live_analysis', 'clarification', 'team_recommendation'].some(v => activeView.startsWith(v))}
                    onClick={() => onNavigate('new_analysis')}
                    icon={
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center -mt-5 shadow-lg"
                             style={{ background: 'linear-gradient(135deg, #0891b2, #059669)', boxShadow: '0 4px 16px rgba(8,145,178,0.4)' }}>
                            <PlusCircleIcon className="w-6 h-6 text-white" />
                        </div>
                    }
                    label={t('nav_new_case')}
                />
                <NavButton
                    isActive={['history', 'view_history_item', 'case_library'].some(v => activeView.startsWith(v))}
                    onClick={() => onNavigate('history')}
                    icon={<DocumentReportIcon className="w-6 h-6" />}
                    label={t('nav_archive')}
                />
            </div>
        </nav>
    );
};

export default MobileNavBar;
