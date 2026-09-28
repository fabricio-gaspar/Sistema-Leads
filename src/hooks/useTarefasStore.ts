import { useEffect, useSyncExternalStore } from 'react';
import type { Tarefa } from '@/lib/tipos';
import { loadOperationalTasks, persistOperationalTasks } from '@/lib/crm/tasksRepository';

let state: Tarefa[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
let latestPersistenceError: unknown = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = loadOperationalTasks()
    .then((tasks) => {
      state = tasks;
      hydrated = true;
      notify();
    })
    .catch((error) => console.error('[crm-tasks] falha ao carregar fonte operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function updateState(updater: (previous: Tarefa[]) => Tarefa[]): void {
  const previous = state;
  const next = updater(previous);
  state = next;
  notify();
  writeQueue = writeQueue
    .then(async () => {
      state = await persistOperationalTasks(previous, next);
      latestPersistenceError = null;
      notify();
    })
    .catch((error) => {
      console.error('[crm-tasks] falha ao salvar fonte operacional', error);
      latestPersistenceError = error;
      hydrated = false;
      void hydrate();
    });
}

export function useTarefasStore(): {
  tarefas: Tarefa[];
  criar: (tarefa: Omit<Tarefa, 'id' | 'criadaEm' | 'concluida'>) => Tarefa;
  concluir: (id: string) => void;
  alternar: (id: string) => void;
} {
  const tarefas = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void hydrate(); }, []);

  const criar = (dados: Omit<Tarefa, 'id' | 'criadaEm' | 'concluida'>): Tarefa => {
    const nova: Tarefa = {
      ...dados,
      id: crypto.randomUUID(),
      criadaEm: new Date().toISOString(),
      concluida: false,
    };
    updateState((prev) => [nova, ...prev]);
    return nova;
  };

  const concluir = (id: string) => {
    updateState((prev) => prev.map((t) => (t.id === id ? { ...t, concluida: true } : t)));
  };

  const alternar = (id: string) => {
    updateState((prev) => prev.map((t) => (t.id === id ? { ...t, concluida: !t.concluida } : t)));
  };

  return { tarefas, criar, concluir, alternar };
}

export function getTarefasSnapshot(): Tarefa[] {
  return state;
}

/** Wait for an optimistic task mutation before confirming it in the UI. */
export async function waitForTarefasPersistence(): Promise<void> {
  await writeQueue;
  if (latestPersistenceError) {
    const error = latestPersistenceError;
    latestPersistenceError = null;
    throw error;
  }
}
