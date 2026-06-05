import React from 'react';
import type { MonitoringAlarm, VitalSigns } from '../types';
import type { MonitoringPatientCard } from '../services/apiMonitoringService';
import { useTranslation } from '../hooks/useTranslation';
import SpinnerIcon from './icons/SpinnerIcon';
import EkgWaveIcon from './icons/EkgWaveIcon';
import HeartRateIcon from './icons/HeartRateIcon';
import OxygenIcon from './icons/OxygenIcon';

type VitalStatus = 'normal' | 'warning' | 'critical';

function vitalStatus(metric: string, vitals: VitalSigns): VitalStatus {
  switch (metric) {
    case 'hr': {
      const v = vitals.heartRate;
      if (v < 50 || v > 120) return v < 40 || v > 150 ? 'critical' : 'warning';
      return 'normal';
    }
    case 'spo2': {
      const v = vitals.spO2;
      if (v < 90) return 'critical';
      if (v < 95) return 'warning';
      return 'normal';
    }
    case 'bp': {
      const s = vitals.bpSystolic;
      const d = vitals.bpDiastolic;
      if (s >= 180 || d >= 110 || s < 90) return 'critical';
      if (s >= 140 || d >= 90) return 'warning';
      return 'normal';
    }
    case 'rr': {
      const v = vitals.respirationRate;
      if (v < 10 || v > 24) return 'warning';
      return 'normal';
    }
    case 'temp': {
      const v = vitals.temperature;
      if (v == null) return 'normal';
      if (v >= 38.5 || v < 35.5) return 'critical';
      if (v >= 37.5 || v < 36) return 'warning';
      return 'normal';
    }
    default:
      return 'normal';
  }
}

const statusColors: Record<VitalStatus, string> = {
  normal: 'text-green-400 border-green-500/40 bg-green-500/10',
  warning: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  critical: 'text-red-400 border-red-500/40 bg-red-500/10 animate-pulse',
};

const VitalTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  status: VitalStatus;
}> = ({ icon, label, value, unit, status }) => (
  <div className={`rounded-xl border p-4 ${statusColors[status]}`}>
    <div className="flex items-center gap-2 mb-2 opacity-80">{icon}</div>
    <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
    <p className="text-2xl font-bold mt-1">
      {value} <span className="text-sm font-normal opacity-70">{unit}</span>
    </p>
  </div>
);

interface RemoteMonitoringDashboardProps {
  patients: MonitoringPatientCard[];
  selectedPatient: MonitoringPatientCard | null;
  selectedId: number | null;
  onSelectPatient: (id: number) => void;
  vitals: VitalSigns | null;
  alarms: MonitoringAlarm[];
  isConnecting: boolean;
  isConnected: boolean;
  captureMessage: string;
  lastRefresh: Date | null;
  apiConfigured: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onCapture: () => void;
  onRefresh: () => void;
  onAcknowledgeAlarm: (id: number) => void;
}

