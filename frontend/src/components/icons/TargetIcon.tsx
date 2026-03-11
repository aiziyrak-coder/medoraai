import React from 'react';

const TargetIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-violet-500" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.5" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeOpacity="0.7" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
);

export default TargetIcon;