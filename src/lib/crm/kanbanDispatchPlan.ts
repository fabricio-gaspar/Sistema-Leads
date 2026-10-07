import type { Lead } from '@/mocks/leadsData';

export interface KanbanDispatchPlan {
  anaLeadIds: string[];
  humanLeadIds: string[];
  /** Same record is already eligible for the Kanban portfolio; do not write it again. */
  alreadyInKanbanLeadIds: string[];
  /** Ana records missing only the technical routing user required by the Kanban RPC. */
  needsRoutingLeadIds: string[];
  unresolvedLeadIds: string[];
}

/**
 * The Kanban portfolio is a view of `leads`, not a second lead/card store.
 * It requires the imported service mode and a technical routing user. This
 * plan keeps the import classification as the source of truth and identifies
 * the single direct update needed for an Ana lead that has not been routed.
 */
export function buildKanbanDispatchPlan(leads: Pick<Lead, 'id' | 'modoAtendimento' | 'responsavelId'>[], leadIds: string[]): KanbanDispatchPlan {
  const targetIds = new Set(leadIds);
  const plan: KanbanDispatchPlan = {
    anaLeadIds: [],
    humanLeadIds: [],
    alreadyInKanbanLeadIds: [],
    needsRoutingLeadIds: [],
    unresolvedLeadIds: [],
  };

  for (const lead of leads) {
    if (!targetIds.has(lead.id)) continue;
    if (lead.modoAtendimento === 'IA') {
      plan.anaLeadIds.push(lead.id);
      if (lead.responsavelId) plan.alreadyInKanbanLeadIds.push(lead.id);
      else plan.needsRoutingLeadIds.push(lead.id);
    } else if (lead.modoAtendimento === 'HUMANO') {
      plan.humanLeadIds.push(lead.id);
      if (lead.responsavelId) plan.alreadyInKanbanLeadIds.push(lead.id);
      else plan.unresolvedLeadIds.push(lead.id);
    } else {
      plan.unresolvedLeadIds.push(lead.id);
    }
  }

  return plan;
}

/**
 * The persisted routing user is the sole field changed while sending an Ana
 * lead to the portfolio. All prospecting data and its scores stay untouched.
 */
export function assignKanbanRoutingUser(lead: Lead, userId: string): Lead {
  return { ...lead, responsavelId: userId };
}
