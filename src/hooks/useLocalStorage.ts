import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Sync from cloud on mount
  useEffect(() => {
    fetch(`/api/v1/state/${key}`)
      .then(res => res.json())
      .then(data => {
        if (data.value !== null && data.value !== undefined) {
          setStoredValue(data.value);
          window.localStorage.setItem(key, JSON.stringify(data.value));
        }
      })
      .catch(console.error);
  }, [key]);

  // Sync to local and cloud on change
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
      
      // Debounce the cloud write slightly
      const timeoutId = setTimeout(() => {
        fetch(`/api/v1/state/${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: storedValue })
        }).catch(console.error);
      }, 500);

      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue] as const;
}
