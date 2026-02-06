
import React from 'react';

const AudioVisualizer: React.FC<{ isListening: boolean }> = ({ isListening }) => {
    return (
        <div className="flex items-center justify-center gap-1 h-12 w-full">
            {[...Array(8)].map((_, i) => (
                <div
                    key={i}
                    className={`w-1.5 bg-blue-500 rounded-full transition-all duration-150 ${
                        isListening ? 'animate-music-bar' : 'h-1.5 opacity-30'
                    }`}
                    style={{
                        animationDelay: `${i * 0.1}s`,
                        height: isListening ? `${Math.random() * 24 + 8}px` : '4px'
                    }}
                ></div>
            ))}
            <style>{`
                @keyframes music-bar {
                    0%, 100% { height: 8px; opacity: 0.5; }
                    50% { height: 32px; opacity: 1; background-color: #3b82f6; }
                }
                .animate-music-bar {
                    animation: music-bar 0.8s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default AudioVisualizer;
