import React from 'react';

const DnaIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-purple-600" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h14.25c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125-1.125H4.875A1.125 1.125 0 013.75 19.125V4.875z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12M9 6v12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 4.5v15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.25h15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75h15" />
    </svg>
);

export default DnaIcon;
