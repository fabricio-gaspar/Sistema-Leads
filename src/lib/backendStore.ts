import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

// Store externo persistente no Backend, mantendo o MESMO contrato síncrono
// (get/set/useStore) usado pelo resto da aplicação. Isso permite migrar as
// stores sem quebrar nenhum consumidor:
// - Leitura instantânea: estado em memória + cache localStorage (fallback offline).
// - Escrita: atualiza o estado local de forma síncrona e espelha no Backend (assíncrono).
// - Sincronização: ao autenticar, carrega do Backend (fonte da verdade); se ainda
//   não houver dados, semeia o cache local para a primeira carga.

function carregar<T>(key: string, inicial: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignora cache corrompido
  }
  return inicial;
}

function salvar<T>(key: string, valor: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    // falha silenciosa no cache
  }
}

export interface BackendStore<T> {
  get: () => T;
  set: (updater: (prev: T) => T) => void;
  useStore: () => T;
}

export function createBackendStore<T>(moduleKey: string, key: string, inicial: T): BackendStore<T> {
  let state: T = carregar(key, inicial);
  const listeners = new Set<() => void>();
  let sincronizado = false;

  const notify = () => listeners.forEach((l) => l());

  async function persistir(valor: T): Promise<void> {
    let session;
    try {
      session = await resolveOrganizationSession();
    } catch {
      return;
    }
    const { error } = await supabase
      .from('organization_module_data')
      .upsert({
        organization_id: session.organizationId,
        module_key: moduleKey,
        data: valor,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,module_key' });
    if (error) {
      console.error(`[backendStore:${moduleKey}] falha ao salvar`, error);
    }
  }

  async function sincronizar(): Promise<void> {
    let session;
    try {
      session = await resolveOrganizationSession();
    } catch {
      return;
    }
    const { data, error } = await supabase
      .from('organization_module_data')
      .select('data')
      .eq('organization_id', session.organizationId)
      .eq('module_key', moduleKey)
      .maybeSingle();
    if (error) {
      console.error(`[backendStore:${moduleKey}] falha ao carregar`, error);
      return;
    }
    if (data && data.data != null) {
      // Backend é a fonte da verdade: substitui o cache local.
      state = data.data as T;
      salvar(key, state);
      notify();
    } else if (!sincronizado) {
      // Primeiro acesso do usuário: semeia o cache local no Backend.
      await persistir(state);
    }
    sincronizado = true;
  }

  // Assim que houver usuário autenticado (login ou refresh), sincroniza.
  // O callback retorna de forma síncrona; a sincronização roda em segundo plano.
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      void sincronizar();
    }
  });

  const get = () => state;

  const set = (updater: (prev: T) => T) => {
    state = updater(state);
    salvar(key, state);
    notify();
    void persistir(state);
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
