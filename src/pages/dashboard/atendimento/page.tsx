import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import { refreshConversasStore, useConversasStore } from '@/hooks/useConversasStore';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import type { Proposta } from '@/mocks/propostasData';
import { requestHumanHandoff, returnConversationToAna } from '@/lib/crm/handoffsRepository';
import { addContactSuppression, loadContactSuppressions, type ContactSuppression } from '@/lib/crm/suppressionRepository';
import { queueHumanMessage } from '@/lib/crm/humanMessageRepository';
import ConversaDrawer from './components/ConversaDrawer';

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

export default function Atendimento() {
  const { conversas, adicionarMensagem, atualizarStatus, criarConversa } = useConversasStore();
  const [leads, setLeads] = useLeadsStore();
  const { propostas } = usePropostasStore();
  const [assumido, setAssumido] = useState(false);
  const [orcamentoModal, setOrcamentoModal] = useState(false);
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [notaInterna, setNotaInterna] = useState(false);
  const [busca, setBusca] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optoutConfirmar, setOptoutConfirmar] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const [protectedContacts, setProtectedContacts] = useState<ContactSuppression[]>([]);

  const selected = conversas.find((c) => c.id === selectedId) || conversas[0];

  // A store é hidratada de forma assíncrona. Sem uma conversa selecionada, a
  // tela não tenta acessar dados inexistentes durante a primeira renderização.
  useEffect(() => {
    if (!selectedId && conversas[0]) setSelectedId(conversas[0].id);
  }, [conversas, selectedId]);

  useEffect(() => {
    void loadContactSuppressions().then(setProtectedContacts).catch(() => undefined);
  }, []);

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
    if (!texto.trim()) return;
    setErroIA('');
    if (!notaInterna) {
      if (!leadSelecionado) {
        setErroIA('Este registro não possui um lead operacional vinculado. A mensagem não foi enviada.');
        return;
      }
      try {
        await queueHumanMessage({
          leadId: leadSelecionado.id,
          channel: selected.canal,
          recipient: selected.canal === 'whatsapp' ? leadSelecionado.whatsapp : leadSelecionado.email,
          text: texto.trim(),
        });
        setTexto('');
        await refreshConversasStore();
      } catch (error) {
        setErroIA(error instanceof Error ? error.message : 'A mensagem não foi enfileirada.');
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
  };

  const handoff = async () => {
    const lead = leadSelecionado;
    if (!lead) return;
    try {
      await requestHumanHandoff(lead.id, 'Transferência manual solicitada pelo operador');
    } catch (error) {
      console.error('[handoff] falha ao persistir transferência', error);
      setErroIA('Não foi possível registrar a transferência agora. Tente novamente.');
      return;
    }
    atualizarStatus(selected.id, 'transferido');
    setAssumido(false);
  };

  // O humano assume a conversa a qualquer momento: pausa a Ana (se estiver ativa)
  // e passa a interagir livremente com o lead, sem perder o histórico.
  const assumir = async () => {
    const lead = leadSelecionado;
    if (!lead) return;
    try {
      await requestHumanHandoff(lead.id, 'Atendimento assumido manualmente pelo operador', 'takeover');
    } catch (error) {
      console.error('[handoff] falha ao assumir atendimento', error);
      setErroIA('Não foi possível assumir o atendimento agora. Tente novamente.');
      return;
    }
    setAssumido(true);
    adicionarMensagem(selected.id, {
      id: `msg-sys-${Date.now()}`,
      autor: 'sistema',
      nome: 'Sistema',
      texto: 'Você assumiu o atendimento. A Ana foi pausada neste lead — agora você interage diretamente.',
      hora: agora(),
      notaInterna: true,
    });
  };

  // Devolve o atendimento para a Ana (reverte o "assumir").
  const devolver = async () => {
    const lead = leadSelecionado;
    if (!lead) return;
    try {
      await returnConversationToAna(lead.id);
    } catch (error) {
      console.error('[handoff] falha ao devolver para Ana', error);
      setErroIA('Não foi possível devolver o atendimento para a Ana agora.');
      return;
    }
    setAssumido(false);
    adicionarMensagem(selected.id, {
      id: `msg-sys-${Date.now()}`,
      autor: 'sistema',
      nome: 'Sistema',
      texto: 'Atendimento devolvido para a Ana.',
      hora: agora(),
      notaInterna: true,
    });
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

  const filtradas = conversas.filter((c) =>
    (c.contato + c.empresa).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Inbox multicanal</p>
          <h1 className="wf-page-title mt-1">
            Central de Atendimento
          </h1>
          <p className="wf-page-description">
            Inbox multicanal com a Ana, filas, SLA e histórico pesquisável.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="wf-btn-secondary cursor-pointer whitespace-nowrap"
          >
            <i className="ri-side-bar-line"></i>
            Painel do lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[520px] lg:h-[calc(100vh-220px)]">
        {/* Lista de conversas */}
        <div className="lg:col-span-1 wf-surface flex flex-col overflow-hidden min-h-[280px] max-h-[360px] lg:max-h-none">
          <div className="p-4 border-b border-background-200/70">
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
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtradas.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-background-100 text-left transition-colors cursor-pointer ${
                  selectedId === c.id ? 'bg-primary-50' : 'hover:bg-background-50/50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-background-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-foreground-700 font-bold text-sm">{c.contato.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground-900 text-sm truncate">{c.contato}</p>
                    <span className="text-xs text-foreground-400 whitespace-nowrap">{c.hora}</span>
                  </div>
                  <p className="text-xs text-foreground-500 truncate mt-0.5">{c.ultimaMensagem}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium ${statusCores[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                    <span className="text-[10px] text-foreground-400">{c.canal}</span>
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
        <div className="lg:col-span-2 wf-surface flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-background-200/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 font-bold">{selected.contato.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-foreground-900 text-sm">{selected.contato}</p>
                <p className="text-xs text-foreground-500">
                  {selected.protocolo} · {selected.empresa} · SLA {selected.sla}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer transition-colors lg:hidden"
                title="Painel do lead"
              >
                <i className="ri-side-bar-line"></i>
              </button>
              <button
                onClick={() => setOrcamentoModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                title="Buscar e enviar orçamento"
              >
                <i className="ri-file-list-3-line"></i>
                Orçamento
              </button>
              {!assumido ? (
                <button
                  onClick={assumir}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-user-received-line"></i>
                  Assumir
                </button>
              ) : (
                <button
                  onClick={devolver}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-robot-line"></i>
                  Devolver p/ Ana
                </button>
              )}
              <button
                onClick={() => setOptoutConfirmar(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-100 text-foreground-500 hover:text-accent-700 cursor-pointer transition-colors"
                title="Registrar opt-out"
              >
                <i className="ri-forbid-2-line text-base"></i>
              </button>
              <button
                onClick={handoff}
                className="inline-flex items-center gap-2 px-3 py-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-user-add-line"></i>
                Transferir
              </button>
            </div>
          </div>

          {contatoBloqueado && (
            <div className="px-5 py-2.5 bg-accent-50 border-b border-accent-200 flex items-center gap-2 text-xs text-accent-800">
              <i className="ri-shield-check-line"></i>
              Contato na lista de supressão (LGPD). A Ana está bloqueada de enviar mensagens.
            </div>
          )}
          {!contatoBloqueado && assumido && (
            <div className="px-5 py-2.5 bg-primary-50 border-b border-primary-200 flex items-center gap-2 text-xs text-primary-800">
              <i className="ri-user-received-line"></i>
              Você assumiu este atendimento — a Ana está pausada. Envie mensagens livremente.
            </div>
          )}
          {!contatoBloqueado && conversaTransferida && (
            <div className="px-5 py-2.5 bg-secondary-50 border-b border-secondary-200 flex items-center gap-2 text-xs text-secondary-800">
              <i className="ri-user-shared-line"></i>
              Atendimento transferido para um humano. A Ana não responde automaticamente.
            </div>
          )}
          {!contatoBloqueado && !conversaTransferida && leadSelecionado && (leadSelecionado.modoAtendimento ?? 'IA') === 'HUMANO' && (
            <div className="px-5 py-2.5 bg-secondary-50 border-b border-secondary-200 flex items-center gap-2 text-xs text-secondary-800">
              <i className="ri-user-line"></i>
              Lead em modo humano — a Ana não envia mensagens automáticas.
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background-50">
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
                      <div className="bg-primary-500 text-background-50 rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                        {m.texto}
                      </div>
                      <p className="text-[10px] text-foreground-400 text-right mt-1">{m.nome} · {m.hora}</p>
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
                      <div className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm ${isAna ? 'bg-secondary-100 text-secondary-900' : 'bg-background-100 text-foreground-800'}`}>
                        {m.texto}
                      </div>
                      <p className="text-[10px] text-foreground-400 mt-1">{m.nome} · {m.hora}{m.statusEnvio === 'aguardando' ? ' · aguardando fila' : m.statusEnvio === 'enviada' ? ' · enviada' : m.statusEnvio === 'falhou' ? ' · falhou' : m.statusEnvio === 'reconciliacao' ? ' · em reconciliação' : ''}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-background-200/70">
            {notaInterna && (
              <div className="mb-2 inline-flex items-center gap-2 bg-accent-100 text-accent-800 text-xs px-3 py-1.5 rounded-full">
                <i className="ri-lock-line"></i>
                Modo nota interna ativado
                <button onClick={() => setNotaInterna(false)} className="cursor-pointer hover:text-accent-600">
                  <i className="ri-close-line"></i>
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNotaInterna(!notaInterna)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${notaInterna ? 'bg-accent-500 text-background-50' : 'bg-background-100 text-foreground-500 hover:bg-background-200'}`}
                title="Nota interna"
              >
                <i className="ri-lock-line text-base"></i>
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void enviar(); }}
                  placeholder={notaInterna ? 'Digite uma nota interna...' : 'Digite uma mensagem para a fila segura...'}
                  className="w-full px-4 py-2.5 bg-background-100 border border-background-200/70 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
                />
              </div>
              <button
                onClick={() => void enviar()}
                className="w-10 h-10 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className="ri-send-plane-fill text-base"></i>
              </button>
            </div>
            {erroIA && <p className="mt-1.5 text-xs text-foreground-500">{erroIA}</p>}
          </div>
        </div>
      </div>

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
                  <p className="mt-2 text-xs">Crie uma proposta no menu Orçamentos e volte aqui para enviá-la.</p>
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
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
