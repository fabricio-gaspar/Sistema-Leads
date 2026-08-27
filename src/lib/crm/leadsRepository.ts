import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { crmRowToLead, leadToCrmRow, persistentLeadId, type CrmLeadRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

export async function loadOperationalLeads(): Promise<Lead[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', session.organizationId)
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
    const row = leadToCrmRow(lead, session.organizationId);
    const wasPersisted = previousById.has(lead.id);
    const request = wasPersisted
      ? supabase.from('leads').update(row).eq('id', lead.id).eq('organization_id', session.organizationId)
      : supabase.from('leads').insert(row);
    const { error } = await request;
    if (error) throw error;
  }

  // A remoção da tela não apaga o lead do banco. O arquivamento comercial
  // será controlado pela oportunidade, preservando histórico e consentimento.

  return nextWithPersistentIds;
}
