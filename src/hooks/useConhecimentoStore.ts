import type { EntradaConhecimento } from '@/mocks/conhecimentoData';
import { useCallback, useEffect, useState } from 'react';
import { createKnowledgeEntry, deleteKnowledgeEntry, loadKnowledgeEntries, updateKnowledgeEntry } from '@/lib/crm/knowledgeRepository';

export interface ConhecimentoStore {
  entradas: EntradaConhecimento[];
  carregando: boolean;
  erro: string | null;
  adicionar: (entrada: EntradaConhecimento) => Promise<void>;
  atualizar: (id: string, mudanca: Partial<EntradaConhecimento>) => Promise<void>;
  excluir: (id: string) => Promise<void>;
  alternarStatus: (id: string) => Promise<void>;
  recarregar: () => Promise<void>;
}

export function useConhecimentoStore(): ConhecimentoStore {
  const [entradas, setEntradas] = useState<EntradaConhecimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setEntradas(await loadKnowledgeEntries());
      setErro(null);
    } catch (error) {
      console.error('[ana-knowledge] falha ao carregar base aprovada', error);
      setErro('Não foi possível carregar a base aprovada da Ana.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const adicionar = async (entrada: EntradaConhecimento) => {
    const saved = await createKnowledgeEntry(entrada);
    setEntradas((previous) => [saved, ...previous]);
  };

  const atualizar = async (id: string, mudanca: Partial<EntradaConhecimento>) => {
    const saved = await updateKnowledgeEntry(id, mudanca);
    setEntradas((previous) => previous.map((entry) => entry.id === id ? saved : entry));
  };

  const excluir = async (id: string) => {
    await deleteKnowledgeEntry(id);
    setEntradas((previous) => previous.filter((entry) => entry.id !== id));
  };

  const alternarStatus = async (id: string) => {
    const entry = entradas.find((item) => item.id === id);
    if (!entry) return;
    await atualizar(id, { status: entry.status === 'ativo' ? 'rascunho' : 'ativo' });
  };

  return { entradas, carregando, erro, adicionar, atualizar, excluir, alternarStatus, recarregar };
}
