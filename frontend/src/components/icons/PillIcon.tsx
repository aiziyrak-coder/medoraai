import React from 'react';

const PillIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-rose-600" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-5.571 3m-16.5 4.5l5.571 3 5.571-3m-5.571 0v5.25A2.25 2.25 0 0012 21.75a2.25 2.25 0 002.25-2.25V15m-3 0l5.571-3" />
    </svg>
);

export default PillIcon;