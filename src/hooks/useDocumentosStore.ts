import { createBackendStore } from '@/lib/backendStore';
import { documentos } from '@/mocks/businessData';
import type { Documento } from '@/mocks/businessData';

const STORAGE_KEY = 'leadai_documentos_v1';
const store = createBackendStore<Documento[]>('documentos', STORAGE_KEY, documentos);

export interface DocumentosStore {
  docs: Documento[];
  adicionar: (doc: Documento) => void;
  atualizar: (id: string, mudanca: Partial<Documento>) => void;
  excluir: (id: string) => void;
}

export function useDocumentosStore(): DocumentosStore {
  const docs = store.useStore();
  const setStore = store.bindSet();

  const adicionar = (doc: Documento) => setStore((prev) => [doc, ...prev]);
  const atualizar = (id: string, mudanca: Partial<Documento>) =>
    setStore((prev) => prev.map((d) => (d.id === id ? { ...d, ...mudanca } : d)));
  const excluir = (id: string) => setStore((prev) => prev.filter((d) => d.id !== id));

  return { docs, adicionar, atualizar, excluir };
}
