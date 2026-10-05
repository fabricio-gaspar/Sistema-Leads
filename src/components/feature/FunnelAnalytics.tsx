import { escapeCsvCell } from '@/lib/csv';
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownToLine, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, CircleHelp, FileText, Filter, History, Info, RefreshCw, SlidersHorizontal, UserRound, UsersRound, Wifi, WifiOff } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL } from '@/domain/pipeline';
import { analyticsTimezone, type AnalyticsPeriod } from '@/domain/commercialAnalytics';
import { buildFunnelAnalytics, inFunnelWindow, initialFunnelFilters, type FunnelFilters } from '@/domain/funnelAnalytics';
import { useCommercialAnalytics } from '@/hooks/useCommercialAnalytics';
import InfoTooltip from './InfoTooltip';

const number = (value: number) => value.toLocaleString('pt-BR');
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const tooltipStyle = { borderRadius: 12, border: '1px solid #dfe6e2', color: '#161b19', boxShadow: '0 8px 28px #11131812' };
const sampleLimit = 10;

function periodLabel(period: AnalyticsPeriod) {
  return period === 'year' ? 'Este ano' : `Últimos ${period} dias`;
}

function readFilters(params: URLSearchParams): FunnelFilters {
  const period = params.get('period');
  return {
    period: period === '7' || period === '30' || period === '90' || period === 'year' ? period : initialFunnelFilters.period,
    owner: params.get('owner') ?? '',
    origin: params.get('origin') ?? '',
    stage: params.get('stage') ?? '',
    segment: params.get('segment') ?? '',
  };
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="wf-funnel-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

export default function FunnelAnalytics() {
  const { snapshot, loading, error, connection, refresh } = useCommercialAnalytics();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [moreFilters, setMoreFilters] = useState(Boolean(filters.segment));
  const [series, setSeries] = useState<'leads' | 'proposals'>('leads');
  const [pipelineMode, setPipelineMode] = useState<'leads' | 'value'>('leads');
  const [definitions, setDefinitions] = useState(false);
  const ready = Boolean(snapshot) && !error;
  const analytics = useMemo(() => buildFunnelAnalytics(snapshot?.leads ?? [], snapshot?.proposals ?? [], snapshot?.stages ?? [], filters), [snapshot, filters]);
  const owners = [...new Set((snapshot?.leads ?? []).map((lead) => lead.responsavel).filter(Boolean))].sort();
  const origins = [...new Set((snapshot?.leads ?? []).map((lead) => lead.origem).filter(Boolean))].sort();
  const segments = [...new Set((snapshot?.leads ?? []).map((lead) => lead.segmento).filter(Boolean))].sort();
  const updated = snapshot ? new Date(snapshot.updatedAt).toLocaleString('pt-BR', { timeZone: analyticsTimezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const queryFor = (stage = '') => {
    const next = new URLSearchParams();
    if (filters.period) next.set('period', filters.period);
    if (filters.owner) next.set('owner', filters.owner);
    if (filters.origin) next.set('origin', filters.origin);
    if (filters.segment) next.set('segment', filters.segment);
    if (stage) next.set('stage', stage);
    return next.toString();
  };
  const updateFilter = (key: keyof FunnelFilters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  const compare = params.get('compare') === '1';
  const setCompare = (value: boolean) => {
    const next = new URLSearchParams(params);
    if (value) next.set('compare', '1'); else next.delete('compare');
    setParams(next);
  };
  const exportCsv = () => {
    if (!ready) return;
    const rows = [
      ['Relatório', 'Funil Wayflex'],
      ['Atualizado em', snapshot?.updatedAt ?? ''],
      ['Fuso', analyticsTimezone],
      ['Filtros', `${periodLabel(filters.period)} | ${filters.owner || 'Todos os responsáveis'} | ${filters.origin || 'Todas as origens'} | ${filters.stage ? PIPELINE_STAGE_LABEL[filters.stage as keyof typeof PIPELINE_STAGE_LABEL] : 'Todas as etapas'}`],
      [],
      ['Indicador', 'Valor'],
      ['Leads captados', String(analytics.captured.length)],
      ['Na carteira', String(analytics.portfolio.length)],
      ['Orçamentos abertos', String(analytics.activeProposals.length)],
      ['Valor em aberto', money(analytics.expectedValue)],
      ['Conversão', analytics.conversion === null ? 'Base insuficiente' : `${analytics.conversion.toFixed(1)}%`],
      [],
      ['Etapa', 'Leads', 'Valor em aberto'],
      ...analytics.stageCounts.map((stage) => [stage.name, String(stage.leads), money(stage.value)]),
    ];
    const escape = escapeCsvCell;
    const blob = new Blob(['\uFEFF', rows.map((row) => row.map((cell) => escape(String(cell))).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `wayflex-funil-${analytics.range.start}-${analytics.range.end}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const maxPipeline = Math.max(1, ...analytics.stageCounts.map((stage) => pipelineMode === 'leads' ? stage.leads : stage.value));
  const maxOrigin = Math.max(1, ...analytics.originRows.map((row) => row.count));
  const healthy = !error && connection !== 'offline';

  return <div className="wf-funnel" aria-label="Inteligência comercial">
    <header className="wf-funnel-header">
      <div><p className="wf-funnel-eyebrow">Inteligência comercial</p><h1>Funil</h1><p>Acompanhe o volume, a movimentação e o valor das oportunidades comerciais.</p></div>
      <div className="wf-funnel-header-actions"><Link to="/dashboard/kanban" className="wf-funnel-btn wf-funnel-btn--secondary"><BarChart3 size={16} />Abrir Kanban</Link><button type="button" className="wf-funnel-btn wf-funnel-btn--secondary" onClick={exportCsv} disabled={!ready}><ArrowDownToLine size={16} />Exportar</button></div>
    </header>

    <section className="wf-funnel-filter-card" aria-label="Filtros do funil">
      <div className="wf-funnel-filter-row"><SlidersHorizontal size={16} aria-hidden="true" />
        <FilterSelect label="Período" value={filters.period} onChange={(value) => updateFilter('period', value)}>{(['7', '30', '90'] as AnalyticsPeriod[]).map((value) => <option value={value} key={value}>{periodLabel(value)}</option>)}<option value="year">Este ano</option></FilterSelect>
        <FilterSelect label="Responsável" value={filters.owner} onChange={(value) => updateFilter('owner', value)}><option value="">Todos os responsáveis</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</FilterSelect>
        <FilterSelect label="Origem" value={filters.origin} onChange={(value) => updateFilter('origin', value)}><option value="">Todas as origens</option>{origins.map((origin) => <option key={origin}>{origin}</option>)}</FilterSelect>
        <FilterSelect label="Etapa atual" value={filters.stage} onChange={(value) => updateFilter('stage', value)}><option value="">Todas as etapas</option>{ACTIVE_PIPELINE_STAGES.map((stage) => <option value={stage} key={stage}>{PIPELINE_STAGE_LABEL[stage]}</option>)}</FilterSelect>
        <button type="button" className={`wf-funnel-filter-action ${moreFilters ? 'is-active' : ''}`} onClick={() => setMoreFilters((value) => !value)}><Filter size={15} />Mais filtros</button>
        <label className="wf-funnel-compare"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Comparar período anterior</label>
      </div>
      {moreFilters && <div className="wf-funnel-filter-advanced"><FilterSelect label="Segmento" value={filters.segment} onChange={(value) => updateFilter('segment', value)}><option value="">Todos os segmentos</option>{segments.map((segment) => <option key={segment}>{segment}</option>)}</FilterSelect><span className="wf-funnel-filter-note">Filtros avançados só aparecem quando existem valores na base atual.</span></div>}
      <div className="wf-funnel-freshness" role="status"><span className={healthy ? '' : 'is-warning'}>{healthy ? <Wifi size={13} /> : <WifiOff size={13} />}{healthy ? 'Atualização automática' : 'Atualização indisponível'}</span><span>{loading ? 'Consultando…' : updated ? `Atualizado hoje, ${updated} · São Paulo` : 'Aguardando primeira consulta'}</span></div>
    </section>

    {ready && analytics.captured.length < sampleLimit && <div className="wf-funnel-sample-warning" role="status"><Info size={18} /><div><strong>Base pequena para taxas</strong><span>Há {number(analytics.captured.length)} {analytics.captured.length === 1 ? 'lead' : 'leads'} no período. Os volumes são exibidos, mas taxas e tendências ficam indisponíveis até existir base suficiente.</span></div><button type="button" onClick={() => setDefinitions(true)}>Entender os cálculos <ArrowUpRight size={14} /></button></div>}
    {error && <div className="wf-funnel-error" role="alert">Não foi possível confirmar os indicadores. <button type="button" onClick={() => void refresh()}>Tentar novamente</button></div>}

    <section className="wf-funnel-stat-grid" aria-label="Indicadores principais">
      {[
        ['Leads captados', ready ? number(analytics.captured.length) : '—', 'No período selecionado', 'Registros que entraram pela primeira vez no processo dentro do período.'],
        ['Na carteira', ready ? number(analytics.portfolio.length) : '—', 'Situação atual', 'Oportunidades abertas e válidas na carteira atual.'],
        ['Orçamentos abertos', ready ? number(analytics.activeProposals.length) : '—', ready && analytics.activeProposals.length ? 'Versões ativas' : 'Nenhum orçamento ativo', 'Versão ativa emitida, sem decisão final, cancelamento ou expiração.'],
        ['Valor em aberto', ready ? money(analytics.expectedValue) : '—', 'Valores líquidos', 'Valor líquido das versões ativas dos orçamentos, sem somar revisões substituídas.'],
        ['Conversão', ready && analytics.conversion !== null ? `${analytics.conversion.toFixed(1).replace('.', ',')}%` : '—', ready && analytics.decisionBase ? `${analytics.wonDecisions} ganhos / ${analytics.lostDecisions} perdidos` : 'Base insuficiente', 'Ganhos ÷ (ganhos + perdidos) decididos no período.'],
      ].map(([title, value, note, help]) => <article className="wf-funnel-stat" key={title}><div><span>{title}</span><InfoTooltip text={help} label={`Definição de ${title}`} /></div><strong>{value}</strong><small>{note}</small><ChevronRight size={16} aria-hidden="true" /></article>)}
    </section>

    <div className="wf-funnel-grid wf-funnel-grid--primary">
      <section className="wf-funnel-card wf-funnel-pipeline"><header><div><h2>Pipeline atual</h2><p>Distribuição da carteira por etapa</p></div><div className="wf-funnel-segmented" aria-label="Métrica do pipeline"><button type="button" aria-pressed={pipelineMode === 'leads'} onClick={() => setPipelineMode('leads')}>Leads</button><button type="button" aria-pressed={pipelineMode === 'value'} onClick={() => setPipelineMode('value')}>Valor</button></div></header>
        <div className="wf-funnel-stage-list">{analytics.stageCounts.map((stage) => { const value = pipelineMode === 'leads' ? stage.leads : stage.value; return <Link to={`/dashboard/kanban?${queryFor(stage.stage)}`} className="wf-funnel-stage" key={stage.stage}><span>{stage.name}</span><span className="wf-funnel-stage-track"><span style={{ width: `${value / maxPipeline * 100}%` }} /></span><strong>{pipelineMode === 'leads' ? number(stage.leads) : money(stage.value)}</strong><ChevronRight size={15} /></Link>; })}</div>
        <Link to={`/dashboard/kanban?${queryFor()}`} className="wf-funnel-card-link"><BarChart3 size={16} />Ver leads no Kanban <ArrowUpRight size={14} /></Link>
      </section>
      <section className="wf-funnel-card wf-funnel-movement"><header><div><h2>Movimentação no período</h2><p>Eventos registrados nos últimos {filters.period === 'year' ? '12 meses' : `${filters.period} dias`}</p></div></header>
        <div className="wf-funnel-movement-list"><div><UsersRound size={17} /><span>Leads captados</span><strong>{ready ? number(analytics.captured.length) : '—'}</strong></div><div><RefreshCw size={17} /><span>Mudanças de etapa</span><strong>{ready ? number(analytics.stageEvents.length) : '—'}</strong></div><div><FileText size={17} /><span>Orçamentos enviados</span><strong>{ready ? number(analytics.emittedProposals.filter((proposal) => ['enviada', 'visualizada'].includes(proposal.status) && inFunnelWindow(proposal.createdAt ?? proposal.data, analytics.range.start, analytics.range.end)).length) : '—'}</strong></div><div><CircleHelp size={17} /><span>Decisões registradas</span><strong>{ready ? number(analytics.decisions.length) : '—'}</strong></div></div>
        <p className="wf-funnel-card-caption">Volumes de eventos, não fotografia atual da carteira.</p><Link to={`/dashboard/relatorios?view=stage-history&period=${filters.period}`} className="wf-funnel-card-link"><History size={16} />Ver eventos <ArrowUpRight size={14} /></Link>
      </section>
    </div>

    <div className="wf-funnel-grid wf-funnel-grid--secondary">
      <section className="wf-funnel-card wf-funnel-evolution"><header><div><h2>Evolução da carteira</h2><p>Entradas e permanência ao longo do período</p></div><div className="wf-funnel-segmented"><button type="button" aria-pressed={series === 'leads'} onClick={() => setSeries('leads')}>Leads</button><button type="button" aria-pressed={series === 'proposals'} onClick={() => setSeries('proposals')}>Orçamentos</button></div></header>
        {ready && (analytics.captured.length || analytics.emittedProposals.length) ? <><div className="wf-funnel-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.dayPoints} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="wf-funnel-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#328467" stopOpacity={0.22} /><stop offset="100%" stopColor="#328467" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf1ef" strokeDasharray="3 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: '#6d7874', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} allowDecimals={series === 'proposals'} tick={{ fill: '#6d7874', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [series === 'proposals' ? money(Number(value)) : number(Number(value)), series === 'proposals' ? 'Orçamentos emitidos' : 'Leads captados']} /><Area type="linear" dataKey={series === 'proposals' ? 'proposals' : 'captured'} name={series === 'proposals' ? 'Orçamentos emitidos' : 'Captados'} stroke="#328467" fill="url(#wf-funnel-fill)" strokeWidth={2.3} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div><p className="wf-funnel-card-caption">A data de captação e a etapa atual são métricas diferentes.</p>{compare && <p className="wf-funnel-card-caption">Comparação solicitada: dados anteriores ficam disponíveis na exportação quando há base correspondente.</p>}</> : <div className="wf-funnel-empty"><BarChart3 size={22} /><strong>Sem entradas no período</strong><span>O gráfico será preenchido por registros reais.</span></div>}
        <details className="wf-funnel-table"><summary>Ver dados em tabela</summary><table><thead><tr><th>Data</th><th>Captados</th><th>Na carteira hoje</th></tr></thead><tbody>{analytics.dayPoints.map((day) => <tr key={day.key}><td>{day.label}</td><td>{day.captured}</td><td>{day.portfolio}</td></tr>)}</tbody></table></details>
      </section>
      <section className="wf-funnel-card wf-funnel-origin"><header><div><h2>Origem</h2><p>Leads captados no período</p></div></header>{ready && analytics.originRows.length ? <div className="wf-funnel-origin-list">{analytics.originRows.slice(0, 6).map((row) => <div key={row.name}><div><strong>{row.name}</strong><span>{number(row.count)} {row.count === 1 ? 'lead' : 'leads'}</span></div><div className="wf-funnel-origin-track"><span style={{ width: `${row.count / maxOrigin * 100}%` }} /></div><small>{row.percentage.toFixed(0)}% da captação observada.</small></div>)}</div> : <div className="wf-funnel-empty"><BarChart3 size={22} /><strong>Sem origem no período</strong><span>As origens serão exibidas quando houver captação.</span></div>}<Link to={`/dashboard/leads?${queryFor()}`} className="wf-funnel-card-link"><UsersRound size={16} />Ver leads desta origem <ArrowUpRight size={14} /></Link></section>
    </div>

    <section className="wf-funnel-card wf-funnel-progression"><header><div><h2>Avanço entre etapas</h2><p>Somente movimentações registradas no período</p></div>{analytics.captured.length < sampleLimit && <span className="wf-funnel-badge"><Info size={14} />Amostra pequena</span>}</header><div className="wf-funnel-progression-list">{analytics.progression.map((item) => <div key={item.name}><span>{item.name}</span><span className="wf-funnel-stage-track"><span style={{ width: `${item.rate ?? (item.advanced ? 100 : 0)}%` }} /></span><strong>{item.base >= sampleLimit && item.rate !== null ? `${item.rate.toFixed(0)}%` : item.advanced ? `${item.advanced} avanço${item.advanced === 1 ? '' : 's'} observado${item.advanced === 1 ? '' : 's'}` : 'Sem observações'}</strong></div>)}</div><div className="wf-funnel-note"><Info size={16} />As taxas serão exibidas quando houver base suficiente e denominadores válidos.<button type="button" onClick={() => setDefinitions((value) => !value)}>Como os indicadores são calculados? <ArrowUpRight size={13} /></button></div></section>

    <section className="wf-funnel-card wf-funnel-explore"><div><h2>Explore os dados</h2><p>Abra os registros que compõem os indicadores sem alterar ou excluir dados neste painel.</p></div><div><Link to={`/dashboard/leads?${queryFor()}`} className="wf-funnel-btn wf-funnel-btn--secondary"><UserRound size={15} />Ver leads</Link><Link to="/dashboard/orcamentos" className="wf-funnel-btn wf-funnel-btn--secondary"><FileText size={15} />Ver orçamentos</Link><Link to={`/dashboard/relatorios?view=stage-history&period=${filters.period}`} className="wf-funnel-btn wf-funnel-btn--secondary"><History size={15} />Ver histórico de etapas</Link></div></section>

    {definitions && <section className="wf-funnel-definitions" aria-label="Definições dos indicadores"><button type="button" onClick={() => setDefinitions(false)} aria-label="Fechar definições">×</button><h2>Como os indicadores são calculados?</h2><p><strong>Fotografia atual:</strong> carteira e pipeline usam a etapa atual de oportunidades válidas, sem arquivados ou registros em revisão.</p><p><strong>Período:</strong> captação, movimentação, orçamentos enviados e decisões usam datas reais no fuso de São Paulo. Filtros de etapa não alteram eventos históricos.</p><p><strong>Conversão:</strong> ganhos ÷ (ganhos + perdidos) com decisões persistidas no período. Sem base suficiente, mostramos “—” em vez de uma taxa instável.</p></section>}
  </div>;
}
