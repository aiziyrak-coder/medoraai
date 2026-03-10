/**
 * Markazlashgan Bemor Monitoring – Grid, bitta bemor, boshqaruv (palata/qurilma/bemor).
 * Real-time: WebSocket, Chart.js grafiklar, alert (SpO2<90, HR>130).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from '../types';
import * as monitoringApi from '../services/monitoringApiService';
import { getAuthToken } from '../services/api';
import type {
  DashboardPatientCard,
  VitalReading,
  Alarm,
  Room,
  Device,
  Ward,
  PatientMonitor as PatientMonitorType,
  MonitoringAuditLogEntry,
  MonitoringNoteEntry,
  AlarmThresholdType,
  MonitoringStaffMember,
  VitalsCompareRangeItem,
} from '../services/monitoringApiService';
import SpinnerIcon from './icons/SpinnerIcon';
import HeartRateIcon from './icons/HeartRateIcon';
import OxygenIcon from './icons/OxygenIcon';
import MonitorIcon from './icons/MonitorIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { useTranslation } from '../hooks/useTranslation';
import 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';

interface MonitoringDashboardProps {
  user: User;
  onLogout: () => void;
}

const POLL_INTERVAL_MS = 5000;

/** Gateway dan kelgan real-time vital (WebSocket) */
export interface LiveVitalPayload {
  device_id: string;
  heart_rate?: number;
  spo2?: number;
  bp_sys?: number;
  bp_dia?: number;
  nibp_systolic?: number;
  nibp_diastolic?: number;
  respiration?: number;
  temperature?: number;
  timestamp?: string;
}

/** Vital status: green = normal, yellow = warning, red = critical (hospital-grade color coding). */
export type VitalStatus = 'normal' | 'warning' | 'critical';

interface VitalLike {
  heart_rate?: number | null;
  spo2?: number | null;
  nibp_systolic?: number | null;
  nibp_diastolic?: number | null;
}

const getVitalStatus = (v: VitalLike | null): { status: VitalStatus; reason?: string } => {
  if (!v) return { status: 'normal' };
  // Critical
  if (v.spo2 != null && v.spo2 < 90) return { status: 'critical', reason: `SpO₂ ${v.spo2}% < 90` };
  if (v.heart_rate != null && v.heart_rate > 130) return { status: 'critical', reason: `HR ${v.heart_rate} > 130` };
  if (v.heart_rate != null && v.heart_rate < 40) return { status: 'critical', reason: `HR ${v.heart_rate} < 40` };
  const sys = v.nibp_systolic != null ? Number(v.nibp_systolic) : null;
  const dia = v.nibp_diastolic != null ? Number(v.nibp_diastolic) : null;
  if (sys != null && (sys > 180 || sys < 90)) return { status: 'critical', reason: `AQB sistolik ${sys}` };
  if (dia != null && (dia > 120 || dia < 60)) return { status: 'critical', reason: `AQB diastolik ${dia}` };
  // Warning
  if (v.spo2 != null && v.spo2 >= 90 && v.spo2 < 95) return { status: 'warning', reason: `SpO₂ ${v.spo2}%` };
  if (v.heart_rate != null && ((v.heart_rate >= 100 && v.heart_rate <= 130) || (v.heart_rate >= 40 && v.heart_rate < 50)))
    return { status: 'warning', reason: `HR ${v.heart_rate}` };
  return { status: 'normal' };
};

/** Legacy: true if critical (for alert badge). */
const isVitalAlert = (v: VitalLike | null): { alert: boolean; reason?: string } => {
  const { status, reason } = getVitalStatus(v);
  return { alert: status === 'critical', reason };
};

/** Mini kartochka – bitta bemor (grid uchun). Green / yellow / red by vital status. */
const PatientCard: React.FC<{
  card: DashboardPatientCard;
  liveVital?: LiveVitalPayload | null;
  onClick: () => void;
}> = ({ card, liveVital, onClick }) => {
  const v = liveVital
    ? {
        heart_rate: liveVital.heart_rate ?? null,
        spo2: liveVital.spo2 ?? null,
        nibp_systolic: liveVital.bp_sys ?? liveVital.nibp_systolic ?? null,
        nibp_diastolic: liveVital.bp_dia ?? liveVital.nibp_diastolic ?? null,
        respiration_rate: liveVital.respiration ?? null,
        temperature: liveVital.temperature != null ? String(liveVital.temperature) : null,
        timestamp: liveVital.timestamp ?? '',
      }
    : card.last_vital;
  const vitalForStatus: VitalLike = v
    ? {
        heart_rate: v.heart_rate ?? null,
        spo2: v.spo2 ?? null,
        nibp_systolic: v.nibp_systolic ?? null,
        nibp_diastolic: v.nibp_diastolic ?? null,
      }
    : {};
  const { status: vitalStatus, reason: vitalReason } = getVitalStatus(vitalForStatus);
  const backendAlarm = card.unack_alarm_count > 0;
  const hasCritical = vitalStatus === 'critical' || backendAlarm;
  const hasWarning = vitalStatus === 'warning';
  const borderClass =
    hasCritical
      ? 'bg-red-500/10 border-red-500/50 shadow-red-500/20 ring-2 ring-red-500/50'
      : hasWarning
        ? 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/20 ring-1 ring-amber-500/40'
        : 'bg-slate-800/60 border-slate-600/50 hover:border-emerald-500/40';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${borderClass}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-white truncate">{card.patient_name || card.bed_label || `#${card.id}`}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {card.ews_score != null && (
            <span
              className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                card.ews_level === 'yuqori' ? 'bg-red-500/30 text-red-200' :
                card.ews_level === "o'rta" ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-600/50 text-slate-400'
              }`}
              title="Early Warning Score (EWS)"
            >
              EWS {card.ews_score}
            </span>
          )}
          {(hasCritical || hasWarning) && (
            <span className={`flex items-center gap-1 text-xs font-semibold ${hasCritical ? 'text-red-400' : 'text-amber-400'}`}>
              <AlertTriangleIcon className="w-4 h-4" />
              {vitalReason ?? (card.unack_alarm_count ? `${card.unack_alarm_count} alarm` : '')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <span>{card.room_name} {card.bed_label && `· ${card.bed_label}`}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${card.device_status === 'online' ? 'bg-green-400' : 'bg-slate-500'}`} title={card.device_status} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className={`flex items-center gap-1 ${
          (v?.heart_rate != null && (Number(v?.heart_rate) > 130 || Number(v?.heart_rate) < 40)) ? 'text-red-400' :
          (v?.heart_rate != null && ((Number(v?.heart_rate) >= 100 && Number(v?.heart_rate) <= 130) || (Number(v?.heart_rate) >= 40 && Number(v?.heart_rate) < 50))) ? 'text-amber-400' : ''
        }`}>
          <HeartRateIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="font-mono">{v?.heart_rate ?? '--'}</span>
          <span className="text-slate-400 text-xs">bpm</span>
        </div>
        <div className={`flex items-center gap-1 ${
          v?.spo2 != null && Number(v?.spo2) < 90 ? 'text-red-400' :
          v?.spo2 != null && Number(v?.spo2) >= 90 && Number(v?.spo2) < 95 ? 'text-amber-400' : ''
        }`}>
          <OxygenIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="font-mono">{v?.spo2 ?? '--'}</span>
          <span className="text-slate-400 text-xs">%</span>
        </div>
        <div className="text-white font-mono text-xs">
          AQB {v?.nibp_systolic ?? '--'}/{v?.nibp_diastolic ?? '--'}
        </div>
        <div className="col-span-2 text-white font-mono text-xs">
          Nafas {v?.respiration_rate ?? '--'} /min
        </div>
        <div className="text-white font-mono text-xs">
          Temp {v?.temperature ?? '--'} °C
        </div>
      </div>
      {(card.fall_risk || card.pressure_risk) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {card.fall_risk && <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">Yiqilish: {card.fall_risk}</span>}
          {card.pressure_risk && <span className="text-[10px] px-1 rounded bg-orange-500/20 text-orange-300">Bosim: {card.pressure_risk}</span>}
        </div>
      )}
      <div className="mt-2 text-[10px] text-slate-500">
        {v?.timestamp ? new Date(v.timestamp).toLocaleTimeString('uz-UZ') : '—'}
      </div>
    </button>
  );
};

/** Real-time grafik: HR va SpO2 vaqt bo‘yicha (Chart.js) */
const RealTimeVitalChart: React.FC<{ vitals: VitalReading[] }> = ({ vitals }) => {
  const chartData = useMemo(() => {
    const sorted = [...vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const labels = sorted.map((v) => new Date(v.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    return {
      labels,
      datasets: [
        { label: 'HR (bpm)', data: sorted.map((v) => v.heart_rate ?? null), borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.1)', tension: 0.3, fill: true },
        { label: 'SpO₂ (%)', data: sorted.map((v) => v.spo2 ?? null), borderColor: 'rgb(34, 211, 238)', backgroundColor: 'rgba(34, 211, 238, 0.1)', tension: 0.3, fill: true },
      ],
    };
  }, [vitals]);
  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
        y: { ticks: { color: '#94a3b8' }, min: 0, max: 150 },
      },
    }),
    []
  );
  if (vitals.length < 2) return null;
  return (
    <div className="h-48 mb-4">
      <Line data={chartData} options={options} />
    </div>
  );
};

