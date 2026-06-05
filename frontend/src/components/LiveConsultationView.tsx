import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnalysisRecord } from '../types';
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

type ConsultPriority = 'routine' | 'urgent';

interface ChatLine {
    id: string;
    from: 'doctor' | 'patient' | 'system';
    text: string;
    time: string;
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const LiveConsultationView: React.FC<LiveConsultationViewProps> = ({ analysisRecord, onEndCall }) => {
    const { t } = useTranslation();
    const [inCall, setInCall] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [signalStatus, setSignalStatus] = useState<string>('');
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [priority, setPriority] = useState<ConsultPriority>('routine');
    const [complaint, setComplaint] = useState(analysisRecord.patientData.complaints || '');
    const [notes, setNotes] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [chatLines, setChatLines] = useState<ChatLine[]>([]);
    const [callSeconds, setCallSeconds] = useState(0);
    const [codeCopied, setCodeCopied] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const pd = analysisRecord.patientData;
    const patientName = `${pd.firstName} ${pd.lastName}`.trim() || t('tele_demo_patient');

    const addChat = useCallback((from: ChatLine['from'], text: string) => {
        setChatLines((prev) => [
            ...prev,
            { id: `${Date.now()}-${prev.length}`, from, text, time: new Date().toLocaleTimeString() },
        ]);
    }, []);

    const stopStream = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setRemoteConnected(false);
    }, []);

    const setupWebRtc = useCallback(
        async (code: string, stream: MediaStream) => {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
            });
            pcRef.current = pc;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.ontrack = (ev) => {
                if (remoteVideoRef.current && ev.streams[0]) {
                    remoteVideoRef.current.srcObject = ev.streams[0];
                    setRemoteConnected(true);
                    addChat('system', t('tele_remote_joined'));
                }
            };

            pc.onicecandidate = (ev) => {
                if (ev.candidate && code) {
                    void postTeleSignal(code, { type: 'ice', candidate: ev.candidate.toJSON() });
                }
            };

            pc.onconnectionstatechange = () => {
                const st = pc.connectionState;
                if (st === 'connected') {
                    setSignalStatus(t('tele_signal_connected'));
                } else if (st === 'failed' || st === 'disconnected') {
                    setSignalStatus(t('tele_signal_reconnecting'));
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await postTeleSignal(code, { type: 'offer', sdp: offer.sdp || '' });
            setSignalStatus(t('tele_signal_offer_sent'));
            addChat('system', t('tele_room_created'));

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
                                /* duplicate ICE */
                            }
                        }
                    }
                }
            }, 2000);
        },
        [addChat, t],
    );

    useEffect(() => {
        if (inCall && isCameraOn) {
            navigator.mediaDevices
                .getUserMedia({ video: { facingMode: 'user' }, audio: true })
                .then(async (stream) => {
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
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
                .catch((err) => {
                    logger.error('getUserMedia error:', err);
                    setStreamError(t('tele_media_error'));
                    setIsConnecting(false);
                    setIsCameraOn(false);
                });
        } else if (inCall && !isCameraOn) {
            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then(async (stream) => {
                    streamRef.current = stream;
                    setIsConnecting(false);
                    if (isApiConfigured() && roomCode) {
                        try {
                            await setupWebRtc(roomCode, stream);
                        } catch {
                            setSignalStatus(t('tele_signal_local_only'));
                        }
                    }
                })
                .catch(() => {
                    setStreamError(t('tele_media_error'));
                    setIsConnecting(false);
                });
        } else {
            stopStream();
        }
        return () => stopStream();
    }, [inCall, isCameraOn, roomCode, setupWebRtc, stopStream, t]);

    useEffect(() => {
        if (inCall) {
            timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [inCall]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLines]);

    const handleToggleMic = () => {
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = !isMicOn;
            });
            setIsMicOn(!isMicOn);
        }
    };

    const handleToggleCamera = () => setIsCameraOn(!isCameraOn);

    const handleEndCall = () => {
        setInCall(false);
        stopStream();
        setCallEnded(true);
        addChat('system', t('tele_call_ended'));
    };

    const handleStartCall = async () => {
        setIsConnecting(true);
        setStreamError(null);
        setCallEnded(false);
        setCallSeconds(0);
        setChatLines([]);
        if (isApiConfigured()) {
            const label = patientName;
            const sess = await createTeleSession(label);
            if (sess.success && sess.data?.room_code) {
                setRoomCode(sess.data.room_code);
            }
        }
        setInCall(true);
    };

    const handleCopyCode = async () => {
        if (!roomCode) return;
        const text = `${window.location.origin}?tele=${roomCode}`;
        try {
            await navigator.clipboard.writeText(text);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        } catch {
            await navigator.clipboard.writeText(roomCode);
        }
    };

    const handleSendChat = () => {
        const text = chatInput.trim();
        if (!text) return;
        addChat('doctor', text);
        setChatInput('');
    };

    if (callEnded) {
        return (
            <div className="glass-panel p-6 md:p-8 max-w-2xl mx-auto space-y-4">
                <h2 className="text-xl font-bold text-slate-800">{t('tele_summary_title')}</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-slate-50 border">
                        <p className="text-slate-500">{t('tele_start_patient_label')}</p>
                        <p className="font-bold">{patientName}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border">
                        <p className="text-slate-500">{t('tele_duration')}</p>
                        <p className="font-bold font-mono">{formatDuration(callSeconds)}</p>
                    </div>
                </div>
                {complaint && (
                    <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100 text-sm">
                        <p className="font-semibold text-cyan-900">{t('tele_complaint_label')}</p>
                        <p className="mt-1">{complaint}</p>
                    </div>
                )}
                {notes && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm">
                        <p className="font-semibold text-emerald-900">{t('tele_notes_label')}</p>
                        <p className="mt-1 whitespace-pre-wrap">{notes}</p>
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setCallEnded(false);
                            setRoomCode(null);
                        }}
                        className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold"
                    >
                        {t('tele_new_call')}
                    </button>
                    <button type="button" onClick={onEndCall} className="px-4 py-2 rounded-lg border text-sm">
                        {t('monitoring_back')}
                    </button>
                </div>
            </div>
        );
    }

    if (!inCall) {
        return (
            <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 glass-panel p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <VideoCameraIcon className="w-10 h-10 text-cyan-600" />
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{t('tele_start_title')}</h2>
                            <p className="text-sm text-slate-500">{t('tele_start_desc')}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">{t('tele_start_patient_label')}</p>
                        <p className="font-bold text-lg text-slate-900 mt-1">{patientName}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                            {pd.age && <span>{t('pdf_age')}: {pd.age}</span>}
                            {pd.gender && (
                                <span>
                                    {t('pdf_gender')}:{' '}
                                    {pd.gender === 'male' ? t('pdf_gender_male') : pd.gender === 'female' ? t('pdf_gender_female') : pd.gender}
                                </span>
                            )}
                        </div>
                    </div>

                    <label className="block text-sm">
                        <span className="font-semibold text-slate-700">{t('tele_complaint_label')}</span>
                        <textarea
                            value={complaint}
                            onChange={(e) => setComplaint(e.target.value)}
                            className="mt-1 w-full common-input min-h-[72px]"
                            placeholder={t('tele_complaint_placeholder')}
                        />
                    </label>

                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">{t('tele_priority_label')}</p>
                        <div className="flex gap-2">
                            {(['routine', 'urgent'] as ConsultPriority[]).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPriority(p)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                                        priority === p
                                            ? p === 'urgent'
                                                ? 'bg-red-600 text-white border-red-600'
                                                : 'bg-cyan-600 text-white border-cyan-600'
                                            : 'bg-white text-slate-600 border-slate-300'
                                    }`}
                                >
                                    {t(`tele_priority_${p}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleStartCall()}
                        disabled={isConnecting}
                        className="w-full flex justify-center items-center gap-3 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-70 shadow-lg"
                    >
                        {isConnecting ? (
                            <>
                                <SpinnerIcon className="w-5 h-5 animate-spin" />
                                {t('tele_connecting')}
                            </>
                        ) : (
                            t('tele_start_call')
                        )}
                    </button>
                    <button type="button" onClick={onEndCall} className="w-full text-sm text-slate-500 hover:text-slate-700">
                        {t('tele_cancel')}
                    </button>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="glass-panel p-5">
                        <h3 className="font-bold text-slate-800">{t('tele_features_title')}</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-600">
                            <li className="flex gap-2"><span className="text-cyan-600">✓</span>{t('tele_feature_video')}</li>
                            <li className="flex gap-2"><span className="text-cyan-600">✓</span>{t('tele_feature_notes')}</li>
                            <li className="flex gap-2"><span className="text-cyan-600">✓</span>{t('tele_feature_chat')}</li>
                            <li className="flex gap-2"><span className="text-cyan-600">✓</span>{t('tele_feature_secure')}</li>
                        </ul>
                    </div>
                    {analysisRecord.finalReport?.consensusDiagnosis?.length > 0 && (
                        <div className="glass-panel p-5">
                            <h3 className="font-bold text-slate-800 text-sm">{t('tele_patient_diagnosis')}</h3>
                            <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                {analysisRecord.finalReport.consensusDiagnosis.slice(0, 3).map((d, i) => (
                                    <li key={i}>• {d.name}{d.probability ? ` (${d.probability}%)` : ''}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 min-h-[calc(100vh-200px)]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {t('tele_live')}
                    </span>
                    <span className="font-mono text-sm text-slate-600">{formatDuration(callSeconds)}</span>
                    <span className="text-sm font-semibold text-slate-800">{patientName}</span>
                    {priority === 'urgent' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">
                            {t('tele_priority_urgent')}
                        </span>
                    )}
                </div>
                {roomCode && (
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">{t('tele_room_code')}:</span>
                        <code className="px-2 py-1 bg-slate-100 rounded font-mono font-bold">{roomCode}</code>
                        <button
                            type="button"
                            onClick={() => void handleCopyCode()}
                            className="px-2 py-1 rounded bg-cyan-600 text-white font-semibold hover:bg-cyan-700"
                        >
                            {codeCopied ? t('tele_copied') : t('tele_copy_link')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
                <div className="xl:w-2/5 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-[200px]">
                        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover min-h-[140px] ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
                            />
                            {!isCameraOn && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                    <VideoCameraOffIcon className="w-10 h-10" />
                                    <p className="text-xs mt-1">{t('tele_you')}</p>
                                </div>
                            )}
                            <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                                {t('tele_you')}
                            </span>
                        </div>
                        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className={`w-full h-full object-cover min-h-[140px] ${remoteConnected ? 'opacity-100' : 'opacity-0'}`}
                            />
                            {!remoteConnected && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                                    <SpinnerIcon className="w-8 h-8 animate-spin opacity-50" />
                                    <p className="text-xs mt-2">{t('tele_waiting_remote')}</p>
                                </div>
                            )}
                            <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                                {t('tele_patient')}
                            </span>
                        </div>
                    </div>

                    {signalStatus && (
                        <p className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2">
                            {signalStatus}
                        </p>
                    )}
                    {streamError && <p className="text-xs text-red-600">{streamError}</p>}

                    <div className="flex justify-center items-center gap-4 p-3 rounded-xl bg-slate-100 border">
                        <button
                            type="button"
                            onClick={handleToggleMic}
                            className={`p-3 rounded-full ${isMicOn ? 'bg-white shadow' : 'bg-red-100'}`}
                            title={isMicOn ? t('tele_mute') : t('tele_unmute')}
                        >
                            <MicrophoneIcon className="w-6 h-6" isMuted={!isMicOn} />
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleCamera}
                            className={`p-3 rounded-full ${isCameraOn ? 'bg-white shadow' : 'bg-red-100'}`}
                        >
                            {isCameraOn ? <VideoCameraIcon className="w-6 h-6" /> : <VideoCameraOffIcon className="w-6 h-6" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleEndCall}
                            className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg"
                        >
                            <PhoneHangupIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="xl:w-3/5 flex flex-col gap-3 min-h-[300px]">
                    <div className="glass-panel p-4 flex-1 flex flex-col min-h-0">
                        <h4 className="font-bold text-slate-800 text-sm mb-2">{t('tele_chat_title')}</h4>
                        <div className="flex-1 overflow-y-auto space-y-2 min-h-[120px] max-h-48 mb-3 pr-1">
                            {chatLines.map((line) => (
                                <div
                                    key={line.id}
                                    className={`text-sm p-2 rounded-lg ${
                                        line.from === 'doctor'
                                            ? 'bg-cyan-50 ml-8'
                                            : line.from === 'patient'
                                              ? 'bg-emerald-50 mr-8'
                                              : 'bg-slate-100 text-center text-xs text-slate-500'
                                    }`}
                                >
                                    {line.from !== 'system' && (
                                        <span className="text-[10px] text-slate-400 block">{line.time}</span>
                                    )}
                                    {line.text}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                                className="flex-1 common-input text-sm"
                                placeholder={t('tele_chat_placeholder')}
                            />
                            <button
                                type="button"
                                onClick={handleSendChat}
                                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold"
                            >
                                {t('tele_chat_send')}
                            </button>
                        </div>
                    </div>

                    <label className="block glass-panel p-4">
                        <span className="font-bold text-slate-800 text-sm">{t('tele_notes_label')}</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-2 w-full common-input min-h-[100px] text-sm"
                            placeholder={t('tele_notes_placeholder')}
                        />
                    </label>

                    {complaint && (
                        <div className="glass-panel p-3 text-sm">
                            <span className="font-semibold text-slate-700">{t('tele_complaint_label')}: </span>
                            <span className="text-slate-600">{complaint}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveConsultationView;
