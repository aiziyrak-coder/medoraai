import React from 'react';
import { AIModel } from '../types';
import { AI_SPECIALISTS } from '../constants';

interface AIAvatarProps {
    model: AIModel;
    size?: 'xs' | 'sm' | 'md';
}

const AIAvatar: React.FC<AIAvatarProps> = ({ model, size = 'md' }) => {
    const config = AI_SPECIALISTS[model];
    if (!config) return null;

    const sizeClasses = {
        xs: { wrapper: 'w-6 h-6', logo: 'w-3 h-3' },
        sm: { wrapper: 'w-8 h-8', logo: 'w-4 h-4' },
        md: { wrapper: 'w-11 h-11', logo: 'w-6 h-6' },
    };

    return (
        <div className="flex-shrink-0">
            <div 
                className={`
                    ${sizeClasses[size].wrapper}
                    ${config.bg}
                    rounded-full 
                    flex 
                    items-center 
                    justify-center 
                    border
                    ${config.border}
                `}
            >
                <config.Logo className={`${sizeClasses[size].logo} ${config.text}`} />
            </div>
        </div>
    );
};

export default AIAvatar;