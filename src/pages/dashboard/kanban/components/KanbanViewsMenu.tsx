import { useEffect, useRef, useState } from 'react';
import type { KanbanSavedView } from '@/lib/crm/kanbanRepository';

interface KanbanViewsMenuProps<T> {
  views: KanbanSavedView<T>[];
  activeViewId: string | null;
  dirty: boolean;
  onLoad: (view: KanbanSavedView<T>) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onUpdate: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function KanbanViewsMenu<T>({ views, activeViewId, dirty, onLoad, onCreate, onRename, onUpdate, onSetDefault, onDelete }: KanbanViewsMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [nameModal, setNameModal] = useState<'create' | 'rename' | null>(null);
  const [target, setTarget] = useState<KanbanSavedView<T> | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const safely = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await operation(); setOpen(false); } finally { setBusy(false); }
  };

  const submit = async () => {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      if (nameModal === 'rename' && target) await onRename(target.id, value);
      else await onCreate(value);
      setNameModal(null); setTarget(null); setName(''); setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="wf-btn-secondary whitespace-nowrap">
        <i className="ri-bookmark-line" aria-hidden="true" />Visões <i className="ri-arrow-down-s-line" aria-hidden="true" />
      </button>
      {open && <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-background-200 bg-white p-2 shadow-xl">
        <div className="px-2 py-2 text-xs text-foreground-500">Visões pessoais, salvas na sua conta.</div>
        {views.length ? views.map((view) => <div key={view.id} className={`rounded-lg p-2 ${view.id === activeViewId ? 'bg-primary-50' : 'hover:bg-background-100'}`}>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { onLoad(view); setOpen(false); }} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground-800">
              {view.name}{view.isDefault && <span className="ml-1.5 text-[10px] font-medium text-primary-700">Padrão</span>}
            </button>
            <button type="button" onClick={() => { setTarget(view); setName(view.name); setNameModal('rename'); }} aria-label={`Renomear ${view.name}`} className="rounded p-1.5 text-foreground-500 hover:bg-white hover:text-foreground-800"><i className="ri-edit-line" /></button>
            <button type="button" onClick={() => void safely(() => onDelete(view.id))} aria-label={`Excluir ${view.name}`} className="rounded p-1.5 text-foreground-500 hover:bg-white hover:text-accent-700"><i className="ri-delete-bin-line" /></button>
          </div>
          <div className="mt-1 flex gap-2 text-[11px]">
            <button type="button" onClick={() => void safely(() => onSetDefault(view.id))} disabled={view.isDefault || busy} className="font-semibold text-primary-700 disabled:text-foreground-400">{view.isDefault ? 'Visão padrão' : 'Definir padrão'}</button>
            {view.id === activeViewId && dirty && <button type="button" onClick={() => void safely(() => onUpdate(view.id))} disabled={busy} className="font-semibold text-primary-700">Salvar alterações</button>}
          </div>
        </div>) : <p className="px-2 py-4 text-center text-xs text-foreground-500">Nenhuma visão salva.</p>}
        <div className="mt-1 border-t border-background-200 pt-2">
          <button type="button" onClick={() => { setTarget(null); setName(''); setNameModal('create'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-700 hover:bg-primary-50"><i className="ri-add-line mr-1" />Criar visão</button>
        </div>
      </div>}
      {nameModal && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground-950/50 p-4" onClick={() => !busy && setNameModal(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="kanban-view-title" className="w-full max-w-sm rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="border-b border-background-200 px-5 py-4"><h3 id="kanban-view-title" className="font-heading text-base font-bold text-foreground-950">{nameModal === 'rename' ? 'Renomear visão' : 'Criar visão'}</h3></div>
          <div className="p-5"><label className="text-sm font-medium text-foreground-700" htmlFor="kanban-view-name">Nome da visão</label><input id="kanban-view-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} maxLength={80} className="mt-1.5 w-full rounded-lg border border-background-300 px-3 py-2.5 text-sm" placeholder="Ex.: Retornos de hoje" /></div>
          <div className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={() => setNameModal(null)} className="wf-btn-secondary">Cancelar</button><button type="button" onClick={() => void submit()} disabled={!name.trim() || busy} className="wf-btn-primary disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button></div>
        </div>
      </div>}
    </div>
  );
}
