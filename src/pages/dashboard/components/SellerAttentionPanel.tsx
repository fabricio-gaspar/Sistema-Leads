import { Link } from 'react-router-dom';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';

const GROUPS = [
  { id: 'now', title: 'Responder agora', icon: 'ri-alarm-warning-line', match: (item: Notificacao) => item.acaoNecessaria === true || item.prioridade === 'urgent' },
  { id: 'hot', title: 'Leads quentes', icon: 'ri-fire-line', match: (item: Notificacao) => ['HOT', 'INTEREST'].includes(item.tipo) },
  { id: 'commercial', title: 'Reuniões e orçamentos', icon: 'ri-calendar-check-line', match: (item: Notificacao) => ['MEETING', 'QUOTE'].includes(item.tipo) },
] as const;

export default function SellerAttentionPanel({ notifications, leads }: { notifications: Notificacao[]; leads: Lead[] }) {
  const open = notifications.filter((item) => item.leadId && item.status !== 'resolved');
  const today = new Date().toLocaleDateString('en-CA');
  const followUps = leads.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).toLocaleDateString('en-CA') === today);
  const stale = leads.filter((lead) => lead.timeoutAt && Date.parse(lead.timeoutAt) <= Date.now() && !['Ganho', 'Perdido'].includes(lead.etapa));
  return <section className="wf-surface overflow-hidden" aria-label="Atenção do vendedor">
    <div className="wf-overview-heading border-b border-background-200 p-5"><div><h2>Atenção do vendedor</h2><p>Eventos objetivos identificados nas conversas e na qualificação</p></div><Link to="/dashboard/atendimento" className="wf-overview-link">Abrir Central ↗</Link></div>
    {open.length === 0 && followUps.length === 0 && stale.length === 0 ? <p className="p-5 text-sm text-foreground-500">Nenhuma ação comercial pendente para você.</p> : <div className="grid divide-y divide-background-200 lg:grid-cols-5 lg:divide-x lg:divide-y-0">{GROUPS.map((group) => {
      const items = open.filter(group.match).slice(0, 3);
      return <div key={group.id} className="min-w-0 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground-900"><i className={`${group.icon} mr-2 text-primary-600`} />{group.title}</h3><span className="rounded-full bg-background-100 px-2 py-0.5 text-xs font-semibold text-foreground-600">{open.filter(group.match).length}</span></div>
        <div className="mt-3 space-y-2">{items.length === 0 ? <p className="text-xs text-foreground-400">Sem itens.</p> : items.map((item) => <Link key={item.id} to={item.link || `/dashboard/atendimento?leadId=${item.leadId}`} className="block rounded-lg border border-background-200 p-3 hover:border-primary-300 hover:bg-primary-50/40"><p className="truncate text-sm font-semibold text-foreground-800">{item.titulo}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-500">{item.descricao}</p>{item.acaoRecomendada && <p className="mt-1 text-xs font-medium text-primary-700">{item.acaoRecomendada}</p>}</Link>)}</div>
      </div>;
    })}{[
      { id: 'follow-up', title: 'Acompanhamentos de hoje', icon: 'ri-calendar-todo-line', items: followUps, action: 'Realizar acompanhamento' },
      { id: 'stale', title: 'Sem resposta há muito tempo', icon: 'ri-timer-flash-line', items: stale, action: 'Revisar contato ou encerrar cadência' },
    ].map((group) => <div key={group.id} className="min-w-0 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground-900"><i className={`${group.icon} mr-2 text-primary-600`} />{group.title}</h3><span className="rounded-full bg-background-100 px-2 py-0.5 text-xs font-semibold text-foreground-600">{group.items.length}</span></div><div className="mt-3 space-y-2">{group.items.length === 0 ? <p className="text-xs text-foreground-400">Sem itens.</p> : group.items.slice(0, 3).map((lead) => <Link key={lead.id} to={`/dashboard/atendimento?leadId=${lead.id}`} className="block rounded-lg border border-background-200 p-3 hover:border-primary-300 hover:bg-primary-50/40"><p className="truncate text-sm font-semibold text-foreground-800">{lead.nome || lead.empresa}</p><p className="mt-1 text-xs font-medium text-primary-700">{group.action}</p></Link>)}</div></div>)}</div>}
  </section>;
}
