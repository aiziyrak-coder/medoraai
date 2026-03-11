import React from 'react';

const VideoCameraOffIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-2.36a1.5 1.5 0 012.28 1.26v7.2c0 .94-1.01 1.64-1.84 1.25l-4.72-2.36m-4.5 3h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0016.5 3h-9A2.25 2.25 0 005.25 5.25v9A2.25 2.25 0 007.5 16.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
);

export default VideoCameraOffIcon;