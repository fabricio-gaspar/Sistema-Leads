import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agendaNextActionError, prepareAgendaNextAction, type NextActionIntent } from '@/lib/crm/agendaNextAction';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AccessibleDialog from '@/components/feature/AccessibleDialog';
import DataReadNotice from '@/components/feature/DataReadNotice';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import {
  agendaOrigins, agendaStatuses, agendaTypes, createAgendaSavedView, createOperationalAppointment, createAgendaNextAction,
  findAgendaConflicts, loadAgendaHistory, loadAgendaPortfolio, loadAgendaSavedViews,
  setDefaultAgendaSavedView, updateAgendaSavedView, updateOperationalAppointment,
  validAgendaTimezone, type AgendaAppointment, type AgendaFilters, type AgendaHistoryEntry,
  type AgendaSavedView, type AgendaStatus, type AgendaType, type AgendaViewKind,
} from '@/lib/crm/appointmentsRepository';
import '../command-secondary.css';

type AgendaView = { view: AgendaViewKind; filters: AgendaFilters; workStart: number; workEnd: number; date: string };
type FormState = { id?: string; expectedUpdatedAt?: string; leadId: string; type: AgendaType; title: string; description: string; date: string; startsAt: string; endsAt: string; timezone: string; responsibleId: string; participants: string; location: string; reminders: string; confirmation: 'pending' | 'confirmed'; notes: string; status: AgendaStatus; };

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const typeLabel: Record<AgendaType, string> = { reuniao: 'Reunião', ligacao: 'Ligação', followup: 'Follow-up', tarefa: 'Tarefa', outro: 'Outro' };
const statusLabel: Record<AgendaStatus, string> = { pending: 'Aguardando confirmação', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu' };
const originLabel = { manual: 'Manual', ana: 'Criado pela Ana', integration: 'Integração' } as const;
const statusTone: Record<AgendaStatus, string> = { pending: 'bg-amber-50 text-amber-800 border-amber-200', confirmed: 'bg-primary-50 text-primary-800 border-primary-200', completed: 'bg-emerald-50 text-emerald-800 border-emerald-200', cancelled: 'bg-background-100 text-foreground-600 border-background-200', no_show: 'bg-accent-50 text-accent-800 border-accent-200' };
const typeTone: Record<AgendaType, string> = { reuniao: 'border-primary-300 bg-primary-50 text-primary-900', ligacao: 'border-sky-300 bg-sky-50 text-sky-900', followup: 'border-violet-300 bg-violet-50 text-violet-900', tarefa: 'border-amber-300 bg-amber-50 text-amber-900', outro: 'border-background-300 bg-background-100 text-foreground-800' };

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const addDays = (value: string, count: number) => { const date = parseDate(value); date.setDate(date.getDate() + count); return localDate(date); };
const monthTitle = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const dateLong = (value: string) => parseDate(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateFromIso = (iso: string, timezone = 'America/Sao_Paulo') => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(iso));
const timeFromIso = (iso: string, timezone = 'America/Sao_Paulo') => new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const formatMoment = (iso: string, timezone = 'America/Sao_Paulo') => new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const minutesBetween = (start: string, end: string) => Math.max(15, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
const addMinutes = (iso: string, amount: number) => new Date(new Date(iso).getTime() + amount * 60000).toISOString();

/** Converts a visible wall-clock time to UTC while keeping the chosen IANA zone explicit. */
function zonedUtc(date: string, time: string, timezone: string) {
  const desired = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Number(time.slice(0, 2)), Number(time.slice(3, 5)));
  const candidate = new Date(desired);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(candidate);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const shown = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
  return new Date(desired + (desired - shown)).toISOString();
}

function weekStart(value: string) { const date = parseDate(value); date.setDate(date.getDate() - date.getDay()); return localDate(date); }
function monthStart(value: string) { const date = parseDate(value); date.setDate(1); return localDate(date); }
function rangeFor(view: AgendaViewKind, cursor: string) {
  if (view === 'day') return { start: cursor, end: addDays(cursor, 1) };
  if (view === 'month') return { start: monthStart(cursor), end: addDays(localDate(new Date(parseDate(monthStart(cursor)).getFullYear(), parseDate(monthStart(cursor)).getMonth() + 1, 1)), 0) };
  if (view === 'list') return { start: addDays(cursor, -30), end: addDays(cursor, 90) };
  const start = weekStart(cursor); return { start, end: addDays(start, 7) };
}
function periodLabel(view: AgendaViewKind, cursor: string) {
  if (view === 'day') return dateLong(cursor);
  if (view === 'month') return monthTitle(parseDate(cursor));
  if (view === 'list') return 'Lista de compromissos';
  const start = weekStart(cursor); const end = addDays(start, 6); const startDate = parseDate(start); const endDate = parseDate(end);
  const left = startDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const right = endDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${left} – ${right}`;
}
function shiftCursor(view: AgendaViewKind, cursor: string, amount: number) {
  if (view === 'month') { const date = parseDate(cursor); date.setMonth(date.getMonth() + amount); return localDate(date); }
  return addDays(cursor, amount * (view === 'week' ? 7 : 1));
}
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((item) => item[0]).join('').toUpperCase() || '—'; }
function blankForm(date = localDate(), time = '09:00', leadId = ''): FormState { return { leadId, type: 'reuniao', title: '', description: '', date, startsAt: time, endsAt: `${pad(Math.min(23, Number(time.slice(0, 2)) + 1))}:${time.slice(3)}`, timezone: 'America/Sao_Paulo', responsibleId: '', participants: '', location: '', reminders: '60', confirmation: 'pending', notes: '', status: 'pending' }; }

export default function Agenda() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [leads] = useLeadsStore();
  const [items, setItems] = useState<AgendaAppointment[]>([]);
  const [total, setTotal] = useState(0);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [searchInput, setSearchInput] = useState(() => params.get('q') ?? '');
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [history, setHistory] = useState<AgendaHistoryEntry[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [views, setViews] = useState<AgendaSavedView<AgendaView>[]>([]);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<AgendaAppointment[]>([]);
  const [pendingSave, setPendingSave] = useState<AgendaAppointment | null>(null);
  const [transition, setTransition] = useState<{ item: AgendaAppointment; status: 'cancelled' | 'no_show' | 'completed' } | null>(null);
  const [reason, setReason] = useState('');
  const [nextActionFor, setNextActionFor] = useState<AgendaAppointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<null | (() => Promise<void>)>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const view = (params.get('view') as AgendaViewKind) || 'week';
  const cursor = params.get('date') || localDate();
  const quick = params.get('quick') || '';
  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const filterState: AgendaFilters = useMemo(() => ({
    query: params.get('q') || '', responsibleId: params.get('responsible') || '', type: (params.get('type') || '') as AgendaFilters['type'],
    status: (params.get('status') || '') as AgendaFilters['status'], origin: (params.get('origin') || '') as AgendaFilters['origin'], segment: params.get('segment') || '',
    confirmation: (params.get('confirmation') || '') as AgendaFilters['confirmation'], nextAction: (params.get('nextAction') || '') as AgendaFilters['nextAction'],
    quick: quick as AgendaFilters['quick'], rangeStart: `${range.start}T00:00:00-03:00`, rangeEnd: `${range.end}T00:00:00-03:00`,
  }), [params, quick, range]);
  const workStart = Math.min(22, Math.max(0, Number(params.get('startHour') || 8)));
  const workEnd = Math.max(workStart + 1, Math.min(24, Number(params.get('endHour') || 18)));
  const isModified = Boolean(params.get('q') || params.get('responsible') || params.get('type') || params.get('status') || params.get('origin') || params.get('segment') || params.get('confirmation') || params.get('nextAction') || quick || params.get('startHour') || params.get('endHour'));

  const patchParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => patchParams({ q: searchInput.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, patchParams]);

  const load = useCallback(async () => {
    setStatus('loading');
    try { const result = await loadAgendaPortfolio(filterState, view === 'list' ? page * 25 : 0, view === 'list' ? 25 : 200); setItems(result.items); setTotal(result.total); setStatus('ready'); }
    catch (error) { console.error('[agenda] falha ao consultar agenda operacional', error); setStatus('error'); }
  }, [filterState, page, view]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadTeamMembers().then((members) => setTeam(members.filter((member) => member.status === 'active'))).catch((error) => console.error('[agenda] equipe indisponível', error)); }, []);
  useEffect(() => { void loadAgendaSavedViews<AgendaView>().then(setViews).catch((error) => console.error('[agenda] visões indisponíveis', error)); }, []);
  useEffect(() => {
    const requestedLeadId = params.get('leadId');
    if (params.get('new') === '1' && requestedLeadId && leads.some((lead) => lead.id === requestedLeadId)) {
      setForm(blankForm(cursor, '09:00', requestedLeadId)); patchParams({ new: null });
    }
  }, [cursor, leads, params, patchParams]);

  const pushMessage = (text: string, action?: () => Promise<void>) => { setMessage(text); setUndo(action ? () => action : null); window.setTimeout(() => { setMessage(''); setUndo(null); }, 7000); };
  const selectedLead = form ? leads.find((lead) => lead.id === form.leadId) : undefined;
  const filtersApplied = [
    filterState.responsibleId && ['Responsável', team.find((member) => member.userId === filterState.responsibleId)?.name || 'Selecionado'],
    filterState.type && ['Tipo', typeLabel[filterState.type]], filterState.status && ['Situação', statusLabel[filterState.status]],
    filterState.origin && ['Origem', originLabel[filterState.origin]], filterState.segment && ['Segmento', filterState.segment],
    filterState.confirmation && ['Confirmação', filterState.confirmation === 'confirmed' ? 'Confirmado' : 'Aguardando'],
    filterState.nextAction && ['Próxima ação', filterState.nextAction === 'with' ? 'Com próxima ação' : 'Sem próxima ação'],
  ].filter(Boolean) as [string, string][];

  const openForm = (date = cursor, time = '09:00', item?: AgendaAppointment) => {
    if (!item) { setForm(blankForm(date, time)); return; }
    setForm({ id: item.id, expectedUpdatedAt: item.updatedAt, leadId: item.leadId, type: item.type, title: item.title, description: item.description, date: dateFromIso(item.startsAt, item.timezone), startsAt: timeFromIso(item.startsAt, item.timezone), endsAt: timeFromIso(item.endsAt, item.timezone), timezone: item.timezone, responsibleId: item.responsibleId || '', participants: item.participants.join(', '), location: item.location, reminders: item.reminderMinutes.join(', '), confirmation: item.confirmationStatus, notes: item.notes, status: item.status });
  };
  const buildAppointment = (data: FormState): AgendaAppointment | null => {
    const lead = leads.find((candidate) => candidate.id === data.leadId); if (!lead) { pushMessage('Selecione um lead antes de salvar.'); return null; }
    const timezone = validAgendaTimezone(data.timezone); const startsAt = zonedUtc(data.date, data.startsAt, timezone); const endsAt = zonedUtc(data.date, data.endsAt, timezone);
    if (new Date(endsAt) <= new Date(startsAt)) { pushMessage('O horário final deve ser posterior ao horário inicial.'); return null; }
    const responsible = team.find((member) => member.userId === data.responsibleId);
    const existing = data.id && selected?.id === data.id ? selected : null;
    return { id: data.id || crypto.randomUUID(), leadId: lead.id, leadName: lead.nome, company: lead.empresa, phone: lead.telefone || lead.whatsapp || null, email: lead.email || null, segment: lead.segmento || null, stage: lead.etapa || null, title: data.title.trim() || `${typeLabel[data.type]} comercial`, description: data.description.trim(), notes: data.notes.trim(), type: data.type, status: data.status, confirmationStatus: data.confirmation, startsAt, endsAt, timezone, responsibleId: responsible?.userId || null, responsibleName: responsible?.name || 'Você', participants: data.participants.split(',').map((part) => part.trim()).filter(Boolean), location: data.location.trim(), reminderMinutes: data.reminders.split(',').map((part) => Number(part.trim())).filter((value) => Number.isInteger(value) && value >= 0 && value <= 43200).slice(0, 4), reminderStatus: data.reminders.trim() ? 'pending' : 'not_scheduled', origin: existing?.origin || 'manual', originConversationId: existing?.originConversationId || null, originMessageId: existing?.originMessageId || null, provider: existing?.provider || null, externalId: existing?.externalId || null, result: existing?.result || '', cancelReason: existing?.cancelReason || '', noShowReason: existing?.noShowReason || '', nextActionAt: existing?.nextActionAt || null, nextActionTitle: existing?.nextActionTitle || null, updatedAt: data.expectedUpdatedAt || new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString(), isOverdue: existing?.isOverdue || false };
  };
  const persist = async (candidate: AgendaAppointment, force = false) => {
    setSaving(true);
    try {
      const overlaps = force || !candidate.responsibleId ? [] : await findAgendaConflicts(candidate, candidate.id || undefined);
      if (overlaps.length && !force) { setPendingSave(candidate); setConflicts(overlaps); return; }
      const existing = Boolean(form?.id) || items.some((item) => item.id === candidate.id);
      const persisted = !existing ? await createOperationalAppointment(candidate) : await updateOperationalAppointment(candidate, form?.expectedUpdatedAt || candidate.updatedAt);
      setForm(null); setPendingSave(null); setConflicts([]); setSelected(persisted); await load(); pushMessage('Compromisso salvo na Agenda operacional.');
    } catch (error) {
      console.error('[agenda] falha ao salvar compromisso', error);
      pushMessage(error instanceof Error && error.message === 'appointment_concurrent_update' ? 'O compromisso foi alterado por outra pessoa. A Agenda foi atualizada.' : 'Não foi possível salvar. Nenhuma alteração foi confirmada.');
      await load();
    } finally { setSaving(false); }
  };
  const saveForm = async () => { if (!form) return; const candidate = buildAppointment(form); if (candidate) await persist(candidate); };
  const updateItem = async (item: AgendaAppointment, patch: Partial<AgendaAppointment>, previous?: AgendaAppointment) => {
    const candidate = { ...item, ...patch };
    try { const persisted = await updateOperationalAppointment(candidate, item.updatedAt); setSelected(persisted); await load(); pushMessage('Agenda atualizada.', previous ? async () => { await updateOperationalAppointment(previous, persisted.updatedAt); await load(); } : undefined); }
    catch (error) { console.error('[agenda] falha ao atualizar compromisso', error); pushMessage(error instanceof Error && error.message === 'appointment_concurrent_update' ? 'Alteração concorrente: os dados foram recarregados.' : 'Não foi possível atualizar o compromisso.'); await load(); }
  };
  const reschedule = async (item: AgendaAppointment, date: string, hour: string) => {
    const start = zonedUtc(date, hour, item.timezone); const end = addMinutes(start, minutesBetween(item.startsAt, item.endsAt));
    const candidate = { ...item, startsAt: start, endsAt: end };
    if (item.responsibleId) { const found = await findAgendaConflicts(candidate, item.id); if (found.length) { setPendingSave(candidate); setConflicts(found); return; } }
    await updateItem(item, { startsAt: start, endsAt: end }, item);
  };
  const handleTransition = async () => {
    if (!transition) return; if ((transition.status === 'cancelled' || transition.status === 'no_show') && !reason.trim()) return;
    const patch: Partial<AgendaAppointment> = transition.status === 'cancelled' ? { status: 'cancelled', cancelReason: reason.trim() } : transition.status === 'no_show' ? { status: 'no_show', noShowReason: reason.trim() } : { status: 'completed', result: reason.trim() };
    await updateItem(transition.item, patch); setTransition(null); setReason('');
  };
  const openItem = async (item: AgendaAppointment) => { setSelected(item); setHistory([]); try { setHistory(await loadAgendaHistory(item.id)); } catch (error) { console.error('[agenda] histórico indisponível', error); } };
  const saveView = async () => { const name = window.prompt('Nome da visão:'); if (!name?.trim()) return; const configuration: AgendaView = { view, filters: filterState, workStart, workEnd, date: cursor }; try { const created = await createAgendaSavedView(name, configuration); setViews((current) => [created, ...current]); pushMessage('Visão salva para este usuário.'); } catch { pushMessage('Não foi possível salvar esta visão.'); } };
  const applyView = (saved: AgendaSavedView<AgendaView>) => { const savedView = saved.configuration; patchParams({ view: savedView.view, date: savedView.date, q: savedView.filters.query || null, responsible: savedView.filters.responsibleId || null, type: savedView.filters.type || null, status: savedView.filters.status || null, origin: savedView.filters.origin || null, segment: savedView.filters.segment || null, confirmation: savedView.filters.confirmation || null, nextAction: savedView.filters.nextAction || null, quick: savedView.filters.quick || null, startHour: String(savedView.workStart), endHour: String(savedView.workEnd) }); setSearchInput(savedView.filters.query); setViewsOpen(false); };
  const updateCurrentView = async (saved: AgendaSavedView<AgendaView>) => { try { await updateAgendaSavedView(saved.id, { view, filters: filterState, workStart, workEnd, date: cursor }); pushMessage('Visão atualizada.'); } catch { pushMessage('Não foi possível atualizar a visão.'); } };
  const hours = Array.from({ length: workEnd - workStart }, (_, index) => workStart + index);
  const visibleDays = view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, index) => addDays(weekStart(cursor), index));
  const empty = status === 'ready' && items.length === 0;

  return <div className="wf-page wf-secondary-page wf-secondary-page--agenda">
    <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="wf-eyebrow">PLANEJAMENTO COMERCIAL</p><h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground-950">Agenda</h1><p className="mt-1 text-sm text-foreground-500">Organize reuniões, ligações e próximos passos da equipe comercial.</p></div>
      <div className="flex items-center gap-3"><span className="rounded-xl border border-background-200 bg-background-50 px-4 py-2.5 text-sm font-medium text-foreground-600">{total} compromisso{total === 1 ? '' : 's'} {view === 'week' ? 'nesta semana' : 'no período'}</span><button type="button" onClick={() => openForm(cursor)} className="wf-btn-primary"><i className="ri-add-line" />Novo compromisso</button></div>
    </section>

    <DataReadNotice status={status} onRetry={() => { void load(); }} />
    {message && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900"><span>{message}</span>{undo && <button type="button" className="font-semibold underline" onClick={() => void undo()}>Desfazer</button>}</div>}

    <section className="wf-surface overflow-visible">
      <div className="flex flex-wrap items-center gap-2 border-b border-background-200 px-4 py-3 sm:px-5">
        <button type="button" aria-label="Período anterior" onClick={() => patchParams({ date: shiftCursor(view, cursor, -1) })} className="wf-icon-button"><i className="ri-arrow-left-s-line" /></button>
        <button type="button" onClick={() => patchParams({ date: localDate() })} className="wf-btn-secondary px-3 text-xs">Hoje</button>
        <button type="button" aria-label="Próximo período" onClick={() => patchParams({ date: shiftCursor(view, cursor, 1) })} className="wf-icon-button"><i className="ri-arrow-right-s-line" /></button>
        <strong aria-live="polite" className="min-w-0 flex-1 px-2 text-sm text-foreground-900 sm:text-base">{periodLabel(view, cursor)}</strong>
        <div className="flex rounded-lg border border-background-200 bg-background-50 p-1" role="tablist" aria-label="Visão da Agenda">{([{ id: 'day', label: 'Dia' }, { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' }, { id: 'list', label: 'Lista' }] as const).map((option) => <button key={option.id} role="tab" aria-selected={view === option.id} type="button" onClick={() => { setPage(0); patchParams({ view: option.id }); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === option.id ? 'bg-primary-600 text-white shadow-sm' : 'text-foreground-600 hover:bg-background-100'}`}>{option.label}</button>)}</div>
      </div>
      <div className="grid gap-2 border-b border-background-200 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_190px_auto_auto] sm:px-5">
        <label className="relative"><span className="sr-only">Buscar compromisso</span><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={searchInput} onChange={(event) => { setPage(0); setSearchInput(event.target.value); }} placeholder="Buscar lead, empresa ou compromisso" className="wf-input w-full pl-9" /></label>
        <select aria-label="Responsável" value={filterState.responsibleId} onChange={(event) => { setPage(0); patchParams({ responsible: event.target.value || null }); }} className="wf-input"><option value="">Todos os responsáveis</option>{team.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select>
        <select aria-label="Tipo" value={filterState.type} onChange={(event) => { setPage(0); patchParams({ type: event.target.value || null }); }} className="wf-input"><option value="">Todos os tipos</option>{agendaTypes.map((type) => <option key={type} value={type}>{typeLabel[type]}</option>)}</select>
        <div className="relative"><button type="button" onClick={() => setViewsOpen((open) => !open)} className="wf-btn-secondary w-full justify-center text-xs"><i className="ri-bookmark-line" />Visões</button>{viewsOpen && <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-background-200 bg-background-50 p-2 shadow-xl"><p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Visões pessoais</p>{views.length ? views.map((saved) => <div key={saved.id} className="flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-background-100"><button type="button" onClick={() => applyView(saved)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground-800">{saved.isDefault && <i className="ri-star-fill mr-1 text-amber-500" />}{saved.name}</button><button type="button" title="Atualizar visão" onClick={() => void updateCurrentView(saved)} className="p-1 text-foreground-500 hover:text-primary-700"><i className="ri-save-line" /></button><button type="button" title="Definir como padrão" onClick={() => void setDefaultAgendaSavedView(saved.id).then(() => setViews((items) => items.map((item) => ({ ...item, isDefault: item.id === saved.id })))).catch(() => pushMessage('Não foi possível definir a visão padrão.'))} className="p-1 text-foreground-500 hover:text-amber-600"><i className="ri-star-line" /></button></div>) : <p className="px-2 py-3 text-xs text-foreground-500">Nenhuma visão salva.</p>}{isModified && <button type="button" onClick={() => void saveView()} className="mt-1 w-full rounded-lg bg-primary-50 px-2 py-2 text-left text-xs font-semibold text-primary-800 hover:bg-primary-100"><i className="ri-add-line mr-1" />Salvar configuração atual</button>}</div>}</div>
        <button type="button" onClick={() => setAdvanced((open) => !open)} className={`wf-btn-secondary justify-center text-xs ${advanced ? 'border-primary-300 text-primary-800' : ''}`}><i className="ri-equalizer-2-line" />Filtros</button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-background-200 px-4 py-2.5 sm:px-5">{([{ key: 'mine', label: 'Meus compromissos', icon: 'ri-user-line' }, { key: 'ana', label: 'Criados pela Ana', icon: 'ri-robot-2-line' }, { key: 'overdue', label: 'Atrasados', icon: 'ri-time-line' }] as const).map((option) => <button key={option.key} type="button" onClick={() => patchParams({ quick: quick === option.key ? null : option.key })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${quick === option.key ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-600 hover:bg-background-100'}`}><i className={`${option.icon} mr-1.5`} />{option.label}</button>)}</div>
      {advanced && <div className="grid gap-3 border-b border-background-200 bg-background-100/40 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-5"><SelectFilter label="Situação" value={filterState.status} onChange={(value) => patchParams({ status: value || null })} options={agendaStatuses.map((value) => [value, statusLabel[value]])} /><SelectFilter label="Origem" value={filterState.origin} onChange={(value) => patchParams({ origin: value || null })} options={agendaOrigins.map((value) => [value, originLabel[value]])} /><SelectFilter label="Confirmação" value={filterState.confirmation} onChange={(value) => patchParams({ confirmation: value || null })} options={[["pending", "Aguardando confirmação"], ["confirmed", "Confirmado"]]} /><SelectFilter label="Próxima ação" value={filterState.nextAction} onChange={(value) => patchParams({ nextAction: value || null })} options={[["with", "Com próxima ação"], ["without", "Sem próxima ação"]]} /><SelectFilter label="Segmento" value={filterState.segment} onChange={(value) => patchParams({ segment: value || null })} options={Array.from(new Set(leads.map((lead) => lead.segmento).filter(Boolean))).map((value) => [value, value])} /><SelectFilter label="Jornada inicial" value={String(workStart)} onChange={(value) => patchParams({ startHour: value === '8' ? null : value })} options={Array.from({ length: 20 }, (_, index) => [String(index + 4), `${pad(index + 4)}:00`])} /><SelectFilter label="Jornada final" value={String(workEnd)} onChange={(value) => patchParams({ endHour: value === '18' ? null : value })} options={Array.from({ length: 16 }, (_, index) => [String(index + 9), `${pad(index + 9)}:00`])} /><div className="flex items-end"><button type="button" onClick={() => { setSearchInput(''); patchParams({ q: null, responsible: null, type: null, status: null, origin: null, segment: null, confirmation: null, nextAction: null, quick: null, startHour: null, endHour: null }); }} className="text-sm font-semibold text-primary-700 hover:underline">Limpar filtros</button></div></div>}
      {filtersApplied.length > 0 && <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">{filtersApplied.map(([label, value]) => <span key={label} className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs text-primary-800">{label}: {value}</span>)}<button type="button" onClick={() => patchParams({ responsible: null, type: null, status: null, origin: null, segment: null, confirmation: null, nextAction: null })} className="text-xs font-semibold text-primary-700">Limpar filtros</button></div>}
    </section>

    <section className="mt-5">{view === 'list' ? <AgendaList items={items} total={total} page={page} selectedIds={selectedIds} onSelect={setSelectedIds} onPage={setPage} onOpen={(item) => void openItem(item)} /> : view === 'month' ? <MonthGrid cursor={cursor} items={items} onOpen={(item) => void openItem(item)} onDay={(date) => patchParams({ view: 'day', date })} /> : <CalendarGrid view={view} days={visibleDays} items={items} hours={hours} today={localDate()} timezone="America/Sao_Paulo" onOpen={(item) => void openItem(item)} onCreate={openForm} onDragStart={setDragId} onDrop={(date, hour) => { const item = items.find((candidate) => candidate.id === dragId); if (item) void reschedule(item, date, hour); setDragId(null); }} empty={empty} onPast={() => patchParams({ date: shiftCursor(view, cursor, -1) })} />}</section>

    {form && <AppointmentForm form={form} setForm={setForm} leads={leads} team={team} selectedLead={selectedLead} saving={saving} onClose={() => setForm(null)} onSave={() => void saveForm()} />}
    {conflicts.length > 0 && pendingSave && <ConflictDialog conflicts={conflicts} saving={saving} onCancel={() => { setConflicts([]); setPendingSave(null); }} onConfirm={() => void persist(pendingSave, true)} />}
    {selected && <AppointmentDrawer item={selected} history={history} onClose={() => setSelected(null)} onEdit={() => openForm(cursor, '09:00', selected)} onConfirm={() => void updateItem(selected, { status: 'confirmed', confirmationStatus: 'confirmed' })} onTransition={(next) => { setReason(next === 'completed' ? selected.result : ''); setTransition({ item: selected, status: next }); }} onReschedule={() => openForm(cursor, '09:00', selected)} onNext={() => setNextActionFor(selected)} onLead={() => navigate(`/dashboard/leads?leadId=${encodeURIComponent(selected.leadId)}`)} onConversation={() => selected.originConversationId ? navigate(`/dashboard/atendimento?conversationId=${encodeURIComponent(selected.originConversationId)}`) : pushMessage('Este compromisso não tem conversa de origem vinculada.')} />}
    {transition && <TransitionDialog state={transition.status} reason={reason} setReason={setReason} onClose={() => setTransition(null)} onConfirm={() => void handleTransition()} />}
    {nextActionFor && <NextActionDialog item={nextActionFor} onClose={() => setNextActionFor(null)} onCreate={async (intent) => {
      await createAgendaNextAction(nextActionFor, intent);
      setNextActionFor(null); setSelected(null); await load(); pushMessage('Próxima ação criada e vinculada.');
    }} />}
  </div>;
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) { return <label className="text-xs font-medium text-foreground-600"><span className="mb-1 block">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="wf-input w-full"><option value="">Todos</option>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>; }

