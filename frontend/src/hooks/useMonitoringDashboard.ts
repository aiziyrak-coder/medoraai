import { useCallback, useEffect, useRef, useState } from 'react';
import type { MonitoringAlarm, VitalSigns } from '../types';
import { isApiConfigured } from '../config/api';
import {
  acknowledgeMonitoringAlarm,
  getMonitoringAlarms,
  getMonitoringDashboard,
  simulateMonitoringVitals,
  type MonitoringPatientCard,
} from '../services/apiMonitoringService';

function mapVitals(raw: MonitoringPatientCard['vitals']): VitalSigns | null {
  if (!raw) return null;
  return {
    heartRate: raw.heartRate ?? 0,
    spO2: raw.spO2 ?? 0,
    bpSystolic: raw.bpSystolic ?? 0,
    bpDiastolic: raw.bpDiastolic ?? 0,
    respirationRate: raw.respirationRate ?? 0,
    temperature: raw.temperature ?? undefined,
  };
}

export function useMonitoringDashboard(active: boolean) {
  const [patients, setPatients] = useState<MonitoringPatientCard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [alarms, setAlarms] = useState<MonitoringAlarm[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedPatient = patients.find((p) => p.id === selectedId) ?? patients[0] ?? null;
  const vitals = mapVitals(selectedPatient?.vitals ?? null);

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) return;
    const [dashRes, alarmRes] = await Promise.all([
      getMonitoringDashboard(),
      getMonitoringAlarms(),
    ]);
    if (dashRes.success && dashRes.data?.patients) {
      setPatients(dashRes.data.patients);
      setIsConnected(dashRes.data.patients.length > 0);
      setSelectedId((prev) => {
        if (prev && dashRes.data!.patients.some((p) => p.id === prev)) return prev;
        return dashRes.data!.patients[0]?.id ?? null;
      });
    }
    if (alarmRes.success && Array.isArray(alarmRes.data)) {
      setAlarms(alarmRes.data);
    }
    setLastRefresh(new Date());
  }, []);

  const connect = useCallback(async () => {
    if (!isApiConfigured()) {
      setIsConnected(false);
      return;
    }
    setIsConnecting(true);
    try {
      await simulateMonitoringVitals();
      await refresh();
    } finally {
      setIsConnecting(false);
    }
  }, [refresh]);

  const disconnect = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsConnected(false);
    setPatients([]);
    setSelectedId(null);
    setAlarms([]);
    setCaptureMessage('');
    setLastRefresh(null);
  }, []);

  const capture = useCallback(async () => {
    if (!isApiConfigured()) return;
    await simulateMonitoringVitals();
    await refresh();
    setCaptureMessage(new Date().toLocaleTimeString());
  }, [refresh]);

  const acknowledgeAlarm = useCallback(
    async (alarmId: number) => {
      if (!isApiConfigured()) return;
      await acknowledgeMonitoringAlarm(alarmId);
      setAlarms((prev) => prev.filter((a) => a.id !== alarmId));
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (!active) {
      disconnect();
      return;
    }
    void connect();
    pollRef.current = setInterval(() => {
      void refresh();
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [active, connect, disconnect, refresh]);

  return {
    patients,
    selectedPatient,
    selectedId,
    setSelectedId,
    vitals,
    alarms,
    isConnecting,
    isConnected,
    captureMessage,
    lastRefresh,
    onDisconnect: disconnect,
    onCapture: capture,
    onConnect: connect,
    onRefresh: refresh,
    onAcknowledgeAlarm: acknowledgeAlarm,
  };
}
