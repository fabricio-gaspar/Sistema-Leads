import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { respostasRapidas, type Conversa, type Mensagem } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import { refreshConversasStore, useConversasStore } from '@/hooks/useConversasStore';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import type { Proposta } from '@/mocks/propostasData';
import { assignHumanHandoff, returnConversationToAna } from '@/lib/crm/handoffsRepository';
import { addContactSuppression, loadContactSuppressions, type ContactSuppression } from '@/lib/crm/suppressionRepository';
import { queueHumanMessage } from '@/lib/crm/humanMessageRepository';
import { validateHumanMessage } from '@/lib/crm/humanMessageValidation';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { supabase } from '@/lib/supabase';
import { loadConversationKnowledgeEvents, type ConversationKnowledgeEvent } from '@/lib/crm/catalogKnowledgeRepository';
import ConversaDrawer from './components/ConversaDrawer';
import ConversationKnowledgePanel, { type PreparedKnowledgeContent } from './components/ConversationKnowledgePanel';

const statusCores: Record<string, string> = {
  ativo: 'bg-primary-100 text-primary-700',
  aguardando: 'bg-accent-100 text-accent-700',
  resolvido: 'bg-secondary-100 text-secondary-700',
  transferido: 'bg-background-200 text-foreground-600',
};

const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  transferido: 'Transferido',
};

const deliveryLabel: Record<NonNullable<Mensagem['statusEnvio']>, string> = {
  aguardando: 'aguardando fila',
  aceita: 'aceita pelo provedor',
  entregue: 'entregue',
  lida: 'lida',
  falhou: 'falhou',
  reconciliacao: 'em reconciliação',
};

type ConversationRealtimeState = 'connecting' | 'live' | 'unavailable';
type InboxFilter = 'all' | 'waiting' | 'human' | 'ana';
type SidePanelTab = 'lead' | 'knowledge' | 'quotes' | 'agenda' | 'history';

const inboxFilters: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'waiting', label: 'Aguardando' },
  { id: 'human', label: 'Humano' },
  { id: 'ana', label: 'Ana' },
];

const realtimeCopy: Record<ConversationRealtimeState, string> = {
  connecting: 'Conectando atualizações',
  live: 'Atualização ao vivo',
  unavailable: 'Atualização automática',
};

const sidePanelTabs: Array<{ id: Exclude<SidePanelTab, 'history'>; label: string; icon: string }> = [
  { id: 'lead', label: 'Lead', icon: 'ri-user-3-line' },
  { id: 'knowledge', label: 'Conhecimento', icon: 'ri-book-open-line' },
  { id: 'quotes', label: 'Orçamentos', icon: 'ri-file-list-3-line' },
  { id: 'agenda', label: 'Agenda', icon: 'ri-calendar-event-line' },
];

function formatTraceDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : 'não informado';
}

