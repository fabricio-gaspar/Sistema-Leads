import { useState } from 'react';
import { etapasCRM } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useTarefasStore } from '@/hooks/useTarefasStore';

interface LeadDrawerProps {
  lead: Lead;
  onClose: () => void;
  onMudarEtapa: (id: string, etapa: string) => void;
  onAbrirConversa: (lead: Lead) => void;
  onExcluir: (lead: Lead) => void;
}

type Aba = 'resumo' | 'conversa' | 'historico' | 'tarefas';

const etapaBadge: Record<string, string> = {
  'Novo': 'bg-background-200 text-foreground-600',
  'Em Contato': 'bg-primary-100 text-primary-700',
  'Aguardando Resposta': 'bg-accent-100 text-accent-700',
  'Em Qualificação': 'bg-primary-100 text-primary-700',
  'Reunião Agendada': 'bg-accent-100 text-accent-700',
  'Proposta em Preparação': 'bg-secondary-100 text-secondary-700',
  'Orçamento Enviado': 'bg-accent-100 text-accent-700',
  'Negociação': 'bg-secondary-100 text-secondary-700',
  'Fechado — Ganho': 'bg-primary-500 text-background-50',
  'Fechado — Perdido': 'bg-background-300 text-foreground-500',
  'Pausado': 'bg-background-200 text-foreground-500',
};

const tempCores: Record<string, string> = {
  Frio: 'text-foreground-400',
  Morno: 'text-accent-600',
  Quente: 'text-accent-500',
};

const tempLabel: Record<string, string> = { Frio: 'Frio', Morno: 'Morno', Quente: 'Quente' };

// Etapas ativas do funil (sem os estados terminais), usadas no seletor de
// limite de atendimento da Ana dentro do card do Kanban.
const etapasHandoff = [
  'Novo',
  'Em Contato',
  'Aguardando Resposta',
  'Em Qualificação',
  'Reunião Agendada',
  'Proposta em Preparação',
  'Orçamento Enviado',
  'Negociação',
];

const automacaoLabel: Record<string, string> = {
  ATIVA: 'Ativa',
  PAUSADA: 'Pausada',
  AGUARDANDO_HUMANO: 'Aguardando humano',
  CONCLUIDA: 'Concluída',
  ERRO: 'Erro',
};

const automacaoCor: Record<string, string> = {
  ATIVA: 'bg-secondary-100 text-secondary-800',
  PAUSADA: 'bg-background-200 text-foreground-600',
  AGUARDANDO_HUMANO: 'bg-accent-100 text-accent-800',
  CONCLUIDA: 'bg-background-200 text-foreground-500',
  ERRO: 'bg-accent-500/20 text-accent-600',
};

const abas: { id: Aba; label: string; icone: string }[] = [
  { id: 'resumo', label: 'Resumo', icone: 'ri-file-user-line' },
  { id: 'conversa', label: 'Conversa', icone: 'ri-chat-3-line' },
  { id: 'historico', label: 'Histórico', icone: 'ri-history-line' },
  { id: 'tarefas', label: 'Tarefas', icone: 'ri-task-line' },
];

const intencaoLabel: Record<string, string> = {
  INTERESSE: 'Interesse',
  DUVIDA: 'Dúvida',
  OBJECAO: 'Objeção',
  PRECO: 'Preço',
  ORCAMENTO: 'Orçamento',
  AGENDAMENTO: 'Agendamento',
  NEGATIVO: 'Negativo',
  OPT_OUT: 'Opt-out',
  NEUTRO: 'Neutro',
};

