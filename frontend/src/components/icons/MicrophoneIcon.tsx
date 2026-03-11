import React from 'react';

const MicrophoneIcon: React.FC<{ className?: string, isMuted?: boolean }> = ({ className = "w-6 h-6", isMuted = false }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5a6 6 0 00-12 0v1.5a6 6 0 006 6zM12 12.75V18.75m0 0H9.75M12 18.75h2.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75a3.75 3.75 0 117.5 0" />
        {isMuted && (
             <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
        )}
    </svg>
);

export default MicrophoneIcon;