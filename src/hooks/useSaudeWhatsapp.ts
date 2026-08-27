import { useEnvioLogStore } from '@/hooks/useEnvioLogStore';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';

export type NivelRisco = 'seguro' | 'atencao' | 'critico';

export interface SaudeWhatsapp {
  totalEnvios: number;
  optOuts: number;
  semResposta: number;
  taxaOptOut: number;
  taxaSemResposta: number;
  risco: number;
  limite: number;
  nivel: NivelRisco;
}

// Medidor de "saúde" do WhatsApp. A Meta não expõe a taxa de bloqueio em tempo
// real via webhook — ela aparece só no painel de qualidade do Business. Então
// estimamos o risco com os sinais que o próprio sistema consegue observar:
// opt-outs (o sinal mais forte de pré-bloqueio) e falta de engajamento.
export function useSaudeWhatsapp(): SaudeWhatsapp {
  const { registros } = useEnvioLogStore();
  const [leads] = useLeadsStore();
  const { config } = useConfiguracaoStore();

  const totalEnvios = registros.length;
  const optOuts = leads.filter((l) => l.bloqueado).length;
  const semResposta = leads.filter(
    (l) => (l.followUpCount ?? 0) > 0 && ['Aguardando Resposta'].includes(l.etapa)
  ).length;

  const taxaOptOut = totalEnvios > 0 ? (optOuts / totalEnvios) * 100 : 0;
  const taxaSemResposta = totalEnvios > 0 ? (semResposta / totalEnvios) * 100 : 0;

  const risco = Math.round(Math.min(100, Math.max(0, taxaOptOut * 0.7 + taxaSemResposta * 0.3)));

  const limite = config.alertaRiscoBloqueio ?? 70;
  const nivel: NivelRisco = risco >= limite ? 'critico' : risco >= limite * 0.7 ? 'atencao' : 'seguro';

  return { totalEnvios, optOuts, semResposta, taxaOptOut, taxaSemResposta, risco, limite, nivel };
}