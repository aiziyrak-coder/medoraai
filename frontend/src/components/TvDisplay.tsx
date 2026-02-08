
import React, { useState, useEffect, useRef } from 'react';
import type { PatientQueueItem } from '../types';
import * as queueService from '../services/queueService';
import * as settingsService from '../services/settingsService';

const TvDisplay: React.FC<{ doctorId: string }> = ({ doctorId }) => {
    const [queue, setQueue] = useState<PatientQueueItem[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [settings, setSettings] = useState<settingsService.TvSettings>({
        isUnlocked: false,
        videoUrl: '',
        scrollingText: "Klinikamizda yangi kardiologiya bo'limi ochildi! • Chegirmalar haftaligi davom etmoqda!"
    });
    
    // Video Playlist State
    const [playlist, setPlaylist] = useState<string[]>([]);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Default demo playlist if no settings
    const defaultPlaylist = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    ];

    useEffect(() => {
        let cancelled = false;
        queueService.loadQueueFromServer(doctorId).then(() => {
            if (!cancelled) setQueue(queueService.getQueue(doctorId));
        });
        const unsubscribeQueue = queueService.subscribeToQueueUpdates(doctorId, (q) => {
            if (!cancelled) setQueue(q);
        });
        
        // Load Settings
        const currentSettings = settingsService.getTvSettings(doctorId);
        setSettings(currentSettings);
        updatePlaylist(currentSettings.videoUrl);

        const unsubscribeSettings = settingsService.subscribeToSettingsUpdates(doctorId, (newSettings) => {
            setSettings(newSettings);
            updatePlaylist(newSettings.videoUrl);
        });

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => {
            cancelled = true;
            unsubscribeQueue();
            unsubscribeSettings();
            clearInterval(timer);
        };
    }, [doctorId]);

    const updatePlaylist = (urlStr: string) => {
        if (urlStr && urlStr.trim()) {
            const urls = urlStr.split(',').map(s => s.trim()).filter(s => s);
            setPlaylist(urls.length > 0 ? urls : defaultPlaylist);
        } else {
            setPlaylist(defaultPlaylist);
        }
        setCurrentVideoIndex(0);
    };

    const handleVideoEnded = () => {
        setCurrentVideoIndex(prev => (prev + 1) % playlist.length);
    };

    // Queue Logic
    const currentPatient = queue.find(p => p.status === 'in-progress');
    const waitingPatients = queue.filter(p => p.status === 'waiting' || p.status === 'hold'); // Include hold for display list
    
    // Sort waiting: holds might have priority in logic, but for display list we just show them
    // Let's assume queue is already sorted by priority/time in the service
    
    // Carousel Logic: We need 3 items: Previous, Current, Next
    // If no previous, show placeholder. If no current, show empty state.
    // Ideally we'd track "recently completed" for the top slot.
    // For now, let's fake the "top" slot as a generic "Waiting" label or the last completed if available.
    const lastCompleted = queue.filter(p => p.status === 'completed').pop();
    const nextPatient = waitingPatients[0];

    return (
        <div className="h-screen w-full bg-slate-900 text-white overflow-hidden flex font-sans">
            
            {/* LEFT HALF: QUEUE DISPLAY (50%) */}
            <div className="w-1/2 flex flex-col border-r border-white/10 relative">
                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-600/50">M</div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tighter leading-none">MEDORA AI</h1>
                            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Elektron Navbat</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold font-mono leading-none">{currentTime.toLocaleTimeString('uz-UZ', {hour:'2-digit', minute:'2-digit'})}</p>
                        <p className="text-xs text-slate-400 uppercase font-medium mt-1">{currentTime.toLocaleDateString('uz-UZ', {weekday:'long'})}</p>
                    </div>
                </div>

                {/* 1. TOP SECTION (Carousel) - 75% Height */}
                <div className="h-[75%] relative flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>

                    {/* Vertical Carousel Container */}
                    <div className="relative z-10 w-full max-w-xl flex flex-col gap-6 items-center">
                        
                        {/* TOP SLOT: Previous/Completed (Dimmed, Smaller) */}
                        <div className="opacity-40 scale-90 transition-all duration-700 blur-[1px]">
                            {lastCompleted ? (
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-slate-400">{lastCompleted.ticketNumber}</div>
                                    <div className="text-sm font-bold uppercase text-green-500 mt-1">Qabul qilindi</div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-slate-600">--</div>
                                </div>
                            )}
                        </div>

                        {/* CENTER SLOT: CURRENT PATIENT (Large, Bright) */}
                        <div className="transform transition-all duration-500 scale-110 my-4 w-full">
                            {currentPatient ? (
                                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 text-center shadow-[0_0_60px_rgba(59,130,246,0.3)] animate-fade-in-up">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-sm font-black uppercase tracking-widest px-6 py-2 rounded-full shadow-lg border border-blue-400 animate-bounce">
                                        Qabulda
                                    </div>
                                    <div className="text-[140px] leading-none font-black text-white drop-shadow-2xl">
                                        {currentPatient.ticketNumber}
                                    </div>
                                    <div className="text-3xl font-bold text-blue-200 mt-4 truncate px-4">
                                        {currentPatient.patientName}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/5 border border-white/5 rounded-[3rem] p-10 text-center">
                                    <p className="text-2xl text-slate-500 font-bold uppercase tracking-widest">Xona Bo'sh</p>
                                    <p className="text-sm text-slate-600 mt-2">Keyingi bemor kutilmoqda...</p>
                                </div>
                            )}
                        </div>

                        {/* BOTTOM SLOT: NEXT PATIENT (Dimmed, Smaller) */}
                        <div className="opacity-50 scale-90 transition-all duration-700">
                            {nextPatient ? (
                                <div className="text-center bg-white/5 px-8 py-4 rounded-2xl border border-white/5">
                                    <div className="text-sm font-bold uppercase text-yellow-500 mb-1">Navbatdagi</div>
                                    <div className="text-5xl font-black text-white">#{nextPatient.ticketNumber}</div>
                                </div>
                            ) : (
                                <div className="text-center opacity-30">
                                    <div className="text-sm font-bold uppercase">Kutilmoqda...</div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* 2. BOTTOM SECTION (Waiting List) - 25% Height */}
                <div className="h-[25%] bg-slate-950 border-t border-white/10 p-6 flex flex-col">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                        Kutish Zalida
                    </h3>
                    <div className="flex-grow overflow-hidden relative">
                        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar items-center h-full">
                            {waitingPatients.slice(0, 10).map((p) => (
                                <div key={p.id} className={`flex-shrink-0 w-48 p-4 rounded-xl border flex flex-col justify-center h-full ${p.status === 'hold' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-2xl font-black ${p.status === 'hold' ? 'text-yellow-400' : 'text-slate-400'}`}>#{p.ticketNumber}</span>
                                        {p.status === 'hold' && <span className="text-[9px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">KUTISHDA</span>}
                                    </div>
                                    <div className="text-sm font-bold text-slate-200 truncate">{p.patientName}</div>
                                </div>
                            ))}
                            {waitingPatients.length === 0 && (
                                <p className="text-slate-600 text-sm italic">Navbatda hech kim yo'q</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT HALF: ADS / VIDEO (50%) */}
            <div className="w-1/2 bg-black relative flex items-center justify-center overflow-hidden">
                {settings.isUnlocked ? (
                    playlist.length > 0 ? (
                        <video 
                            ref={videoRef}
                            src={playlist[currentVideoIndex]} 
                            autoPlay 
                            muted // Browser policy often requires mute for autoplay, though usually intended for ads with sound in lobby
                            // In a real kiosk mode browser, you can configure to allow sound. For web, muted is safer.
                            onEnded={handleVideoEnded}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="text-center text-slate-500">Video yuklanmadi</div>
                    )
                ) : (
                    // Default Medora Admin Ad (Looping Image/Text)
                    <div className="relative w-full h-full">
                        <img 
                            src="https://images.unsplash.com/photo-1516549655169-df83a0774514?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80" 
                            className="w-full h-full object-cover opacity-60" 
                            alt="Medical Promo"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-16">
                            <h2 className="text-5xl font-bold text-white mb-6 leading-tight">Salomatligingiz — <br/>Bizning Oliy Maqsadimiz</h2>
                            <p className="text-2xl text-slate-300 max-w-2xl font-light">
                                Eng zamonaviy tibbiy xizmatlar va xalqaro darajadagi mutaxassislar sizning xizmatingizda.
                            </p>
                            <div className="mt-10 flex gap-4">
                                <div className="px-6 py-3 bg-blue-600 rounded-lg font-bold text-white">Kardiologiya</div>
                                <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-lg font-bold text-white">Nevrologiya</div>
                                <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-lg font-bold text-white">Pediatriya</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scrolling Ticker Overlay at Bottom of Right Side */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-blue-900/90 backdrop-blur-md flex items-center overflow-hidden whitespace-nowrap z-30 border-t border-blue-500/30">
                    <div className="bg-blue-600 h-full px-6 flex items-center font-black text-sm uppercase tracking-widest shadow-xl z-10 relative">
                        E'LON
                        <div className="absolute -right-4 top-0 bottom-0 w-8 bg-gradient-to-r from-blue-600 to-transparent"></div>
                    </div>
                    <div className="animate-marquee inline-block pl-10 text-lg font-medium text-white">
                        {settings.scrollingText} ••• DIQQAT: "Kutishda" (Sariq rang) turgan bemorlar qaytib kelganda navbatsiz (birinchi o'rinda) kirish huquqiga ega! •••
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                    animation: marquee 25s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default TvDisplay;
