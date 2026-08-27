import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Conversa, Mensagem } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';
import { responderMensagem } from '@/hooks/useAnaResposta';
import { autocompletarTexto } from '@/lib/anaIA';
import { useSupressaoStore } from '@/hooks/useSupressaoStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';
import { useRespostasRapidasStore } from '@/hooks/useRespostasRapidasStore';
import { useVariaveisGlobaisStore } from '@/hooks/useVariaveisGlobaisStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import type { Proposta } from '@/mocks/propostasData';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';
import { requestHumanHandoff, returnConversationToAna } from '@/lib/crm/handoffsRepository';
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

const simulacoesCliente = [
  'Quanto custa para criar um site?',
  'Vocês trabalham com tráfego pago?',
  'Qual o prazo de entrega?',
  'Está muito caro para o nosso momento, vocês tem desconto?',
  'Gostaria de agendar uma reunião para conhecer melhor.',
  'Quero saber mais sobre o plano Pro.',
];

export default function Atendimento() {
  const { conversas, adicionarMensagem, atualizarStatus, criarConversa } = useConversasStore();
  const [leads, setLeads] = useLeadsStore();
  const fluxo = useFluxoComercial();
  const { config } = useConfiguracaoStore();
  const { estaBloqueado, adicionar } = useSupressaoStore();
  const { respostas } = useRespostasRapidasStore();
  const { variaveis } = useVariaveisGlobaisStore();
  const { settings } = useEmpresaSettingsStore();
  const { propostas, atualizar: atualizarProposta } = usePropostasStore();
  const [assumido, setAssumido] = useState(false);
  const [orcamentoModal, setOrcamentoModal] = useState(false);
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get('leadId');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [anaPausada, setAnaPausada] = useState(false);
  const [notaInterna, setNotaInterna] = useState(false);
  const [busca, setBusca] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anaDigitando, setAnaDigitando] = useState(false);
  const [optoutConfirmar, setOptoutConfirmar] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState('');
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroIA, setErroIA] = useState('');
  const indiceSimulacao = useRef(0);

  const selected = conversas.find((c) => c.id === selectedId) || conversas[0];

  const leadDaConversa = (conv: Conversa | undefined): Lead | null => {
    if (!conv) return null;
    if (conv.leadId) return leads.find((l) => l.id === conv.leadId) || null;
    return leads.find((l) => l.nome === conv.contato) || null;
  };

  const leadSelecionado = leadDaConversa(selected);

  const valores = montarValoresVariaveis({
    lead: { nome: leadSelecionado?.nome || selected?.contato, empresa: selected?.empresa },
    organizacao: settings.organizacao,
    customVars: variaveis,
  });
  const inserirResposta = (textoResposta: string) => setTexto(resolverVariaveis(textoResposta, valores));

  const textoAtual = texto.trim();
  const exibirAtalhos = textoAtual.startsWith('/') && textoAtual.length > 1;
  const atalhosFiltrados = exibirAtalhos
    ? respostas.filter((r) => r.atalho.toLowerCase().includes(textoAtual.slice(1).toLowerCase()))
    : [];

  const contatoBloqueado = selected ? estaBloqueado(selected.contato, selected.canal) : false;
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

  const agora = () =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const anaResponder = async (mensagemDoCliente: string) => {
    setAnaDigitando(true);
    const resposta = await responderMensagem(mensagemDoCliente, {
      nome: selected?.contato,
      empresa: selected?.empresa,
    });
    setAnaDigitando(false);
    if (selectedId) {
      adicionarMensagem(selectedId, {
        id: `msg-ana-${Date.now()}`,
        autor: 'ana',
        nome: 'Ana',
        texto: resposta.texto,
        hora: agora(),
      });
    }
  };

  const enviar = () => {
    if (!texto.trim()) return;
    const nova: Mensagem = {
      id: `msg-${Date.now()}`,
      autor: 'vendedor',
      nome: 'Você',
      texto: texto.trim(),
      hora: agora(),
      notaInterna,
    };
    adicionarMensagem(selectedId, nova);
    setTexto('');
    setNotaInterna(false);
  };

  const completarComIA = async () => {
    if (!texto.trim()) {
      setErroIA('Digite um trecho para a IA completar.');
      return;
    }
    setGerandoIA(true);
    setErroIA('');
    setSugestaoIA('');
    const r = await autocompletarTexto(texto, {
      nome: selected?.contato,
      empresa: selected?.empresa,
      tipo: 'mensagem',
    });
    setGerandoIA(false);
    if (r) setSugestaoIA(r);
    else setErroIA('IA indisponível no momento. Você pode continuar digitando normalmente.');
  };

  const simularRespostaCliente = async () => {
    if (!selected) return;
    const leadAtual = leadSelecionado;
    let msg: string;
    if (leadAtual?.aguardandoEscolhaHorario && (leadAtual.slotsOfertados || []).length > 0) {
      const escolhas = ['Prefiro a opção 1.', 'Pode ser o horário 2.', 'Fico com a opção 3.'];
      msg = escolhas[indiceSimulacao.current % escolhas.length];
    } else {
      msg = simulacoesCliente[indiceSimulacao.current % simulacoesCliente.length];
    }
    indiceSimulacao.current += 1;
    adicionarMensagem(selectedId, {
      id: `msg-cli-${Date.now()}`,
      autor: 'cliente',
      nome: selected.contato,
      texto: msg,
      hora: agora(),
    });

    const lead = leadSelecionado;

    // Bloqueios avaliados ANTES de qualquer análise/resposta automática.
    if (contatoBloqueado || config.killSwitchGlobal || anaPausada || (lead && lead.bloqueado)) {
      const motivo = contatoBloqueado
        ? 'contato na lista de supressão (LGPD)'
        : config.killSwitchGlobal
          ? 'kill switch global ativo'
          : lead && lead.bloqueado
            ? 'lead bloqueado (opt-out)'
            : 'Ana pausada pelo operador';
      adicionarMensagem(selectedId, {
        id: `msg-sys-${Date.now()}`,
        autor: 'sistema',
        nome: 'Sistema',
        texto: `Envio automático bloqueado: ${motivo}.`,
        hora: agora(),
        notaInterna: true,
      });
      return;
    }
    if (lead && (lead.modoAtendimento ?? 'IA') === 'HUMANO') {
      adicionarMensagem(selectedId, {
        id: `msg-sys-${Date.now()}`,
        autor: 'sistema',
        nome: 'Sistema',
        texto: 'Lead em modo humano. A Ana não responde automaticamente.',
        hora: agora(),
        notaInterna: true,
      });
      return;
    }

    // Analisa a mensagem (pode bloquear por opt-out ou transferir para humano).
    let transferiu = false;
    let optOut = false;
    let respondeu = false;
    if (lead) {
      const r = await fluxo.analisarEResponder(lead.id, msg);
      transferiu = r.transferiu;
      optOut = r.analise.intencao === 'OPT_OUT';
      respondeu = r.respondeu ?? false;
    }

    // Opt-out: a Ana NÃO responde a um lead que pediu descadastro.
    if (optOut) {
      adicionarMensagem(selectedId, {
        id: `msg-sys-${Date.now()}`,
        autor: 'sistema',
        nome: 'Sistema',
        texto: 'Lead solicitou opt-out. Contato bloqueado e cadências encerradas. A Ana não responderá.',
        hora: agora(),
        notaInterna: true,
      });
      return;
    }

    if (transferiu) {
      adicionarMensagem(selectedId, {
        id: `msg-sys-${Date.now()}`,
        autor: 'sistema',
        nome: 'Sistema',
        texto: 'Ana transferiu o atendimento para um humano.',
        hora: agora(),
        notaInterna: true,
      });
      return;
    }
    // A Ana já respondeu dentro do fluxo (orçamento, agendamento, horário).
    if (respondeu) return;
    anaResponder(msg);
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
    fluxo.transferirParaHumano(lead.id, 'Transferência manual solicitada pelo operador', 'MEDIA');
    atualizarStatus(selectedId, 'transferido');
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
    fluxo.assumirAtendimento(lead.id);
    setAssumido(true);
    adicionarMensagem(selectedId, {
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
    fluxo.devolverParaAna(lead.id);
    setAssumido(false);
    adicionarMensagem(selectedId, {
      id: `msg-sys-${Date.now()}`,
      autor: 'sistema',
      nome: 'Sistema',
      texto: 'Atendimento devolvido para a Ana.',
      hora: agora(),
      notaInterna: true,
    });
  };

  // Busca a proposta (orçamento) do lead e a envia pelo chat, atualizando o Kanban.
  const propostasDoLead = leadSelecionado
    ? propostas.filter((p) => (p.leadId ? p.leadId === leadSelecionado.id : p.lead === leadSelecionado.nome))
    : [];

  const enviarOrcamento = (p: Proposta) => {
    const total = p.valor * (1 - (p.descontoPct || 0) / 100);
    const textoOrcamento = [
      `Segue o orçamento ${p.numero}:`,
      ...p.itens.map((i) => `• ${i.nome} (${i.quantidade}x) — ${i.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`),
      p.descontoPct > 0 ? `Desconto: ${p.descontoPct}%` : '',
      `Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      `Validade: ${new Date(p.validade + 'T00:00:00').toLocaleDateString('pt-BR')}`,
    ].filter(Boolean).join('\n');
    adicionarMensagem(selectedId, {
      id: `msg-${Date.now()}`,
      autor: 'vendedor',
      nome: 'Você',
      texto: textoOrcamento,
      hora: agora(),
    });
    atualizarProposta(p.id, { status: 'enviada', validade: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) });
    const lead = leadSelecionado;
    if (lead) {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, etapa: 'Orçamento Enviado' } : l))
      );
    }
    fluxo.registrarAuditoria({ evento: 'PROPOSAL_SENT', ator: 'Você', alvo: leadSelecionado?.nome || p.lead, detalhes: `Proposta ${p.numero} enviada pela Central de Atendimento` });
    setOrcamentoModal(false);
  };

  const registrarOptout = () => {
    if (!selected) return;
    adicionar({
      contato: selected.contato,
      canal: selected.canal === 'whatsapp' ? 'WhatsApp' : selected.canal === 'email' ? 'E-mail' : 'Instagram',
      motivo: 'Opt-out solicitado pelo lead',
      ator: 'Você',
      origem: 'Manual',
    });
    const lead = leadSelecionado;
    if (lead) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, bloqueado: true, automacaoStatus: 'CONCLUIDA' } : l
        )
      );
      fluxo.registrarAuditoria({ evento: 'OPT_OUT', ator: 'Você', alvo: lead.nome, detalhes: 'Opt-out registrado manualmente' });
    }
    adicionarMensagem(selectedId, {
      id: `msg-${Date.now()}`,
      autor: 'sistema',
      nome: 'Sistema',
      texto: 'Opt-out registrado. Contato adicionado à lista de supressão e cadências pausadas.',
      hora: agora(),
      notaInterna: true,
    });
    atualizarStatus(selectedId, 'resolvido');
  };

  const filtradas = conversas.filter((c) =>
    (c.contato + c.empresa).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Central de Atendimento
          </h1>
          <p className="text-foreground-600 text-sm">
            Inbox multicanal com a Ana, filas, SLA e histórico pesquisável.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-side-bar-line"></i>
            Painel do lead
          </button>
          <button
            onClick={() => setAnaPausada(!anaPausada)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap transition-all ${
              anaPausada ? 'bg-background-200 text-foreground-700' : 'bg-primary-500 text-background-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${anaPausada ? 'bg-foreground-400' : 'bg-background-50 animate-pulse'}`}></span>
            {anaPausada ? 'Ana pausada' : 'Ana ativa'}
          </button>
        </div>
      </div>

      {config.killSwitchGlobal && (
        <div className="mb-4 bg-accent-500 text-background-50 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-alarm-warning-line"></i>
          Kill switch global ativo — todas as respostas automáticas da Ana estão pausadas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[calc(100vh-220px)] min-h-[520px]">
        {/* Lista de conversas */}
        <div className="lg:col-span-1 bg-background-50 border border-background-200/70 rounded-xl flex flex-col overflow-hidden">
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
        <div className="lg:col-span-2 bg-background-50 border border-background-200/70 rounded-xl flex flex-col overflow-hidden">
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
                      {m.opcoesHorario && m.opcoesHorario.length > 0 && leadSelecionado?.aguardandoEscolhaHorario && (
                        <div className="mt-2 space-y-1.5">
                          {m.opcoesHorario.map((slot) => (
                            <button
                              key={slot.indice}
                              onClick={() => leadSelecionado && fluxo.confirmarHorario(leadSelecionado.id, slot)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-800 text-sm cursor-pointer whitespace-nowrap transition-colors text-left"
                            >
                              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                <i className="ri-calendar-check-line"></i>
                              </span>
                              <span>
                                {new Date(slot.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {slot.horaInicio}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-foreground-400 mt-1">{m.nome} · {m.hora}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {anaDigitando && (
              <div className="flex justify-start">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-secondary-500 flex items-center justify-center flex-shrink-0">
                    <i className="ri-robot-line text-xs text-background-50"></i>
                  </div>
                  <div className="bg-secondary-100 text-secondary-900 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-secondary-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-secondary-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                    <span className="w-1.5 h-1.5 bg-secondary-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-background-200/70 flex gap-2 overflow-x-auto items-center">
            <span className="text-xs text-foreground-400 whitespace-nowrap flex-shrink-0">Respostas rápidas:</span>
            {respostas.map((r) => (
              <button
                key={r.id}
                onClick={() => inserirResposta(r.texto)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-600 rounded-full text-xs cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <span className="text-[10px] font-bold text-accent-600">/{r.atalho}</span>
                <span className="max-w-[160px] truncate">{r.texto}</span>
              </button>
            ))}
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
                {exibirAtalhos && atalhosFiltrados.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-h-56 overflow-y-auto bg-background-50 border border-background-300 rounded-lg z-20">
                    {atalhosFiltrados.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => inserirResposta(r.texto)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-background-100 cursor-pointer"
                      >
                        <span className="text-[10px] font-bold text-accent-600 w-20 flex-shrink-0">/{r.atalho}</span>
                        <span className="text-xs text-foreground-700 truncate">{r.texto}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enviar()}
                  placeholder="Digite sua mensagem... (/atalho)"
                  className="w-full px-4 py-2.5 bg-background-100 border border-background-200/70 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
                />
              </div>
              <button
                onClick={completarComIA}
                disabled={gerandoIA}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary-100 hover:bg-secondary-200 text-secondary-700 cursor-pointer transition-colors"
                title="Completar com IA"
              >
                {gerandoIA ? (
                  <span className="w-4 h-4 border-2 border-secondary-400/30 border-t-secondary-600 rounded-full animate-spin"></span>
                ) : (
                  <i className="ri-sparkling-2-line text-base"></i>
                )}
              </button>
              <button
                onClick={enviar}
                className="w-10 h-10 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className="ri-send-plane-fill text-base"></i>
              </button>
            </div>
            {sugestaoIA && (
              <div className="mt-2 bg-primary-50 border border-primary-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-primary-700 flex items-center gap-1.5">
                    <i className="ri-sparkling-2-line"></i>
                    Sugestão da IA
                  </span>
                  <button onClick={() => setSugestaoIA('')} className="text-foreground-400 hover:text-foreground-600 cursor-pointer">
                    <i className="ri-close-line"></i>
                  </button>
                </div>
                <p className="text-sm text-foreground-700 whitespace-pre-line">{sugestaoIA}</p>
                <button
                  onClick={() => { setTexto(sugestaoIA); setSugestaoIA(''); }}
                  className="mt-2 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Usar sugestão
                </button>
              </div>
            )}
            {erroIA && <p className="mt-1.5 text-xs text-foreground-500">{erroIA}</p>}
            <button
              onClick={simularRespostaCliente}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-secondary-600 hover:text-secondary-800 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flashlight-line"></i>
              Simular resposta do cliente (testar a Ana)
            </button>
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
                onClick={() => { setOptoutConfirmar(false); registrarOptout(); }}
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
                <h3 className="font-heading font-bold text-foreground-950">Enviar orçamento</h3>
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
                            onClick={() => enviarOrcamento(p)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-send-plane-2-line"></i>
                            Enviar pelo chat
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
          onInserirResposta={(resp) => setTexto(resp)}
        />
      )}
    </div>
  );
}
