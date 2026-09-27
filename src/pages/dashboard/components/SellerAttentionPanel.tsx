import { Link } from 'react-router-dom';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { buildDashboardDecisionQueue } from './dashboardDecisionQueue';
import InfoTooltip from '@/components/feature/InfoTooltip';

type LoadState = 'loading' | 'ready' | 'error';

export default function SellerAttentionPanel({ notifications, leads, loadState = 'ready' }: {
  notifications: Notificacao[];
  leads: Lead[];
  loadState?: LoadState;
}) {
  const items = buildDashboardDecisionQueue(notifications, leads);

  return <section className="wf-surface wf-next-actions overflow-hidden" aria-label="Ações agora">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground-900">Ações agora</h2>
        <InfoTooltip text="Até cinco decisões comerciais priorizadas. A fila une notificações abertas, acompanhamentos e transferências para atendimento humano sem criar tarefas ou alterar o lead." label="Sobre as ações agora" align="start" />
        {loadState === 'ready' && items.length > 0 && <span className="wf-count-pill">{items.length}</span>}
      </div>
      <Link to="/dashboard/atendimento" className="wf-overview-link">Ver Central<i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </div>

    {loadState === 'loading' && <p className="px-5 py-6 text-sm text-foreground-500">Consultando ações comerciais…</p>}
    {loadState === 'error' && <p className="px-5 py-3 text-sm text-amber-800">Não foi possível confirmar todas as ações. Consulte a Central antes de concluir a carteira.</p>}
    {loadState === 'ready' && items.length === 0 && <p className="px-5 py-6 text-sm text-foreground-500">Nenhuma ação comercial pendente na carteira carregada.</p>}
    {loadState !== 'loading' && items.length > 0 && <div className="divide-y divide-background-100">
      {items.map((item) => {
        return <Link key={item.id} to={item.to} className="wf-next-action-row wf-decision-row" aria-label={`${item.title}. ${item.group}. ${item.detail}. Etapa ${item.stage}. Próxima ação: ${item.action}.`}>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2"><span className="wf-decision-kind">{item.group}</span><strong className="min-w-0 truncate text-sm text-foreground-900">{item.title}</strong></div>
            <span className="wf-decision-detail" title={item.detail}>{item.detail}</span>
            <span className="mt-1 block text-xs font-medium text-foreground-500">{item.stage} · {item.action}</span>
          </div>
          <span className="wf-next-action-open">Abrir<i className="ri-arrow-right-line" aria-hidden="true" /></span>
        </Link>;
      })}
    </div>}
  </section>;
}
