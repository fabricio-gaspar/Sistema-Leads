import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { refreshConversasStore, useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { loadOperationalDiagnostics, type OperationalDiagnostics } from '@/lib/crm/operationalDiagnosticsRepository';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { supabase } from '@/lib/supabase';
import ConversationActivityChart from './components/ConversationActivityChart';
import type { ConversationRealtimeState } from './components/conversationActivity';
import SellerAttentionPanel from './components/SellerAttentionPanel';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';

function Status({ good, label, neutral = false }: { good: boolean; label: string; neutral?: boolean }) {
  return <span className={`wf-overview-status wf-overview-status--${neutral ? 'neutral' : good ? 'good' : 'warning'}`}>{label}</span>;
}

type ConnectionOverviewItem = {
  id: string;
  label: string;
  connected: boolean;
  creditsRemaining?: number | null;
  expiresAt?: string | null;
};

function providerTelemetry(item: ConnectionOverviewItem): string | null {
  if (typeof item.creditsRemaining === 'number') return `Créditos informados: ${item.creditsRemaining.toLocaleString('pt-BR')}`;
  if (item.expiresAt) {
    const expiresAt = new Date(item.expiresAt);
    if (Number.isFinite(expiresAt.getTime())) return `Sessão até ${expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
  }
  return null;
}

function ConnectionOverview({ title, link, items, empty }: { title: string; link: string; items: ConnectionOverviewItem[]; empty: string }) {
  return <article className="wf-surface overflow-hidden">
    <div className="wf-overview-heading border-b border-background-200 px-4 py-3"><h2>{title}</h2><Link to={link} className="wf-overview-link">Configurar ↗</Link></div>
    <div className="divide-y divide-background-100">
      {items.map((item) => {
        const telemetry = providerTelemetry(item);
        return <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground-800">{item.label}</p>{telemetry && <p className="mt-0.5 truncate text-xs text-foreground-500">{telemetry}</p>}</div>
          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${item.connected ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{item.connected ? 'Conectado' : 'Desconectado'}</span>
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
  const integrations = operacao?.status.integrations ?? [];
  const channels = integrations.filter((item) => item.category === 'communication').map((item) => ({
    id: item.key,
    label: item.label,
    connected: item.health === 'online',
    creditsRemaining: item.telemetry.creditsRemaining,
    expiresAt: item.telemetry.expiresAt,
  }));
  const apis = integrations.filter((item) => item.category === 'intelligence').map((item) => ({
    id: item.key,
    label: item.label,
    connected: item.health === 'online',
    creditsRemaining: item.telemetry.creditsRemaining,
    expiresAt: item.telemetry.expiresAt,
  }));
  const sources = (operacao?.status.sources ?? []).map((source) => ({
    id: source.key,
    label: source.label,
    connected: source.connectionStatus === 'connected' && !source.lastError,
  }));
  const whatsappMonitoring = operacao?.status.whatsappMonitoring;
  const scheduler = operacao?.status.checks.find((item) => item.id === 'scheduler');
  const metrics = [
    { label: 'Leads abertos', value: data.active.length, detail: `${leads.length} cadastros na carteira`, icon: 'ri-user-search-line' },
    { label: 'Leads quentes', value: data.temperatures[0].count, detail: 'Prioridade entre as oportunidades abertas', icon: 'ri-fire-line' },
    { label: 'Atendimento humano', value: data.handoff.length, detail: 'Com humano ou aguardando transferência', icon: 'ri-user-received-line' },
    { label: 'Orçamentos em aberto', value: data.quotes.length, detail: 'Enviados ou visualizados', icon: 'ri-file-list-3-line' },
  ];
  const services = [
    { label: 'Ambiente', ok: operacao?.status.mode === 'real', detail: operacao?.status.modeLabel, icon: 'ri-shield-check-line' },
    { label: 'Ana automática', ok: operacao?.status.productionReady, detail: operacao?.status.productionReady ? 'Pré-requisitos confirmados' : 'Requer atenção', icon: 'ri-robot-2-line' },
    { label: 'Processamento', ok: scheduler?.ok, detail: scheduler?.ok ? 'Agendador confirmado' : 'Verificar agendador', icon: 'ri-pulse-line' },
  ];

  return <div className="wf-page wf-overview">
    <header className="wf-page-header">
      <div><p className="wf-eyebrow">Visão geral</p><h1 className="wf-page-title mt-1">Dashboard</h1><p className="wf-page-description">Sua carteira, os atendimentos e a saúde da operação.</p></div>
      <span className="text-sm text-foreground-500">Posição atual da carteira</span>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores da carteira">
      {metrics.map((item) => <article key={item.label} className="wf-overview-metric">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-foreground-600">{item.label}</p><i className={`${item.icon} text-lg text-primary-600`} aria-hidden="true" /></div>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground-950 tabular-nums">{item.value.toLocaleString('pt-BR')}</p>
        <p className="mt-1 text-sm text-foreground-500">{item.detail}</p>
      </article>)}
    </section>

    <SellerAttentionPanel notifications={notifications.notificacoes} leads={leads} />

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <article className="wf-surface p-4 md:p-5">
        <div className="wf-overview-heading"><div><h2>Distribuição no Kanban</h2><p>Quantidade de leads em cada etapa</p></div><Link to="/dashboard/kanban" className="wf-overview-link">Ver Kanban ↗</Link></div>
        <div className="mt-4 space-y-3" role="img" aria-label={data.stages.map(({ stage, count }) => `${PIPELINE_STAGE_LABEL[stage]}: ${count}`).join('; ')}>
          {data.stages.map(({ stage, count }) => <div key={stage} className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_2rem]">
            <span className="text-sm text-foreground-600">{PIPELINE_STAGE_LABEL[stage]}</span>
            <div className="h-2.5 overflow-hidden rounded bg-background-100"><div className={`h-full rounded ${stage === 'lost' ? 'bg-rose-400' : stage === 'won' ? 'bg-emerald-600' : 'bg-primary-500'}`} style={{ width: `${count / maxCount * 100}%` }} /></div>
            <span className="text-right text-sm font-semibold tabular-nums text-foreground-800">{count}</span>
          </div>)}
        </div>
        {leads.length === 0 && <p className="mt-4 text-sm text-foreground-500">Nenhum lead disponível na carteira carregada.</p>}
      </article>
      <article className="wf-surface p-4 md:p-5">
        <div className="wf-overview-heading"><div><h2>Temperatura dos leads</h2><p>Classificação das oportunidades abertas</p></div></div>
        <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground-950 tabular-nums">{data.active.length}<span className="ml-2 text-sm font-normal tracking-normal text-foreground-500">em aberto</span></p>
        <div className="mt-4 space-y-4">
          {data.temperatures.map(({ label, count, color }) => <div key={label}>
            <div className="mb-2 flex justify-between text-sm"><span className="text-foreground-600">{label}</span><span className="font-semibold tabular-nums text-foreground-800">{count} <span className="ml-2 font-normal text-foreground-500">{data.active.length ? Math.round(count / data.active.length * 100) : 0}%</span></span></div>
            <div className="h-2 overflow-hidden rounded-full bg-background-100"><div className="h-full rounded-full" style={{ width: `${data.active.length ? count / data.active.length * 100 : 0}%`, background: color }} /></div>
          </div>)}
        </div>
        <p className="mt-4 border-t border-background-200 pt-3 text-sm leading-6 text-foreground-500">A temperatura ajuda a priorizar a carteira; não representa uma previsão de fechamento.</p>
      </article>
    </section>

    <ConversationActivityChart conversas={conversas} realtimeState={conversationRealtime} />

    <section className="wf-surface overflow-hidden" aria-label="Monitoramento do WhatsApp">
      <div className="wf-overview-heading border-b border-background-200 p-4"><div><h2>Monitoramento do WhatsApp</h2><p>Leitura operacional atualizada a cada minuto enquanto este painel permanece aberto.</p></div><Link to="/dashboard/configuracoes?tab=canais" className="wf-overview-link">Ver canal ↗</Link></div>
      <div className="grid divide-y divide-background-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {[
          { label: 'Envios aceitos · 1h', value: whatsappMonitoring?.sentLastHour },
          { label: 'Envios aceitos · 24h', value: whatsappMonitoring?.sentLast24Hours },
          { label: 'Entradas registradas · 24h', value: whatsappMonitoring?.inboundLast24Hours },
          { label: 'Entregas confirmadas · 24h', value: whatsappMonitoring?.deliveredLast24Hours },
          { label: 'Falhas de envio · 24h', value: whatsappMonitoring?.failedLast24Hours },
        ].map((item) => <div key={item.label} className="px-4 py-3"><p className="text-xs font-medium text-foreground-500">{item.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground-900">{item.value ?? '—'}</p></div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-background-200 px-4 py-3 text-sm"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${whatsappMonitoring?.state === 'stable' ? 'bg-emerald-50 text-emerald-800' : whatsappMonitoring?.state === 'paused' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{whatsappMonitoring?.state === 'stable' ? 'Sem risco aberto' : whatsappMonitoring?.state === 'paused' ? 'Envio pausado' : whatsappMonitoring?.state === 'attention' ? 'Requer atenção' : whatsappMonitoring ? 'Canal indisponível' : diagnosticError ? 'Leitura indisponível' : 'Consultando'}</span><p className="min-w-0 flex-1 text-foreground-500">{whatsappMonitoring?.detail ?? 'Os indicadores só são exibidos após a consulta segura ao backend.'}</p>{typeof whatsappMonitoring?.openRiskEvents === 'number' && <span className="text-xs text-foreground-500">{whatsappMonitoring.openRiskEvents} risco(s) aberto(s)</span>}</div>
    </section>

    <section className="wf-surface overflow-hidden" aria-label="Saúde operacional">
      <div className="grid divide-y divide-background-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {services.map((service) => <div key={service.label} className="flex items-start gap-3 p-4">
          <i className={`${service.icon} mt-0.5 text-xl text-primary-600`} aria-hidden="true" />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-foreground-900">{service.label}</h2><Status neutral={!operacao} good={Boolean(service.ok)} label={!operacao ? diagnosticError ? 'Indisponível' : 'Consultando' : service.ok ? 'Ativo' : 'Pendente'} /></div><p className="mt-2 text-sm text-foreground-500">{operacao ? service.detail : 'Estado ainda não confirmado'}</p></div>
        </div>)}
      </div>
    </section>

    <section className="grid items-start gap-4 lg:grid-cols-3">
      <ConnectionOverview title="Canais" link="/dashboard/configuracoes?tab=canais" items={channels} empty={diagnosticError ? 'Não foi possível consultar os canais.' : operacao ? 'Nenhum canal cadastrado.' : 'Consultando canais…'} />
      <ConnectionOverview title="APIs" link="/dashboard/configuracoes?tab=apis" items={apis} empty={diagnosticError ? 'Não foi possível consultar as APIs.' : operacao ? 'Nenhuma API cadastrada.' : 'Consultando APIs…'} />
      <ConnectionOverview title="Fontes" link="/dashboard/configuracoes?tab=apis" items={sources} empty={diagnosticError ? 'Não foi possível consultar as fontes.' : operacao ? 'Nenhuma fonte cadastrada.' : 'Consultando fontes…'} />
    </section>

    <section className="grid items-start gap-4 lg:grid-cols-2">
        <article className="wf-surface overflow-hidden">
          <div className="wf-overview-heading border-b border-background-200 p-4"><div><h2>Acompanhamento humano</h2><p>Conversas sob responsabilidade da equipe</p></div><Link to="/dashboard/atendimento" className="wf-overview-link">Ver Central ↗</Link></div>
          <div className="divide-y divide-background-100">{data.handoff.slice(0, 4).map((lead) => <Link key={lead.id} to={`/dashboard/atendimento?leadId=${lead.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background-100">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 font-semibold text-primary-700">{(lead.nome || lead.empresa || 'L').charAt(0)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground-800">{lead.nome || lead.empresa}</p><p className="mt-1 text-sm text-foreground-500">{lead.motivoTransferencia || 'Atendimento humano'}</p></div><i className="ri-arrow-right-s-line text-foreground-400" aria-hidden="true" />
          </Link>)}</div>
          {data.handoff.length === 0 && <p className="px-4 py-6 text-sm text-foreground-500">Nenhum atendimento humano na carteira carregada.</p>}
        </article>
        <article className="wf-surface p-4">
          <div className="wf-overview-heading"><div><h2>Fila e registros</h2><p>{conversas.length} conversas na Central</p></div><Link to="/dashboard/configuracoes?tab=registro" className="wf-overview-link">Ver registros ↗</Link></div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-background-200 pt-4">
            {[{ label: 'Na fila', value: operacao?.summary.queuedJobs }, { label: 'Falhas de envio', value: operacao?.summary.failedJobs }, { label: 'Riscos abertos', value: operacao?.summary.openRiskEvents }].map((item) => <div key={item.label}><dt className="text-sm text-foreground-500">{item.label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground-900">{item.value ?? '—'}</dd></div>)}
          </dl>
        </article>
    </section>
  </div>;
}
