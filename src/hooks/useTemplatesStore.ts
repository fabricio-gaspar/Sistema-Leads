import { createBackendStore } from '@/lib/backendStore';
import { templatesMensagem } from '@/mocks/templatesData';

export type TemplateMensagem = typeof templatesMensagem[number];

const STORAGE_KEY = 'leadai_templates_v1';
const store = createBackendStore<TemplateMensagem[]>('templates', STORAGE_KEY, templatesMensagem);

export interface TemplatesStore {
  templates: TemplateMensagem[];
  atualizar: (id: string, mudanca: Partial<TemplateMensagem>) => void;
  adicionar: (template: TemplateMensagem) => void;
  excluir: (id: string) => void;
}

export function useTemplatesStore(): TemplatesStore {
  const templates = store.useStore();
  const setStore = store.bindSet();

  const atualizar = (id: string, mudanca: Partial<TemplateMensagem>) => {
    setStore((prev) => prev.map((t) => (t.id === id ? { ...t, ...mudanca } : t)));
  };

  const adicionar = (template: TemplateMensagem) => {
    setStore((prev) => [template, ...prev]);
  };

  const excluir = (id: string) => {
    setStore((prev) => prev.filter((t) => t.id !== id));
  };

  return { templates, atualizar, adicionar, excluir };
}
