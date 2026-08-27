import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { crmRowToLead, leadToCrmRow, persistentLeadId, type CrmLeadRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

export async function loadOperationalLeads(): Promise<Lead[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('organization_id', session.organizationId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CrmLeadRow[]).map(crmRowToLead);
}

export async function persistOperationalLeads(previous: Lead[], next: Lead[]): Promise<Lead[]> {
  const session = await resolveOrganizationSession();
  const previousById = new Map(previous.map((lead) => [lead.id, lead]));
  const nextWithPersistentIds = next.map((lead) => ({ ...lead, id: persistentLeadId(lead.id) }));
  const nextIds = new Set(nextWithPersistentIds.map((lead) => lead.id));

  for (const lead of nextWithPersistentIds) {
    const row = leadToCrmRow(lead, session.organizationId, session.userId);
    const wasPersisted = previousById.has(lead.id);
    const request = wasPersisted
      ? supabase.from('crm_leads').update(row).eq('id', lead.id).eq('organization_id', session.organizationId)
      : supabase.from('crm_leads').insert(row);
    const { error } = await request;
    if (error) throw error;
  }

  const archivedIds = previous
    .filter((lead) => !nextIds.has(lead.id) && lead.id.length === 36)
    .map((lead) => lead.id);
  if (archivedIds.length > 0) {
    const { error } = await supabase
      .from('crm_leads')
      .update({ is_archived: true })
      .eq('organization_id', session.organizationId)
      .in('id', archivedIds);
    if (error) throw error;
  }

  return nextWithPersistentIds;
}
