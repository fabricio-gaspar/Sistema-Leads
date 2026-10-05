import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLeadsLoadStatus, useLeadsStore } from '@/hooks/useLeadsStore';
import { loadOperationalDiagnostics, type OperationalDiagnostics } from '@/lib/crm/operationalDiagnosticsRepository';
import CommercialAnalytics from '@/components/feature/CommercialAnalytics';
import { presentIntegrationStatus, type StatusTone } from '@/lib/crm/operationalStatusPresentation';
import SellerAttentionPanel from './components/SellerAttentionPanel';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';
import InfoTooltip from '@/components/feature/InfoTooltip';
import AnaAutomaticControl from './components/AnaAutomaticControl';
import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import { hasAnyPermission } from '@/lib/crm/currentAccessRepository';

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
  tone: 'warning' | 'danger';
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
  const notifications = useNotificacoesStore();
  const [operacao, setOperacao] = useState<OperationalDiagnostics | null>(null);
  const [diagnosticError, setDiagnosticError] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [panelPreferencesOpen, setPanelPreferencesOpen] = useState(false);
  const { access } = useCurrentAccess();
  const sellerOwnWhatsapp = access?.role === 'vendedor'
    && hasAnyPermission(access, ['channels.connect_own']);
  const whatsappWorkspaceLink = sellerOwnWhatsapp ? '/dashboard/atendimento' : '/dashboard/configuracoes?tab=canais';
  const whatsappWorkspaceLabel = sellerOwnWhatsapp ? 'Conectar WhatsApp' : 'Ver canal';

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
    if (!liveUpdates) return () => { disposed = true; };
    const interval = window.setInterval(() => void refreshOperationalData(), 60_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [liveUpdates]);

  const integrationsByKey = new Map((diagnosticError ? [] : operacao?.status.integrations ?? []).map((item) => [item.key, item]));
  const whatsappMonitoring = diagnosticError ? undefined : operacao?.status.whatsappMonitoring;
  const scheduler = operacao?.status.checks.find((item) => item.id === 'scheduler');
  const apifyIntegration = integrationsByKey.get('apify');
  const apify = apifyIntegration ? presentIntegrationStatus(apifyIntegration) : null;
  const attentionLoadState = leadsStatus === 'loading' || notifications.loading ? 'loading' : leadsStatus === 'error' || notifications.error ? 'error' : 'ready';
  const diagnosticTime = formatOperationalDate(operacao?.status.runtimeUpdatedAt ?? operacao?.status.updatedAt ?? null);
  const diagnosticValue = (value: number | null | undefined) => diagnosticError || !operacao ? '—' : (value ?? '—').toLocaleString('pt-BR');
  const diagnosticStatus = (status: string, tone: StatusTone) => diagnosticError
    ? { status: 'Leitura indisponível', tone: 'neutral' as StatusTone }
    : !operacao
      ? { status: 'Consultando', tone: 'neutral' as StatusTone }
      : { status, tone };

  const operationalAlerts: OperationalAlert[] = [];
  if (diagnosticError) {
    operationalAlerts.push({ id: 'diagnostic', title: 'Operação requer revisão', detail: 'A leitura segura do backend falhou; o estado técnico não foi confirmado.', link: '/dashboard/configuracoes?tab=operacao', action: 'Ver operação', icon: 'ri-error-warning-line', tone: 'danger' });
  } else if (operacao) {
    if (operacao.status.killSwitch || !operacao.status.productionReady) operationalAlerts.push({ id: 'ana-preparation', title: operacao.status.killSwitch ? 'Ana pausada' : 'Ana exige configuração', detail: operacao.status.killSwitch ? 'A pausa global impede novas automações.' : 'Automação protegida até os requisitos reais serem comprovados.', link: '/dashboard/configuracoes?tab=ana', action: 'Abrir configuração', icon: 'ri-robot-2-line', tone: 'warning' });
    if (operacao.summary.failedJobs > 0) operationalAlerts.push({ id: 'jobs', title: `${operacao.summary.failedJobs} falha${operacao.summary.failedJobs === 1 ? '' : 's'} na fila`, detail: 'Processamento requer revisão antes de reexecutar uma ação.', link: '/dashboard/registro-sistema', action: 'Ver fila', icon: 'ri-alert-line', tone: 'danger' });
    if (apify && apify.tone !== 'positive') operationalAlerts.push({ id: 'search', title: 'Busca precisa validar', detail: apifyIntegration?.detail || 'A integração de busca precisa de uma nova validação.', link: '/dashboard/configuracoes?tab=apis', action: 'Revalidar', icon: 'ri-map-pin-search-line', tone: 'warning' });
  }
  const freshness = diagnosticError ? 'Atualização pausada' : !liveUpdates ? 'Atualização pausada' : operacao ? 'Atualização automática a cada 60 s' : 'Conectando ao diagnóstico';

  const processing = operacao?.summary.failedJobs
    ? { label: `${operacao.summary.failedJobs} falha(s)`, tone: 'critical' as StatusTone, detail: 'Existem falhas registradas na fila operacional. Consulte os registros antes de repetir qualquer ação.' }
    : scheduler?.ok
      ? { label: operacao?.summary.queuedJobs ? `${operacao.summary.queuedJobs} na fila` : 'Em dia', tone: 'positive' as StatusTone, detail: scheduler.detail || 'O agendador foi confirmado pelo backend.' }
      : { label: 'Pendente', tone: 'attention' as StatusTone, detail: scheduler?.detail || 'O estado do agendador ainda não foi confirmado pelo backend.' };

  const operationalItems = [
    { label: 'Ana', icon: 'ri-robot-2-line', ...diagnosticStatus(operacao?.status.killSwitch ? 'Pausada' : operacao?.status.productionReady ? 'Pronta' : 'Pendente', operacao?.status.productionReady && !operacao.status.killSwitch ? 'positive' : 'attention'), detail: 'Prontidão e pausa operacional da Ana. Estar pronta não é prova de envio ou entrega.', link: '/dashboard/configuracoes?tab=ana' },
    { label: 'WhatsApp', icon: 'ri-whatsapp-line', ...diagnosticStatus(whatsappMonitoring?.state === 'stable' ? 'Estável' : whatsappMonitoring?.state === 'paused' ? 'Pausado' : whatsappMonitoring?.state === 'attention' ? 'Requer atenção' : whatsappMonitoring?.state === 'unavailable' ? 'Indisponível' : 'Não configurado', whatsappMonitoring?.state === 'stable' ? 'positive' : whatsappMonitoring?.state === 'unavailable' ? 'critical' : 'attention'), detail: sellerOwnWhatsapp ? 'Conecte ou valide sua conta Evolution GO na Central. O indicador resume o canal da empresa.' : whatsappMonitoring?.detail ?? 'Estado do canal confirmado pelo backend.', link: whatsappWorkspaceLink },
    { label: 'Busca', icon: 'ri-map-pin-search-line', ...diagnosticStatus(apify?.label ?? 'Não configurada', apify?.tone ?? 'neutral'), detail: apifyIntegration?.detail ?? 'Estado da integração de busca Apify.', link: '/dashboard/configuracoes?tab=apis' },
    { label: 'Processamento', icon: 'ri-pulse-line', ...diagnosticStatus(processing.label, processing.tone), detail: processing.detail, link: '/dashboard/configuracoes?tab=operacao' },
  ];

  return <div className="wf-page wf-overview wf-commercial-dashboard">
    <header className="wf-page-header">
      <div><p className="wf-eyebrow">Dashboard</p><div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">Visão geral</h1><span className="text-sm text-foreground-500">Operação comercial em tempo real.</span><InfoTooltip text="Indicadores comerciais e condição operacional. A atualização é declarada como polling de 60 segundos; não há stream simulado nesta tela." label="Sobre a Dashboard" align="start" /></div></div>
      <div className="flex flex-wrap items-center justify-end gap-2"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${diagnosticError ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-primary-100 bg-primary-50 text-primary-800'}`}><span className="h-2 w-2 rounded-full bg-current" />{freshness}</span><label className="inline-flex items-center gap-2 rounded-lg border border-background-200 bg-white px-3 py-2 text-xs font-semibold text-foreground-700"><span>Atualização ao vivo</span><button type="button" role="switch" aria-checked={liveUpdates} onClick={() => setLiveUpdates((value) => !value)} className={`relative h-5 w-9 rounded-full ${liveUpdates ? 'bg-primary-600' : 'bg-background-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${liveUpdates ? 'left-4' : 'left-0.5'}`} /></button><span>{liveUpdates ? 'Ativa' : 'Desativada'}</span></label><button type="button" onClick={() => setPanelPreferencesOpen((open) => !open)} className="wf-btn-secondary text-xs"><i className="ri-layout-grid-line" />Personalizar painel</button><Link to="/dashboard/agenda" className="wf-btn-secondary text-xs"><i className="ri-calendar-line" />Minha agenda</Link></div>
    </header>

    {panelPreferencesOpen && <section className="wf-surface mb-4 flex flex-wrap items-center gap-3 p-4 text-xs text-foreground-600"><strong className="text-foreground-900">Painel padrão</strong><span>Os widgets exibidos usam dados reais. A personalização persistente será habilitada quando houver preferência auditável por usuário.</span><button type="button" onClick={() => setPanelPreferencesOpen(false)} className="ml-auto wf-btn-secondary text-xs">Fechar</button></section>}

    {operationalAlerts.length > 0 && <section className="mb-4 grid gap-3 xl:grid-cols-3" aria-label="Alertas prioritários">{operationalAlerts.slice(0, 3).map((alert) => <article key={alert.id} className={`rounded-xl border p-4 ${alert.tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-start gap-3"><i className={`${alert.icon} mt-0.5 text-xl ${alert.tone === 'danger' ? 'text-red-700' : 'text-amber-700'}`} /><div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-foreground-950">{alert.title}</h2><p className="mt-1 text-xs leading-5 text-foreground-700">{alert.detail}</p><Link to={alert.link} className="mt-3 inline-flex text-xs font-bold text-foreground-900 underline">{alert.action}<i className="ri-arrow-right-line ml-1" /></Link></div></div></article>)}</section>}

    <CommercialAnalytics aside={<SellerAttentionPanel notifications={notifications.notificacoes} leads={leads} loadState={attentionLoadState} />} />

    <div className="mt-5"><AnaAutomaticControl /></div>

    <section className="wf-dashboard-operations wf-operations-summary mt-5" aria-label="Atividade e saúde operacional">
      <article className="wf-surface wf-contact-activity">
        <div className="border-b border-background-200 px-5 py-4"><PanelHeading title="Atividade de contato" help="Contagens operacionais das últimas 24 horas. Envios aceitos não significam entrega ou leitura." link={whatsappWorkspaceLink} linkLabel={whatsappWorkspaceLabel} /></div>
        <dl className="wf-contact-activity__grid">
          {[
            { label: 'Envios aceitos · 24h', value: diagnosticValue(whatsappMonitoring?.sentLast24Hours) },
            { label: 'Entradas · 24h', value: diagnosticValue(whatsappMonitoring?.inboundLast24Hours) },
            { label: 'Entregas · 24h', value: diagnosticValue(whatsappMonitoring?.deliveredLast24Hours) },
            { label: 'Falhas na fila', value: diagnosticValue(operacao?.summary.failedJobs) },
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
