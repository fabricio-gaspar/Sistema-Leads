import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshLeadsStore, useLeadsStore, waitForLeadsPersistence } from '@/hooks/useLeadsStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useSavedViews } from '@/hooks/useSavedViews';
import FilterChips from '@/components/feature/FilterChips';
import type { FilterChip } from '@/components/feature/FilterChips';
import SavedViewsControl from '@/components/feature/SavedViewsControl';
import type { Lead } from '@/mocks/leadsData';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, legacyStageForPipeline, stageFromLegacy } from '@/domain/pipeline';
import LeadDrawer from './components/LeadDrawer';
import { runAna } from '@/lib/crm/anaRunRepository';
import { isContactActivationPending, shouldDisplayInKanban } from '@/lib/crm/kanbanLeadVisibility';
import { runOperationalAutomations } from '@/lib/crm/automationRepository';
import { canonicalStageKeyFromLabel, CommercialTransitionError, transitionOperationalLeadStage } from '@/lib/crm/leadStageRepository';

const formatarData = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

const etapaCores: Record<string, string> = {
  entered: 'bg-background-100/80 border-background-200', engaging: 'bg-background-100/80 border-background-200', qualified: 'bg-background-100/80 border-background-200', quote_preparation: 'bg-background-100/80 border-background-200', quote_sent: 'bg-background-100/80 border-background-200', won: 'bg-background-100/80 border-background-200', lost: 'bg-background-100/80 border-background-200',
};

const etapaIndicador: Record<string, string> = {
  entered: 'bg-foreground-300', engaging: 'bg-primary-400', qualified: 'bg-primary-600', quote_preparation: 'bg-secondary-500', quote_sent: 'bg-accent-500', won: 'bg-[#168654]', lost: 'bg-[#BD3D32]',
};

const tempCores: Record<string, string> = {
  Frio: 'text-foreground-400',
  Morno: 'text-accent-600',
  Quente: 'text-accent-500',
};

interface KanbanFiltros {
  busca: string;
  responsavel: string;
  segmento: string;
  etapa: string;
  temperatura: string;
  dataInicio: string;
  dataFim: string;
}

