import React, { useState, useEffect, useRef } from 'react';
import type { AnalysisRecord } from '../types';
import AnalysisView from './AnalysisView';
import MicrophoneIcon from './icons/MicrophoneIcon';
import VideoCameraIcon from './icons/VideoCameraIcon';
import VideoCameraOffIcon from './icons/VideoCameraOffIcon';
import PhoneHangupIcon from './icons/PhoneHangupIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { logger } from '../utils/logger';

interface LiveConsultationViewProps {
    analysisRecord: AnalysisRecord;
    onEndCall: () => void;
}

const specialists = [
    { name: "Dr. A. Orlov", title: "Kardiolog", avatar: `https://i.pravatar.cc/150?u=dr.orlov` },
    { name: "Dr. S. Petrova", title: "Pulmonolog", avatar: `https://i.pravatar.cc/150?u=dr.petrova` },
    { name: "Dr. I. Ahmedov", title: "Neyroxirurg", avatar: `https://i.pravatar.cc/150?u=dr.ahmedov` },
];

const LiveConsultationView: React.FC<LiveConsultationViewProps> = ({ analysisRecord, onEndCall }) => {
    const [inCall, setInCall] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    };
    
    useEffect(() => {
        if (inCall && isCameraOn) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                    streamRef.current = stream;
                    setIsConnecting(false);
                })
                .catch(err => {
                    // getUserMedia error
                    logger.error("getUserMedia error:", err);
                    setStreamError("Kamera yoki mikrofonga ruxsat berilmadi. Iltimos, brauzer sozlamalarini tekshiring va sahifani yangilang.");
                    setIsConnecting(false);
                    setIsCameraOn(false);
                });
        } else {
            stopStream();
        }
        
        return () => stopStream(); // Cleanup on unmount
    }, [inCall, isCameraOn]);


    const handleToggleMic = () => {
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !isMicOn;
            });
            setIsMicOn(!isMicOn);
        }
    };

    const handleToggleCamera = () => {
        setIsCameraOn(!isCameraOn);
    };

    const handleEndCall = () => {
        setInCall(false);
        stopStream();
        onEndCall();
    };

    const handleStartCall = () => {
        setIsConnecting(true);
        setStreamError(null);
        setInCall(true);
    };


    if (!inCall) {
        return (
            <div className="glass-panel animate-fade-in-up p-6 md:p-8">
                <div className="text-center">
                    <VideoCameraIcon className="w-12 h-12 mx-auto text-accent-color-blue" />
                    <h2 className="mt-4 text-2xl font-bold text-text-primary">Telekonsultatsiyani Boshlash</h2>
                    <p className="mt-2 text-text-secondary">
                        Bemor <span className="font-semibold text-text-primary">{analysisRecord.patientData.firstName} {analysisRecord.patientData.lastName}</span> holatini muhokama qilish uchun konsilium.
                    </p>
                </div>

                <div className="mt-8 max-w-lg mx-auto bg-slate-100/80 p-4 rounded-xl border border-border-color">
                     <h3 className="font-semibold text-text-primary mb-3 text-center">Taklif etilgan mutaxassislar:</h3>
                     <div className="flex justify-center gap-4 flex-wrap">
                        {specialists.map(spec => (
                            <div key={spec.name} className="text-center">
                                <img src={spec.avatar} alt={spec.name} className="w-16 h-16 rounded-full mx-auto ring-2 ring-white/10 shadow-lg"/>
                                <p className="text-sm font-semibold mt-2 text-text-primary">{spec.name}</p>
                                <p className="text-xs text-text-secondary">{spec.title}</p>
                            </div>
                        ))}
                     </div>
                </div>
                
                <div className="mt-8 flex flex-col items-center gap-4">
                     <button
                        onClick={handleStartCall}
                        disabled={isConnecting}
                        className="w-full max-w-xs flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all duration-300 transform hover:scale-105"
                    >
                        {isConnecting ? (
                            <>
                                <SpinnerIcon className="w-5 h-5" />
                                Bog'lanilmoqda...
                            </>
                        ) : (
                            "Konsiliumni Boshlash"
                        )}
                    </button>
                    <button onClick={onEndCall} className="text-sm text-text-secondary hover:text-text-primary">
                        Bekor qilish
                    </button>
                </div>
            </div>
        );
    }
    

    // In-Call View
    return (
        <div className="w-full h-[calc(100vh-180px)] min-h-[600px] flex flex-col lg:flex-row gap-4 animate-fade-in-up">
            {/* Left side: Call interface */}
            <div className="lg:w-1/3 xl:w-1/4 h-full flex flex-col gap-4">
                <div className="flex-grow bg-slate-800 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg border border-border-color">
                    <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-300 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}></video>
                    {!isCameraOn && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-800">
                            <VideoCameraOffIcon className="w-16 h-16" />
                             <p className="mt-2 font-semibold">Kamera o'chiq</p>
                         </div>
                    )}
                     {streamError && (
                         <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-800/90 text-center">
                            <p className="text-sm text-red-400">{streamError}</p>
                         </div>
                    )}
                </div>
                 <div className="flex-shrink-0 grid grid-cols-3 gap-3">
                     {specialists.map(spec => (
                        <div key={spec.name} className="bg-slate-700 border border-border-color rounded-lg aspect-square flex items-center justify-center flex-col p-2 relative shadow-sm overflow-hidden">
                            <img src={spec.avatar} alt={spec.name} className="w-10 h-10 rounded-full"/>
                             <p className="text-xs font-semibold mt-1.5 text-white text-center">{spec.name}</p>
                             <div className="absolute bottom-1 left-1 bg-black/30 p-0.5 rounded-full backdrop-blur-sm">
                                <MicrophoneIcon className="w-3 h-3 text-slate-300" />
                             </div>
                        </div>
                     ))}
                 </div>
                 <div className="flex-shrink-0 glass-panel p-3 rounded-2xl flex justify-center items-center gap-4">
                     <button onClick={handleToggleMic} className={`p-3 rounded-full transition-colors ${isMicOn ? 'bg-slate-100 text-text-primary' : 'bg-slate-200 text-text-primary'}`} title={isMicOn ? "Ovozni o'chirish" : "Ovozni yoqish"}>
                         <MicrophoneIcon className="w-6 h-6" isMuted={!isMicOn} />
                     </button>
                    <button onClick={handleToggleCamera} className={`p-3 rounded-full transition-colors ${isCameraOn ? 'bg-slate-100 text-text-primary' : 'bg-slate-200 text-text-primary'}`} title={isCameraOn ? "Kamerani o'chirish" : "Kamerani yoqish"}>
                         {isCameraOn ? <VideoCameraIcon className="w-6 h-6" /> : <VideoCameraOffIcon className="w-6 h-6" />}
                     </button>
                     <button onClick={handleEndCall} className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.5)]" title="Chaqiruvni yakunlash">
                         <PhoneHangupIcon className="w-6 h-6" />
                     </button>
                 </div>
            </div>

            {/* Right side: Analysis View */}
            <div className="lg:w-2/3 xl:w-3/4 h-full">
                <div className="glass-panel h-full">
                    <div className="p-6 overflow-hidden flex flex-col h-full">
                        <AnalysisView 
                           record={analysisRecord}
                           isLive={false}
                           statusMessage="Tahlil yakunlangan"
                           isAnalyzing={false}
                           differentialDiagnoses={[]}
                           error={null}
                           diagnosisFeedback={analysisRecord.patientData.userDiagnosisFeedback || {}}
                           userIntervention={null}
                           onDiagnosisFeedback={() => {}}
                           onStartDebate={() => {}}
                           onInjectHypothesis={() => {}}
                           onUserIntervention={() => {}}
                           onExplainRationale={() => {}}
                           onGoToEducation={() => {}}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveConsultationView;