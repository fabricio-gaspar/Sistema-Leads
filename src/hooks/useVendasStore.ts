import { useEffect, useSyncExternalStore } from 'react';
import { acceptProposalAndCreateSale, archiveOperationalSale, loadOperationalSales, updateOperationalSale } from '@/lib/crm/salesRepository';
import type { Proposta, Venda } from '@/mocks/propostasData';

let state: Venda[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const getSnapshot = () => state;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = loadOperationalSales()
    .then((sales) => { state = sales; hydrated = true; notify(); })
    .catch((error) => console.error('[crm-sales] falha ao carregar fonte operacional', error))
    .finally(() => { hydratePromise = null; });
  return hydratePromise;
}

export interface VendasStore {
  vendas: Venda[];
  // Registra uma venda vinculada a uma proposta aceita, evitando duplicidade.
  registrarDaProposta: (proposta: Proposta) => Promise<Venda>;
  // Alterna entre pendente e pago (simula recebimento, refletido na receita).
  alternarRecebimento: (id: string) => Promise<void>;
  // Atualiza campos editáveis de uma venda (método, status, comprovante...).
  atualizar: (id: string, mudanca: Partial<Venda>) => Promise<void>;
  excluir: (id: string) => Promise<void>;
}

export function useVendasStore(): VendasStore {
  const vendas = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void hydrate(); }, []);

  const registrarDaProposta: VendasStore['registrarDaProposta'] = async (proposta) => {
    const nova = await acceptProposalAndCreateSale(proposta);
    state = [nova, ...state.filter((sale) => sale.id !== nova.id)];
    notify();
    return nova;
  };

  const alternarRecebimento = async (id: string) => {
    const current = state.find((sale) => sale.id === id);
    if (!current) return;
    const updated = await updateOperationalSale({ ...current, status: current.status === 'pendente' ? 'pago' : 'pendente' });
    state = state.map((sale) => (sale.id === id ? updated : sale));
    notify();
  };

  const atualizar: VendasStore['atualizar'] = async (id, mudanca) => {
    const current = state.find((sale) => sale.id === id);
    if (!current) return;
    writeQueue = writeQueue.then(async () => {
      const updated = await updateOperationalSale({ ...current, ...mudanca });
      state = state.map((sale) => (sale.id === id ? updated : sale));
      notify();
    });
    return writeQueue;
  };

  const excluir = async (id: string) => {
    writeQueue = writeQueue.then(async () => {
      await archiveOperationalSale(id);
      state = state.filter((sale) => sale.id !== id);
      notify();
    });
    return writeQueue;
  };

  return { vendas, registrarDaProposta, alternarRecebimento, atualizar, excluir };
}

// Acesso imperativo (para orquestradores/handlers sem hook).
export function getVendasSnapshot(): Venda[] {
  return state;
}
