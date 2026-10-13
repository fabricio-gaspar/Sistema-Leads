import type { ConfiguracaoRuntime, ProvedorWhatsapp } from '@/lib/tipos';

export const OPERATIONAL_CONFIG_MODULE_KEY = 'configuracao_runtime' as const;

/**
 * The organization runtime document is the only source of operational
 * switches. Old browser/default values cannot select a retired WhatsApp
 * transport; they are normalized before any transport decision is made.
 */
export function normalizeOperationalConfig(config: ConfiguracaoRuntime): ConfiguracaoRuntime {
  const provider: ProvedorWhatsapp = config.provedorWhatsapp === 'wa_akg' ? config.provedorWhatsapp : 'wa_akg';
  return provider === config.provedorWhatsapp ? config : { ...config, provedorWhatsapp: provider };
}
