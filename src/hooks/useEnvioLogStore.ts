import { createBackendStore } from '@/lib/backendStore';
import type { RegistroEnvio } from '@/lib/tipos';

const STORAGE_KEY = 'leadai_envios_v1';

// Registro de envios (simulados ou reais) da Ana. Alimenta a tela
// "Registro Sandbox" e a auditoria do que sairia de verdade em cada modo.
const store = createBackendStore<RegistroEnvio[]>('envio_logs',STORAGE_KEY, []);

function dataHora(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function useEnvioLogStore(): {
  registros: RegistroEnvio[];
  limpar: () => void;
} {
  const registros = store.useStore();

  const limpar = () => {
    store.set(() => []);
  };

  return { registros, limpar };
}

export function registrarEnvio(dados: Omit<RegistroEnvio, 'id' | 'data'>): string {
  const novo: RegistroEnvio = {
    ...dados,
    id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    data: dataHora(),
    resultado: dados.simulado ? undefined : 'pendente',
  };
  store.set((prev) => [novo, ...prev].slice(0, 500));
  return novo.id;
}

// Atualiza o resultado do envio real após a Edge Function responder, para o
// "Registro de envios" refletir o que aconteceu de verdade (sucesso + ID ou erro).
export function atualizarResultadoEnvio(
  id: string,
  resultado: 'ok' | 'erro',
  respostaApi: string
): void {
  store.set((prev) =>
    prev.map((r) => (r.id === id ? { ...r, resultado, respostaApi } : r))
  );
}