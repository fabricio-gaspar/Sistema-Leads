export type NivelRisco = 'sem_dados' | 'seguro' | 'atencao' | 'alto' | 'critico';

export interface HealthSample {
  sampled_at: string;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  opt_out_count: number;
  complaint_count: number;
  quality_rating: string | null;
  source: string;
}

export interface PolicyEvent { risk_level: 'normal' | 'attention' | 'high' | 'critical'; action: string; created_at: string; resolved_at: string | null; }

export function evaluateWhatsappRisk(samples: HealthSample[], events: PolicyEvent[], now = new Date()): {
  totalEnvios: number; optOuts: number; semResposta: number; taxaOptOut: number; taxaSemResposta: number; risco: number; nivel: NivelRisco; atualizadoEm?: string; fonte?: string;
} {
  const latest = samples[0];
  if (!latest) return { totalEnvios: 0, optOuts: 0, semResposta: 0, taxaOptOut: 0, taxaSemResposta: 0, risco: 0, nivel: 'sem_dados' };
  const totalEnvios = Math.max(0, latest.sent_count);
  const optOuts = Math.max(0, latest.opt_out_count + latest.complaint_count);
  const semResposta = Math.max(0, totalEnvios - latest.delivered_count);
  const taxaOptOut = totalEnvios ? (optOuts / totalEnvios) * 100 : 0;
  const taxaSemResposta = totalEnvios ? (semResposta / totalEnvios) * 100 : 0;
  const active = events.find((event) => !event.resolved_at);
  const stale = now.getTime() - new Date(latest.sampled_at).getTime() > 6 * 60 * 60 * 1000;
  const rawRisk = Math.min(100, Math.round(taxaOptOut * 8 + taxaSemResposta * 0.35 + (latest.quality_rating === 'low' ? 30 : 0) + (stale ? 10 : 0)));
  const fromPolicy: Record<PolicyEvent['risk_level'], NivelRisco> = { normal: 'seguro', attention: 'atencao', high: 'alto', critical: 'critico' };
  const nivel = active ? fromPolicy[active.risk_level] : rawRisk >= 80 ? 'critico' : rawRisk >= 60 ? 'alto' : rawRisk >= 30 ? 'atencao' : 'seguro';
  return { totalEnvios, optOuts, semResposta, taxaOptOut, taxaSemResposta, risco: rawRisk, nivel, atualizadoEm: latest.sampled_at, fonte: latest.source };
}
