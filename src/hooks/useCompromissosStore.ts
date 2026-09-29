import { useEffect, useSyncExternalStore } from 'react';
import type { Compromisso } from '@/mocks/frontendAdvancedData';
import { loadAgendaPortfolio, type AgendaAppointment } from '@/lib/crm/appointmentsRepository';

// Adaptador de leitura para os indicadores legados do Dashboard. A Agenda usa
// diretamente o repositório operacional; assim não há duas fontes de verdade.
let state: Compromisso[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let loadStatus: 'loading' | 'ready' | 'error' = 'loading';
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const datePart = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
const timePart = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

function legacyAppointment(item: AgendaAppointment): Compromisso {
  return {
    id: item.id,
    titulo: item.title,
    lead: item.leadName,
    empresa: item.company,
    data: datePart(item.startsAt),
    horaInicio: timePart(item.startsAt),
    horaFim: timePart(item.endsAt),
    tipo: item.type === 'tarefa' || item.type === 'outro' ? 'proposta' : item.type,
    canal: item.location.startsWith('http') ? 'video' : item.location ? 'presencial' : 'telefone',
    status: item.status === 'completed' ? 'realizado' : item.status === 'cancelled' ? 'cancelado' : item.status === 'no_show' ? 'no_show' : 'agendado',
    responsavel: item.responsibleName,
    observacoes: item.notes,
    leadId: item.leadId,
    origem: item.origin === 'ana' ? 'ana' : 'manual',
    lembretesEnviados: item.reminderStatus === 'sent' ? item.reminderMinutes.map((minutes) => `${minutes} min`) : [],
  };
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  loadStatus = 'loading'; notify();
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - 30);
  const end = new Date(now); end.setDate(end.getDate() + 90);
  hydratePromise = loadAgendaPortfolio({ query: '', responsibleId: '', type: '', status: '', origin: '', segment: '', confirmation: '', nextAction: '', quick: '', rangeStart: start.toISOString(), rangeEnd: end.toISOString() }, 0, 200)
    .then(({ items }) => { state = items.map(legacyAppointment); hydrated = true; loadStatus = 'ready'; notify(); })
    .catch((error) => { console.error('[agenda] falha ao carregar indicadores', error); loadStatus = 'error'; notify(); })
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

export function useCompromissosStore(): { compromissos: Compromisso[] } {
  const compromissos = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void hydrate(); }, []);
  return { compromissos };
}

export function useCompromissosLoadStatus() {
  const status = useSyncExternalStore(subscribe, () => loadStatus, () => loadStatus);
  useEffect(() => { void hydrate(); }, []);
  return status;
}

export async function refreshCompromissosStore(): Promise<void> { hydrated = false; await hydrate(); }
