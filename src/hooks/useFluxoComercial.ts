import { getLeadsSnapshot, useLeadsStore } from '@/hooks/useLeadsStore';
import { registrarAuditoria, useAuditoriaStore } from '@/hooks/useAuditoriaStore';
import { requestHumanHandoff, returnConversationToAna } from '@/lib/crm/handoffsRepository';
import type { AnaliseMensagem, SlotHorario } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';

export interface ResultadoAnalise {
  analise: AnaliseMensagem;
  transferiu: boolean;
  respondeu?: boolean;
}

// A automação comercial não pode ser decidida no navegador. Este resultado
// neutro existe apenas para manter o contrato dos consumidores legados sem
// sugerir resposta, movimentar o funil ou acionar um handoff local.
const ANALISE_AUTOMATICA_DESABILITADA: AnaliseMensagem = {
  intencao: 'NEUTRO',
  sentimento: 'NEUTRO',
  scoreInteresse: 0,
  confianca: 0,
  proximaAcao: 'RESPONDER',
};

function historicoManual(tipo: string, descricao: string, ator: string) {
  return {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    descricao,
    ator,
    data: new Date().toISOString(),
  };
}

// Este hook mantém os controles explicitamente acionados por uma pessoa. Toda
// decisão ou mensagem automática da Ana é autoridade exclusiva de ana-run e do
// worker no backend. As funções legadas de automação abaixo são no-ops seguros
// para não transformar uma chamada residual do frontend em envio ou decisão.
export function useFluxoComercial() {
  const [, setLeads] = useLeadsStore();
  const audit = useAuditoriaStore();

  const getLead = (leadId: string) => getLeadsSnapshot().find((lead) => lead.id === leadId);

  const addHistorico = (leadId: string, tipo: string, descricao: string, ator: string) => {
    setLeads((previous) =>
      previous.map((lead) =>
        lead.id === leadId
          ? { ...lead, historico: [historicoManual(tipo, descricao, ator), ...(lead.historico || [])] }
          : lead
      )
    );
  };

  // Mantido para compatibilidade com telas antigas. A ativação real é feita
  // pelo fluxo que chama ana-run no backend; este hook não inicia contatos.
  const ativarParaKanban = (
    leadIds: string[],
    modo: 'IA' | 'HUMANO' = 'IA',
    etapaHandoff?: string
  ): { disparados: number; tarefas: number } => {
    const ids = new Set(leadIds);
    setLeads((previous) =>
      previous.map((lead) =>
        ids.has(lead.id)
          ? {
              ...lead,
              aguardandoAtivacao: false,
              modoAtendimento: modo,
              automacaoStatus: modo === 'IA' ? 'ATIVA' : 'AGUARDANDO_HUMANO',
              etapaHandoff: modo === 'IA' ? etapaHandoff : undefined,
            }
          : lead
      )
    );
    return { disparados: 0, tarefas: 0 };
  };

  const processarPrimeiroContato = (_leadId: string): void => {
    // ana-run agenda e decide o primeiro contato no servidor.
  };

  const executarFollowUp = async (_leadId: string): Promise<void> => {
    // O worker revalida contexto, horário e cadência antes de qualquer envio.
  };

  const executarTimeout = (_leadId: string): void => {
    // O encerramento automático é responsabilidade do worker canônico.
  };

  const cancelarAutomacoesPendentes = (_leadId: string): void => {
    // Não existe agenda local a cancelar. O backend reconcilia os jobs.
  };

  const processarAutomacoesPendentes = async (): Promise<{
    followUps: number;
    timeouts: number;
    noShows: number;
    lembretes: number;
    fluxos: number;
  }> => ({ followUps: 0, timeouts: 0, noShows: 0, lembretes: 0, fluxos: 0 });

  // Caminho antigo chamado por decisões locais. Não converte uma inferência do
  // navegador em handoff; ações humanas usam assumirAtendimento/pausarAna.
  const transferirParaHumano = (
    _leadId: string,
    _motivo: string,
    _prioridade: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA'
  ): void => {};

  const assumirAtendimento = async (leadId: string): Promise<void> => {
    const lead = getLead(leadId);
    if (!lead) return;

    await requestHumanHandoff(leadId, 'Atendimento assumido manualmente pelo operador', 'takeover');
    setLeads((previous) =>
      previous.map((item) =>
        item.id === leadId
          ? {
              ...item,
              modoAtendimento: 'HUMANO',
              automacaoStatus: 'AGUARDANDO_HUMANO',
              nextFollowUpAt: null,
              timeoutAt: null,
            }
          : item
      )
    );
    addHistorico(leadId, 'ASSUMIDO_HUMANO', 'Atendimento assumido por humano', 'Humano');
    registrarAuditoria({ evento: 'HANDOFF', ator: 'Humano', alvo: lead.nome, detalhes: 'Atendimento assumido por humano' });
  };

  const devolverParaAna = async (leadId: string): Promise<void> => {
    const lead = getLead(leadId);
    if (!lead) return;

    await returnConversationToAna(leadId);
    setLeads((previous) =>
      previous.map((item) =>
        item.id === leadId
          ? {
              ...item,
              modoAtendimento: 'IA',
              automacaoStatus: 'ATIVA',
              nextFollowUpAt: null,
              timeoutAt: null,
            }
          : item
      )
    );
    addHistorico(leadId, 'DEVOLVIDO_ANA', 'Atendimento devolvido para a Ana', 'Humano');
    registrarAuditoria({ evento: 'HANDOFF', ator: 'Humano', alvo: lead.nome, detalhes: 'Atendimento devolvido para a Ana' });
  };

  const pausarAna = async (leadId: string): Promise<void> => {
    const lead = getLead(leadId);
    if (!lead) return;

    await requestHumanHandoff(leadId, 'Ana pausada manualmente pelo operador', 'pause');
    setLeads((previous) =>
      previous.map((item) =>
        item.id === leadId
          ? {
              ...item,
              modoAtendimento: 'HUMANO',
              automacaoStatus: 'AGUARDANDO_HUMANO',
              nextFollowUpAt: null,
              timeoutAt: null,
            }
          : item
      )
    );
    addHistorico(leadId, 'PAUSAR_ANA', 'Ana pausada neste lead', 'Humano');
  };

  const retomarAna = async (leadId: string): Promise<void> => {
    const lead = getLead(leadId);
    if (!lead) return;

    await returnConversationToAna(leadId);
    setLeads((previous) =>
      previous.map((item) =>
        item.id === leadId
          ? {
              ...item,
              modoAtendimento: 'IA',
              automacaoStatus: 'ATIVA',
              nextFollowUpAt: null,
              timeoutAt: null,
            }
          : item
      )
    );
    addHistorico(leadId, 'RETOMAR_ANA', 'Ana retomada neste lead', 'Humano');
  };

  // Esta preferência visual não é uma regra de automação no navegador. A
  // configuração publicada da Ana e o backend decidem se/quando há handoff.
  const atualizarEtapaHandoff = (leadId: string, etapaHandoff: string): void => {
    const lead = getLead(leadId);
    if (!lead) return;
    setLeads((previous) =>
      previous.map((item) => (item.id === leadId ? { ...item, etapaHandoff: etapaHandoff || undefined } : item))
    );
    addHistorico(
      leadId,
      'HANDOFF_ETAPA_ALTERADO',
      etapaHandoff ? `Limite local de exibição alterado para "${etapaHandoff}"` : 'Limite local de exibição removido',
      'Usuário'
    );
    registrarAuditoria({
      evento: 'HANDOFF_ETAPA_ALTERADO',
      ator: 'Usuário',
      alvo: lead.nome,
      detalhes: etapaHandoff ? `Limite local de exibição alterado para "${etapaHandoff}"` : 'Limite local de exibição removido',
    });
  };

  // As APIs seguintes permanecem para não quebrar consumidores legados. Elas
  // não analisam, redigem, enviam, criam compromissos ou transferem contatos.
  const analisarEResponder = async (_leadId: string, _mensagem: string): Promise<ResultadoAnalise> => ({
    analise: { ...ANALISE_AUTOMATICA_DESABILITADA },
    transferiu: false,
    respondeu: false,
  });

  const confirmarHorario = (_leadId: string, _slot: SlotHorario): void => {};

  const criarTarefaHumano = (_lead: Lead): void => {};

  return {
    ativarParaKanban,
    processarPrimeiroContato,
    processarAutomacoesPendentes,
    executarFollowUp,
    executarTimeout,
    cancelarAutomacoesPendentes,
    transferirParaHumano,
    assumirAtendimento,
    devolverParaAna,
    pausarAna,
    retomarAna,
    analisarEResponder,
    confirmarHorario,
    atualizarEtapaHandoff,
    criarTarefaHumano,
    registrarAuditoria: audit.registrar,
  };
}
