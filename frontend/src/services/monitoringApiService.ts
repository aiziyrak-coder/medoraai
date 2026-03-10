/**
 * Monitoring API – devices, vitals, alarms, dashboard.
 * Uses same backend base URL and JWT auth.
 */
import { apiGet, apiPost, apiPatch, apiDelete, type ApiResponse } from './api';

const PREFIX = '/monitoring';

export interface Ward {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: number;
  ward?: number | null;
  ward_name?: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: number;
  model: string;
  serial_number: string;
  room: number | null;
  room_name?: string;
  host?: string;
  port?: number | null;
  status: 'online' | 'offline' | 'maintenance';
  /** Computed: online if last_seen_at within 2 min, else offline */
  effective_status?: 'online' | 'offline';
  last_seen_at: string | null;
  meta: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientMonitor {
  id: number;
  device: number;
  device_serial: string;
  room: number;
  room_name: string;
  bed_label: string;
  patient_name: string;
  patient_identifier: string;
  age?: number | null;
  gender?: string;
  medical_notes?: string;
  bed_status?: 'occupied' | 'empty' | 'reserved' | 'cleaning';
  assigned_to?: number | null;
  assigned_to_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VitalReading {
  id: number;
  patient_monitor: number;
  timestamp: string;
  heart_rate: number | null;
  spo2: number | null;
  nibp_systolic: number | null;
  nibp_diastolic: number | null;
  respiration_rate: number | null;
  temperature: string | null;
  raw_payload?: Record<string, unknown>;
}

export interface Alarm {
  id: number;
  patient_monitor: number;
  patient_monitor_display: string;
  param: string;
  value: number;
  severity: 'critical' | 'urgent' | 'warning';
  message: string;
  acknowledged_at: string | null;
  created_at: string;
}

export interface DashboardPatientCard {
  id: number;
  patient_name: string;
  bed_label: string;
  room_name: string;
  ward_name?: string | null;
  device_serial: string;
  device_status: string;
  bed_status?: string;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  last_vital: VitalReading | null;
  unack_alarm_count: number;
  vital_status?: 'normal' | 'warning' | 'critical';
  /** Early Warning Score (0–15+), MEWS-style */
  ews_score?: number;
  /** past | o'rta | yuqori */
  ews_level?: string;
  /** Yiqilish xavfi (fall risk) */
  fall_risk?: string | null;
  /** Bosim yarasi xavfi (pressure ulcer risk) */
  pressure_risk?: string | null;
}

export interface DashboardSummaryResponse {
  data: DashboardPatientCard[];
  summary: { total_beds: number; critical_count: number; warning_count: number };
}

/** GET dashboard summary – grid, filter (room_id, ward_id, status, search), summary */
export async function getDashboardSummary(params?: {
  room_id?: string;
  ward_id?: string;
  status?: 'critical' | 'warning' | 'normal';
  search?: string;
}): Promise<ApiResponse<DashboardPatientCard[]>> {
  const query: Record<string, string> = {};
  if (params?.room_id) query.room_id = params.room_id;
  if (params?.ward_id) query.ward_id = params.ward_id;
  if (params?.status) query.status = params.status;
  if (params?.search) query.search = params.search.trim();
  const res = await apiGet<DashboardPatientCard[]>(
    `${PREFIX}/dashboard/`,
    Object.keys(query).length ? query : undefined
  );
  return res;
}

/** GET wards */
export async function getWards(): Promise<ApiResponse<Ward[]>> {
  return apiGet<Ward[]>(`${PREFIX}/wards/`);
}

/** POST create ward (qanot) */
export async function createWard(data: { name: string; code?: string; description?: string }): Promise<ApiResponse<Ward>> {
  return apiPost<Ward>(`${PREFIX}/wards/`, data);
}

/** PATCH update ward */
export async function updateWard(id: number, data: { name?: string; code?: string; description?: string }): Promise<ApiResponse<Ward>> {
  return apiPatch<Ward>(`${PREFIX}/wards/${id}/`, data);
}

/** DELETE ward (soft) */
export async function deleteWard(id: number): Promise<ApiResponse<unknown>> {
  return apiDelete(`${PREFIX}/wards/${id}/`);
}

/** POST create room (palata) – optional ward */
export async function createRoom(data: { name: string; code?: string; description?: string; ward?: number | null }): Promise<ApiResponse<Room>> {
  return apiPost<Room>(`${PREFIX}/rooms/`, data);
}

/** PATCH update room */
export async function updateRoom(id: number, data: { name?: string; code?: string; description?: string; ward?: number | null }): Promise<ApiResponse<Room>> {
  return apiPatch<Room>(`${PREFIX}/rooms/${id}/`, data);
}

/** DELETE room (soft) */
export async function deleteRoom(id: number): Promise<ApiResponse<unknown>> {
  return apiDelete(`${PREFIX}/rooms/${id}/`);
}

export interface MonitoringAuditLogEntry {
  id: number;
  patient_monitor: number | null;
  patient_monitor_display: string | null;
  action: string;
  user: number | null;
  user_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** GET audit log */
export async function getAuditLog(params?: { patient_monitor_id?: string }): Promise<ApiResponse<MonitoringAuditLogEntry[]>> {
  const q: Record<string, string> = {};
  if (params?.patient_monitor_id) q.patient_monitor_id = params.patient_monitor_id;
  return apiGet<MonitoringAuditLogEntry[]>(`${PREFIX}/audit-log/`, Object.keys(q).length ? q : undefined);
}

export interface MonitoringNoteEntry {
  id: number;
  patient_monitor: number;
  note: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

/** GET notes for patient monitor */
export async function getNotes(patientMonitorId: number): Promise<ApiResponse<MonitoringNoteEntry[]>> {
  return apiGet<MonitoringNoteEntry[]>(`${PREFIX}/notes/`, { patient_monitor_id: String(patientMonitorId) });
}

/** POST add note */
export async function createNote(patientMonitorId: number, note: string): Promise<ApiResponse<MonitoringNoteEntry>> {
  return apiPost<MonitoringNoteEntry>(`${PREFIX}/notes/`, { patient_monitor_id: patientMonitorId, note });
}

/** Export vitals – format: csv | excel | pdf. Fetches with auth and triggers download. */
export async function exportVitals(
  patientMonitorId: number,
  format: 'csv' | 'excel' | 'pdf' = 'csv',
  filenamePrefix?: string,
  from?: string,
  to?: string
): Promise<void> {
  const { getAuthToken } = await import('./api');
  const { API_CONFIG } = await import('../config/api');
  const token = getAuthToken();
  const params = new URLSearchParams({
    patient_monitor_id: String(patientMonitorId),
    format: format === 'excel' ? 'xlsx' : format,
  });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const fullUrl = `${API_CONFIG.BASE_URL}${PREFIX}/vitals/export/?${params.toString()}`;
  const res = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const ext = format === 'excel' ? 'xlsx' : format;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filenamePrefix || 'vitals'}_${patientMonitorId}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** @deprecated Use exportVitals(id, 'csv', ...) */
export async function exportVitalsAsCsv(
  patientMonitorId: number,
  filenamePrefix?: string,
  from?: string,
  to?: string
): Promise<void> {
  return exportVitals(patientMonitorId, 'csv', filenamePrefix, from, to);
}

export interface MonitoringStaffMember {
  id: number;
  name: string;
  phone: string;
  role: string;
}

/** GET staff list for bed assignment (monitoring, doctor, staff roles) */
export async function getMonitoringStaff(): Promise<ApiResponse<MonitoringStaffMember[]>> {
  const res = await apiGet<MonitoringStaffMember[]>(`${PREFIX}/staff/`);
  if (res.success && res.data) return res;
  return { success: false, data: [] as MonitoringStaffMember[], error: res.error };
}

export interface VitalsCompareRangeItem {
  timestamp: string;
  heart_rate: number | null;
  spo2: number | null;
  nibp_systolic: number | null;
  nibp_diastolic: number | null;
  respiration_rate: number | null;
  temperature: string | null;
}

/** GET vitals compare – two time ranges for trend comparison */
export async function getVitalsCompare(
  patientMonitorId: number,
  range1From: string,
  range1To: string,
  range2From: string,
  range2To: string
): Promise<ApiResponse<{ range1: VitalsCompareRangeItem[]; range2: VitalsCompareRangeItem[] }>> {
  const params: Record<string, string> = {
    patient_monitor_id: String(patientMonitorId),
    range1_from: range1From,
    range1_to: range1To,
    range2_from: range2From,
    range2_to: range2To,
  };
  return apiGet<{ range1: VitalsCompareRangeItem[]; range2: VitalsCompareRangeItem[] }>(
    `${PREFIX}/vitals/compare/`,
    params
  );
}

/** GET devices status */
export async function getDevicesStatus(params?: { room?: string }): Promise<ApiResponse<Device[]>> {
  return apiGet<Device[]>(`${PREFIX}/devices/status/`, params);
}

/** POST register device */
export async function registerDevice(data: {
  model: string;
  serial_number: string;
  room?: number | null;
  host?: string;
  port?: number | null;
  meta?: Record<string, unknown>;
}): Promise<ApiResponse<Device>> {
  const res = await apiPost<Device>(`${PREFIX}/devices/register/`, data);
  return res;
}

/** GET vitals – patient_monitor_id yoki room_id, limit */
export async function getVitals(params: {
  patient_monitor_id?: string;
  room_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ApiResponse<VitalReading[]>> {
  const q: Record<string, string> = {};
  if (params.patient_monitor_id) q.patient_monitor_id = params.patient_monitor_id;
  if (params.room_id) q.room_id = params.room_id;
  if (params.from) q.from = params.from;
  if (params.to) q.to = params.to;
  if (params.limit != null) q.limit = String(params.limit);
  const res = await apiGet<VitalReading[]>(`${PREFIX}/vitals/`, Object.keys(q).length ? q : undefined);
  return res;
}

/** GET alarms – acknowledged=true/false, patient_monitor_id */
export async function getAlarms(params?: {
  acknowledged?: string;
  patient_monitor_id?: string;
}): Promise<ApiResponse<Alarm[]>> {
  const res = await apiGet<Alarm[]>(`${PREFIX}/alarms/`, params);
  return res;
}

/** POST acknowledge alarm */
export async function acknowledgeAlarm(alarmId: number): Promise<ApiResponse<Alarm>> {
  return apiPost<Alarm>(`${PREFIX}/alarms/${alarmId}/acknowledge/`, {});
}

export interface AlarmThresholdType {
  id: number;
  patient_monitor: number;
  param: string;
  min_value: number | null;
  max_value: number | null;
  severity: string;
  is_active: boolean;
}

/** GET alarm thresholds (optional patient_monitor_id) */
export async function getAlarmThresholds(patientMonitorId?: number): Promise<ApiResponse<AlarmThresholdType[]>> {
  const params = patientMonitorId ? { patient_monitor_id: String(patientMonitorId) } : undefined;
  return apiGet<AlarmThresholdType[]>(`${PREFIX}/alarm-thresholds/`, params);
}

/** POST create alarm threshold */
export async function createAlarmThreshold(data: {
  patient_monitor: number;
  param: string;
  min_value?: number | null;
  max_value?: number | null;
  severity?: string;
}): Promise<ApiResponse<AlarmThresholdType>> {
  return apiPost<AlarmThresholdType>(`${PREFIX}/alarm-thresholds/`, data);
}

/** PATCH update patient monitor (e.g. bed_status, assigned_to, discharge) */
export async function updatePatientMonitor(
  id: number,
  data: { bed_status?: string; assigned_to?: number | null }
): Promise<ApiResponse<PatientMonitor>> {
  return apiPatch<PatientMonitor>(`${PREFIX}/patient-monitors/${id}/`, data);
}

/** GET rooms */
export async function getRooms(): Promise<ApiResponse<Room[]>> {
  return apiGet<Room[]>(`${PREFIX}/rooms/`);
}


/** GET devices list (for management) */
export async function getDevices(params?: { room?: string }): Promise<ApiResponse<Device[]>> {
  return apiGet<Device[]>(`${PREFIX}/devices/`, params);
}

/** PATCH update device (room, host, port) */
export async function updateDevice(id: number, data: { room?: number | null; host?: string; port?: number | null }): Promise<ApiResponse<Device>> {
  return apiPatch<Device>(`${PREFIX}/devices/${id}/`, data);
}

/** DELETE device (soft) */
export async function deleteDevice(id: number): Promise<ApiResponse<unknown>> {
  return apiDelete(`${PREFIX}/devices/${id}/`);
}

/** POST create patient monitor (bemorni palata va qurilmaga biriktirish) */
export async function createPatientMonitor(data: {
  room: number;
  device: number;
  bed_label?: string;
  patient_name?: string;
  patient_identifier?: string;
  age?: number | null;
  gender?: string;
  medical_notes?: string;
}): Promise<ApiResponse<PatientMonitor>> {
  return apiPost<PatientMonitor>(`${PREFIX}/patient-monitors/`, data);
}

/** GET patient monitors */
export async function getPatientMonitors(params?: { room?: string }): Promise<ApiResponse<PatientMonitor[]>> {
  return apiGet<PatientMonitor[]>(`${PREFIX}/patient-monitors/`, params);
}

/** DELETE patient monitor */
export async function deletePatientMonitor(id: number): Promise<ApiResponse<unknown>> {
  return apiDelete(`${PREFIX}/patient-monitors/${id}/`);
}

// --- Monitoring AI (Gemini tahlil) – /api/ai/monitoring/ ---
const AI_PREFIX = '/ai/monitoring';

export interface MonitoringAiRiskScore {
  risk_level: 'past' | "o'rta" | 'yuqori' | "noma'lum" | 'xato';
  score: number | null;
  reason: string;
}

export async function getMonitoringAiRiskScore(
  patientMonitorId: number,
  params?: { from?: string; to?: string }
): Promise<ApiResponse<MonitoringAiRiskScore>> {
  const res = await apiPost<MonitoringAiRiskScore>(`${AI_PREFIX}/risk-score/`, {
    patient_monitor_id: patientMonitorId,
    ...params,
  });
  return res;
}

export interface MonitoringAiExplainAlarm {
  explanation: string;
}

export async function getMonitoringAiExplainAlarm(alarmId: number): Promise<ApiResponse<MonitoringAiExplainAlarm>> {
  return apiPost<MonitoringAiExplainAlarm>(`${AI_PREFIX}/explain-alarm/`, { alarm_id: alarmId });
}

export interface MonitoringAiDailySummary {
  summary: string;
}

export async function getMonitoringAiDailySummary(
  patientMonitorId: number,
  date?: string
): Promise<ApiResponse<MonitoringAiDailySummary>> {
  const res = await apiPost<MonitoringAiDailySummary>(`${AI_PREFIX}/daily-summary/`, {
    patient_monitor_id: patientMonitorId,
    date: date || undefined,
  });
  return res;
}

export interface MonitoringAiDraftNote {
  draft: string;
}

export async function getMonitoringAiDraftNote(
  patientMonitorId: number,
  type: 'handover' | 'progress_note' = 'handover'
): Promise<ApiResponse<MonitoringAiDraftNote>> {
  return apiPost<MonitoringAiDraftNote>(`${AI_PREFIX}/draft-note/`, {
    patient_monitor_id: patientMonitorId,
    type,
  });
}

export interface MonitoringAiTrendPrediction {
  deterioration_risk: string;
  reason: string;
}

export async function getMonitoringAiTrendPrediction(
  patientMonitorId: number,
  params?: { metric?: string; horizon_minutes?: number }
): Promise<ApiResponse<MonitoringAiTrendPrediction>> {
  return apiPost<MonitoringAiTrendPrediction>(`${AI_PREFIX}/trend-prediction/`, {
    patient_monitor_id: patientMonitorId,
    metric: params?.metric || 'spo2',
    horizon_minutes: params?.horizon_minutes ?? 60,
  });
}

export interface MonitoringAiEarlyWarning {
  concern_level: string;
  suggested_actions: string;
  disclaimer: string;
}

export async function getMonitoringAiEarlyWarning(
  patientMonitorId: number,
  params?: { from?: string; to?: string }
): Promise<ApiResponse<MonitoringAiEarlyWarning>> {
  return apiPost<MonitoringAiEarlyWarning>(`${AI_PREFIX}/early-warning/`, {
    patient_monitor_id: patientMonitorId,
    ...params,
  });
}

export interface SuggestedThresholdItem {
  param: string;
  min_value: number | null;
  max_value: number | null;
  reason: string;
}

export interface MonitoringAiSuggestThresholds {
  suggested: SuggestedThresholdItem[];
  disclaimer: string;
}

export async function getMonitoringAiSuggestThresholds(
  patientMonitorId: number
): Promise<ApiResponse<MonitoringAiSuggestThresholds>> {
  return apiPost<MonitoringAiSuggestThresholds>(`${AI_PREFIX}/suggest-thresholds/`, {
    patient_monitor_id: patientMonitorId,
  });
}

export interface MonitoringAiMortalityPrediction {
  risk_level: string;
  score: number | null;
  reason: string;
  disclaimer: string;
}

export async function getMonitoringAiMortalityPrediction(
  patientMonitorId: number,
  params?: { from?: string; to?: string }
): Promise<ApiResponse<MonitoringAiMortalityPrediction>> {
  return apiPost<MonitoringAiMortalityPrediction>(`${AI_PREFIX}/mortality-prediction/`, {
    patient_monitor_id: patientMonitorId,
    ...params,
  });
}

// --- 20 features: quick action, shift report, ward round PDF, medications, lab, stats, heatmap, bed forecast, family view, rapid response ---

export async function quickAction(
  patientMonitorId: number,
  actionType: string,
  note?: string
): Promise<ApiResponse<{ ok: boolean }>> {
  return apiPost<{ ok: boolean }>(`${PREFIX}/quick-action/`, {
    patient_monitor_id: patientMonitorId,
    action_type: actionType,
    note: note ?? '',
  });
}

/** Shift hisoboti PDF yuklab olish (ward_id ixtiyoriy). */
export async function getShiftReportPdf(wardId?: number): Promise<void> {
  const { getAuthToken } = await import('./api');
  const { API_CONFIG } = await import('../config/api');
  const token = getAuthToken();
  const params = new URLSearchParams();
  if (wardId != null) params.set('ward_id', String(wardId));
  const url = `${API_CONFIG.BASE_URL}${PREFIX}/shift-report/?${params.toString()}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Shift report failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shift_report${wardId != null ? `_ward_${wardId}` : ''}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Bitta bemor uchun ward round PDF. */
export async function getWardRoundPdf(patientMonitorId: number): Promise<void> {
  const { getAuthToken } = await import('./api');
  const { API_CONFIG } = await import('../config/api');
  const token = getAuthToken();
  const url = `${API_CONFIG.BASE_URL}${PREFIX}/ward-round-pdf/?patient_monitor_id=${patientMonitorId}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Ward round PDF failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ward_round_${patientMonitorId}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export interface MonitoringMedicationItem {
  id: number;
  patient_monitor: number;
  name: string;
  dose: string;
  scheduled_at: string;
  given_at: string | null;
  created_by?: number | null;
  created_at?: string;
  is_past?: boolean;
}

export async function getMedications(patientMonitorId: number): Promise<ApiResponse<MonitoringMedicationItem[]>> {
  const res = await apiGet<MonitoringMedicationItem[]>(`${PREFIX}/medications/`, {
    patient_monitor_id: String(patientMonitorId),
  });
  if (res.success && res.data) return res;
  return { success: true, data: [] };
}

export async function createMedication(
  patientMonitorId: number,
  data: { name: string; dose: string; scheduled_at: string }
): Promise<ApiResponse<{ id: number; scheduled_at: string }>> {
  return apiPost<{ id: number; scheduled_at: string }>(`${PREFIX}/medications/`, {
    patient_monitor_id: patientMonitorId,
    ...data,
  });
}

export async function markMedicationGiven(medicationId: number): Promise<ApiResponse<unknown>> {
  return apiPost<unknown>(`${PREFIX}/medications/${medicationId}/mark-given/`, {});
}

export interface MonitoringLabResultItem {
  id: number;
  patient_monitor: number;
  param: string;
  value: string;
  unit: string;
  timestamp: string;
}

export async function getLabResults(patientMonitorId: number): Promise<ApiResponse<MonitoringLabResultItem[]>> {
  const res = await apiGet<MonitoringLabResultItem[]>(`${PREFIX}/lab-results/`, {
    patient_monitor_id: String(patientMonitorId),
  });
  if (res.success && res.data) return res;
  return { success: true, data: [] };
}

export async function createLabResult(
  patientMonitorId: number,
  data: { param: string; value: string; unit?: string; timestamp?: string }
): Promise<ApiResponse<{ id: number }>> {
  return apiPost<{ id: number }>(`${PREFIX}/lab-results/`, {
    patient_monitor_id: patientMonitorId,
    param: data.param,
    value: data.value,
    unit: data.unit ?? '',
    timestamp: data.timestamp ?? new Date().toISOString(),
  });
}

export interface AlarmResponseStatsData {
  avg_response_seconds: number | null;
  sample_count?: number;
}

export async function getAlarmResponseStats(params?: {
  room_id?: string;
  ward_id?: string;
}): Promise<ApiResponse<AlarmResponseStatsData>> {
  const q: Record<string, string> = {};
  if (params?.room_id) q.room_id = params.room_id;
  if (params?.ward_id) q.ward_id = params.ward_id;
  const res = await apiGet<AlarmResponseStatsData>(`${PREFIX}/alarm-response-stats/`, Object.keys(q).length ? q : undefined);
  if (res.success && res.data) return res;
  return { success: false, data: { avg_response_seconds: null }, error: res.error };
}

export interface AlarmHeatmapItem {
  room: string;
  hour: string;
  count: number;
}

export async function getAlarmHeatmap(): Promise<ApiResponse<AlarmHeatmapItem[]>> {
  const res = await apiGet<AlarmHeatmapItem[]>(`${PREFIX}/alarm-heatmap/`);
  if (res.success && res.data) return res;
  return { success: false, data: [], error: res.error };
}

export interface BedForecastData {
  empty_now: Array<{ id: number; room_name: string; bed_label: string }>;
  occupied_count: number;
}

export async function getBedForecast(): Promise<ApiResponse<BedForecastData>> {
  const res = await apiGet<BedForecastData>(`${PREFIX}/bed-forecast/`);
  if (res.success && res.data) return res;
  return { success: false, data: { empty_now: [], occupied_count: 0 }, error: res.error };
}

export interface FamilyViewTokenResponse {
  token: string;
  link: string;
  expires_at: string;
}

export async function createFamilyViewToken(
  patientMonitorId: number,
  hours: number
): Promise<ApiResponse<FamilyViewTokenResponse>> {
  return apiPost<FamilyViewTokenResponse>(`${PREFIX}/family-view-token/`, {
    patient_monitor_id: patientMonitorId,
    hours,
  });
}

export async function rapidResponse(
  patientMonitorId: number,
  note?: string
): Promise<ApiResponse<{ ok: boolean }>> {
  return apiPost<{ ok: boolean }>(`${PREFIX}/rapid-response/`, {
    patient_monitor_id: patientMonitorId,
    note: note ?? '',
  });
}
