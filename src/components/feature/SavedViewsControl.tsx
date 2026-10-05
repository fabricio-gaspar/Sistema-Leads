import { useState, useRef, useEffect } from 'react';
import type { SavedView } from '@/hooks/useSavedViews';

interface SavedViewsControlProps<T> {
  views: SavedView<T>[];
  onLoad: (filtros: T) => void;
  onSave: (nome: string) => void;
  onRename: (id: string, nome: string) => void;
  onDelete: (id: string) => void;
}

export default function SavedViewsControl<T>({
  views,
  onLoad,
  onSave,
  onRename,
  onDelete,
}: SavedViewsControlProps<T>) {
  const [aberto, setAberto] = useState(false);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState('');
  const [editando, setEditando] = useState<SavedView<T> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleSalvar = () => {
    const n = nome.trim();
    if (!n) return;
    if (editando) {
      onRename(editando.id, n);
    } else {
      onSave(n);
    }
    setNome('');
    setEditando(null);
    setModal(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative" ref={ref}>
          <button
            onClick={() => setAberto((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-bookmark-line"></i>
            Visões salvas
            {views.length > 0 && (
              <span className="text-xs bg-background-200 text-foreground-600 px-1.5 py-0.5 rounded-full">
                {views.length}
              </span>
            )}
          </button>

          {aberto && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-background-50 border border-background-200/70 rounded-xl p-2 z-30">
              {views.length === 0 ? (
                <p className="text-xs text-foreground-500 px-3 py-4 text-center">
                  Nenhuma visão salva ainda.
                </p>
              ) : (
                views.map((v) => (
                  <div key={v.id} className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onLoad(v.filtros);
                        setAberto(false);
                      }}
                      className="flex-1 text-left px-3 py-2 rounded-lg hover:bg-background-100 text-sm text-foreground-800 cursor-pointer whitespace-nowrap truncate"
                    >
                      {v.nome}
                    </button>
                    <button
                      onClick={() => {
                        setEditando(v);
                        setNome(v.nome);
                        setModal(true);
                        setAberto(false);
                      }}
                      aria-label={`Renomear visão ${v.nome}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground-400 hover:text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-edit-line text-sm"></i>
                    </button>
                    <button
                      onClick={() => onDelete(v.id)}
                      aria-label={`Excluir visão ${v.nome}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground-400 hover:text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setEditando(null);
            setNome('');
            setModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Salvar como visão salva
        </button>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4"
          onClick={() => setModal(false)}
        >
          <div
            className="bg-background-50 rounded-xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">
                {editando ? 'Renomear visão' : 'Salvar visão'}
              </h3>
              <button
                onClick={() => setModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome da visão</label>
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSalvar();
                }}
                placeholder="Ex.: Leads quentes de SP"
                className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
              />
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!nome.trim()}
                className="px-5 py-2.5 bg-primary-500 text-background-50 rounded-lg text-sm font-bold disabled:bg-primary-300 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {editando ? 'Renomear' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}