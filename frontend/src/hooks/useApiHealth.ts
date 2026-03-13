/**
 * Hook to check backend API health for connectivity banner
 */
import { useState, useEffect, useCallback } from 'react';
import { checkApiHealth } from '../services/api';
import { isApiConfigured } from '../config/api';

const POLL_INTERVAL_MS = 35_000;
const INITIAL_DELAY_MS = 300;

export function useApiHealth(): {
  apiHealthy: boolean;
  healthStatus: number | null;
  checkNow: () => void;
} {
  const [apiHealthy, setApiHealthy] = useState<boolean>(true);
  const [healthStatus, setHealthStatus] = useState<number | null>(null);

  const checkNow = useCallback(async () => {
    if (!isApiConfigured()) {
      setApiHealthy(true);
      setHealthStatus(null);
      return;
    }
    const result = await checkApiHealth();
    setApiHealthy(result.ok);
    setHealthStatus(result.status ?? null);
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      checkNow();
      intervalId = setInterval(checkNow, POLL_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkNow]);

  return { apiHealthy, healthStatus, checkNow };
}