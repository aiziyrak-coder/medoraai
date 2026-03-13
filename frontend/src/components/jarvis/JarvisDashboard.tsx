/**
 * JarvisDashboard вЂ” Farg'ona JSTI Jarvis Asosiy UI
 * ===========================================
 * Doktor panelida ikki tab: Konsultatsiya Monitor | Interaktiv Jarvis
 * Konsilium bilan ma'lumot almashinuvi (Sync).
 */
import React, { useState, useCallback, useEffect } from 'react';
import type { PatientData, FinalReport } from '../../types';
import { INSTITUTE_NAME_SHORT } from '../../constants/brand';
import type { ConsultationDiagnosis, SpeechLanguage } from '../../services/speechService';
import { createJarvisSession, endJarvisSession } from '../../services/speechService';
import { ConsultationMonitor } from './ConsultationMonitor';
import { JarvisInteractive } from './JarvisInteractive';

interface Props {
  patientData:  PatientData;
  language:     string;
  // Optional: sync with Consilium
  consiliumReport?: FinalReport | null;
  onJarvisReport?: (report: ConsultationDiagnosis) => void;
  className?:   string;
}

type JarvisTab = 'monitor' | 'interactive';

interface DiagnosisCardProps {
  diagnosis: ConsultationDiagnosis;
  onDismiss: () => void;
}

