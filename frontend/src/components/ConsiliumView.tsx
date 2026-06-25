/**
 * ConsiliumView - Multi-Agent Medical Consilium
 * Vizual ko'rsatish: 3 faza progress + professorlar bahsi + yakuniy xulosa
 */
import React, { useState, useRef, useEffect } from 'react';
import type { PatientData, FinalReport } from '../types';
import { normalizeFolkMedicine, normalizeNutritionPrevention } from '../types';
import { normalizeConsensusDiagnosis } from '../types';
import { enrichFinalReport } from '../utils/reportNormalize';
import { runConsilium, type ConsiliumResult, type DebateMessage } from '../services/apiAiService';
import { generatePdfReport } from '../services/pdfGenerator';
import { generateDocxReport } from '../services/docxGenerator';
import { INSTITUTE_LOGO_SRC, INSTITUTE_NAME_FULL } from '../constants/brand';
import { useTranslation } from '../hooks/useTranslation';
import LinkifiedText from './common/LinkifiedText';
import ClinicalDebateContent from './common/ClinicalDebateContent';

async function getInstituteLogoDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch(INSTITUTE_LOGO_SRC);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

interface Props {
  patientData: PatientData;
  language:    string;
  onReport:    (report: FinalReport) => void;
  onError:     (msg: string) => void;
}

type PhaseStatus = 'waiting' | 'running' | 'done' | 'error';

interface PhaseState {
  independent: PhaseStatus;
  debate:      PhaseStatus;
  consensus:   PhaseStatus;
}

const PROFESSOR_COLORS: Record<string, string> = {
  deepseek: 'D',
  llama: 'L',
  mistral:  'bg-amber-600',
  mini: 'Mi',
  gpt4o: 'G',
};

const PROFESSOR_ICONS: Record<string, string> = {
  deepseek: 'D',
  llama:    'L',
  mistral:  'M',
  mini:     'Mi',
  gpt4o:    'G',
};

function PhaseIndicator({
  label, status,
}: { label: string; status: PhaseStatus }) {
  const colors: Record<PhaseStatus, string> = {
    waiting: 'bg-slate-700 text-slate-400',
    running: 'bg-blue-600 text-white animate-pulse',
    done:    'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
  };
  const icons: Record<PhaseStatus, string> = {
    waiting: '...',
    running: 'O',
    done:    '+',
    error:   'x',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colors[status]}`}>
      <span>{icons[status]}</span>
      <span>{label}</span>
    </div>
  );
}

function DebateCard({ msg, t }: { msg: DebateMessage; t: (key: string) => string }) {
  const agentId = msg.id.split('-')[0];
  const colorClass = PROFESSOR_COLORS[agentId] || 'bg-slate-600';
  const icon       = PROFESSOR_ICONS[agentId]  || 'K';
  const isDebate   = msg.phase === 'debate';

  return (
    <div className={`rounded-2xl p-4 mb-3 border ${isDebate ? 'border-amber-500/40 bg-amber-950/20' : 'border-slate-600/40 bg-slate-800/40'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm ${colorClass}`}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-white leading-none">{msg.author}</p>
          {msg.authorTitle && msg.authorTitle !== msg.author && (
            <p className="text-xs text-slate-400">{msg.authorTitle}</p>
          )}
        </div>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDebate ? 'bg-amber-600 text-white' : 'bg-slate-600 text-slate-200'}`}>
          {isDebate ? t('consilium_debate_round') : t('consilium_independent')}
        </span>
      </div>
      <div className="text-sm text-slate-300 leading-relaxed">
        <ClinicalDebateContent text={msg.content} />
      </div>
    </div>
  );
}

