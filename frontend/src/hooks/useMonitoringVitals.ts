import { useCallback, useEffect, useRef, useState } from 'react';
import type { VitalSigns } from '../types';
import { isApiConfigured } from '../config/api';
import {
  getMonitoringDashboard,
  simulateMonitoringVitals,
} from '../services/apiMonitoringService';

function mapVitals(raw: {
  heartRate?: number | null;
  spO2?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  respirationRate?: number | null;
} | null): VitalSigns | null {
  if (!raw) return null;
  return {
    heartRate: raw.heartRate ?? 0,
    spO2: raw.spO2 ?? 0,
    bpSystolic: raw.bpSystolic ?? 0,
    bpDiastolic: raw.bpDiastolic ?? 0,
    respirationRate: raw.respirationRate ?? 0,
  };
}

export function useMonitoringVitals(active: boolean) {
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) return;
    const res = await getMonitoringDashboard();
    if (!res.success || !res.data?.patients?.length) return;
    const first = res.data.patients.find((p) => p.vitals) ?? res.data.patients[0];
    setVitals(mapVitals(first?.vitals ?? null));
    setIsConnected(true);
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
      setIsConnected(true);
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
    setVitals(null);
    setCaptureMessage('');
  }, []);

  const capture = useCallback(async () => {
    if (!isApiConfigured()) return;
    await simulateMonitoringVitals();
    await refresh();
    setCaptureMessage(new Date().toLocaleTimeString());
  }, [refresh]);

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
    vitals,
    isConnecting,
    isConnected,
    captureMessage,
    onDisconnect: disconnect,
    onCapture: capture,
    onConnect: connect,
  };
}
