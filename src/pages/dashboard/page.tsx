import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import SaudeWhatsappCard from '@/components/feature/SaudeWhatsappCard';
import { loadOperationalDiagnostics, type OperationalDiagnostics } from '@/lib/crm/operationalDiagnosticsRepository';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';

type ResourceState = 'active' | 'inactive' | 'loading';

function Metric({ label, value, detail, icon, tone = 'primary' }: { label: string; value: number; detail: string; icon: string; tone?: 'primary' | 'secondary' | 'accent' }) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700', secondary: 'bg-background-100 text-foreground-600', accent: 'bg-accent-50 text-accent-700',
  };
  return <div className="wf-kpi">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-foreground-500">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><i className={icon} /></span></div>
    <p className="mt-3 font-heading text-[1.8rem] font-bold leading-none tracking-[-0.04em] text-foreground-950">{value}</p>
    <p className="mt-2 text-xs text-foreground-400">{detail}</p>
  </div>;
}

function ResourceCard({ title, detail, icon, state }: { title: string; detail: string; icon: string; state: ResourceState }) {
  const meta = {
    active: { label: 'Ativo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    inactive: { label: 'Inativo', className: 'border-background-200 bg-background-100 text-foreground-600', dot: 'bg-foreground-300' },
    loading: { label: 'Consultando', className: 'border-background-200 bg-white text-foreground-500', dot: 'bg-foreground-300 animate-pulse' },
  }[state];
  return <article className="flex min-h-[132px] flex-col rounded-xl border border-background-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-100 text-primary-700"><i className={`${icon} text-base`} /></span>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
    </div>
    <h3 className="mt-3 text-sm font-semibold text-foreground-950">{title}</h3>
    <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-500">{detail}</p>
  </article>;
}

function statusFrom(ok: boolean | undefined, loaded: boolean): ResourceState {
  if (!loaded) return 'loading';
  return ok ? 'active' : 'inactive';
}

export default function Dashboard() {
  const [leads] = useLeadsStore();
  const { conversas } = useConversasStore();
  const { propostas } = usePropostasStore();
  const [operacao, setOperacao] = useState<OperationalDiagnostics | null>(null);

  useEffect(() => {
    void loadOperationalDiagnostics().then(setOperacao).catch(() => setOperacao(null));
  }, []);

  const data = useMemo(() => {
    const handoff = leads.filter((lead) => lead.modoAtendimento === 'HUMANO' || lead.automacaoStatus === 'AGUARDANDO_HUMANO');
    const active = leads.filter((lead) => !['won', 'lost'].includes(stageFromLegacy(lead.etapa)));
    const hot = active.filter((lead) => lead.temperatura === 'Quente');
    const quotes = propostas.filter((proposal) => ['enviada', 'visualizada'].includes(proposal.status));
    const expiring = quotes.filter((proposal) => new Date(`${proposal.validade}T23:59:59`).getTime() - Date.now() < 3 * 86400000);
    return { handoff, active, hot, quotes, expiring };
  }, [leads, propostas]);

  const check = (id: string) => operacao?.status.checks.find((item) => item.id === id);
  const loaded = Boolean(operacao);
  const prospecting = operacao?.status.integrations.filter((item) => item.category === 'prospecting') ?? [];
  const prospectingActive = prospecting.some((item) => item.health === 'online' && item.connected && item.enabled && !item.paused);
  const resources = [
    {
      title: 'Ambiente Real', icon: 'ri-shield-check-line',
      state: statusFrom(operacao?.status.mode === 'real', loaded),
      detail: operacao?.status.mode === 'real' ? 'Modo confirmado por company_settings no backend.' : 'As saídas automáticas permanecem protegidas pelo backend.',
    },
    {
      title: 'WhatsApp · Z-API', icon: 'ri-whatsapp-line',
      state: statusFrom(check('whatsapp')?.ok, loaded), detail: check('whatsapp')?.detail || 'Consultando a conexão de saída do WhatsApp.',
    },
    {
      title: 'Entrada do WhatsApp', icon: 'ri-message-2-line',
      state: statusFrom(check('whatsapp_webhook')?.ok, loaded), detail: check('whatsapp_webhook')?.detail || 'Consultando o recebimento de respostas.',
    },
    {
      title: 'Ana automática', icon: 'ri-robot-2-line',
      state: statusFrom(operacao?.status.productionReady, loaded),
      detail: operacao?.status.productionReady ? 'IA, canal, entrada, worker e políticas foram confirmados.' : 'A Ana só fica ativa quando todas as proteções obrigatórias passam.',
    },
    {
      title: 'Worker 24/7', icon: 'ri-loop-right-line',
      state: statusFrom(check('scheduler')?.ok, loaded), detail: check('scheduler')?.detail || 'Consultando o heartbeat do servidor.',
    },
    {
      title: 'Fontes de prospecção', icon: 'ri-radar-line',
      state: statusFrom(prospectingActive, loaded),
      detail: prospectingActive ? `${prospecting.filter((item) => item.health === 'online' && item.enabled).length} fonte(s) pronta(s) para captar leads.` : 'Apify e Google Places aguardam configuração e ativação.',
    },
  ] satisfies Array<{ title: string; detail: string; icon: string; state: ResourceState }>;

  const anaRuns = operacao?.runs.filter((run) => run.status === 'completed').length ?? 0;
  const processing = operacao?.summary.queuedJobs ?? null;
  const offlineIntegrations = operacao?.status.integrations.filter((item) => item.health !== 'online').length ?? null;
  const operationalAlerts = operacao ? operacao.summary.failedJobs + operacao.summary.openRiskEvents + (offlineIntegrations ?? 0) : null;
  const statusUpdatedAt = operacao?.status.runtimeUpdatedAt || operacao?.status.updatedAt;

  return <div className="wf-page">
    <header className="wf-page-header">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Visão operacional</p><h1 className="wf-page-title mt-1">Dashboard</h1><p className="wf-page-description">Indicadores para priorizar atendimento, acompanhar o Kanban e conferir a saúde das integrações.</p></div>
    </header>

    <section className="wf-metric-strip" aria-label="Resumo comercial"><Metric label="Precisa de você" value={data.handoff.length} detail="Atendimentos com humano" icon="ri-user-received-line" tone="accent" /><Metric label="Leads no fluxo" value={data.active.length} detail="Oportunidades abertas" icon="ri-stack-line" /><Metric label="Alta prioridade" value={data.hot.length} detail="Leads com temperatura quente" icon="ri-fire-line" tone="secondary" /><Metric label="Orçamentos ativos" value={data.quotes.length} detail={`${data.expiring.length} vencendo em breve`} icon="ri-file-list-3-line" /></section>

    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Estado do sistema</p><h2 className="mt-1 text-lg font-semibold text-foreground-950">Principais recursos</h2><p className="mt-1 text-sm text-foreground-500">Ativo e inativo são calculados pelo backend e pelas integrações da empresa.</p></div><p className="text-xs text-foreground-400">{statusUpdatedAt ? `Atualizado em ${new Date(statusUpdatedAt).toLocaleString('pt-BR')}` : 'Consultando atualização operacional…'}</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{resources.map((resource) => <ResourceCard key={resource.title} {...resource} />)}</div>
    </section>

    <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="wf-surface overflow-hidden xl:col-span-2"><div className="flex items-center justify-between border-b border-background-200 px-5 py-4"><div><h2 className="font-heading font-semibold text-foreground-950">Fila prioritária</h2><p className="mt-0.5 text-xs text-foreground-500">A Ana pausa automaticamente quando um humano assume.</p></div><Link className="text-xs font-semibold text-primary-700" to="/dashboard/atendimento">Ver Central</Link></div><div className="divide-y divide-background-100">{data.handoff.slice(0, 5).map((lead) => <Link key={lead.id} to={`/dashboard/atendimento?leadId=${lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-background-100/70"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">{lead.nome.charAt(0)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-foreground-900">{lead.nome || lead.empresa}</strong><span className="text-xs text-foreground-500">{lead.empresa} · {lead.motivoTransferencia || 'Aguardando ação humana'}</span></span><i className="ri-arrow-right-s-line text-lg text-foreground-400" /></Link>)}{data.handoff.length === 0 && <div className="px-5 py-10 text-center text-sm text-foreground-500"><i className="ri-checkbox-circle-line mb-2 block text-xl text-primary-500" />Nenhum atendimento aguardando você.</div>}</div></div>
      <SaudeWhatsappCard />
    </section>

    <section className="grid grid-cols-1 gap-5 lg:grid-cols-2"><div className="wf-surface p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-heading font-semibold text-foreground-950">Pipeline comercial</h2><p className="text-xs text-foreground-500">As mesmas sete etapas usadas pelo Kanban e pela Ana.</p></div><Link className="text-xs font-semibold text-primary-700" to="/dashboard/kanban">Abrir Kanban</Link></div><div className="space-y-3">{ACTIVE_PIPELINE_STAGES.map((stage, index) => { const count = leads.filter((lead) => stageFromLegacy(lead.etapa) === stage).length; return <div key={stage} className="flex items-center gap-3"><span className="w-5 text-xs font-semibold text-foreground-400">{String(index + 1).padStart(2, '0')}</span><span className="w-36 text-sm text-foreground-700">{PIPELINE_STAGE_LABEL[stage]}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-200"><div className={`h-full rounded-full ${stage === 'won' ? 'bg-emerald-500' : stage === 'lost' ? 'bg-rose-500' : 'bg-primary-600'}`} style={{ width: `${Math.max(4, Math.min(100, count * 12))}%` }} /></div><span className="w-6 text-right text-xs font-semibold text-foreground-700">{count}</span></div>; })}</div></div>
      <div className="wf-surface p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading font-semibold text-foreground-950">Operação da Ana</h2><p className="mt-0.5 text-xs text-foreground-500">Execuções, conexões e alertas confirmados pelo backend.</p></div><Link to="/dashboard/registro-sistema" className="text-xs font-semibold text-primary-700">Ver registros</Link></div><div className="mt-4 grid grid-cols-2 divide-x divide-y divide-background-200 rounded-lg border border-background-200 sm:grid-cols-4 sm:divide-y-0"><div className="p-3"><p className="text-xl font-semibold text-foreground-950">{conversas.length}</p><p className="text-[11px] text-foreground-500">Conversas</p></div><div className="p-3"><p className="text-xl font-semibold text-foreground-950">{operacao ? anaRuns : '—'}</p><p className="text-[11px] text-foreground-500">Execuções concluídas</p></div><div className="p-3"><p className={`text-xl font-semibold ${offlineIntegrations ? 'text-accent-700' : 'text-foreground-950'}`}>{offlineIntegrations ?? '—'}</p><p className="text-[11px] text-foreground-500">APIs offline/vencidas</p></div><div className="p-3"><p className={`text-xl font-semibold ${operationalAlerts ? 'text-accent-700' : 'text-foreground-950'}`}>{operationalAlerts ?? '—'}</p><p className="text-[11px] text-foreground-500">Alertas operacionais</p></div></div><p className="mt-3 text-xs text-foreground-500">{processing === null ? 'Status da fila indisponível nesta sessão.' : processing === 0 ? 'Nenhuma saída aguardando processamento.' : `${processing} saída(s) aguardando processamento seguro.`}</p><Link to="/dashboard/configuracoes?tab=operacao" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><i className="ri-pulse-line" />Ver status operacional</Link></div></section>
  </div>;
}
