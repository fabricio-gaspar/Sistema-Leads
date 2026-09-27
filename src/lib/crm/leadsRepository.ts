import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { crmRowToLead, leadToCrmRow, persistentLeadId, type CrmLeadRow, type LeadHandoffPolicyRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';
import { readAllPages } from './paginatedRead';

export async function loadOperationalLeads(organizationId?: string): Promise<Lead[]> {
  const resolvedId = organizationId ?? (await resolveOrganizationSession()).organizationId;
  const rows = await readAllPages<CrmLeadRow>((from, to) => supabase
    .from('leads')
    .select('*')
    .eq('organization_id', resolvedId)
    .order('id').range(from, to));
  const ids = rows.map((lead) => lead.id).filter((id): id is string => Boolean(id));
  const policyByLead = new Map<string, LeadHandoffPolicyRow>();
  for (let index = 0; index < ids.length; index += 100) {
    const policies = await readAllPages<LeadHandoffPolicyRow>((from, to) => supabase.from('lead_handoff_policies').select('lead_id,handoff_stage,assignee_user_id,notify_whatsapp').in('lead_id', ids.slice(index, index + 100)).order('lead_id').range(from, to));
    for (const policy of policies) policyByLead.set(policy.lead_id, policy);
  }
  return rows.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).map((lead) => crmRowToLead(lead, policyByLead.get(lead.id)));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

export function changedOperationalLeadFields(previous: Lead, next: Lead, organizationId: string): Record<string, unknown> {
  const before = leadToCrmRow(previous, organizationId) as Record<string, unknown>;
  const after = leadToCrmRow(next, organizationId) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(after).filter(([key, value]) =>
    !['id', 'organization_id'].includes(key) && !sameValue(before[key], value)
  ));
}

export function assertLeadUpdatePersisted(data: { id: string } | null, leadId: string): void {
  if (!data || data.id !== leadId) {
    throw new Error('lead_update_not_persisted');
  }
}

export async function persistOperationalLeads(previous: Lead[], next: Lead[]): Promise<Lead[]> {
  const session = await resolveOrganizationSession();
  const previousById = new Map(previous.map((lead) => [lead.id, lead]));
  const nextWithPersistentIds = next.map((lead) => ({ ...lead, id: persistentLeadId(lead.id) }));
  for (const lead of nextWithPersistentIds) {
    const previousLead = previousById.get(lead.id);
    const row = leadToCrmRow(lead, session.organizationId);
    if (previousLead) {
      const patch = changedOperationalLeadFields(previousLead, lead, session.organizationId);
      if (previousLead.arquivado !== lead.arquivado) {
        patch.archived_at = lead.arquivado ? new Date().toISOString() : null;
        patch.archived_by = lead.arquivado ? session.userId : null;
      }
      if (previousLead.contactApprovalStatus !== 'approved' && lead.contactApprovalStatus === 'approved') {
        patch.contact_approved_by = session.userId;
        patch.contact_approved_at = lead.contactApprovedAt || new Date().toISOString();
      }
      if (!Object.keys(patch).length) continue;
      const { data, error } = await supabase.from('leads').update(patch)
        .eq('id', lead.id).eq('organization_id', session.organizationId)
        .select('id').maybeSingle();
      if (error) throw error;
      assertLeadUpdatePersisted(data, lead.id);
      continue;
    }
    if (row.contact_approval_status === 'approved') {
      row.contact_approved_by = session.userId;
      row.contact_approved_at = row.contact_approved_at || new Date().toISOString();
    }
    const request = supabase.from('leads').insert(row);
    const { error } = await request;
    if (error) throw error;
  }

  // A remoção da tela não apaga o lead do banco. O arquivamento comercial
  // será controlado pela oportunidade, preservando histórico e consentimento.

  return nextWithPersistentIds;
}
