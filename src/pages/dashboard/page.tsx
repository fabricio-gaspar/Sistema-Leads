import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useLeadsLoadStatus, useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasLoadStatus, usePropostasStore } from '@/hooks/usePropostasStore';
import { loadOperationalDiagnostics, type OperationalDiagnostics } from '@/lib/crm/operationalDiagnosticsRepository';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';
import { presentIntegrationStatus, type StatusTone } from '@/lib/crm/operationalStatusPresentation';
import SellerAttentionPanel from './components/SellerAttentionPanel';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';
import InfoTooltip from '@/components/feature/InfoTooltip';
import AnaAutomaticControl from './components/AnaAutomaticControl';

function PanelHeading({ title, help, link, linkLabel = 'Abrir' }: { title: string; help: string; link?: string; linkLabel?: string }) {
  return <div className="wf-overview-heading">
    <div className="flex min-w-0 items-center gap-2"><h2>{title}</h2><InfoTooltip text={help} label={`Sobre ${title}`} align="start" /></div>
    {link && <Link to={link} className="wf-overview-link">{linkLabel}<i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>}
  </div>;
}

type OperationalAlert = {
  id: string;
  title: string;
  detail: string;
  link: string;
  action: string;
  icon: string;
};

function formatOperationalDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Dashboard() {
  const [leads] = useLeadsStore();
  const leadsStatus = useLeadsLoadStatus();
  const { propostas } = usePropostasStore();
  const proposalsStatus = usePropostasLoadStatus();
  const notifications = useNotificacoesStore();
  const [operacao, setOperacao] = useState<OperationalDiagnostics | null>(null);
  const [diagnosticError, setDiagnosticError] = useState(false);

  useEffect(() => {
    let disposed = false;
    const refreshOperationalData = async () => {
      try {
        const diagnostic = await loadOperationalDiagnostics();
        if (!disposed) {
          setOperacao(diagnostic);
          setDiagnosticError(false);
        }
      } catch {
        if (!disposed) setDiagnosticError(true);
      }
    };
    void refreshOperationalData();
    const interval = window.setInterval(() => void refreshOperationalData(), 60_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  const data = useMemo(() => {
    const active = leads.filter((lead) => !['won', 'lost'].includes(stageFromLegacy(lead.etapa)));
    const handoff = leads.filter((lead) => lead.modoAtendimento === 'HUMANO' || lead.automacaoStatus === 'AGUARDANDO_HUMANO');
    const quotes = propostas.filter((proposal) => ['enviada', 'visualizada'].includes(proposal.status));
    const stages = ACTIVE_PIPELINE_STAGES.map((stage) => ({ stage, count: leads.filter((lead) => stageFromLegacy(lead.etapa) === stage).length }));
    const hot = active.filter((lead) => lead.temperatura === 'Quente');
    return { active, handoff, hot, quotes, stages };
  }, [leads, propostas]);

  const maxCount = Math.max(1, ...data.stages.map((item) => item.count));
  const integrationsByKey = new Map((diagnosticError ? [] : operacao?.status.integrations ?? []).map((item) => [item.key, item]));
  const whatsappMonitoring = diagnosticError ? undefined : operacao?.status.whatsappMonitoring;
  const scheduler = operacao?.status.checks.find((item) => item.id === 'scheduler');
  const apifyIntegration = integrationsByKey.get('apify');
  const apify = apifyIntegration ? presentIntegrationStatus(apifyIntegration) : null;
  const wonLeads = leads.filter((lead) => stageFromLegacy(lead.etapa) === 'won').length;
  const conversionRate = leads.length ? Math.round((wonLeads / leads.length) * 1000) / 10 : 0;
  const openProposalValue = data.quotes.reduce((total, proposal) => total + proposal.valor, 0);
  const attentionLoadState = leadsStatus === 'loading' || notifications.loading ? 'loading' : leadsStatus === 'error' || notifications.error ? 'error' : 'ready';
  const diagnosticTime = formatOperationalDate(operacao?.status.runtimeUpdatedAt ?? operacao?.status.updatedAt ?? null);
  const leadValue = (value: number) => leadsStatus === 'ready' ? value.toLocaleString('pt-BR') : '—';
  const diagnosticValue = (value: number | null | undefined) => diagnosticError || !operacao ? '—' : (value ?? '—').toLocaleString('pt-BR');
  const diagnosticStatus = (status: string, tone: StatusTone) => diagnosticError
    ? { status: 'Leitura indisponível', tone: 'neutral' as StatusTone }
    : !operacao
      ? { status: 'Consultando', tone: 'neutral' as StatusTone }
      : { status, tone };

  const metrics = [
    { label: 'Leads ativos', value: leadValue(data.active.length), detail: 'Leads da carteira fora dos estágios Ganho e Perdido. Não indica, por si só, autorização ou contato automático.', icon: 'ri-user-search-line', tone: 'ink' },
    { label: 'Classificados quentes', value: leadValue(data.hot.length), detail: 'Leads ativos classificados com temperatura Quente. A classificação não equivale a venda confirmada.', icon: 'ri-fire-line', tone: 'ink' },
    { label: 'Orçamentos abertos', value: proposalsStatus === 'ready' ? data.quotes.length.toLocaleString('pt-BR') : '—', detail: 'Orçamentos com situação Enviada ou Visualizada. O valor abaixo não representa receita reconhecida.', meta: proposalsStatus === 'ready' ? openProposalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—', icon: 'ri-file-list-3-line', tone: 'ink' },
    { label: 'Conversão da carteira', value: leadsStatus === 'ready' ? `${conversionRate.toLocaleString('pt-BR')}%` : '—', detail: 'Leads em Ganho divididos pelo total de leads carregados. Não é uma taxa diária ou mensal.', icon: 'ri-line-chart-line', tone: 'green' },
  ];

  const operationalAlerts: OperationalAlert[] = [];
  if (diagnosticError) {
    operationalAlerts.push({ id: 'diagnostic', title: 'Não foi possível confirmar a operação', detail: 'A leitura segura do backend falhou. Não assuma que os canais ou a Ana estão disponíveis.', link: '/dashboard/configuracoes?tab=operacao', action: 'Ver operação', icon: 'ri-error-warning-line' });
  } else if (operacao) {
    if (operacao.status.killSwitch) operationalAlerts.push({ id: 'ana-paused', title: 'Ana pausada', detail: 'A pausa global está ativa e impede saídas automatizadas.', link: '/dashboard/configuracoes?tab=ana', action: 'Ver Ana', icon: 'ri-pause-circle-line' });
    if (whatsappMonitoring && whatsappMonitoring.state !== 'stable') operationalAlerts.push({ id: 'whatsapp', title: 'WhatsApp requer atenção', detail: whatsappMonitoring.detail || 'Os contatos automáticos não podem ser considerados disponíveis até uma nova validação.', link: '/dashboard/configuracoes?tab=canais', action: 'Ver canal', icon: 'ri-whatsapp-line' });
    if (!operacao.status.killSwitch && !operacao.status.productionReady) operationalAlerts.push({ id: 'ana-preparation', title: 'Ana em preparação', detail: 'A automação permanece bloqueada até que os requisitos reais sejam comprovados.', link: '/dashboard/configuracoes?tab=ana', action: 'Ver Ana', icon: 'ri-robot-2-line' });
    if (operacao.summary.failedJobs > 0) operationalAlerts.push({ id: 'jobs', title: 'Processamento com falhas', detail: `${operacao.summary.failedJobs} falha(s) registrada(s) na fila operacional.`, link: '/dashboard/registro-sistema', action: 'Ver registros', icon: 'ri-alert-line' });
  }
  const operationalAlert = operationalAlerts[0];

  const processing = operacao?.summary.failedJobs
    ? { label: `${operacao.summary.failedJobs} falha(s)`, tone: 'critical' as StatusTone, detail: 'Existem falhas registradas na fila operacional. Consulte os registros antes de repetir qualquer ação.' }
    : scheduler?.ok
      ? { label: operacao?.summary.queuedJobs ? `${operacao.summary.queuedJobs} na fila` : 'Em dia', tone: 'positive' as StatusTone, detail: scheduler.detail || 'O agendador foi confirmado pelo backend.' }
      : { label: 'Pendente', tone: 'attention' as StatusTone, detail: scheduler?.detail || 'O estado do agendador ainda não foi confirmado pelo backend.' };

  const operationalItems = [
    { label: 'Ana', icon: 'ri-robot-2-line', ...diagnosticStatus(operacao?.status.killSwitch ? 'Pausada' : operacao?.status.productionReady ? 'Pronta' : 'Pendente', operacao?.status.productionReady && !operacao.status.killSwitch ? 'positive' : 'attention'), detail: 'Prontidão e pausa operacional da Ana. Estar pronta não é prova de envio ou entrega.', link: '/dashboard/configuracoes?tab=ana' },
    { label: 'WhatsApp', icon: 'ri-whatsapp-line', ...diagnosticStatus(whatsappMonitoring?.state === 'stable' ? 'Estável' : whatsappMonitoring?.state === 'paused' ? 'Pausado' : whatsappMonitoring?.state === 'attention' ? 'Requer atenção' : whatsappMonitoring?.state === 'unavailable' ? 'Indisponível' : 'Não configurado', whatsappMonitoring?.state === 'stable' ? 'positive' : whatsappMonitoring?.state === 'unavailable' ? 'critical' : 'attention'), detail: whatsappMonitoring?.detail ?? 'Estado do canal confirmado pelo backend.', link: '/dashboard/configuracoes?tab=canais' },
    { label: 'Busca', icon: 'ri-map-pin-search-line', ...diagnosticStatus(apify?.label ?? 'Não configurada', apify?.tone ?? 'neutral'), detail: apifyIntegration?.detail ?? 'Estado da integração de busca Apify.', link: '/dashboard/configuracoes?tab=apis' },
    { label: 'Processamento', icon: 'ri-pulse-line', ...diagnosticStatus(processing.label, processing.tone), detail: processing.detail, link: '/dashboard/configuracoes?tab=operacao' },
  ];

  return <div className="wf-page wf-overview wf-commercial-dashboard">
    <header className="wf-page-header">
      <div><p className="wf-eyebrow">Visão comercial</p><div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">WayFlex CRM</h1><InfoTooltip text="Leitura rápida da carteira: decisões comerciais, pipeline e condições reais para a operação da Ana." label="Sobre a Dashboard" align="start" /></div></div>
      {diagnosticTime && <p className="wf-dashboard-updated">Atualizado {diagnosticTime}</p>}
    </header>

    <AnaAutomaticControl />

    {operationalAlert && <section className="wf-decision-alert" aria-label="Alerta operacional">
      <span className="wf-decision-alert__icon" aria-hidden="true"><i className={operationalAlert.icon} /></span>
      <div className="min-w-0 flex-1"><strong>{operationalAlert.title}</strong><p>{operationalAlert.detail}</p></div>
      <Link to={operationalAlert.link} className="wf-decision-alert__action">{operationalAlert.action}<i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </section>}

    <section className="wf-command-kpis wf-command-kpis--compact" aria-label="Indicadores da carteira">
      {metrics.map((item) => <article key={item.label} className={`wf-overview-metric wf-overview-metric--${item.tone}`}>
        <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-1.5"><p className="break-words text-sm font-semibold leading-5 text-foreground-700">{item.label}</p><InfoTooltip text={item.detail} label={`Como calculamos ${item.label}`} /></div><span className="wf-metric-icon"><i className={`${item.icon} text-lg`} aria-hidden="true" /></span></div>
        <p className="wf-metric-value">{item.value}</p>
        {item.meta && <p className="wf-metric-meta">{item.meta}</p>}
      </article>)}
    </section>

    <section className="wf-dashboard-primary">
      <SellerAttentionPanel notifications={notifications.notificacoes} leads={leads} loadState={attentionLoadState} />
      <article className="wf-surface wf-pipeline-card wf-pipeline-card--compact p-5">
        <PanelHeading title="Pipeline comercial" help="Quantidade de leads em cada etapa do pipeline canônico da WayFlex. As barras usam apenas a carteira carregada." link="/dashboard/kanban" linkLabel="Ver Kanban" />
        <div className="mt-5 space-y-3" role="img" aria-label={leadsStatus === 'ready' ? data.stages.map(({ stage, count }) => `${PIPELINE_STAGE_LABEL[stage]}: ${count}`).join('; ') : 'Pipeline aguardando consulta'}>
          {data.stages.map(({ stage, count }) => <div key={stage} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_2rem]">
            <span className="truncate text-sm font-medium text-foreground-600">{PIPELINE_STAGE_LABEL[stage]}</span>
            <div className="h-2 overflow-hidden rounded-full bg-background-100"><div className={`h-full rounded-full transition-[width] duration-500 ${stage === 'lost' ? 'bg-[#9ca3ad]' : stage === 'won' ? 'bg-[#169b62]' : 'bg-[#20252b]'}`} style={{ width: `${leadsStatus === 'ready' ? count / maxCount * 100 : 0}%` }} /></div>
            <span className="text-right text-sm font-semibold tabular-nums text-foreground-900">{leadValue(count)}</span>
          </div>)}
        </div>
        {leadsStatus === 'ready' && leads.length === 0 && <p className="mt-5 text-sm text-foreground-500">Nenhum lead disponível na carteira.</p>}
        {leadsStatus === 'error' && <p className="mt-5 text-sm text-amber-800">Não foi possível confirmar os dados do pipeline.</p>}
      </article>
    </section>

    <section className="wf-dashboard-operations" aria-label="Atividade e saúde operacional">
      <article className="wf-surface wf-contact-activity">
        <div className="border-b border-background-200 px-5 py-4"><PanelHeading title="Atividade de contato" help="Contagens operacionais das últimas 24 horas. Envios aceitos não significam entrega ou leitura." link="/dashboard/configuracoes?tab=canais" linkLabel="Ver canal" /></div>
        <dl className="wf-contact-activity__grid">
          {[
            { label: 'Envios aceitos · 24h', value: diagnosticValue(whatsappMonitoring?.sentLast24Hours) },
            { label: 'Entradas · 24h', value: diagnosticValue(whatsappMonitoring?.inboundLast24Hours) },
            { label: 'Entregas · 24h', value: diagnosticValue(whatsappMonitoring?.deliveredLast24Hours) },
            { label: 'Em atendimento humano', value: leadValue(data.handoff.length) },
          ].map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        </dl>
      </article>

      <article className="wf-surface wf-health-panel wf-health-panel--compact" aria-label="Saúde operacional">
        <div className="wf-health-heading"><PanelHeading title="Saúde da operação" help="Resumo factual do diagnóstico. Os detalhes completos permanecem em Configurações; nenhum selo positivo é preservado se a leitura falhar." link="/dashboard/configuracoes?tab=operacao" linkLabel="Detalhes" /><span className="wf-health-time">{diagnosticError ? 'Leitura indisponível' : diagnosticTime ? `Atualizado ${diagnosticTime}` : 'Consultando diagnóstico'}</span></div>
        <div className="wf-health-grid wf-health-grid--compact">{operationalItems.map((item) => <div key={item.label} className="wf-health-item">
          <div className="wf-health-item-top"><i className={item.icon} aria-hidden="true" /><span className={`wf-health-dot wf-health-dot--${item.tone}`} /></div>
          <div className="flex min-w-0 items-start gap-1"><Link to={item.link} className="wf-health-link"><h3>{item.label}</h3><p className={`wf-health-value wf-health-value--${item.tone}`}>{item.status}</p></Link><InfoTooltip text={item.detail} label={`Detalhes de ${item.label}`} /></div>
        </div>)}</div>
      </article>
    </section>
  </div>;
}
