import React, { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import LiveConsultationView from './LiveConsultationView';
import RemoteMonitoringDashboard from './RemoteMonitoringDashboard';
import { useMonitoringDashboard } from '../hooks/useMonitoringDashboard';
import { isApiConfigured } from '../config/api';
import type { AnalysisRecord } from '../types';

type Tab = 'consult' | 'monitor';

interface TelemedicineHubProps {
  lastAnalysis?: AnalysisRecord | null;
  recentAnalyses?: AnalysisRecord[];
  onBack: () => void;
}

function buildDemoRecord(t: (k: string) => string): AnalysisRecord {
  return {
    id: 'tele-demo',
    patientId: 'demo',
    date: new Date().toISOString(),
    patientData: {
      firstName: t('tele_demo_patient'),
      lastName: '',
      age: '42',
      gender: '',
      complaints: t('tele_demo_complaint'),
    },
    debateHistory: [],
    finalReport: {
      consensusDiagnosis: [],
      rejectedHypotheses: [],
      recommendedTests: [],
      treatmentPlan: [],
      medicationRecommendations: [],
      unexpectedFindings: '',
    },
    followUpHistory: [],
  };
}

const TelemedicineHub: React.FC<TelemedicineHubProps> = ({
  lastAnalysis,
  recentAnalyses = [],
  onBack,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('consult');
  const [selectedId, setSelectedId] = useState<string | null>(lastAnalysis?.id ?? null);

  const monitoring = useMonitoringDashboard(tab === 'monitor' && isApiConfigured());

  const candidates = useMemo(() => {
    const list = recentAnalyses.length ? recentAnalyses : lastAnalysis ? [lastAnalysis] : [];
    return list;
  }, [recentAnalyses, lastAnalysis]);

  const selectedRecord = useMemo(() => {
    if (selectedId) {
      const found = candidates.find((r) => r.id === selectedId);
      if (found) return found;
    }
    if (lastAnalysis) return lastAnalysis;
    if (candidates[0]) return candidates[0];
    return buildDemoRecord(t);
  }, [selectedId, candidates, lastAnalysis, t]);

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <p className="text-sm text-slate-600 leading-relaxed">{t('telemedicine_intro')}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white">
          <p className="text-2xl">🎥</p>
          <p className="font-bold text-slate-800 text-sm mt-2">{t('tele_card_video_title')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('tele_card_video_desc')}</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-2xl">📊</p>
          <p className="font-bold text-slate-800 text-sm mt-2">{t('tele_card_monitor_title')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('tele_card_monitor_desc')}</p>
        </div>
        <div className="p-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white">
          <p className="text-2xl">🔒</p>
          <p className="font-bold text-slate-800 text-sm mt-2">{t('tele_card_secure_title')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('tele_card_secure_desc')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setTab('consult')}
          className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-colors ${
            tab === 'consult'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {t('tele_tab_consult')}
        </button>
        <button
          type="button"
          onClick={() => setTab('monitor')}
          className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-colors ${
            tab === 'monitor'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {t('tele_tab_monitor')}
          {monitoring.alarms.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">
              {monitoring.alarms.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'consult' ? (
        <div className="space-y-4">
          {candidates.length > 0 && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">{t('tele_select_patient')}</p>
              <div className="flex flex-wrap gap-2">
                {candidates.map((rec) => {
                  const name = `${rec.patientData.firstName} ${rec.patientData.lastName}`.trim();
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setSelectedId(rec.id)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        selectedRecord.id === rec.id
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      {name || t('tele_demo_patient')}
                      {rec.patientData.age && (
                        <span className="text-xs opacity-70 ml-1">({rec.patientData.age})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <LiveConsultationView
            key={selectedRecord.id}
            analysisRecord={selectedRecord}
            onEndCall={onBack}
          />
        </div>
      ) : (
        <RemoteMonitoringDashboard
          patients={monitoring.patients}
          selectedPatient={monitoring.selectedPatient}
          selectedId={monitoring.selectedId}
          onSelectPatient={monitoring.setSelectedId}
          vitals={monitoring.vitals}
          alarms={monitoring.alarms}
          isConnecting={monitoring.isConnecting}
          isConnected={monitoring.isConnected}
          captureMessage={monitoring.captureMessage}
          lastRefresh={monitoring.lastRefresh}
          apiConfigured={isApiConfigured()}
          onConnect={monitoring.onConnect}
          onDisconnect={monitoring.onDisconnect}
          onCapture={monitoring.onCapture}
          onRefresh={monitoring.onRefresh}
          onAcknowledgeAlarm={monitoring.onAcknowledgeAlarm}
        />
      )}
    </div>
  );
};

export default TelemedicineHub;
