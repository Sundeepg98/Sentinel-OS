import { useState, useEffect } from 'react';

/**
 * 🛰️ ENGINEERING BASIC: DEBOUNCE HOOK
 * Prevents excessive API calls during rapid user input (e.g., Search).
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
