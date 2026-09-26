import { Link } from 'react-router-dom';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { buildSellerAttentionGroups } from './sellerAttention';

export default function SellerAttentionPanel({ notifications, leads }: { notifications: Notificacao[]; leads: Lead[] }) {
  const groups = buildSellerAttentionGroups(notifications, leads);
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const respondNow = groups.find((group) => group.id === 'now')?.items ?? [];

  return <section className="wf-surface overflow-hidden" aria-label="Atenção do vendedor">
    <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-foreground-900">Atenção do vendedor</h2>
          {total > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-foreground-900 px-2 py-0.5 text-xs font-semibold text-white"><i className="ri-notification-3-line" aria-hidden="true" />{total} {total === 1 ? 'ação' : 'ações'}</span>}
          {respondNow.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"><i className="ri-alarm-warning-line" aria-hidden="true" />{respondNow.length} urgente{respondNow.length === 1 ? '' : 's'}</span>}
        </div>
        <p className="mt-1 text-sm text-foreground-500">Ações reais que precisam da sua atenção.</p>
      </div>
      <Link to="/dashboard/atendimento" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800">Abrir Central <i className="ri-arrow-right-up-line" aria-hidden="true" /></Link>
    </div>

    {groups.length === 0 ? <div className="flex items-center gap-2 px-5 py-4 text-sm text-foreground-500"><i className="ri-checkbox-circle-line text-lg text-emerald-600" aria-hidden="true" />Nenhuma ação comercial pendente para você.</div> : <div className="grid gap-px bg-background-200 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => <section key={group.id} className="min-w-0 bg-white p-4" aria-label={group.title}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${group.tone}`} title={group.title}><i className={`${group.icon} text-base`} aria-hidden="true" /></span>
            <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-foreground-900">{group.title}</h3><p className="truncate text-xs text-foreground-500">{group.description}</p></div>
          </div>
          <span className="rounded-full bg-background-100 px-2 py-0.5 text-xs font-semibold text-foreground-600" aria-label={`${group.items.length} item(ns)`}>{group.items.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {group.items.slice(0, 2).map((item) => <Link key={item.id} to={item.to} className="group flex items-start gap-2 rounded-lg border border-background-200 px-3 py-2 transition-colors hover:border-primary-200 hover:bg-primary-50/50">
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-foreground-800">{item.title}</span><span className="mt-0.5 block break-words text-xs leading-5 text-foreground-500">{item.detail}</span></span>
            <span className="max-w-28 shrink-0 text-right text-xs font-semibold leading-5 text-primary-700 group-hover:text-primary-800">{item.action}<i className="ri-arrow-right-line ml-1" aria-hidden="true" /></span>
          </Link>)}
          {group.items.length > 2 && <Link to="/dashboard/atendimento" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800">Ver mais {group.items.length - 2} <i className="ri-arrow-right-line" aria-hidden="true" /></Link>}
        </div>
      </section>)}
    </div>}
  </section>;
}
