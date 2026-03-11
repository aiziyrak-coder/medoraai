
import React from 'react';

const BrainCircuitIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-teal-600" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 13.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5S11.828 12 11 12s-1.5.672-1.5 1.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5a8.25 8.25 0 0116.5 0M4.5 19.5v-2.25a3.75 3.75 0 013-3.623m1.854-3.033A3.75 3.75 0 0112 6a3.75 3.75 0 012.646 1.104m3.003 3.033A3.75 3.75 0 0119.5 17.25V19.5m-15-6a8.25 8.25 0 0015 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75V9m0 9v-2.25m-3.75-6.75h-.75M16.5 9h.75M7.5 15h.75m7.5 0h-.75" />
    </svg>
);

export default BrainCircuitIcon;