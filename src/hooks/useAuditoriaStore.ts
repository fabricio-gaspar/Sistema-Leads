import { createBackendStore } from '@/lib/backendStore';
import type { RegistroAuditoria } from '@/lib/tipos';
import { logsAuditoria } from '@/mocks/logsData';

const STORAGE_KEY = 'leadai_auditoria_v1';

// Seeds de demonstração mantidos como histórico inicial; novos registros são
// prependidos conforme as ações acontecem.
const store = createBackendStore<RegistroAuditoria[]>('auditoria',
  STORAGE_KEY,
  logsAuditoria as RegistroAuditoria[]
);

function dataHora(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function useAuditoriaStore(): {
  registros: RegistroAuditoria[];
  registrar: (dados: { evento: string; ator: string; alvo: string; detalhes: string }) => RegistroAuditoria;
} {
  const registros = store.useStore();

  const registrar = (dados: { evento: string; ator: string; alvo: string; detalhes: string }): RegistroAuditoria => {
    const novo: RegistroAuditoria = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      evento: dados.evento,
      ator: dados.ator,
      alvo: dados.alvo,
      detalhes: dados.detalhes,
      data: dataHora(),
    };
    store.set((prev) => [novo, ...prev].slice(0, 500));
    return novo;
  };

  return { registros, registrar };
}

export function registrarAuditoria(dados: { evento: string; ator: string; alvo: string; detalhes: string }): void {
  const novo: RegistroAuditoria = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    evento: dados.evento,
    ator: dados.ator,
    alvo: dados.alvo,
    detalhes: dados.detalhes,
    data: dataHora(),
  };
  store.set((prev) => [novo, ...prev].slice(0, 500));
}