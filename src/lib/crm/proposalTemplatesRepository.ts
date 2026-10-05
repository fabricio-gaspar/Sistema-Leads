import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession, assertOrganizationSession } from '@/lib/organizationSession';
import type { TemplateProposta } from '@/hooks/useTemplatesPropostaStore';

const MODULE_KEY = 'proposal_templates';

function isTemplate(value: unknown): value is TemplateProposta {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TemplateProposta>;
  return typeof candidate.id === 'string'
    && typeof candidate.nome === 'string'
    && typeof candidate.descricao === 'string'
    && typeof candidate.validadePadraoDias === 'number'
    && typeof candidate.formaPagamento === 'string'
    && typeof candidate.garantia === 'string'
    && typeof candidate.termos === 'string'
    && Array.isArray(candidate.blocos)
    && typeof candidate.ativo === 'boolean'
    && typeof candidate.padrao === 'boolean';
}

export async function loadProposalTemplates(): Promise<TemplateProposta[] | null> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const { data, error } = await supabase
    .from('organization_module_data')
    .select('data')
    .eq('organization_id', session.organizationId)
    .eq('module_key', MODULE_KEY)
    .maybeSingle();

  if (error) throw new Error(`proposal_templates_load_failed:${error.message}`);
  if (!data?.data) return null;
  if (!Array.isArray(data.data) || !data.data.every(isTemplate)) {
    throw new Error('proposal_templates_invalid_payload');
  }
  return data.data;
}

export async function saveProposalTemplates(templates: TemplateProposta[]): Promise<void> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const { error } = await supabase
    .from('organization_module_data')
    .upsert({
      organization_id: session.organizationId,
      module_key: MODULE_KEY,
      data: templates,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,module_key' });

  if (error) throw new Error(`proposal_templates_save_failed:${error.message}`);
}
