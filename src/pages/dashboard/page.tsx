import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { refreshConversasStore, useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { loadOperationalDiagnostics, type OperationalDiagnostics } from '@/lib/crm/operationalDiagnosticsRepository';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { supabase } from '@/lib/supabase';
import {
  DASHBOARD_API_KEYS,
  DASHBOARD_CHANNEL_KEYS,
  DASHBOARD_SOURCE_KEYS,
  operationalIcon,
  operationalIconTone,
  presentIntegrationStatus,
  presentSourceStatus,
  type StatusTone,
} from '@/lib/crm/operationalStatusPresentation';
import ConversationActivityChart from './components/ConversationActivityChart';
import type { ConversationRealtimeState } from './components/conversationActivity';
import SellerAttentionPanel from './components/SellerAttentionPanel';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';
import InfoTooltip from '@/components/feature/InfoTooltip';

function Status({ good, label, neutral = false }: { good: boolean; label: string; neutral?: boolean }) {
  return <span className={`wf-overview-status wf-overview-status--${neutral ? 'neutral' : good ? 'good' : 'warning'}`}>{label}</span>;
}

function PanelHeading({ title, help, link, linkLabel = 'Abrir' }: { title: string; help: string; link?: string; linkLabel?: string }) {
  return <div className="wf-overview-heading">
    <div className="flex min-w-0 items-center gap-2"><h2>{title}</h2><InfoTooltip text={help} label={`Sobre ${title}`} align="start" /></div>
    {link && <Link to={link} className="wf-overview-link">{linkLabel}<i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>}
  </div>;
}

type ConnectionOverviewItem = {
  id: string;
  label: string;
  icon: string;
  iconTone: string;
  status: string;
  tone: StatusTone;
  detail: string | null;
  creditsRemaining?: number | null;
  expiresAt?: string | null;
};

const statusClass: Record<StatusTone, string> = {
  positive: 'bg-[#34C759]/10 text-[#237A3B]',
  attention: 'bg-[#FF9500]/10 text-[#8A5200]',
  critical: 'bg-[#FF3B30]/10 text-[#D92D27]',
  neutral: 'bg-background-100 text-foreground-600',
};

function formatOperationalDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function providerTelemetry(item: ConnectionOverviewItem): string | null {
  if (typeof item.creditsRemaining === 'number') return `Créditos informados: ${item.creditsRemaining.toLocaleString('pt-BR')}`;
  if (item.expiresAt) {
    const expiresAt = new Date(item.expiresAt);
    if (Number.isFinite(expiresAt.getTime())) return `Sessão até ${expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
  }
  return null;
}

function ConnectionOverview({ title, link, items, empty, help }: { title: string; link: string; items: ConnectionOverviewItem[]; empty: string; help: string }) {
  return <article className="wf-surface wf-connection-card overflow-hidden">
    <div className="border-b border-background-200/80 px-4 py-3"><PanelHeading title={title} help={help} link={link} linkLabel="Gerenciar" /></div>
    <div className="divide-y divide-background-100">
      {items.map((item) => {
        const telemetry = providerTelemetry(item);
        return <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-background-50">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${item.iconTone}`} aria-hidden="true"><i className={`${item.icon} text-base`} /></span>
          <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-semibold text-foreground-800">{item.label}</p><InfoTooltip text={item.detail || telemetry || 'Sem detalhes operacionais adicionais.'} label={`Detalhes de ${item.label}`} /></div></div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[item.tone]}`}>{item.status}</span>
        </div>;
      })}
      {!items.length && <p className="px-4 py-5 text-sm text-foreground-500">{empty}</p>}
    </div>
  </article>;
}

