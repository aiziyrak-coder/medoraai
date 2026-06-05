import { apiGet, apiPost, type ApiResponse } from './api';

export interface MonitoringVitals {
  heartRate: number | null;
  spO2: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  respirationRate: number | null;
  temperature: number | null;
}

export interface MonitoringPatientCard {
  id: number;
  patient_label: string;
  bed_label: string;
  room: string;
  device_online: boolean;
  vitals: MonitoringVitals | null;
  open_alarms: number;
  last_reading_at: string | null;
}

export const getMonitoringDashboard = async (): Promise<
  ApiResponse<{ patients: MonitoringPatientCard[] }>
> => {
  return apiGet<{ patients: MonitoringPatientCard[] }>('/monitoring/dashboard/');
};

export const simulateMonitoringVitals = async (): Promise<ApiResponse<{ patient_monitor_id: number }>> => {
  return apiPost<{ patient_monitor_id: number }>('/monitoring/simulate/', {});
};

export const getMonitoringAlarms = async (): Promise<ApiResponse<import('../types').MonitoringAlarm[]>> => {
  return apiGet<import('../types').MonitoringAlarm[]>('/monitoring/alarms/');
};

export const acknowledgeMonitoringAlarm = async (alarmId: number): Promise<ApiResponse<unknown>> => {
  return apiPost(`/monitoring/alarms/${alarmId}/acknowledge/`, {});
};
