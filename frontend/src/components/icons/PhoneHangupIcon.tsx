import React from 'react';

const PhoneHangupIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 9c-1.6 0-3.15.25-4.62.72l1.44 1.44c.54-.16 1.1-.26 1.68-.26c.26 0 .51.02.76.05L13.1 9.22A4.27 4.27 0 0 0 12 9m8 6c0-1.07-.17-2.1-.5-3.05l-2.73 2.73c.42.92.63 1.92.63 2.92c0 .28-.02.55-.05.82l2.12 2.12c.67-1.18 1.05-2.5 1.05-3.92M4.41 4.84L3 6.25l3.79 3.79c-.19.46-.32.95-.39 1.46c-.53 3.6 2.05 6.82 5.59 7.42c.69.12 1.37.04 2.02-.15l3.78 3.78l1.41-1.41L4.41 4.84z" />
    </svg>
);

export default PhoneHangupIcon;