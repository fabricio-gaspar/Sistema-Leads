import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useSavedViews } from '@/hooks/useSavedViews';
import FilterChips from '@/components/feature/FilterChips';
import type { FilterChip } from '@/components/feature/FilterChips';
import SavedViewsControl from '@/components/feature/SavedViewsControl';
import { leads as leadsSeed } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, legacyStageForPipeline, stageFromLegacy } from '@/domain/pipeline';
import LeadDrawer from './components/LeadDrawer';

const formatarData = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

const etapaCores: Record<string, string> = {
  entered: 'bg-background-100/80 border-background-200', engaging: 'bg-background-100/80 border-background-200', qualified: 'bg-background-100/80 border-background-200', quote_preparation: 'bg-background-100/80 border-background-200', quote_sent: 'bg-background-100/80 border-background-200', decision: 'bg-background-100/80 border-background-200',
};

const etapaIndicador: Record<string, string> = {
  entered: 'bg-foreground-300', engaging: 'bg-primary-400', qualified: 'bg-primary-600', quote_preparation: 'bg-secondary-500', quote_sent: 'bg-accent-500', decision: 'bg-foreground-700',
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
  const [motivoModal, setMotivoModal] = useState<{ id: string; etapa: string; nome: string; tipo: 'perda' | 'reativacao' } | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');
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

  const excluirLead = (lead: Lead) => {
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    setDetalheId(null);
    setDeleteAlvo(null);
    fluxo.registrarAuditoria({
      evento: 'LEAD_DELETED',
      ator: 'Usuário',
      alvo: lead.nome,
      detalhes: 'Lead excluído manualmente do Kanban',
    });
    mostrarToast(`${lead.nome} foi excluído do Kanban.`);
  };

  const responsaveis = Array.from(new Set(leadsSeed.map((l) => l.responsavel))).sort();
  const segmentosDisponiveis = Array.from(new Set(leadsSeed.map((l) => l.segmento))).sort();
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
    if (l.aguardandoAtivacao) return false; // aguardando aprovação no menu Leads
    if (termo && !l.nome.toLowerCase().includes(termo) && !l.empresa.toLowerCase().includes(termo)) return false;
    if (filtroResponsavel && l.responsavel !== filtroResponsavel) return false;
    if (filtroSegmento && l.segmento !== filtroSegmento) return false;
    if (filtroEtapa && stageFromLegacy(l.etapa) !== filtroEtapa) return false;
    if (filtroTemperatura && l.temperatura !== filtroTemperatura) return false;
    if (dataInicio && l.criadoEm < dataInicio) return false;
    if (dataFim && l.criadoEm > dataFim) return false;
    return true;
  });

  const leadsPorEtapa = (etapa: string) => leadsFiltrados.filter((l) => stageFromLegacy(l.etapa) === etapa && !['Fechado — Ganho', 'Fechado — Perdido'].includes(l.etapa));

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
    executarMudanca(id, etapa);
  };

  const aplicarMudanca = (id: string, etapa: string, motivo?: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const ehFinal = ['Fechado — Ganho', 'Fechado — Perdido'].includes(etapa);
    const reativando = lead.etapa === 'Fechado — Perdido' && etapa !== lead.etapa;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              etapa,
              motivoPerda: etapa === 'Fechado — Perdido' ? (motivo || l.motivoPerda || '') : reativando ? '' : l.motivoPerda,
              automacaoStatus: ehFinal || etapa === 'Pausado' ? 'CONCLUIDA' : l.automacaoStatus,
              nextFollowUpAt: ehFinal ? null : l.nextFollowUpAt,
              timeoutAt: ehFinal ? null : l.timeoutAt,
              historico: [
                { id: `h-${Date.now()}`, tipo: reativando ? 'REATIVACAO' : 'STAGE_CHANGED', descricao: reativando ? `Lead reativado em "${etapa}"${motivo ? ` — ${motivo}` : ''}` : `Movido de "${lead.etapa}" para "${etapa}"`, ator: 'Usuário', data: new Date().toISOString() },
                ...(l.historico || []),
              ],
            }
          : l
      )
    );
    fluxo.registrarAuditoria({
      evento: 'STAGE_CHANGED',
      ator: 'Usuário',
      alvo: lead.nome,
      detalhes: reativando ? `Reativado em "${etapa}"` : `Movido de "${lead.etapa}" para "${etapa}"`,
    });
    mostrarToast(`${lead.nome} movido para "${etapa}"`);
  };

  const executarMudanca = (id: string, etapa: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.etapa === etapa) return;
    if (etapa === 'Fechado — Perdido') {
      setMotivoModal({ id, etapa, nome: lead.nome, tipo: 'perda' });
      return;
    }
    if (lead.etapa === 'Fechado — Perdido') {
      setMotivoModal({ id, etapa, nome: lead.nome, tipo: 'reativacao' });
      return;
    }
    aplicarMudanca(id, etapa);
  };

  const confirmarMotivo = () => {
    if (!motivoModal) return;
    if (!motivoTexto.trim()) {
      mostrarToast('Informe o motivo.');
      return;
    }
    aplicarMudanca(motivoModal.id, motivoModal.etapa, motivoTexto.trim());
    setMotivoModal(null);
    setMotivoTexto('');
  };

  const executarAutomatizacoes = async () => {
    const r = await fluxo.processarAutomacoesPendentes();
    const partes = [
      r.followUps ? `${r.followUps} follow-up(s)` : '',
      r.timeouts ? `${r.timeouts} timeout(s)` : '',
      r.lembretes ? `${r.lembretes} lembrete(s) de reunião` : '',
      r.noShows ? `${r.noShows} no-show(s) remarcado(s)` : '',
      r.fluxos ? `${r.fluxos} mensagem(ns) de fluxo` : '',
    ].filter(Boolean);
    mostrarToast(
      partes.length
        ? `Automações processadas: ${partes.join(', ')}.`
        : 'Nenhuma automação pendente no momento.'
    );
  };

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Pipeline comercial</p>
          <h1 className="wf-page-title mt-1">
            Kanban
          </h1>
          <p className="wf-page-description">
            Arraste os leads entre as colunas para atualizar a etapa do funil. Alterações são salvas automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasFiltros && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-100 text-accent-800 rounded-full text-xs font-semibold whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              {leadsFiltrados.length} resultados
            </span>
          )}
          <span className="text-sm text-foreground-500 whitespace-nowrap">
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
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-background-50 border border-background-200/70 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou empresa..."
              className="w-full pl-9 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <SavedViewsControl
            views={views}
            onLoad={aplicarFiltros}
            onSave={(nome) => salvar(nome, filtrosAtuais)}
            onRename={renomear}
            onDelete={excluir}
          />
          <button onClick={() => setFiltrosAbertos((aberto) => !aberto)} className="wf-btn-secondary !min-h-[42px] whitespace-nowrap">
            <i className="ri-filter-3-line"></i>
            Filtros
            {chips.length > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-primary-100 text-primary-700 text-[10px] inline-flex items-center justify-center">{chips.length}</span>}
          </button>
        </div>
        {filtrosAbertos && <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap border-t border-background-200 pt-3">
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

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-240px)] snap-x snap-mandatory">
        {ACTIVE_PIPELINE_STAGES.map((etapa) => {
          const lista = leadsPorEtapa(etapa);
          return (
            <div
              key={etapa}
              className={`flex-shrink-0 w-[17.5rem] max-w-[calc(100vw-2rem)] rounded-xl border ${etapaCores[etapa]} flex flex-col max-h-[calc(100vh-240px)] snap-start`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(etapa)}
            >
              <div className="px-4 py-3 border-b border-background-200/70">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-heading font-semibold text-foreground-900 text-sm flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${etapaIndicador[etapa]}`}></span>{PIPELINE_STAGE_LABEL[etapa]}</h3>
                  <span className="text-xs font-medium text-foreground-500 bg-white border border-background-200 px-2 py-0.5 rounded-md">
                    {lista.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {lista.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onClick={() => setDetalheId(lead.id)}
                    className={`group bg-white rounded-lg p-3.5 border border-background-200 cursor-grab active:cursor-grabbing hover:border-background-300 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] transition-all ${
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
                          title="Excluir lead"
                          className="w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:text-accent-600 hover:bg-accent-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                      <span className="text-[9px] text-foreground-400 truncate">{lead.responsavel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-background-100 text-foreground-600 border border-background-200">
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
                  <div className="text-center py-6 text-foreground-400 text-xs">
                    <i className="ri-inbox-line text-lg mb-1 block"></i>
                    Nenhum lead
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
        />
      )}

      {motivoModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setMotivoModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">
                {motivoModal.tipo === 'perda' ? 'Registrar perda' : 'Reativar lead'}
              </h3>
              <button onClick={() => setMotivoModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              {motivoModal.tipo === 'perda' && (
                <div className="mb-3 flex items-center gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                  <i className="ri-alarm-warning-line"></i>
                  Ação irreversível — o lead será marcado como perdido.
                </div>
              )}
              <p className="text-sm text-foreground-600 mb-4">
                <b>{motivoModal.nome}</b> será {motivoModal.tipo === 'perda' ? 'movido para Fechado — Perdido' : 'reativado'}. Informe o motivo (obrigatório).
              </p>
              <textarea
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                maxLength={300}
                placeholder={motivoModal.tipo === 'perda' ? 'Ex: Preço acima do esperado...' : 'Ex: Lead retomou contato...'}
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
              <h3 className="font-heading font-bold text-foreground-950">Excluir lead</h3>
              <button onClick={() => setDeleteAlvo(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                <i className="ri-alarm-warning-line"></i>
                Ação irreversível — o lead e todo o seu histórico serão removidos.
              </div>
              <p className="text-sm text-foreground-600">
                Tem certeza que deseja excluir <b>{deleteAlvo.nome}</b> ({deleteAlvo.empresa}) do Kanban? Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setDeleteAlvo(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={() => excluirLead(deleteAlvo)} className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