function CalendarGrid({ view, days, items, hours, today, timezone, onOpen, onCreate, onDragStart, onDrop, empty, onPast }: { view: AgendaViewKind; days: string[]; items: AgendaAppointment[]; hours: number[]; today: string; timezone: string; onOpen: (item: AgendaAppointment) => void; onCreate: (date: string, hour: string) => void; onDragStart: (id: string) => void; onDrop: (date: string, hour: string) => void; empty: boolean; onPast: () => void; }) {
  return <div className="wf-surface overflow-x-auto"><div className="min-w-[780px]"><div className="grid border-b border-background-200" style={{ gridTemplateColumns: `80px repeat(${days.length}, minmax(120px, 1fr))` }}><div className="px-4 py-3 text-xs font-semibold text-foreground-500">Horário</div>{days.map((date) => <div key={date} className={`border-l border-background-200 px-3 py-2 text-center ${date === today ? 'bg-primary-50/70 text-primary-800' : ''}`}><span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground-500">{dayNames[parseDate(date).getDay()]}</span><strong className="text-sm">{parseDate(date).getDate()}</strong></div>)}</div><div className="relative">{hours.map((hour) => <div key={hour} className="grid min-h-[64px] border-b border-background-200/80" style={{ gridTemplateColumns: `80px repeat(${days.length}, minmax(120px, 1fr))` }}><div className="border-r border-background-200 px-4 pt-2 text-xs text-foreground-500">{pad(hour)}:00</div>{days.map((date) => <div key={date} role="button" tabIndex={0} onClick={() => onCreate(date, `${pad(hour)}:00`)} onKeyDown={(event) => { if (event.key === 'Enter') onCreate(date, `${pad(hour)}:00`); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(date, `${pad(hour)}:00`); }} className={`relative border-r border-background-200/80 transition hover:bg-primary-50/30 ${date === today ? 'bg-primary-50/20' : ''}`} aria-label={`Criar compromisso em ${date} às ${pad(hour)}:00`}>{items.filter((item) => dateFromIso(item.startsAt, item.timezone) === date && Number(timeFromIso(item.startsAt, item.timezone).slice(0, 2)) === hour).map((item) => <button key={item.id} draggable onDragStart={(event) => { event.stopPropagation(); onDragStart(item.id); }} onClick={(event) => { event.stopPropagation(); onOpen(item); }} className={`absolute inset-x-1 top-1 z-10 overflow-hidden rounded-md border px-2 py-1.5 text-left text-[11px] shadow-sm ${typeTone[item.type]}`} title={`${item.title} · ${timeFromIso(item.startsAt, item.timezone)} – ${timeFromIso(item.endsAt, item.timezone)}`}><span className="block truncate font-bold">{item.title}</span><span className="block truncate opacity-75">{item.leadName || item.company} · {timeFromIso(item.startsAt, item.timezone)}</span></button>)}</div>)}</div>)}</div>{empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="pointer-events-auto rounded-2xl bg-background-50/95 px-8 py-7 text-center shadow-lg"><i className="ri-calendar-line text-3xl text-foreground-400" /><h2 className="mt-3 font-heading text-xl font-bold text-foreground-950">Nenhum compromisso {view === 'day' ? 'neste dia' : 'nesta semana'}</h2><p className="mt-1 text-sm text-foreground-500">Crie um compromisso ou altere os filtros para consultar outro período.</p><button type="button" onClick={() => onCreate(days[0], '09:00')} className="wf-btn-primary mt-4"><i className="ri-add-line" />Novo compromisso</button><button type="button" onClick={onPast} className="ml-4 text-sm font-semibold text-primary-700 hover:underline">Ver compromissos anteriores</button></div></div>}</div></div>;
}

function MonthGrid({ cursor, items, onOpen, onDay }: { cursor: string; items: AgendaAppointment[]; onOpen: (item: AgendaAppointment) => void; onDay: (date: string) => void }) { const first = parseDate(monthStart(cursor)); const gridStart = addDays(localDate(first), -first.getDay()); const dates = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)); const month = first.getMonth(); return <div className="wf-surface overflow-x-auto"><div className="grid min-w-[720px] grid-cols-7 border-b border-background-200">{dayNames.map((name) => <div key={name} className="border-r border-background-200 px-3 py-2 text-center text-[11px] font-semibold uppercase text-foreground-500">{name}</div>)}</div><div className="grid min-w-[720px] grid-cols-7">{dates.map((date) => { const dayItems = items.filter((item) => dateFromIso(item.startsAt, item.timezone) === date); const muted = parseDate(date).getMonth() !== month; return <button type="button" key={date} onClick={() => onDay(date)} className={`min-h-28 border-b border-r border-background-200 p-2 text-left hover:bg-primary-50/40 ${muted ? 'bg-background-100/60 text-foreground-400' : ''}`}><span className="text-xs font-semibold">{parseDate(date).getDate()}</span>{dayItems.slice(0, 3).map((item) => <span key={item.id} onClick={(event) => { event.stopPropagation(); onOpen(item); }} className={`mt-1 block truncate rounded px-1.5 py-1 text-[10px] font-semibold ${typeTone[item.type]}`}>{timeFromIso(item.startsAt, item.timezone)} {item.title}</span>)}{dayItems.length > 3 && <span className="mt-1 text-[10px] font-semibold text-primary-700">+{dayItems.length - 3} compromissos</span>}</button>; })}</div></div>; }

