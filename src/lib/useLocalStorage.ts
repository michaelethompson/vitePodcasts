import { useCallback, useEffect, useState } from 'react';

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be full or disabled; the app still works for this session */
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(readStored(key, fallback));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, useCallback((v: T | ((p: T) => T)) => setValue(v), [])] as const;
}
