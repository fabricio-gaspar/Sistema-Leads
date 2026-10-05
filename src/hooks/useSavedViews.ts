import { useLocalStorageState } from './useLocalStorageState';

export interface SavedView<T> {
  id: string;
  nome: string;
  filtros: T;
}

export function useSavedViews<T>(storageKey: string) {
  const [views, setViews] = useLocalStorageState<SavedView<T>[]>(storageKey, []);

  const salvar = (nome: string, filtros: T) => {
    const id = `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setViews((prev) => [...prev, { id, nome, filtros }]);
  };

  const renomear = (id: string, nome: string) => {
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, nome } : v)));
  };

  const excluir = (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  return { views, salvar, renomear, excluir };
}