import React from 'react';
import ChevronRightIcon from '../icons/ChevronRightIcon';

interface ToolCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    style?: React.CSSProperties;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon, onClick, style }) => {
    return (
        <button
            onClick={onClick}
            style={style}
            className="relative w-full h-full text-left p-6 glass-panel group transition-all duration-300 hover:border-accent-color-blue hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue animate-fade-in-up"
        >
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 border border-border-color shadow-inner mb-4">
                 {icon}
            </div>
            <h3 className="font-bold text-lg text-text-primary">{title}</h3>
            <p className="text-sm text-text-secondary mt-1 pb-12">{description}</p>
             <div className="absolute bottom-6 right-6 flex items-center justify-center w-10 h-10 rounded-full bg-slate-200 group-hover:bg-accent-color-blue transition-colors duration-300">
                <ChevronRightIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors duration-300" />
            </div>
        </button>
    );
};

export default ToolCard;