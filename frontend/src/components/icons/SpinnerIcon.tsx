import React from 'react';

const SpinnerIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg 
        className={`${className} animate-spin`} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <path 
            d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
        />
    </svg>
);

export default SpinnerIcon;