/**
 * ZiyrakDashboard вЂ” Farg'ona JSTI Ziyrak Asosiy UI
 * ============================================
 * 3 tab: Konsultatsiya Monitor | Interaktiv Ziyrak | Operatsiya Xonasi
 * "Salom Ziyrak" wake word orqali faollashadi.
 * Pulsatsiyalanuvchi ko'k nur вЂ” uyg'onish indikatori.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { PatientData, FinalReport } from '../../types';
import { WakeWordDetector, requestWakeLock, releaseWakeLock } from '../../services/wakeWordDetector';
import { ZiyrakConsultation } from './ZiyrakConsultation';
import { ZiyrakInteractive }  from './ZiyrakInteractive';
import { ZiyrakSurgery }      from './ZiyrakSurgery';
import { apiPost, API_BASE_URL } from '../../services/api';
import { INSTITUTE_NAME_SHORT } from '../../constants/brand';

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Types
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export type ZiyrakMode = 'consultation' | 'interactive' | 'surgery';
export type ZiyrakState = 'sleeping' | 'listening' | 'active' | 'speaking';

interface Props {
  patientData?:   PatientData;
  language:       string;
  consiliumReport?: FinalReport | null;
  className?:     string;
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Wake Word Pulse indicator
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function WakeIndicator({ state }: { state: ZiyrakState }) {
  const config: Record<ZiyrakState, { color: string; label: string; pulse: boolean }> = {
    sleeping:  { color: "bg-slate-600",  label: "Uxlayapti",   pulse: false },
    listening: { color: "bg-sky-500",    label: "Tinglayapti", pulse: true  },
    active:    { color: "bg-emerald-500",label: "Faol",        pulse: true  },
    speaking:  { color: "bg-violet-500", label: "Gapirmoqda",  pulse: true  },
  };
  const cfg = config[state];
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-3 h-3 rounded-full ${cfg.color}`} />
        {cfg.pulse && (
          <div className={`absolute inset-0 rounded-full ${cfg.color} animate-ping opacity-75`} />
        )}
      </div>
      <span className={`text-xs font-medium ${
        state === "active" ? "text-emerald-400" :
        state === "speaking" ? "text-violet-400" :
        state === "listening" ? "text-sky-400" : "text-slate-500"
      }`}>{cfg.label}</span>
    </div>
  );
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Wake Word Banner
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function WakeBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-sky-900/90 border-2 border-sky-400 rounded-3xl px-8 py-6 text-center
                      shadow-2xl shadow-sky-500/30 animate-[fadeInScale_0.4s_ease-out]">
        <div className="text-4xl mb-3">рџ¤–</div>
        <p className="text-sky-300 font-bold text-xl">Ziyrak Faollashdi!</p>
        <p className="text-sky-400/80 text-sm mt-1">
          Men {INSTITUTE_NAME_SHORT} platformasining raqamli yordamchisi вЂ” Ziyrakman.
        </p>
        {/* Pulse ring */}
        <div className="mt-4 flex justify-center">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-sky-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-sky-500/50 animate-ping animation-delay-150" />
            <div className="w-16 h-16 rounded-full bg-sky-600 flex items-center justify-center">
              <span className="text-2xl">рџ”Љ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Main Dashboard
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export const ZiyrakDashboard: React.FC<Props> = ({
  patientData,
  language,
  consiliumReport,
  className = '',
}) => {
  const [activeMode,    setActiveMode]    = useState<ZiyrakMode>('consultation');
  const [sessionId,     setSessionId]     = useState<string | null>(null);
  const [ziyrakState,   setZiyrakState]   = useState<ZiyrakState>('sleeping');
  const [wakeActive,    setWakeActive]    = useState(false);
  const [showWakeBanner, setShowBanner]   = useState(false);
  const [error,         setError]         = useState('');
  const [wakeDetecting, setWakeDetecting] = useState(false);

  const lang = language as "uz-L" | "uz-C" | "ru" | "en";
  const wakeDetectorRef = useRef<WakeWordDetector | null>(null);

  // Session yaratish
  const ensureSession = useCallback(async (mode = "standard") => {
    if (sessionId) return sessionId;
    try {
      const token = localStorage.getItem("access_token") || "";
      const resp = await fetch(`${API_BASE_URL}/ziyrak/session/create/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          language,
          patient_data: patientData || {},
          mode,
        }),
      });
      const data = await resp.json() as { success?: boolean; data?: { session_id?: string } };
      if (data.success && data.data?.session_id) {
        setSessionId(data.data.session_id);
        return data.data.session_id;
      }
    } catch (e) {
      setError(String(e));
    }
    return null;
  }, [sessionId, language, patientData]);

  useEffect(() => {
    ensureSession();
    requestWakeLock();
    return () => {
      releaseWakeLock();
      wakeDetectorRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wake Word boshlash
  const startWakeDetection = useCallback(() => {
    if (wakeDetectorRef.current?.isRunning) return;
    const detector = new WakeWordDetector(lang);
    const ok = detector.start(
      () => {
        // Wake word aniqlandi
        setZiyrakState("active");
        setWakeActive(true);
        setShowBanner(true);
        setActiveMode("interactive");
        setTimeout(() => detector.sleep(), 30000); // 30s keyin uxlash
      },
      (err) => setError(err),
    );
    if (ok) {
      wakeDetectorRef.current = detector;
      setWakeDetecting(true);
      setZiyrakState("listening");
    }
  }, [lang]);

  const stopWakeDetection = useCallback(() => {
    wakeDetectorRef.current?.stop();
    wakeDetectorRef.current = null;
    setWakeDetecting(false);
    setZiyrakState("sleeping");
    setWakeActive(false);
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(""), 8000);
  }, []);

  const TABS: Array<{ id: ZiyrakMode; label: string; desc: string; icon: string }> = [
    { id: "consultation", icon: "рџЋ™",  label: "Konsultatsiya",     desc: "Passiv tinglash" },
    { id: "interactive",  icon: "рџ’¬",  label: "Ziyrak Chat",        desc: "Interaktiv" },
    { id: "surgery",      icon: "рџ©є",  label: "Operatsiya Xonasi",  desc: "Hands-free" },
  ];

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Wake Banner */}
      {showWakeBanner && (
        <WakeBanner onDismiss={() => setShowBanner(false)} />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Avatar with pulse */}
        <div className="relative shrink-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl
            transition-all duration-300 ${
              ziyrakState === "sleeping" ? "bg-slate-700" :
              ziyrakState === "listening" ? "bg-sky-700" :
              ziyrakState === "active" ? "bg-emerald-700" : "bg-violet-700"
            }`}>
            рџ¤–
          </div>
          {ziyrakState !== "sleeping" && (
            <div className={`absolute inset-0 rounded-full animate-ping opacity-40 ${
              ziyrakState === "active" ? "bg-emerald-500" :
              ziyrakState === "speaking" ? "bg-violet-500" : "bg-sky-500"
            }`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white text-base">{INSTITUTE_NAME_SHORT} — Ziyrak</h2>
            <span className="text-xs text-slate-500 font-mono">v3.0</span>
          </div>
          <WakeIndicator state={ziyrakState} />
        </div>

        {/* Wake word toggle */}
        <button
          onClick={wakeDetecting ? stopWakeDetection : startWakeDetection}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            wakeDetecting
              ? "bg-sky-700 text-white border border-sky-500"
              : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-sky-500"
          }`}
          title={wakeDetecting ? "'Salom Ziyrak' tinglayapti" : "'Salom Ziyrak' tinglashni boshlash"}
        >
          {wakeDetecting ? "рџЋ™ Tinglayapti" : "рџЋ™ Wake Word"}
        </button>
      </div>

      {/* Wake word hint */}
      {wakeDetecting && (
        <div className="rounded-xl bg-sky-950/40 border border-sky-700/40 px-3 py-2 flex items-center gap-2">
          <span className="text-sky-400 text-lg animate-pulse">рџ‘‚</span>
          <p className="text-sky-300/80 text-xs">
            "<strong className="text-sky-200">Salom Ziyrak</strong>" deb ayting вЂ” tizim faollashadi
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-3 text-red-300 text-sm">
          вљ  {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMode(tab.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-left transition-all ${
              activeMode === tab.id ? "bg-slate-700 shadow-sm" : "hover:bg-slate-700/40"
            }`}
          >
            <p className={`text-xs font-medium leading-none ${
              activeMode === tab.id ? "text-white" : "text-slate-400"
            }`}>{tab.icon} {tab.label}</p>
            <p className="text-xs text-slate-500 hidden sm:block mt-0.5">{tab.desc}</p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0">
        {activeMode === "consultation" && (
          <ZiyrakConsultation
            patientData={patientData}
            language={lang}
            sessionId={sessionId}
            onSessionId={setSessionId}
            onError={handleError}
            onStateChange={setZiyrakState}
          />
        )}
        {activeMode === "interactive" && (
          <ZiyrakInteractive
            sessionId={sessionId}
            language={lang}
            isWakeActive={wakeActive}
            onError={handleError}
            onStateChange={setZiyrakState}
          />
        )}
        {activeMode === "surgery" && (
          <ZiyrakSurgery
            language={lang}
            onError={handleError}
            onStateChange={setZiyrakState}
          />
        )}
      </div>

      {/* Consilium sync */}
      {consiliumReport && (
        <div className="rounded-xl bg-violet-950/30 border border-violet-600/30 p-3 text-xs text-violet-300">
          рџ”— Konsilium xulosasi Ziyrak kontekstiga yuklandi
        </div>
      )}
    </div>
  );
};

export default ZiyrakDashboard;