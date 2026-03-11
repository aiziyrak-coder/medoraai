import React from 'react';
import UserGroupIcon from './UserGroupIcon';
import LightBulbIcon from './icons/LightBulbIcon';

type Tab = 'analysis' | 'research';

interface TabSwitcherProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
}

const TabButton: React.FC<{
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ isActive, onClick, icon, label }) => {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2.5 px-4 py-2.5 rounded-lg
                text-sm font-semibold transition-all duration-300
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-blue-500
                ${isActive
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'
                }
            `}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
};

const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
            <TabButton
                isActive={activeTab === 'analysis'}
                onClick={() => onTabChange('analysis')}
                icon={<UserGroupIcon className="w-5 h-5" />}
                label="Klinik Tahlil"
            />
            <TabButton
                isActive={activeTab === 'research'}
                onClick={() => onTabChange('research')}
                icon={<LightBulbIcon className="w-5 h-5" />}
                label="Tadqiqot Markazi"
            />
        </div>
    );
};

export default TabSwitcher;