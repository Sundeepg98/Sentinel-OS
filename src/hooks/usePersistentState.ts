import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { fetchWithAuth } from '@/lib/api';
import { logger } from '@/lib/logger';

export function usePersistentState<T>(key: string, initialValue: T) {
  const { getToken } = useAuth();
  const isFirstRender = useRef(true);
  const skipNextSave = useRef(false);

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // ☁️ CLOUD SYNC: Load from backend on mount
  useEffect(() => {
    const syncFromCloud = async () => {
      try {
        const data = await fetchWithAuth<{ value: T }>(`/api/v1/state/${key}`, getToken);
        if (data && data.value !== null && data.value !== undefined) {
          skipNextSave.current = true; // 🛡️ STAFF BASIC: Avoid echoing the sync back to the cloud
          setStoredValue(data.value);
          window.localStorage.setItem(key, JSON.stringify(data.value));
        }
      } catch (err) {
        logger.warn(`Failed to sync persistent state '${key}' from cloud`, { key, error: err });
      }
    };

    syncFromCloud();
  }, [key, getToken]);

  // 💾 PERSISTENCE: Save to local and cloud on change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));

      const timeoutId = setTimeout(async () => {
        try {
          await fetchWithAuth(`/api/v1/state/${key}`, getToken, {
            method: 'POST',
            body: JSON.stringify({ value: storedValue }),
          });
        } catch (err) {
          logger.error(`Failed to persist state '${key}' to cloud`, err, { key });
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    } catch (error) {
      logger.error(`Local persistence failure for '${key}'`, error);
    }
  }, [key, storedValue, getToken]);

  return [storedValue, setStoredValue] as const;
}
