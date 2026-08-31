import { createBackendStore } from '@/lib/backendStore';
import { fontesLeads } from '@/mocks/fontesData';

export type FonteLead = typeof fontesLeads[number];

const STORAGE_KEY = 'leadai_fontes_v1';
const store = createBackendStore<FonteLead[]>('fontes', STORAGE_KEY, fontesLeads);

export interface FontesStore {
  fontes: FonteLead[];
  atualizar: (id: string, mudanca: Partial<FonteLead>) => void;
  adicionar: (fonte: FonteLead) => void;
  excluir: (id: string) => void;
}

export function fontesAtivas(fontes: FonteLead[]): FonteLead[] {
  return fontes.filter((fonte) => fonte.status === 'ativo');
}

export function normalizarMetricasPorFonte(fontes: FonteLead[]): FonteLead[] {
  const metricasPadrao = new Map(fontesLeads.map((fonte) => [fonte.id, fonte]));
  const repeticoes = new Map<string, number>();
  fontes.forEach((fonte) => {
    const chave = `${fonte.ultimaSincronizacao}|${fonte.leadsImportados}|${fonte.erros}`;
    repeticoes.set(chave, (repeticoes.get(chave) ?? 0) + 1);
  });

  return fontes.map((fonte) => {
    const chave = `${fonte.ultimaSincronizacao}|${fonte.leadsImportados}|${fonte.erros}`;
    const padrao = metricasPadrao.get(fonte.id);
    if (!padrao || (repeticoes.get(chave) ?? 0) < 2) return fonte;
    return { ...fonte, ultimaSincronizacao: padrao.ultimaSincronizacao, leadsImportados: padrao.leadsImportados, erros: padrao.erros, mapeamento: padrao.mapeamento };
  });
}

export function useFontesStore(): FontesStore {
  const fontes = normalizarMetricasPorFonte(store.useStore());

  const atualizar = (id: string, mudanca: Partial<FonteLead>) => {
    store.set((prev) => prev.map((f) => (f.id === id ? { ...f, ...mudanca } : f)));
  };

  const adicionar = (fonte: FonteLead) => {
    store.set((prev) => [...prev, fonte]);
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((f) => f.id !== id));
  };

  return { fontes, atualizar, adicionar, excluir };
}
