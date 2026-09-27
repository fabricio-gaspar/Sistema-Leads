import AccessibleDialog from '@/components/feature/AccessibleDialog';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useSavedViews } from '@/hooks/useSavedViews';
import FilterChips from '@/components/feature/FilterChips';
import type { FilterChip } from '@/components/feature/FilterChips';
import SavedViewsControl from '@/components/feature/SavedViewsControl';
import { useCompromissosStore, useCompromissosLoadStatus, refreshCompromissosStore, waitForCompromissosPersistence } from '@/hooks/useCompromissosStore';
import DataReadNotice from '@/components/feature/DataReadNotice';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { stageFromLegacy } from '@/domain/pipeline';
import type { Compromisso } from '@/mocks/frontendAdvancedData';
import '../command-secondary.css';

const formatarData = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const gerarSemana = (base: Date): { datas: string[]; rotulos: string[] } => {
  const inicio = new Date(base);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const datas: string[] = [];
  const rotulos: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    datas.push(formatarData(d));
    rotulos.push(nomesDia[d.getDay()]);
  }
  return { datas, rotulos };
};

const tipoCores: Record<string, string> = {
  reuniao: 'bg-primary-100 text-primary-700 border-primary-200',
  ligacao: 'bg-accent-100 text-accent-700 border-accent-200',
  followup: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  proposta: 'bg-primary-500/20 text-primary-600 border-primary-300',
};

const tipoLabel: Record<string, string> = {
  reuniao: 'Reunião',
  ligacao: 'Ligação',
  followup: 'Follow-up',
  proposta: 'Proposta',
};

const canalIcone: Record<string, string> = {
  presencial: 'ri-map-pin-line',
  video: 'ri-video-line',
  telefone: 'ri-phone-line',
  whatsapp: 'ri-whatsapp-line',
};

interface AgendaFiltros {
  busca: string;
  responsavel: string;
  segmento: string;
  dataInicio: string;
  dataFim: string;
}

