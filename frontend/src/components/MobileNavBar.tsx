
import React from 'react';
import PlusCircleIcon from './icons/PlusCircleIcon';
import DocumentReportIcon from './icons/DocumentReportIcon';
import LightBulbIcon from './icons/LightBulbIcon';
import HomeIcon from './icons/HomeIcon';
import { useTranslation } from '../hooks/useTranslation';

type AppView = 'dashboard' | 'new_analysis' | 'history' | 'research';

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
        className={`relative flex flex-col items-center justify-center gap-1 w-full h-16 transition-colors duration-200 focus:outline-none ${isActive ? 'text-accent-color-blue' : 'text-text-secondary hover:text-text-primary'}`}
        aria-current={isActive ? 'page' : undefined}
    >
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
        {isActive && (
            <span className="absolute bottom-0 w-1/3 h-1 bg-accent-color-blue rounded-t-full transition-all duration-300"></span>
        )}
    </button>
);

const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeView, onNavigate }) => {
    const { t } = useTranslation();
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-panel-bg-solid/90 backdrop-blur-xl border-t border-border-color z-30 pb-safe">
            <div className="flex justify-around items-center h-16 px-2">
                <NavButton
                    isActive={activeView === 'dashboard'}
                    onClick={() => onNavigate('dashboard')}
                    icon={<HomeIcon className="w-6 h-6" />}
                    label={t('nav_dashboard')}
                />
                <NavButton
                    isActive={['new_analysis', 'live_analysis', 'clarification'].some(v => activeView.startsWith(v))}
                    onClick={() => onNavigate('new_analysis')}
                    icon={<PlusCircleIcon className="w-7 h-7" />} // Slightly larger for emphasis
                    label={t('nav_new_case')}
                />
                <NavButton
                    isActive={['history', 'view_history_item', 'live_consultation', 'prescription'].some(v => activeView.startsWith(v))}
                    onClick={() => onNavigate('history')}
                    icon={<DocumentReportIcon className="w-6 h-6" />}
                    label={t('nav_archive')}
                />
                <NavButton
                    isActive={activeView.startsWith('research')}
                    onClick={() => onNavigate('research')}
                    icon={<LightBulbIcon className="w-6 h-6" />}
                    label={t('nav_research')}
                />
            </div>
        </nav>
    );
};

export default MobileNavBar;
