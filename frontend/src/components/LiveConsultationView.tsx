import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnalysisRecord } from '../types';
import AnalysisView from './AnalysisView';
import MicrophoneIcon from './icons/MicrophoneIcon';
import VideoCameraIcon from './icons/VideoCameraIcon';
import VideoCameraOffIcon from './icons/VideoCameraOffIcon';
import PhoneHangupIcon from './icons/PhoneHangupIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { logger } from '../utils/logger';
import { useTranslation } from '../hooks/useTranslation';
import { isApiConfigured } from '../config/api';
import {
    createTeleSession,
    getTeleSignal,
    postTeleSignal,
} from '../services/apiTelemedicineService';

interface LiveConsultationViewProps {
    analysisRecord: AnalysisRecord;
    onEndCall: () => void;
}

const LiveConsultationView: React.FC<LiveConsultationViewProps> = ({ analysisRecord, onEndCall }) => {
    const { t } = useTranslation();
    const [inCall, setInCall] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [signalStatus, setSignalStatus] = useState<string>('');

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const patientName = `${analysisRecord.patientData.firstName} ${analysisRecord.patientData.lastName}`.trim();

    const stopStream = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    }, []);

    const setupWebRtc = useCallback(async (code: string, stream: MediaStream) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (ev) => {
            if (ev.candidate && code) {
                void postTeleSignal(code, { type: 'ice', candidate: ev.candidate.toJSON() });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postTeleSignal(code, { type: 'offer', sdp: offer.sdp || '' });
        setSignalStatus(t('tele_signal_offer_sent'));

        pollRef.current = setInterval(async () => {
            const res = await getTeleSignal(code);
            if (!res.success || !res.data || !pcRef.current) return;
            const { answer_sdp, ice_candidates } = res.data;
            if (answer_sdp && !pcRef.current.remoteDescription) {
                await pcRef.current.setRemoteDescription({ type: 'answer', sdp: answer_sdp });
                setSignalStatus(t('tele_signal_connected'));
            }
            if (Array.isArray(ice_candidates)) {
                for (const c of ice_candidates) {
                    if (c) {
                        try {
                            await pcRef.current.addIceCandidate(c as RTCIceCandidateInit);
                        } catch {
                            /* ignore duplicate candidates */
                        }
                    }
                }
            }
        }, 2000);
    }, [t]);

    useEffect(() => {
        if (inCall && isCameraOn) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(async stream => {
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                    streamRef.current = stream;
                    setIsConnecting(false);
                    if (isApiConfigured() && roomCode) {
                        try {
                            await setupWebRtc(roomCode, stream);
                        } catch (e) {
                            logger.warn('WebRTC setup failed', e);
                            setSignalStatus(t('tele_signal_local_only'));
                        }
                    } else {
                        setSignalStatus(t('tele_signal_local_only'));
                    }
                })
                .catch(err => {
                    logger.error('getUserMedia error:', err);
                    setStreamError(t('tele_media_error'));
                    setIsConnecting(false);
                    setIsCameraOn(false);
                });
        } else {
            stopStream();
        }

        return () => stopStream();
    }, [inCall, isCameraOn, roomCode, setupWebRtc, stopStream, t]);

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

    const handleStartCall = async () => {
        setIsConnecting(true);
        setStreamError(null);
        if (isApiConfigured()) {
            const label = patientName || t('tele_demo_patient');
            const sess = await createTeleSession(label);
            if (sess.success && sess.data?.room_code) {
                setRoomCode(sess.data.room_code);
            }
        }
        setInCall(true);
    };

    if (!inCall) {
        return (
            <div className="glass-panel animate-fade-in-up p-6 md:p-8">
                <div className="text-center">
                    <VideoCameraIcon className="w-12 h-12 mx-auto text-accent-color-blue" />
                    <h2 className="mt-4 text-2xl font-bold text-text-primary">{t('tele_start_title')}</h2>
                    <p className="mt-2 text-text-secondary">
                        {t('tele_start_patient_label')}{' '}
                        <span className="font-semibold text-text-primary">{patientName}</span>
                    </p>
                </div>

                <div className="mt-8 flex flex-col items-center gap-4">
                    <button
                        type="button"
                        onClick={() => void handleStartCall()}
                        disabled={isConnecting}
                        className="w-full max-w-xs flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all duration-300 transform hover:scale-105"
                    >
                        {isConnecting ? (
                            <>
                                <SpinnerIcon className="w-5 h-5" />
                                {t('tele_connecting')}
                            </>
                        ) : (
                            t('tele_start_call')
                        )}
                    </button>
                    <button type="button" onClick={onEndCall} className="text-sm text-text-secondary hover:text-text-primary">
                        {t('tele_cancel')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[calc(100vh-180px)] min-h-[600px] flex flex-col lg:flex-row gap-4 animate-fade-in-up">
            <div className="lg:w-1/3 xl:w-1/4 h-full flex flex-col gap-4">
                <div className="flex-grow bg-slate-800 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg border border-border-color">
                    <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-300 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`} />
                    {!isCameraOn && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-800">
                            <VideoCameraOffIcon className="w-16 h-16" />
                            <p className="mt-2 font-semibold">{t('tele_camera_off')}</p>
                        </div>
                    )}
                    {streamError && (
                        <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-800/90 text-center">
                            <p className="text-sm text-red-400">{streamError}</p>
                        </div>
                    )}
                    {signalStatus && (
                        <div className="absolute top-2 left-2 right-2 text-xs text-cyan-300 bg-black/40 rounded px-2 py-1">
                            {signalStatus}
                            {roomCode && <span className="block font-mono opacity-70">{roomCode}</span>}
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 glass-panel p-3 rounded-2xl flex justify-center items-center gap-4">
                    <button type="button" onClick={handleToggleMic} className={`p-3 rounded-full transition-colors ${isMicOn ? 'bg-slate-100 text-text-primary' : 'bg-slate-200 text-text-primary'}`} title={isMicOn ? t('tele_mute') : t('tele_unmute')}>
                        <MicrophoneIcon className="w-6 h-6" isMuted={!isMicOn} />
                    </button>
                    <button type="button" onClick={handleToggleCamera} className={`p-3 rounded-full transition-colors ${isCameraOn ? 'bg-slate-100 text-text-primary' : 'bg-slate-200 text-text-primary'}`} title={isCameraOn ? t('tele_camera_disable') : t('tele_camera_enable')}>
                        {isCameraOn ? <VideoCameraIcon className="w-6 h-6" /> : <VideoCameraOffIcon className="w-6 h-6" />}
                    </button>
                    <button type="button" onClick={handleEndCall} className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.5)]" title={t('tele_end_call')}>
                        <PhoneHangupIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="lg:w-2/3 xl:w-3/4 h-full">
                <div className="glass-panel h-full">
                    <div className="p-6 overflow-hidden flex flex-col h-full">
                        <AnalysisView
                            record={analysisRecord}
                            isLive={false}
                            statusMessage={t('analysis_complete_status')}
                            isAnalyzing={false}
                            differentialDiagnoses={[]}
                            error={null}
                            diagnosisFeedback={analysisRecord.patientData.userDiagnosisFeedback || {}}
                            userIntervention={null}
                            socraticQuestion={null}
                            livePrognosis={null}
                            onDiagnosisFeedback={() => {}}
                            onStartDebate={() => {}}
                            onInjectHypothesis={() => {}}
                            onUserIntervention={() => {}}
                            onExplainRationale={() => {}}
                            onRunScenario={async () => null}
                            onUpdateReport={() => {}}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveConsultationView;
