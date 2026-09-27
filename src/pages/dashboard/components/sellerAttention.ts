import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { stageFromLegacy } from '@/domain/pipeline';

export type AttentionItem = { id: string; title: string; detail: string; action: string; to: string; leadId?: string };
export type AttentionGroup = { id: string; title: string; description: string; icon: string; tone: string; items: AttentionItem[] };

const notificationItem = (item: Notificacao): AttentionItem => ({
  id: item.id,
  title: item.titulo,
  detail: item.descricao,
  action: item.acaoRecomendada || 'Abrir conversa',
  to: item.link || `/dashboard/atendimento?leadId=${item.leadId}`,
  leadId: item.leadId,
});

const leadItem = (lead: Lead, action: string): AttentionItem => ({
  id: lead.id,
  title: lead.nome || lead.empresa,
  detail: lead.empresa && lead.nome ? lead.empresa : 'Lead em acompanhamento',
  action,
  to: `/dashboard/atendimento?leadId=${lead.id}`,
  leadId: lead.id,
});

export function buildSellerAttentionGroups(notifications: Notificacao[], leads: Lead[], now = new Date()): AttentionGroup[] {
  const open = notifications.filter((item) => item.leadId && item.status !== 'resolved');
  const today = now.toLocaleDateString('en-CA');
  const followUps = leads.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).toLocaleDateString('en-CA') === today);
  const stale = leads.filter((lead) =>
    lead.timeoutAt
    && Date.parse(lead.timeoutAt) <= now.getTime()
    && !['won', 'lost'].includes(stageFromLegacy(lead.etapa))
  );

  // The event meaning wins over the generic action-required flag. Otherwise every
  // hot/meeting/quote event collapses into "Responder agora" and its own lane is empty.
  const commercial = open.filter((item) => ['MEETING', 'QUOTE'].includes(item.tipo));
  const hot = open.filter((item) => !commercial.includes(item) && ['HOT', 'INTEREST'].includes(item.tipo));
  const respondNow = open.filter((item) => !commercial.includes(item) && !hot.includes(item)
    && (item.acaoNecessaria === true || item.prioridade === 'urgent' || ['HANDOFF', 'ALERT'].includes(item.tipo)));
  const notifiedLeadIds = new Set(open.map((item) => item.leadId).filter(Boolean));
  const followUpItems = followUps.filter((lead) => !notifiedLeadIds.has(lead.id));
  const followUpIds = new Set(followUpItems.map((lead) => lead.id));
  const staleItems = stale.filter((lead) => !notifiedLeadIds.has(lead.id) && !followUpIds.has(lead.id));
  return [
    { id: 'now', title: 'Responder agora', description: 'Contato aguardando ação humana', icon: 'ri-reply-line', tone: 'bg-accent-50 text-accent-700', items: respondNow.map(notificationItem) },
    { id: 'hot', title: 'Leads quentes', description: 'Interesse comercial identificado', icon: 'ri-fire-line', tone: 'bg-amber-50 text-amber-700', items: hot.map(notificationItem) },
    { id: 'commercial', title: 'Reuniões e orçamentos', description: 'Próxima ação comercial', icon: 'ri-calendar-check-line', tone: 'bg-primary-50 text-primary-700', items: commercial.map(notificationItem) },
    { id: 'follow-up', title: 'Acompanhamentos de hoje', description: 'Retornos planejados para hoje', icon: 'ri-calendar-todo-line', tone: 'bg-primary-50 text-primary-700', items: followUpItems.map((lead) => leadItem(lead, 'Realizar acompanhamento')) },
    { id: 'stale', title: 'Sem resposta há muito tempo', description: 'Revisar contato ou cadência', icon: 'ri-timer-flash-line', tone: 'bg-amber-50 text-amber-800', items: staleItems.map((lead) => leadItem(lead, 'Revisar contato')) },
  ].filter((group) => group.items.length > 0);
}
