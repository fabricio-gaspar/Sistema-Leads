import type { createAdminClient } from './auth.ts';
import { automationBlockReason } from './runtimeSafety.ts';

type Row = Record<string, unknown>;
export interface AnaEffectExpectation {
  lead: Row; configurationVersionId: string; companyOperationEnabled: unknown; companyOperationMode: unknown;
  requiresApprovedContact: boolean; ownHandoff?: boolean;
}
export async function assertAnaEffectAllowed(admin: ReturnType<typeof createAdminClient>, organizationId: string, expected: AnaEffectExpectation): Promise<void> {
  const [leadRead, companyRead, aiRead, runtimeRead, agentRead] = await Promise.all([
    admin.from('leads').select('id,ai_paused,modo_atendimento,opt_out,contact_approval_status,owner_id,assigned_to,active_channel,whatsapp_account_id,last_contact,ana_stage,ana_outcome,updated_at').eq('organization_id', organizationId).eq('id', expected.lead.id).maybeSingle(),
    admin.from('company_settings').select('active,sandbox_mode,can_use_ia,ai_actions_enabled,ana_operation_enabled,ana_operation_mode').eq('organization_id', organizationId).maybeSingle(),
    admin.from('integrations').select('connected,enabled,paused').eq('organization_id', organizationId).eq('key', 'ai').maybeSingle(),
    admin.from('organization_module_data').select('data').eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle(),
    admin.from('ai_agents').select('active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle(),
  ]);
  if ([leadRead, companyRead, aiRead, runtimeRead, agentRead].some((read) => read.error) || !leadRead.data) throw new Error('ana_effect_context_read_failed');
  const lead = leadRead.data as Row;
  const changed = ['ai_paused', 'modo_atendimento', 'opt_out', 'owner_id', 'assigned_to', 'active_channel', 'whatsapp_account_id', 'last_contact', 'ana_stage', 'ana_outcome', 'updated_at']
    .some((key) => (lead[key] ?? null) !== (expected.lead[key] ?? null));
  if (changed) throw new Error('lead_changed_during_decision');
  const blocked = automationBlockReason({ company: companyRead.data, ai: aiRead.data, runtime: runtimeRead.data?.data ?? null,
    lead: expected.ownHandoff ? { ...lead, ai_paused: false, modo_atendimento: 'ia' } : lead,
    requiresApprovedContact: expected.requiresApprovedContact });
  if (blocked) throw new Error(`ana_effect_blocked:${blocked}`);
  if (companyRead.data?.ana_operation_enabled === false) throw new Error('ana_effect_blocked:ana_operation_disabled');
  if ((companyRead.data?.ana_operation_enabled ?? null) !== (expected.companyOperationEnabled ?? null)
    || (companyRead.data?.ana_operation_mode ?? null) !== (expected.companyOperationMode ?? null)
    || (agentRead.data?.active_version_id ?? '') !== expected.configurationVersionId) throw new Error('ana_configuration_changed_during_decision');
}
