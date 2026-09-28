import { useState, useEffect } from 'react';

function readStorageValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') return initialValue;
  try {
    const stored = window.localStorage.getItem(key);
    return stored !== null ? (JSON.parse(stored) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readStorageValue(key, initialValue));
  const [loadedKey, setLoadedKey] = useState(key);

  // Account-scoped preferences (such as saved views) receive their key only
  // after authentication resolves.  Read the new key before writing anything
  // to it so one user's browser preferences never overwrite another's.
  useEffect(() => {
    if (loadedKey === key) return;
    setValue(readStorageValue(key, initialValue));
    setLoadedKey(key);
  }, [initialValue, key, loadedKey]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignora erros de storage (ex.: modo anônimo)
    }
  }, [key, loadedKey, value]);

  return [value, setValue] as const;
}