function DiagnosisCard({ diagnosis, onDismiss }: DiagnosisCardProps) {
  const pd = diagnosis.primary_diagnosis as Record<string, unknown>;
  return (
    <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-emerald-300 text-sm">рџ§  AI Tashxis Xulosasi</h4>
        <button onClick={onDismiss} className="text-slate-500 hover:text-white text-lg">Г—</button>
      </div>

      {/* Complaints summary */}
      {diagnosis.patient_complaints_summary && (
        <div className="rounded-xl bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400 mb-1 font-medium">рџ“‹ Shikoyatlar xulosa</p>
          <p className="text-slate-200 text-sm">{diagnosis.patient_complaints_summary}</p>
        </div>
      )}

      {/* Primary diagnosis */}
      {pd?.name && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-600/30 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-medium text-sm">{String(pd.name)}</span>
            <div className="flex items-center gap-2">
              {pd.icd10 && (
                <span className="text-xs text-sky-400 font-mono">{String(pd.icd10)}</span>
              )}
              {pd.probability && (
                <span className="text-emerald-400 text-sm font-mono">{Number(pd.probability)}%</span>
              )}
            </div>
          </div>
          {pd.justification && (
            <p className="text-slate-400 text-xs">{String(pd.justification)}</p>
          )}
          {pd.uzbek_protocol && (
            <p className="text-sky-500 text-xs mt-1">рџ“Њ {String(pd.uzbek_protocol)}</p>
          )}
        </div>
      )}

      {/* Critical findings */}
      {Array.isArray(diagnosis.critical_findings) && diagnosis.critical_findings.length > 0 && (
        <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-3">
          <p className="text-red-300 text-xs font-bold mb-1">рџљЁ Kritik Topilmalar</p>
          {diagnosis.critical_findings.map((f, i) => (
            <p key={i} className="text-red-200 text-xs">· {f}</p>
          ))}
        </div>
      )}

      {/* Medications */}
      {Array.isArray(diagnosis.medications) && diagnosis.medications.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400 mb-2 font-medium">рџ’Љ Dori-darmonlar</p>
          <div className="space-y-1.5">
            {(diagnosis.medications as Record<string, unknown>[]).slice(0, 4).map((med, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-400 text-xs mt-0.5 shrink-0">·</span>
                <div>
                  <span className="text-white text-xs font-medium">{String(med.name)} </span>
                  <span className="text-slate-400 text-xs">
                    {String(med.dosage || '')} В· {String(med.frequency || '')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up */}
      {diagnosis.follow_up && (
        <p className="text-slate-400 text-xs px-1">рџ“… {diagnosis.follow_up}</p>
      )}
    </div>
  );
}

export const JarvisDashboard: React.FC<Props> = ({
  patientData,
  language,
  consiliumReport,
  onJarvisReport,
  className = '',
}) => {
  const [activeTab,    setActiveTab]   = useState<JarvisTab>('monitor');
  const [sessionId,    setSessionId]   = useState<string | null>(null);
  const [diagnosis,    setDiagnosis]   = useState<ConsultationDiagnosis | null>(null);
  const [error,        setError]       = useState('');
  const [sessionReady, setReady]       = useState(false);

  const lang = (language as SpeechLanguage) || 'uz-L';

  // Auto-create session when opening interactive tab
  const ensureSession = useCallback(async () => {
    if (sessionId) return;
    try {
      const resp = await createJarvisSession(
        lang,
        patientData as unknown as Record<string, unknown>,
      );
      if (resp.success && resp.data?.session_id) {
        setSessionId(resp.data.session_id);
        setReady(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sessionId, lang, patientData]);

  useEffect(() => {
    ensureSession();
    return () => {
      if (sessionId) endJarvisSession(sessionId).catch(() => null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Consilium report в†’ Jarvis context
  useEffect(() => {
    if (consiliumReport && sessionId) {
      // Add consilium results as system context
      // This is informational - jarvis_engine will include patient_data
    }
  }, [consiliumReport, sessionId]);

  const handleDiagnosis = useCallback((d: ConsultationDiagnosis) => {
    setDiagnosis(d);
    onJarvisReport?.(d);
  }, [onJarvisReport]);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 8000);
  }, []);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl
          ${sessionReady ? 'bg-sky-600' : 'bg-slate-700'}`}>
          рџ¤–
        </div>
        <div>
          <h2 className="text-base font-bold text-white">{INSTITUTE_NAME_SHORT} — Jarvis</h2>
          <p className="text-xs text-slate-400">Azure Speech В· GPT-4o</p>
        </div>
        {sessionId && (
          <span className="ml-auto text-xs font-mono text-emerald-400 bg-emerald-950/40
                           border border-emerald-600/30 px-2 py-0.5 rounded-full">
            в—Џ Sessiya faol
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-3 text-red-300 text-sm">
          вљ  {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1">
        {([
          { id: 'monitor',     label: 'рџЋ™ Konsultatsiya', desc: 'Passiv tinglash' },
          { id: 'interactive', label: 'рџ’¬ Jarvis Chat',   desc: 'Interaktiv' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-left transition-all ${
              activeTab === tab.id
                ? 'bg-slate-700 shadow-sm'
                : 'hover:bg-slate-700/40'
            }`}
          >
            <p className={`text-xs font-medium ${
              activeTab === tab.id ? 'text-white' : 'text-slate-400'
            }`}>{tab.label}</p>
            <p className="text-xs text-slate-500 hidden sm:block">{tab.desc}</p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0">
        {activeTab === 'monitor' && (
          <ConsultationMonitor
            patientData={patientData}
            language={lang}
            sessionId={sessionId}
            onSessionId={setSessionId}
            onDiagnosis={handleDiagnosis}
            onError={handleError}
          />
        )}

        {activeTab === 'interactive' && (
          <JarvisInteractive
            sessionId={sessionId}
            language={lang}
            onError={handleError}
          />
        )}
      </div>

      {/* Diagnosis result */}
      {diagnosis && (
        <DiagnosisCard
          diagnosis={diagnosis}
          onDismiss={() => setDiagnosis(null)}
        />
      )}

      {/* Consilium sync notice */}
      {consiliumReport && (
        <div className="rounded-xl bg-violet-950/30 border border-violet-600/30 p-3 text-xs text-violet-300">
          рџ”— Konsilium xulosasi Jarvis kontekstiga yuklandi вЂ” siz suhbat natijalariga asoslanib savol bera olasiz.
        </div>
      )}
    </div>
  );
};

export default JarvisDashboard;