export default function LeadDrawer({ lead, onClose, onMudarEtapa, onAbrirConversa, onExcluir }: LeadDrawerProps) {
  const [aba, setAba] = useState<Aba>('resumo');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const fluxo = useFluxoComercial();
  const { tarefas, alternar } = useTarefasStore();

  const tarefasDoLead = tarefas.filter((t) => t.leadId === lead.id);
  const modo = lead.modoAtendimento ?? 'IA';
  const statusAutomacao = lead.automacaoStatus ?? 'ATIVA';

  const historico = (lead.historico && lead.historico.length > 0 ? lead.historico : []).map((h) => ({
    acao: h.tipo,
    detalhe: h.descricao,
    data: h.data.slice(0, 10),
    ator: h.ator,
  }));

  const formatarData = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground-950/50 flex justify-end" onClick={onClose}>
      <div
        className="bg-background-50 w-full max-w-md h-full flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-background-200/70 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-heading font-bold text-foreground-950 text-lg">{lead.nome}</h3>
              <i className={`ri-fire-fill text-sm ${tempCores[lead.temperatura]}`}></i>
            </div>
            <p className="text-sm text-foreground-500">{lead.empresa}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${etapaBadge[lead.etapa]}`}>
                {lead.etapa}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                Score {lead.score}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-background-100 text-foreground-600">
                {tempLabel[lead.temperatura]}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${modo === 'IA' ? 'bg-secondary-100 text-secondary-800' : 'bg-accent-100 text-accent-800'}`}>
                <i className={`${modo === 'IA' ? 'ri-robot-line' : 'ri-user-line'} text-xs`}></i>
                {modo === 'IA' ? 'Ana (IA)' : 'Humano'}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${automacaoCor[statusAutomacao]}`}>
                {automacaoLabel[statusAutomacao]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-background-200/70">
          <div className="flex gap-1 p-1 bg-background-100 rounded-lg">
            {abas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                  aba === a.id ? 'bg-background-50 text-primary-700 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                <i className={a.icone}></i>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {aba === 'resumo' && (
            <>
              {/* Ações da Ana / humano */}
              <div className="grid grid-cols-2 gap-2">
                {statusAutomacao === 'ATIVA' && (
                  <button
                    onClick={() => fluxo.pausarAna(lead.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-pause-circle-line"></i> Pausar Ana
                  </button>
                )}
                {statusAutomacao === 'PAUSADA' && (
                  <button
                    onClick={() => fluxo.retomarAna(lead.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-play-circle-line"></i> Retomar Ana
                  </button>
                )}
                {statusAutomacao === 'AGUARDANDO_HUMANO' && (
                  <button
                    onClick={() => fluxo.assumirAtendimento(lead.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-user-received-line"></i> Assumir
                  </button>
                )}
                {(statusAutomacao === 'PAUSADA' || statusAutomacao === 'AGUARDANDO_HUMANO') && (
                  <button
                    onClick={() => fluxo.devolverParaAna(lead.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-robot-line"></i> Devolver p/ Ana
                  </button>
                )}
              </div>

              {/* Análise da Ana */}
              {(lead.intencao || lead.proximaAcao) && (
                <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-secondary-800 mb-3 flex items-center gap-1.5">
                    <i className="ri-brain-line"></i> Análise da Ana
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-foreground-500 text-xs">Intenção</p>
                      <p className="text-foreground-900 font-medium">{lead.intencao ? intencaoLabel[lead.intencao] || lead.intencao : '—'}</p>
                    </div>
                    <div>
                      <p className="text-foreground-500 text-xs">Sentimento</p>
                      <p className="text-foreground-900 font-medium">{lead.sentimento === 'POSITIVO' ? 'Positivo' : lead.sentimento === 'NEGATIVO' ? 'Negativo' : 'Neutro'}</p>
                    </div>
                    <div>
                      <p className="text-foreground-500 text-xs">Confiança</p>
                      <p className="text-foreground-900 font-medium">{lead.confianca ?? 100}%</p>
                    </div>
                    <div>
                      <p className="text-foreground-500 text-xs">Próxima ação</p>
                      <p className="text-foreground-900 font-medium">{lead.proximaAcao || '—'}</p>
                    </div>
                  </div>
                  {lead.motivoTransferencia && (
                    <p className="text-xs text-accent-700 mt-3">
                      <i className="ri-user-shared-line mr-1"></i>
                      {lead.motivoTransferencia}
                    </p>
                  )}
                </div>
              )}

              {/* Cadência */}
              {(lead.nextFollowUpAt || lead.timeoutAt) && (
                <div className="bg-background-100/60 border border-background-200/70 rounded-xl p-4 text-sm">
                  <p className="text-xs font-semibold text-foreground-700 mb-2">Cadência automática</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-foreground-500 text-xs">Próximo follow-up</span>
                      <span className="text-foreground-900">{formatarData(lead.nextFollowUpAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-500 text-xs">Timeout</span>
                      <span className="text-foreground-900">{formatarData(lead.timeoutAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-500 text-xs">Follow-ups enviados</span>
                      <span className="text-foreground-900">{lead.followUpCount ?? 0}/{lead.maxFollowUps ?? 2}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-foreground-500 text-xs">CNPJ</p>
                  <p className="text-foreground-900">{lead.cnpj || '—'}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Porte</p>
                  <p className="text-foreground-900">{lead.porte}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-foreground-500 text-xs">E-mail</p>
                  <p className="text-foreground-900 break-all">{lead.email || '—'}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">WhatsApp</p>
                  <p className="text-foreground-900">{lead.whatsapp || '—'}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Canal preferencial</p>
                  <p className="text-foreground-900">{lead.canalPreferencial || '—'}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Localização</p>
                  <p className="text-foreground-900">{lead.cidade} - {lead.estado}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Origem</p>
                  <p className="text-foreground-900">{lead.origem}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Responsável</p>
                  <p className="text-foreground-900">{lead.responsavel}</p>
                </div>
              </div>

              {modo === 'IA' && (
                <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-secondary-800 mb-2 flex items-center gap-1.5">
                    <i className="ri-robot-line"></i>
                    Até qual etapa a Ana atende?
                  </p>
                  <select
                    value={lead.etapaHandoff || ''}
                    onChange={(e) => fluxo.atualizarEtapaHandoff(lead.id, e.target.value)}
                    className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                  >
                    <option value="">Até o fim do funil (Ana conduz tudo)</option>
                    {etapasHandoff.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-foreground-400 mt-1.5">
                    Ao chegar nessa etapa, a Ana transfere o lead pro vendedor (com tarefa e notificação).
                  </p>
                </div>
              )}

              <div>
                <p className="text-foreground-500 text-xs mb-2">Mudar etapa</p>
                <select
                  value={lead.etapa}
                  onChange={(e) => onMudarEtapa(lead.id, e.target.value)}
                  className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                >
                  {etapasCRM.map((et) => (
                    <option key={et} value={et}>{et}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-foreground-500 text-xs mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {lead.tags.length > 0 ? (
                    lead.tags.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-md text-xs bg-secondary-100 text-secondary-800">{t}</span>
                    ))
                  ) : (
                    <span className="text-sm text-foreground-400">Sem tags</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-background-200/70">
                <button
                  onClick={() => onAbrirConversa(lead)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-customer-service-2-line"></i>
                  Abrir conversa
                </button>
                <button
                  onClick={() => setConfirmandoExclusao(true)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-accent-300 text-accent-700 hover:bg-accent-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line"></i>
                  Excluir lead
                </button>
              </div>
            </>
          )}

          {aba === 'conversa' && (
            <div className="space-y-3">
              <p className="text-xs text-foreground-400">
                Histórico completo da conversa disponível na Central de Atendimento.
              </p>
              <button
                onClick={() => onAbrirConversa(lead)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-chat-3-line"></i>
                Ir para o chat
              </button>
            </div>
          )}

          {aba === 'historico' && (
            <div className="space-y-0">
              {historico.length > 0 ? (
                historico.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-1"></div>
                      {i < historico.length - 1 && <div className="w-px flex-1 bg-background-200"></div>}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-medium text-foreground-900">{h.acao}</p>
                      <p className="text-xs text-foreground-500">{h.detalhe}</p>
                      <p className="text-[10px] text-foreground-400 mt-0.5">{h.ator} · {h.data}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground-400 py-6 text-center">Nenhum evento registrado ainda.</p>
              )}
            </div>
          )}

          {aba === 'tarefas' && (
            <div className="space-y-3">
              {tarefasDoLead.length > 0 ? (
                tarefasDoLead.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 p-3 bg-background-100/50 border border-background-200/70 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={t.concluida}
                      onChange={() => alternar(t.id)}
                      className="w-4 h-4 cursor-pointer accent-primary-500"
                    />
                    <div className="flex-1">
                      <span className={`text-sm ${t.concluida ? 'text-foreground-400 line-through' : 'text-foreground-800'}`}>
                        {t.titulo}
                      </span>
                      <p className="text-[10px] text-foreground-400 mt-0.5">
                        {t.responsavel} · {t.prioridade}
                      </p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-foreground-400 py-6 text-center">Nenhuma tarefa para este lead.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-[60] bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setConfirmandoExclusao(false)}>
          <div className="bg-background-50 rounded-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Excluir lead</h3>
              <button onClick={() => setConfirmandoExclusao(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                <i className="ri-alarm-warning-line"></i>
                Ação irreversível — o lead e todo o seu histórico serão removidos.
              </div>
              <p className="text-sm text-foreground-600">
                Tem certeza que deseja excluir <b>{lead.nome}</b> ({lead.empresa}) do Kanban? Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setConfirmandoExclusao(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={() => { onExcluir(lead); setConfirmandoExclusao(false); }} className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}