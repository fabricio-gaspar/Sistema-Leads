import { createBackendStore } from '@/lib/backendStore';
import { supressao as supressaoInicial } from '@/mocks/businessData';
import type { Supressao } from '@/mocks/businessData';

const STORAGE_KEY = 'leadai_supressao_v1';

// Singleton persistente no Backend (com cache local síncrono).
const store = createBackendStore<Supressao[]>('supressao', STORAGE_KEY, supressaoInicial);

function normalizar(contato: string): string {
  return contato.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface SupressaoStore {
  supressoes: Supressao[];
  // Retorna true se o contato está na lista de supressão ativa para o canal.
  estaBloqueado: (contato: string, canal?: string) => boolean;
  adicionar: (dados: { contato: string; canal: Supressao['canal']; motivo: string; ator: string; origem: string }) => Supressao;
  // Marca o contato como reativado (volta a receber contatos).
  remover: (id: string) => void;
  // Reativa explicitamente (alias semântico de remover).
  reativar: (id: string) => void;
  // Exclui o registro fisicamente da lista.
  excluir: (id: string) => void;
}

// Os registros mock são hashes; contatos reais (e-mail/telefone) também são
// normalizados e comparados. Como os mock são hashes genéricos, mantemos os dois
// sempre ativos para não quebrar a simulação, mas a checagem é funcional.
export function useSupressaoStore(): SupressaoStore {
  const supressoes = store.useStore();

  const estaBloqueado = (contato: string, canal?: string): boolean => {
    const alvo = normalizar(contato);
    if (!alvo) return false;
    return supressoes.some((s) => {
      if (s.status !== 'ativo') return false;
      // Registros mock são hashes genéricos e não bloqueiam contatos reais por engano.
      if (s.contato.startsWith('contato_')) return false;
      // Canal explícito (quando informado) precisa bater.
      if (canal && normalizar(s.canal) !== normalizar(canal)) return false;
      return normalizar(s.contato) === alvo;
    });
  };

  const adicionar: SupressaoStore['adicionar'] = (dados) => {
    const nova: Supressao = {
      id: `sup-${Date.now()}`,
      contato: dados.contato,
      canal: dados.canal,
      motivo: dados.motivo,
      data: new Date().toISOString().slice(0, 10),
      ator: dados.ator,
      origem: dados.origem,
      status: 'ativo',
    };
    store.set((prev) => [nova, ...prev]);
    return nova;
  };

  const remover = (id: string) => {
    store.set((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'reativado' } : s))
    );
  };

  const reativar = remover;

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((s) => s.id !== id));
  };

  return { supressoes, estaBloqueado, adicionar, remover, reativar, excluir };
}