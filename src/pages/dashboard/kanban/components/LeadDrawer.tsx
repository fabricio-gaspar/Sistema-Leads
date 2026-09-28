import { useEffect, useMemo, useState } from 'react';
import { useTarefasStore } from '@/hooks/useTarefasStore';
import type { TeamMember } from '@/lib/crm/teamMembersRepository';
import type { CanonicalStageKey } from '@/lib/crm/leadStageRepository';
import {
  loadKanbanLeadDetails,
  type KanbanInteractionItem,
  type KanbanNoteItem,
  type KanbanPortfolioItem,
  type KanbanTimelineItem,
} from '@/lib/crm/kanbanRepository';

const labels: Record<CanonicalStageKey, string> = {
  novo: 'Novo', apresentado: 'Apresentado', qualificando: 'Qualificando', reuniao: 'Reunião',
  orcamento: 'Orçamento', ganho: 'Ganho', perdido: 'Perdido',
};

const stageClass: Record<CanonicalStageKey, string> = {
  novo: 'bg-background-200 text-foreground-700', apresentado: 'bg-primary-100 text-primary-800',
  qualificando: 'bg-primary-100 text-primary-800', reuniao: 'bg-secondary-100 text-secondary-800',
  orcamento: 'bg-amber-100 text-amber-800', ganho: 'bg-primary-600 text-white', perdido: 'bg-background-300 text-foreground-600',
};

