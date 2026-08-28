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
}

export async function saveAnaPersonalization(configuration: AnaPersonalization): Promise<void> {
  const { data, error } = await supabase.functions.invoke('ana-ia', {
    body: { acao: 'salvar_configuracao', configuracao: configuration },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro ?? 'ana_configuration_not_saved');
}
