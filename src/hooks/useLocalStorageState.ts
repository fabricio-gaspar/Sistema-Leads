import { useState, useEffect, useSyncExternalStore } from 'react';
import { sessionContext, type SessionContext } from '@/lib/sessionContext';

export function scopedPreferenceKey(key: string, context: SessionContext): string | null {
  return context.userId && context.organizationId
    ? `wayflex-pref:${encodeURIComponent(context.userId)}:${encodeURIComponent(context.organizationId)}:${key}`
    : null;
}

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
  const context = useSyncExternalStore(sessionContext.subscribe, sessionContext.get, sessionContext.get);
  const storageKey = scopedPreferenceKey(key, context);
  const [value, setValue] = useState<T>(() => storageKey ? readStorageValue(storageKey, initialValue) : initialValue);
  const [loadedKey, setLoadedKey] = useState(storageKey);

  // Account-scoped preferences (such as saved views) receive their key only
  // after authentication resolves.  Read the new key before writing anything
  // to it so one user's browser preferences never overwrite another's.
  useEffect(() => {
    if (loadedKey === storageKey) return;
    setValue(storageKey ? readStorageValue(storageKey, initialValue) : initialValue);
    setLoadedKey(storageKey);
  }, [initialValue, storageKey, loadedKey]);

  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey || !sessionContext.isCurrent(context)) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignora erros de storage (ex.: modo anônimo)
    }
  }, [storageKey, loadedKey, value, context]);

  return [loadedKey === storageKey ? value : initialValue, setValue] as const;
}