export const ConsiliumView: React.FC<Props> = ({ patientData, language, onReport, onError }) => {
  const { t, language: uiLanguage } = useTranslation();
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [result,    setResult]    = useState<ConsiliumResult | null>(null);
  const [phases,    setPhases]    = useState<PhaseState>({ independent: 'waiting', debate: 'waiting', consensus: 'waiting' });
  const [activeTab, setActiveTab] = useState<'debate' | 'report'>('debate');
  const [elapsed,   setElapsed]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debateRef = useRef<HTMLDivElement>(null);
  const phaseLabels = {
    independent: t('consilium_phase_independent'),
    debate: t('consilium_phase_debate'),
    consensus: t('consilium_phase_consensus'),
  };

  const start = async () => {
    setLoading(true);
    setResult(null);
    setPhases({ independent: 'running', debate: 'waiting', consensus: 'waiting' });
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    try {
      // Simulate phase transitions while waiting for response
      const p1Timeout = setTimeout(() =>
        setPhases(p => ({ ...p, independent: 'done', debate: 'running' })), 2500);
      const p2Timeout = setTimeout(() =>
        setPhases(p => ({ ...p, debate: 'done', consensus: 'running' })), 8000);

      const resp = await runConsilium(patientData, language, {
        regionalContext: patientData.regionalContext,
        specialistDebateSummary: patientData.specialistDebateSummary,
        allowIncomplete: patientData.allowIncompleteClinical,
      });

      clearTimeout(p1Timeout);
      clearTimeout(p2Timeout);

      if (!resp.success || !resp.data) {
        throw new Error((resp as { error?: { message?: string } }).error?.message || t('consilium_error'));
      }

      setPhases({ independent: 'done', debate: 'done', consensus: 'done' });
      setResult(resp.data);

      // Convert to FinalReport format for parent (normalize in case API returns different shape)
      const fr = resp.data.final_report;
      const consensusDiagnosis = normalizeConsensusDiagnosis(fr?.consensusDiagnosis);
      const frAny = fr as unknown as {
        folkMedicine?: unknown;
        folk_medicine?: unknown;
        nutritionPrevention?: unknown;
        nutrition_prevention?: unknown;
      };
      const fm = normalizeFolkMedicine(frAny.folkMedicine ?? frAny.folk_medicine);
      const nprev = normalizeNutritionPrevention(frAny.nutritionPrevention ?? frAny.nutrition_prevention);
      onReport(enrichFinalReport({
        ...(fr as FinalReport),
        consensusDiagnosis,
        treatmentPlan: Array.isArray(fr.treatmentPlan) ? fr.treatmentPlan : [],
        medicationRecommendations: (Array.isArray(fr.medicationRecommendations) ? fr.medicationRecommendations : []) as FinalReport['medicationRecommendations'],
        recommendedTests: Array.isArray(fr.recommendedTests) ? fr.recommendedTests : [],
        unexpectedFindings: typeof fr.unexpectedFindings === 'string' ? fr.unexpectedFindings : '',
        uzbekistanLegislativeNote: typeof fr.uzbekistanLegislativeNote === 'string' ? fr.uzbekistanLegislativeNote : '',
        criticalFinding: fr.criticalFinding,
        ...(fm ? { folkMedicine: fm } : {}),
        ...(nprev ? { nutritionPrevention: nprev } : {}),
      }, { patientData, language }));
    } catch (err) {
      setPhases(p => ({
        ...p,
        [p.independent === 'running' ? 'independent' : p.debate === 'running' ? 'debate' : 'consensus']: 'error',
      }));
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Auto-scroll debate list
  useEffect(() => {
    if (debateRef.current) {
      debateRef.current.scrollTop = debateRef.current.scrollHeight;
    }
  }, [result]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t('consilium_title')}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {t('consilium_subtitle')}
          </p>
        </div>
        {loading && (
          <span className="text-sky-400 text-sm font-mono animate-pulse">{formatTime(elapsed)}</span>
        )}
      </div>

      {/* Phase progress */}
      <div className="flex flex-wrap gap-2">
        <PhaseIndicator label={phaseLabels.independent} status={phases.independent} />
        <PhaseIndicator label={phaseLabels.debate}      status={phases.debate}      />
        <PhaseIndicator label={phaseLabels.consensus}   status={phases.consensus}   />
      </div>

      {/* Start button */}
      {!loading && !result && (
        <button
          onClick={start}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-violet-600
                     text-white font-semibold text-base hover:opacity-90 active:scale-95 transition-all"
        >
          {t('consilium_start')}
        </button>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-6 text-center">
          <div className="animate-spin w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-300">{t('consilium_analyzing')}</p>
          <p className="text-slate-500 text-sm mt-1">{t('consilium_time_estimate')}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-700 pb-0">
            {(['debate', 'report'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
                  ${activeTab === tab
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'}`}
              >
                {tab === 'debate' ? t('consilium_tab_debate') : t('consilium_tab_report')}
              </button>
            ))}
          </div>

          {activeTab === 'debate' && (
            <div ref={debateRef} className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {(Array.isArray(result.professors) ? result.professors : []).filter((p: { id?: string }) => p.id !== 'gpt4o').map((prof: { id?: string; name?: string; title?: string; initialDiagnosis?: string }) => (
                  <div key={prof.id}
                       className={`rounded-xl p-3 text-xs ${PROFESSOR_COLORS[prof.id] || 'bg-slate-600'} bg-opacity-20 border border-slate-600/30 flex flex-col`}>
                    <p className="font-semibold text-white">{PROFESSOR_ICONS[prof.id]} {prof.name}</p>
                    <p className="text-slate-300 truncate">{prof.title}</p>
                  </div>
                ))}
              </div>

              {(Array.isArray(result.final_report?.debateHistory) ? result.final_report.debateHistory : [])
                .filter((msg) => msg.phase !== 'consensus' && !String(msg.id ?? '').includes('chair-closing')
                  && !/KONSILIUM YOPILDI/i.test(String(msg.content ?? '')))
                .map(msg => (
                <DebateCard
                  key={msg.id}
                  msg={msg}
                  t={t}
                />
              ))}

              {Array.isArray(result.final_report?.dissentingOpinions) && result.final_report.dissentingOpinions.length > 0 && (
                <div className="rounded-xl p-3 bg-amber-950/30 border border-amber-500/30 text-sm text-amber-200">
                  <p className="font-semibold mb-1">{t('consilium_dissenting_opinions')}</p>
                  {(result.final_report.dissentingOpinions || []).map((op, i) => (
                    <p key={i}>· {op}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Consensus Diagnosis */}
              <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-4">
                <h3 className="font-bold text-emerald-300 mb-2">{t('consilium_consensus_diagnosis')}</h3>
                {(normalizeConsensusDiagnosis(result.final_report?.consensusDiagnosis) || []).slice(0, 5).map((d, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <p className="text-white font-medium">
                      {d.diagnosisRank ?? i + 1}. {d.name}
                    </p>
                    {d.justification && (
                      <p className="text-slate-300 text-sm mt-1 leading-relaxed">{d.justification}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Critical Finding */}
              {result.final_report.criticalFinding && (
                <div className="rounded-2xl bg-red-950/40 border border-red-500/50 p-4">
                  <h3 className="font-bold text-red-300 mb-1">{t('consilium_critical_finding')}</h3>
                  <p className="text-red-200 text-sm">{result.final_report.criticalFinding.finding}</p>
                  <p className="text-red-300 text-xs mt-1">{result.final_report.criticalFinding.implication}</p>
                </div>
              )}

              {/* Medications */}
              {Array.isArray(result.final_report?.medicationRecommendations) && result.final_report.medicationRecommendations.length > 0 && (
                <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
                  <h3 className="font-bold text-white mb-2">{t('consilium_medications')}</h3>
                  {result.final_report.pharmacologyWarnings?.length > 0 && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-900/40 border border-amber-500/30">
                      <p className="text-amber-300 text-xs font-semibold">{t('consilium_pharmacology_warnings')}</p>
                      {(result.final_report.pharmacologyWarnings || []).map((w, i) => (
                        <p key={i} className="text-amber-200 text-xs">· {w}</p>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {(result.final_report.medicationRecommendations || []).map((med, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-700/50">
                        <p className="text-white text-sm font-medium">{med.name} - {med.dosage}</p>
                        <p className="text-slate-400 text-xs">{med.frequency}, {med.duration}</p>
                        {med.instructions && <p className="text-slate-400 text-xs italic">{med.instructions}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up */}
              {result.final_report.followUpPlan && (
                <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
                  <h3 className="font-bold text-white mb-1">{t('consilium_follow_up_plan')}</h3>
                  <p className="text-slate-300 text-sm">{result.final_report.followUpPlan}</p>
                </div>
              )}

              <p className="text-xs text-slate-600 text-center">{result.final_report.uzbekistanLegislativeNote}</p>

              {/* Umumiy konsilium xulosasini yuklab olish */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-600/50">
                <span className="text-slate-400 text-sm w-full">{t('consilium_final_conclusion')}</span>
                {exportError && (
                  <p className="text-xs text-red-400 w-full" role="alert">{exportError}</p>
                )}
                <button
                  type="button"
                  disabled={exporting !== null}
                  onClick={async () => {
                    setExportError(null);
                    setExporting('pdf');
                    try {
                      const logoDataUrl = await getInstituteLogoDataUrl();
                      const exportReport = enrichFinalReport(result.final_report as unknown as FinalReport);
                      await generatePdfReport(
                        exportReport,
                        patientData,
                        { instituteName: INSTITUTE_NAME_FULL, instituteLogoDataUrl: logoDataUrl },
                        t,
                        uiLanguage,
                      );
                    } catch (err) {
                      console.error('Consilium PDF export failed:', err);
                      setExportError(t('export_download_error'));
                    } finally {
                      setExporting(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 disabled:opacity-60 text-white text-sm"
                >
                  {exporting === 'pdf' ? t('export_downloading') : t('consilium_download_pdf')}
                </button>
                <button
                  type="button"
                  disabled={exporting !== null}
                  onClick={async () => {
                    setExportError(null);
                    setExporting('docx');
                    try {
                      const logoDataUrl = await getInstituteLogoDataUrl();
                      const exportReport = enrichFinalReport(result.final_report as unknown as FinalReport);
                      await generateDocxReport(
                        exportReport,
                        patientData,
                        { instituteName: INSTITUTE_NAME_FULL, instituteLogoDataUrl: logoDataUrl },
                        t,
                        uiLanguage,
                      );
                    } catch (err) {
                      console.error('Consilium DOCX export failed:', err);
                      setExportError(t('export_download_error'));
                    } finally {
                      setExporting(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 disabled:opacity-60 text-white text-sm"
                >
                  {exporting === 'docx' ? t('export_downloading') : t('consilium_download_docx')}
                </button>
              </div>
            </div>
          )}

          {/* Re-run button */}
          <button
            onClick={start}
            disabled={loading}
            className="w-full py-2 rounded-xl border border-slate-600 text-slate-400 text-sm
                       hover:border-sky-500 hover:text-sky-400 transition-colors"
          >
            {t('consilium_rerun')}
          </button>
        </>
      )}
    </div>
  );
};

export default ConsiliumView;