export default function KanbanCRM() {
  const [leads, setLeads] = useLeadsStore();
  const fluxo = useFluxoComercial();
  const [dragId, setDragId] = useState<string | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [motivoModal, setMotivoModal] = useState<{ id: string; etapa: string; nome: string; tipo: 'perda' | 'ganho' } | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [stageChangePending, setStageChangePending] = useState<string | null>(null);
  const [deleteAlvo, setDeleteAlvo] = useState<Lead | null>(null);
  const [filtroResponsavel, setFiltroResponsavel] = useLocalStorageState('kanban-filtro-responsavel', '');
  const [filtroSegmento, setFiltroSegmento] = useLocalStorageState('kanban-filtro-segmento', '');
  const [filtroEtapa, setFiltroEtapa] = useLocalStorageState('kanban-filtro-etapa', '');
  const [filtroTemperatura, setFiltroTemperatura] = useLocalStorageState('kanban-filtro-temperatura', '');
  const [dataInicio, setDataInicio] = useLocalStorageState('kanban-data-inicio', '');
  const [dataFim, setDataFim] = useLocalStorageState('kanban-data-fim', '');
  const [busca, setBusca] = useLocalStorageState('kanban-busca', '');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const navigate = useNavigate();

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const excluirLead = async (lead: Lead) => {
    setLeads((prev) => prev.map((item) => item.id === lead.id ? { ...item, arquivado: true } : item));
    try {
      await waitForLeadsPersistence();
      setDetalheId(null);
      setDeleteAlvo(null);
      fluxo.registrarAuditoria({
        evento: 'LEAD_ARCHIVED',
        ator: 'Usuário',
        alvo: lead.nome,
        detalhes: 'Lead arquivado pelo Kanban; histórico comercial preservado',
      });
      mostrarToast(`${lead.nome} foi arquivado do Kanban. O histórico foi preservado.`);
    } catch {
      mostrarToast('Não foi possível arquivar o lead. A tela foi reconciliada com o servidor.');
    }
  };

  const responsaveis = Array.from(new Set(leads.map((l) => l.responsavel).filter(Boolean))).sort();
  const segmentosDisponiveis = Array.from(new Set(leads.map((l) => l.segmento).filter(Boolean))).sort();
  const temperaturasDisponiveis = ['Frio', 'Morno', 'Quente'];

  const hasFiltros = Boolean(busca || filtroResponsavel || filtroSegmento || filtroEtapa || filtroTemperatura || dataInicio || dataFim);

  const limparFiltros = () => {
    setBusca('');
    setFiltroResponsavel('');
    setFiltroSegmento('');
    setFiltroEtapa('');
    setFiltroTemperatura('');
    setDataInicio('');
    setDataFim('');
  };

  const aplicarAtalho = (tipo: 'hoje' | 'semana' | 'mes') => {
    const agora = new Date();
    const hoje = formatarData(agora);
    if (tipo === 'hoje') {
      setDataInicio(hoje);
      setDataFim(hoje);
    } else if (tipo === 'semana') {
      const dia = agora.getDay();
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - dia);
      setDataInicio(formatarData(inicio));
      setDataFim(hoje);
    } else {
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      setDataInicio(formatarData(inicio));
      setDataFim(hoje);
    }
  };

  const filtrosAtuais: KanbanFiltros = {
    busca,
    responsavel: filtroResponsavel,
    segmento: filtroSegmento,
    etapa: filtroEtapa,
    temperatura: filtroTemperatura,
    dataInicio,
    dataFim,
  };

  const aplicarFiltros = (f: KanbanFiltros) => {
    setBusca(f.busca);
    setFiltroResponsavel(f.responsavel);
    setFiltroSegmento(f.segmento);
    setFiltroEtapa(f.etapa);
    setFiltroTemperatura(f.temperatura);
    setDataInicio(f.dataInicio);
    setDataFim(f.dataFim);
  };

  const { views, salvar, renomear, excluir } = useSavedViews<KanbanFiltros>('kanban-visoes-salvas');

  const chips: FilterChip[] = [
    busca ? { label: 'Busca', value: busca, onRemove: () => setBusca('') } : null,
    filtroResponsavel ? { label: 'Responsável', value: filtroResponsavel, onRemove: () => setFiltroResponsavel('') } : null,
    filtroSegmento ? { label: 'Segmento', value: filtroSegmento, onRemove: () => setFiltroSegmento('') } : null,
    filtroEtapa ? { label: 'Etapa', value: filtroEtapa, onRemove: () => setFiltroEtapa('') } : null,
    filtroTemperatura ? { label: 'Temperatura', value: filtroTemperatura, onRemove: () => setFiltroTemperatura('') } : null,
    dataInicio || dataFim
      ? { label: 'Período', value: [dataInicio, dataFim].filter(Boolean).join(' até '), onRemove: () => { setDataInicio(''); setDataFim(''); } }
      : null,
  ].filter((c): c is FilterChip => c !== null);

  const termo = busca.trim().toLowerCase();
  const leadsFiltrados = leads.filter((l) => {
    // O board representa a carteira atribuída. Contato pendente continua visível
    // em Novo, mas a Ana permanece bloqueada até a autorização ser registrada.
    if (!shouldDisplayInKanban(l)) return false;
    if (termo && !l.nome.toLowerCase().includes(termo) && !l.empresa.toLowerCase().includes(termo)) return false;
    if (filtroResponsavel && l.responsavel !== filtroResponsavel) return false;
    if (filtroSegmento && l.segmento !== filtroSegmento) return false;
    if (filtroEtapa && stageFromLegacy(l.etapa) !== filtroEtapa) return false;
    if (filtroTemperatura && l.temperatura !== filtroTemperatura) return false;
    if (dataInicio && l.criadoEm < dataInicio) return false;
    if (dataFim && l.criadoEm > dataFim) return false;
    return true;
  });

  const contatosPendentes = leadsFiltrados.filter(isContactActivationPending);

  const leadsPorEtapa = (etapa: string) => leadsFiltrados.filter((l) => stageFromLegacy(l.etapa) === etapa);

  const detalhe = detalheId ? leads.find((l) => l.id === detalheId) || null : null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (etapa: string) => {
    if (!dragId) return;
    const alvo = dragId;
    setDragId(null);
    executarMudanca(alvo, legacyStageForPipeline(etapa as (typeof ACTIVE_PIPELINE_STAGES)[number]));
  };

  const mudarEtapa = (id: string, etapa: string) => {
    void executarMudanca(id, etapa);
  };

  const aplicarMudanca = async (id: string, etapa: string, motivo?: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const stage = canonicalStageKeyFromLabel(etapa);
    if (!stage) {
      mostrarToast('Etapa comercial inválida.');
      return;
    }
    setStageChangePending(id);
    try {
      await transitionOperationalLeadStage({ leadId: id, stage, reason: motivo });
      await refreshLeadsStore();
      fluxo.registrarAuditoria({ evento: 'STAGE_CHANGED', ator: 'Usuário', alvo: lead.nome, detalhes: `Movido de "${lead.etapa}" para "${etapa}"` });
      mostrarToast(`${lead.nome} movido para "${etapa}".`);
    } catch (error) {
      mostrarToast(error instanceof CommercialTransitionError ? error.message : 'Não foi possível confirmar a mudança de etapa.');
    } finally {
      setStageChangePending(null);
    }
  };

  const executarMudanca = async (id: string, etapa: string) => {
    if (stageChangePending) {
      mostrarToast('Aguarde a confirmação da alteração anterior.');
      return;
    }
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.etapa === etapa) return;
    if (etapa === 'Perdido') {
      setMotivoModal({ id, etapa, nome: lead.nome, tipo: 'perda' });
      return;
    }
    if (etapa === 'Ganho') {
      setMotivoModal({ id, etapa, nome: lead.nome, tipo: 'ganho' });
      return;
    }
    if (['Ganho', 'Perdido'].includes(lead.etapa)) {
      mostrarToast('Ganho e Perdido são estados finais; a reativação exige um processo de governança.');
      return;
    }
    await aplicarMudanca(id, etapa);
  };

  const confirmarMotivo = () => {
    if (!motivoModal) return;
    if (!motivoTexto.trim()) {
      mostrarToast('Informe o motivo.');
      return;
    }
    void aplicarMudanca(motivoModal.id, motivoModal.etapa, motivoTexto.trim());
    setMotivoModal(null);
    setMotivoTexto('');
  };

  const executarAutomatizacoes = async () => {
    try {
      const result = await runOperationalAutomations();
      mostrarToast(result.timeout_runs ? `${result.timeout_runs} lead(s) de 48h foram encaminhados para revisão humana.` : 'Nenhum timeout pendente no momento.');
    } catch {
      mostrarToast('Não foi possível executar as automações agora. Verifique sua sessão e tente novamente.');
    }
  };

  const rodarAna = async (lead: Lead) => {
    const result = await runAna({ event: 'manual.run', leadId: lead.id, modo: lead.modoAtendimento ?? 'IA' });
    if (!result.ok) throw new Error(result.erro || 'ana_run_failed');
    await refreshLeadsStore();
    mostrarToast(result.status_canal === 'pendente_canal' ? 'Ana gerou um rascunho. O canal ainda não está conectado.' : 'Ana gerou um rascunho para revisão.');
  };

  return (
    <div className="wf-page">
      <header className="wf-page-header">
        <div>
          <p className="wf-eyebrow">Pipeline comercial</p>
          <div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">Kanban</h1><InfoTooltip text="Acompanhe as etapas da carteira e abra cada lead para decidir o próximo passo." label="Sobre Kanban" align="start" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasFiltros && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-100 text-accent-800 rounded-full text-xs font-semibold whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              {leadsFiltrados.length} resultados
            </span>
          )}
          <span className="rounded-full border border-background-200 bg-white px-3 py-2 text-xs font-semibold tabular-nums text-foreground-600 whitespace-nowrap">
            {leadsFiltrados.length} leads no funil
          </span>
          <button
            onClick={executarAutomatizacoes}
            className="wf-btn-secondary cursor-pointer whitespace-nowrap"
          >
            <i className="ri-play-circle-line"></i>
            Executar automações
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="wf-toolbar !block">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar lead por nome ou empresa</span>
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou empresa..."
              className="w-full bg-background-50 py-2 pl-9 pr-4 text-sm text-foreground-900"
            />
          </label>
          <SavedViewsControl
            views={views}
            onLoad={aplicarFiltros}
            onSave={(nome) => salvar(nome, filtrosAtuais)}
            onRename={renomear}
            onDelete={excluir}
          />
          <button onClick={() => setFiltrosAbertos((aberto) => !aberto)} aria-expanded={filtrosAbertos} className="wf-btn-secondary whitespace-nowrap">
            <i className="ri-filter-3-line"></i>
            Filtros
            {chips.length > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-primary-100 text-primary-700 text-[10px] inline-flex items-center justify-center">{chips.length}</span>}
          </button>
        </div>
        {filtrosAbertos && <div className="mt-3 flex flex-col flex-wrap gap-3 border-t border-background-200 pt-3 lg:flex-row lg:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">Responsável</label>
            <select
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
            >
              <option value="">Todos</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">Segmento</label>
            <select
              value={filtroSegmento}
              onChange={(e) => setFiltroSegmento(e.target.value)}
              className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
            >
              <option value="">Todos</option>
              {segmentosDisponiveis.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">Etapa</label>
            <select
              value={filtroEtapa}
              onChange={(e) => setFiltroEtapa(e.target.value)}
              className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
            >
              <option value="">Todas</option>
              {ACTIVE_PIPELINE_STAGES.map((et) => (
                <option key={et} value={et}>{PIPELINE_STAGE_LABEL[et]}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">Temperatura</label>
            <select
              value={filtroTemperatura}
              onChange={(e) => setFiltroTemperatura(e.target.value)}
              className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
            >
              <option value="">Todas</option>
              {temperaturasDisponiveis.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">Criado de</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">até</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => aplicarAtalho('hoje')}
              className="px-3 py-2.5 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Hoje
            </button>
            <button
              onClick={() => aplicarAtalho('semana')}
              className="px-3 py-2.5 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Esta semana
            </button>
            <button
              onClick={() => aplicarAtalho('mes')}
              className="px-3 py-2.5 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Este mês
            </button>
          </div>
          {hasFiltros && (
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-close-circle-line"></i>
              Limpar filtros
            </button>
          )}
        </div>}

        <FilterChips chips={chips} />
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {contatosPendentes.length > 0 && (
        <div role="status" className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <strong>{contatosPendentes.length} lead(s) aguardando autorização de contato.</strong> Eles já estão no Kanban, em Novo, mas a Ana não iniciará mensagem até a comprovação de canal e autorização ser registrada.
        </div>
      )}

      <div className="flex min-h-[calc(100vh-240px)] gap-3 overflow-x-auto pb-4 snap-x snap-mandatory" aria-label="Etapas do pipeline">
        {ACTIVE_PIPELINE_STAGES.map((etapa) => {
          const lista = leadsPorEtapa(etapa);
          return (
            <div
              key={etapa}
              className={`flex max-h-[calc(100vh-240px)] w-[17rem] max-w-[calc(100vw-2rem)] flex-shrink-0 flex-col rounded-[1.25rem] border ${etapaCores[etapa]} snap-start`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(etapa)}
            >
              <div className="border-b border-background-200/70 px-4 py-3.5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-heading font-semibold text-foreground-900 text-sm flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${etapaIndicador[etapa]}`}></span>{PIPELINE_STAGE_LABEL[etapa]}</h3>
                  <span className="min-w-6 rounded-full border border-background-200 bg-white px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-foreground-500">
                    {lista.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
                {lista.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onClick={() => setDetalheId(lead.id)}
                    className={`group cursor-grab rounded-xl border border-background-200 bg-white p-3.5 shadow-sm transition-all hover:border-background-300 hover:shadow-[0_8px_22px_rgba(15,23,42,0.08)] active:cursor-grabbing ${
                      dragId === lead.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-foreground-900 text-sm leading-tight">{lead.nome}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <i className={`ri-fire-line text-sm ${tempCores[lead.temperatura]}`}></i>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteAlvo(lead);
                          }}
                          title="Arquivar lead"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-400 opacity-100 transition-opacity hover:bg-accent-50 hover:text-accent-600 focus-visible:opacity-100 cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-foreground-500 mb-2">{lead.empresa}</p>
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${(lead.modoAtendimento ?? 'IA') === 'IA' ? 'bg-secondary-100 text-secondary-800' : 'bg-accent-100 text-accent-800'}`}>
                        <i className={`${(lead.modoAtendimento ?? 'IA') === 'IA' ? 'ri-robot-line' : 'ri-user-line'} text-[10px]`}></i>
                        {(lead.modoAtendimento ?? 'IA') === 'IA' ? 'IA' : 'Humano'}
                      </span>
                      <span className="truncate text-[11px] text-foreground-500">{lead.responsavel}</span>
                      {isContactActivationPending(lead) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-accent-100 text-accent-800">
                          <i className="ri-shield-check-line text-[10px]"></i>
                          Autorização pendente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-block rounded-full border border-background-200 bg-background-100 px-2 py-0.5 text-[11px] font-semibold text-foreground-600">
                        Score {lead.score}
                      </span>
                      <span className="text-[10px] text-foreground-400">{lead.ultimaInteracao}</span>
                    </div>
                    <p className="text-[10px] text-foreground-400 mt-1.5 truncate">
                      {lead.segmento} · {lead.cidade}
                    </p>
                  </div>
                ))}
                {lista.length === 0 && (
                  <div className="rounded-xl border border-dashed border-background-300 bg-white/50 px-3 py-8 text-center text-xs text-foreground-500">
                    <i className="ri-inbox-line mb-1 block text-xl text-foreground-400" aria-hidden="true"></i>
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detalhe && (
        <LeadDrawer
          lead={detalhe}
          onClose={() => setDetalheId(null)}
          onMudarEtapa={mudarEtapa}
          onAbrirConversa={(lead) => {
            setDetalheId(null);
            navigate(`/dashboard/atendimento?leadId=${lead.id}`);
          }}
          onExcluir={excluirLead}
          onRodarAna={rodarAna}
        />
      )}

      {motivoModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setMotivoModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">
                {motivoModal.tipo === 'perda' ? 'Registrar perda' : 'Confirmar ganho'}
              </h3>
              <button onClick={() => setMotivoModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              {(motivoModal.tipo === 'perda' || motivoModal.tipo === 'ganho') && (
                <div className="mb-3 flex items-center gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                  <i className="ri-alarm-warning-line"></i>
                  Ação final — o resultado será registrado no histórico comercial.
                </div>
              )}
              <p className="text-sm text-foreground-600 mb-4">
                <b>{motivoModal.nome}</b> será {motivoModal.tipo === 'perda' ? 'movido para Perdido' : 'marcado como Ganho'}. Informe o motivo (obrigatório).
              </p>
              <textarea
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                maxLength={300}
                placeholder={motivoModal.tipo === 'perda' ? 'Ex: Preço acima do esperado...' : 'Ex: Aceite comercial confirmado pelo cliente...'}
                className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 min-h-[80px]"
              />
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setMotivoModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={confirmarMotivo} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {deleteAlvo && (
        <div className="fixed inset-0 z-[60] bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDeleteAlvo(null)}>
          <div className="bg-background-50 rounded-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Arquivar lead</h3>
              <button onClick={() => setDeleteAlvo(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                <i className="ri-alarm-warning-line"></i>
                O lead sairá do funil ativo, mas o histórico comercial será preservado.
              </div>
              <p className="text-sm text-foreground-600">
                Deseja arquivar <b>{deleteAlvo.nome}</b> ({deleteAlvo.empresa}) do Kanban? Você poderá restaurá-lo em Leads.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setDeleteAlvo(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={() => void excluirLead(deleteAlvo)} className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Arquivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import InfoTooltip from '@/components/feature/InfoTooltip';
