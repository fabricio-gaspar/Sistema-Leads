import { useState } from 'react';
import type { Conversa } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';

interface ConversaDrawerProps {
  conversa: Conversa;
  lead?: Lead | null;
  onClose: () => void;
}

type Aba = 'resumo' | 'historico';

const statusLabel: Record<Conversa['status'], string> = {
  ativo: 'Ativo', aguardando: 'Aguardando resposta', resolvido: 'Resolvido', transferido: 'Atendimento humano',
};

export default function ConversaDrawer({ conversa, lead, onClose }: ConversaDrawerProps) {
  const [aba, setAba] = useState<Aba>('resumo');
  const history = conversa.mensagens.slice().reverse();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground-950/50" onClick={onClose}>
      <aside className="flex h-full w-full max-w-sm flex-col bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4">
          <div className="min-w-0"><h3 className="truncate font-heading text-base font-bold text-foreground-950">{conversa.contato}</h3><p className="truncate text-xs text-foreground-500">{conversa.empresa} · {conversa.protocolo}</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar painel do lead" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg hover:bg-background-100"><i className="ri-close-line text-lg" /></button>
        </header>
        <div className="border-b border-background-200/70 px-5 pt-4"><div className="flex gap-1 rounded-lg bg-background-100 p-1">{([['resumo', 'Resumo', 'ri-file-user-line'], ['historico', 'Histórico', 'ri-history-line']] as const).map(([id, label, icon]) => <button key={id} type="button" onClick={() => setAba(id)} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold transition ${aba === id ? 'bg-background-50 text-primary-700 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'}`}><i className={icon} />{label}</button>)}</div></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {aba === 'resumo' ? <>
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700">{conversa.canal}</span><span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-800">{statusLabel[conversa.status]}</span><span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-medium text-foreground-700">{conversa.fila}</span></div>
            {lead && <div className="rounded-xl border border-background-200/70 bg-background-100/50 p-4"><p className="text-xs font-semibold text-foreground-700">Dados operacionais do lead</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-foreground-500">Etapa</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.etapa || '—'}</dd></div><div><dt className="text-xs text-foreground-500">Score</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.score}</dd></div><div><dt className="text-xs text-foreground-500">Responsável</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.responsavel || '—'}</dd></div><div><dt className="text-xs text-foreground-500">Atendimento</dt><dd className="mt-0.5 font-medium text-foreground-900">{lead.modoAtendimento || '—'}</dd></div></dl></div>}
            <div className="space-y-2.5 text-sm"><div className="flex justify-between gap-4"><span className="text-xs text-foreground-500">Mensagens registradas</span><strong className="text-foreground-900">{conversa.mensagens.length}</strong></div><div className="flex justify-between gap-4"><span className="text-xs text-foreground-500">Última atividade</span><strong className="text-right text-foreground-900">{conversa.hora}</strong></div><div className="border-t border-background-200/70 pt-3"><span className="text-xs text-foreground-500">Última mensagem</span><p className="mt-1 text-foreground-800">{conversa.ultimaMensagem}</p></div></div>
          </> : <div className="space-y-4">{history.length === 0 ? <p className="py-8 text-center text-sm text-foreground-500">Ainda não há eventos registrados para esta conversa.</p> : history.map((message, index) => <div key={message.id} className="flex gap-3"><div className="flex flex-col items-center"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />{index < history.length - 1 && <div className="w-px flex-1 bg-background-200" />}</div><div className="pb-4"><p className="text-sm font-medium text-foreground-900">{message.nome}</p><p className="text-xs text-foreground-600">{message.notaInterna ? 'Nota interna' : message.autor === 'ana' ? 'Ana' : message.autor === 'cliente' ? 'Lead' : 'Atendente'}</p><p className="mt-1 text-sm text-foreground-800">{message.texto}</p><p className="mt-1 text-[11px] text-foreground-400">{message.hora}</p></div></div>)}</div>}
        </div>
      </aside>
    </div>
  );
}
