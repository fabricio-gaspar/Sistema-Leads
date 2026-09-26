import { Link } from 'react-router-dom';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';
import { buildSellerAttentionGroups } from './sellerAttention';
import InfoTooltip from '@/components/feature/InfoTooltip';

type LoadState = 'loading' | 'ready' | 'error';

export default function SellerAttentionPanel({ notifications, leads, loadState = 'ready' }: {
  notifications: Notificacao[];
  leads: Lead[];
  loadState?: LoadState;
}) {
  const groups = buildSellerAttentionGroups(notifications, leads);
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const items = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))).slice(0, 5);

  return <section className="wf-surface wf-next-actions overflow-hidden" aria-label="Próximas ações">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground-900">Próximas ações</h2>
        <InfoTooltip text="Até cinco ações comerciais priorizadas a partir das notificações e da carteira. Abra a Central para consultar todas." label="Sobre as próximas ações" align="start" />
        {loadState === 'ready' && total > 0 && <span className="wf-count-pill">{total}</span>}
      </div>
      <Link to="/dashboard/atendimento" className="wf-overview-link">Ver Central<i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </div>

    {loadState === 'loading' && <p className="px-5 py-6 text-sm text-foreground-500">Consultando ações comerciais…</p>}
    {loadState === 'error' && <p className="px-5 py-3 text-sm text-amber-800">Não foi possível confirmar todas as ações. Consulte a Central antes de concluir a carteira.</p>}
    {loadState !== 'loading' && items.length === 0 && <p className="px-5 py-6 text-sm text-foreground-500">Nenhuma ação comercial pendente na carteira carregada.</p>}
    {loadState !== 'loading' && items.length > 0 && <div className="divide-y divide-background-100">
      {items.map((item) => {
        const lead = leads.find((candidate) => candidate.id === item.leadId);
        const stage = lead ? PIPELINE_STAGE_LABEL[stageFromLegacy(lead.etapa)] : item.group;
        return <Link key={`${item.group}-${item.id}`} to={item.to} className="wf-next-action-row">
          <div className="min-w-0 flex-1">
            <strong className="block break-words text-sm text-foreground-900">{lead?.empresa || item.title}</strong>
            <span className="mt-0.5 block break-words text-xs text-foreground-500">{stage} · {item.action}</span>
          </div>
          <span className="wf-next-action-open">Abrir<i className="ri-arrow-right-line" aria-hidden="true" /></span>
        </Link>;
      })}
    </div>}
  </section>;
}
