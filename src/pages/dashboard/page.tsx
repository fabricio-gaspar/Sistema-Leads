import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import SaudeWhatsappCard from '@/components/feature/SaudeWhatsappCard';
import OperationalModeControl from '@/components/feature/OperationalModeControl';
import { loadOperationalDiagnostics, type OperationalDiagnostics } from '@/lib/crm/operationalDiagnosticsRepository';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';

function Metric({ label, value, detail, icon, tone = 'primary' }: { label: string; value: number; detail: string; icon: string; tone?: 'primary' | 'secondary' | 'accent' }) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700', secondary: 'bg-background-100 text-foreground-600', accent: 'bg-accent-50 text-accent-700',
  };
  return <div className="wf-kpi">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-foreground-500">{label}</p><span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}><i className={icon}></i></span></div>
    <p className="mt-3 text-[1.75rem] leading-none font-heading font-bold tracking-[-0.04em] text-foreground-950">{value}</p>
    <p className="mt-2 text-xs text-foreground-400">{detail}</p>
  </div>;
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

  const anaRuns = operacao?.runs.filter((run) => run.status === 'completed').length ?? 0;
  const processing = operacao?.summary.queuedJobs ?? null;
  const offlineIntegrations = operacao?.status.integrations.filter((item) => item.health !== 'online').length ?? null;
  const operationalAlerts = operacao ? operacao.summary.failedJobs + operacao.summary.openRiskEvents + (offlineIntegrations ?? 0) : null;

  return <div className="wf-page">
    <header className="wf-page-header">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Visão operacional</p><h1 className="wf-page-title mt-1">O que precisa da sua atenção</h1><p className="wf-page-description">Acompanhe conversas, orçamentos e decisões que exigem ação humana.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/dashboard/atendimento" className="wf-btn-primary"><i className="ri-customer-service-2-line"></i>Abrir atendimento</Link><Link to="/dashboard/configuracoes?tab=equipe" className="wf-btn-secondary"><i className="ri-team-line"></i>Equipe</Link><Link to="/dashboard/kanban" className="wf-btn-secondary"><i className="ri-layout-masonry-line"></i>Ver Kanban</Link></div>
    </header>

    <section className="wf-metric-strip"><Metric label="Precisa de você" value={data.handoff.length} detail="Atendimentos com humano" icon="ri-user-received-line" tone="accent"/><Metric label="Leads no fluxo" value={data.active.length} detail="Oportunidades abertas" icon="ri-stack-line"/><Metric label="Alta prioridade" value={data.hot.length} detail="Leads com temperatura quente" icon="ri-fire-line" tone="secondary"/><Metric label="Orçamentos ativos" value={data.quotes.length} detail={`${data.expiring.length} vencendo em breve`} icon="ri-file-list-3-line"/></section>

    <OperationalModeControl />

    <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 wf-surface overflow-hidden"><div className="px-5 py-4 border-b border-background-200/70 flex items-center justify-between"><div><h2 className="font-heading font-semibold text-foreground-950">Fila prioritária</h2><p className="text-xs text-foreground-500 mt-0.5">A Ana pausa automaticamente quando um humano assume.</p></div><Link className="text-xs font-semibold text-primary-700" to="/dashboard/atendimento">Ver inbox</Link></div><div className="divide-y divide-background-100">{data.handoff.slice(0, 5).map((lead) => <Link key={lead.id} to={`/dashboard/atendimento?leadId=${lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-background-100/70"><span className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-semibold">{lead.nome.charAt(0)}</span><span className="flex-1 min-w-0"><strong className="block text-sm text-foreground-900 truncate">{lead.nome || lead.empresa}</strong><span className="text-xs text-foreground-500">{lead.empresa} · {lead.motivoTransferencia || 'Aguardando ação humana'}</span></span><i className="ri-arrow-right-s-line text-foreground-400 text-lg"></i></Link>)}{data.handoff.length === 0 && <div className="px-5 py-10 text-center text-sm text-foreground-500"><i className="ri-checkbox-circle-line text-primary-500 text-xl block mb-2"></i>Nenhum atendimento aguardando você.</div>}</div></div>
      <SaudeWhatsappCard />
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5"><div className="wf-surface p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-heading font-semibold text-foreground-950">Pipeline comercial</h2><p className="text-xs text-foreground-500">As mesmas sete etapas usadas pelo Kanban e pela Ana.</p></div><Link className="text-xs font-semibold text-primary-700" to="/dashboard/kanban">Abrir Kanban</Link></div><div className="space-y-3">{ACTIVE_PIPELINE_STAGES.map((stage, index) => { const count = leads.filter((lead) => stageFromLegacy(lead.etapa) === stage).length; return <div key={stage} className="flex items-center gap-3"><span className="w-5 text-xs font-semibold text-foreground-400">{String(index + 1).padStart(2, '0')}</span><span className="w-36 text-sm text-foreground-700">{PIPELINE_STAGE_LABEL[stage]}</span><div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden"><div className={`h-full rounded-full ${stage === 'won' ? 'bg-[#34C759]' : stage === 'lost' ? 'bg-[#FF3B30]' : 'bg-primary-600'}`} style={{ width: `${Math.max(4, Math.min(100, count * 12))}%` }} /></div><span className="w-6 text-right text-xs font-semibold text-foreground-700">{count}</span></div>; })}</div></div>
      <div className="wf-surface p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading font-semibold text-foreground-950">Operação da Ana</h2><p className="text-xs text-foreground-500 mt-0.5">Execuções, conexões e alertas confirmados pelo backend.</p></div><Link to="/dashboard/registro-sistema" className="text-xs font-semibold text-primary-700">Ver registros</Link></div><div className="mt-4 grid grid-cols-2 divide-x divide-y divide-background-200 rounded-lg border border-background-200 sm:grid-cols-4 sm:divide-y-0"><div className="p-3"><p className="text-xl font-semibold text-foreground-950">{conversas.length}</p><p className="text-[11px] text-foreground-500">Conversas</p></div><div className="p-3"><p className="text-xl font-semibold text-foreground-950">{operacao ? anaRuns : '—'}</p><p className="text-[11px] text-foreground-500">Execuções concluídas</p></div><div className="p-3"><p className={`text-xl font-semibold ${offlineIntegrations ? 'text-accent-700' : 'text-foreground-950'}`}>{offlineIntegrations ?? '—'}</p><p className="text-[11px] text-foreground-500">APIs offline/vencidas</p></div><div className="p-3"><p className={`text-xl font-semibold ${operationalAlerts ? 'text-accent-700' : 'text-foreground-950'}`}>{operationalAlerts ?? '—'}</p><p className="text-[11px] text-foreground-500">Alertas operacionais</p></div></div><p className="mt-3 text-xs text-foreground-500">{processing === null ? 'Status da fila indisponível nesta sessão.' : processing === 0 ? 'Nenhuma saída aguardando processamento.' : `${processing} saída(s) aguardando processamento seguro.`}</p><Link to="/dashboard/configuracoes?tab=operacao" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><i className="ri-pulse-line"></i>Ver status operacional</Link></div></section>
  </div>;
}
