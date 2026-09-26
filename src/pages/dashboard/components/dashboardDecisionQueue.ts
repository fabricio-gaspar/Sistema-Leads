import { PIPELINE_STAGE_LABEL, stageFromLegacy } from '@/domain/pipeline';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { buildSellerAttentionGroups, type AttentionGroup, type AttentionItem } from './sellerAttention';

export type DashboardDecisionItem = {
  id: string;
  leadId?: string;
  title: string;
  stage: string;
  group: string;
  detail: string;
  action: string;
  to: string;
};

type DecisionCandidate = {
  group: Pick<AttentionGroup, 'id' | 'title'>;
  item: AttentionItem;
};

const queueOrder = ['now', 'commercial', 'hot', 'follow-up', 'stale'] as const;

function handoffCandidate(lead: Lead): DecisionCandidate {
  return {
    group: { id: 'human', title: 'Atendimento humano' },
    item: {
      id: `handoff-${lead.id}`,
      leadId: lead.id,
      title: lead.empresa || lead.nome || 'Lead aguardando atendimento',
      detail: lead.motivoTransferencia || 'Lead transferido para uma pessoa da equipe.',
      action: 'Assumir atendimento',
      to: `/dashboard/atendimento?leadId=${lead.id}`,
    },
  };
}

/**
 * Junta os eventos comerciais abertos com handoffs que ainda não geraram notificação.
 * É uma seleção de apresentação: não cria notificações, tarefas ou mudanças no lead.
 */
export function buildDashboardDecisionQueue(
  notifications: Notificacao[],
  leads: Lead[],
  now = new Date(),
  limit = 5,
): DashboardDecisionItem[] {
  const groups = buildSellerAttentionGroups(notifications, leads, now);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const notificationLeadIds = new Set(
    groups.flatMap((group) => group.items.map((item) => item.leadId).filter((leadId): leadId is string => Boolean(leadId))),
  );
  const handoffs = leads
    .filter((lead) => (lead.modoAtendimento === 'HUMANO' || lead.automacaoStatus === 'AGUARDANDO_HUMANO') && !notificationLeadIds.has(lead.id))
    .map(handoffCandidate);

  const candidates: DecisionCandidate[] = [];
  for (const groupId of queueOrder) {
    const group = groupById.get(groupId);
    if (group) candidates.push(...group.items.map((item) => ({ group, item })));
    if (groupId === 'now') candidates.push(...handoffs);
  }

  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const seen = new Set<string>();
  return candidates.flatMap(({ group, item }) => {
    const identity = item.leadId || item.id;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const lead = item.leadId ? leadById.get(item.leadId) : undefined;
    return [{
      id: `${group.id}:${item.id}`,
      leadId: item.leadId,
      title: lead?.empresa || item.title || lead?.nome || 'Lead sem identificação',
      stage: lead ? PIPELINE_STAGE_LABEL[stageFromLegacy(lead.etapa)] : group.title,
      group: group.title,
      detail: item.detail,
      action: item.action,
      to: item.to,
    }];
  }).slice(0, limit);
}
