import React from 'react';

const UsersIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-indigo-500" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.96a3 3 0 00-4.682 2.72 8.986 8.986 0 003.74.477m-4.682-2.72a3 3 0 013.74-2.475M12 17.25a3 3 0 013.74-2.475m-3.74 2.475a3 3 0 003.74-2.475M9 9.75a3 3 0 116 0 3 3 0 01-6 0z" />
    </svg>
);

export default UsersIcon;
