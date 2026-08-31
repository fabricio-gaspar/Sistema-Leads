import type { PreviewLead } from '@/mocks/enriquecimentoData';

export interface BuscaManualFiltros {
  fonte: string;
  estado: string;
  cidade: string;
  cargo: string;
  exigeSite: boolean | null;
  exigeWhatsApp: boolean | null;
  exigeEmail: boolean | null;
  volumeMaximo: number;
}

export function limitarBuscaManual(leads: PreviewLead[], filtros: BuscaManualFiltros): PreviewLead[] {
  const limite = Math.max(1, Math.min(500, Math.floor(filtros.volumeMaximo || 1)));
  const cidade = filtros.cidade.trim().toLocaleLowerCase('pt-BR');

  return leads
    .filter((lead) => lead.fonte === filtros.fonte)
    .filter((lead) => !filtros.estado || lead.localidade.endsWith(` - ${filtros.estado}`))
    .filter((lead) => !cidade || lead.localidade.toLocaleLowerCase('pt-BR').includes(cidade))
    .filter((lead) => !filtros.cargo || lead.cargo === filtros.cargo)
    .filter((lead) => filtros.exigeSite !== true || lead.canais.site)
    .filter((lead) => filtros.exigeWhatsApp !== true || lead.canais.whatsapp)
    .filter((lead) => filtros.exigeEmail !== true || lead.canais.email)
    .slice(0, limite);
}
