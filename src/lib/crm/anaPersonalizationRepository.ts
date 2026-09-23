import { supabase } from '@/lib/supabase';

export interface AnaPersonalization {
  business: string;
  audience: string;
  greeting: string;
  signature: string;
  dailyMessageLimit: number;
  valueProposition: string[];
  qualificationQuestions: string[];
  handoffTriggers: string[];
  tone?: 'consultivo' | 'direto' | 'acolhedor' | 'tecnico';
  approvedKnowledge?: string[];
  quotePolicy?: {
    requireHumanApproval: boolean;
    neverInventPrices: boolean;
    discountLimit: number;
  };
  cadencePolicy?: {
    firstFollowUpHours: number;
    secondFollowUpHours: number;
    timeoutHours: number;
    businessHoursOnly: boolean;
  };
  handoffPolicy?: {
    requireSummary: boolean;
    pauseAnaUntilReturn: boolean;
    lowConfidenceThreshold: number;
  };
  allowedChannels?: string[];
  /**
   * Opt-in only. When false, Ana remains text-only even when an approved
   * catalog item has an image.
   */
  catalogMediaImagesEnabled?: boolean;
  riskPolicy?: {
    requireConsent: boolean;
    stopOnOptOut: boolean;
    pauseOnHighRisk: boolean;
  };
}

export interface AnaPersonalizationSnapshot {
  configuration: AnaPersonalization | null;
  version: { id: string; number: number; publishedAt: string | null } | null;
}

export interface AnaPersonalizationPublishResult {
  version: { id: string; number: number; publishedAt: string | null };
}

export async function loadAnaPersonalization(): Promise<AnaPersonalizationSnapshot> {
  const { data, error } = await supabase.functions.invoke('ana-ia', {
    body: { acao: 'obter_configuracao' },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro ?? 'ana_configuration_not_loaded');
  return {
    configuration: data.configuration && typeof data.configuration === 'object'
      ? data.configuration as AnaPersonalization
      : null,
    version: data.version && typeof data.version.id === 'string' && typeof data.version.number === 'number'
      ? { id: data.version.id, number: data.version.number, publishedAt: typeof data.version.publishedAt === 'string' ? data.version.publishedAt : null }
      : null,
  };
}

export async function saveAnaPersonalization(configuration: AnaPersonalization): Promise<AnaPersonalizationPublishResult> {
  const { data, error } = await supabase.functions.invoke('ana-ia', {
    body: { acao: 'salvar_configuracao', configuracao: configuration },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro ?? 'ana_configuration_not_saved');
  if (typeof data.version?.id !== 'string' || typeof data.version?.number !== 'number') {
    throw new Error('ana_configuration_version_not_confirmed');
  }
  return {
    version: {
      id: data.version.id,
      number: data.version.number,
      publishedAt: typeof data.version.publishedAt === 'string' ? data.version.publishedAt : null,
    },
  };
}