const RemoteMonitoringDashboard: React.FC<RemoteMonitoringDashboardProps> = ({
  patients,
  selectedPatient,
  selectedId,
  onSelectPatient,
  vitals,
  alarms,
  isConnecting,
  isConnected,
  captureMessage,
  lastRefresh,
  apiConfigured,
  onConnect,
  onDisconnect,
  onCapture,
  onRefresh,
  onAcknowledgeAlarm,
}) => {
  const { t } = useTranslation();

  if (!apiConfigured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800 font-medium">{t('monitoring_api_required')}</p>
        <p className="text-sm text-amber-700 mt-2">{t('monitoring_api_hint')}</p>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-700">
        <SpinnerIcon className="w-10 h-10 mx-auto text-cyan-400 animate-spin" />
        <p className="mt-4 font-semibold text-white">{t('monitoring_connecting')}</p>
      </div>
    );
  }

  if (!isConnected || patients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-cyan-100 flex items-center justify-center text-3xl">📡</div>
        <h3 className="text-lg font-bold text-slate-800">{t('monitoring_empty_title')}</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">{t('monitoring_empty_desc')}</p>
        <button
          type="button"
          onClick={() => void onConnect()}
          className="px-6 py-2.5 rounded-xl bg-cyan-600 text-white font-semibold text-sm hover:bg-cyan-700"
        >
          {t('monitoring_connect_btn')}
        </button>
      </div>
    );
  }

  const hrStatus = vitals ? vitalStatus('hr', vitals) : 'normal';
  const spo2Status = vitals ? vitalStatus('spo2', vitals) : 'normal';
  const bpStatus = vitals ? vitalStatus('bp', vitals) : 'normal';
  const rrStatus = vitals ? vitalStatus('rr', vitals) : 'normal';
  const tempStatus = vitals ? vitalStatus('temp', vitals) : 'normal';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-semibold text-green-700">{t('monitoring_connected')}</span>
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              {t('monitoring_last_update')}: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
          >
            {t('monitoring_refresh')}
          </button>
          <button
            type="button"
            onClick={() => void onCapture()}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {t('monitoring_save_data')}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-600"
          >
            {t('monitoring_disconnect')}
          </button>
        </div>
      </div>

      {captureMessage && (
        <p className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
          {t('monitoring_captured_at')}: {captureMessage}
        </p>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-2">
          <h4 className="text-sm font-bold text-slate-700">{t('monitoring_patients_title')}</h4>
          {patients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPatient(p.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedId === p.id
                  ? 'border-cyan-500 bg-cyan-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-cyan-300'
              }`}
            >
              <p className="font-bold text-slate-900 text-sm">{p.patient_label}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {p.room} · {t('monitoring_bed')} {p.bed_label}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    p.device_online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.device_online ? t('monitoring_device_online') : t('monitoring_device_offline')}
                </span>
                {p.open_alarms > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                    {p.open_alarms} {t('monitoring_alarms_short')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 shadow-xl">
            {selectedPatient && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedPatient.patient_label}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedPatient.room} · {t('monitoring_bed')} {selectedPatient.bed_label}
                  </p>
                </div>
                {selectedPatient.last_reading_at && (
                  <p className="text-xs text-slate-500">
                    {new Date(selectedPatient.last_reading_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {vitals ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <VitalTile
                    icon={<HeartRateIcon />}
                    label={t('vital_pulse')}
                    value={String(vitals.heartRate)}
                    unit="bpm"
                    status={hrStatus}
                  />
                  <VitalTile
                    icon={<OxygenIcon />}
                    label={t('vital_spo2')}
                    value={String(vitals.spO2)}
                    unit="%"
                    status={spo2Status}
                  />
                  <VitalTile
                    icon={<span className="text-yellow-400 font-bold text-xs">AQB</span>}
                    label={t('vital_bp')}
                    value={`${vitals.bpSystolic}/${vitals.bpDiastolic}`}
                    unit="mmHg"
                    status={bpStatus}
                  />
                  <VitalTile
                    icon={<span className="text-blue-400 font-bold text-xs">N/S</span>}
                    label={t('vital_respiration')}
                    value={String(vitals.respirationRate)}
                    unit="/min"
                    status={rrStatus}
                  />
                  <VitalTile
                    icon={<span className="text-orange-400 font-bold text-xs">°C</span>}
                    label={t('vital_temperature')}
                    value={vitals.temperature != null ? vitals.temperature.toFixed(1) : '—'}
                    unit="°C"
                    status={tempStatus}
                  />
                </div>
                <div className="h-28 w-full bg-black/40 rounded-xl overflow-hidden relative flex items-center">
                  <EkgWaveIcon className="absolute w-full h-20 text-green-400/80" />
                  <div className="absolute inset-0 bg-grid-pattern opacity-10" />
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-center py-12">{t('monitoring_no_vitals')}</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 h-full">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              {t('monitoring_alarms_title')}
              {alarms.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{alarms.length}</span>
              )}
            </h4>
            {alarms.length === 0 ? (
              <p className="text-sm text-slate-500">{t('monitoring_no_alarms')}</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {alarms.map((a) => (
                  <li
                    key={a.id}
                    className={`p-3 rounded-lg border text-sm ${
                      a.severity === 'critical'
                        ? 'border-red-300 bg-red-50'
                        : 'border-amber-300 bg-amber-50'
                    }`}
                  >
                    <p className="font-bold text-slate-900">{a.patient}</p>
                    <p className="text-slate-700 mt-0.5">{a.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </p>
                    <button
                      type="button"
                      onClick={() => void onAcknowledgeAlarm(a.id)}
                      className="mt-2 text-xs font-semibold text-cyan-700 hover:underline"
                    >
                      {t('monitoring_ack_alarm')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoteMonitoringDashboard;
