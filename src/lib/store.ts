import { useSyncExternalStore } from 'react';

// Store externo simples (singleton) com persistência em localStorage.
// Permite que múltiplos componentes/hooks compartilhem o MESMO estado,
// resolvendo o problema de "instâncias divergentes" entre telas.

function carregar<T>(key: string, inicial: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignora dados corrompidos
  }
  return inicial;
}

function salvar<T>(key: string, valor: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    // falha silenciosa na persistência
  }
}

export interface ExternalStore<T> {
  get: () => T;
  set: (updater: (prev: T) => T) => void;
  useStore: () => T;
}

export function createExternalStore<T>(key: string, inicial: T): ExternalStore<T> {
  let state: T = carregar(key, inicial);
  const listeners = new Set<() => void>();

  const get = () => state;

  const set = (updater: (prev: T) => T) => {
    state = updater(state);
    salvar(key, state);
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const useStore = () => useSyncExternalStore(subscribe, get);

  return { get, set, useStore };
}