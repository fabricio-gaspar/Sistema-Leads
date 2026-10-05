import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownToLine, ArrowUpRight, BarChart3, RefreshCw, SlidersHorizontal, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { buildCommercialAnalytics, initialAnalyticsFilters, isCommercialLead, shiftDay, type AnalyticsFilters } from '@/domain/commercialAnalytics';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL } from '@/domain/pipeline';
import { useCommercialAnalytics } from '@/hooks/useCommercialAnalytics';
import InfoTooltip from './InfoTooltip';
import SavedViewsControl from './SavedViewsControl';
import { useSavedViews } from '@/hooks/useSavedViews';

const format = (value: number) => value.toLocaleString('pt-BR');
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const rate = (value: number | null) => value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e6e8', color: '#171a1d', boxShadow: '0 8px 28px #11131812' };

function EmptyChart({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) {
  return <div className={`wf-chart-empty ${error ? 'is-error' : ''}`}><BarChart3 size={25} strokeWidth={1.5} aria-hidden="true" /><strong>{title}</strong><p>{detail}</p></div>;
}
function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return <details className="wf-chart-table"><summary>Ver dados em tabela</summary><div className="overflow-x-auto"><table><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></details>;
}
export default function CommercialAnalytics({ mode = 'overview', aside }: { mode?: 'overview' | 'funnel' | 'reports'; aside?: ReactNode }) {
  const { snapshot, loading, error, connection, refresh } = useCommercialAnalytics();
  const [filters, setFilters] = useState<AnalyticsFilters>(initialAnalyticsFilters);
  const [series, setSeries] = useState<'leads' | 'contacts' | 'proposals'>('leads');
  const [distribution, setDistribution] = useState<'origins' | 'owners' | 'segments'>('origins');
  type CompatibleFilters = Partial<AnalyticsFilters> & { periodo?: string; responsavel?: string; segmento?: string };
  const saved = useSavedViews<CompatibleFilters>('relatorios-visoes-salvas');
  const loadView = (value: CompatibleFilters) => setFilters({ ...initialAnalyticsFilters, ...value,
    period: value.period ?? ({ '7d': '7', '30d': '30', '90d': '90', ano: 'year' } as const)[value.periodo as '7d'] ?? '30',
    owner: value.owner ?? value.responsavel ?? '', segment: value.segment ?? value.segmento ?? '',
  });
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [compare, setCompare] = useState(false);
  const analytics = useMemo(() => buildCommercialAnalytics(snapshot?.leads ?? [], snapshot?.proposals ?? [], filters, snapshot?.stages, snapshot?.contacts), [snapshot, filters]);
  const ready = Boolean(snapshot) && !error;
  const owners = [...new Set((snapshot?.leads ?? []).map((lead) => lead.responsavel).filter(Boolean))].sort();
  const origins = [...new Set((snapshot?.leads ?? []).map((lead) => lead.origem).filter(Boolean))].sort();
  const segments = [...new Set((snapshot?.leads ?? []).map((lead) => lead.segmento).filter(Boolean))].sort();
  const setFilter = (key: keyof AnalyticsFilters, value: string) => setFilters((previous) => ({ ...previous, [key]: value }));
  const updated = snapshot ? new Date(snapshot.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  const graphError = error || (series === 'contacts' && snapshot?.contactError);
  const hasSeries = analytics.days.some((day) => series === 'leads' ? day.encontrados > 0 || (compare && day.anteriores > 0) : series === 'contacts' ? day.recebidas + day.enviadas > 0 : day.orcado + day.aceito > 0);
  const metric = (value: number) => ready ? format(value) : '—';
  const exportCsv = () => {
    if (!ready) return;
    const escape = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
    const rows = [['Empresa', 'Contato', 'Segmento', 'Score', 'Origem', 'Responsável', 'Etapa', 'Data de cadastro', 'Na carteira'], ...analytics.cohort.map((lead) => [lead.empresa, lead.nome, lead.segmento, String(lead.score), lead.origem, lead.responsavel, lead.etapa, lead.criadoEm, analytics.pipeline.some((item) => item.id === lead.id) ? 'Sim' : 'Não'])];
    const blob = new Blob(['\uFEFF', rows.map((row) => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `wayflex-${analytics.range.start}-${analytics.range.end}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const metrics = mode === 'overview' ? [
    { title: 'Novos leads', value: metric(analytics.cohort.length), note: ready ? analytics.growth === null ? 'Sem comparação percentual' : `${analytics.growth >= 0 ? '+' : ''}${rate(analytics.growth)} vs. período anterior` : 'Aguardando leitura', help: 'Leads persistidos no CRM, criados no período. Resultados de busca ainda não importados não entram nesta contagem.' },
    { title: 'Na carteira', value: metric(analytics.pipeline.length), note: 'Mesma regra do Kanban', help: 'Leads não arquivados com modo e responsável atribuídos. O contato pode continuar bloqueado por falta de autorização.' },
    { title: 'Mensagens hoje', value: metric(analytics.days.reduce((total, day) => total + day.recebidas + day.enviadas, 0)), note: 'Recebidas e envios aceitos', help: 'Atividade de contato no recorte selecionado. Um envio aceito não comprova entrega ou leitura.' },
    { title: 'Orçamentos abertos', value: metric(analytics.openProposals.length), note: ready ? currency(analytics.expectedValue) : '—', help: 'Propostas criadas no período, Enviadas ou Visualizadas, ligadas à carteira. Valor líquido do desconto; não é receita reconhecida.' },
    { title: 'Conversão', value: ready ? rate(analytics.conversion) : '—', note: ready ? `${analytics.won.length} ganhos / ${analytics.pipeline.length} na carteira${analytics.pipeline.length > 0 && analytics.pipeline.length < 10 ? ' · base pequena' : ''}` : 'Aguardando leitura', help: 'Situação atual dos leads criados no período: ganhos divididos pela carteira atribuída. Base zero não produz percentual. Uma base pequena tem baixa estabilidade.' },
  ] : [
    { title: 'Cadastrados', value: metric(analytics.cohort.length), note: ready ? analytics.growth === null ? 'Sem comparação percentual' : `${analytics.growth >= 0 ? '+' : ''}${rate(analytics.growth)} vs. período anterior` : 'Aguardando leitura', help: 'Leads persistidos no CRM, criados no período. Resultados de busca ainda não importados não entram nesta contagem.' },
    { title: 'Em revisão', value: metric(analytics.pending.length), note: 'Sem encaminhamento à carteira', help: 'Registros ainda sem o modo e responsável exigidos para entrada no Kanban. Não confundir com autorização de contato.' },
    { title: 'Na carteira', value: metric(analytics.pipeline.length), note: 'Mesma regra do Kanban', help: 'Leads não arquivados com modo e responsável atribuídos. O contato pode continuar bloqueado por falta de autorização.' },
    { title: 'Atendimento humano', value: metric(analytics.human), note: 'Leads ativos atribuídos', help: 'Carteira não encerrada em modo humano ou aguardando humano. Não é uma contagem de mensagens.' },
    { title: 'Orçamentos abertos', value: metric(analytics.openProposals.length), note: ready ? currency(analytics.expectedValue) : '—', help: 'Propostas criadas no período, Enviadas ou Visualizadas, ligadas à carteira. Valor líquido do desconto; não é receita reconhecida.' },
    { title: 'Conversão', value: ready ? rate(analytics.conversion) : '—', note: ready ? `${analytics.won.length} ganhos / ${analytics.pipeline.length} na carteira${analytics.pipeline.length > 0 && analytics.pipeline.length < 10 ? ' · base pequena' : ''}` : 'Aguardando leitura', help: 'Situação atual dos leads criados no período: ganhos divididos pela carteira atribuída. Base zero não produz percentual. Uma base pequena tem baixa estabilidade.' },
  ];
  const group = analytics[distribution];
  const hasPortfolio = snapshot?.leads.some(isCommercialLead);
  const groupMax = Math.max(1, ...group.map((row) => row.encontrados));

  return <section className="wf-analytics" aria-label="Análise comercial">
    <div className="wf-analytics-toolbar">
      <div className="wf-analytics-filters"><SlidersHorizontal size={18} aria-hidden="true" />
        <label><span>Período</span><select value={filters.period} onChange={(event) => setFilter('period', event.target.value)}>{['7', '30', '90'].map((days) => <option key={days} value={days}>Últimos {days} dias</option>)}<option value="year">Este ano</option></select></label>
        <label><span>Responsável</span><select value={filters.owner} onChange={(event) => setFilter('owner', event.target.value)}><option value="">Todos os responsáveis</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
        <label><span>Origem</span><select value={filters.origin} onChange={(event) => setFilter('origin', event.target.value)}><option value="">Todas as origens</option>{origins.map((origin) => <option key={origin}>{origin}</option>)}</select></label>
        <label><span>Etapa atual</span><select value={filters.stage} onChange={(event) => setFilter('stage', event.target.value)}><option value="">Todas as etapas</option>{ACTIVE_PIPELINE_STAGES.map((stage) => <option key={stage} value={stage}>{PIPELINE_STAGE_LABEL[stage]}</option>)}</select></label>
        {mode === 'reports' && <label><span>Segmento</span><select value={filters.segment} onChange={(event) => setFilter('segment', event.target.value)}><option value="">Todos os segmentos</option>{segments.map((segment) => <option key={segment}>{segment}</option>)}</select></label>}
      </div>
      <div className="wf-analytics-tools"><button type="button" className="wf-icon-button" onClick={() => void refresh()} disabled={loading} aria-label="Atualizar indicadores"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button><button type="button" className="wf-btn-secondary" onClick={exportCsv} disabled={!ready}><ArrowDownToLine size={16} />CSV</button></div>
    </div>
    {mode === 'reports' && <div className="flex flex-wrap items-center justify-between gap-3"><button className="wf-overview-link" onClick={() => setFilters(initialAnalyticsFilters)}>Limpar filtros</button><SavedViewsControl views={saved.views} onLoad={loadView} onSave={(name) => saved.salvar(name, filters)} onRename={saved.renomear} onDelete={saved.excluir} /></div>}
    <div className="wf-data-freshness" role="status"><span className={connection === 'offline' || error ? 'is-warning' : ''}>{connection === 'offline' ? <WifiOff size={14} /> : <Wifi size={14} />}{error ? 'Leitura falhou · dados anteriores podem estar desatualizados' : connection === 'offline' ? 'Sem conexão' : connection === 'live' ? 'Mensagens ao vivo · carteira a cada 60 s' : 'Atualização automática a cada 60 s'}</span><span>{loading ? 'Atualizando…' : updated ? `Consulta concluída ${updated} · São Paulo` : 'Aguardando primeira consulta'}</span></div>
    {error && <div className="wf-analytics-error" role="alert">Não foi possível confirmar os indicadores. <button onClick={() => void refresh()}>Tentar novamente</button></div>}
    <div className="wf-stat-strip" aria-label="Indicadores do período">{metrics.map((item) => <article key={item.title}><div><span>{item.title}</span><InfoTooltip text={item.help} label={`Definição de ${item.title}`} /></div><strong>{item.value}</strong><small>{item.note}</small></article>)}</div>
    <p className="wf-cohort-note">Carteira por data de cadastro · {analytics.range.start.split('-').reverse().join('/')} a {analytics.range.end.split('-').reverse().join('/')} · filtros de responsável, origem e etapa atuais.</p>
    <div className="wf-analytics-main">
      <article className="wf-chart-panel wf-trend-panel">
        <header><div><p className="wf-eyebrow">Evolução comercial</p><h2>{series === 'leads' ? 'Da captação à carteira' : series === 'contacts' ? 'Atividade de contato' : 'Valor em orçamentos'}</h2></div><div className="wf-segmented" aria-label="Série do gráfico">{(['leads', 'contacts', 'proposals'] as const).map((key) => <button key={key} aria-pressed={series === key} onClick={() => setSeries(key)}>{key === 'leads' ? 'Leads' : key === 'contacts' ? 'Contatos' : 'Orçamentos'}</button>)}</div></header>
        {series === 'leads' && <label className="mx-5 mb-2 flex items-center gap-2 text-xs text-foreground-600"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Comparar cadastros com a janela anterior ({analytics.previous.length})</label>}
        {ready && !graphError && hasSeries ? <div className="wf-chart-canvas" role="group" aria-label="Evolução diária; valores também disponíveis na tabela">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.days} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
            <defs><linearGradient id={`wf-fill-${mode}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#168654" stopOpacity={0.18} /><stop offset="100%" stopColor="#168654" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e9edef" strokeDasharray="3 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={35} tick={{ fill: '#66717a', fontSize: 12 }} /><YAxis allowDecimals={series === 'proposals'} tickLine={false} axisLine={false} width={48} tick={{ fill: '#66717a', fontSize: 12 }} tickFormatter={series === 'proposals' ? (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(Number(value)) : undefined} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [series === 'proposals' ? currency(Number(value)) : format(Number(value)), String(name)]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 14 }} />
            <Area type="linear" dataKey={series === 'leads' ? 'encontrados' : series === 'contacts' ? 'recebidas' : 'orcado'} name={series === 'leads' ? 'Cadastrados' : series === 'contacts' ? 'Recebidas' : 'Em aberto (líquido)'} stroke="#168654" fill={`url(#wf-fill-${mode})`} strokeWidth={2.5} isAnimationActive={false} />
            <Area type="linear" dataKey={series === 'leads' ? 'carteira' : series === 'contacts' ? 'enviadas' : 'aceito'} name={series === 'leads' ? 'Atualmente na carteira' : series === 'contacts' ? 'Aceitas para envio' : 'Aceitos (líquido)'} stroke="#20252b" strokeDasharray="5 4" fill="transparent" strokeWidth={2} isAnimationActive={false} />
            {series === 'leads' && compare && <Area type="linear" dataKey="anteriores" name="Cadastros · período anterior" stroke="#747887" strokeDasharray="2 5" fill="transparent" strokeWidth={2} isAnimationActive={false} />}
          </AreaChart></ResponsiveContainer>
        </div> : <EmptyChart error={Boolean(graphError)} title={loading && !snapshot ? 'Consultando a operação' : graphError ? 'Série indisponível' : 'Ainda não há atividade neste período'} detail={graphError ? 'Tente atualizar. Nenhum valor foi estimado para preencher o gráfico.' : 'Os gráficos aparecerão a partir dos registros reais que correspondem aos filtros.'} />}
        <p className="wf-chart-caption">{series === 'leads' ? 'Data de cadastro. “Na carteira” usa a atribuição atual, não a data da aprovação.' : series === 'contacts' ? 'Recebidas e envios aceitos pelo provedor. Filas, falhas e notas internas ficam fora. Não comprova entrega.' : 'Propostas agrupadas pela criação e situação atual. Valor aceito não equivale a receita recebida.'}</p>
        {series === 'leads' && compare && <p className="wf-chart-caption">Comparação por posição do dia na janela. Período anterior: {analytics.range.previousStart.split('-').reverse().join('/')} a {analytics.range.previousEnd.split('-').reverse().join('/')}.</p>}
        {ready && !graphError && series === 'leads' && compare && <DataTable headers={['Data atual', 'Cadastros atuais', 'Data anterior equivalente', 'Cadastros anteriores']} rows={analytics.days.map((day, index) => [day.key.split('-').reverse().join('/'), day.encontrados, shiftDay(analytics.range.previousStart, index).split('-').reverse().join('/'), day.anteriores])} />}
        {ready && !graphError && <DataTable headers={['Data', series === 'leads' ? 'Cadastrados' : series === 'contacts' ? 'Recebidas' : 'Em aberto', series === 'leads' ? 'Na carteira hoje' : series === 'contacts' ? 'Envios aceitos' : 'Aceitos']} rows={analytics.days.map((day) => [day.label, series === 'leads' ? day.encontrados : series === 'contacts' ? day.recebidas : currency(day.orcado), series === 'leads' ? day.carteira : series === 'contacts' ? day.enviadas : currency(day.aceito)])} />}
      </article>
      <aside className="wf-analytics-aside">
        {ready && analytics.reviewBacklog.length > 0 && <section className="wf-review-callout"><span className="wf-eyebrow">Próximo passo · todos os períodos</span><h2>{format(analytics.reviewBacklog.length)} {analytics.reviewBacklog.length === 1 ? 'lead para revisar' : 'leads para revisar'}</h2><p>Fila operacional completa, independente dos filtros acima. Confira os dados e encaminhe os registros à carteira.</p><Link to="/dashboard/leads" className="wf-btn-primary">Revisar leads <ArrowUpRight size={17} /></Link></section>}
        {aside ?? <section className="wf-value-summary"><TrendingUp size={22} /><p>Valor em propostas abertas</p><strong>{ready ? currency(analytics.expectedValue) : '—'}</strong><span>Potencial não ponderado · valores líquidos</span><hr /><p>Propostas aceitas desta coorte</p><b>{ready ? currency(analytics.acceptedValue) : '—'}</b><Link to="/dashboard/orcamentos">Abrir orçamentos <ArrowUpRight size={15} /></Link></section>}
      </aside>
    </div>
    <div className="wf-analytics-bottom">
      <article className="wf-chart-panel"><header><div><h2>Distribuição do pipeline</h2><p>Situação atual da carteira selecionada</p></div><Link to="/dashboard/kanban" className="wf-overview-link">Carteira completa <ArrowUpRight size={15} /></Link></header>
        {ready && analytics.pipeline.length > 0 ? <><div className="wf-chart-canvas wf-chart-canvas--pipeline"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.stages} layout="vertical" margin={{ left: 8, right: 24 }} accessibilityLayer><CartesianGrid horizontal={false} stroke="#edf0f1" /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#56616c' }} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f4f6f7' }} /><Bar dataKey="value" name="Leads" fill="#20252b" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><DataTable headers={['Etapa', 'Leads', 'Participação']} rows={analytics.stages.map((stage) => [stage.name, stage.value, rate(stage.value / analytics.pipeline.length * 100)])} /></> : <EmptyChart error={error} title={error ? 'Pipeline indisponível' : !ready ? 'Consultando o pipeline' : hasPortfolio ? 'Nenhuma oportunidade neste recorte' : 'Seu pipeline começa após a revisão'} detail={error ? 'A leitura falhou. Tente atualizar; nenhum total foi estimado.' : hasPortfolio ? 'Ajuste o período ou os filtros. O link acima abre a carteira completa, sem este recorte.' : 'Leads sem encaminhamento não entram neste gráfico. A autorização de contato é verificada separadamente.'} />}
      </article>
      <article className="wf-chart-panel"><header><div><h2>Origem e responsabilidade</h2><p>Volume captado e situação atual</p></div><div className="wf-segmented"><button aria-pressed={distribution === 'origins'} onClick={() => setDistribution('origins')}>Origem</button><button aria-pressed={distribution === 'owners'} onClick={() => setDistribution('owners')}>Equipe</button>{mode === 'reports' && <button aria-pressed={distribution === 'segments'} onClick={() => setDistribution('segments')}>Segmento</button>}</div></header>
        {ready && group.length ? <div className="wf-ranking">{group.slice(0, 6).map((row) => <div key={row.name}><div><strong>{row.name}</strong><span>{format(row.encontrados)} cadastrados · {row.carteira} na carteira</span></div><div className="wf-ranking-track"><span style={{ width: `${row.encontrados / groupMax * 100}%` }} /></div></div>)}</div> : <EmptyChart error={error} title={error ? 'Distribuição indisponível' : !ready ? 'Consultando a distribuição' : 'Nenhum registro nos filtros'} detail={error ? 'Tente atualizar para confirmar os registros.' : 'A distribuição usa os responsáveis e as origens atuais. Propostas seguem sua própria data de criação.'} />}
        {ready && <DataTable headers={[distribution === 'origins' ? 'Origem' : distribution === 'owners' ? 'Responsável' : 'Segmento', 'Cadastrados', 'Carteira', 'Ganhos', 'Propostas aceitas (líquido)']} rows={group.map((row) => [row.name, row.encontrados, row.carteira, row.ganhos, currency(row.aceito)])} />}
      </article>
    </div>
    <details className="wf-chart-panel wf-progression" open={mode === 'funnel' ? true : undefined}><summary><span><BarChart3 size={18} />Avanço entre leads com movimentação registrada</span><span>Histórico observado</span></summary><p className="wf-chart-caption">Percentuais restritos aos leads com evidência de passagem pela etapa no período. Leads parados sem eventos ficam fora desta base: esta leitura não é a conversão de toda a carteira. A taxa histórica completa requer uma fotografia da carteira no início do período.</p>
      {snapshot?.historyError || !ready ? <EmptyChart error={Boolean(snapshot?.historyError)} title="Histórico não confirmado" detail="A conversão histórica depende da leitura dos eventos auditados." /> : <div className="wf-conversion-rows">{analytics.progression.map((item) => <div key={item.name}><span>{item.name}</span><div className="wf-ranking-track"><span style={{ width: `${item.rate ?? 0}%` }} /></div><strong>{rate(item.rate)}</strong><small>{item.advanced} de {item.base} observados</small></div>)}</div>}
    </details>
    <div className="wf-analytics-definition"><button aria-expanded={showDefinitions} onClick={() => setShowDefinitions(!showDefinitions)}>Como estes indicadores são calculados?</button>{showDefinitions && <div><p><strong>Uma base, quatro leituras.</strong> Cadastros são os leads importados ou criados no CRM. Revisão identifica registros ainda sem modo/responsável. Carteira usa o mesmo critério do Kanban. Autorização de contato é independente.</p><p><strong>Períodos.</strong> A janela inclui o dia atual no fuso de São Paulo. A comparação usa a janela anterior com o mesmo número de dias. Base anterior zero resulta em comparação percentual indisponível.</p><p><strong>Valores.</strong> Somamos propostas Enviadas/Visualizadas com o desconto aplicado uma única vez. Rascunhos ficam fora. Não existe previsão ponderada nem reconhecimento contábil de receita nesta leitura.</p></div>}</div>
  </section>;
}
