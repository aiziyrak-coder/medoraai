/**
 * Hook to check backend API health for connectivity banner
 */
import { useState, useEffect, useCallback } from 'react';
import { checkApiHealth } from '../services/api';
import { isApiConfigured } from '../config/api';

const POLL_INTERVAL_MS = 60_000; // 1 minute
const INITIAL_DELAY_MS = 3000;   // First check after 3s

export function useApiHealth(): { apiHealthy: boolean; checkNow: () => void } {
  const [apiHealthy, setApiHealthy] = useState<boolean>(true);

  const checkNow = useCallback(async () => {
    if (!isApiConfigured()) {
      setApiHealthy(true);
      return;
    }
    const ok = await checkApiHealth();
    setApiHealthy(ok);
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

  return { apiHealthy, checkNow };
}
