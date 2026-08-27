import { useEffect, useSyncExternalStore } from 'react';
import type { Compromisso } from '@/mocks/frontendAdvancedData';
import {
  createOperationalAppointment,
  deleteOperationalAppointment,
  loadOperationalAppointments,
  updateOperationalAppointment,
} from '@/lib/crm/appointmentsRepository';

let state: Compromisso[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = loadOperationalAppointments()
    .then((appointments) => {
      state = appointments;
      hydrated = true;
      notify();
    })
    .catch((error) => console.error('[appointments] falha ao carregar agenda operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

function retryLoadAfterFailure(error: unknown) {
  console.error('[appointments] falha ao persistir agenda operacional', error);
  hydrated = false;
  void hydrate();
}

function enqueue(operation: () => Promise<void>) {
  writeQueue = writeQueue.then(operation).catch(retryLoadAfterFailure);
}

export interface CompromissosStore {
  compromissos: Compromisso[];
  criar: (dados: Omit<Compromisso, 'id'>) => Compromisso;
  atualizar: (id: string, mudanca: Partial<Compromisso>) => void;
  excluir: (id: string) => void;
}

export function useCompromissosStore(): CompromissosStore {
  const compromissos = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void hydrate(); }, []);

  const criar = (dados: Omit<Compromisso, 'id'>): Compromisso => {
    const novo: Compromisso = { ...dados, id: crypto.randomUUID() };
    state = [novo, ...state];
    notify();
    enqueue(async () => {
      const persisted = await createOperationalAppointment(novo);
      state = state.map((appointment) => (appointment.id === novo.id ? persisted : appointment));
      notify();
    });
    return novo;
  };

  const atualizar = (id: string, mudanca: Partial<Compromisso>) => {
    const next = state.map((appointment) => (appointment.id === id ? { ...appointment, ...mudanca } : appointment));
    const appointment = next.find((candidate) => candidate.id === id);
    if (!appointment) return;
    state = next;
    notify();
    enqueue(async () => {
      const persisted = await updateOperationalAppointment(appointment);
      state = state.map((candidate) => (candidate.id === id ? persisted : candidate));
      notify();
    });
  };

  const excluir = (id: string) => {
    state = state.filter((appointment) => appointment.id !== id);
    notify();
    enqueue(async () => {
      await deleteOperationalAppointment(id);
    });
  };

  return { compromissos, criar, atualizar, excluir };
}

export function getCompromissosSnapshot(): Compromisso[] {
  return state;
}
