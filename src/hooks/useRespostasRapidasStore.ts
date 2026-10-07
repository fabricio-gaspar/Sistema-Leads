import { createBackendStore } from '@/lib/backendStore';

// Resposta rápida com atalho (/atalho) para agilizar o atendimento no chat.
export interface RespostaRapida {
  id: string;
  atalho: string;
  texto: string;
  categoria: string;
}

const inicial: RespostaRapida[] = [
  { id: 'rr-1', atalho: 'saudacao', texto: 'Olá {nome}! Sou a Ana, assistente virtual. Como posso ajudar?', categoria: 'Abertura' },
  { id: 'rr-2', atalho: 'orcamento', texto: 'Posso te passar um orçamento personalizado. Qual o melhor horário para falarmos?', categoria: 'Orçamentos' },
  { id: 'rr-3', atalho: 'transferir', texto: 'Vou transferir você para um atendente humano, um momento.', categoria: 'Suporte' },
  { id: 'rr-4', atalho: 'registrado', texto: 'Perfeito! Já vou registrar sua solicitação.', categoria: 'Confirmação' },
];

const STORAGE_KEY = 'leadai_respostas_rapidas_v1';
const store = createBackendStore<RespostaRapida[]>('respostas_rapidas', STORAGE_KEY, inicial);

export function useRespostasRapidasStore() {
  const respostas = store.useStore();
  const setStore = store.bindSet();

  const atualizar = (id: string, mudanca: Partial<RespostaRapida>) => {
    setStore((prev) => prev.map((r) => (r.id === id ? { ...r, ...mudanca } : r)));
  };

  const adicionar = (r: RespostaRapida) => {
    setStore((prev) => [...prev, r]);
  };

  const excluir = (id: string) => {
    setStore((prev) => prev.filter((r) => r.id !== id));
  };

  return { respostas, atualizar, adicionar, excluir };
}
