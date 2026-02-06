import React from 'react';

const EkgWaveIcon: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <svg className={className} viewBox="0 0 200 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <clipPath id="clip">
                    <rect width="200" height="40" />
                </clipPath>
                 <style>
                    {`
                        @keyframes scroll {
                            from { transform: translateX(0); }
                            to { transform: translateX(-100px); }
                        }
                        .scrolling-path {
                            animation: scroll 1s linear infinite;
                        }
                    `}
                </style>
            </defs>
            <g clipPath="url(#clip)">
                <path
                    className="scrolling-path"
                    d="M-100 20 h20 l5 -10 l5 20 l5 -25 l5 15 h20 l5 -5 l5 5 h20 l5 -10 l5 20 l5 -25 l5 15 h20 l5 -5 l5 5 h20 l5 -10 l5 20 l5 -25 l5 15 h20 l5 -5 l5 5 h20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </g>
        </svg>
    );
};

export default EkgWaveIcon;
