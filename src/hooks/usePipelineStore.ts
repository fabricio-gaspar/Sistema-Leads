import { createBackendStore } from '@/lib/backendStore';
import { pipelineStages } from '@/mocks/pipelineData';

export type PipelineStage = typeof pipelineStages[number];

const STORAGE_KEY = 'leadai_pipeline_v1';
const store = createBackendStore<PipelineStage[]>('pipeline', STORAGE_KEY, pipelineStages);

export interface PipelineStore {
  stages: PipelineStage[];
  atualizar: (id: string, mudanca: Partial<PipelineStage>) => void;
  adicionar: (stage: PipelineStage) => void;
  excluir: (id: string) => void;
  reordenar: (novo: PipelineStage[]) => void;
}

export function usePipelineStore(): PipelineStore {
  const stages = store.useStore();

  const atualizar = (id: string, mudanca: Partial<PipelineStage>) => {
    store.set((prev) => prev.map((s) => (s.id === id ? { ...s, ...mudanca } : s)));
  };

  const adicionar = (stage: PipelineStage) => {
    store.set((prev) => [...prev, stage]);
  };

  const excluir = (id: string) => {
    store.set((prev) => prev.filter((s) => s.id !== id));
  };

  const reordenar = (novo: PipelineStage[]) => {
    store.set(() => novo);
  };

  return { stages, atualizar, adicionar, excluir, reordenar };
}
