import React from 'react';

const LightBulbIcon: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v.01M9 21h6m-6 0h.01M9 18h.01M15 18h.01M9 15h.01M15 15h.01M12 9.75V3M12 21a9 9 0 000-18 9 9 0 000 18z" />
    </svg>
);

export default LightBulbIcon;