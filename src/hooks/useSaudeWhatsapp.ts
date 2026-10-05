import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { evaluateWhatsappRisk, type HealthSample, type NivelRisco, type PolicyEvent } from '@/lib/whatsappRisk';

export type { NivelRisco };
export interface SaudeWhatsapp {
  totalEnvios: number; optOuts: number; semResposta: number; taxaOptOut: number; taxaSemResposta: number;
  risco: number; limite: number; nivel: NivelRisco; atualizadoEm?: string; fonte?: string; carregando: boolean;
}

const empty: SaudeWhatsapp = { totalEnvios: 0, optOuts: 0, semResposta: 0, taxaOptOut: 0, taxaSemResposta: 0, risco: 0, limite: 70, nivel: 'sem_dados', carregando: true };

// A Meta não fornece uma previsão de bloqueio. O painel apresenta apenas
// telemetria recebida do provedor e decisões auditáveis do servidor.
export function useSaudeWhatsapp(): SaudeWhatsapp {
  const [state, setState] = useState<SaudeWhatsapp>(empty);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await resolveOrganizationSession();
        const [samplesResult, eventsResult] = await Promise.all([
          supabase.from('channel_health_samples').select('sampled_at, sent_count, delivered_count, failed_count, opt_out_count, complaint_count, quality_rating, source')
            .eq('organization_id', session.organizationId).eq('channel', 'whatsapp').order('sampled_at', { ascending: false }).limit(1),
          supabase.from('channel_policy_events').select('risk_level, action, created_at, resolved_at')
            .eq('organization_id', session.organizationId).eq('channel', 'whatsapp').order('created_at', { ascending: false }).limit(10),
        ]);
        if (samplesResult.error) throw samplesResult.error;
        if (eventsResult.error) throw eventsResult.error;
        const result = evaluateWhatsappRisk((samplesResult.data ?? []) as HealthSample[], (eventsResult.data ?? []) as PolicyEvent[]);
        if (active) setState({ ...result, limite: 70, carregando: false });
      } catch {
        if (active) setState({ ...empty, carregando: false });
      }
    })();
    return () => { active = false; };
  }, []);
  return state;
}