export default function Atendimento() {
  const { conversas, adicionarMensagem, atualizarStatus, criarConversa } = useConversasStore();
  const navigate = useNavigate();
  const [leads, setLeads] = useLeadsStore();
  const { propostas } = usePropostasStore();
  const [orcamentoModal, setOrcamentoModal] = useState(false);
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [notaInterna, setNotaInterna] = useState(false);
  const [busca, setBusca] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('lead');
  const [optoutConfirmar, setOptoutConfirmar] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [messageFeedback, setMessageFeedback] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [handoffAction, setHandoffAction] = useState<'transfer' | 'takeover' | 'return' | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState('');
  const [protectedContacts, setProtectedContacts] = useState<ContactSuppression[]>([]);
  const [conversationRealtime, setConversationRealtime] = useState<ConversationRealtimeState>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [preparedKnowledge, setPreparedKnowledge] = useState<PreparedKnowledgeContent | null>(null);
  const [knowledgeEvents, setKnowledgeEvents] = useState<ConversationKnowledgeEvent[]>([]);
  // Mantém a mesma chave idempotente enquanto uma mensagem está na fila ou em
  // reconciliação. Se o operador repetir o mesmo texto nesse intervalo, o
  // backend reconhece a solicitação em vez de criar uma segunda saída.
  const pendingMessageRequests = useRef(new Map<string, string>());
  const handoffActionLock = useRef(false);
  const messagesPanelRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousConversationRef = useRef<string | null>(null);

  const selected = conversas.find((c) => c.id === selectedId) || conversas[0];
  const selectedConversationId = selected?.id ?? null;
  const selectedMessageCount = selected?.mensagens.length ?? 0;

  const prepareKnowledge = (content: PreparedKnowledgeContent) => {
    setPreparedKnowledge(content);
    setTexto(content.text);
    setNotaInterna(false);
    setErroIA(`Conteúdo “${content.item.name}” preparado${content.sendImage ? ' com imagem oficial' : ''}. Revise o texto antes de enviar pela fila segura.`);
  };

  const openSidePanel = (tab: Exclude<SidePanelTab, 'history'>) => {
    setSidePanelTab(tab);
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1280px)').matches) setDrawerOpen(true);
  };

  // A store é hidratada de forma assíncrona. Sem uma conversa selecionada, a
  // tela não tenta acessar dados inexistentes durante a primeira renderização.
  useEffect(() => {
    if (!selectedId && conversas[0]) setSelectedId(conversas[0].id);
  }, [conversas, selectedId]);

  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (!panel || !selectedConversationId) return;
    const conversationChanged = previousConversationRef.current !== selectedConversationId;
    if (conversationChanged || shouldStickToBottomRef.current) {
      panel.scrollTo({ top: panel.scrollHeight, behavior: conversationChanged ? 'auto' : 'smooth' });
    }
    previousConversationRef.current = selectedConversationId;
  }, [selectedConversationId, selectedMessageCount]);

  useEffect(() => {
    void loadContactSuppressions().then(setProtectedContacts).catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    void loadTeamMembers()
      .then((members) => { if (active) { setTeamMembers(members.filter((member) => member.status === 'active')); setTeamError(''); } })
      .catch(() => { if (active) setTeamError('Não foi possível carregar os responsáveis ativos agora.'); })
      .finally(() => { if (active) setTeamLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const leadId = selected?.leadId;
    if (!leadId) { setKnowledgeEvents([]); return; }
    let active = true;
    void loadConversationKnowledgeEvents(leadId).then((events) => { if (active) setKnowledgeEvents(events); }).catch(() => { if (active) setKnowledgeEvents([]); });
    return () => { active = false; };
  }, [selected?.leadId, selectedMessageCount]);

  const refreshInbox = useCallback(async () => {
    await refreshConversasStore();
    setLastSyncedAt(new Date());
  }, []);

  // O histórico chega pelo mesmo canal autenticado do Supabase usado no
  // Dashboard. A interface apenas recarrega a fonte operacional após o evento;
  // ela não cria mensagens nem acessa segredos no navegador.
  useEffect(() => {
    let disposed = false;
    let refreshTimer: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshInbox(), 180);
    };

    void resolveOrganizationSession()
      .then(({ organizationId }) => {
        if (disposed) return;
        channel = supabase.channel(`atendimento-messages:${organizationId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'lead_messages',
            filter: `organization_id=eq.${organizationId}`,
          }, scheduleRefresh)
          .subscribe((status) => {
            if (disposed) return;
            setConversationRealtime(
              status === 'SUBSCRIBED'
                ? 'live'
                : ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)
                  ? 'unavailable'
                  : 'connecting',
            );
          });
      })
      .catch(() => {
        if (!disposed) setConversationRealtime('unavailable');
      });

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshInbox]);

  // Realtime é o caminho principal. O intervalo é somente uma recuperação
  // silenciosa para redes que bloqueiem WebSocket ou em caso de reconexão.
  useEffect(() => {
    void refreshInbox();
    const interval = window.setInterval(
      () => void refreshInbox(),
      conversationRealtime === 'live' ? 60_000 : 15_000,
    );
    const onFocus = () => void refreshInbox();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [conversationRealtime, refreshInbox]);

  const leadDaConversa = (conv: Conversa | undefined): Lead | null => {
    if (!conv) return null;
    if (conv.leadId) return leads.find((l) => l.id === conv.leadId) || null;
    return leads.find((l) => l.nome === conv.contato) || null;
  };

  const leadSelecionado = leadDaConversa(selected);

  const normalizeContact = (contact: string) => contact.includes('@') ? contact.trim().toLowerCase().replace(/\s+/g, '') : contact.replace(/\D/g, '');
  const contactForChannel = selected?.canal === 'email' ? leadSelecionado?.email : leadSelecionado?.whatsapp || leadSelecionado?.telefone;
  const contatoBloqueado = selected ? protectedContacts.some((item) => {
    const channel = item.channel.toLowerCase();
    return Boolean(contactForChannel) && normalizeContact(item.contact) === normalizeContact(contactForChannel) && (channel === 'all' || channel === selected.canal.toLowerCase());
  }) : false;
  const conversaTransferida = selected ? selected.status === 'transferido' : false;
  const responsabilidadeHumana = conversaTransferida
    || leadSelecionado?.modoAtendimento === 'HUMANO'
    || leadSelecionado?.automacaoStatus === 'AGUARDANDO_HUMANO';

  // Abre a conversa do lead vindo do Kanban/Leads (via ?leadId=).
  useEffect(() => {
    if (!leadIdParam) return;
    const lead = leads.find((l) => l.id === leadIdParam);
    if (!lead) return;
    let conv = conversas.find((c) => c.leadId === leadIdParam || c.contato === lead.nome);
    if (!conv) conv = criarConversa(lead);
    setSelectedId(conv.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdParam]);

  if (!selected) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">Central de Atendimento</h1>
          <p className="text-foreground-600 text-sm">Inbox multicanal com a Ana, filas, SLA e histórico pesquisável.</p>
        </div>
        <section className="bg-background-50 border border-background-200/70 rounded-xl p-8 md:p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center"><i className="ri-customer-service-2-line text-xl"></i></div>
          <h2 className="font-heading font-bold text-foreground-950">Nenhuma conversa para exibir</h2>
          <p className="mt-2 text-sm text-foreground-500 max-w-md mx-auto">Assim que um lead iniciar ou receber um atendimento, a conversa aparecerá aqui. A tela permanece disponível também enquanto os dados carregam.</p>
        </section>
      </div>
    );
  }

  const agora = () =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const enviar = async () => {
    if (enviando) return;
    const recipient = selected.canal === 'whatsapp' ? leadSelecionado?.whatsapp : leadSelecionado?.email;
    const validation = validateHumanMessage({
      text: texto,
      isInternalNote: notaInterna,
      hasLead: Boolean(leadSelecionado),
      channel: selected.canal,
      recipient,
    });
    if ('message' in validation) {
      setMessageFeedback({ tone: 'error', text: validation.message });
      return;
    }
    setErroIA('');
    setMessageFeedback(null);
    if (!notaInterna) {
      if (!leadSelecionado || !recipient) return;
      try {
        setEnviando(true);
        setMessageFeedback({ tone: 'warning', text: 'Registrando a mensagem na fila segura…' });
        const messageText = texto.trim();
        const knowledgeFingerprint = preparedKnowledge ? `${preparedKnowledge.item.id}:${preparedKnowledge.format}:${preparedKnowledge.sendImage ? 'image' : 'text'}` : 'text';
        const fingerprint = `${leadSelecionado.id}:${selected.canal}:${recipient}:${messageText}:${knowledgeFingerprint}`;
        let requestId = pendingMessageRequests.current.get(fingerprint);
        if (!requestId) {
          requestId = crypto.randomUUID();
          pendingMessageRequests.current.set(fingerprint, requestId);
        }
        const result = await queueHumanMessage({
          leadId: leadSelecionado.id,
          channel: selected.canal,
          recipient,
          text: messageText,
          requestId,
          knowledgeContent: preparedKnowledge ? {
            itemId: preparedKnowledge.item.id,
            presentationFormat: preparedKnowledge.format,
            sendImage: preparedKnowledge.sendImage,
          } : null,
        });
        if (!['queued', 'reconciliation'].includes(result.delivery)) {
          pendingMessageRequests.current.delete(fingerprint);
        }
        if (result.delivery !== 'failed') { setTexto(''); setPreparedKnowledge(null); }
        await refreshConversasStore();
        setMessageFeedback({
          tone: result.delivery === 'accepted' ? 'success' : result.delivery === 'failed' ? 'error' : 'warning',
          text: result.detail,
        });
      } catch (error) {
        setMessageFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'A mensagem não foi enfileirada.' });
      } finally {
        setEnviando(false);
      }
      return;
    }
    const nova: Mensagem = {
      id: `msg-${Date.now()}`,
      autor: 'vendedor',
      nome: 'Você',
      texto: texto.trim(),
      hora: agora(),
      notaInterna,
    };
    adicionarMensagem(selected.id, nova);
    setTexto('');
    setNotaInterna(false);
    setMessageFeedback({ tone: 'success', text: 'Nota interna registrada no histórico da conversa.' });
  };

  const runHandoffAction = async (
    action: NonNullable<typeof handoffAction>,
    operation: () => Promise<void>,
    fallbackError: string,
  ): Promise<boolean> => {
    if (handoffActionLock.current) return false;
    handoffActionLock.current = true;
    setHandoffAction(action);
    setErroIA('');
    try {
      await operation();
      await refreshConversasStore();
      return true;
    } catch {
      setErroIA(fallbackError);
      return false;
    } finally {
      handoffActionLock.current = false;
      setHandoffAction(null);
    }
  };

  const handoff = async () => {
    const lead = leadSelecionado;
    if (!lead) {
      setErroIA('Este registro não possui um lead operacional vinculado. A transferência não foi registrada.');
      return;
    }
    if (teamLoading) { setErroIA('Carregando os responsáveis ativos. Tente novamente em instantes.'); return; }
    if (!teamMembers.length) { setErroIA('Não há responsável ativo com permissão de atendimento para receber esta transferência.'); return; }
    setTransferTargetId(lead.responsavelId || '');
    setTransferOpen(true);
  };

  // O humano assume a conversa a qualquer momento: pausa a Ana (se estiver ativa)
  // e passa a interagir livremente com o lead, sem perder o histórico.
  const assumir = async () => {
    const lead = leadSelecionado;
    if (!lead) {
      setErroIA('Este registro não possui um lead operacional vinculado. O atendimento não foi assumido.');
      return;
    }
    const completed = await runHandoffAction(
      'takeover',
      () => assignHumanHandoff({ leadId: lead.id, reason: 'Atendimento assumido manualmente pelo operador', category: 'operator_takeover' }),
      'Não foi possível assumir o atendimento agora. Tente novamente.',
    );
    if (completed) setErroIA('Atendimento assumido por você. A Ana foi pausada e o histórico foi preservado.');
  };

  const confirmarTransferencia = async () => {
    const lead = leadSelecionado;
    const target = teamMembers.find((member) => member.userId === transferTargetId);
    if (!lead || !target) {
      setErroIA('Selecione um responsável ativo antes de transferir.');
      return;
    }
    const completed = await runHandoffAction(
      'transfer',
      () => assignHumanHandoff({ leadId: lead.id, reason: `Transferência manual para ${target.name}`, category: 'operator_transfer', targetUserId: target.userId }),
      'Não foi possível transferir o atendimento agora. Tente novamente.',
    );
    if (completed) {
      setTransferOpen(false);
      setTransferTargetId('');
      setErroIA(`Atendimento transferido para ${target.name}. A Ana foi pausada e o histórico foi preservado.`);
    }
  };

  // Devolve o atendimento para a Ana (reverte o "assumir").
  const devolver = async () => {
    const lead = leadSelecionado;
    if (!lead) {
      setErroIA('Este registro não possui um lead operacional vinculado. O atendimento não foi devolvido.');
      return;
    }
    await runHandoffAction(
      'return',
      () => returnConversationToAna(lead.id),
      'Não foi possível devolver o atendimento para a Ana agora.',
    );
  };

  // Prepara o orçamento no compositor. O envio continua passando pelo caminho
  // real e auditável das demais mensagens humanas.
  const propostasDoLead = leadSelecionado
    ? propostas.filter((p) => (p.leadId ? p.leadId === leadSelecionado.id : p.lead === leadSelecionado.nome))
    : [];

  const prepararOrcamento = (p: Proposta) => {
    const total = p.valor * (1 - (p.descontoPct || 0) / 100);
    const textoOrcamento = [
      `Segue o orçamento ${p.numero}:`,
      ...p.itens.map((i) => `• ${i.nome} (${i.quantidade}x) — ${i.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`),
      p.descontoPct > 0 ? `Desconto: ${p.descontoPct}%` : '',
      `Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      `Validade: ${new Date(p.validade + 'T00:00:00').toLocaleDateString('pt-BR')}`,
    ].filter(Boolean).join('\n');
    setTexto(textoOrcamento);
    setNotaInterna(false);
    setOrcamentoModal(false);
    setErroIA('Orçamento preparado no campo de mensagem. Revise e clique em enviar para usar a fila real do canal.');
  };

  const registrarOptout = async () => {
    if (!selected) return;
    const channel = selected.canal === 'whatsapp' ? 'whatsapp' : selected.canal === 'email' ? 'email' : 'instagram';
    try {
      if (!contactForChannel) throw new Error('contact_not_available');
      await addContactSuppression({ contact: contactForChannel, channel, reason: 'Opt-out solicitado pelo lead', leadId: leadSelecionado?.id });
      await loadContactSuppressions().then(setProtectedContacts);
    } catch {
      setErroIA('Não foi possível registrar o opt-out na lista real de proteção. Nenhuma alteração local foi simulada.');
      return;
    }
    const lead = leadSelecionado;
    if (lead) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, bloqueado: true, automacaoStatus: 'CONCLUIDA' } : l
        )
      );
    }
    adicionarMensagem(selected.id, {
      id: `msg-${Date.now()}`,
      autor: 'sistema',
      nome: 'Sistema',
      texto: 'Opt-out registrado. Contato adicionado à lista de supressão e cadências pausadas.',
      hora: agora(),
      notaInterna: true,
    });
    atualizarStatus(selected.id, 'resolvido');
  };

  const conversaComHumano = (conversa: Conversa) => {
    const lead = leadDaConversa(conversa);
    return conversa.status === 'transferido'
      || lead?.modoAtendimento === 'HUMANO'
      || lead?.automacaoStatus === 'AGUARDANDO_HUMANO';
  };

  const filtradas = conversas.filter((c) => {
    if (!(c.contato + c.empresa).toLowerCase().includes(busca.toLowerCase())) return false;
    if (inboxFilter === 'waiting') return c.status === 'aguardando';
    if (inboxFilter === 'human') return conversaComHumano(c);
    if (inboxFilter === 'ana') return !conversaComHumano(c) && c.status !== 'resolvido';
    return true;
  });

  const statusDaAna = responsabilidadeHumana ? 'Pausada para humano' : leadSelecionado?.modoAtendimento === 'IA' ? 'Acompanhando este lead' : 'Não atribuída';
  const shortSyncTime = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const knowledgeEventByMessage = new Map(knowledgeEvents.map((event) => [event.messageId, event]));

  return (
    <div className="wf-page space-y-5">
      <div className="wf-page-header border-b-0 pb-0 lg:items-center">
        <div>
          <h1 className="wf-page-title">
            Central de Atendimento
          </h1>
          <p className="wf-page-description">
            Converse, gerencie oportunidades e transforme atendimentos em grandes negócios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
              conversationRealtime === 'live'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : conversationRealtime === 'connecting'
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
            title={`Última sincronização: ${shortSyncTime}`}
          >
            <i className={conversationRealtime === 'connecting' ? 'ri-loader-4-line animate-spin' : 'ri-broadcast-line'} />
            {realtimeCopy[conversationRealtime]}
          </span>
          <button
            type="button"
            onClick={() => void refreshInbox()}
            className="wf-btn-secondary cursor-pointer whitespace-nowrap"
            title="Atualizar a Central agora"
          >
            <i className="ri-refresh-line" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid min-h-[600px] grid-cols-1 gap-4 lg:h-[calc(100vh-208px)] lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.7fr)] xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,340px)]">
        {/* Lista de conversas */}
        <div className="wf-surface flex min-h-[280px] max-h-[360px] flex-col overflow-hidden lg:max-h-none">
          <div className="border-b border-background-200/70 bg-background-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground-900">Conversas</p>
                <p className="text-xs text-foreground-500">{filtradas.length} na caixa atual</p>
              </div>
              <span className="rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
                {conversas.reduce((total, conversa) => total + conversa.naoLidas, 0)} novas
              </span>
            </div>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conversa..."
                className="w-full pl-9 pr-4 py-2 bg-background-100 border border-background-200/70 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
              />
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5" aria-label="Filtrar conversas">
              {inboxFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setInboxFilter(filter.id)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    inboxFilter === filter.id
                      ? 'bg-primary-500 text-background-50'
                      : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtradas.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-foreground-500">
                Nenhuma conversa neste filtro.
              </div>
            )}
            {filtradas.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-start gap-3 border-b border-background-100 px-4 py-4 text-left transition-colors cursor-pointer ${
                  selected.id === c.id ? 'border-l-[3px] border-l-primary-500 bg-[#e8f7ef]' : 'border-l-[3px] border-l-transparent hover:bg-background-50/50'
                }`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100">
                  <span className="text-sm font-bold text-primary-700">{c.contato.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words text-sm font-semibold leading-5 text-foreground-900">{c.contato}</p>
                    <span className="shrink-0 whitespace-nowrap text-xs text-foreground-400">{c.hora}</span>
                  </div>
                  <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-foreground-500">{c.ultimaMensagem}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium ${statusCores[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                    <span className="text-[10px] text-foreground-400"><i className={`${c.canal === 'whatsapp' ? 'ri-whatsapp-line text-emerald-600' : c.canal === 'email' ? 'ri-mail-line' : 'ri-instagram-line'} mr-1`} />{c.canal}</span>
                  </div>
                </div>
                {c.naoLidas > 0 && (
                  <span className="w-5 h-5 bg-primary-500 text-background-50 rounded-full text-[10px] flex items-center justify-center flex-shrink-0">
                    {c.naoLidas}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="wf-surface flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-background-200/70 bg-background-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
                <span className="font-bold text-primary-700">{selected.contato.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-foreground-900">{selected.contato}</p>
                <p className="whitespace-normal break-words text-xs leading-5 text-foreground-500">
                  <i className={selected.canal === 'whatsapp' ? 'ri-whatsapp-line mr-1 text-emerald-600' : selected.canal === 'email' ? 'ri-mail-line mr-1' : 'ri-instagram-line mr-1'} />
                  {selected.empresa} · {statusDaAna}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openSidePanel('lead')}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer transition-colors lg:hidden"
                title="Painel do lead"
              >
                <i className="ri-side-bar-line"></i>
              </button>
              <button onClick={() => openSidePanel('lead')} className="hidden items-center gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition hover:bg-background-100 sm:inline-flex" title="Abrir dados completos do lead">
                Painel <i className="ri-side-bar-line text-base" />
              </button>
              <button
                onClick={() => setOptoutConfirmar(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-100 text-foreground-500 hover:text-accent-700 cursor-pointer transition-colors"
                title="Registrar opt-out"
              >
                <i className="ri-forbid-2-line text-base"></i>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-background-200/70 bg-background-50 px-4 py-3">
            <span className="mr-1 inline-flex items-center text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Atendimento</span>
            {!responsabilidadeHumana ? (
              <button onClick={() => void assumir()} disabled={handoffAction !== null} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-800 transition hover:bg-primary-100 disabled:cursor-wait disabled:opacity-50">
                <i className="ri-user-received-line text-base" />{handoffAction === 'takeover' ? 'Assumindo...' : 'Assumir'}
              </button>
            ) : (
              <button onClick={() => void devolver()} disabled={handoffAction !== null} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-800 transition hover:bg-primary-100 disabled:cursor-wait disabled:opacity-50">
                <i className="ri-robot-line text-base" />{handoffAction === 'return' ? 'Devolvendo...' : 'Retomar Ana'}
              </button>
            )}
            {!responsabilidadeHumana && (
              <button onClick={() => void handoff()} disabled={handoffAction !== null} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-background-200 bg-white px-3 text-xs font-semibold text-foreground-700 transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-wait disabled:opacity-50">
                <i className="ri-arrow-left-right-line text-base" />{handoffAction === 'transfer' ? 'Transferindo...' : 'Transferir'}
              </button>
            )}
          </div>

          {contatoBloqueado && (
            <div className="px-5 py-2.5 bg-accent-50 border-b border-accent-200 flex items-center gap-2 text-xs text-accent-800">
              <i className="ri-shield-check-line"></i>
              Contato na lista de supressão (LGPD). A Ana está bloqueada de enviar mensagens.
            </div>
          )}
          {!contatoBloqueado && responsabilidadeHumana && (
            <div className="px-5 py-2.5 bg-primary-50 border-b border-primary-200 flex items-center gap-2 text-xs text-primary-800">
              <i className="ri-user-received-line"></i>
              Atendimento sob responsabilidade humana. A Ana está pausada para este lead; o histórico permanece nesta Central.
            </div>
          )}

          <div
            ref={messagesPanelRef}
            onScroll={(event) => {
              const panel = event.currentTarget;
              shouldStickToBottomRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 96;
            }}
            className="flex-1 space-y-4 overflow-y-auto bg-[#f7f8f7] p-4 md:p-5"
            role="log"
            aria-live="polite"
            aria-label={`Mensagens de ${selected.contato}`}
          >
            <div className="flex justify-center">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground-500 shadow-sm">
                {selected.protocolo} · SLA {selected.sla}
              </span>
            </div>
            {selected.mensagens.map((m) => {
              if (m.autor === 'sistema' || m.notaInterna) {
                return (
                  <div key={m.id} className="flex justify-center">
                    <div className="bg-accent-100/70 border border-accent-200 text-accent-800 text-xs px-3 py-1.5 rounded-full max-w-md text-center">
                      {m.notaInterna && <span className="font-bold">Nota interna · </span>}
                      {m.texto}
                    </div>
                  </div>
                );
              }
              if (m.autor === 'vendedor') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[75%]">
                      <div className="rounded-2xl rounded-br-md bg-[#d9fdd3] px-4 py-2.5 text-sm text-[#111b21] shadow-sm">
                        {m.texto}
                      </div>
                      <p className="text-[10px] text-foreground-400 text-right mt-1">{m.nome} · {m.hora}{m.statusEnvio ? ` · ${deliveryLabel[m.statusEnvio]}` : ''}</p>
                      {knowledgeEventByMessage.get(m.id)?.item && (
                        <div className="mt-2 ml-auto flex max-w-[260px] items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-2 text-left">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-100 text-primary-700">
                            {knowledgeEventByMessage.get(m.id)?.item?.imageUrl ? <img src={knowledgeEventByMessage.get(m.id)?.item?.imageUrl || ''} alt="" className="h-full w-full object-cover" /> : <i className="ri-bookmark-3-line text-xs" />}
                          </span>
                          <span className="min-w-0"><span className="block truncate text-[11px] font-bold text-primary-900">{knowledgeEventByMessage.get(m.id)?.mediaQueued ? 'Imagem e conteúdo vinculados' : 'Conteúdo vinculado'} · {knowledgeEventByMessage.get(m.id)?.item?.name}</span><span className="block text-[10px] text-primary-700">{knowledgeEventByMessage.get(m.id)?.presentationFormat === 'technical' ? 'Formato técnico' : knowledgeEventByMessage.get(m.id)?.presentationFormat === 'commercial' ? 'Formato comercial' : 'Conteúdo rastreável'}{knowledgeEventByMessage.get(m.id)?.mediaQueued ? ' · mídia na fila' : ''}</span></span>
                        </div>
                      )}
                      {(m.correlationId || m.providerMessageId || m.historicoStatus?.length) && (
                        <details className="mt-1 text-right text-[10px] text-foreground-500">
                          <summary className="cursor-pointer select-none">ver trilha da mensagem</summary>
                          <div className="mt-1 rounded-lg border border-background-200 bg-white p-2 text-left leading-relaxed">
                            <p>Direção: enviada · Canal: {selected.canal}</p>
                            <p>ID interno: {m.id}</p>
                            <p>Correlation ID: {m.correlationId || 'não informado'}</p>
                            <p>ID do provedor: {m.providerMessageId || 'não informado'}</p>
                            <p>Tentativas: {m.tentativas ?? 0}</p>
                            {m.historicoStatus?.map((item, index) => <p key={`${item.label}-${index}`}>{item.label}: {formatTraceDate(item.at)}</p>)}
                            {m.erroTecnico && <p>Detalhe técnico: {m.erroTecnico.slice(0, 120)}</p>}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                );
              }
              const isAna = m.autor === 'ana';
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="flex gap-2.5 max-w-[75%]">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isAna ? 'bg-secondary-500 text-background-50' : 'bg-background-200 text-foreground-600'}`}>
                      {isAna ? <i className="ri-robot-line text-xs"></i> : <span className="text-xs font-bold">{m.nome.charAt(0)}</span>}
                    </div>
                    <div>
                      <div className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm shadow-sm ${isAna ? 'bg-primary-100 text-primary-950' : 'bg-white text-foreground-800'}`}>
                        {m.texto}
                      </div>
                      <p className="text-[10px] text-foreground-400 mt-1">{m.nome} · {m.hora}{m.statusEnvio ? ` · ${deliveryLabel[m.statusEnvio]}` : ''}</p>
                      {(m.correlationId || m.providerMessageId || m.historicoStatus?.length) && (
                        <details className="mt-1 text-[10px] text-foreground-400">
                          <summary className="cursor-pointer select-none">ver trilha da mensagem</summary>
                          <div className="mt-1 rounded-lg border border-background-200 bg-white p-2 leading-relaxed">
                            <p>Direção: {m.autor === 'cliente' ? 'recebida' : 'enviada'} · Canal: {selected.canal}</p>
                            <p>ID interno: {m.id}</p>
                            <p>Correlation ID: {m.correlationId || 'não informado'}</p>
                            <p>ID do provedor: {m.providerMessageId || 'não informado'}</p>
                            <p>Tentativas: {m.tentativas ?? 0}</p>
                            {m.historicoStatus?.map((item, index) => <p key={`${item.label}-${index}`}>{item.label}: {formatTraceDate(item.at)}</p>)}
                            {m.erroTecnico && <p>Detalhe técnico: {m.erroTecnico.slice(0, 120)}</p>}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-background-200/70 bg-background-50 px-4 py-3">
            {notaInterna && (
              <div className="mb-2 inline-flex items-center gap-2 bg-accent-100 text-accent-800 text-xs px-3 py-1.5 rounded-full">
                <i className="ri-lock-line"></i>
                Modo nota interna ativado
                <button onClick={() => setNotaInterna(false)} className="cursor-pointer hover:text-accent-600">
                  <i className="ri-close-line"></i>
                </button>
              </div>
            )}
            {preparedKnowledge && !notaInterna && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-900">
                <span className="min-w-0 whitespace-normal break-words"><i className="ri-bookmark-3-line mr-1.5" />Conteúdo preparado: <strong>{preparedKnowledge.item.name}</strong> · {preparedKnowledge.format === 'technical' ? 'técnico' : preparedKnowledge.format === 'commercial' ? 'comercial' : 'rápido'}</span>
                <button type="button" onClick={() => setPreparedKnowledge(null)} className="shrink-0 text-primary-700 hover:text-primary-900" title="Remover vínculo do conteúdo"><i className="ri-close-line text-base" /></button>
              </div>
            )}
            {!notaInterna && (
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="shrink-0 text-[11px] font-semibold text-foreground-500">Atalhos:</span>
                {respostasRapidas.slice(0, 3).map((resposta) => (
                  <button
                    key={resposta}
                    type="button"
                    onClick={() => setTexto(resposta)}
                    className="shrink-0 rounded-full border border-background-200 bg-background-50 px-2.5 py-1 text-[11px] font-medium text-foreground-600 transition hover:border-primary-200 hover:text-primary-700"
                    title="Inserir no campo de mensagem para revisar antes de enviar"
                  >
                    {resposta.length > 28 ? `${resposta.slice(0, 28)}…` : resposta}
                  </button>
                ))}
              </div>
            )}
            <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void enviar(); }}>
              <button
                type="button"
                onClick={() => setNotaInterna(!notaInterna)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${notaInterna ? 'bg-accent-500 text-background-50' : 'bg-background-100 text-foreground-500 hover:bg-background-200'}`}
                title="Nota interna"
              >
                <i className="ri-lock-line text-base"></i>
              </button>
              {!notaInterna && (
                <button
                  type="button"
                  onClick={() => openSidePanel('knowledge')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-background-100 px-2.5 text-xs font-semibold text-foreground-600 transition hover:bg-primary-100 hover:text-primary-800"
                  title="Buscar produtos, serviços e catálogos"
                >
                  <i className="ri-book-open-line text-base" />
                  <span className="hidden sm:inline">Conhecimento</span>
                </button>
              )}
              <div className="relative flex-1">
                <textarea
                  value={texto}
                  onChange={(e) => { setTexto(e.target.value); if (preparedKnowledge && e.target.value !== preparedKnowledge.text) setPreparedKnowledge(null); }}
                  placeholder={notaInterna ? 'Digite uma nota interna...' : 'Digite uma mensagem para a fila segura...'}
                  rows={1}
                  className="max-h-28 min-h-10 w-full resize-y rounded-xl border border-background-200/70 bg-background-50 px-4 py-2.5 text-sm text-foreground-800 placeholder-foreground-400 focus:border-primary-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="w-10 h-10 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 rounded-lg flex items-center justify-center cursor-pointer disabled:cursor-wait transition-colors"
                title={enviando ? 'Registrando mensagem...' : !texto.trim() ? 'Digite uma mensagem para enviar' : 'Enviar mensagem'}
              >
                <i className={enviando ? 'ri-loader-4-line animate-spin text-base' : 'ri-send-plane-fill text-base'}></i>
              </button>
            </form>
            {messageFeedback && <p role={messageFeedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-2 rounded-lg px-3 py-2 text-xs leading-5 ${messageFeedback.tone === 'success' ? 'bg-primary-50 text-primary-900' : messageFeedback.tone === 'warning' ? 'bg-accent-50 text-accent-800' : 'bg-accent-100 text-accent-800'}`}><i className={`${messageFeedback.tone === 'success' ? 'ri-checkbox-circle-line' : messageFeedback.tone === 'warning' ? 'ri-time-line' : 'ri-error-warning-line'} mr-1.5`} />{messageFeedback.text}</p>}
            {erroIA && <p className="mt-1.5 text-xs text-foreground-500">{erroIA}</p>}
          </div>
        </div>

        <aside className="hidden min-h-0 xl:flex">
          <section className="wf-surface flex min-h-0 flex-1 flex-col overflow-hidden">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-background-200/70 bg-background-50 p-2" aria-label="Painel comercial">
              {sidePanelTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSidePanelTab(tab.id)}
                  aria-selected={sidePanelTab === tab.id}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${sidePanelTab === tab.id ? 'bg-primary-500 text-background-50 shadow-sm' : 'text-foreground-500 hover:bg-background-100 hover:text-foreground-800'}`}
                >
                  <i className={tab.icon} />{tab.label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {(sidePanelTab === 'lead' || sidePanelTab === 'history') && <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{(leadSelecionado?.nome || selected.contato).charAt(0)}</div>
                  <div className="min-w-0"><p className="break-words text-base font-bold leading-5 text-foreground-900">{leadSelecionado?.nome || selected.contato}</p><p className="mt-1 whitespace-normal break-words text-xs leading-5 text-foreground-500">{leadSelecionado?.empresa || selected.empresa}</p></div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-background-100 py-3 text-xs">
                  <div><dt className="text-foreground-500">Etapa</dt><dd className="mt-0.5 font-semibold text-foreground-800">{leadSelecionado?.etapa || selected.fila}</dd></div>
                  <div><dt className="text-foreground-500">Responsável</dt><dd className="mt-0.5 font-semibold text-foreground-800">{responsabilidadeHumana ? leadSelecionado?.responsavel || 'Atendimento humano' : 'Ana (IA)'}</dd></div>
                  <div><dt className="text-foreground-500">Canal</dt><dd className="mt-0.5 font-semibold capitalize text-foreground-800">{selected.canal}</dd></div>
                  <div><dt className="text-foreground-500">Contato</dt><dd className="mt-0.5 break-words font-semibold leading-5 text-foreground-800" title={contactForChannel || undefined}>{contactForChannel || 'Não informado'}</dd></div>
                </dl>
                <div className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-3"><div className="flex items-start gap-2.5"><i className="ri-robot-line mt-0.5 text-primary-700" /><div><p className="text-xs font-bold text-primary-900">Ana</p><p className="mt-0.5 text-xs leading-5 text-primary-800">{statusDaAna}</p></div></div></div>
                <button type="button" onClick={() => leadSelecionado && navigate(`/dashboard/kanban?leadId=${encodeURIComponent(leadSelecionado.id)}`)} disabled={!leadSelecionado} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-xs font-semibold text-foreground-700 transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><i className="ri-layout-column-line" />Ver no Kanban</button>
              </div>}
              {sidePanelTab === 'knowledge' && <ConversationKnowledgePanel context={selected.mensagens.slice().reverse().find((message) => message.autor === 'cliente')?.texto || ''} onPrepare={prepareKnowledge} />}
              {sidePanelTab === 'quotes' && <div className="space-y-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-foreground-900">Orçamentos</p><p className="mt-1 text-xs leading-5 text-foreground-500">{propostasDoLead.length} vínculo(s) deste lead.</p></div><button type="button" onClick={() => setOrcamentoModal(true)} className="shrink-0 text-xs font-semibold text-primary-700 hover:text-primary-800">Abrir</button></div><button type="button" onClick={() => setOrcamentoModal(true)} disabled={!leadSelecionado} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-2.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"><i className="ri-file-add-line" />Criar orçamento</button>{propostasDoLead.length === 0 ? <p className="rounded-lg border border-dashed border-background-300 px-3 py-4 text-xs leading-5 text-foreground-500">Nenhuma proposta vinculada a este lead.</p> : <div className="space-y-2">{propostasDoLead.slice(0, 3).map((proposta) => <button key={proposta.id} type="button" onClick={() => setOrcamentoModal(true)} className="w-full rounded-lg border border-background-100 bg-background-50 px-3 py-2.5 text-left transition hover:border-primary-200"><p className="text-xs font-semibold text-foreground-800">{proposta.numero}</p><p className="mt-0.5 text-[11px] text-foreground-500">{proposta.status === 'rascunho' ? 'Rascunho' : proposta.status}</p></button>)}</div>}</div>}
              {sidePanelTab === 'agenda' && <div className="space-y-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><i className="ri-calendar-event-line text-xl" /></div><div><p className="text-sm font-bold text-foreground-900">Agenda do lead</p><p className="mt-1 text-xs leading-5 text-foreground-500">Consulte a disponibilidade ou crie um compromisso mantendo este lead vinculado.</p></div><button type="button" onClick={() => leadSelecionado && navigate(`/dashboard/agenda?leadId=${encodeURIComponent(leadSelecionado.id)}&new=1`)} disabled={!leadSelecionado} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-2.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"><i className="ri-calendar-event-line" />Agendar reunião</button><button type="button" onClick={() => leadSelecionado && navigate(`/dashboard/agenda?leadId=${encodeURIComponent(leadSelecionado.id)}`)} disabled={!leadSelecionado} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-xs font-semibold text-foreground-700 transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><i className="ri-calendar-line" />Abrir agenda</button></div>}
            </div>
          </section>
        </aside>
      </div>

      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/50 p-4" onClick={() => setTransferOpen(false)}>
          <section className="w-full max-w-md rounded-xl bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()} aria-labelledby="transfer-title">
            <header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4">
              <div><h3 id="transfer-title" className="font-heading font-bold text-foreground-950">Transferir atendimento</h3><p className="mt-0.5 text-xs text-foreground-500">A Ana será pausada e o histórico permanecerá vinculado ao lead.</p></div>
              <button type="button" onClick={() => setTransferOpen(false)} className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" aria-label="Fechar transferência"><i className="ri-close-line" /></button>
            </header>
            <div className="space-y-3 p-5">
              <label className="block text-sm font-semibold text-foreground-800">Responsável que receberá<select value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900"><option value="">Selecione um responsável ativo</option>{teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.role}</option>)}</select></label>
              {teamError && <p role="alert" className="text-xs text-accent-700"><i className="ri-error-warning-line mr-1" />{teamError}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" onClick={() => setTransferOpen(false)} className="wf-btn-secondary">Cancelar</button><button type="button" disabled={!transferTargetId || handoffAction !== null} onClick={() => void confirmarTransferencia()} className="wf-btn-primary disabled:cursor-not-allowed disabled:opacity-50">{handoffAction === 'transfer' ? 'Transferindo…' : 'Confirmar transferência'}</button></footer>
          </section>
        </div>
      )}

      {optoutConfirmar && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setOptoutConfirmar(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Bloquear contato (opt-out)</h3>
              <button onClick={() => setOptoutConfirmar(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-alarm-warning-line text-accent-600 text-lg"></i>
                </div>
                <p className="text-sm text-foreground-700">
                  Você está prestes a bloquear <b>{selected.contato}</b>. Esta ação é <b>irreversível</b>: o contato será adicionado à lista de supressão (LGPD) e a Ana não poderá mais enviar mensagens.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setOptoutConfirmar(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button
                onClick={() => { setOptoutConfirmar(false); void registrarOptout(); }}
                className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                Confirmar bloqueio
              </button>
            </div>
          </div>
        </div>
      )}

      {orcamentoModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setOrcamentoModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Preparar orçamento no chat</h3>
                <p className="text-sm text-foreground-500">{leadSelecionado?.nome || selected?.contato} · {selected?.empresa}</p>
              </div>
              <button onClick={() => setOrcamentoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {propostasDoLead.length === 0 ? (
                <div className="text-center py-10 text-foreground-400 text-sm">
                  <i className="ri-file-list-3-line text-3xl mb-3 block"></i>
                  Nenhum orçamento para este lead ainda.
                  <p className="mt-2 text-xs">Crie uma proposta e volte aqui para revisá-la antes de enviar pela fila segura.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrcamentoModal(false);
                      if (leadSelecionado) navigate(`/dashboard/orcamentos?leadId=${encodeURIComponent(leadSelecionado.id)}&new=1`);
                    }}
                    disabled={!leadSelecionado}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-xs font-semibold text-background-50 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
                  >
                    <i className="ri-file-add-line" />
                    Criar proposta
                  </button>
                </div>
              ) : (
                propostasDoLead.map((p) => {
                  const total = p.valor * (1 - (p.descontoPct || 0) / 100);
                  return (
                    <div key={p.id} className="border border-background-200/70 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground-900 text-sm">{p.numero}</p>
                          <p className="text-xs text-foreground-500 mt-0.5">
                            {p.itens.length} item(ns) · validade {new Date(p.validade + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-foreground-900 text-sm">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${p.status === 'enviada' || p.status === 'visualizada' || p.status === 'aceita' ? 'bg-primary-100 text-primary-700' : p.status === 'aguardando_aprovacao' ? 'bg-accent-100 text-accent-700' : 'bg-background-200 text-foreground-600'}`}>
                            {p.status === 'rascunho' ? 'Rascunho' : p.status === 'enviada' ? 'Enviada' : p.status === 'visualizada' ? 'Visualizada' : p.status === 'aceita' ? 'Aceita' : p.status === 'aguardando_aprovacao' ? 'Aguardando aprovação' : p.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2">
                        {p.status === 'aguardando_aprovacao' && (
                          <span className="text-xs text-accent-700 flex items-center gap-1">
                            <i className="ri-shield-check-line"></i> Aprove o desconto para enviar
                          </span>
                        )}
                        {p.status !== 'aguardando_aprovacao' && p.status !== 'aceita' && (
                          <button
                            onClick={() => prepararOrcamento(p)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-send-plane-2-line"></i>
                            Preparar no chat
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end">
              <button onClick={() => setOrcamentoModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <ConversaDrawer
          conversa={selected}
          lead={leadSelecionado}
          activeTab={sidePanelTab}
          quoteCount={propostasDoLead.length}
          anaStatus={statusDaAna}
          knowledgePanel={<ConversationKnowledgePanel context={selected.mensagens.slice().reverse().find((message) => message.autor === 'cliente')?.texto || ''} onPrepare={(content) => { prepareKnowledge(content); setDrawerOpen(false); }} />}
          onClose={() => setDrawerOpen(false)}
          onTabChange={setSidePanelTab}
          onOpenQuotes={() => { setDrawerOpen(false); setOrcamentoModal(true); }}
          onOpenAgenda={(create) => leadSelecionado && navigate(`/dashboard/agenda?leadId=${encodeURIComponent(leadSelecionado.id)}${create ? '&new=1' : ''}`)}
          onOpenKanban={() => leadSelecionado && navigate(`/dashboard/kanban?leadId=${encodeURIComponent(leadSelecionado.id)}`)}
        />
      )}
    </div>
  );
}
