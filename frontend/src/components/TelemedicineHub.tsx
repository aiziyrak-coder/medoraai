import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import LiveConsultationView from './LiveConsultationView';
import RealTimePatientMonitor from './tools/RealTimePatientMonitor';
import { useMonitoringVitals } from '../hooks/useMonitoringVitals';
import { isApiConfigured } from '../config/api';
import type { AnalysisRecord } from '../types';

type Tab = 'consult' | 'monitor';

interface TelemedicineHubProps {
  lastAnalysis?: AnalysisRecord | null;
  onBack: () => void;
}

const TelemedicineHub: React.FC<TelemedicineHubProps> = ({ lastAnalysis, onBack }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('consult');
  const monitoring = useMonitoringVitals(tab === 'monitor' && isApiConfigured());

  const mockRecord: AnalysisRecord = lastAnalysis || {
    id: 'tele-demo',
    patientId: 'demo',
    date: new Date().toISOString(),
    patientData: {
      firstName: t('tele_demo_patient'),
      lastName: '',
      age: '—',
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 max-w-2xl">{t('telemedicine_intro')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('consult')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'consult' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          {t('tele_tab_consult')}
        </button>
        <button
          type="button"
          onClick={() => setTab('monitor')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'monitor' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          {t('tele_tab_monitor')}
        </button>
      </div>
      {tab === 'consult' ? (
        <LiveConsultationView analysisRecord={mockRecord} onEndCall={onBack} />
      ) : (
        <div className="space-y-4">
          {!isApiConfigured() && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {t('monitoring_api_required')}
            </p>
          )}
          {isApiConfigured() && !monitoring.isConnected && !monitoring.isConnecting && (
            <button
              type="button"
              onClick={() => void monitoring.onConnect()}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold"
            >
              {t('monitoring_connect_btn')}
            </button>
          )}
          <RealTimePatientMonitor
            vitals={monitoring.vitals}
            isConnecting={monitoring.isConnecting}
            isConnected={monitoring.isConnected}
            onDisconnect={monitoring.onDisconnect}
            onCapture={() => void monitoring.onCapture()}
            captureMessage={monitoring.captureMessage}
            onBack={onBack}
          />
        </div>
      )}
    </div>
  );
};

export default TelemedicineHub;
