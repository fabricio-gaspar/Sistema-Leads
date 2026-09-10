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

export async function persistOperationalLeads(previous: Lead[], next: Lead[]): Promise<Lead[]> {
  const session = await resolveOrganizationSession();
  const previousById = new Map(previous.map((lead) => [lead.id, lead]));
  const nextWithPersistentIds = next.map((lead) => ({ ...lead, id: persistentLeadId(lead.id) }));
  for (const lead of nextWithPersistentIds) {
    const previousLead = previousById.get(lead.id);
    const row = leadToCrmRow(lead, session.organizationId);
    if (previousLead) {
      const patch = changedOperationalLeadFields(previousLead, lead, session.organizationId);
      if (!Object.keys(patch).length) continue;
      const { error } = await supabase.from('leads').update(patch)
        .eq('id', lead.id).eq('organization_id', session.organizationId);
      if (error) throw error;
      continue;
    }
    const request = supabase.from('leads').insert(row);
    const { error } = await request;
    if (error) throw error;
  }

  // A remoção da tela não apaga o lead do banco. O arquivamento comercial
  // será controlado pela oportunidade, preservando histórico e consentimento.

  return nextWithPersistentIds;
}