function dateText(value: string | null | undefined, includeDate = true): string {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', includeDate
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function ageText(value: string | null): string {
  if (!value) return 'Data de entrada não registrada';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (!Number.isFinite(hours)) return 'Data de entrada não registrada';
  if (hours < 24) return `Há ${Math.max(1, hours)}h nesta etapa`;
  return `Há ${Math.floor(hours / 24)} dia${Math.floor(hours / 24) === 1 ? '' : 's'} nesta etapa`;
}

type DetailData = { timeline: KanbanTimelineItem[]; interactions: KanbanInteractionItem[]; notes: KanbanNoteItem[] };

interface LeadDrawerProps {
  item: KanbanPortfolioItem;
  team: TeamMember[];
  canEdit: boolean;
  canAssign: boolean;
  onClose: () => void;
  onMove: (stage: CanonicalStageKey) => void;
  onOpenConversation: () => void;
  onCreateTask: () => void;
  onAssign: (memberId: string) => void;
  onArchive: () => void;
  onToggleTask: (taskId: string) => void;
}

export default function LeadDrawer({ item, team, canEdit, canAssign, onClose, onMove, onOpenConversation, onCreateTask, onAssign, onArchive, onToggleTask }: LeadDrawerProps) {
  const { lead, stage, nextAction, stageEnteredAt, listName, duplicateSuspected } = item;
  const { tarefas } = useTarefasStore();
  const [details, setDetails] = useState<DetailData>({ timeline: [], interactions: [], notes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'summary' | 'activity' | 'tasks' | 'audit'>('summary');
  const [stageMenu, setStageMenu] = useState(stage);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setTab('summary'); setStageMenu(stage);
    void loadKanbanLeadDetails(lead.id)
      .then((data) => { if (alive) setDetails(data); })
      .catch(() => { if (alive) setError('Não foi possível carregar o histórico deste lead agora.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [lead.id, stage]);

  const tasks = useMemo(() => tarefas.filter((task) => task.leadId === lead.id), [lead.id, tarefas]);
  const phone = (lead.telefone || '').replace(/\D/g, '');
  const whatsapp = (lead.whatsapp || '').replace(/\D/g, '');
  const contactStatus = !phone && !whatsapp && !lead.email
    ? 'Sem contato' : whatsapp ? 'WhatsApp identificado' : phone ? 'Telefone identificado' : 'E-mail encontrado';
  const scoreDetail = lead.scoreExplanation || 'Não há detalhamento de aderência persistido para este lead.';
  const currentOwner = team.find((member) => member.userId === lead.responsavelId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground-950/45" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Detalhes de ${lead.nome || lead.empresa}`} className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="border-b border-background-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-500">Detalhes do lead</p>
              <h2 className="mt-1 truncate font-heading text-xl font-bold text-foreground-950">{lead.nome || lead.empresa}</h2>
              {lead.nome && <p className="mt-0.5 truncate text-sm text-foreground-600">{lead.empresa || 'Empresa não informada'}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stageClass[stage]}`}>{labels[stage]}</span>
                <span className="rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-700">{contactStatus}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-foreground-600 hover:bg-background-100 hover:text-foreground-950" aria-label="Fechar detalhes"><i className="ri-close-line text-xl" /></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {phone && <a className="wf-btn-secondary justify-center text-xs" href={`tel:${phone}`}><i className="ri-phone-line" />Ligar</a>}
            {whatsapp && <a className="wf-btn-secondary justify-center text-xs" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><i className="ri-whatsapp-line" />WhatsApp</a>}
            {lead.email && <a className="wf-btn-secondary justify-center text-xs" href={`mailto:${lead.email}`}><i className="ri-mail-line" />E-mail</a>}
            <button type="button" className="wf-btn-secondary justify-center text-xs" onClick={onOpenConversation}><i className="ri-chat-3-line" />Registrar interação</button>
          </div>
        </header>

        <nav className="flex border-b border-background-200 px-3" aria-label="Seções do lead">
          {([
            ['summary', 'Resumo'], ['activity', 'Atividade'], ['tasks', `Tarefas (${tasks.filter((task) => !task.concluida).length})`], ['audit', 'Auditoria'],
          ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`border-b-2 px-3 py-3 text-xs font-semibold ${tab === id ? 'border-primary-500 text-primary-700' : 'border-transparent text-foreground-500 hover:text-foreground-800'}`}>{label}</button>)}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && <p className="rounded-lg bg-background-100 p-4 text-sm text-foreground-600">Carregando histórico autorizado…</p>}
          {error && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}

          {!loading && tab === 'summary' && <div className="space-y-5">
            <section className="rounded-xl border border-background-200 p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-foreground-900">Contexto comercial</h3><span className="text-xs text-foreground-500">{ageText(stageEnteredAt)}</span></div>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-foreground-500">Segmento e local</dt><dd className="mt-0.5 font-medium text-foreground-800">{[lead.segmento, [lead.cidade, lead.estado].filter(Boolean).join(' · ')].filter(Boolean).join(' · ') || 'Não informado'}</dd></div>
                <div><dt className="text-xs text-foreground-500">Origem</dt><dd className="mt-0.5 font-medium text-foreground-800">{lead.origem || 'Não informada'}</dd></div>
                <div><dt className="text-xs text-foreground-500">Lista de origem</dt><dd className="mt-0.5 font-medium text-foreground-800">{listName || 'Não vinculada'}</dd></div>
                <div><dt className="text-xs text-foreground-500">Autorização de contato</dt><dd className="mt-0.5 font-medium text-foreground-800">{lead.contactApprovalStatus === 'approved' ? 'Aprovada' : lead.contactApprovalStatus === 'rejected' ? 'Recusada' : 'Pendente'}</dd></div>
              </dl>
            </section>

            <section className="rounded-xl border border-background-200 p-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-foreground-900">Aderência</h3><span className="text-sm font-bold text-foreground-950">{lead.score}/100</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background-200"><div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.max(0, Math.min(100, lead.score))}%` }} /></div>
              <p className="mt-2 text-xs leading-relaxed text-foreground-600">{scoreDetail}</p>
            </section>

            <section className="rounded-xl border border-background-200 p-4">
              <h3 className="text-sm font-bold text-foreground-900">Próxima ação</h3>
              {nextAction.text ? <div className="mt-2"><p className="font-medium text-foreground-800">{nextAction.text}</p><p className="mt-1 text-xs text-foreground-600">Prazo: {dateText(nextAction.dueAt)}{nextAction.owner ? ` · ${nextAction.owner}` : ''}</p></div> : <div className="mt-2 flex items-center justify-between gap-3"><p className="text-sm text-foreground-600">Sem próxima ação.</p>{canEdit && <button type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={onCreateTask}>Criar tarefa</button>}</div>}
            </section>

            {duplicateSuspected && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-bold text-amber-950">Possível duplicidade</h3><p className="mt-1 text-xs text-amber-900">Há outra identidade compatível na carteira. A correspondência não foi bloqueada automaticamente; revise antes de mesclar ou arquivar.</p></section>}

            <section className="rounded-xl border border-background-200 p-4">
              <h3 className="text-sm font-bold text-foreground-900">Responsável e etapa</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="text-xs text-foreground-500" htmlFor="drawer-owner">Responsável</label>{canAssign ? <select id="drawer-owner" value={lead.responsavelId || ''} onChange={(event) => event.target.value && onAssign(event.target.value)} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm text-foreground-800"><option value="">Não informado</option>{currentOwner === undefined && lead.responsavelId && <option value={lead.responsavelId}>{lead.responsavel || 'Responsável atual'}</option>}{team.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select> : <p className="mt-1 text-sm font-medium text-foreground-800">{lead.responsavel || 'Não informado'}</p>}</div>
                <div><label className="text-xs text-foreground-500" htmlFor="drawer-stage">Etapa</label>{canEdit ? <select id="drawer-stage" value={stageMenu} onChange={(event) => { const next = event.target.value as CanonicalStageKey; setStageMenu(next); if (next !== stage) onMove(next); }} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm text-foreground-800">{(Object.keys(labels) as CanonicalStageKey[]).map((key) => <option key={key} value={key} disabled={key === stage}>{labels[key]}</option>)}</select> : <p className="mt-1 text-sm font-medium text-foreground-800">{labels[stage]}</p>}</div>
              </div>
            </section>
          </div>}

          {!loading && tab === 'activity' && <div className="space-y-3">{details.interactions.length ? details.interactions.map((interaction) => <article key={interaction.id} className="rounded-xl border border-background-200 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-foreground-700">{interaction.senderName || interaction.sender || 'Sistema'} · {interaction.type}</p><time className="text-[11px] text-foreground-500">{dateText(interaction.createdAt, false)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-foreground-800">{interaction.text || 'Interação sem texto disponível.'}</p></article>) : <p className="rounded-xl bg-background-100 p-4 text-sm text-foreground-600">Não há interações persistidas para este lead.</p>}<section className="pt-2"><h3 className="mb-2 text-sm font-bold text-foreground-900">Notas</h3>{details.notes.length ? details.notes.map((note) => <article key={note.id} className="mb-2 rounded-lg bg-background-100 p-3"><p className="whitespace-pre-wrap text-sm text-foreground-800">{note.body}</p><time className="mt-2 block text-[11px] text-foreground-500">Registrada em {dateText(note.createdAt, false)}</time></article>) : <p className="text-sm text-foreground-600">Nenhuma nota persistida.</p>}</section></div>}

          {!loading && tab === 'tasks' && <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-foreground-900">Tarefas vinculadas</h3>{canEdit && <button type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={onCreateTask}>Criar tarefa</button>}</div>{tasks.length ? tasks.map((task) => <label key={task.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-background-200 p-3"><input type="checkbox" checked={task.concluida} disabled={!canEdit} onChange={() => onToggleTask(task.id)} className="mt-0.5 h-4 w-4 accent-primary-600"/><span className="min-w-0 flex-1"><span className={`block text-sm ${task.concluida ? 'text-foreground-500 line-through' : 'font-medium text-foreground-800'}`}>{task.titulo}</span><span className="mt-1 block text-xs text-foreground-500">{task.dataLimite ? `Prazo: ${task.dataLimite}` : 'Sem prazo'} · {task.responsavel || 'Sem responsável'}</span></span></label>) : <p className="rounded-xl bg-background-100 p-4 text-sm text-foreground-600">Nenhuma tarefa vinculada.</p>}</div>}

          {!loading && tab === 'audit' && <div className="space-y-3">{details.timeline.length ? details.timeline.map((event) => <article key={event.id} className="border-l-2 border-primary-300 pl-3"><p className="text-sm font-semibold text-foreground-800">{event.fromStage ? `${labels[event.fromStage as CanonicalStageKey] || event.fromStage} → ` : ''}{labels[event.toStage as CanonicalStageKey] || event.toStage}</p><p className="mt-0.5 text-xs text-foreground-600">{event.reason || 'Sem motivo adicional'} · {event.source}</p><time className="mt-1 block text-[11px] text-foreground-500">{dateText(event.createdAt)}</time></article>) : <p className="rounded-xl bg-background-100 p-4 text-sm text-foreground-600">Não há mudanças de etapa registradas.</p>}</div>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-background-200 p-4"><p className="text-xs text-foreground-500">Arquivar remove do quadro e preserva o histórico.</p>{canEdit && <button type="button" className="text-xs font-semibold text-foreground-700 hover:text-accent-700" onClick={onArchive}>Arquivar lead</button>}</footer>
      </aside>
    </div>
  );
}