/** Solishtirish grafigi: ikki vaqt oralig‘i – 1 va 2 (HR) */
const CompareVitalChart: React.FC<{
  range1: VitalsCompareRangeItem[];
  range2: VitalsCompareRangeItem[];
}> = ({ range1, range2 }) => {
  const chartData = useMemo(() => {
    const s1 = [...range1].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const s2 = [...range2].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const len = Math.max(s1.length, s2.length, 1);
    const pad = <T,>(arr: T[], getVal: (v: T) => number | null): (number | null)[] => {
      const out = arr.map(getVal);
      while (out.length < len) out.push(null);
      return out.slice(0, len);
    };
    return {
      labels: Array.from({ length: len }, (_, i) => String(i + 1)),
      datasets: [
        { label: '1-oraliq HR', data: pad(s1, (v) => v.heart_rate ?? null), borderColor: 'rgb(34, 197, 94)', tension: 0.3 },
        { label: '2-oraliq HR', data: pad(s2, (v) => v.heart_rate ?? null), borderColor: 'rgb(251, 146, 60)', tension: 0.3 },
      ],
    };
  }, [range1, range2]);
  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 } },
        y: { ticks: { color: '#94a3b8' }, min: 0, max: 150 },
      },
    }),
    []
  );
  if (range1.length === 0 && range2.length === 0) return <p className="text-slate-500 text-sm">Ma’lumot yo‘q</p>;
  return (
    <div className="h-48">
      <Line data={chartData} options={options} />
    </div>
  );
};

const PARAM_OPTIONS = [
  { value: 'heart_rate', label: 'Puls (HR)' },
  { value: 'spo2', label: 'SpO2' },
  { value: 'nibp_systolic', label: 'NIBP sistolik' },
  { value: 'nibp_diastolic', label: 'NIBP diastolik' },
  { value: 'respiration_rate', label: 'Nafas' },
];

