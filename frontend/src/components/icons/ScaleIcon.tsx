import React from 'react';

const ScaleIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7 text-orange-500" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c-.317.047-.636.095-.954.14M6.75 4.97c.317.047.636.095.954.14m12.3-1.25a.371.371 0 00-.371-.371H6.75a.371.371 0 00-.371.371M6.75 4.97L6.75 6.75m10.5-1.78L17.25 6.75" />
    </svg>
);

export default ScaleIcon;