const calcularHoraFim = (inicio: string, duracao = 60): string => {
  const [h, m] = inicio.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + duracao, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function Agenda() {
  const loadStatus = useCompromissosLoadStatus();
  const [salvando, setSalvando] = useState(false);
  const { compromissos: comps, criar, atualizar, excluir: removerCompromisso } = useCompromissosStore();
  const [leads] = useLeadsStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const hoje = new Date();
  const hojeStr = formatarData(hoje);
  const { datas: dias, rotulos: nomesDias } = gerarSemana(hoje);

  const [dataSelecionada, setDataSelecionada] = useState(hojeStr);
  const [detalhe, setDetalhe] = useState<Compromisso | null>(null);
  const [novoModal, setNovoModal] = useState(false);
  const [toast, setToast] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useLocalStorageState('agenda-filtro-responsavel', '');
  const [filtroSegmento, setFiltroSegmento] = useLocalStorageState('agenda-filtro-segmento', '');
  const [dataInicio, setDataInicio] = useLocalStorageState('agenda-data-inicio', '');
  const [dataFim, setDataFim] = useLocalStorageState('agenda-data-fim', '');
  const [busca, setBusca] = useLocalStorageState('agenda-busca', '');

  // Estados do modal "Novo compromisso"
  const [novoTitulo, setNovoTitulo] = useState('Reunião de apresentação');
  const [novoLeadId, setNovoLeadId] = useState('');
  const [novoData, setNovoData] = useState(hojeStr);
  const [novoHora, setNovoHora] = useState('14:00');
  const [novoDuracao, setNovoDuracao] = useState(60);
  const [novoTipo, setNovoTipo] = useState<'reuniao' | 'ligacao' | 'followup' | 'proposta'>('reuniao');
  const [novoCanal, setNovoCanal] = useState<'presencial' | 'video' | 'telefone' | 'whatsapp'>('video');
  const [remarcarModal, setRemarcarModal] = useState<Compromisso | null>(null);
  const [remarcarData, setRemarcarData] = useState('');
  const [remarcarHora, setRemarcarHora] = useState('');
  const [remarcarDuracao, setRemarcarDuracao] = useState(60);

  // A Central envia o lead no endereço e abre somente o formulário de
  // compromisso. A criação continua nesta tela, usando a mesma store da Agenda.
  useEffect(() => {
    const requestedLeadId = searchParams.get('leadId');
    if (searchParams.get('new') !== '1' || !requestedLeadId || !leads.some((lead) => lead.id === requestedLeadId)) return;
    setNovoLeadId(requestedLeadId);
    setNovoModal(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('new');
    setSearchParams(nextParams, { replace: true });
  }, [leads, searchParams, setSearchParams]);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const segmentoPorLead = new Map(leads.map((l) => [l.nome, l.segmento]));
  const compromissoPorLeadId = new Map(comps.filter((c) => c.leadId).map((c) => [c.leadId as string, c]));

  // Consumo da etapa canônica de reunião, incluindo registros legados apenas
  // como compatibilidade de leitura.
  const leadsReuniao = leads.filter((l) => stageFromLegacy(l.etapa) === 'quote_preparation');
  const reunioesAna = comps.filter((c) => c.origem === 'ana' || c.responsavel === 'Ana (IA)');

  const responsaveis = Array.from(new Set(comps.map((c) => c.responsavel))).sort();
  const segmentosDisponiveis = Array.from(new Set(leads.map((l) => l.segmento))).filter(Boolean).sort();

  const hasFiltros = Boolean(busca || filtroResponsavel || filtroSegmento || dataInicio || dataFim);

  const limparFiltros = () => {
    setBusca('');
    setFiltroResponsavel('');
    setFiltroSegmento('');
    setDataInicio('');
    setDataFim('');
  };

  const aplicarAtalho = (tipo: 'hoje' | 'semana' | 'mes') => {
    if (tipo === 'hoje') {
      setDataInicio(hojeStr);
      setDataFim(hojeStr);
    } else if (tipo === 'semana') {
      const dia = hoje.getDay();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dia);
      setDataInicio(formatarData(inicio));
      setDataFim(hojeStr);
    } else {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(formatarData(inicio));
      setDataFim(hojeStr);
    }
  };

  const filtrosAtuais: AgendaFiltros = {
    busca,
    responsavel: filtroResponsavel,
    segmento: filtroSegmento,
    dataInicio,
    dataFim,
  };

  const aplicarFiltros = (f: AgendaFiltros) => {
    setBusca(f.busca);
    setFiltroResponsavel(f.responsavel);
    setFiltroSegmento(f.segmento);
    setDataInicio(f.dataInicio);
    setDataFim(f.dataFim);
  };

  const { views, salvar, renomear, excluir } = useSavedViews<AgendaFiltros>('agenda-visoes-salvas');

  const chips: FilterChip[] = [
    busca ? { label: 'Busca', value: busca, onRemove: () => setBusca('') } : null,
    filtroResponsavel ? { label: 'Responsável', value: filtroResponsavel, onRemove: () => setFiltroResponsavel('') } : null,
    filtroSegmento ? { label: 'Segmento', value: filtroSegmento, onRemove: () => setFiltroSegmento('') } : null,
    dataInicio || dataFim
      ? { label: 'Período', value: [dataInicio, dataFim].filter(Boolean).join(' até '), onRemove: () => { setDataInicio(''); setDataFim(''); } }
      : null,
  ].filter((c): c is FilterChip => c !== null);

  const termo = busca.trim().toLowerCase();
  const compsFiltrados = comps.filter((c) => {
    if (termo && !c.lead.toLowerCase().includes(termo) && !c.empresa.toLowerCase().includes(termo)) return false;
    if (filtroResponsavel && c.responsavel !== filtroResponsavel) return false;
    if (filtroSegmento && segmentoPorLead.get(c.lead) !== filtroSegmento) return false;
    if (dataInicio && c.data < dataInicio) return false;
    if (dataFim && c.data > dataFim) return false;
    return true;
  });

  const compsDoDia = compsFiltrados.filter((c) => c.data === dataSelecionada && c.status !== 'cancelado' && c.status !== 'no_show');

  const horarios = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  ];

  const proximos = compsFiltrados
    .filter((c) => c.status === 'agendado' && c.data >= hojeStr)
    .sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio))
    .slice(0, 5);

  const kpis = [
    { label: 'Reuniões agendadas', value: String(comps.filter((c) => c.status === 'agendado').length), icon: 'ri-calendar-event-line', color: 'bg-primary-100 text-primary-600' },
    { label: 'Hoje', value: String(comps.filter((c) => c.status === 'agendado' && c.data === hojeStr).length), icon: 'ri-calendar-check-line', color: 'bg-accent-100 text-accent-600' },
    { label: 'Agendadas pela Ana', value: String(reunioesAna.filter((c) => c.status === 'agendado').length), icon: 'ri-robot-line', color: 'bg-secondary-100 text-secondary-600' },
    { label: 'Leads em reunião', value: String(leadsReuniao.length), icon: 'ri-user-heart-line', color: 'bg-primary-500/20 text-primary-600' },
  ];

  const confirmarGravacao = async () => {
    setSalvando(true);
    try { await waitForCompromissosPersistence(); return true; }
    catch { mostrarToast('Não foi possível salvar. A agenda foi reconciliada com o servidor; revise e tente novamente.'); return false; }
    finally { setSalvando(false); }
  };

  const confirmarNovo = async () => {
    if (salvando) return;
    const lead = leads.find((l) => l.id === novoLeadId);
    if (!lead) {
      mostrarToast('Selecione um lead para agendar.');
      return;
    }
    if (!novoData || !novoHora || calcularHoraFim(novoHora, novoDuracao) <= novoHora) {
      mostrarToast('Informe data e horário válidos. O compromisso precisa terminar no mesmo dia.'); return;
    }
    criar({
      titulo: novoTitulo.trim() || 'Reunião',
      lead: lead.nome,
      leadId: lead.id,
      empresa: lead.empresa,
      data: novoData,
      horaInicio: novoHora,
      horaFim: calcularHoraFim(novoHora, novoDuracao),
      tipo: novoTipo,
      canal: novoCanal,
      status: 'agendado',
      responsavel: 'Você',
      observacoes: '',
      origem: 'manual',
    });
    if (!await confirmarGravacao()) return;
    setNovoModal(false);
    setNovoTitulo('Reunião de apresentação');
    setNovoLeadId('');
    setNovoData(hojeStr);
    setNovoHora('14:00');
    setNovoDuracao(60);
    mostrarToast('Compromisso agendado!');
  };

  const abrirRemarcar = (c: Compromisso) => {
    setRemarcarModal(c);
    setRemarcarData(c.data);
    setRemarcarHora(c.horaInicio);
    const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
    setRemarcarDuracao(Math.max(15, minutos(c.horaFim) - minutos(c.horaInicio)));
  };

  const confirmarRemarcar = async () => {
    if (salvando) return;
    if (!remarcarModal) return;
    if (!remarcarData || !remarcarHora || calcularHoraFim(remarcarHora, remarcarDuracao) <= remarcarHora) {
      mostrarToast('Escolha a nova data e horário.');
      return;
    }
    atualizar(remarcarModal.id, {
      data: remarcarData,
      horaInicio: remarcarHora,
      horaFim: calcularHoraFim(remarcarHora, remarcarDuracao),
      status: 'agendado',
    });
    if (!await confirmarGravacao()) return;
    setRemarcarModal(null);
    mostrarToast('Compromisso remarcado!');
  };

  const cancelarCompromisso = async (c: Compromisso) => {
    if (salvando) return;
    atualizar(c.id, { status: 'cancelado' });
    if (!await confirmarGravacao()) return;
    setDetalhe(null);
    mostrarToast('Compromisso cancelado.');
  };

  const excluirCompromisso = async (c: Compromisso) => {
    if (salvando || !window.confirm(`Excluir o compromisso “${c.titulo}”? Esta ação não pode ser desfeita.`)) return;
    removerCompromisso(c.id);
    if (!await confirmarGravacao()) return;
    setDetalhe(null);
    mostrarToast('Compromisso excluído definitivamente.');
  };

  return (
    <div className="wf-page wf-secondary-page wf-secondary-page--agenda">
      <DataReadNotice status={loadStatus} onRetry={() => { void refreshCompromissosStore(); }} />
      {salvando && <p role="status" className="mb-3 text-sm text-foreground-600">Salvando compromisso…</p>}
      <div className="wf-secondary-header mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="wf-secondary-eyebrow">Planejamento comercial</p>
          <h1 className="wf-page-title mb-2">
            Agenda
          </h1>
          <p className="wf-secondary-description text-foreground-600 text-sm">
            Reuniões, ligações e próximos passos. Horários em formato de 24 horas, no fuso local do dispositivo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasFiltros && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-100 text-accent-800 rounded-full text-xs font-semibold whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              {compsFiltrados.length} resultados
            </span>
          )}
          <button
            onClick={() => setNovoModal(true)}
            className="wf-secondary-action inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-5 py-2.5 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Novo compromisso
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* KPIs */}
      <div className="wf-secondary-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="wf-secondary-kpi bg-background-50 border border-background-200/70 rounded-xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${kpi.color}`}>
              <i className={`${kpi.icon} text-lg`}></i>
            </div>
            <p className="text-2xl font-heading font-extrabold text-foreground-950">{kpi.value}</p>
            <p className="text-foreground-500 text-sm mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Reuniões agendadas pela Ana */}
      {leadsReuniao.length > 0 && (
        <div className="wf-secondary-panel mb-6 bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                <i className="ri-robot-line text-secondary-600 text-base"></i>
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground-900 text-sm">Reuniões agendadas pela Ana</h3>
                <p className="text-xs text-foreground-500">Leads na etapa Reunião do funil</p>
              </div>
            </div>
            <span className="px-3 py-1.5 bg-secondary-100 text-secondary-800 rounded-full text-xs font-semibold whitespace-nowrap">
              {leadsReuniao.length} {leadsReuniao.length === 1 ? 'reunião' : 'reuniões'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {leadsReuniao.map((l) => {
              const reu = compromissoPorLeadId.get(l.id);
              return (
                <div key={l.id} className="border border-background-200/70 rounded-lg p-4 bg-background-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-foreground-900 truncate">{l.nome}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary-100 text-primary-700 font-medium whitespace-nowrap flex-shrink-0">
                      {l.segmento}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-500 mb-3 truncate">{l.empresa}</p>
                  {reu ? (
                    <div className="flex items-center gap-2 text-xs text-foreground-600 flex-wrap">
                      <i className="ri-calendar-line"></i>
                      {new Date(reu.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      <span className="text-foreground-300">·</span>
                      <i className="ri-time-line"></i>
                      {reu.horaInicio}
                      <button
                        onClick={() => setDetalhe(reu)}
                        className="ml-auto text-primary-600 hover:text-primary-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Ver detalhes
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-foreground-400">
                      <i className="ri-information-line"></i>
                      Sem horário definido no calendário
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="wf-secondary-filter mb-6 bg-background-50 border border-background-200/70 rounded-xl p-4">
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
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
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
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-foreground-600 mb-1.5">Data de</label>
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
        </div>

        <FilterChips chips={chips} />
      </div>

      <div className="wf-secondary-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário semanal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Seletor de dia */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dias.map((d, i) => {
              const num = d.split('-')[2];
              const ativo = d === dataSelecionada;
              return (
                <button
                  key={d}
                  onClick={() => setDataSelecionada(d)}
                  className={`flex flex-col items-center min-w-[64px] px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                    ativo
                      ? 'bg-primary-500 border-primary-500 text-background-50'
                      : 'bg-background-50 border-background-200/70 text-foreground-700 hover:border-background-300'
                  }`}
                >
                  <span className="text-[10px] font-medium uppercase">{nomesDias[i]}</span>
                  <span className="text-lg font-heading font-bold">{num}</span>
                </button>
              );
            })}
          </div>

          {/* Timeline do dia */}
          <div className="wf-secondary-panel bg-background-50 border border-background-200/70 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground-900 text-sm">
                {new Date(dataSelecionada + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
              <span className="text-xs text-foreground-500">
                {compsDoDia.length} {compsDoDia.length === 1 ? 'compromisso' : 'compromissos'}
              </span>
            </div>

            <div className="space-y-2">
              {horarios.map((hora) => {
                const comp = compsDoDia.find((c) => c.horaInicio === hora);
                return (
                  <div key={hora} className="flex gap-3">
                    <span className="text-xs text-foreground-400 w-10 text-right pt-2 flex-shrink-0">
                      {hora}
                    </span>
                    <div className="flex-1 min-h-[48px] border-l-2 border-background-200 pl-3 py-1">
                      {comp ? (
                        <button
                          onClick={() => setDetalhe(comp)}
                          className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${tipoCores[comp.tipo]}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{comp.titulo}</p>
                            <span className="text-[10px] font-medium opacity-70 whitespace-nowrap">
                              {comp.horaInicio} - {comp.horaFim}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 opacity-80">
                            {comp.lead} · {comp.empresa}
                          </p>
                        </button>
                      ) : (
                        <div className="h-8"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Próximos compromissos */}
          <div className="bg-background-50 border border-background-200/70 rounded-xl p-5">
            <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">
              Próximos compromissos
            </h3>
            <div className="space-y-3">
              {proximos.length === 0 && (
                <p className="text-sm text-foreground-400">Nenhum compromisso futuro.</p>
              )}
              {proximos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDetalhe(c)}
                  className="w-full text-left p-3 rounded-lg border border-background-200/70 hover:border-background-300 bg-background-50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${tipoCores[c.tipo]}`}>
                      {tipoLabel[c.tipo]}
                    </span>
                    <span className="text-[10px] text-foreground-400 whitespace-nowrap">
                      {new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </span>
                    {c.origem === 'ana' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-secondary-700 bg-secondary-100 px-1.5 py-0.5 rounded">
                        <i className="ri-robot-line"></i>Ana
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground-900">{c.titulo}</p>
                  <p className="text-xs text-foreground-500">{c.lead} · {c.horaInicio}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Resumo da semana */}
          <div className="bg-background-50 border border-background-200/70 rounded-xl p-5">
            <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">
              Resumo dos filtros
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Reuniões', count: compsFiltrados.filter((c) => c.tipo === 'reuniao' && c.status === 'agendado').length, icon: 'ri-video-line', color: 'text-primary-600' },
                { label: 'Ligações', count: compsFiltrados.filter((c) => c.tipo === 'ligacao' && c.status === 'agendado').length, icon: 'ri-phone-line', color: 'text-accent-600' },
                { label: 'Follow-ups', count: compsFiltrados.filter((c) => c.tipo === 'followup' && c.status === 'agendado').length, icon: 'ri-repeat-line', color: 'text-secondary-600' },
                { label: 'Propostas', count: compsFiltrados.filter((c) => c.tipo === 'proposta' && c.status === 'agendado').length, icon: 'ri-file-list-3-line', color: 'text-primary-600' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 flex items-center justify-center ${s.color}`}>
                      <i className={`${s.icon} text-base`}></i>
                    </div>
                    <span className="text-sm text-foreground-700">{s.label}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground-900">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo Compromisso */}
      {novoModal && (
        <AccessibleDialog title="Novo registro" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setNovoModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Novo Compromisso</h3>
              <button aria-label="Fechar formulário" onClick={() => setNovoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Título</label>
                <input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Data</label>
                  <input
                    type="date"
                    value={novoData}
                    onChange={(e) => setNovoData(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Horário</label>
                  <input
                    type="time"
                    value={novoHora}
                    onChange={(e) => setNovoHora(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                  />
                </div>
              </div>
              <div>
                <label className="mb-4 block text-sm font-medium">Duração<select value={novoDuracao} onChange={(event) => setNovoDuracao(Number(event.target.value))} className="mt-1.5 block w-full rounded-lg border border-background-300 px-4 py-2.5">{[15, 30, 45, 60, 90, 120].map((value) => <option key={value} value={value}>{value} minutos</option>)}</select></label>
                <p className="mb-3 text-xs text-foreground-500">{novoData.split('-').reverse().join('/')} · {novoHora}–{calcularHoraFim(novoHora, novoDuracao)}</p>
                <label htmlFor="appointment-lead" className="block text-sm font-medium text-foreground-800 mb-1.5">Lead</label>
                <select
                  id="appointment-lead"
                  value={novoLeadId}
                  onChange={(e) => setNovoLeadId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                >
                  <option value="">Selecione um lead...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome} · {l.empresa}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tipo</label>
                  <select
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value as typeof novoTipo)}
                    className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                  >
                    <option value="reuniao">Reunião</option>
                    <option value="ligacao">Ligação</option>
                    <option value="followup">Follow-up</option>
                    <option value="proposta">Proposta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Canal</label>
                  <select
                    value={novoCanal}
                    onChange={(e) => setNovoCanal(e.target.value as typeof novoCanal)}
                    className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                  >
                    <option value="video">Vídeo</option>
                    <option value="presencial">Presencial</option>
                    <option value="telefone">Telefone</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button aria-label="Fechar formulário" onClick={() => setNovoModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button
                onClick={confirmarNovo}
                disabled={salvando}
                className="px-5 py-2.5 bg-primary-500 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                Agendar
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal Detalhes */}
      {detalhe && (
        <AccessibleDialog title="Detalhes do registro" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setDetalhe(null)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.titulo}</h3>
                <p className="text-sm text-foreground-500">{detalhe.lead} · {detalhe.empresa}</p>
              </div>
              <button aria-label="Fechar detalhes" onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium ${tipoCores[detalhe.tipo]}`}>
                  {tipoLabel[detalhe.tipo]}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
                  <i className={`${canalIcone[detalhe.canal]} text-sm`}></i>
                  {detalhe.canal === 'presencial' ? 'Presencial' : detalhe.canal === 'video' ? 'Vídeo' : detalhe.canal === 'telefone' ? 'Telefone' : 'WhatsApp'}
                </span>
                {detalhe.origem === 'ana' && (
                  <span className="inline-flex items-center gap-1 text-xs text-secondary-700 bg-secondary-100 px-2 py-1 rounded-full font-medium">
                    <i className="ri-robot-line"></i>Agendada pela Ana
                  </span>
                )}
                {detalhe.status === 'no_show' && (
                  <span className="inline-flex items-center gap-1 text-xs text-accent-700 bg-accent-100 px-2 py-1 rounded-full font-medium">
                    <i className="ri-alarm-warning-line"></i>No-show
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-foreground-500 text-xs">Data</p>
                  <p className="text-foreground-900">{new Date(detalhe.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Horário</p>
                  <p className="text-foreground-900">{detalhe.horaInicio} - {detalhe.horaFim}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Responsável</p>
                  <p className="text-foreground-900">{detalhe.responsavel}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Status</p>
                  <p className="text-foreground-900">{detalhe.status === 'agendado' ? 'Agendado' : detalhe.status === 'realizado' ? 'Realizado' : detalhe.status === 'no_show' ? 'No-show' : 'Cancelado'}</p>
                </div>
              </div>
              <div>
                <p className="text-foreground-500 text-xs mb-1">Observações</p>
                <p className="text-sm text-foreground-700 bg-background-100 rounded-lg p-3">{detalhe.observacoes || '—'}</p>
              </div>
              <div className="pt-3 border-t border-background-200/70 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => excluirCompromisso(detalhe)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-accent-600 hover:bg-accent-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Excluir
                </button>
                {detalhe.status === 'agendado' && (
                  <button
                    onClick={() => cancelarCompromisso(detalhe)}
                    className="px-3 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => abrirRemarcar(detalhe)}
                  className="px-3 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-calendar-2-line mr-1"></i>
                  Remarcar
                </button>
                {detalhe.status !== 'realizado' && (
                  <button
                    disabled={salvando}
                    onClick={async () => { atualizar(detalhe.id, { status: 'realizado' }); if (!await confirmarGravacao()) return; setDetalhe(null); mostrarToast('Compromisso marcado como "Realizado".'); }}
                    className="px-4 py-2.5 bg-primary-500 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    Marcar como realizado
                  </button>
                )}
              </div>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal Remarcar */}
      {remarcarModal && (
        <AccessibleDialog title="Remarcar compromisso" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setRemarcarModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Remarcar compromisso</h3>
                <p className="text-sm text-foreground-500">{remarcarModal.titulo}</p>
              </div>
              <button onClick={() => setRemarcarModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nova data</label>
                <input type="date" value={remarcarData} onChange={(e) => setRemarcarData(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Novo horário</label>
                <input type="time" value={remarcarHora} onChange={(e) => setRemarcarHora(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setRemarcarModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={confirmarRemarcar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Confirmar</button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
