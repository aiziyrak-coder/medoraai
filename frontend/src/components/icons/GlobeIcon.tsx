
import React from 'react';

const GlobeIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-sky-500" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.58 9h16.84M3.58 15h16.84M12 3a15.48 15.48 0 00-4.6 15M12 3a15.48 15.48 0 014.6 15" />
    </svg>
);

export default GlobeIcon;