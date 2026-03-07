import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { fetchWithAuth } from '@/lib/api';
import { logger } from '@/lib/logger';

export function usePersistentState<T>(key: string, initialValue: T) {
  const { getToken } = useAuth();
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
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
      
      // Debounce the cloud write slightly
      const timeoutId = setTimeout(async () => {
        try {
          await fetchWithAuth(`/api/v1/state/${key}`, getToken, {
            method: 'POST',
            body: JSON.stringify({ value: storedValue })
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
