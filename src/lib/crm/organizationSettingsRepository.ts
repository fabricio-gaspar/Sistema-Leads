import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { EmpresaSettings, Organizacao } from '@/hooks/useEmpresaSettingsStore';

interface OrganizationSettingsRow {
  organization_id: string;
  ui_settings: Partial<EmpresaSettings>;
}

export function organizationSettingsToEmpresaSettings(row: OrganizationSettingsRow, fallback: EmpresaSettings): EmpresaSettings {
  return {
    ...fallback,
    ...row.ui_settings,
    organizacao: {
      ...fallback.organizacao,
      ...(row.ui_settings.organizacao as Partial<Organizacao> | undefined),
    },
  };
}

export async function loadOperationalCompanySettings(fallback: EmpresaSettings): Promise<EmpresaSettings> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('company_settings')
    .select('organization_id, ui_settings')
    .eq('organization_id', session.organizationId)
    .maybeSingle();
  if (error) throw error;
  return data ? organizationSettingsToEmpresaSettings(data as OrganizationSettingsRow, fallback) : fallback;
}

export async function persistOperationalCompanySettings(settings: EmpresaSettings): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase
    .from('company_settings')
    .upsert({
      organization_id: session.organizationId,
      ui_settings: settings,
      name: settings.organizacao.nomeComercial || settings.organizacao.nome,
      description: settings.ramo,
      tone_of_voice: settings.saudacao,
      differentiators: settings.diferenciais.join('\n'),
      cnpj: settings.organizacao.cnpj || null,
      segment: settings.ramo,
      city: settings.organizacao.endereco,
      website: settings.organizacao.site,
      address: settings.organizacao.endereco,
      phone: settings.organizacao.telefone,
      email: settings.organizacao.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });
  if (error) throw error;
}
