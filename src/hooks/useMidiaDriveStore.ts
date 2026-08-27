import { createBackendStore } from '@/lib/backendStore';
import { pastas, arquivos } from '@/mocks/midiaData';
import type { Pasta, Arquivo } from '@/mocks/midiaData';

export interface MidiaDriveState {
  pastas: Pasta[];
  arquivos: Arquivo[];
}

const STORAGE_KEY = 'leadai_midia_drive_v1';
const store = createBackendStore<MidiaDriveState>('midia_drive', STORAGE_KEY, { pastas, arquivos });

export interface MidiaDriveStore {
  pastas: Pasta[];
  arquivos: Arquivo[];
  adicionarArquivo: (arquivo: Arquivo) => void;
  adicionarPasta: (pasta: Pasta) => void;
  renomearArquivo: (id: string, nome: string) => void;
  renomearPasta: (id: string, nome: string) => void;
  excluirArquivo: (id: string) => void;
  excluirPasta: (id: string) => void;
}

export function useMidiaDriveStore(): MidiaDriveStore {
  const state = store.useStore();

  const adicionarArquivo = (arquivo: Arquivo) =>
    store.set((prev) => ({ ...prev, arquivos: [arquivo, ...prev.arquivos] }));

  const adicionarPasta = (pasta: Pasta) =>
    store.set((prev) => ({ ...prev, pastas: [...prev.pastas, pasta] }));

  const renomearArquivo = (id: string, nome: string) =>
    store.set((prev) => ({
      ...prev,
      arquivos: prev.arquivos.map((a) => (a.id === id ? { ...a, nome } : a)),
    }));

  const renomearPasta = (id: string, nome: string) =>
    store.set((prev) => ({
      ...prev,
      pastas: prev.pastas.map((p) => (p.id === id ? { ...p, nome } : p)),
      // Atualiza também a referência de pasta nos arquivos.
      arquivos: prev.arquivos.map((a) => {
        const pastaAntiga = prev.pastas.find((p) => p.id === id)?.nome;
        return a.pasta === pastaAntiga ? { ...a, pasta: nome } : a;
      }),
    }));

  const excluirArquivo = (id: string) =>
    store.set((prev) => ({ ...prev, arquivos: prev.arquivos.filter((a) => a.id !== id) }));

  const excluirPasta = (id: string) =>
    store.set((prev) => {
      const pasta = prev.pastas.find((p) => p.id === id);
      return {
        pastas: prev.pastas.filter((p) => p.id !== id),
        arquivos: prev.arquivos.filter((a) => a.pasta !== pasta?.nome),
      };
    });

  return {
    pastas: state.pastas,
    arquivos: state.arquivos,
    adicionarArquivo,
    adicionarPasta,
    renomearArquivo,
    renomearPasta,
    excluirArquivo,
    excluirPasta,
  };
}