/** Bitta bemor batafsil ko‘rinishi – vitals, alarms, eslatmalar, audit log, eksport, chegaralar, to‘liq ekran, chiqarish */
const SinglePatientView: React.FC<{
  card: DashboardPatientCard;
  onBack: () => void;
  vitals: VitalReading[];
  alarms: Alarm[];
  notes: MonitoringNoteEntry[];
  auditLog: MonitoringAuditLogEntry[];
  onAckAlarm: (id: number) => void;
  onRefreshNotesAndAudit: () => void;
}> = ({ card, onBack, vitals, alarms, notes, auditLog, onAckAlarm, onRefreshNotesAndAudit }) => {
  const { t } = useTranslation();
  const [fullScreen, setFullScreen] = useState(false);
  const latest = vitals[0] ?? card.last_vital;
  const vitalsForChart = vitals.length ? vitals : card.last_vital ? [card.last_vital] : [];
  const vitalForStatus: VitalLike = latest
    ? { heart_rate: latest.heart_rate, spo2: latest.spo2, nibp_systolic: latest.nibp_systolic, nibp_diastolic: latest.nibp_diastolic }
    : {};
  const { status: singleStatus, reason: singleReason } = getVitalStatus(vitalForStatus);
  const hasCritical = singleStatus === 'critical';
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [thresholds, setThresholds] = useState<AlarmThresholdType[]>([]);
  const [thParam, setThParam] = useState('heart_rate');
  const [thMin, setThMin] = useState('');
  const [thMax, setThMax] = useState('');
  const [thSeverity, setThSeverity] = useState('urgent');
  const [submittingTh, setSubmittingTh] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [staffList, setStaffList] = useState<MonitoringStaffMember[]>([]);
  const [assignedToId, setAssignedToId] = useState<number | null>(card.assigned_to ?? null);
  const [compareRange1From, setCompareRange1From] = useState('');
  const [compareRange1To, setCompareRange1To] = useState('');
  const [compareRange2From, setCompareRange2From] = useState('');
  const [compareRange2To, setCompareRange2To] = useState('');
  const [compareData, setCompareData] = useState<{ range1: VitalsCompareRangeItem[]; range2: VitalsCompareRangeItem[] } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  // Monitoring AI state
  const [aiSectionOpen, setAiSectionOpen] = useState(false);
  const [aiRisk, setAiRisk] = useState<monitoringApi.MonitoringAiRiskScore | null>(null);
  const [aiRiskLoading, setAiRiskLoading] = useState(false);
  const [aiMortality, setAiMortality] = useState<monitoringApi.MonitoringAiMortalityPrediction | null>(null);
  const [aiMortalityLoading, setAiMortalityLoading] = useState(false);
  const [aiDailySummary, setAiDailySummary] = useState<string | null>(null);
  const [aiDailySummaryLoading, setAiDailySummaryLoading] = useState(false);
  const [aiTrend, setAiTrend] = useState<monitoringApi.MonitoringAiTrendPrediction | null>(null);
  const [aiTrendLoading, setAiTrendLoading] = useState(false);
  const [aiEarlyWarning, setAiEarlyWarning] = useState<monitoringApi.MonitoringAiEarlyWarning | null>(null);
  const [aiEarlyWarningLoading, setAiEarlyWarningLoading] = useState(false);
  const [aiSuggestedThresholds, setAiSuggestedThresholds] = useState<monitoringApi.MonitoringAiSuggestThresholds | null>(null);
  const [aiSuggestedThresholdsLoading, setAiSuggestedThresholdsLoading] = useState(false);
  const [alarmExplainId, setAlarmExplainId] = useState<number | null>(null);
  const [alarmExplainText, setAlarmExplainText] = useState<string>('');
  const [draftNoteLoading, setDraftNoteLoading] = useState(false);
  // Quick actions, medications, lab, family view
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [medications, setMedications] = useState<monitoringApi.MonitoringMedicationItem[]>([]);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medScheduled, setMedScheduled] = useState('');
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [labResults, setLabResults] = useState<monitoringApi.MonitoringLabResultItem[]>([]);
  const [labParam, setLabParam] = useState('');
  const [labValue, setLabValue] = useState('');
  const [labUnit, setLabUnit] = useState('');
  const [labSubmitting, setLabSubmitting] = useState(false);
  const [familyTokenLink, setFamilyTokenLink] = useState<string | null>(null);
  const [familyTokenLoading, setFamilyTokenLoading] = useState(false);

  useEffect(() => {
    setAssignedToId(card.assigned_to ?? null);
  }, [card.assigned_to]);
  useEffect(() => {
    monitoringApi.getAlarmThresholds(card.id).then((r) => { if (r.success && r.data) setThresholds(r.data); });
  }, [card.id]);
  useEffect(() => {
    monitoringApi.getMonitoringStaff().then((r) => { if (r.success && r.data) setStaffList(r.data); });
  }, []);
  useEffect(() => {
    monitoringApi.getMedications(card.id).then((r) => { if (r.success && r.data) setMedications(r.data); });
    monitoringApi.getLabResults(card.id).then((r) => { if (r.success && r.data) setLabResults(r.data); });
  }, [card.id]);

  const handleQuickAction = async (actionType: string) => {
    setQuickActionLoading(actionType);
    await monitoringApi.quickAction(card.id, actionType);
    setQuickActionLoading(null);
    onRefreshNotesAndAudit();
  };
  const handleRapidResponse = async () => {
    setQuickActionLoading('rapid_response');
    await monitoringApi.rapidResponse(card.id);
    setQuickActionLoading(null);
    onRefreshNotesAndAudit();
  };
  const handleWardRoundPdf = () => {
    monitoringApi.getWardRoundPdf(card.id).catch(() => {});
  };
  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medScheduled.trim()) return;
    setMedSubmitting(true);
    const res = await monitoringApi.createMedication(card.id, { name: medName.trim(), dose: medDose.trim(), scheduled_at: medScheduled });
    setMedSubmitting(false);
    if (res.success) {
      setMedName('');
      setMedDose('');
      setMedScheduled('');
      const list = await monitoringApi.getMedications(card.id);
      if (list.success && list.data) setMedications(list.data);
    }
  };
  const handleMarkMedicationGiven = async (medId: number) => {
    const res = await monitoringApi.markMedicationGiven(medId);
    if (res.success) setMedications((prev) => prev.map((m) => (m.id === medId ? { ...m, given_at: new Date().toISOString() } : m)));
  };
  const handleAddLabResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labParam.trim() || !labValue.trim()) return;
    setLabSubmitting(true);
    const res = await monitoringApi.createLabResult(card.id, { param: labParam.trim(), value: labValue.trim(), unit: labUnit.trim() });
    setLabSubmitting(false);
    if (res.success) {
      setLabParam('');
      setLabValue('');
      setLabUnit('');
      const list = await monitoringApi.getLabResults(card.id);
      if (list.success && list.data) setLabResults(list.data);
    }
  };
  const handleCreateFamilyToken = async () => {
    setFamilyTokenLoading(true);
    setFamilyTokenLink(null);
    const res = await monitoringApi.createFamilyViewToken(card.id, 24);
    setFamilyTokenLoading(false);
    if (res.success && res.data?.link) setFamilyTokenLink(res.data.link);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    const res = await monitoringApi.createNote(card.id, newNote.trim());
    setSubmittingNote(false);
    if (res.success) {
      setNewNote('');
      onRefreshNotesAndAudit();
    }
  };
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    monitoringApi.exportVitals(card.id, format, card.patient_name || card.bed_label || 'vitals').catch(() => {});
  };
  const handleAssignedChange = async (userId: number | null) => {
    setAssignedToId(userId);
    await monitoringApi.updatePatientMonitor(card.id, { assigned_to: userId });
    onRefreshNotesAndAudit();
  };
  const handleCompare = async () => {
    if (!compareRange1From || !compareRange1To || !compareRange2From || !compareRange2To) return;
    setCompareLoading(true);
    const res = await monitoringApi.getVitalsCompare(card.id, compareRange1From, compareRange1To, compareRange2From, compareRange2To);
    setCompareLoading(false);
    if (res.success && res.data) setCompareData(res.data);
  };
  const handleAddThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTh(true);
    const res = await monitoringApi.createAlarmThreshold({
      patient_monitor: card.id,
      param: thParam,
      min_value: thMin !== '' ? parseInt(thMin, 10) : null,
      max_value: thMax !== '' ? parseInt(thMax, 10) : null,
      severity: thSeverity,
    });
    setSubmittingTh(false);
    if (res.success && res.data) {
      setThresholds((prev) => [...prev, res.data!]);
      setThMin('');
      setThMax('');
      onRefreshNotesAndAudit();
    }
  };
  const handleDischarge = async () => {
    if (!confirm('Bemorni chiqarishni tasdiqlaysizmi? Kravat bo‘sh qilinar.')) return;
    setDischarging(true);
    const res = await monitoringApi.updatePatientMonitor(card.id, { bed_status: 'empty' });
    setDischarging(false);
    if (res.success) onBack();
  };

  const fetchAiRisk = async () => {
    setAiRiskLoading(true);
    setAiRisk(null);
    const res = await monitoringApi.getMonitoringAiRiskScore(card.id);
    setAiRiskLoading(false);
    if (res.success && res.data) setAiRisk(res.data);
  };
  const fetchAiMortality = async () => {
    setAiMortalityLoading(true);
    setAiMortality(null);
    const res = await monitoringApi.getMonitoringAiMortalityPrediction(card.id);
    setAiMortalityLoading(false);
    if (res.success && res.data) setAiMortality(res.data);
  };
  const fetchAiDailySummary = async () => {
    setAiDailySummaryLoading(true);
    setAiDailySummary(null);
    const res = await monitoringApi.getMonitoringAiDailySummary(card.id);
    setAiDailySummaryLoading(false);
    if (res.success && res.data?.summary) setAiDailySummary(res.data.summary);
  };
  const fetchAiTrend = async () => {
    setAiTrendLoading(true);
    setAiTrend(null);
    const res = await monitoringApi.getMonitoringAiTrendPrediction(card.id, { metric: 'spo2', horizon_minutes: 60 });
    setAiTrendLoading(false);
    if (res.success && res.data) setAiTrend(res.data);
  };
  const fetchAiEarlyWarning = async () => {
    setAiEarlyWarningLoading(true);
    setAiEarlyWarning(null);
    const res = await monitoringApi.getMonitoringAiEarlyWarning(card.id);
    setAiEarlyWarningLoading(false);
    if (res.success && res.data) setAiEarlyWarning(res.data);
  };
  const fetchAiSuggestedThresholds = async () => {
    setAiSuggestedThresholdsLoading(true);
    setAiSuggestedThresholds(null);
    const res = await monitoringApi.getMonitoringAiSuggestThresholds(card.id);
    setAiSuggestedThresholdsLoading(false);
    if (res.success && res.data) setAiSuggestedThresholds(res.data);
  };
  const fetchAlarmExplain = async (alarmId: number) => {
    if (alarmExplainId === alarmId && alarmExplainText) return;
    setAlarmExplainId(alarmId);
    setAlarmExplainText('...');
    const res = await monitoringApi.getMonitoringAiExplainAlarm(alarmId);
    setAlarmExplainText(res.success && res.data?.explanation ? res.data.explanation : 'Tushuntirish olinmadi.');
  };
  const fetchDraftNote = async () => {
    setDraftNoteLoading(true);
    const res = await monitoringApi.getMonitoringAiDraftNote(card.id, 'handover');
    setDraftNoteLoading(false);
    if (res.success && res.data?.draft) setNewNote(res.data.draft);
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onFullScreenChange = () => setFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div ref={containerRef} className={`h-full flex flex-col overflow-hidden ${fullScreen ? 'bg-slate-900' : ''}`}>
      {hasCritical && singleReason && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/20 border-2 border-red-500 flex items-center gap-2">
          <AlertTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0" />
          <span className="text-red-200 font-semibold">Kritik: {singleReason}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-blue-400 hover:text-white transition-colors"
        >
          ← {t('back')}
        </button>
        <h2 className="text-lg font-bold text-white">
          {card.patient_name || card.bed_label || `Bemor #${card.id}`}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullScreen}
            className="px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600"
          >
            {fullScreen ? 'Ekrandan chiqish' : 'To‘liq ekran'}
          </button>
          <button
            type="button"
            onClick={handleDischarge}
            disabled={discharging}
            className="px-2 py-1 rounded-lg bg-amber-600 text-white text-xs hover:bg-amber-500 disabled:opacity-50"
          >
            {discharging ? '...' : 'Bemorni chiqarish'}
          </button>
        </div>
        <span className="text-slate-400 text-sm">{card.room_name}</span>
      </div>
      {(card.fall_risk || card.pressure_risk) && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {card.fall_risk && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/30 text-amber-200" title="Yiqilish xavfi">Yiqilish: {card.fall_risk}</span>
          )}
          {card.pressure_risk && (
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/30 text-orange-200" title="Bosim yarasi xavfi">Bosim: {card.pressure_risk}</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-slate-400 text-sm">Mas&apos;ul xodim:</span>
        <select
          value={assignedToId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            handleAssignedChange(v === '' ? null : parseInt(v, 10));
          }}
          className="px-2 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm min-w-[160px]"
        >
          <option value="">— Tanlang —</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
          ))}
        </select>
        <span className="text-slate-500">|</span>
        <button type="button" onClick={() => handleQuickAction('call_doctor')} disabled={!!quickActionLoading} className="px-2 py-1 rounded-lg bg-slate-600 text-slate-200 text-xs hover:bg-slate-500 disabled:opacity-50">Shifokor chaqirish</button>
        <button type="button" onClick={() => handleQuickAction('request_lab')} disabled={!!quickActionLoading} className="px-2 py-1 rounded-lg bg-slate-600 text-slate-200 text-xs hover:bg-slate-500 disabled:opacity-50">Lab so‘rash</button>
        <button type="button" onClick={handleRapidResponse} disabled={!!quickActionLoading} className="px-2 py-1 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500 disabled:opacity-50">Rapid response</button>
        <button type="button" onClick={handleWardRoundPdf} className="px-2 py-1 rounded-lg bg-slate-600 text-slate-200 text-xs hover:bg-slate-500">Ward round PDF</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className={`bg-slate-800/80 rounded-xl p-4 border ${
          (latest?.heart_rate != null && (latest.heart_rate > 130 || latest.heart_rate < 40)) ? 'border-red-500' : 'border-slate-700'
        }`}>
          <p className="text-xs text-slate-400">Puls (HR)</p>
          <p className={`text-2xl font-bold font-mono ${
            (latest?.heart_rate != null && (latest.heart_rate > 130 || latest.heart_rate < 40)) ? 'text-red-400' : 'text-green-400'
          }`}>{latest?.heart_rate ?? '--'} <span className="text-sm font-normal text-slate-400">bpm</span></p>
        </div>
        <div className={`bg-slate-800/80 rounded-xl p-4 border ${(latest?.spo2 ?? 100) < 90 ? 'border-red-500' : 'border-slate-700'}`}>
          <p className="text-xs text-slate-400">SpO₂</p>
          <p className={`text-2xl font-bold font-mono ${(latest?.spo2 ?? 100) < 90 ? 'text-red-400' : 'text-cyan-400'}`}>{latest?.spo2 ?? '--'} <span className="text-sm font-normal text-slate-400">%</span></p>
        </div>
        <div className={`bg-slate-800/80 rounded-xl p-4 border ${
          (latest?.nibp_systolic != null && (latest.nibp_systolic > 180 || latest.nibp_systolic < 90)) ||
          (latest?.nibp_diastolic != null && (latest.nibp_diastolic > 120 || latest.nibp_diastolic < 60)) ? 'border-red-500' : 'border-slate-700'
        }`}>
          <p className="text-xs text-slate-400">Qon bosimi (NIBP)</p>
          <p className={`text-2xl font-bold font-mono ${
            (latest?.nibp_systolic != null && (latest.nibp_systolic > 180 || latest.nibp_systolic < 90)) ||
            (latest?.nibp_diastolic != null && (latest.nibp_diastolic > 120 || latest.nibp_diastolic < 60)) ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {latest?.nibp_systolic ?? '--'}/{latest?.nibp_diastolic ?? '--'} <span className="text-sm font-normal text-slate-400">mm Hg</span>
          </p>
        </div>
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400">Nafas</p>
          <p className="text-2xl font-bold text-white font-mono">{latest?.respiration_rate ?? '--'} <span className="text-sm font-normal text-slate-400">/min</span></p>
        </div>
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400">Harorat</p>
          <p className="text-2xl font-bold text-white font-mono">{latest?.temperature ?? '--'} <span className="text-sm font-normal text-slate-400">°C</span></p>
        </div>
      </div>
      {/* AI tahlil – risk, o'lim bashorati, kunlik xulosa, trend, sepsis, chegaralar */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <button
          type="button"
          onClick={() => setAiSectionOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="text-sm font-bold text-slate-300">AI tahlil (Gemini)</h3>
          <span className="text-slate-500">{aiSectionOpen ? '▼' : '▶'}</span>
        </button>
        {aiSectionOpen && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-600">
                <p className="text-xs text-slate-500 mb-1">Yomonlashuv xavfi</p>
                {aiRisk ? (
                  <p className="text-sm text-white">{aiRisk.risk_level} {aiRisk.score != null ? `(${aiRisk.score})` : ''}. {aiRisk.reason}</p>
                ) : (
                  <button type="button" onClick={fetchAiRisk} disabled={aiRiskLoading} className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                    {aiRiskLoading ? 'Yuklanmoqda...' : 'Yuklash'}
                  </button>
                )}
              </div>
              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-600">
                <p className="text-xs text-slate-500 mb-1">O&apos;lim xavfi bashorati</p>
                {aiMortality ? (
                  <div className="text-sm">
                    <p className="text-amber-200 font-medium">{aiMortality.risk_level} {aiMortality.score != null ? `(${aiMortality.score})` : ''}</p>
                    <p className="text-slate-400">{aiMortality.reason}</p>
                    <p className="text-xs text-slate-500 mt-1">{aiMortality.disclaimer}</p>
                  </div>
                ) : (
                  <button type="button" onClick={fetchAiMortality} disabled={aiMortalityLoading} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
                    {aiMortalityLoading ? 'Yuklanmoqda...' : 'Yuklash'}
                  </button>
                )}
              </div>
            </div>
            <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-600">
              <p className="text-xs text-slate-500 mb-1">Kunlik xulosa (24 soat)</p>
              {aiDailySummary != null ? (
                <p className="text-sm text-slate-300">{aiDailySummary}</p>
              ) : (
                <button type="button" onClick={fetchAiDailySummary} disabled={aiDailySummaryLoading} className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                  {aiDailySummaryLoading ? 'Yuklanmoqda...' : 'Yuklash'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-600">
                <p className="text-xs text-slate-500 mb-1">Trend bashorat (SpO2 keyingi soat)</p>
                {aiTrend ? (
                  <p className="text-sm text-white">{aiTrend.deterioration_risk}. {aiTrend.reason}</p>
                ) : (
                  <button type="button" onClick={fetchAiTrend} disabled={aiTrendLoading} className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                    {aiTrendLoading ? 'Yuklanmoqda...' : 'Yuklash'}
                  </button>
                )}
              </div>
              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-600">
                <p className="text-xs text-slate-500 mb-1">Sepsis / erta ogohlantirish</p>
                {aiEarlyWarning ? (
                  <div className="text-sm">
                    <p className="text-amber-200">{aiEarlyWarning.concern_level}. {aiEarlyWarning.suggested_actions}</p>
                    <p className="text-xs text-slate-500 mt-1">{aiEarlyWarning.disclaimer}</p>
                  </div>
                ) : (
                  <button type="button" onClick={fetchAiEarlyWarning} disabled={aiEarlyWarningLoading} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
                    {aiEarlyWarningLoading ? 'Yuklanmoqda...' : 'Yuklash'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {alarms.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-red-400 mb-2">Alarmlar</h3>
          <ul className="space-y-2">
            {alarms.map((a) => (
              <li
                key={a.id}
                className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{a.param}: {a.value} — {a.severity}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchAlarmExplain(a.id)}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                    >
                      AI tushuntirish
                    </button>
                    {!a.acknowledged_at && (
                      <button
                        type="button"
                        onClick={() => onAckAlarm(a.id)}
                        className="text-xs font-semibold text-blue-400 hover:text-white"
                      >
                        Qabul qilish
                      </button>
                    )}
                  </div>
                </div>
                {alarmExplainId === a.id && alarmExplainText && (
                  <p className="text-xs text-slate-400 border-t border-slate-600/50 pt-2 mt-1">{alarmExplainText}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Real-time grafik (HR, SpO₂)</h3>
        <RealTimeVitalChart vitals={vitalsForChart} />
      </div>
      <div className="rounded-xl bg-slate-800/50 border border-slate-600 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">ECG / to‘lqin (Waveform)</h3>
        <div className="h-24 flex items-center justify-center rounded-lg bg-slate-900/80 border border-slate-600 text-slate-500 text-sm">
          Qurilma ulanganda ECG/SpO₂ to‘lqin ko‘rsatiladi. WebSocket orqali real-time keladi.
        </div>
      </div>
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Alarm chegaralari (bemor uchun)</h3>
        {aiSuggestedThresholds && (
          <div className="mb-3 p-2 rounded-lg bg-slate-900/80 border border-slate-600">
            <p className="text-xs text-slate-500 mb-2">AI taklif: {aiSuggestedThresholds.disclaimer}</p>
            <ul className="space-y-1 text-xs text-slate-400">
              {aiSuggestedThresholds.suggested.map((s, i) => (
                <li key={i} className="flex gap-2 items-center">
                  <span className="text-cyan-400">{s.param}</span>
                  min: {s.min_value ?? '—'} max: {s.max_value ?? '—'}
                  <span className="text-slate-500">{s.reason}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setThParam(s.param);
                      setThMin(s.min_value != null ? String(s.min_value) : '');
                      setThMax(s.max_value != null ? String(s.max_value) : '');
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Qo‘llash
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={fetchAiSuggestedThresholds}
            disabled={aiSuggestedThresholdsLoading}
            className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
          >
            {aiSuggestedThresholdsLoading ? 'Yuklanmoqda...' : 'AI taklif'}
          </button>
        </div>
        <ul className="mb-3 space-y-1 max-h-24 overflow-y-auto text-xs text-slate-400">
          {thresholds.length === 0 && !aiSuggestedThresholds && <li className="text-slate-500">Hozircha chegaralar yo‘q. Quyida qo‘shishingiz mumkin.</li>}
          {thresholds.map((th) => (
            <li key={th.id} className="flex gap-2">
              <span className="text-cyan-400">{th.param}</span>
              {th.min_value != null && <span>min: {th.min_value}</span>}
              {th.max_value != null && <span>max: {th.max_value}</span>}
              <span className="text-amber-400">{th.severity}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddThreshold} className="flex flex-wrap gap-2 items-end">
          <select value={thParam} onChange={(e) => setThParam(e.target.value)} className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm">
            {PARAM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="number" value={thMin} onChange={(e) => setThMin(e.target.value)} placeholder="Min" className="w-16 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          <input type="number" value={thMax} onChange={(e) => setThMax(e.target.value)} placeholder="Max" className="w-16 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          <select value={thSeverity} onChange={(e) => setThSeverity(e.target.value)} className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm">
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="urgent">urgent</option>
            <option value="critical">critical</option>
          </select>
          <button type="submit" disabled={submittingTh} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">Qo‘shish</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => handleExport('csv')} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium">
          CSV
        </button>
        <button type="button" onClick={() => handleExport('excel')} className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium">
          Excel
        </button>
        <button type="button" onClick={() => handleExport('pdf')} className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium">
          PDF
        </button>
      </div>
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Dori vaqtida (Medications)</h3>
        <ul className="mb-3 space-y-1 max-h-32 overflow-y-auto text-xs text-slate-400">
          {medications.length === 0 && <li className="text-slate-500">Hozircha dori yo‘q.</li>}
          {medications.map((m) => (
            <li key={m.id} className="flex gap-2 items-center justify-between py-1 border-b border-slate-700/50">
              <span className="text-white">{m.name} {m.dose}</span>
              <span>{new Date(m.scheduled_at).toLocaleString('uz-UZ')}</span>
              {m.given_at ? <span className="text-green-400">Bajarildi</span> : (
                <button type="button" onClick={() => handleMarkMedicationGiven(m.id)} className="text-cyan-400 hover:text-cyan-300">Bajarildi</button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddMedication} className="flex flex-wrap gap-2 items-end">
          <input type="text" value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Dori nomi" className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm w-32" />
          <input type="text" value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="Doza" className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm w-24" />
          <input type="datetime-local" value={medScheduled} onChange={(e) => setMedScheduled(e.target.value)} className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          <button type="submit" disabled={medSubmitting} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">Qo‘shish</button>
        </form>
      </div>
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Lab natijalari</h3>
        <ul className="mb-3 space-y-1 max-h-32 overflow-y-auto text-xs text-slate-400">
          {labResults.length === 0 && <li className="text-slate-500">Hozircha lab yo‘q.</li>}
          {labResults.map((r) => (
            <li key={r.id} className="flex gap-2 py-1 border-b border-slate-700/50">
              <span className="text-cyan-400">{r.param}</span>
              <span className="text-white">{r.value} {r.unit}</span>
              <span className="text-slate-500">{new Date(r.timestamp).toLocaleString('uz-UZ')}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddLabResult} className="flex flex-wrap gap-2 items-end">
          <input type="text" value={labParam} onChange={(e) => setLabParam(e.target.value)} placeholder="Parametr" className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm w-28" />
          <input type="text" value={labValue} onChange={(e) => setLabValue(e.target.value)} placeholder="Qiymat" className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm w-24" />
          <input type="text" value={labUnit} onChange={(e) => setLabUnit(e.target.value)} placeholder="Birlik" className="px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-white text-sm w-16" />
          <button type="submit" disabled={labSubmitting} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">Qo‘shish</button>
        </form>
      </div>
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Oilaviy ko‘rinish (maxfiy link)</h3>
        <p className="text-xs text-slate-500 mb-2">24 soatlik link yaratish – oila faqat vitals va holatni ko‘radi.</p>
        {familyTokenLink ? (
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" readOnly value={familyTokenLink} className="flex-1 min-w-0 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-300 text-xs" />
            <button type="button" onClick={() => navigator.clipboard?.writeText(familyTokenLink)} className="px-3 py-1.5 rounded bg-slate-600 text-white text-sm">Nusxalash</button>
          </div>
        ) : (
          <button type="button" onClick={handleCreateFamilyToken} disabled={familyTokenLoading} className="px-3 py-1.5 rounded bg-cyan-600 text-white text-sm disabled:opacity-50">
            {familyTokenLoading ? 'Yuklanmoqda...' : 'Link yaratish'}
          </button>
        )}
      </div>
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Vaqt oralig‘ini solishtirish (HR, SpO₂)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs text-slate-500">1-oraliq: dan</label>
            <input type="datetime-local" value={compareRange1From} onChange={(e) => setCompareRange1From(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">1-oraliq: gacha</label>
            <input type="datetime-local" value={compareRange1To} onChange={(e) => setCompareRange1To(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">2-oraliq: dan</label>
            <input type="datetime-local" value={compareRange2From} onChange={(e) => setCompareRange2From(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">2-oraliq: gacha</label>
            <input type="datetime-local" value={compareRange2To} onChange={(e) => setCompareRange2To(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
          </div>
        </div>
        <button type="button" onClick={handleCompare} disabled={compareLoading} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-sm disabled:opacity-50 mb-2">
          {compareLoading ? 'Yuklanmoqda...' : 'Solishtirish'}
        </button>
        {compareData && (
          <div className="mt-2">
            <CompareVitalChart range1={compareData.range1} range2={compareData.range2} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-2">Eslatmalar</h3>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Yangi eslatma..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm mb-2"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchDraftNote}
              disabled={draftNoteLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm disabled:opacity-50"
            >
              {draftNoteLoading ? '...' : 'AI yordamida yozish'}
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={submittingNote || !newNote.trim()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
            >
              {submittingNote ? 'Saqlanmoqda...' : 'Qo‘shish'}
            </button>
          </div>
          <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto text-xs text-slate-400">
            {notes.map((n) => (
              <li key={n.id} className="border-b border-slate-700/50 py-1">
                {n.note} — {n.created_by_name ?? '?'} ({new Date(n.created_at).toLocaleString('uz-UZ')})
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-2">Audit log (amallar)</h3>
          <ul className="space-y-1 max-h-40 overflow-y-auto text-xs text-slate-400">
            {auditLog.map((e) => (
              <li key={e.id} className="border-b border-slate-700/50 py-1">
                <span className="text-cyan-400">{e.action}</span> — {e.user_name ?? '?'} {new Date(e.created_at).toLocaleString('uz-UZ')}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex-1 min-h-0 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Vital tarix (oxirgi 50)</h3>
        <div className="overflow-y-auto max-h-64 text-xs font-mono text-slate-400">
          {vitals.length === 0 && !card.last_vital && <p>Ma’lumot yo‘q</p>}
          {(vitals.length ? vitals : card.last_vital ? [card.last_vital] : []).slice(0, 50).map((v, i) => (
            <div key={v.id || i} className="flex justify-between py-1 border-b border-slate-700/50">
              <span>{new Date(v.timestamp).toLocaleTimeString('uz-UZ')}</span>
              <span>HR {v.heart_rate ?? '--'} | SpO2 {v.spo2 ?? '--'} | AQB {v.nibp_systolic ?? '--'}/{v.nibp_diastolic ?? '--'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Boshqaruv: qanot, palata, qurilma, bemor qo‘shish va biriktirish */
const ManagementView: React.FC<{
  wards: Ward[];
  rooms: Room[];
  devices: Device[];
  patientMonitors: PatientMonitorType[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ wards, rooms, devices, patientMonitors, loading, onRefresh }) => {
  const [tab, setTab] = useState<'wards' | 'rooms' | 'devices' | 'patients'>('wards');
  const [showWardForm, setShowWardForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [wardName, setWardName] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [wardDescription, setWardDescription] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomWardId, setRoomWardId] = useState<string>('');
  const [deviceModel, setDeviceModel] = useState<string>('creative_k12');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceRoomId, setDeviceRoomId] = useState<string>('');
  const [deviceHost, setDeviceHost] = useState('');
  const [devicePort, setDevicePort] = useState('');
  const [patientRoomId, setPatientRoomId] = useState<string>('');
  const [patientDeviceId, setPatientDeviceId] = useState<string>('');
  const [patientBedLabel, setPatientBedLabel] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<string>('');
  const [patientMedicalNotes, setPatientMedicalNotes] = useState('');

  const [editingWardId, setEditingWardId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);

  const assignedDeviceIds = new Set(patientMonitors.map((pm) => pm.device));
  const availableDevices = devices.filter((d) => !assignedDeviceIds.has(d.id));

  const clearWardForm = () => {
    setWardName('');
    setWardCode('');
    setWardDescription('');
    setEditingWardId(null);
    setShowWardForm(false);
  };
  const clearRoomForm = () => {
    setRoomName('');
    setRoomCode('');
    setRoomDescription('');
    setRoomWardId('');
    setEditingRoomId(null);
    setShowRoomForm(false);
  };
  const clearDeviceForm = () => {
    setDeviceModel('creative_k12');
    setDeviceSerial('');
    setDeviceRoomId('');
    setDeviceHost('');
    setDevicePort('');
    setEditingDeviceId(null);
    setShowDeviceForm(false);
  };
  const clearPatientForm = () => {
    setPatientRoomId('');
    setPatientDeviceId('');
    setPatientBedLabel('');
    setPatientName('');
    setPatientAge('');
    setPatientGender('');
    setPatientMedicalNotes('');
    setShowPatientForm(false);
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardName.trim()) return;
    setSubmitting(true);
    setMessage(null);
    const payload = { name: wardName.trim(), code: wardCode.trim() || undefined, description: wardDescription.trim() || undefined };
    const res = editingWardId
      ? await monitoringApi.updateWard(editingWardId, payload)
      : await monitoringApi.createWard(payload);
    setSubmitting(false);
    if (res.success) {
      setMessage({ type: 'ok', text: editingWardId ? 'Qanot yangilandi.' : 'Qanot qo‘shildi.' });
      clearWardForm();
      onRefresh();
    } else {
      setMessage({ type: 'err', text: res.error?.message || 'Xatolik' });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setSubmitting(true);
    setMessage(null);
    const payload = {
      name: roomName.trim(),
      code: roomCode.trim() || undefined,
      description: roomDescription.trim() || undefined,
      ward: roomWardId ? parseInt(roomWardId, 10) : undefined,
    };
    const res = editingRoomId
      ? await monitoringApi.updateRoom(editingRoomId, payload)
      : await monitoringApi.createRoom(payload);
    setSubmitting(false);
    if (res.success) {
      setMessage({ type: 'ok', text: editingRoomId ? 'Palata yangilandi.' : 'Palata qo‘shildi va qanotga biriktirildi.' });
      clearRoomForm();
      onRefresh();
    } else {
      setMessage({ type: 'err', text: res.error?.message || 'Xatolik' });
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceSerial.trim() && !editingDeviceId) return;
    setSubmitting(true);
    setMessage(null);
    if (editingDeviceId) {
      const res = await monitoringApi.updateDevice(editingDeviceId, {
        room: deviceRoomId ? parseInt(deviceRoomId, 10) : null,
        host: deviceHost.trim() || undefined,
        port: devicePort.trim() ? parseInt(devicePort, 10) || null : null,
      });
      setSubmitting(false);
      if (res.success) {
        setMessage({ type: 'ok', text: 'Qurilma yangilandi.' });
        clearDeviceForm();
        onRefresh();
      } else {
        setMessage({ type: 'err', text: res.error?.message || 'Xatolik' });
      }
      return;
    }
    const res = await monitoringApi.registerDevice({
      model: deviceModel,
      serial_number: deviceSerial.trim(),
      room: deviceRoomId ? parseInt(deviceRoomId, 10) : null,
      host: deviceHost.trim() || undefined,
      port: devicePort.trim() ? parseInt(devicePort, 10) || null : null,
    });
    setSubmitting(false);
    if (res.success) {
      setMessage({ type: 'ok', text: 'Qurilma ro‘yxatdan o‘tkazildi va palataga biriktirildi.' });
      clearDeviceForm();
      onRefresh();
    } else {
      setMessage({ type: 'err', text: res.error?.message || 'Xatolik' });
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientRoomId || !patientDeviceId) return;
    setSubmitting(true);
    setMessage(null);
    const res = await monitoringApi.createPatientMonitor({
      room: parseInt(patientRoomId, 10),
      device: parseInt(patientDeviceId, 10),
      bed_label: patientBedLabel.trim() || undefined,
      patient_name: patientName.trim() || undefined,
      age: patientAge.trim() ? parseInt(patientAge, 10) : undefined,
      gender: patientGender.trim() || undefined,
      medical_notes: patientMedicalNotes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      setMessage({ type: 'ok', text: 'Bemor qo‘shildi va palata/qurilmaga biriktirildi.' });
      clearPatientForm();
      onRefresh();
    } else {
      setMessage({ type: 'err', text: res.error?.message || 'Xatolik' });
    }
  };

  const tabs = [
    { id: 'wards' as const, label: 'Qanotlar' },
    { id: 'rooms' as const, label: 'Xonalar (palatalar)' },
    { id: 'devices' as const, label: 'Qurilmalar (monitorlar)' },
    { id: 'patients' as const, label: 'Bemorlar' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 pb-3">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === id ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm ${message.type === 'ok' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <SpinnerIcon className="w-8 h-8 text-blue-400" />
        </div>
      ) : (
        <>
          {tab === 'wards' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Qanotlar ro‘yxati</h2>
                <button
                  type="button"
                  onClick={() => { setEditingWardId(null); clearWardForm(); setShowWardForm(true); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  + Qanot qo‘shish
                </button>
              </div>
              {showWardForm && (
                <form onSubmit={handleCreateWard} className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-600 space-y-3">
                  <input
                    type="text"
                    value={wardName}
                    onChange={(e) => setWardName(e.target.value)}
                    placeholder="Qanot nomi *"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    required
                  />
                  <input
                    type="text"
                    value={wardCode}
                    onChange={(e) => setWardCode(e.target.value)}
                    placeholder="Kod (ixtiyoriy)"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <textarea
                    value={wardDescription}
                    onChange={(e) => setWardDescription(e.target.value)}
                    placeholder="Tavsif (ixtiyoriy)"
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                      {submitting ? 'Saqlanmoqda...' : editingWardId ? 'Saqlash' : 'Saqlash'}
                    </button>
                    <button type="button" onClick={clearWardForm} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm">
                      Bekor qilish
                    </button>
                  </div>
                </form>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Nomi</th>
                      <th className="px-4 py-3">Kod</th>
                      <th className="px-4 py-3">Tavsif</th>
                      <th className="px-4 py-3 w-32">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {wards.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Qanotlar yo‘q. Qanot qo‘shing (masalan: ICU, Operatsiona).</td></tr>
                    )}
                    {wards.map((w) => (
                      <tr key={w.id} className="border-t border-slate-700">
                        <td className="px-4 py-3 font-medium">{w.name}</td>
                        <td className="px-4 py-3">{w.code || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{w.description || '—'}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => { setEditingWardId(w.id); setWardName(w.name); setWardCode(w.code || ''); setWardDescription(w.description || ''); setShowWardForm(true); }} className="text-blue-400 hover:text-blue-300 text-sm mr-2">Tahrirlash</button>
                          <button type="button" onClick={() => { if (window.confirm("Ushbu qanotni o'chirishni xohlaysizmi?")) monitoringApi.deleteWard(w.id).then(() => onRefresh()); }} className="text-red-400 hover:text-red-300 text-sm">O'chirish</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'rooms' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Xonalar (palatalar) ro‘yxati</h2>
                <button
                  type="button"
                  onClick={() => { setEditingRoomId(null); clearRoomForm(); setShowRoomForm(true); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  + Palata qo‘shish
                </button>
              </div>
              {showRoomForm && (
                <form onSubmit={handleCreateRoom} className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-600 space-y-3">
                  <select
                    value={roomWardId}
                    onChange={(e) => setRoomWardId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="">Qanot tanlang (ixtiyoriy)</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Xona (palata) nomi *"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                    required
                  />
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="Kod (ixtiyoriy)"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <textarea
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="Tavsif (ixtiyoriy)"
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                      {submitting ? 'Saqlanmoqda...' : editingRoomId ? 'Saqlash' : 'Saqlash'}
                    </button>
                    <button type="button" onClick={clearRoomForm} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm">
                      Bekor qilish
                    </button>
                  </div>
                </form>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Nomi</th>
                      <th className="px-4 py-3">Qanot</th>
                      <th className="px-4 py-3">Kod</th>
                      <th className="px-4 py-3">Tavsif</th>
                      <th className="px-4 py-3 w-32">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {rooms.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Xonalar yo‘q. Avval qanot (ixtiyoriy) va palata qo‘shing.</td></tr>
                    )}
                    {rooms.map((r) => (
                      <tr key={r.id} className="border-t border-slate-700">
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3">{r.ward_name ?? '—'}</td>
                        <td className="px-4 py-3">{r.code || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{r.description || '—'}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => { setEditingRoomId(r.id); setRoomName(r.name); setRoomCode(r.code || ''); setRoomDescription(r.description || ''); setRoomWardId(r.ward != null ? String(r.ward) : ''); setShowRoomForm(true); }} className="text-blue-400 hover:text-blue-300 text-sm mr-2">Tahrirlash</button>
                          <button type="button" onClick={() => { if (window.confirm("Ushbu palatani o'chirishni xohlaysizmi?")) monitoringApi.deleteRoom(r.id).then(() => onRefresh()); }} className="text-red-400 hover:text-red-300 text-sm">O'chirish</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'devices' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Qurilmalar (monitorlar)</h2>
                <button
                  type="button"
                  onClick={() => { setEditingDeviceId(null); clearDeviceForm(); setShowDeviceForm(true); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  + Qurilma qo‘shish
                </button>
              </div>
              <div className="mb-4 p-4 bg-slate-800/80 border border-slate-600 rounded-lg text-slate-300 text-sm">
                <p className="font-medium text-amber-200 mb-1">Haqiqiy ma&apos;lumot olish uchun (demo/mock yo&apos;q):</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li><strong>Gateway</strong> serverda ishlashi kerak (port 9000). Deploy qilganda avtomatik ishga tushadi.</li>
                  <li><strong>HL7 rejim (K12 sizga ulanadi):</strong> Qurilma qo&apos;shishda IP va Portni <strong>bo&apos;sh</strong> qoldiring. K12 da Sozlamalar → Tarmoq: <strong>Server IP</strong> = 167.71.53.238, <strong>Port</strong> = 6006. Saqlang.</li>
                  <li><strong>TCP rejim:</strong> Quyida IP va Port kiriting. Gateway va qurilma bir tarmoqda bo&apos;lishi kerak.</li>
                  <li>Qurilma qo&apos;shilgach serverda: <code className="bg-slate-700 px-1 rounded">sudo systemctl restart medoraai-gateway-9000</code></li>
                </ol>
              </div>
              {showDeviceForm && (
                <form onSubmit={handleRegisterDevice} className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-600 space-y-3">
                  <select
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    disabled={!!editingDeviceId}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white disabled:opacity-70"
                  >
                    <option value="creative_k12">Creative Medical K12</option>
                    <option value="hl7_generic">HL7 Generic</option>
                    <option value="other">Boshqa</option>
                  </select>
                  <div>
                    <input
                      type="text"
                      value={deviceSerial}
                      onChange={(e) => setDeviceSerial(e.target.value)}
                      placeholder="Seriya raqami * (masalan K12_01 yoki monitor seriyasi)"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 disabled:opacity-70"
                      required={!editingDeviceId}
                      readOnly={!!editingDeviceId}
                    />
                    <p className="mt-1 text-xs text-slate-500">Gateway (HL7) dan keladigan device_id shu seriya bilan mos bo‘lishi kerak.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">IP manzil (TCP ulanish)</label>
                      <input
                        type="text"
                        value={deviceHost}
                        onChange={(e) => setDeviceHost(e.target.value)}
                        placeholder="masalan 192.168.1.10"
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Port</label>
                      <input
                        type="text"
                        value={devicePort}
                        onChange={(e) => setDevicePort(e.target.value)}
                        placeholder="5000"
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                      />
                    </div>
                  </div>
                  <select
                    value={deviceRoomId}
                    onChange={(e) => setDeviceRoomId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="">Palata tanlanmagan</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                      {submitting ? 'Saqlanmoqda...' : editingDeviceId ? 'Saqlash' : 'Qo‘shish'}
                    </button>
                    <button type="button" onClick={clearDeviceForm} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm">
                      Bekor qilish
                    </button>
                  </div>
                </form>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Seriya</th>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">IP / Port</th>
                      <th className="px-4 py-3">Palata</th>
                      <th className="px-4 py-3">Holat</th>
                      <th className="px-4 py-3 w-32">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {devices.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Qurilmalar yo‘q. Qurilma qo‘shing.</td></tr>
                    )}
                    {devices.map((d) => (
                      <tr key={d.id} className="border-t border-slate-700">
                        <td className="px-4 py-3 font-mono">{d.serial_number}</td>
                        <td className="px-4 py-3">{d.model === 'creative_k12' ? 'K12' : d.model}</td>
                        <td className="px-4 py-3 text-slate-400">{d.host && d.port ? `${d.host}:${d.port}` : '—'}</td>
                        <td className="px-4 py-3">{d.room_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={(d.effective_status ?? d.status) === 'online' ? 'text-green-400' : 'text-slate-400'}>{(d.effective_status ?? d.status)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => { setEditingDeviceId(d.id); setDeviceSerial(d.serial_number); setDeviceModel(d.model); setDeviceRoomId(d.room != null ? String(d.room) : ''); setDeviceHost(d.host || ''); setDevicePort(d.port != null ? String(d.port) : ''); setShowDeviceForm(true); }} className="text-blue-400 hover:text-blue-300 text-sm mr-2">Tahrirlash</button>
                          <button type="button" onClick={() => { if (window.confirm("Ushbu qurilmani o'chirishni xohlaysizmi?")) monitoringApi.deleteDevice(d.id).then(() => onRefresh()); }} className="text-red-400 hover:text-red-300 text-sm">O'chirish</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'patients' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Bemorlar (palata + qurilma)</h2>
                <button
                  type="button"
                  onClick={() => setShowPatientForm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  + Bemor qo‘shish
                </button>
              </div>
              {showPatientForm && (
                <form onSubmit={handleCreatePatient} className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-600 space-y-3">
                  <select
                    value={patientRoomId}
                    onChange={(e) => setPatientRoomId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    required
                  >
                    <option value="">Palatani tanlang *</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <select
                    value={patientDeviceId}
                    onChange={(e) => setPatientDeviceId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    required
                  >
                    <option value="">Qurilmani tanlang *</option>
                    {availableDevices.map((d) => (
                      <option key={d.id} value={d.id}>{d.serial_number} {d.room_name ? `(${d.room_name})` : ''}</option>
                    ))}
                    {availableDevices.length === 0 && <option value="" disabled>Bepul qurilma yo‘q</option>}
                  </select>
                  <input
                    type="text"
                    value={patientBedLabel}
                    onChange={(e) => setPatientBedLabel(e.target.value)}
                    placeholder="Kravat/joy (ixtiyoriy)"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Bemor ismi (ixtiyoriy)"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <input
                    type="number"
                    min={0}
                    max={150}
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="Yoshi (ixtiyoriy)"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="">Jinsi (ixtiyoriy)</option>
                    <option value="M">Erkak</option>
                    <option value="F">Ayol</option>
                    <option value="other">Boshqa</option>
                  </select>
                  <textarea
                    value={patientMedicalNotes}
                    onChange={(e) => setPatientMedicalNotes(e.target.value)}
                    placeholder="Tibbiy eslatma (ixtiyoriy)"
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting || availableDevices.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                      {submitting ? 'Saqlanmoqda...' : 'Bemorni biriktirish'}
                    </button>
                    <button type="button" onClick={clearPatientForm} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm">
                      Bekor qilish
                    </button>
                  </div>
                </form>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Bemor</th>
                      <th className="px-4 py-3">Yosh</th>
                      <th className="px-4 py-3">Jins</th>
                      <th className="px-4 py-3">Kravat</th>
                      <th className="px-4 py-3">Palata</th>
                      <th className="px-4 py-3">Qurilma</th>
                      <th className="px-4 py-3 w-28">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {patientMonitors.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Bemorlar yo‘q. Bemor qo‘shib, palata va qurilmaga birikting.</td></tr>
                    )}
                    {patientMonitors.map((pm) => (
                      <tr key={pm.id} className="border-t border-slate-700">
                        <td className="px-4 py-3 font-medium">{pm.patient_name || '—'}</td>
                        <td className="px-4 py-3">{pm.age != null ? pm.age : '—'}</td>
                        <td className="px-4 py-3">{pm.gender === 'M' ? 'Erkak' : pm.gender === 'F' ? 'Ayol' : pm.gender || '—'}</td>
                        <td className="px-4 py-3">{pm.bed_label || '—'}</td>
                        <td className="px-4 py-3">{pm.room_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{pm.device_serial}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => { if (window.confirm("Ushbu bemor/kravatni o'chirishni xohlaysizmi?")) monitoringApi.deletePatientMonitor(pm.id).then(() => onRefresh()); }} className="text-red-400 hover:text-red-300 text-sm">O'chirish</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'dashboard' | 'management'>(() =>
    (user?.role === 'doctor' ? 'management' : 'dashboard')
  );
  const [cards, setCards] = useState<DashboardPatientCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<DashboardPatientCard | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notes, setNotes] = useState<MonitoringNoteEntry[]>([]);
  const [auditLog, setAuditLog] = useState<MonitoringAuditLogEntry[]>([]);

  const [wards, setWards] = useState<Ward[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [patientMonitors, setPatientMonitors] = useState<PatientMonitorType[]>([]);
  const [managementLoading, setManagementLoading] = useState(false);
  const [liveVitals, setLiveVitals] = useState<Record<string, LiveVitalPayload>>({});
  const [dashboardLayout, setDashboardLayout] = useState<'grid' | 'wards'>('grid');
  const [gridColumns, setGridColumns] = useState<4 | 6 | 8 | 12>(4);
  const [dashboardSummary, setDashboardSummary] = useState<{ total_beds: number; critical_count: number; warning_count: number } | null>(null);
  const [filterRoomId, setFilterRoomId] = useState<string>('');
  const [filterWardId, setFilterWardId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  /** Tartib: prioritet (kritik birinchi), xona, ism */
  const [sortBy, setSortBy] = useState<'priority' | 'room' | 'name'>('priority');
  const [alarmMuted, setAlarmMuted] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('monitoring_mute_alarm') === '1'
  );
  const [statsOpen, setStatsOpen] = useState(false);
  const [vitalsHelpDismissed, setVitalsHelpDismissed] = useState(false);
  const [bedForecast, setBedForecast] = useState<monitoringApi.BedForecastData | null>(null);
  const [alarmStats, setAlarmStats] = useState<monitoringApi.AlarmResponseStatsData | null>(null);
  const [alarmHeatmap, setAlarmHeatmap] = useState<monitoringApi.AlarmHeatmapItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const toggleAlarmMute = useCallback(() => {
    const next = !alarmMuted;
    setAlarmMuted(next);
    try { localStorage.setItem('monitoring_mute_alarm', next ? '1' : '0'); } catch { /* ignore */ }
  }, [alarmMuted]);

  const fetchManagement = useCallback(async () => {
    setManagementLoading(true);
    const [wRes, rRes, dRes, pRes] = await Promise.all([
      monitoringApi.getWards(),
      monitoringApi.getRooms(),
      monitoringApi.getDevices(),
      monitoringApi.getPatientMonitors(),
    ]);
    if (wRes.success && wRes.data) setWards(wRes.data);
    if (rRes.success && rRes.data) setRooms(rRes.data);
    if (dRes.success && dRes.data) setDevices(dRes.data);
    if (pRes.success && pRes.data) setPatientMonitors(pRes.data);
    setManagementLoading(false);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    const params: { room_id?: string; ward_id?: string; status?: 'critical' | 'warning' | 'normal'; search?: string } = {};
    if (filterRoomId) params.room_id = filterRoomId;
    if (filterWardId) params.ward_id = filterWardId;
    if (filterStatus === 'critical' || filterStatus === 'warning' || filterStatus === 'normal') params.status = filterStatus;
    if (filterSearch.trim()) params.search = filterSearch.trim();
    const res = await monitoringApi.getDashboardSummary(params);
    if (res.success && res.data !== undefined) {
      setCards(Array.isArray(res.data) ? res.data : []);
      const sum = (res as unknown as { summary?: { total_beds: number; critical_count: number; warning_count: number } }).summary;
      setDashboardSummary(sum ?? null);
      setError(null);
    } else {
      setCards([]);
      setDashboardSummary(null);
      setError(res.error?.message || 'Ma’lumotlarni yuklashda xatolik');
    }
    setLoading(false);
  }, [filterRoomId, filterWardId, filterStatus, filterSearch]);

  /** Kartochkalar tartibi: prioritet (kritik → ogohlantirish → normal), xona, ism */
  const sortedCards = useMemo(() => {
    const list = [...cards];
    if (sortBy === 'priority') {
      const order = (c: DashboardPatientCard) => {
        const st = c.vital_status ?? 'normal';
        const priority = st === 'critical' ? 0 : st === 'warning' ? 1 : 2;
        const ews = c.ews_score ?? 0;
        return priority * 1000 - c.unack_alarm_count * 100 - ews;
      };
      list.sort((a, b) => order(a) - order(b));
    } else if (sortBy === 'room') {
      list.sort((a, b) => (a.room_name || '').localeCompare(b.room_name || '') || (a.bed_label || '').localeCompare(b.bed_label || ''));
    } else {
      list.sort((a, b) => (a.patient_name || a.bed_label || '').localeCompare(b.patient_name || b.bed_label || ''));
    }
    return list;
  }, [cards, sortBy]);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  useEffect(() => {
    if (viewMode === 'management') fetchManagement();
  }, [viewMode, fetchManagement]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const [bf, ast, heat] = await Promise.all([
      monitoringApi.getBedForecast(),
      monitoringApi.getAlarmResponseStats(filterWardId ? { ward_id: filterWardId } : undefined),
      monitoringApi.getAlarmHeatmap(),
    ]);
    if (bf.success && bf.data) setBedForecast(bf.data);
    if (ast.success && ast.data) setAlarmStats(ast.data);
    if (heat.success && heat.data) setAlarmHeatmap(heat.data);
    setStatsLoading(false);
  }, [filterWardId]);
  useEffect(() => {
    if (statsOpen) fetchStats();
  }, [statsOpen, fetchStats]);

  useEffect(() => {
    if (viewMode === 'dashboard') {
      monitoringApi.getWards().then((r) => { if (r.success && r.data) setWards(r.data); });
      monitoringApi.getRooms().then((r) => { if (r.success && r.data) setRooms(r.data); });
    }
  }, [viewMode]);

  const lastBeepAt = React.useRef<number>(0);
  const BEEP_THROTTLE_MS = 25000;
  useEffect(() => {
    let hasCritical = false;
    let hasWarning = false;
    for (const card of cards) {
      const v = liveVitals[card.device_serial]
        ? {
            heart_rate: liveVitals[card.device_serial].heart_rate ?? null,
            spo2: liveVitals[card.device_serial].spo2 ?? null,
            nibp_systolic: liveVitals[card.device_serial].bp_sys ?? liveVitals[card.device_serial].nibp_systolic ?? null,
            nibp_diastolic: liveVitals[card.device_serial].bp_dia ?? liveVitals[card.device_serial].nibp_diastolic ?? null,
          }
        : card.last_vital
          ? {
              heart_rate: card.last_vital.heart_rate ?? null,
              spo2: card.last_vital.spo2 ?? null,
              nibp_systolic: card.last_vital.nibp_systolic ?? null,
              nibp_diastolic: card.last_vital.nibp_diastolic ?? null,
            }
          : {};
      const s = getVitalStatus(v).status;
      if (s === 'critical' || card.unack_alarm_count > 0) hasCritical = true;
      else if (s === 'warning') hasWarning = true;
    }
    const muted = typeof localStorage !== 'undefined' && localStorage.getItem('monitoring_mute_alarm') === '1';
    if (muted) return;
    const now = Date.now();
    if (now - lastBeepAt.current < BEEP_THROTTLE_MS) return;
    const freq = hasCritical ? 880 : hasWarning ? 440 : 0;
    if (freq === 0) return;
    lastBeepAt.current = now;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (hasCritical ? 0.35 : 0.25));
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + (hasCritical ? 0.35 : 0.25));
    } catch {
      // ignore if AudioContext not allowed (e.g. autoplay policy)
    }
  }, [cards, liveVitals]);

  const wsUrl = typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_MONITORING_WS_URL?: string } }).env?.VITE_MONITORING_WS_URL;
  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveVitalPayload;
        if (data.device_id) {
          setLiveVitals((prev) => ({ ...prev, [data.device_id]: data }));
        }
      } catch {
        // ignore
      }
    };
    ws.onclose = () => {
      setLiveVitals((prev) => (Object.keys(prev).length ? prev : {}));
    };
    return () => ws.close();
  }, [wsUrl]);

  useEffect(() => {
    if (!selectedCard) return;
    let cancelled = false;
    (async () => {
      const [vRes, aRes, nRes, auditRes] = await Promise.all([
        monitoringApi.getVitals({ patient_monitor_id: String(selectedCard.id), limit: 100 }),
        monitoringApi.getAlarms({ patient_monitor_id: String(selectedCard.id), acknowledged: 'false' }),
        monitoringApi.getNotes(selectedCard.id),
        monitoringApi.getAuditLog({ patient_monitor_id: String(selectedCard.id) }),
      ]);
      if (!cancelled) {
        setVitals(vRes.success && vRes.data ? vRes.data : []);
        setAlarms(aRes.success && aRes.data ? aRes.data : []);
        setNotes(nRes.success && nRes.data ? nRes.data : []);
        setAuditLog(auditRes.success && auditRes.data ? auditRes.data : []);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCard]);

  const handleAckAlarm = async (alarmId: number) => {
    const res = await monitoringApi.acknowledgeAlarm(alarmId);
    if (res.success && selectedCard) {
      const [aRes, auditRes] = await Promise.all([
        monitoringApi.getAlarms({ patient_monitor_id: String(selectedCard.id), acknowledged: 'false' }),
        monitoringApi.getAuditLog({ patient_monitor_id: String(selectedCard.id) }),
      ]);
      if (aRes.success && aRes.data) setAlarms(aRes.data);
      if (auditRes.success && auditRes.data) setAuditLog(auditRes.data);
    }
  };

  const refreshNotesAndAudit = useCallback(async () => {
    if (!selectedCard) return;
    const [nRes, auditRes] = await Promise.all([
      monitoringApi.getNotes(selectedCard.id),
      monitoringApi.getAuditLog({ patient_monitor_id: String(selectedCard.id) }),
    ]);
    if (nRes.success && nRes.data) setNotes(nRes.data);
    if (auditRes.success && auditRes.data) setAuditLog(auditRes.data);
  }, [selectedCard]);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <header className="flex-none flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700 shadow-lg flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <MonitorIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bemor Monitoring</h1>
            <p className="text-xs text-slate-400">Markazlashgan platforma v2.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setViewMode('management')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'management' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            Boshqaruv
          </button>
          <span className="text-sm text-slate-400 hidden sm:inline">{user.name}</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm font-semibold text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/10"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {!getAuthToken() && user?.role === 'monitoring' ? (
          <div className="max-w-md mx-auto mt-12 p-6 rounded-2xl bg-slate-800/80 border border-amber-500/50 text-center">
            <p className="text-amber-200 font-medium mb-2">Backend orqali kirish talab qilinadi</p>
            <p className="text-slate-400 text-sm mb-4">
              Monitoring ishlatish uchun avval backend ishlayotgan bo‘lishi va siz backend orqali (telefon + parol) kiringan bo‘lishingiz kerak. Lokal sessiya bilan dashboard ishlamaydi.
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold"
            >
              Chiqish va qayta kirish
            </button>
          </div>
        ) : viewMode === 'management' ? (
          <ManagementView
            wards={wards}
            rooms={rooms}
            devices={devices}
            patientMonitors={patientMonitors}
            loading={managementLoading}
            onRefresh={fetchManagement}
          />
        ) : selectedCard ? (
          <SinglePatientView
            card={selectedCard}
            onBack={() => setSelectedCard(null)}
            vitals={vitals}
            alarms={alarms}
            notes={notes}
            auditLog={auditLog}
            onAckAlarm={handleAckAlarm}
            onRefreshNotesAndAudit={refreshNotesAndAudit}
          />
        ) : (
          <>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <SpinnerIcon className="w-8 h-8 text-blue-400" />
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-sm flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-0">
                  {error}
                  <span className="block mt-1 text-amber-300/90 text-xs">
                    {error.includes('Internet') || error.includes('aloqa') || error.includes('Failed to fetch')
                      ? 'Backend ishlamayapti yoki manzil noto‘g‘ri. Backend ni ishga tushiring va qayta yuklang.'
                      : 'Backend va hisobingiz (monitoring ruxsati) ni tekshiring yoki administrator bilan bog‘laning.'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => { setLoading(true); fetchDashboard(); }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold whitespace-nowrap"
                >
                  Qayta yuklash
                </button>
              </div>
            )}
            {!loading && (
              <>
                {dashboardSummary != null && (
                  <div className="flex flex-wrap items-center gap-4 mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-600">
                    <span className="text-slate-300 font-medium">Jami: <span className="text-white">{dashboardSummary.total_beds}</span> kravat</span>
                    <span className="text-amber-400 font-medium">Ogohlantirish: <span className="font-bold">{dashboardSummary.warning_count}</span></span>
                    <span className="text-red-400 font-medium">Kritik: <span className="font-bold">{dashboardSummary.critical_count}</span></span>
                    <button
                      type="button"
                      onClick={() => monitoringApi.getShiftReportPdf(filterWardId ? parseInt(filterWardId, 10) : undefined).catch(() => {})}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-600 text-slate-200 hover:bg-slate-500"
                    >
                      Shift hisoboti (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={toggleAlarmMute}
                      className={`ml-auto px-3 py-1.5 rounded-lg text-sm font-medium ${alarmMuted ? 'bg-amber-600/80 text-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`}
                    >
                      {alarmMuted ? 'Alarm ovoz yoqilgan' : 'Alarm ovoz o‘chirish'}
                    </button>
                  </div>
                )}
                {sortedCards.length > 0 && !vitalsHelpDismissed && !sortedCards.some((c) => c.last_vital && (c.last_vital.heart_rate != null || c.last_vital.spo2 != null)) && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-900/30 border border-amber-600/50 text-amber-200 text-sm flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <strong>Vitals hali ko‘rinmayapti.</strong> Agar Server IP, Port va Qurilmalarni kiritgan bo‘lsangiz: Gateway ishlayaptimi (port 9000 va 6006)? Qurilma seriyasi monitordagi bilan bir xilmi? Bemor monitori qurilmaga biriktirilganmi? Backend (8000) va gateway loglarini tekshiring.
                    </div>
                    <button
                      type="button"
                      onClick={() => setVitalsHelpDismissed(true)}
                      className="shrink-0 px-2 py-1 rounded bg-amber-700/50 hover:bg-amber-600/50 text-amber-100 text-xs font-medium"
                    >
                      Yopish
                    </button>
                  </div>
                )}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setStatsOpen((o) => !o)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >
                    {statsOpen ? '▼' : '▶'} Kravat bandligi va alarm stat
                  </button>
                  {statsOpen && (
                    <div className="mt-2 p-4 rounded-xl bg-slate-800/80 border border-slate-600 flex flex-wrap gap-6">
                      {statsLoading ? (
                        <span className="text-slate-400">Yuklanmoqda...</span>
                      ) : (
                        <>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Kravat bandligi</p>
                            <p className="text-white font-medium">Bo‘sh: {bedForecast?.empty_now?.length ?? 0} · Band: {bedForecast?.occupied_count ?? 0}</p>
                            {bedForecast?.empty_now?.length ? (
                              <ul className="mt-1 text-sm text-slate-400">
                                {bedForecast.empty_now.slice(0, 8).map((b) => (
                                  <li key={b.id}>{b.room_name} – {b.bed_label}</li>
                                ))}
                                {bedForecast.empty_now.length > 8 && <li>… +{bedForecast.empty_now.length - 8}</li>}
                              </ul>
                            ) : null}
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Alarmga o‘rtacha javob vaqti</p>
                            <p className="text-white font-medium">
                              {alarmStats?.avg_response_seconds != null ? `${Math.round(alarmStats.avg_response_seconds)} s` : '—'}
                              {alarmStats?.sample_count != null && alarmStats.sample_count > 0 ? ` (n=${alarmStats.sample_count})` : ''}
                            </p>
                          </div>
                          <div className="min-w-[200px]">
                            <p className="text-xs text-slate-500 mb-1">Alarm heatmap (xona / soat)</p>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
                              {alarmHeatmap.slice(0, 24).map((h, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1 py-0.5 rounded"
                                  style={{ backgroundColor: h.count > 5 ? 'rgba(239,68,68,0.5)' : h.count > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(71,85,105,0.5)' }}
                                  title={`${h.room} ${h.hour}:00 – ${h.count}`}
                                >
                                  {h.room.slice(0, 2)} {h.hour}
                                </span>
                              ))}
                              {alarmHeatmap.length > 24 && <span className="text-slate-500">+{alarmHeatmap.length - 24}</span>}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Bemor / kravat qidirish..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-sm w-48"
                  />
                  <select
                    value={filterWardId}
                    onChange={(e) => setFilterWardId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
                  >
                    <option value="">Barcha qanotlar</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterRoomId}
                    onChange={(e) => setFilterRoomId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
                  >
                    <option value="">Barcha palatalar</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
                  >
                    <option value="">Barcha holat</option>
                    <option value="critical">Kritik</option>
                    <option value="warning">Ogohlantirish</option>
                    <option value="normal">Normal</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'priority' | 'room' | 'name')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
                    title="Tartib"
                  >
                    <option value="priority">Tartib: Prioritet</option>
                    <option value="room">Tartib: Palata</option>
                    <option value="name">Tartib: Ism</option>
                  </select>
                  <div className="flex rounded-lg overflow-hidden border border-slate-600">
                    <button
                      type="button"
                      onClick={() => setDashboardLayout('grid')}
                      className={`px-3 py-1.5 text-sm font-medium ${dashboardLayout === 'grid' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardLayout('wards')}
                      className={`px-3 py-1.5 text-sm font-medium ${dashboardLayout === 'wards' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      Palatalar
                    </button>
                  </div>
                  <span className="text-slate-500 text-xs">Kolonkalar:</span>
                  {([4, 6, 8, 12] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setGridColumns(n)}
                      className={`px-2 py-1 text-xs font-medium rounded ${gridColumns === n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {dashboardLayout === 'wards' ? (
                  <div className="space-y-8">
                    {Array.from(
                      sortedCards.reduce((acc, card) => {
                        const key = card.room_name || 'Boshqa';
                        if (!acc.has(key)) acc.set(key, []);
                        acc.get(key)!.push(card);
                        return acc;
                      }, new Map<string, DashboardPatientCard[]>()).entries()
                    ).map(([roomName, roomCards]) => (
                      <div key={roomName}>
                        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                          <span className="w-2 h-6 rounded bg-blue-500" />
                          Palata: {roomName}
                        </h2>
                        <div className={`grid grid-cols-1 gap-4 ${gridColumns === 4 ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : gridColumns === 6 ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : gridColumns === 8 ? 'sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' : 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-12'}`}>
                          {roomCards.map((card) => (
                            <PatientCard
                              key={card.id}
                              card={card}
                              liveVital={liveVitals[card.device_serial]}
                              onClick={() => setSelectedCard(card)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {sortedCards.length === 0 && !error && (
                      <div className="text-center py-12 text-slate-500">
                        Hozircha bemor monitorlar ro‘yxati bo‘sh. <strong>Boshqaruv</strong> bo‘limida palata, qurilma va bemor qo‘shing yoki serverda <code className="bg-slate-700 px-1 rounded">python manage.py create_monitoring_demo_data</code> ishlating.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`grid grid-cols-1 gap-4 ${gridColumns === 4 ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : gridColumns === 6 ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : gridColumns === 8 ? 'sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' : 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-12'}`}>
                    {sortedCards.length === 0 && !error && (
                      <div className="col-span-full text-center py-12 text-slate-500">
                        Hozircha bemor monitorlar ro‘yxati bo‘sh. <strong>Boshqaruv</strong> bo‘limida palata, qurilma va bemor qo‘shing yoki serverda <code className="bg-slate-700 px-1 rounded">python manage.py create_monitoring_demo_data</code> ishlating.
                      </div>
                    )}
                    {sortedCards.map((card) => (
                      <PatientCard
                        key={card.id}
                        card={card}
                        liveVital={liveVitals[card.device_serial]}
                        onClick={() => setSelectedCard(card)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default MonitoringDashboard;
