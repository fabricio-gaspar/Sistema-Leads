import { useEffect, useState, type ReactNode } from 'react';
import type { Conversa } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';

export type ConversationDrawerTab = 'lead' | 'knowledge' | 'quotes' | 'agenda' | 'history';

interface ConversaDrawerProps {
  conversa: Conversa;
  lead?: Lead | null;
  activeTab?: ConversationDrawerTab;
  knowledgePanel?: ReactNode;
  quoteCount?: number;
  anaStatus?: string;
  onClose: () => void;
  onTabChange?: (tab: ConversationDrawerTab) => void;
  onOpenQuotes?: () => void;
  onOpenAgenda?: (create?: boolean) => void;
  onOpenKanban?: () => void;
}

const statusLabel: Record<Conversa['status'], string> = {
  ativo: 'Ativo', aguardando: 'Aguardando resposta', resolvido: 'Resolvido', transferido: 'Atendimento humano',
};

const tabs: Array<{ id: ConversationDrawerTab; label: string; icon: string }> = [
  { id: 'lead', label: 'Lead', icon: 'ri-user-3-line' },
  { id: 'knowledge', label: 'Conhecimento', icon: 'ri-book-open-line' },
  { id: 'quotes', label: 'Orçamentos', icon: 'ri-file-list-3-line' },
  { id: 'agenda', label: 'Agenda', icon: 'ri-calendar-event-line' },
  { id: 'history', label: 'Histórico', icon: 'ri-history-line' },
];

export default function ConversaDrawer({ conversa, lead, activeTab, knowledgePanel, quoteCount = 0, anaStatus, onClose, onTabChange, onOpenQuotes, onOpenAgenda, onOpenKanban }: ConversaDrawerProps) {
  const [internalTab, setInternalTab] = useState<ConversationDrawerTab>('lead');
  const tab = activeTab ?? internalTab;
  const history = conversa.mensagens.slice().reverse();

  useEffect(() => { if (activeTab) setInternalTab(activeTab); }, [activeTab]);

  const selectTab = (next: ConversationDrawerTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground-950/50" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4">
          <div className="min-w-0"><h3 className="truncate font-heading text-base font-bold text-foreground-950">{conversa.contato}</h3><p className="truncate text-xs text-foreground-500">{conversa.empresa} · {conversa.protocolo}</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar painel do lead" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg hover:bg-background-100"><i className="ri-close-line text-lg" /></button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-background-200/70 bg-background-50 p-2" aria-label="Contexto comercial">
          {tabs.map((item) => <button key={item.id} type="button" onClick={() => selectTab(item.id)} aria-selected={tab === item.id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${tab === item.id ? 'bg-primary-500 text-background-50 shadow-sm' : 'text-foreground-500 hover:bg-background-100 hover:text-foreground-700'}`}><i className={item.icon} />{item.label}</button>)}
        </nav>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'lead' && <div className="space-y-4">
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700">{conversa.canal}</span><span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-800">{statusLabel[conversa.status]}</span><span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-medium text-foreground-700">{conversa.fila}</span></div>
            {lead && <div className="rounded-xl border border-background-200/70 bg-background-100/50 p-4"><p className="text-xs font-semibold text-foreground-700">Dados operacionais</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-foreground-500">Etapa</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.etapa || '—'}</dd></div><div><dt className="text-xs text-foreground-500">Score</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.score}</dd></div><div><dt className="text-xs text-foreground-500">Responsável</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.responsavel || '—'}</dd></div><div><dt className="text-xs text-foreground-500">Atendimento</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.modoAtendimento || '—'}</dd></div></dl></div>}
            {anaStatus && <div className="rounded-xl border border-primary-100 bg-primary-50 p-4"><p className="text-xs font-semibold text-primary-900"><i className="ri-robot-line mr-1.5" />Ana</p><p className="mt-1 text-xs leading-5 text-primary-800">{anaStatus}</p></div>}
            <button type="button" onClick={onOpenKanban} disabled={!lead} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-background-200 px-3 py-2.5 text-xs font-semibold text-foreground-700 transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><i className="ri-layout-column-line" />Ver no Kanban</button>
          </div>}
          {tab === 'knowledge' && (knowledgePanel || <Empty icon="ri-book-open-line" text="O conhecimento comercial não está disponível nesta conversa." />)}
          {tab === 'quotes' && <div className="space-y-3"><div><p className="text-sm font-bold text-foreground-900">Orçamentos</p><p className="mt-1 text-xs leading-5 text-foreground-500">{quoteCount} vínculo(s) deste lead.</p></div><button type="button" onClick={onOpenQuotes} disabled={!lead} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-2.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"><i className="ri-file-add-line" />Criar orçamento</button></div>}
          {tab === 'agenda' && <div className="space-y-3"><div><p className="text-sm font-bold text-foreground-900">Agenda do lead</p><p className="mt-1 text-xs leading-5 text-foreground-500">Consulte a agenda ou crie um compromisso com este lead vinculado.</p></div><button type="button" onClick={() => onOpenAgenda?.(true)} disabled={!lead} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-2.5 text-xs font-semibold text-background-50 transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"><i className="ri-calendar-event-line" />Agendar reunião</button><button type="button" onClick={() => onOpenAgenda?.()} disabled={!lead} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-background-200 px-3 py-2.5 text-xs font-semibold text-foreground-700 transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><i className="ri-calendar-line" />Abrir agenda</button></div>}
          {tab === 'history' && <div className="space-y-4">{history.length === 0 ? <p className="py-8 text-center text-sm text-foreground-500">Ainda não há eventos registrados para esta conversa.</p> : history.map((message, index) => <div key={message.id} className="flex gap-3"><div className="flex flex-col items-center"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />{index < history.length - 1 && <div className="w-px flex-1 bg-background-200" />}</div><div className="pb-4"><p className="text-sm font-medium text-foreground-900">{message.nome}</p><p className="text-xs text-foreground-600">{message.notaInterna ? 'Nota interna' : message.autor === 'ana' ? 'Ana' : message.autor === 'cliente' ? 'Lead' : 'Atendente'}</p><p className="mt-1 text-sm text-foreground-800">{message.texto}</p><p className="mt-1 text-[11px] text-foreground-400">{message.hora}</p></div></div>)}</div>}
        </div>
      </aside>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="py-10 text-center text-xs leading-5 text-foreground-500"><i className={`${icon} mb-2 block text-2xl`} />{text}</div>;
}
