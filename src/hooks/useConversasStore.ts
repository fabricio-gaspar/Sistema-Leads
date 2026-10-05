import { createContextStore } from '@/lib/contextStore';
import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import { loadOperationalConversations, persistOperationalConversations } from '@/lib/crm/conversationsRepository';
import { persistentLeadId } from '@/lib/crm/leadMapper';

const store = createContextStore<Conversa[]>({
  initial: () => [],
  load: async () => loadOperationalConversations(),
  save: (previous, next) => persistOperationalConversations(previous, next),
  normalize: (items) => items.map((item) => ({ ...item, id: persistentLeadId(item.id), mensagens: item.mensagens.map((message) => ({ ...message, id: persistentLeadId(message.id) })) })),
});

export function useConversasStore(): {
  conversas: Conversa[];
  adicionarMensagem: (id: string, msg: Mensagem, opts?: { notificarCliente?: boolean }) => void;
  atualizarStatus: (id: string, status: Conversa['status']) => void;
  atualizar: (id: string, patch: Partial<Conversa>) => void;
  criarConversa: (lead: Lead) => Conversa;
} {
  const conversas = store.useData();
  const updateState = store.bindUpdate();

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
  return store.get();
}

export function useConversasLoadStatus(): 'loading' | 'ready' | 'error' {
  return store.useStatus();
}

export const refreshConversasStore = store.refresh;
