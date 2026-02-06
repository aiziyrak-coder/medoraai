import React from 'react';
import AIAvatar from './AIAvatar';
import { AIModel } from '../types';

interface DebateStatusIndicatorProps {
    message: string;
}

const DebateStatusIndicator: React.FC<DebateStatusIndicatorProps> = ({ message }) => {
    return (
        <div className="flex items-center gap-3 my-6 animate-fade-in-up">
            <AIAvatar model={AIModel.SYSTEM} size="sm" />
            <div className="flex-1 -mt-1">
                 <div className="p-3.5 rounded-2xl rounded-tl-lg border bg-slate-100 border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 text-text-secondary">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-color-cyan opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-color-cyan"></span>
                        </span>
                        <span className="font-semibold">{message}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebateStatusIndicator;
