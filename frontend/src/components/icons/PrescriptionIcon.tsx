import React from 'react';

const PrescriptionIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M15 12h.01M10.5 16.5h3m-6.75 3h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H8.625a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 008.625 21z" />
    </svg>
);

export default PrescriptionIcon;
