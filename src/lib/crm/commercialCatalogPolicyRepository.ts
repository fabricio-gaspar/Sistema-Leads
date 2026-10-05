import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';

export interface CommercialCatalogPolicy {
  catalogEnabled: boolean;
  productsForAna: boolean;
  servicesForAna: boolean;
  draftEnabled: boolean;
  automaticSendEnabled: boolean;
  approvedPriceTable: boolean;
  discountApprovalRequired: boolean;
  includeValidityAndConditions: boolean;
  defaultTemplateId: string | null;
  updatedAt: string | null;
}

const MODULE_KEY = 'commercial_catalog_policy';

export const defaultCommercialCatalogPolicy: CommercialCatalogPolicy = {
  catalogEnabled: true,
  productsForAna: true,
  servicesForAna: true,
  draftEnabled: true,
  automaticSendEnabled: false,
  approvedPriceTable: true,
  discountApprovalRequired: true,
  includeValidityAndConditions: true,
  defaultTemplateId: null,
  updatedAt: null,
};

function asPolicy(value: unknown): CommercialCatalogPolicy {
  const candidate = value && typeof value === 'object' ? value as Partial<CommercialCatalogPolicy> : {};
  return {
    ...defaultCommercialCatalogPolicy,
    ...candidate,
    defaultTemplateId: typeof candidate.defaultTemplateId === 'string' ? candidate.defaultTemplateId : null,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
  };
}

export async function loadCommercialCatalogPolicy(): Promise<CommercialCatalogPolicy> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('organization_module_data').select('data,updated_at')
    .eq('organization_id', session.organizationId).eq('module_key', MODULE_KEY).maybeSingle();
  if (error) throw error;
  return asPolicy({ ...(data?.data as Record<string, unknown> || {}), updatedAt: data?.updated_at || null });
}

export async function saveCommercialCatalogPolicy(policy: CommercialCatalogPolicy, reason = 'Atualização da política comercial'): Promise<CommercialCatalogPolicy> {
  const session = await resolveOrganizationSession();
  const updatedAt = new Date().toISOString();
  const next = { ...asPolicy(policy), updatedAt };
  const { error } = await supabase.from('organization_module_data').upsert({
    organization_id: session.organizationId,
    module_key: MODULE_KEY,
    data: next,
    updated_by: session.userId,
    updated_at: updatedAt,
  }, { onConflict: 'organization_id,module_key' });
  if (error) throw error;
  await supabase.from('audit_logs').insert({
    organization_id: session.organizationId,
    actor_id: session.userId,
    actor_type: 'user',
    action: 'commercial.policy_updated',
    detail: reason,
    entity_table: 'organization_module_data',
    entity_id: session.organizationId,
    event_data: next,
  });
  return next;
}

export async function loadCommercialCatalogPolicyAudit(limit = 20): Promise<Array<{ id: string; action: string; detail: string | null; createdAt: string; actorName: string | null; eventData: Record<string, unknown> }>> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('audit_logs').select('id,action,detail,created_at,actor_name,event_data')
    .eq('organization_id', session.organizationId).in('action', ['commercial.policy_updated', 'commercial.template_default_changed'])
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), action: String(row.action), detail: typeof row.detail === 'string' ? row.detail : null, createdAt: String(row.created_at), actorName: typeof row.actor_name === 'string' ? row.actor_name : null, eventData: row.event_data && typeof row.event_data === 'object' ? row.event_data as Record<string, unknown> : {} }));
}
