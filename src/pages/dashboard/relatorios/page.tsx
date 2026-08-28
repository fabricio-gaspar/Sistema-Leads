import { useMemo, useState } from 'react';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useSavedViews } from '@/hooks/useSavedViews';
import FilterChips from '@/components/feature/FilterChips';
import type { FilterChip } from '@/components/feature/FilterChips';
import SavedViewsControl from '@/components/feature/SavedViewsControl';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { periodoDesde, maxDataString, dentroDoPeriodo } from '@/lib/periodo';

const periodos = [
  { label: 'Últimos 7 dias', valor: '7d' },
  { label: 'Últimos 30 dias', valor: '30d' },
  { label: 'Últimos 90 dias', valor: '90d' },
  { label: 'Este ano', valor: 'ano' },
];

interface RelatoriosFiltros {
  periodo: string;
  responsavel: string;
  segmento: string;
}

export default function Relatorios() {
  const [leads] = useLeadsStore();
  const { propostas } = usePropostasStore();
  const [periodo, setPeriodo] = useLocalStorageState('relatorios-periodo', '30d');
  const [aba, setAba] = useState<'geral' | 'leads' | 'equipe'>('geral');
  const [exportando, setExportando] = useState(false);
  const [toast, setToast] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useLocalStorageState('relatorios-filtro-responsavel', '');
  const [filtroSegmento, setFiltroSegmento] = useLocalStorageState('relatorios-filtro-segmento', '');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const exportar = () => {
    setExportando(true);
    setTimeout(() => {
      setExportando(false);
      const cabecalho = ['Nome', 'Empresa', 'Segmento', 'Etapa', 'Score', 'Responsável'];
      const linhas = leadsFiltrados.map((l) => [
        l.nome,
        l.empresa,
        l.segmento,
        l.etapa,
        String(l.score),
        l.responsavel,
      ]);
      const csv = [cabecalho, ...linhas]
        .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-leads-${periodo}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mostrarToast('Relatório exportado em CSV!');
    }, 800);
  };

  const responsaveis = Array.from(new Set(leads.map((l) => l.responsavel))).sort();
  const segmentosDisponiveis = Array.from(new Set(leads.map((l) => l.segmento))).sort();

  const hasFiltros = Boolean(filtroResponsavel || filtroSegmento);

  const limparFiltros = () => {
    setFiltroResponsavel('');
    setFiltroSegmento('');
  };

  const filtrosAtuais: RelatoriosFiltros = {
    periodo,
    responsavel: filtroResponsavel,
    segmento: filtroSegmento,
  };

  const aplicarFiltros = (f: RelatoriosFiltros) => {
    setPeriodo(f.periodo);
    setFiltroResponsavel(f.responsavel);
    setFiltroSegmento(f.segmento);
  };

  const { views, salvar, renomear, excluir } = useSavedViews<RelatoriosFiltros>('relatorios-visoes-salvas');

  const chips: FilterChip[] = [
    filtroResponsavel ? { label: 'Responsável', value: filtroResponsavel, onRemove: () => setFiltroResponsavel('') } : null,
    filtroSegmento ? { label: 'Segmento', value: filtroSegmento, onRemove: () => setFiltroSegmento('') } : null,
  ].filter((c): c is FilterChip => c !== null);

  const refDate = maxDataString([
    ...leads.map((lead) => lead.criadoEm),
    ...propostas.map((proposal) => proposal.data),
  ]);
  const desde = periodoDesde(periodo, refDate);

  const leadsFiltrados = leads.filter((l) => {
    if (filtroResponsavel && l.responsavel !== filtroResponsavel) return false;
    if (filtroSegmento && l.segmento !== filtroSegmento) return false;
    if (!dentroDoPeriodo(l.criadoEm, desde)) return false;
    return true;
  });

  const propostasFiltradas = propostas.filter((proposal) => dentroDoPeriodo(proposal.data, desde));
  const orcamentosAceitos = propostasFiltradas.filter((proposal) => proposal.status === 'aceita');
  const pipelineAberto = propostasFiltradas
    .filter((proposal) => ['rascunho', 'aguardando_aprovacao', 'enviada', 'visualizada'].includes(proposal.status))
    .reduce((total, proposal) => total + proposal.valor * (1 - proposal.descontoPct / 100), 0);

  const evolucaoLeads = useMemo(() => {
    const agrupado = new Map<string, { encontrados: number; convertidos: number }>();
    for (const lead of leadsFiltrados) {
      const chave = lead.criadoEm.slice(0, 7);
      const atual = agrupado.get(chave) ?? { encontrados: 0, convertidos: 0 };
      atual.encontrados += 1;
      if (lead.etapa === 'Fechado — Ganho') atual.convertidos += 1;
      agrupado.set(chave, atual);
    }
    return [...agrupado.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, valores]) => ({
        mes: new Date(`${mes}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        ...valores,
      }));
  }, [leadsFiltrados]);

  const porSegmento = segmentosDisponiveis.map((s) => ({
    segmento: s,
    quantidade: leadsFiltrados.filter((l) => l.segmento === s).length,
  })).filter((s) => s.quantidade > 0);

  const maxSeg = Math.max(...porSegmento.map((s) => s.quantidade), 1);

  const porResponsavel = responsaveis.map((nome) => {
    const responsavelLeads = leadsFiltrados.filter((lead) => lead.responsavel === nome);
    const nomesLeads = new Set(responsavelLeads.map((lead) => lead.nome));
    return {
      nome,
      quantidade: responsavelLeads.length,
      convertidos: responsavelLeads.filter((lead) => lead.etapa === 'Fechado — Ganho').length,
      valorOrcado: propostasFiltradas.filter((proposal) => proposal.status === 'aceita' && nomesLeads.has(proposal.lead)).reduce((total, proposal) => total + proposal.valor, 0),
    };
  }).filter((r) => r.quantidade > 0);

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Inteligência comercial</p>
          <h1 className="wf-page-title mt-1">
            Relatórios
          </h1>
          <p className="wf-page-description">
            Análise detalhada de performance, leads e equipe por período.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasFiltros && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-100 text-accent-800 rounded-full text-xs font-semibold whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              {leadsFiltrados.length} resultados
            </span>
          )}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-700 cursor-pointer"
          >
            {periodos.map((p) => (
              <option key={p.valor} value={p.valor}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={exportar}
            disabled={exportando}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 disabled:bg-secondary-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            {exportando ? (
              <>
                <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
                Exportando...
              </>
            ) : (
              <>
                <i className="ri-download-line"></i>
                Exportar CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-background-50 border border-background-200/70 rounded-xl p-4">
        <div className="flex items-center justify-end mb-3">
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

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Abas */}
      <div className="mb-6 flex flex-wrap gap-1 bg-background-100 rounded-xl p-1">
        {(
          [
            { id: 'geral', label: 'Visão Geral' },
            { id: 'leads', label: 'Leads' },
            { id: 'equipe', label: 'Equipe' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              aba === t.id
                ? 'bg-background-50 text-foreground-900 shadow-sm'
                : 'text-foreground-500 hover:text-foreground-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === ABA GERAL === */}
      {aba === 'geral' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Leads no funil', value: leadsFiltrados.length.toLocaleString(), icon: 'ri-user-search-line', color: 'bg-primary-100 text-primary-600' },
              { label: 'Valor em orçamentos aceitos', value: orcamentosAceitos.reduce((total, proposal) => total + proposal.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: 'ri-file-check-line', color: 'bg-accent-100 text-accent-600' },
              { label: 'Pipeline aberto', value: pipelineAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: 'ri-line-chart-line', color: 'bg-primary-500/20 text-primary-600' },
              { label: 'Taxa de fechamento', value: `${leadsFiltrados.length ? Math.round((leadsFiltrados.filter((l) => l.etapa === 'Fechado — Ganho').length / leadsFiltrados.length) * 100) : 0}%`, icon: 'ri-trophy-line', color: 'bg-secondary-100 text-secondary-600' },
            ].map((kpi, i) => (
              <div key={i} className="bg-background-50 border border-background-200/70 rounded-xl p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${kpi.color}`}>
                  <i className={`${kpi.icon} text-lg`}></i>
                </div>
                <p className="text-2xl font-heading font-extrabold text-foreground-950">{kpi.value}</p>
                <p className="text-foreground-500 text-sm mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Gráfico evolução + Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
              <h3 className="font-heading font-bold text-foreground-900 text-sm mb-5">
                Evolução de leads
              </h3>
              <div className="space-y-4">
                {evolucaoLeads.map((item, i) => {
                  const max = Math.max(...evolucaoLeads.map((d) => d.encontrados), 1);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-foreground-500 w-8">{item.mes}</span>
                      <div className="flex-1 h-7 bg-background-100 rounded-md overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary-500/80 rounded-md"
                          style={{ width: `${(item.encontrados / max) * 100}%` }}
                        ></div>
                        <span className="absolute inset-y-0 left-2 flex items-center text-xs text-background-50 font-medium">
                          {item.encontrados}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {evolucaoLeads.length === 0 && (
                  <p className="py-8 text-center text-sm text-foreground-400">Sem leads no período selecionado.</p>
                )}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-background-200/70">
                <span className="text-xs text-foreground-500 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-primary-500/80"></span>
                  Encontrados
                </span>
                <span className="text-xs text-foreground-500 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-accent-400/80"></span>
                  Convertidos
                </span>
              </div>
            </div>

            <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
              <h3 className="font-heading font-bold text-foreground-900 text-sm mb-5">
                Leads por segmento
              </h3>
              <div className="space-y-4">
                {porSegmento.map((s) => (
                  <div key={s.segmento}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground-700">{s.segmento}</span>
                      <span className="text-xs text-foreground-500">
                        {s.quantidade} leads
                      </span>
                    </div>
                    <div className="w-full h-2 bg-background-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${(s.quantidade / maxSeg) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === ABA LEADS === */}
      {aba === 'leads' && (
        <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
            <h3 className="font-heading font-bold text-foreground-900 text-sm">
              Detalhamento de leads
            </h3>
            <span className="text-xs text-foreground-500">{leadsFiltrados.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70 bg-background-100/50">
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Lead</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Segmento</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Etapa</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Score</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.map((l) => (
                  <tr key={l.id} className="border-b border-background-100 hover:bg-background-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground-900">{l.nome}</p>
                      <p className="text-xs text-foreground-500">{l.empresa}</p>
                    </td>
                    <td className="px-6 py-3.5 text-foreground-600">{l.segmento}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-background-200 text-foreground-600">
                        {l.etapa}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-foreground-900">{l.score}</td>
                    <td className="px-6 py-3.5 text-foreground-600 hidden lg:table-cell">{l.responsavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === ABA EQUIPE === */}
      {aba === 'equipe' && (
        <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-background-200/70">
            <h3 className="font-heading font-bold text-foreground-900 text-sm">
              Performance por responsável
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70 bg-background-100/50">
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Responsável</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Leads atribuídos</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Convertidos</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Orçamentos aceitos</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Taxa de conversão</th>
                </tr>
              </thead>
              <tbody>
                {porResponsavel.map((r) => {
                  const taxa = r.quantidade > 0 ? ((r.convertidos / r.quantidade) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={r.nome} className="border-b border-background-100 hover:bg-background-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-foreground-900">{r.nome}</td>
                      <td className="px-6 py-3.5 text-foreground-700">{r.quantidade}</td>
                      <td className="px-6 py-3.5 text-foreground-700">{r.convertidos}</td>
                      <td className="px-6 py-3.5 text-foreground-700">{r.valorOrcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-background-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(Number(taxa), 100)}%` }}></div>
                          </div>
                          <span className="text-sm font-medium text-foreground-900">{taxa}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
