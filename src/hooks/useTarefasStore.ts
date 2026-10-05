import { createContextStore } from '@/lib/contextStore';
import type { Tarefa } from '@/lib/tipos';
import { loadOperationalTasks, persistOperationalTasks } from '@/lib/crm/tasksRepository';

const store = createContextStore<Tarefa[]>({
  initial: () => [],
  load: async () => loadOperationalTasks(),
  save: (previous, next) => persistOperationalTasks(previous, next),
});

export function useTarefasStore(): {
  tarefas: Tarefa[];
  criar: (tarefa: Omit<Tarefa, 'id' | 'criadaEm' | 'concluida'>) => Tarefa;
  concluir: (id: string) => void;
  alternar: (id: string) => void;
} {
  const tarefas = store.useData();
  const updateState = store.bindUpdate();

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
  return store.get();
}

/** Wait for an optimistic task mutation before confirming it in the UI. */
export const waitForTarefasPersistence = store.wait;
