import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { EmpresaSettings, Organizacao } from '@/hooks/useEmpresaSettingsStore';

interface OrganizationSettingsRow {
  organization_id: string;
  business_profile: Record<string, unknown>;
  commercial_rules: Record<string, unknown>;
  ai_configuration: Record<string, unknown>;
}

export function organizationSettingsToEmpresaSettings(row: OrganizationSettingsRow, fallback: EmpresaSettings): EmpresaSettings {
  return {
    ...fallback,
    ...row.business_profile,
    ...row.commercial_rules,
    ...row.ai_configuration,
    organizacao: {
      ...fallback.organizacao,
      ...(row.business_profile.organizacao as Partial<Organizacao> | undefined),
    },
  };
}

export async function loadOperationalCompanySettings(fallback: EmpresaSettings): Promise<EmpresaSettings> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('organization_settings')
    .select('organization_id, business_profile, commercial_rules, ai_configuration')
    .eq('organization_id', session.organizationId)
    .maybeSingle();
  if (error) throw error;
  return data ? organizationSettingsToEmpresaSettings(data as OrganizationSettingsRow, fallback) : fallback;
}

export async function persistOperationalCompanySettings(settings: EmpresaSettings): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase
    .from('organization_settings')
    .update({
      business_profile: {
        organizacao: settings.organizacao,
        ramo: settings.ramo,
        regiao: settings.regiao,
        publico: settings.publico,
        diferenciais: settings.diferenciais,
      },
      commercial_rules: {
        regras: settings.regras,
        horario: settings.horario,
        limiteMensagens: settings.limiteMensagens,
        consentimento: settings.consentimento,
      },
      ai_configuration: {
        saudacao: settings.saudacao,
        corBalao: settings.corBalao,
        assinatura: settings.assinatura,
        handoff: settings.handoff,
      },
      updated_by: session.userId,
    })
    .eq('organization_id', session.organizationId);
  if (error) throw error;
}
