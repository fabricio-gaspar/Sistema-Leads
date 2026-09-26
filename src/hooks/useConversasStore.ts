import { useEffect, useSyncExternalStore } from 'react';
import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import { loadOperationalConversations, persistOperationalConversations } from '@/lib/crm/conversationsRepository';
import { persistentLeadId } from '@/lib/crm/leadMapper';

let state: Conversa[] = [];
let hydrated = false;
let loadStatus: 'loading' | 'ready' | 'error' = 'loading';
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const getLoadStatus = () => loadStatus;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  loadStatus = 'loading';
  notify();
  hydratePromise = loadOperationalConversations()
    .then((conversations) => {
      state = conversations;
      hydrated = true;
      loadStatus = 'ready';
      notify();
    })
    .catch((error) => {
      console.error('[crm-conversations] falha ao carregar fonte operacional', error);
      loadStatus = 'error';
      notify();
    })
    .finally(() => {
      hydratePromise = null;
    });
  return hydratePromise;
}

function withPersistentIds(conversations: Conversa[]): Conversa[] {
  return conversations.map((conversation) => ({
    ...conversation,
    id: persistentLeadId(conversation.id),
    mensagens: conversation.mensagens.map((message) => ({ ...message, id: persistentLeadId(message.id) })),
  }));
}

function updateState(updater: (previous: Conversa[]) => Conversa[]): void {
  const previous = state;
  const next = withPersistentIds(updater(previous));
  state = next;
  notify();
  writeQueue = writeQueue
    .then(async () => {
      state = await persistOperationalConversations(previous, next);
      notify();
    })
    .catch((error) => {
      console.error('[crm-conversations] falha ao salvar fonte operacional', error);
      void hydrate();
    });
}

export function useConversasStore(): {
  conversas: Conversa[];
  adicionarMensagem: (id: string, msg: Mensagem, opts?: { notificarCliente?: boolean }) => void;
  atualizarStatus: (id: string, status: Conversa['status']) => void;
  atualizar: (id: string, patch: Partial<Conversa>) => void;
  criarConversa: (lead: Lead) => Conversa;
} {
  const conversas = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void hydrate(); }, []);

  const adicionarMensagem = (id: string, msg: Mensagem, opts?: { notificarCliente?: boolean }) => {
    const notificarCliente = opts?.notificarCliente ?? true;
    updateState((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              mensagens: [...c.mensagens, msg],
              ultimaMensagem: msg.texto,
              hora: 'agora',
              naoLidas: notificarCliente ? 0 : c.naoLidas,
            }
          : c
      )
    );
  };

  const atualizarStatus = (id: string, status: Conversa['status']) => {
    updateState((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const atualizar = (id: string, patch: Partial<Conversa>) => {
    updateState((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const criarConversa = (lead: Lead): Conversa => {
    const nova: Conversa = {
      id: lead.id,
      protocolo: `#TCK-${Date.now().toString().slice(-6)}`,
      contato: lead.nome,
      empresa: lead.empresa,
      canal: lead.canalPreferencial === 'E-mail' ? 'email' : 'whatsapp',
      status: 'ativo',
      sla: '—',
      fila: lead.etapa === 'Novo' ? 'Qualificação' : lead.etapa,
      ultimaMensagem: 'Conversa iniciada a partir do lead.',
      hora: 'agora',
      naoLidas: 0,
      mensagens: [],
      leadId: lead.id,
    };
    updateState((prev) => [nova, ...prev]);
    return nova;
  };

  return { conversas, adicionarMensagem, atualizarStatus, atualizar, criarConversa };
}

export function getConversasSnapshot(): Conversa[] {
  return state;
}

export function useConversasLoadStatus(): 'loading' | 'ready' | 'error' {
  const status = useSyncExternalStore(subscribe, getLoadStatus, getLoadStatus);
  useEffect(() => { void hydrate(); }, []);
  return status;
}

export async function refreshConversasStore(): Promise<void> {
  hydrated = false;
  await hydrate();
}