function AgendaList({ items, total, page, selectedIds, onSelect, onPage, onOpen }: { items: AgendaAppointment[]; total: number; page: number; selectedIds: string[]; onSelect: (ids: string[]) => void; onPage: (page: number) => void; onOpen: (item: AgendaAppointment) => void }) { const all = items.length > 0 && items.every((item) => selectedIds.includes(item.id)); return <div className="wf-surface overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead className="bg-background-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-500"><tr><th className="px-4 py-3"><input aria-label="Selecionar página" type="checkbox" checked={all} onChange={() => onSelect(all ? [] : items.map((item) => item.id))} /></th>{['Data e horário', 'Tipo', 'Compromisso', 'Lead ou empresa', 'Responsável', 'Situação', 'Origem', 'Próxima ação'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-background-200 hover:bg-background-100/50"><td className="px-4 py-3"><input aria-label={`Selecionar ${item.title}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onSelect(selectedIds.includes(item.id) ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])} /></td><td className="px-3 py-3 text-xs text-foreground-600">{formatMoment(item.startsAt, item.timezone)}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs ${typeTone[item.type]}`}>{typeLabel[item.type]}</span></td><td className="px-3 py-3"><button type="button" onClick={() => onOpen(item)} className="font-semibold text-foreground-900 hover:text-primary-700">{item.title}</button></td><td className="px-3 py-3 text-foreground-700">{item.leadName || item.company}</td><td className="px-3 py-3 text-foreground-600">{item.responsibleName}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs ${statusTone[item.status]}`}>{item.isOverdue ? 'Atrasado' : statusLabel[item.status]}</span></td><td className="px-3 py-3 text-xs text-foreground-600">{originLabel[item.origin]}</td><td className="px-3 py-3 text-xs text-foreground-600">{item.nextActionTitle || '—'}</td></tr>)}</tbody></table>{items.length === 0 && <p className="p-10 text-center text-sm text-foreground-500">Nenhum compromisso encontrado com estes filtros.</p>}<div className="flex items-center justify-between border-t border-background-200 px-4 py-3 text-xs text-foreground-600"><span>{total} registro{total === 1 ? '' : 's'}</span><div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="wf-btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button><button type="button" disabled={(page + 1) * 25 >= total} onClick={() => onPage(page + 1)} className="wf-btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Próxima</button></div></div></div>; }

function AppointmentForm({ form, setForm, leads, team, selectedLead, saving, onClose, onSave }: { form: FormState; setForm: (form: FormState) => void; leads: { id: string; nome: string; empresa: string; telefone: string; whatsapp: string; email: string; segmento: string }[]; team: TeamMember[]; selectedLead?: { empresa: string; telefone: string; whatsapp: string; email: string }; saving: boolean; onClose: () => void; onSave: () => void; }) { const patch = (next: Partial<FormState>) => setForm({ ...form, ...next }); return <AccessibleDialog title={form.id ? 'Editar compromisso' : 'Novo compromisso'} onClose={onClose} className="wf-accessible-dialog--wide"><section className="max-h-[90vh] overflow-y-auto"><header className="flex items-start justify-between border-b border-background-200 px-5 py-4"><div><p className="wf-eyebrow">AGENDA COMERCIAL</p><h2 className="mt-1 font-heading text-xl font-bold text-foreground-950">{form.id ? 'Editar compromisso' : 'Novo compromisso'}</h2><p className="mt-1 text-sm text-foreground-500">Os horários são gravados em UTC com o fuso exibido abaixo.</p></div><button type="button" onClick={onClose} className="wf-icon-button" aria-label="Fechar"><i className="ri-close-line" /></button></header><div className="grid gap-4 p-5 md:grid-cols-2"><Field label="Tipo"><select value={form.type} onChange={(event) => patch({ type: event.target.value as AgendaType })} className="wf-input">{agendaTypes.map((type) => <option key={type} value={type}>{typeLabel[type]}</option>)}</select></Field><Field label="Lead ou contato"><select value={form.leadId} onChange={(event) => patch({ leadId: event.target.value })} className="wf-input"><option value="">Selecionar lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.nome} · {lead.empresa}</option>)}</select></Field><Field label="Empresa"><input readOnly value={selectedLead?.empresa || ''} placeholder="Preenchida a partir do lead" className="wf-input bg-background-100" /></Field><Field label="Responsável"><select value={form.responsibleId} onChange={(event) => patch({ responsibleId: event.target.value })} className="wf-input"><option value="">Você (criador)</option>{team.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></Field><Field label="Título" wide><input value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Ex.: Reunião de apresentação" className="wf-input" /></Field><Field label="Descrição" wide><textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} rows={2} className="wf-input" /></Field><Field label="Data"><input type="date" value={form.date} onChange={(event) => patch({ date: event.target.value })} className="wf-input" /></Field><Field label="Fuso horário"><select value={form.timezone} onChange={(event) => patch({ timezone: validAgendaTimezone(event.target.value) })} className="wf-input"><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="UTC">UTC</option></select></Field><Field label="Horário inicial"><input type="time" value={form.startsAt} onChange={(event) => patch({ startsAt: event.target.value })} className="wf-input" /></Field><Field label="Horário final"><input type="time" value={form.endsAt} onChange={(event) => patch({ endsAt: event.target.value })} className="wf-input" /></Field><Field label="Participantes"><input value={form.participants} onChange={(event) => patch({ participants: event.target.value })} placeholder="Nomes separados por vírgula" className="wf-input" /></Field><Field label="Local, telefone ou link"><input value={form.location} onChange={(event) => patch({ location: event.target.value })} placeholder={selectedLead?.telefone || selectedLead?.whatsapp || 'Presencial, telefone ou link'} className="wf-input" /></Field><Field label="Lembretes (minutos antes)"><input value={form.reminders} onChange={(event) => patch({ reminders: event.target.value })} placeholder="Ex.: 60, 1440" className="wf-input" /><p className="mt-1 text-[11px] text-foreground-500">O estado começa como pendente; entrega só é confirmada pelo canal.</p></Field><Field label="Confirmação"><select value={form.confirmation} onChange={(event) => patch({ confirmation: event.target.value as FormState['confirmation'], status: event.target.value === 'confirmed' ? 'confirmed' : 'pending' })} className="wf-input"><option value="pending">Aguardando confirmação</option><option value="confirmed">Confirmado</option></select></Field><Field label="Observações" wide><textarea value={form.notes} onChange={(event) => patch({ notes: event.target.value })} rows={3} className="wf-input" /></Field></div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={onClose} className="wf-btn-secondary">Cancelar</button><button type="button" disabled={saving} onClick={onSave} className="wf-btn-primary disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar compromisso'}</button></footer></section></AccessibleDialog>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`block text-sm font-medium text-foreground-700 ${wide ? 'md:col-span-2' : ''}`}><span className="mb-1.5 block">{label}</span>{children}</label>; }

function ConflictDialog({ conflicts, saving, onCancel, onConfirm }: { conflicts: AgendaAppointment[]; saving: boolean; onCancel: () => void; onConfirm: () => void }) { return <AccessibleDialog title="Conflito de horário" onClose={onCancel}><section className="w-full max-w-lg"><header className="border-b border-background-200 px-5 py-4"><h2 className="font-heading text-xl font-bold text-foreground-950">Conflito de horário</h2><p className="mt-1 text-sm text-foreground-500">O responsável já possui compromissos sobrepostos.</p></header><ul className="max-h-64 overflow-y-auto p-5">{conflicts.map((item) => <li key={item.id} className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{item.title}</strong><span className="mt-1 block text-foreground-600">{formatMoment(item.startsAt, item.timezone)} · {item.responsibleName}</span></li>)}</ul><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={onCancel} className="wf-btn-secondary">Revisar</button><button type="button" disabled={saving} onClick={onConfirm} className="wf-btn-primary">Prosseguir autorizado</button></footer></section></AccessibleDialog>; }

function AppointmentDrawer({ item, history, onClose, onEdit, onConfirm, onTransition, onReschedule, onNext, onLead, onConversation }: { item: AgendaAppointment; history: AgendaHistoryEntry[]; onClose: () => void; onEdit: () => void; onConfirm: () => void; onTransition: (status: 'cancelled' | 'no_show' | 'completed') => void; onReschedule: () => void; onNext: () => void; onLead: () => void; onConversation: () => void; }) { return <aside aria-label="Detalhes do compromisso" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-background-200 bg-background-50 shadow-2xl"><header className="flex items-start justify-between border-b border-background-200 p-5"><div><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${typeTone[item.type]}`}>{typeLabel[item.type]}</span><h2 className="mt-3 font-heading text-xl font-bold text-foreground-950">{item.title}</h2><p className="mt-1 text-sm text-foreground-500">{item.leadName} · {item.company || 'Empresa não informada'}</p></div><button type="button" onClick={onClose} className="wf-icon-button" aria-label="Fechar detalhes"><i className="ri-close-line" /></button></header><div className="flex-1 space-y-5 overflow-y-auto p-5"><div className="grid grid-cols-2 gap-3 text-sm"><Detail label="Responsável" value={item.responsibleName} /><Detail label="Origem" value={originLabel[item.origin]} /><Detail label="Data e horário" value={`${formatMoment(item.startsAt, item.timezone)} – ${timeFromIso(item.endsAt, item.timezone)}`} /><Detail label="Fuso" value={item.timezone} /><Detail label="Situação" value={item.isOverdue ? 'Atrasado' : statusLabel[item.status]} /><Detail label="Confirmação" value={item.confirmationStatus === 'confirmed' ? 'Confirmado' : 'Aguardando'} /></div>{item.description && <section><h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Descrição</h3><p className="mt-1 text-sm leading-6 text-foreground-700">{item.description}</p></section>}{item.location && <Detail label="Local, telefone ou link" value={item.location} wide />}{item.participants.length > 0 && <Detail label="Participantes" value={item.participants.join(', ')} wide />}{item.reminderMinutes.length > 0 && <Detail label="Lembretes" value={`${item.reminderMinutes.join(', ')} min · ${item.reminderStatus === 'sent' ? 'envio confirmado' : item.reminderStatus === 'failed' ? 'falhou' : 'pendente de confirmação'}`} wide />}{item.notes && <Detail label="Observações" value={item.notes} wide />}<section><h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Histórico</h3>{history.length ? <ol className="mt-2 space-y-2">{history.map((entry) => <li key={entry.id} className="border-l-2 border-primary-200 pl-3 text-xs text-foreground-600"><strong className="text-foreground-800">{entry.actorName}</strong> · {entry.detail || entry.action}<span className="mt-0.5 block text-foreground-400">{formatMoment(entry.occurredAt)}</span></li>)}</ol> : <p className="mt-2 text-xs text-foreground-500">O histórico será exibido quando houver registros auditáveis.</p>}</section></div><footer className="space-y-2 border-t border-background-200 p-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={onLead} className="wf-btn-secondary justify-center text-xs"><i className="ri-user-line" />Abrir lead</button><button type="button" onClick={onConversation} className="wf-btn-secondary justify-center text-xs"><i className="ri-message-3-line" />Conversa de origem</button><button type="button" onClick={onEdit} className="wf-btn-secondary justify-center text-xs"><i className="ri-edit-line" />Editar</button><button type="button" onClick={onReschedule} className="wf-btn-secondary justify-center text-xs"><i className="ri-calendar-2-line" />Reagendar</button></div>{!['completed', 'cancelled', 'no_show'].includes(item.status) && <div className="grid grid-cols-2 gap-2">{item.status === 'pending' && <button type="button" onClick={onConfirm} className="wf-btn-secondary justify-center text-xs"><i className="ri-checkbox-circle-line" />Confirmar</button>}<button type="button" onClick={() => onTransition('completed')} className="wf-btn-primary justify-center text-xs"><i className="ri-check-line" />Concluir</button><button type="button" onClick={onNext} className="wf-btn-secondary justify-center text-xs"><i className="ri-add-line" />Próxima ação</button><button type="button" onClick={() => onTransition('no_show')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800">Não compareceu</button><button type="button" onClick={() => onTransition('cancelled')} className="rounded-lg border border-accent-300 px-3 py-2 text-xs font-semibold text-accent-800">Cancelar</button></div>}</footer></aside>; }
function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'col-span-2' : ''}><span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">{label}</span><span className="mt-1 block break-words text-sm text-foreground-800">{value || '—'}</span></div>; }
function TransitionDialog({ state, reason, setReason, onClose, onConfirm }: { state: 'cancelled' | 'no_show' | 'completed'; reason: string; setReason: (value: string) => void; onClose: () => void; onConfirm: () => void }) { const required = state !== 'completed'; const title = state === 'completed' ? 'Registrar resultado' : state === 'cancelled' ? 'Cancelar compromisso' : 'Registrar ausência'; return <AccessibleDialog title={title} onClose={onClose}><section className="w-full max-w-md"><header className="border-b border-background-200 px-5 py-4"><h2 className="font-heading text-xl font-bold text-foreground-950">{title}</h2><p className="mt-1 text-sm text-foreground-500">{required ? 'Informe o motivo para preservar a trilha operacional.' : 'Registre o resultado antes de concluir.'}</p></header><div className="p-5"><label className="text-sm font-medium text-foreground-700">{required ? 'Motivo' : 'Resultado e observação'}<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="wf-input mt-1.5 w-full" /></label></div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={onClose} className="wf-btn-secondary">Voltar</button><button type="button" disabled={required && !reason.trim()} onClick={onConfirm} className="wf-btn-primary disabled:opacity-40">Confirmar</button></footer></section></AccessibleDialog>; }
function NextActionDialog({ item, onClose, onCreate }: { item: AgendaAppointment; onClose: () => void; onCreate: (intent: NextActionIntent) => Promise<void> }) {
  const [title, setTitle] = useState(`Retomar: ${item.title}`);
  const [date, setDate] = useState(addDays(dateFromIso(item.endsAt, item.timezone), 1));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [allowConflict, setAllowConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<NextActionIntent | null>(null);
  const inFlight = useRef(false);
  const submit = async () => {
    if (inFlight.current) return;
    const intent = pending ?? { requestId: crypto.randomUUID(), title, date, time, durationMinutes: duration, allowConflict };
    inFlight.current = true; setBusy(true); setError('');
    try {
      prepareAgendaNextAction(item, intent);
      setPending(intent);
      await onCreate(intent);
    } catch (failure) {
      setError(agendaNextActionError(failure));
      const code = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : '';
      if (/^appointment_(datetime_invalid|time_nonexistent|time_ambiguous|next_action_invalid|time_conflict|responsible_inactive|not_found_or_forbidden)$/.test(code)) setPending(null);
    } finally { inFlight.current = false; setBusy(false); }
  };
  const close = () => {
    if (busy) return;
    if (pending && !window.confirm('O resultado desta tentativa pode não estar confirmado. Antes de criar outra ação, atualize a Agenda e confira o compromisso original. Deseja fechar?')) return;
    onClose();
  };
  return <AccessibleDialog title="Criar próxima ação" onClose={close}><section className="w-full max-w-md">
    <header className="border-b border-background-200 px-5 py-4"><h2 className="font-heading text-xl font-bold text-foreground-950">Criar próxima ação</h2><p className="mt-1 text-sm text-foreground-500">Compromisso e vínculo serão gravados juntos. Fuso: {item.timezone}.</p></header>
    <div className="space-y-4 p-5">{error && <p role="alert" className="text-sm text-accent-800">{error}</p>}
      <fieldset disabled={busy || Boolean(pending)} className="space-y-4 disabled:opacity-70">
        <Field label="Título"><input maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} className="wf-input" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Data"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="wf-input" /></Field><Field label="Horário"><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="wf-input" /></Field></div>
        <Field label="Duração (minutos)"><input type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="wf-input" /></Field>
        <label className="flex gap-2 text-sm text-foreground-700"><input type="checkbox" checked={allowConflict} onChange={(event) => setAllowConflict(event.target.checked)} />Permitir sobreposição de horário para o responsável nesta ação</label>
      </fieldset>
      {pending && <p className="text-xs text-foreground-600">Uma nova confirmação usa o mesmo identificador e os mesmos dados, sem duplicar a ação.</p>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" disabled={busy} onClick={close} className="wf-btn-secondary">Fechar</button><button type="button" disabled={busy || !title.trim() || !date || !time || !Number.isInteger(duration) || duration < 1 || duration > 1440} onClick={() => void submit()} className="wf-btn-primary disabled:opacity-40">{busy ? 'Confirmando…' : pending ? 'Confirmar tentativa original' : 'Criar ação'}</button></footer>
  </section></AccessibleDialog>;
}