export default function Dashboard() {
  const [leads] = useLeadsStore();
  const { conversas } = useConversasStore();
  const { propostas } = usePropostasStore();
  const notifications = useNotificacoesStore();
  const [operacao, setOperacao] = useState<OperationalDiagnostics | null>(null);
  const [diagnosticError, setDiagnosticError] = useState(false);
  const [conversationRealtime, setConversationRealtime] = useState<ConversationRealtimeState>('connecting');
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
  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void resolveOrganizationSession()
      .then(({ organizationId }) => {
        if (disposed) return;
        channel = supabase.channel(`dashboard-conversations:${organizationId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_messages', filter: `organization_id=eq.${organizationId}` }, () => {
            void refreshConversasStore();
          })
          .subscribe((status) => {
            if (disposed) return;
            setConversationRealtime(status === 'SUBSCRIBED' ? 'live' : ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) ? 'unavailable' : 'connecting');
          });
      })
      .catch(() => {
        if (!disposed) setConversationRealtime('unavailable');
      });
    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const data = useMemo(() => {
    const active = leads.filter((lead) => !['won', 'lost'].includes(stageFromLegacy(lead.etapa)));
    const handoff = leads.filter((lead) => lead.modoAtendimento === 'HUMANO' || lead.automacaoStatus === 'AGUARDANDO_HUMANO');
    const quotes = propostas.filter((proposal) => ['enviada', 'visualizada'].includes(proposal.status));
    const stages = ACTIVE_PIPELINE_STAGES.map((stage) => ({ stage, count: leads.filter((lead) => stageFromLegacy(lead.etapa) === stage).length }));
    const temperatures = [
      { label: 'Quente', color: '#c56b36' },
      { label: 'Morno', color: '#c49a42' },
      { label: 'Frio', color: '#748a9b' },
    ].map((item) => ({ ...item, count: active.filter((lead) => lead.temperatura === item.label).length }));
    return { active, handoff, quotes, stages, temperatures };
  }, [leads, propostas]);

  const maxCount = Math.max(1, ...data.stages.map((item) => item.count));
  const integrationsByKey = new Map((operacao?.status.integrations ?? []).map((item) => [item.key, item]));
  const sourcesByKey = new Map((operacao?.status.sources ?? []).map((item) => [item.key, item]));
  const webhookDetail = operacao?.status.webhookDiagnostic.detail ?? null;
  const channels = DASHBOARD_CHANNEL_KEYS.flatMap((key) => {
    const item = integrationsByKey.get(key);
    if (!item) return [];
    const presentation = presentIntegrationStatus(item);
    const lastValidation = formatOperationalDate(item.lastTestedAt);
    const detail = presentation.status === 'pending'
      ? webhookDetail || item.detail
      : presentation.status === 'validation_due'
        ? lastValidation ? `Última validação: ${lastValidation}.` : 'Teste de conexão necessário.'
        : presentation.status === 'error'
          ? item.detail || item.lastError
          : item.detail;
    return [{
      id: item.key,
      label: item.key === 'whatsapp_zapi' ? 'Z-API' : 'Meta WhatsApp',
      icon: operationalIcon(item.key),
      iconTone: operationalIconTone(item.key),
      status: presentation.label,
      tone: presentation.tone,
      detail,
      creditsRemaining: item.telemetry.creditsRemaining,
      expiresAt: item.telemetry.expiresAt,
    }];
  });
  const apis = DASHBOARD_API_KEYS.flatMap((key) => {
    const item = integrationsByKey.get(key);
    if (!item) return [];
    const presentation = presentIntegrationStatus(item);
    const lastValidation = formatOperationalDate(item.lastTestedAt);
    const detail = presentation.status === 'validation_due'
      ? lastValidation ? `Última validação: ${lastValidation}.` : 'Teste de conexão necessário.'
      : presentation.status === 'error'
        ? item.detail || item.lastError
        : item.detail;
    return [{
      id: item.key,
      label: item.key === 'ai' ? 'IA da Ana' : item.label,
      icon: operationalIcon(item.key),
      iconTone: operationalIconTone(item.key),
      status: presentation.label,
      tone: presentation.tone,
      detail,
      creditsRemaining: item.telemetry.creditsRemaining,
      expiresAt: item.telemetry.expiresAt,
    }];
  });
  const sources = DASHBOARD_SOURCE_KEYS.flatMap((key) => {
    const source = sourcesByKey.get(key);
    if (!source) return [];
    const presentation = presentSourceStatus(source);
    const lastSuccess = formatOperationalDate(source.lastSuccessAt);
    const detail = presentation.status === 'error'
      ? source.lastError
      : lastSuccess ? `Última atividade: ${lastSuccess}.` : source.mode ? `Modo: ${source.mode}.` : null;
    return [{
      id: source.key,
      label: source.label,
      icon: operationalIcon(source.key),
      iconTone: operationalIconTone(source.key),
      status: presentation.label,
      tone: presentation.tone,
      detail,
    }];
  });
  const whatsappMonitoring = operacao?.status.whatsappMonitoring;
  const scheduler = operacao?.status.checks.find((item) => item.id === 'scheduler');
  const wonLeads = leads.filter((lead) => stageFromLegacy(lead.etapa) === 'won').length;
  const conversionRate = leads.length ? Math.round((wonLeads / leads.length) * 1000) / 10 : 0;
  const openProposalValue = data.quotes.reduce((total, proposal) => total + proposal.valor, 0);
  const urgentAttention = notifications.naoLidas + data.handoff.length;
  const hottestLead = [...data.active].sort((a, b) => b.score - a.score)[0] ?? null;
  const metrics = [
    { label: 'Leads ativos', value: data.active.length.toLocaleString('pt-BR'), detail: `${leads.length} cadastros na carteira; estados Ganho e Perdido não entram neste total.`, icon: 'ri-user-search-line', tone: 'green' },
    { label: 'Oportunidades quentes', value: data.temperatures[0].count.toLocaleString('pt-BR'), detail: 'Leads abertos classificados como quentes na carteira operacional.', icon: 'ri-fire-line', tone: 'coral' },
    { label: 'Conversão comercial', value: `${conversionRate.toLocaleString('pt-BR')}%`, detail: 'Proporção de leads em Ganho sobre todos os leads carregados.', icon: 'ri-line-chart-line', tone: 'ink' },
  ];
  const services = [
    { label: 'Ambiente', ok: operacao?.status.mode === 'real', detail: operacao?.status.modeLabel, icon: 'ri-shield-check-line' },
    { label: 'Ana automática', ok: operacao?.status.productionReady, detail: operacao?.status.productionReady ? 'Pré-requisitos confirmados' : 'Requer atenção', icon: 'ri-robot-2-line' },
    { label: 'Processamento', ok: scheduler?.ok, detail: scheduler?.ok ? 'Agendador confirmado' : 'Verificar agendador', icon: 'ri-pulse-line' },
  ];

  return <div className="wf-page wf-overview">
    <header className="wf-page-header">
      <div><p className="wf-eyebrow">Visão geral</p><div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">WayFlex CRM</h1><InfoTooltip text="Carteira, atendimento, pipeline e serviços operacionais em uma única leitura." label="Sobre o Dashboard" align="start" /></div></div>
      <div className="wf-live-caption"><span className={conversationRealtime === 'live' ? 'is-live' : ''} /><span>{conversationRealtime === 'live' ? 'Atualização ao vivo' : conversationRealtime === 'connecting' ? 'Conectando ao tempo real' : 'Tempo real indisponível'}</span></div>
    </header>

    <section className="wf-command-kpis" aria-label="Indicadores da carteira">
      {metrics.map((item) => <article key={item.label} className={`wf-overview-metric wf-overview-metric--${item.tone}`}>
        <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-semibold text-foreground-700">{item.label}</p><InfoTooltip text={item.detail} label={`Como calculamos ${item.label}`} /></div><span className="wf-metric-icon"><i className={`${item.icon} text-lg`} aria-hidden="true" /></span></div>
        <p className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-.05em] text-foreground-950 tabular-nums">{item.value}</p>
      </article>)}
      <article className={`wf-action-spotlight ${urgentAttention === 0 ? 'is-calm' : ''}`}>
        <div className="min-w-0"><p className="text-sm font-medium text-white/80">{urgentAttention > 0 ? 'Um bom momento para avançar' : 'Operação comercial organizada'}</p><h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-.035em] text-white">{urgentAttention > 0 ? `${urgentAttention} ${urgentAttention === 1 ? 'ação aguarda' : 'ações aguardam'} retorno` : 'Nenhuma ação urgente agora'}</h2><Link to="/dashboard/atendimento" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-foreground-950 shadow-sm">Revisar agora<i className="ri-arrow-right-up-line" aria-hidden="true" /></Link></div>
        <div className="wf-spotlight-signal" aria-hidden="true">{data.stages.map(({ stage, count }, index) => <span key={stage} style={{ height: `${Math.max(18, (count / maxCount) * 88)}%`, opacity: .42 + index * .08 }} />)}</div>
      </article>
    </section>

    <SellerAttentionPanel notifications={notifications.notificacoes} leads={leads} />

    <section className="wf-dashboard-core">
      <article className="wf-surface wf-value-card p-5">
        <PanelHeading title="Orçamentos abertos" help="Soma dos orçamentos enviados ou visualizados. Não representa receita reconhecida nem pedido." link="/dashboard/orcamentos" linkLabel="Ver todos" />
        <p className="mt-6 text-[2.2rem] font-semibold leading-none tracking-[-.05em] text-foreground-950 tabular-nums">{openProposalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="wf-inset-stat"><span>Em aberto</span><strong>{data.quotes.length}</strong></div>
          <div className="wf-inset-stat"><span>Ganhas</span><strong>{wonLeads}</strong></div>
        </div>
        <div className="mt-6 space-y-3">
          {data.temperatures.map(({ label, count, color }) => <div key={label}>
            <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-foreground-500">{label}</span><span className="font-semibold tabular-nums text-foreground-800">{count}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-background-100"><div className="h-full rounded-full" style={{ width: `${data.active.length ? count / data.active.length * 100 : 0}%`, background: color }} /></div>
          </div>)}
        </div>
      </article>

      <article className="wf-surface wf-pipeline-card p-5">
        <PanelHeading title="Pipeline comercial" help="Quantidade de leads em cada etapa do pipeline canônico da WayFlex." link="/dashboard/kanban" linkLabel="Ver Kanban" />
        <div className="mt-6 space-y-4" role="img" aria-label={data.stages.map(({ stage, count }) => `${PIPELINE_STAGE_LABEL[stage]}: ${count}`).join('; ')}>
          {data.stages.map(({ stage, count }) => <div key={stage} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_2rem]">
            <span className="truncate text-sm font-medium text-foreground-600">{PIPELINE_STAGE_LABEL[stage]}</span>
            <div className="h-3 overflow-hidden rounded-full bg-background-100"><div className={`h-full rounded-full transition-[width] duration-500 ${stage === 'lost' ? 'bg-[#ff5f57]' : stage === 'won' ? 'bg-[#169b62]' : 'bg-[#111318]'}`} style={{ width: `${count / maxCount * 100}%` }} /></div>
            <span className="text-right text-sm font-semibold tabular-nums text-foreground-900">{count}</span>
          </div>)}
        </div>
        {leads.length === 0 && <p className="mt-5 text-sm text-foreground-500">Nenhum lead disponível na carteira carregada.</p>}
      </article>

      <aside className="wf-online-grid" aria-label="Resumo online">
        <article className="wf-online-card"><div className="flex items-center justify-between"><span>Ambiente</span><i className="ri-shield-check-line" /></div><strong>{operacao?.status.mode === 'real' ? 'Real' : operacao ? 'Preparação' : '—'}</strong><Status neutral={!operacao} good={operacao?.status.mode === 'real'} label={!operacao ? diagnosticError ? 'Indisponível' : 'Consultando' : operacao.status.mode === 'real' ? 'Ativo' : 'Pendente'} /></article>
        <article className="wf-online-card"><div className="flex items-center justify-between"><span>Processamento</span><i className="ri-pulse-line" /></div><strong>{scheduler?.ok ? 'Online' : operacao ? 'Atenção' : '—'}</strong><Status neutral={!operacao} good={Boolean(scheduler?.ok)} label={!operacao ? 'Consultando' : scheduler?.ok ? 'Ativo' : 'Pendente'} /></article>
        <article className="wf-online-card"><div className="flex items-center justify-between"><span>Próxima prioridade</span><i className="ri-focus-3-line" /></div><strong className="truncate">{hottestLead?.empresa || hottestLead?.nome || 'Sem lead'}</strong><span className="text-xs text-foreground-500">{hottestLead ? `Score ${hottestLead.score}` : 'Carteira vazia'}</span></article>
        <article className="wf-online-card is-dark"><div className="flex items-center justify-between"><span>Ana automática</span><i className="ri-robot-2-line" /></div><strong>{operacao?.status.productionReady ? 'Pronta' : 'Bloqueada'}</strong><span className="text-xs text-white/60">{operacao?.status.productionReady ? 'Pré-requisitos confirmados' : 'Proteções operacionais ativas'}</span></article>
      </aside>
    </section>

    <ConversationActivityChart conversas={conversas} realtimeState={conversationRealtime} />

    <section className="wf-surface wf-monitor-card overflow-hidden" aria-label="Monitoramento do WhatsApp">
      <div className="border-b border-background-200 p-4 md:px-5"><PanelHeading title="Monitoramento do WhatsApp" help="Leitura segura do backend, atualizada a cada minuto enquanto este painel permanece aberto." link="/dashboard/configuracoes?tab=canais" linkLabel="Ver canal" /></div>
      <div className="grid divide-y divide-background-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {[
          { label: 'Envios aceitos · 1h', value: whatsappMonitoring?.sentLastHour },
          { label: 'Envios aceitos · 24h', value: whatsappMonitoring?.sentLast24Hours },
          { label: 'Entradas registradas · 24h', value: whatsappMonitoring?.inboundLast24Hours },
          { label: 'Entregas confirmadas · 24h', value: whatsappMonitoring?.deliveredLast24Hours },
          { label: 'Falhas de envio · 24h', value: whatsappMonitoring?.failedLast24Hours },
        ].map((item) => <div key={item.label} className="px-4 py-4"><p className="text-xs font-medium text-foreground-500">{item.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground-900">{item.value ?? '—'}</p></div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-background-200 px-4 py-3 text-sm md:px-5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${whatsappMonitoring?.state === 'stable' ? 'bg-emerald-50 text-emerald-800' : whatsappMonitoring?.state === 'paused' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{whatsappMonitoring?.state === 'stable' ? 'Sem risco aberto' : whatsappMonitoring?.state === 'paused' ? 'Envio pausado' : whatsappMonitoring?.state === 'attention' ? 'Requer atenção' : whatsappMonitoring ? 'Canal indisponível' : diagnosticError ? 'Leitura indisponível' : 'Consultando'}</span><InfoTooltip text={whatsappMonitoring?.detail ?? 'Os indicadores só são exibidos após a consulta segura ao backend.'} label="Detalhes do monitoramento do WhatsApp" align="start" />{typeof whatsappMonitoring?.openRiskEvents === 'number' && <span className="ml-auto text-xs text-foreground-500">{whatsappMonitoring.openRiskEvents} risco(s) aberto(s)</span>}</div>
    </section>

    <section className="wf-surface overflow-hidden" aria-label="Saúde operacional">
      <div className="border-b border-background-200 px-4 py-3 md:px-5"><PanelHeading title="Saúde operacional" help="Estado confirmado do ambiente, da Ana e do agendador. Um item pendente não é tratado como online." /></div>
      <div className="grid divide-y divide-background-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {services.map((service) => <div key={service.label} className="flex items-start gap-3 p-4">
          <i className={`${service.icon} mt-0.5 text-xl text-primary-600`} aria-hidden="true" />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5"><h2 className="text-sm font-semibold text-foreground-900">{service.label}</h2><InfoTooltip text={operacao ? service.detail || 'Sem detalhe adicional.' : 'Estado ainda não confirmado.'} label={`Detalhes de ${service.label}`} /></div><Status neutral={!operacao} good={Boolean(service.ok)} label={!operacao ? diagnosticError ? 'Indisponível' : 'Consultando' : service.ok ? 'Ativo' : 'Pendente'} /></div></div>
        </div>)}
      </div>
    </section>

    <section className="grid items-start gap-4 lg:grid-cols-3">
      <ConnectionOverview title="Canais" help="Canais de comunicação disponíveis para saída e entrada de mensagens." link="/dashboard/configuracoes?tab=canais" items={channels} empty={diagnosticError ? 'Não foi possível consultar os canais.' : operacao ? 'Nenhum canal operacional cadastrado.' : 'Consultando canais…'} />
      <ConnectionOverview title="APIs" help="Serviços externos usados pela inteligência, busca e operação da Ana." link="/dashboard/configuracoes?tab=apis" items={apis} empty={diagnosticError ? 'Não foi possível consultar as APIs.' : operacao ? 'Nenhuma API operacional cadastrada.' : 'Consultando APIs…'} />
      <ConnectionOverview title="Fontes de busca" help="Fontes autorizadas para localizar novos leads. O estado vem do backend." link="/dashboard/configuracoes?tab=apis" items={sources} empty={diagnosticError ? 'Não foi possível consultar as fontes.' : operacao ? 'Nenhuma fonte disponível na Busca de Leads.' : 'Consultando fontes…'} />
    </section>

    <section className="grid items-start gap-4 lg:grid-cols-2">
        <article className="wf-surface overflow-hidden">
          <div className="border-b border-background-200 p-4"><PanelHeading title="Acompanhamento humano" help="Conversas transferidas para uma pessoa ou aguardando atendimento da equipe." link="/dashboard/atendimento" linkLabel="Ver Central" /></div>
          <div className="divide-y divide-background-100">{data.handoff.slice(0, 4).map((lead) => <Link key={lead.id} to={`/dashboard/atendimento?leadId=${lead.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background-100">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 font-semibold text-primary-700">{(lead.nome || lead.empresa || 'L').charAt(0)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground-800">{lead.nome || lead.empresa}</p><p className="mt-1 text-sm text-foreground-500">{lead.motivoTransferencia || 'Atendimento humano'}</p></div><i className="ri-arrow-right-s-line text-foreground-400" aria-hidden="true" />
          </Link>)}</div>
          {data.handoff.length === 0 && <p className="px-4 py-6 text-sm text-foreground-500">Nenhum atendimento humano na carteira carregada.</p>}
        </article>
        <article className="wf-surface p-4">
          <PanelHeading title="Fila e registros" help={`${conversas.length} conversas na Central. Os números abaixo vêm do diagnóstico operacional.`} link="/dashboard/configuracoes?tab=registro" linkLabel="Ver registros" />
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-background-200 pt-4">
            {[{ label: 'Na fila', value: operacao?.summary.queuedJobs }, { label: 'Falhas de envio', value: operacao?.summary.failedJobs }, { label: 'Riscos abertos', value: operacao?.summary.openRiskEvents }].map((item) => <div key={item.label}><dt className="text-sm text-foreground-500">{item.label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground-900">{item.value ?? '—'}</dd></div>)}
          </dl>
        </article>
    </section>
  </div>;
}
